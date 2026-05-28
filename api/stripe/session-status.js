import { verifyAndAttachUser } from '../../lib/middleware/auth.js';
import { getStripeClient } from '../../lib/billing/stripe.js';
import { getBillingContext } from '../../lib/billing/context.js';
import { getCurrentEntitlement } from '../../lib/billing/entitlements.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed. Use GET.' });
  }

  const authError = await verifyAndAttachUser(req);
  if (authError) {
    return res.status(authError.statusCode).json(JSON.parse(authError.body));
  }

  const sessionId = req.query?.session_id || req.query?.sessionId;
  if (!sessionId) {
    return res.status(400).json({ error: 'Missing session_id query parameter.' });
  }

  const stripe = getStripeClient();
  const context = await getBillingContext(req.user.userId);

  const session = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ['subscription', 'payment_intent'],
  });

  const entitlement = await getCurrentEntitlement(context.userId, context.organizationId);

  return res.status(200).json({
    session: {
      id: session.id,
      mode: session.mode,
      paymentStatus: session.payment_status,
      status: session.status,
      customer: session.customer,
      subscription: session.subscription
        ? {
            id: typeof session.subscription === 'string' ? session.subscription : session.subscription.id,
          }
        : null,
    },
    entitlement,
  });
}
