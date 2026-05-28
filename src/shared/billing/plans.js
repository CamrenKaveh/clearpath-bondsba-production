// Pricing determined by parallel market research (May 2026):
// - Marketing consultant: competitive audit of Bond-Pro, Tinubu, Erlon Surety, LendingWise, nCino
// - VC analyst: TAM sizing (3k-5k surety users, 4k-8k SBA users), unit economics, churn benchmarks
//
// Key finding: no competitor publishes a price below $500/mo for surety workflow software.
// LendingWise ($149/mo) is the only publicly priced SBA-adjacent tool — it's a full CRM/LOS,
// not a file-prep and calculation tool. Both products occupy uncontested price bands.
//
// Free tiers are permanently useful SEO magnets (calculators, screeners stay free).
// Paid tiers gate the output layer: packet builders, PDF export, ops queue.

// ─── BondSBA.com plans ───────────────────────────────────────────────────────

export const PLAN_ORDER = ['pro'];

export const PLAN_INTERVALS = ['monthly', 'yearly'];

export const PLAN_DISPLAY = {
  free: 'Free',
  pro:  'BondSBA AI',
};

export const PLAN_CATALOG = {
  free: {
    key: 'free',
    name: 'Free',
    monthlyPrice: 0,
    yearlyPrice: 0,
    recommended: false,
    bestFor: 'Use the tools — no account needed',
    // Free tier is generous: run the tools, see real results.
    // Paywall hits at the save/export moment — when they want to keep the output.
    limits: {
      fileChecks: 3,        // 3 runs, then they've seen real value
      extractionCredits: 0,
      users: 1,
    },
    features: {
      manual_readiness:      true,
      manual_wip_review:     true,   // can run, cannot save
      basic_handoff_memo:    false,
      saved_profiles:        false,  // no save = the paywall trigger
      readiness_history:     false,
      wip_history:           false,
      memo_history:          false,
      csv_xlsx_parsing:      false,
      team_workspace:        false,
      custom_templates:      false,
      priority_onboarding:   false,
      white_label_export:    false,
    },
    overages: {},
  },

  pro: {
    key: 'pro',
    name: 'BondSBA AI',
    // $15/month — signals professionalism, still under impulse threshold for any producer.
    // After Stripe fees (~$0.74): $14.26 kept per user.
    // 200 users = $2,852 MRR. 500 users = $7,130 MRR.
    // Strategy: free tier creates reliance, $15 removes friction while signaling real value.
    monthlyPrice: 15,
    yearlyPrice: 150,  // $12.50/mo billed annually — 2 months free
    recommended: true,
    bestFor: 'AI-powered submission workflow, unlimited saves, exports, and history',
    limits: {
      fileChecks: 999,        // unlimited
      extractionCredits: 20,
      users: 1,
    },
    features: {
      manual_readiness:      true,
      manual_wip_review:     true,
      basic_handoff_memo:    true,
      saved_profiles:        true,   // ← the thing they wanted
      readiness_history:     true,
      wip_history:           true,
      memo_history:          true,
      csv_xlsx_parsing:      true,
      team_workspace:        false,
      custom_templates:      false,
      priority_onboarding:   false,
      white_label_export:    false,
    },
    overages: {},
  },

  // Legacy plans — kept for entitlement resolution on existing accounts only
  starter:      { key: 'starter',      _legacy: true, monthlyPrice: 19,  features: {} },
  solo:         { key: 'solo',         _legacy: true, monthlyPrice: 99,  features: {} },
  professional: { key: 'professional', _legacy: true, monthlyPrice: 199, features: {} },
  operations:   { key: 'operations',   _legacy: true, monthlyPrice: 349, features: {} },
};

// ─── ClearPath (clearpathsbaloan.com) plans ──────────────────────────────────
// Separate catalog — different buyer (SBA broker), larger deal sizes ($5k–$25k fees),
// different feature set. Plans use cp_ prefix to avoid collision.
//
// Competitive context:
// - LendingWise broker edition: $149/mo (full CRM/LOS — different product category)
// - nCino: enterprise custom (bank-grade, not for independent brokers)
// - No competitor markets the correct FY2026 SBA guaranty fee schedule.
// - ClearPath occupies an uncontested niche: deal accuracy + lender packet quality.

// ClearPath uses the same simple Free + Pro ($5) structure.
// Same strategy: let them run screeners and calculators free,
// paywall hits when they want to save results or export.
export const SBA_PLAN_ORDER = ['cp_pro'];

export const SBA_PLAN_CATALOG = {
  cp_pro: {
    key: 'cp_pro',
    name: 'Pro',
    monthlyPrice: 5,
    yearlyPrice: 50,   // $4.17/mo billed annually
    recommended: true,
    bestFor: 'Save screener results, export checklists, and keep your deal history',
    limits: { dealFiles: 999, users: 1 },
    features: [
      'Ad-free experience',
      'Unlimited eligibility screener runs',
      'Saved screener results & deal history',
      'SBA 7(a) calculator — FY2026 guaranty fee schedule',
      'SBA 504 two-tranche calculator',
      'Document checklist — save & export to PDF',
      'Loan readiness check history',
      'Program comparison (7a vs 504 vs Express)',
    ],
  },

  // Legacy — kept for entitlement resolution only
  cp_solo: { key: 'cp_solo', _legacy: true, monthlyPrice: 129, features: [] },
  cp_team: { key: 'cp_team', _legacy: true, monthlyPrice: 229, features: [] },
  cp_firm: { key: 'cp_firm', _legacy: true, monthlyPrice: 429, features: [] },
};

// ─── Utilities ───────────────────────────────────────────────────────────────

export function resolvePlanConfig(planKey) {
  if (!planKey) return null;
  return PLAN_CATALOG[planKey] || SBA_PLAN_CATALOG[planKey] || null;
}

export function normalizePlan(planKey) {
  if (!planKey) return 'solo';
  const normalized = `${planKey}`.trim().toLowerCase();
  if (PLAN_CATALOG[normalized]) return normalized;
  if (SBA_PLAN_CATALOG[normalized]) return normalized;
  return 'solo';
}

export function normalizeInterval(interval) {
  if (!interval) return 'monthly';
  const normalized = `${interval}`.trim().toLowerCase();
  return normalized === 'yearly' ? 'yearly' : 'monthly';
}

export function buildEntitlementTemplate(planKey, periodStart, periodEnd, overrides = {}) {
  const plan = resolvePlanConfig(normalizePlan(planKey));
  const fallback = PLAN_CATALOG.solo;
  if (!plan) {
    return {
      plan: 'solo',
      status: 'inactive',
      active: false,
      fileChecksLimit: fallback.limits.fileChecks,
      fileChecksUsed: 0,
      extractionCreditsLimit: fallback.limits.extractionCredits,
      extractionCreditsUsed: 0,
      usersLimit: fallback.limits.users,
      features: fallback.features,
      periodStart,
      periodEnd,
      ...overrides,
    };
  }

  const limits = plan.limits || {};
  const resolvedFeatures = plan.features || fallback.features;

  return {
    plan: plan.key,
    status: 'inactive',
    active: false,
    fileChecksLimit: limits.fileChecks ?? limits.dealFiles ?? fallback.limits.fileChecks,
    fileChecksUsed: 0,
    extractionCreditsLimit: limits.extractionCredits ?? 0,
    extractionCreditsUsed: 0,
    usersLimit: limits.users ?? 1,
    features: resolvedFeatures,
    periodStart,
    periodEnd,
    ...overrides,
  };
}
