import { normalizeInterval, normalizePlan, PLAN_CATALOG, SBA_PLAN_CATALOG } from '../../src/shared/billing/plans.js';

const PRICE_ENV_MAP = {
  // ── Active plans ────────────────────────────────────────────────────────────
  // BondSBA AI ($15/mo)
  pro: {
    monthly: 'STRIPE_PRICE_PRO_MONTHLY',
    yearly:  'STRIPE_PRICE_PRO_YEARLY',
  },
  // ClearPath Pro ($5/mo)
  cp_pro: {
    monthly: 'STRIPE_PRICE_CP_PRO_MONTHLY',
    yearly:  'STRIPE_PRICE_CP_PRO_YEARLY',
  },

  // ── Legacy plans — kept for webhook entitlement resolution only ────────────
  starter: {
    monthly: 'STRIPE_PRICE_STARTER_MONTHLY',
    yearly:  'STRIPE_PRICE_STARTER_YEARLY',
  },
  professional: {
    monthly: 'STRIPE_PRICE_PROFESSIONAL_MONTHLY',
    yearly:  'STRIPE_PRICE_PROFESSIONAL_YEARLY',
  },
  operations: {
    monthly: 'STRIPE_PRICE_OPERATIONS_MONTHLY',
    yearly:  'STRIPE_PRICE_OPERATIONS_YEARLY',
  },
  pilot: {
    one_time: 'STRIPE_PRICE_FILE_PREP_PILOT',
  },
};

function resolveCatalog(plan) {
  return PLAN_CATALOG[plan] || SBA_PLAN_CATALOG[plan] || null;
}

export function getPlanFromPriceId(priceId) {
  if (!priceId) return null;
  for (const [plan, map] of Object.entries(PRICE_ENV_MAP)) {
    for (const envKey of Object.values(map)) {
      if (process.env[envKey] && process.env[envKey] === priceId) {
        return {
          plan,
          interval: envKey.includes('YEARLY') ? 'yearly' : 'monthly',
        };
      }
    }
  }
  return null;
}

export function getPriceId(planInput, intervalInput) {
  const plan = parseKnownPlan(planInput);
  const interval = normalizeInterval(intervalInput);

  if (!plan || plan === 'enterprise') return null;

  if (plan === 'pilot') {
    return process.env[PRICE_ENV_MAP.pilot.one_time] || '';
  }

  const envKey = PRICE_ENV_MAP[plan]?.[interval];
  return envKey ? process.env[envKey] || '' : '';
}

export function getCheckoutMode(planInput) {
  const plan = parseKnownPlan(planInput);
  if (plan === 'pilot') return 'payment';
  return 'subscription';
}

export function listMissingPriceEnv() {
  // Only report active plans as missing — legacy plans are optional.
  const activePlans = ['pro', 'cp_pro'];
  const missing = [];
  for (const plan of activePlans) {
    const cfg = PRICE_ENV_MAP[plan];
    for (const envKey of Object.values(cfg)) {
      if (!process.env[envKey]) {
        missing.push({ plan, envKey });
      }
    }
  }
  return missing;
}

export function isSupportedPaidPlan(planInput) {
  const plan = parseKnownPlan(planInput);
  return ['pro', 'cp_pro', 'starter', 'professional', 'operations', 'pilot'].includes(plan);
}

export function getPlanDisplayName(planInput) {
  const plan = parseKnownPlan(planInput) || normalizePlan(planInput);
  const entry = resolveCatalog(plan);
  if (!entry) return 'Pro';
  if (plan === 'pilot') return entry.name;
  return entry.name || 'Pro';
}

function parseKnownPlan(planInput) {
  if (!planInput) return 'pro';
  const plan = `${planInput}`.trim().toLowerCase();
  if (PLAN_CATALOG[plan]) return plan;
  if (SBA_PLAN_CATALOG[plan]) return plan;
  // pilot is a one-time payment plan managed directly in PRICE_ENV_MAP
  if (plan === 'pilot') return 'pilot';
  return null;
}
