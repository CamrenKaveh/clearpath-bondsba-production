import { verifyAndAttachUser } from '../../lib/middleware/auth.js';
import { getBillingContext } from '../../lib/billing/context.js';
import { findBillingCustomer } from '../../lib/billing/subscriptions.js';
import { getStripeClient, resolveAppUrl } from '../../lib/billing/stripe.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  const authError = await verifyAndAttachUser(req);
  if (authError) {
    return res.status(authError.statusCode).json(JSON.parse(authError.body));
  }

  const context = await getBillingContext(req.user.userId);
  const customer = await findBillingCustomer({
    userId: context.userId,
    organizationId: context.organizationId,
  });

  if (!customer?.stripe_customer_id) {
    return res.status(404).json({
      error: 'No billing customer found.',
      details: 'Choose a plan first to activate billing settings.',
    });
  }

  const stripe = getStripeClient();
  const portal = await stripe.billingPortal.sessions.create({
    customer: customer.stripe_customer_id,
    return_url: `${resolveAppUrl()}/settings/billing`,
  });

  return res.status(200).json({
    portalUrl: portal.url,
  });
}
