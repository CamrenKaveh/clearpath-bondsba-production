/**
 * api/stripe/[[...route]].js
 *
 * Single catch-all for all /api/stripe/* routes.
 * Keeps deployment under the 12-function Vercel Hobby cap.
 *
 * Routes:
 *   GET  /api/stripe/entitlement
 *   POST /api/stripe/create-checkout-session
 *   POST /api/stripe/create-portal-session
 *   GET  /api/stripe/session-status
 *   POST /api/stripe/webhook
 */

import { verifyAndAttachUser } from '../lib/middleware/auth.js';
import { getBillingContext } from '../lib/billing/context.js';
import { findBillingCustomer, upsertBillingCustomer, hasProcessedStripeEvent, recordBillingEvent, recordPayment, upsertSubscription } from '../lib/billing/subscriptions.js';
import { getCurrentEntitlement, upsertEntitlement, incrementEntitlementUsage } from '../lib/billing/entitlements.js';
import { getStripeClient, resolveAppUrl, getStripeWebhookSecret, readRawBody, readStripeHeaderSignature } from '../lib/billing/stripe.js';
import { getCheckoutMode, getPriceId, getPlanDisplayName, isSupportedPaidPlan, getPlanFromPriceId } from '../lib/billing/pricing.js';
import { getSupabaseAdminClient } from '../lib/billing/supabaseAdmin.js';

function safeJsonParse(body) {
  if (!body) return {};
  if (typeof body === 'object') return body;
  try { return JSON.parse(body); } catch { return {}; }
}

export default async function handler(req, res) {
  const segments = Array.isArray(req.query.route) ? req.query.route : (req.query.route ? [req.query.route] : []);
  const route = segments.join('/');

  switch (route) {
    case 'entitlement':          return handleEntitlement(req, res);
    case 'create-checkout-session': return handleCreateCheckout(req, res);
    case 'create-portal-session':   return handleCreatePortal(req, res);
    case 'session-status':       return handleSessionStatus(req, res);
    case 'create-subscription':  return handleCreateSubscription(req, res);
    case 'webhook':              return handleWebhook(req, res);
    default:
      return res.status(404).json({ error: `Route /api/stripe/${route} not found` });
  }
}

// ─── POST /api/stripe/create-subscription ─────────────────────────────────────
// Creates a Subscription with a trial, returns the SetupIntent client_secret
// so an embedded Stripe Payment Element can save the card without charging now.
async function handleCreateSubscription(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  const authError = await verifyAndAttachUser(req);
  if (authError) return res.status(authError.statusCode).json(JSON.parse(authError.body));

  const body = safeJsonParse(req.body);
  const { plan, interval = 'monthly' } = body;
  if (!plan) return res.status(400).json({ error: 'Missing plan parameter.' });
  if (!isSupportedPaidPlan(plan) || plan === 'pilot') {
    return res.status(400).json({ error: `Unsupported plan for embedded checkout: ${plan}` });
  }

  const context = await getBillingContext(req.user.userId);
  const priceId = getPriceId(plan, interval);
  if (!priceId) return res.status(400).json({ error: `No price found for plan ${plan} / ${interval}` });

  const stripe = getStripeClient();

  // Find or create the Stripe customer
  let customer = await findBillingCustomer({ userId: context.userId, organizationId: context.organizationId });
  if (!customer) {
    const stripeCustomer = await stripe.customers.create({
      email: req.user.email,
      metadata: { user_id: context.userId, organization_id: context.organizationId || '' },
    });
    customer = await upsertBillingCustomer({ userId: context.userId, organizationId: context.organizationId, stripeCustomerId: stripeCustomer.id });
  }

  const trialDays = Number(process.env.STRIPE_TRIAL_DAYS || 14);

  try {
    const subscription = await stripe.subscriptions.create({
      customer: customer.stripe_customer_id,
      items: [{ price: priceId }],
      trial_period_days: trialDays,
      payment_behavior: 'default_incomplete',
      payment_settings: { save_default_payment_method: 'on_subscription' },
      trial_settings: { end_behavior: { missing_payment_method: 'cancel' } },
      expand: ['pending_setup_intent'],
      metadata: { user_id: context.userId, organization_id: context.organizationId || '', plan, interval },
    });

    const setupIntent = subscription.pending_setup_intent;
    if (!setupIntent?.client_secret) {
      return res.status(500).json({ error: 'Stripe did not return a SetupIntent for trial collection.' });
    }

    return res.status(200).json({
      subscriptionId: subscription.id,
      clientSecret: setupIntent.client_secret,
      customerId: customer.stripe_customer_id,
      plan,
      interval,
      trialDays,
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to create subscription', detail: err?.message || 'Unknown error' });
  }
}

// ─── GET /api/stripe/entitlement ─────────────────────────────────────────────

async function handleEntitlement(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed. Use GET.' });
  const authError = await verifyAndAttachUser(req);
  if (authError) return res.status(authError.statusCode).json(JSON.parse(authError.body));

  const context = await getBillingContext(req.user.userId);
  const entitlement = await getCurrentEntitlement(context.userId, context.organizationId);
  const supabase = getSupabaseAdminClient();

  let subscription = null;
  try {
    const { data } = await supabase.from('subscriptions').select('*').eq('user_id', context.userId).order('created_at', { ascending: false }).limit(1).maybeSingle();
    subscription = data;
  } catch {}

  return res.status(200).json({ entitlement, subscription });
}

// ─── POST /api/stripe/create-checkout-session ────────────────────────────────

async function handleCreateCheckout(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  const authError = await verifyAndAttachUser(req);
  if (authError) return res.status(authError.statusCode).json(JSON.parse(authError.body));

  const body = safeJsonParse(req.body);
  const { plan, interval = 'monthly', successUrl, cancelUrl } = body;

  if (!plan) return res.status(400).json({ error: 'Missing plan parameter.' });
  if (!isSupportedPaidPlan(plan)) return res.status(400).json({ error: `Unsupported plan: ${plan}` });

  const context = await getBillingContext(req.user.userId);
  const priceId = getPriceId(plan, interval);
  if (!priceId) return res.status(400).json({ error: `No price found for plan ${plan} / ${interval}` });

  let customer = await findBillingCustomer({ userId: context.userId, organizationId: context.organizationId });
  const stripe = getStripeClient();
  const appUrl = resolveAppUrl();

  if (!customer) {
    const stripeCustomer = await stripe.customers.create({
      email: req.user.email,
      metadata: { user_id: context.userId, organization_id: context.organizationId || '' },
    });
    customer = await upsertBillingCustomer({ userId: context.userId, organizationId: context.organizationId, stripeCustomerId: stripeCustomer.id });
  }

  const mode = getCheckoutMode(plan);
  const sessionParams = {
    customer: customer.stripe_customer_id,
    mode,
    success_url: successUrl || `${appUrl}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: cancelUrl || `${appUrl}/pricing`,
    metadata: { user_id: context.userId, organization_id: context.organizationId || '', plan, interval },
  };

  const TRIAL_DAYS = Number(process.env.STRIPE_TRIAL_DAYS || 14);
  if (mode === 'subscription') {
    sessionParams.line_items = [{ price: priceId, quantity: 1 }];
    sessionParams.subscription_data = {
      metadata: { user_id: context.userId, organization_id: context.organizationId || '', plan, interval },
      trial_period_days: TRIAL_DAYS,
      trial_settings: { end_behavior: { missing_payment_method: 'cancel' } },
    };
  } else {
    sessionParams.line_items = [{ price: priceId, quantity: 1 }];
  }

  const session = await stripe.checkout.sessions.create(sessionParams);
  return res.status(200).json({ url: session.url, sessionId: session.id, plan: getPlanDisplayName(plan) });
}

// ─── POST /api/stripe/create-portal-session ──────────────────────────────────

async function handleCreatePortal(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  const authError = await verifyAndAttachUser(req);
  if (authError) return res.status(authError.statusCode).json(JSON.parse(authError.body));

  const context = await getBillingContext(req.user.userId);
  const customer = await findBillingCustomer({ userId: context.userId, organizationId: context.organizationId });
  if (!customer) return res.status(404).json({ error: 'No billing customer found.' });

  const stripe = getStripeClient();
  const appUrl = resolveAppUrl();
  const body = safeJsonParse(req.body);
  const returnUrl = body.returnUrl || `${appUrl}/settings/billing`;

  const session = await stripe.billingPortal.sessions.create({ customer: customer.stripe_customer_id, return_url: returnUrl });
  return res.status(200).json({ url: session.url });
}

// ─── GET /api/stripe/session-status ──────────────────────────────────────────

async function handleSessionStatus(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed. Use GET.' });
  const authError = await verifyAndAttachUser(req);
  if (authError) return res.status(authError.statusCode).json(JSON.parse(authError.body));

  const sessionId = req.query?.session_id || req.query?.sessionId;
  if (!sessionId) return res.status(400).json({ error: 'Missing session_id query parameter.' });

  const stripe = getStripeClient();
  const context = await getBillingContext(req.user.userId);
  const session = await stripe.checkout.sessions.retrieve(sessionId, { expand: ['subscription', 'payment_intent'] });
  const entitlement = await getCurrentEntitlement(context.userId, context.organizationId);

  return res.status(200).json({
    session: {
      id: session.id, mode: session.mode, paymentStatus: session.payment_status,
      status: session.status, customer: session.customer,
      subscription: session.subscription ? { id: typeof session.subscription === 'string' ? session.subscription : session.subscription.id } : null,
    },
    entitlement,
  });
}

// ─── POST /api/stripe/webhook ─────────────────────────────────────────────────

async function handleWebhook(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });

  const signature = readStripeHeaderSignature(req);
  const webhookSecret = getStripeWebhookSecret();
  if (!signature || !webhookSecret) return res.status(400).json({ error: 'Stripe webhook signature configuration missing.' });

  let event;
  try {
    const rawBody = await readRawBody(req);
    const stripe = getStripeClient();
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    return res.status(400).json({ error: `Webhook signature verification failed: ${err.message}` });
  }

  if (await hasProcessedStripeEvent(event.id)) return res.status(200).json({ received: true, deduped: true });

  let context = { userId: null, organizationId: null, plan: null, interval: null };

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const meta = session.metadata || {};
        const userId = meta.user_id || null;
        const orgId = meta.organization_id || null;
        const plan = meta.plan || 'starter';
        const stripeCustomerId = typeof session.customer === 'string' ? session.customer : session.customer?.id;
        if (userId && stripeCustomerId) await upsertBillingCustomer({ userId, organizationId: orgId, stripeCustomerId });
        if (userId) await recordPayment({ userId, organizationId: orgId, stripePaymentIntentId: typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id, stripeCheckoutSessionId: session.id, amount: session.amount_total || 0, currency: session.currency || 'usd', status: session.payment_status || 'paid', productType: session.mode === 'payment' ? 'pilot' : 'subscription', plan });
        if (session.mode === 'payment' && userId) {
          const start = new Date(); const end = new Date(start); end.setUTCDate(end.getUTCDate() + 30);
          await upsertEntitlement({ userId, organizationId: orgId, plan: 'pilot', status: 'active', periodStart: start.toISOString(), periodEnd: end.toISOString() });
        }
        context = { userId, organizationId: orgId, plan, interval: meta.interval || 'monthly' };
        break;
      }
      case 'customer.subscription.trial_will_end': {
        // Fires 3 days before trial ends. Send reminder email.
        const sub = event.data.object;
        const stripeCustomerId = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id;
        const customer = await findBillingCustomer({ stripeCustomerId });
        if (customer) {
          await sendTrialEndingEmail({
            stripe, stripeCustomerId,
            trialEndUnix: sub.trial_end,
            plan: sub.items?.data?.[0]?.price?.id || 'subscription',
          }).catch((e) => console.warn('trial reminder email failed:', e.message));
          context = { userId: customer.user_id, organizationId: customer.organization_id };
        }
        break;
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        const stripeCustomerId = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id;
        const customer = await findBillingCustomer({ stripeCustomerId });
        if (customer) {
          const priceId = sub.items?.data?.[0]?.price?.id;
          const mapped = priceId ? getPlanFromPriceId(priceId) : { plan: 'starter', interval: 'monthly' };
          const status = event.type === 'customer.subscription.deleted' ? 'canceled' : (sub.status === 'active' ? 'active' : sub.status);
          await upsertSubscription({ userId: customer.user_id, organizationId: customer.organization_id, stripeSubscriptionId: sub.id, stripeCustomerId, plan: mapped.plan, status, currentPeriodStart: sub.current_period_start ? new Date(sub.current_period_start * 1000).toISOString() : null, currentPeriodEnd: sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null });
          await upsertEntitlement({ userId: customer.user_id, organizationId: customer.organization_id, plan: mapped.plan, status, periodStart: sub.current_period_start ? new Date(sub.current_period_start * 1000).toISOString() : null, periodEnd: sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null });
          context = { userId: customer.user_id, organizationId: customer.organization_id, plan: mapped.plan };
        }
        break;
      }
      default: break;
    }

    await recordBillingEvent({ stripeEventId: event.id, eventType: event.type, userId: context.userId, organizationId: context.organizationId, payload: event.data?.object || {} });
  } catch (err) {
    console.error('Stripe webhook processing failed:', err);
    return res.status(500).json({ error: 'Webhook processing failed.' });
  }

  return res.status(200).json({ received: true });
}

// ─── Trial-ending reminder email (Resend) ──────────────────────────────────────
async function sendTrialEndingEmail({ stripe, stripeCustomerId, trialEndUnix, plan }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return; // silently skip if not configured
  const cust = await stripe.customers.retrieve(stripeCustomerId).catch(() => null);
  const to = cust?.email;
  if (!to) return;
  const endDate = trialEndUnix ? new Date(trialEndUnix * 1000).toLocaleDateString('en-US', { month: 'long', day: 'numeric' }) : 'in 3 days';
  const subject = `Your BondSBA trial ends ${endDate} — cancel anytime`;
  const html = `<!doctype html><html><body style="font-family:system-ui,-apple-system,sans-serif;color:#0f172a;line-height:1.5;max-width:560px;margin:24px auto;padding:0 16px">
<h2 style="margin:0 0 16px;font-size:20px">Your trial ends ${endDate}</h2>
<p>You're 3 days from the end of your 14-day BondSBA trial. After that we'll charge the card on file for the ${plan === 'subscription' ? 'plan you selected' : plan} subscription.</p>
<p>Nothing to do if you want to continue — your access stays on.</p>
<p>If you'd rather cancel before being charged, manage your subscription:<br/>
<a href="https://bondsba.com/settings/billing" style="color:#0B1F3A;font-weight:600;text-decoration:underline">bondsba.com/settings/billing</a></p>
<p style="color:#64748b;font-size:12px;margin-top:24px">BondSBA · Surety file-prep workflow · contactbondsba@gmail.com</p>
</body></html>`;
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: 'BondSBA <noreply@bondsba.com>', to, subject, html }),
  });
}
