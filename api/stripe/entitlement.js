import { verifyAndAttachUser } from '../../lib/middleware/auth.js';
import { getBillingContext } from '../../lib/billing/context.js';
import { getCurrentEntitlement } from '../../lib/billing/entitlements.js';
import { getSupabaseAdminClient } from '../../lib/billing/supabaseAdmin.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed. Use GET.' });
  }

  const authError = await verifyAndAttachUser(req);
  if (authError) {
    return res.status(authError.statusCode).json(JSON.parse(authError.body));
  }

  const context = await getBillingContext(req.user.userId);
  const entitlement = await getCurrentEntitlement(context.userId, context.organizationId);
  const supabase = getSupabaseAdminClient();

  let subscription = null;
  try {
    let query = supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', context.userId)
      .order('created_at', { ascending: false })
      .limit(1);
    query = context.organizationId
      ? query.eq('organization_id', context.organizationId)
      : query.is('organization_id', null);
    const { data } = await query;
    subscription = data?.[0] || null;
  } catch {
    subscription = null;
  }

  return res.status(200).json({
    userId: context.userId,
    organizationId: context.organizationId,
    entitlement,
    subscription: subscription
      ? {
          plan: subscription.plan,
          interval: subscription.interval,
          status: subscription.status,
          currentPeriodEnd: subscription.current_period_end,
          currentPeriodStart: subscription.current_period_start,
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
        }
      : null,
  });
}
