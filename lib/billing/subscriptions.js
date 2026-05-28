import { normalizeInterval, normalizePlan } from '../../src/shared/billing/plans.js';
import { getSupabaseAdminClient } from './supabaseAdmin.js';

function scopedQuery(baseQuery, organizationId) {
  if (!organizationId) {
    return baseQuery.is('organization_id', null);
  }
  return baseQuery.eq('organization_id', organizationId);
}

export async function findBillingCustomer({ userId = null, organizationId = null, stripeCustomerId = null }) {
  const supabase = getSupabaseAdminClient();

  if (userId) {
    let query = supabase
      .from('billing_customers')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1);

    query = scopedQuery(query, organizationId);
    const { data, error } = await query;
    if (!error && data?.[0]) return data[0];
  }

  if (stripeCustomerId) {
    const { data: byStripe } = await supabase
      .from('billing_customers')
      .select('*')
      .eq('stripe_customer_id', stripeCustomerId)
      .limit(1);
    if (byStripe?.[0]) return byStripe[0];
  }

  return null;
}

export async function upsertBillingCustomer({ userId, organizationId = null, stripeCustomerId }) {
  const supabase = getSupabaseAdminClient();
  const payload = {
    user_id: userId,
    organization_id: organizationId,
    stripe_customer_id: stripeCustomerId,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('billing_customers')
    .upsert(payload, { onConflict: 'stripe_customer_id' })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function upsertSubscription({
  userId,
  organizationId = null,
  stripeCustomerId,
  stripeSubscriptionId,
  stripePriceId,
  plan,
  interval,
  status,
  currentPeriodStart,
  currentPeriodEnd,
  cancelAtPeriodEnd = false,
}) {
  const supabase = getSupabaseAdminClient();

  const payload = {
    user_id: userId,
    organization_id: organizationId,
    stripe_customer_id: stripeCustomerId,
    stripe_subscription_id: stripeSubscriptionId,
    stripe_price_id: stripePriceId,
    plan: normalizePlan(plan),
    interval: normalizeInterval(interval),
    status: status || 'incomplete',
    current_period_start: currentPeriodStart ? new Date(currentPeriodStart).toISOString() : null,
    current_period_end: currentPeriodEnd ? new Date(currentPeriodEnd).toISOString() : null,
    cancel_at_period_end: Boolean(cancelAtPeriodEnd),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('subscriptions')
    .upsert(payload, { onConflict: 'stripe_subscription_id' })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function recordBillingEvent({
  stripeEventId,
  eventType,
  userId = null,
  organizationId = null,
  payload = {},
}) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from('billing_events')
    .upsert(
      {
        stripe_event_id: stripeEventId,
        event_type: eventType,
        user_id: userId,
        organization_id: organizationId,
        payload,
        processed_at: new Date().toISOString(),
      },
      { onConflict: 'stripe_event_id' }
    )
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function hasProcessedStripeEvent(stripeEventId) {
  if (!stripeEventId) return false;
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from('billing_events')
    .select('id')
    .eq('stripe_event_id', stripeEventId)
    .limit(1);
  if (error) return false;
  return Boolean(data?.length);
}

export async function recordPayment({
  userId,
  organizationId = null,
  stripePaymentIntentId = null,
  stripeCheckoutSessionId = null,
  amount,
  currency = 'usd',
  status = 'succeeded',
  productType = 'subscription',
  plan = 'starter',
}) {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.from('payments').insert({
    user_id: userId,
    organization_id: organizationId,
    stripe_payment_intent_id: stripePaymentIntentId,
    stripe_checkout_session_id: stripeCheckoutSessionId,
    amount,
    currency,
    status,
    product_type: productType,
    plan: normalizePlan(plan),
  });
  if (error) throw error;
}
