import { getStripeClient, getStripeWebhookSecret, readRawBody, readStripeHeaderSignature } from '../../lib/billing/stripe.js';
import {
  findBillingCustomer,
  hasProcessedStripeEvent,
  recordBillingEvent,
  recordPayment,
  upsertBillingCustomer,
  upsertSubscription,
} from '../../lib/billing/subscriptions.js';
import { getPlanFromPriceId } from '../../lib/billing/pricing.js';
import { upsertEntitlement } from '../../lib/billing/entitlements.js';

function unixSecondsToIso(seconds, fallback = null) {
  if (!seconds) return fallback;
  return new Date(seconds * 1000).toISOString();
}

function normalizeOrgId(value) {
  if (!value) return null;
  const normalized = `${value}`.trim();
  return normalized || null;
}

function normalizeIntervalFromSubscription(subscription) {
  const interval = subscription?.items?.data?.[0]?.price?.recurring?.interval;
  return interval === 'year' ? 'yearly' : 'monthly';
}

async function handleCheckoutCompleted(session) {
  const metadata = session.metadata || {};
  const userId = metadata.user_id || null;
  const organizationId = normalizeOrgId(metadata.organization_id);
  const plan = metadata.plan || 'starter';
  const interval = metadata.interval || 'monthly';
  const stripeCustomerId = typeof session.customer === 'string' ? session.customer : session.customer?.id;

  if (userId && stripeCustomerId) {
    await upsertBillingCustomer({
      userId,
      organizationId,
      stripeCustomerId,
    });
  }

  if (userId) {
    await recordPayment({
      userId,
      organizationId,
      stripePaymentIntentId: typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id,
      stripeCheckoutSessionId: session.id,
      amount: session.amount_total || 0,
      currency: session.currency || 'usd',
      status: session.payment_status || 'paid',
      productType: session.mode === 'payment' ? 'pilot' : 'subscription',
      plan,
    });
  }

  // Pilot checkout: grant a temporary active pilot workspace window if we have user linkage.
  if (session.mode === 'payment' && userId) {
    const start = new Date();
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 30);
    await upsertEntitlement({
      userId,
      organizationId,
      plan: 'pilot',
      status: 'active',
      periodStart: start.toISOString(),
      periodEnd: end.toISOString(),
    });
  }

  return {
    userId,
    organizationId,
    plan,
    interval,
  };
}

async function handleSubscriptionChanged(subscription, statusOverride = null) {
  const stripeCustomerId = typeof subscription.customer === 'string'
    ? subscription.customer
    : subscription.customer?.id;

  const customer = await findBillingCustomer({
    stripeCustomerId,
  });
  if (!customer) {
    return { userId: null, organizationId: null, plan: null, interval: null };
  }

  const stripePriceId = subscription?.items?.data?.[0]?.price?.id || null;
  const mapped = getPlanFromPriceId(stripePriceId) || { plan: 'starter', interval: normalizeIntervalFromSubscription(subscription) };
  const status = statusOverride || subscription.status || 'incomplete';

  await upsertSubscription({
    userId: customer.user_id,
    organizationId: customer.organization_id,
    stripeCustomerId,
    stripeSubscriptionId: subscription.id,
    stripePriceId,
    plan: mapped.plan,
    interval: mapped.interval,
    status,
    currentPeriodStart: unixSecondsToIso(subscription.current_period_start),
    currentPeriodEnd: unixSecondsToIso(subscription.current_period_end),
    cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
  });

  await upsertEntitlement({
    userId: customer.user_id,
    organizationId: customer.organization_id,
    plan: mapped.plan,
    status,
    periodStart: unixSecondsToIso(subscription.current_period_start, new Date().toISOString()),
    periodEnd: unixSecondsToIso(subscription.current_period_end, new Date().toISOString()),
  });

  return {
    userId: customer.user_id,
    organizationId: customer.organization_id,
    plan: mapped.plan,
    interval: mapped.interval,
  };
}

async function handleInvoicePayment(invoice, status = 'succeeded') {
  const stripeCustomerId = typeof invoice.customer === 'string'
    ? invoice.customer
    : invoice.customer?.id;
  const customer = await findBillingCustomer({ stripeCustomerId });
  if (!customer) return null;

  const stripePriceId = invoice?.lines?.data?.[0]?.price?.id || null;
  const mapped = getPlanFromPriceId(stripePriceId) || { plan: 'starter' };

  await recordPayment({
    userId: customer.user_id,
    organizationId: customer.organization_id,
    stripePaymentIntentId: typeof invoice.payment_intent === 'string' ? invoice.payment_intent : invoice.payment_intent?.id,
    stripeCheckoutSessionId: null,
    amount: invoice.amount_paid ?? invoice.amount_due ?? 0,
    currency: invoice.currency || 'usd',
    status,
    productType: 'subscription',
    plan: mapped.plan,
  });

  return {
    userId: customer.user_id,
    organizationId: customer.organization_id,
    plan: mapped.plan,
    interval: null,
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const signature = readStripeHeaderSignature(req);
  const webhookSecret = getStripeWebhookSecret();
  if (!signature || !webhookSecret) {
    return res.status(400).json({ error: 'Stripe webhook signature configuration missing.' });
  }

  let event;
  try {
    const rawBody = await readRawBody(req);
    const stripe = getStripeClient();
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (error) {
    return res.status(400).json({ error: `Webhook signature verification failed: ${error.message}` });
  }

  if (await hasProcessedStripeEvent(event.id)) {
    return res.status(200).json({ received: true, deduped: true });
  }

  let context = { userId: null, organizationId: null, plan: null, interval: null };

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        context = await handleCheckoutCompleted(event.data.object);
        break;
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        context = await handleSubscriptionChanged(event.data.object);
        break;
      case 'customer.subscription.deleted':
        context = await handleSubscriptionChanged(event.data.object, 'canceled');
        break;
      case 'invoice.payment_succeeded':
        context = (await handleInvoicePayment(event.data.object, 'succeeded')) || context;
        break;
      case 'invoice.payment_failed':
        context = (await handleInvoicePayment(event.data.object, 'failed')) || context;
        break;
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object;
        const customer = await findBillingCustomer({
          stripeCustomerId: typeof paymentIntent.customer === 'string' ? paymentIntent.customer : paymentIntent.customer?.id,
        });
        if (customer) {
          await recordPayment({
            userId: customer.user_id,
            organizationId: customer.organization_id,
            stripePaymentIntentId: paymentIntent.id,
            amount: paymentIntent.amount_received || paymentIntent.amount || 0,
            currency: paymentIntent.currency || 'usd',
            status: 'succeeded',
            productType: 'payment_intent',
            plan: 'pilot',
          });
          context = {
            userId: customer.user_id,
            organizationId: customer.organization_id,
            plan: 'pilot',
            interval: null,
          };
        }
        break;
      }
      default:
        break;
    }

    await recordBillingEvent({
      stripeEventId: event.id,
      eventType: event.type,
      userId: context.userId,
      organizationId: context.organizationId,
      payload: event.data?.object || {},
    });
  } catch (error) {
    console.error('Stripe webhook processing failed:', error);
    return res.status(500).json({ error: 'Webhook processing failed.' });
  }

  return res.status(200).json({ received: true });
}
