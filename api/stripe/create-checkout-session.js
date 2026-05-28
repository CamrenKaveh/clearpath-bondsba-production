import { verifyAndAttachUser } from '../../lib/middleware/auth.js';
import { getBillingContext } from '../../lib/billing/context.js';
import {
  findBillingCustomer,
  upsertBillingCustomer,
} from '../../lib/billing/subscriptions.js';
import { getCheckoutMode, getPriceId, getPlanDisplayName, isSupportedPaidPlan } from '../../lib/billing/pricing.js';
import { getStripeClient, resolveAppUrl } from '../../lib/billing/stripe.js';

function safeJsonParse(body) {
  if (!body) return {};
  if (typeof body === 'object') return body;
  try {
    return JSON.parse(body);
  } catch {
    return {};
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  const authError = await verifyAndAttachUser(req);
  if (authError) {
    return res.status(authError.statusCode).json(JSON.parse(authError.body));
  }

  const { plan = 'starter', interval = 'monthly' } = safeJsonParse(req.body);
  if (!isSupportedPaidPlan(plan)) {
    return res.status(400).json({
      error: 'Unsupported plan for checkout.',
      details: 'Enterprise is quote-based and does not use self-serve checkout.',
    });
  }

  const priceId = getPriceId(plan, interval);
  if (!priceId) {
    return res.status(500).json({
      error: 'Stripe price is not configured for this plan.',
      details: `Missing price ID for ${plan}/${interval}.`,
    });
  }

  const stripe = getStripeClient();
  const appUrl = resolveAppUrl();
  const context = await getBillingContext(req.user.userId);

  let customerRecord = await findBillingCustomer({
    userId: context.userId,
    organizationId: context.organizationId,
  });

  let stripeCustomerId = customerRecord?.stripe_customer_id || null;
  if (!stripeCustomerId) {
    const customer = await stripe.customers.create({
      email: req.user.email || undefined,
      metadata: {
        user_id: context.userId,
        organization_id: context.organizationId || '',
      },
      name: req.user.metadata?.full_name || undefined,
    });
    stripeCustomerId = customer.id;
    customerRecord = await upsertBillingCustomer({
      userId: context.userId,
      organizationId: context.organizationId,
      stripeCustomerId,
    });
  }

  const mode = getCheckoutMode(plan);

  const session = await stripe.checkout.sessions.create({
    mode,
    customer: stripeCustomerId,
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    success_url: `${appUrl}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl}/pricing?checkout=cancelled`,
    allow_promotion_codes: true,
    metadata: {
      user_id: context.userId,
      organization_id: context.organizationId || '',
      plan,
      interval,
      product_type: mode === 'payment' ? 'pilot' : 'subscription',
      billing_customer_id: customerRecord?.id || '',
    },
  });

  return res.status(200).json({
    checkoutUrl: session.url,
    sessionId: session.id,
    planLabel: getPlanDisplayName(plan),
  });
}
