import { verifyAndAttachUser } from '../../lib/middleware/auth.js';
import { assertUsageCapacity } from '../../lib/billing/access.js';
import { getBillingContext } from '../../lib/billing/context.js';
import {
  getCurrentEntitlement,
  incrementEntitlementUsage,
  recordUsageEvent,
} from '../../lib/billing/entitlements.js';

function parseBody(body) {
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

  const body = parseBody(req.body);
  const action = body.action || 'file_check';
  const quantity = Number(body.quantity) > 0 ? Number(body.quantity) : 1;

  const context = await getBillingContext(req.user.userId);
  const capacity = await assertUsageCapacity({
    userId: context.userId,
    organizationId: context.organizationId,
    counter: 'file_check',
    quantity,
  });

  if (!capacity.allowed) {
    return res.status(402).json({
      error: 'File check limit reached.',
      reason: capacity.reason || 'file_checks_exceeded',
      remaining: capacity.remaining ?? 0,
      entitlement: capacity.entitlement,
      action: 'upgrade_or_manual',
    });
  }

  await recordUsageEvent({
    userId: context.userId,
    organizationId: context.organizationId,
    eventType: 'file_check',
    quantity,
    metadata: {
      action,
    },
  }).catch(() => {});

  await incrementEntitlementUsage({
    userId: context.userId,
    organizationId: context.organizationId,
    counter: 'file_checks_used',
    quantity,
  }).catch(() => {});

  const entitlement = await getCurrentEntitlement(context.userId, context.organizationId);

  return res.status(200).json({
    ok: true,
    eventType: 'file_check',
    quantity,
    entitlement,
  });
}
