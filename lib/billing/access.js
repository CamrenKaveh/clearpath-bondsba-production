import { getCurrentEntitlement } from './entitlements.js';

export async function assertFeatureAccess({
  userId,
  organizationId = null,
  featureKey,
}) {
  const entitlement = await getCurrentEntitlement(userId, organizationId);
  const hasFeature = Boolean(entitlement.features?.[featureKey]);

  return {
    allowed: entitlement.active && hasFeature,
    entitlement,
  };
}

export async function assertUsageCapacity({
  userId,
  organizationId = null,
  counter,
  quantity = 1,
}) {
  const entitlement = await getCurrentEntitlement(userId, organizationId);
  const active = entitlement.active;

  if (!active) {
    return {
      allowed: false,
      reason: 'inactive_plan',
      entitlement,
    };
  }

  if (counter === 'file_check') {
    const limit = entitlement.fileChecksLimit;
    if (limit == null) return { allowed: true, entitlement };
    const remaining = limit - entitlement.fileChecksUsed;
    return {
      allowed: remaining >= quantity,
      reason: remaining >= quantity ? null : 'file_checks_exceeded',
      remaining,
      entitlement,
    };
  }

  if (counter === 'extraction_credit') {
    const limit = entitlement.extractionCreditsLimit;
    if (limit == null) return { allowed: true, entitlement };
    const remaining = limit - entitlement.extractionCreditsUsed;
    return {
      allowed: remaining >= quantity,
      reason: remaining >= quantity ? null : 'extraction_credits_exceeded',
      remaining,
      entitlement,
    };
  }

  return { allowed: false, reason: 'unknown_counter', entitlement };
}
