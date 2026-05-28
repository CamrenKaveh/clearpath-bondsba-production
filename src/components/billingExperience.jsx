import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { getAuthToken } from '../shared/utils/supabaseClient';
import { PLAN_CATALOG, PLAN_ORDER, SBA_PLAN_CATALOG, SBA_PLAN_ORDER, resolvePlanConfig } from '../shared/billing/plans';
import { ProfessionalDisclaimer, StatusChip } from './opsDesignSystem';

const COMPLIANCE_DISCLAIMER =
  'BondSBA provides workflow infrastructure, operational analysis, and readiness support tools for finance and surety professionals. Outputs require professional review and do not replace underwriting, lending, accounting, legal, or surety decisions.';

function formatUsd(value) {
  if (value == null) return 'Custom';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
}

async function authFetch(path, options = {}) {
  const token = await getAuthToken().catch(() => null);
  const headers = {
    ...(options.headers || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  return fetch(path, { ...options, headers });
}

const FREE_FEATURES_BONDSBA = [
  'Manual readiness check — run, not save',
  'Manual WIP review — run, not save',
  '3 saved outputs to try the full result',
  'Critical gaps list (preview)',
  'No history, no exports',
];

const PRO_FEATURES_BONDSBA = [
  'Ad-free experience',
  'Unlimited saved readiness checks',
  'Unlimited WIP review saves',
  'Full readiness + WIP history',
  'Handoff memo builder',
  'CSV/XLSX WIP upload parsing',
  'PDF export on all outputs',
  '20 extraction credits/month',
];

export function UpgradePrompt({
  title = 'Upgrade to continue',
  body = 'Your current plan does not include enough file checks or extraction credits for this action.',
  onViewPricing,
  onManualFallback,
}) {
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
      <p className="text-sm font-semibold text-amber-900">{title}</p>
      <p className="mt-1 text-sm text-amber-800">{body}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onViewPricing}
          className="inline-flex h-10 items-center rounded-[10px] border border-[#0B1F3A] bg-[#0B1F3A] px-3 text-sm font-semibold text-white hover:bg-[#12365F]"
        >
          View Pricing
        </button>
        <button
          type="button"
          onClick={onManualFallback}
          className="inline-flex h-10 items-center rounded-[10px] border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-900 hover:bg-slate-50"
        >
          Enter Manually
        </button>
      </div>
    </div>
  );
}

export function PricingPage({ user, onRequireAuth, nav }) {
  const [interval, setInterval] = useState('monthly');
  const [loadingPlan, setLoadingPlan] = useState('');
  const [error, setError] = useState('');

  const proPlan = PLAN_CATALOG.pro;
  const proPrice = interval === 'yearly' ? Math.round(proPlan.yearlyPrice / 12 * 10) / 10 : proPlan.monthlyPrice;

  const startCheckout = async (planKey) => {
    setError('');
    if (!user) {
      onRequireAuth?.('Sign in to activate your BondSBA Pro plan.');
      return;
    }
    try {
      setLoadingPlan(planKey);
      const token = await getAuthToken().catch(() => null);
      if (!token) {
        setLoadingPlan('');
        onRequireAuth?.('Your session expired. Sign in again.');
        return;
      }
      window.history.pushState({}, '', `/checkout?plan=${encodeURIComponent(planKey)}&interval=${encodeURIComponent(interval)}`);
      window.dispatchEvent(new PopStateEvent('popstate'));
    } finally {
      setLoadingPlan('');
    }
  };

  return (
    <div className="space-y-16 pb-12">
      {/* Hero */}
      <section className="pt-6 pb-2 md:pt-10">
        <div className="max-w-3xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">BondSBA Pricing</p>
          <h1 className="mt-3 text-[40px] font-semibold tracking-[-0.03em] leading-[1.05] text-slate-900 md:text-[52px]">
            Priced for producers. Backed by research.
          </h1>
          <p className="mt-5 max-w-2xl text-[17px] leading-[1.55] text-slate-600">
            Use every tool free. Pay $15/month when you're ready to save, export, and keep your work.
          </p>
        </div>

        {/* Billing toggle */}
        <div className="mt-8 inline-flex items-center rounded-md border border-slate-200 bg-slate-50 p-1">
          <button
            onClick={() => setInterval('monthly')}
            className={`inline-flex h-9 items-center rounded px-4 text-[13px] font-semibold transition-colors ${interval === 'monthly' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
          >
            Monthly
          </button>
          <button
            onClick={() => setInterval('yearly')}
            className={`inline-flex h-9 items-center gap-2 rounded px-4 text-[13px] font-semibold transition-colors ${interval === 'yearly' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
          >
            Annual
            <span className={`inline-flex items-center rounded-sm px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${interval === 'yearly' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'}`}>
              2 months free
            </span>
          </button>
        </div>
      </section>

      {error && (
        <div className="inline-flex items-start gap-2 rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          <AlertCircle className="mt-0.5 h-4 w-4" />
          <span>{error}</span>
        </div>
      )}

      {/* Free vs Pro two-panel */}
      <section className="grid gap-5 md:grid-cols-2 max-w-3xl">
        {/* Free */}
        <article className="flex flex-col rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-[15px] font-semibold tracking-[-0.01em] text-slate-900">Free</p>
          <p className="mt-1 text-[13px] text-slate-500">Use the tools — no account needed</p>
          <div className="mt-5">
            <p className="text-[40px] font-semibold tracking-[-0.03em] text-slate-900 leading-none">
              $0
              <span className="ml-1 text-[14px] font-medium text-slate-500">/mo</span>
            </p>
            <p className="mt-1 text-[13px] text-slate-500">Always free</p>
          </div>
          <div className="mt-5 inline-flex h-10 w-full items-center justify-center rounded-md border border-slate-200 bg-slate-50 px-4 text-[13px] font-semibold text-slate-500 select-none">
            Current plan
          </div>
          <div className="mt-6 border-t border-slate-100 pt-5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">What's included</p>
            <ul className="mt-3 space-y-2 text-[13px] text-slate-700">
              {FREE_FEATURES_BONDSBA.map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          </div>
        </article>

        {/* Pro */}
        <article className="flex flex-col rounded-xl border border-slate-900 bg-white p-6 shadow-[0_18px_38px_-12px_rgba(15,23,42,0.18)]">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[15px] font-semibold tracking-[-0.01em] text-slate-900">Pro</p>
            <span className="inline-flex items-center rounded-md bg-slate-900 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white">
              Most Popular
            </span>
          </div>
          <p className="mt-1 text-[13px] text-slate-500">Unlimited saves, exports, and history</p>
          <div className="mt-5">
            <p className="text-[40px] font-semibold tracking-[-0.03em] text-slate-900 leading-none">
              ${proPrice}
              <span className="ml-1 text-[14px] font-medium text-slate-500">/mo</span>
            </p>
            <p className="mt-1 text-[13px] text-slate-500">
              {interval === 'yearly' ? `$${proPlan.yearlyPrice}/yr billed annually · 2 months free` : 'Billed monthly · Cancel anytime'}
            </p>
          </div>
          <button
            onClick={() => startCheckout('pro')}
            disabled={loadingPlan === 'pro'}
            className="mt-5 inline-flex h-10 w-full items-center justify-center rounded-md border border-[#0B1F3A] bg-[#0B1F3A] px-4 text-[13px] font-semibold text-white hover:bg-[#12365F] disabled:opacity-60 transition-colors"
          >
            {loadingPlan === 'pro' ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Opening checkout…</>
            ) : (
              'Get Pro — less than a coffee'
            )}
          </button>
          <div className="mt-6 border-t border-slate-100 pt-5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Everything in Free, plus</p>
            <ul className="mt-3 space-y-2 text-[13px] text-slate-700">
              {PRO_FEATURES_BONDSBA.map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          </div>
        </article>
      </section>

      {/* Facts strip */}
      <section className="grid gap-px overflow-hidden rounded-xl border border-slate-200 bg-slate-200 md:grid-cols-3 max-w-3xl">
        {[
          ['No card to start', 'Run every tool free. Pay only when you need to save your work.'],
          ['Cancel anytime', 'Monthly or annual. Cancel in seconds through the billing portal.'],
          ['Manual entry always free', 'Run unlimited manual readiness and WIP checks at no cost, forever.'],
        ].map(([title, copy]) => (
          <div key={title} className="bg-white p-5">
            <p className="text-[14px] font-semibold text-slate-900">{title}</p>
            <p className="mt-1.5 text-[13px] text-slate-500">{copy}</p>
          </div>
        ))}
      </section>

      {/* FAQ */}
      <section className="max-w-2xl">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Frequently asked</p>
        <h2 className="mt-2 text-[28px] font-semibold tracking-[-0.02em] text-slate-900">Pricing questions</h2>
        <dl className="mt-6 divide-y divide-slate-200 border-t border-b border-slate-200">
          {[
            ['Does BondSBA replace underwriting?', 'No. BondSBA supports file preparation and professional review workflows. Final decisions sit with the underwriter, lender, or surety.'],
            ['What is the difference between free and Pro?', 'Free lets you run every tool and see real results. Pro adds saves, exports, and history. The paywall hits at the save moment, not the analysis moment.'],
            ['What counts as an extraction credit?', 'One uploaded page processed for field extraction. Manual entry never consumes credits.'],
            ['Can I cancel?', 'Yes — cancel anytime through the billing portal. You keep Pro access through the end of your paid period.'],
          ].map(([q, a]) => (
            <div key={q} className="py-5">
              <dt className="text-[15px] font-semibold text-slate-900">{q}</dt>
              <dd className="mt-1.5 text-[14px] leading-relaxed text-slate-600">{a}</dd>
            </div>
          ))}
        </dl>
      </section>

      <ProfessionalDisclaimer>{COMPLIANCE_DISCLAIMER}</ProfessionalDisclaimer>
    </div>
  );
}

export function ClearPathPricingPage({ user, onRequireAuth, nav }) {
  const [interval, setInterval] = useState('monthly');
  const [loadingPlan, setLoadingPlan] = useState('');
  const [error, setError] = useState('');

  const proPlan = SBA_PLAN_CATALOG.cp_pro;
  const proMonthly = proPlan.monthlyPrice;
  const proYearlyPerMonth = Math.round((proPlan.yearlyPrice / 12) * 10) / 10;
  const proPrice = interval === 'yearly' ? proYearlyPerMonth : proMonthly;

  const handleCheckout = async () => {
    setError('');
    if (!user) {
      onRequireAuth?.('Sign in to activate ClearPath Pro.');
      return;
    }
    try {
      setLoadingPlan('cp_pro');
      const token = await getAuthToken().catch(() => null);
      if (!token) {
        setLoadingPlan('');
        onRequireAuth?.('Your session expired. Sign in again.');
        return;
      }
      const response = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ plan: 'cp_pro', interval }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const msg = typeof payload.error === 'string' ? payload.error : 'Could not start checkout. Try again or contact support.';
        throw new Error(msg);
      }
      const url = payload.url || payload.checkoutUrl;
      if (url) { window.location.href = url; return; }
      throw new Error('Checkout session did not return a redirect URL.');
    } catch (e) {
      setError(e.message || 'Could not start checkout. Please try again.');
    } finally {
      setLoadingPlan('');
    }
  };

  return (
    <div className="space-y-14 pb-12">
      {/* Hero */}
      <section className="pt-6 pb-2 md:pt-10">
        <div className="max-w-3xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">ClearPath Pricing</p>
          <h1 className="mt-3 text-[36px] font-bold tracking-[-0.03em] leading-[1.05] text-slate-900 md:text-[48px]">
            The only SBA prep tool with the correct FY2026 guaranty fee schedule.
          </h1>
          <p className="mt-4 max-w-2xl text-[16px] leading-[1.6] text-slate-600">
            Run every screener and calculator free. Pay $15/month when you're ready to save results and keep your deal history.
          </p>
        </div>

        {/* Billing toggle */}
        <div className="mt-8 inline-flex items-center rounded-md border border-slate-200 bg-slate-50 p-1">
          <button
            onClick={() => setInterval('monthly')}
            className={`inline-flex h-9 items-center rounded px-4 text-[13px] font-semibold transition-colors ${interval === 'monthly' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
          >Monthly</button>
          <button
            onClick={() => setInterval('yearly')}
            className={`inline-flex h-9 items-center gap-2 rounded px-4 text-[13px] font-semibold transition-colors ${interval === 'yearly' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
          >
            Annual
            <span className={`inline-flex items-center rounded-sm px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${interval === 'yearly' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'}`}>
              2 months free
            </span>
          </button>
        </div>
      </section>

      {error && (
        <div className="inline-flex items-start gap-2 rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Free vs Pro two-panel */}
      <section className="grid gap-5 md:grid-cols-2 max-w-3xl">
        {/* Free */}
        <article className="flex flex-col rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-[13px] font-bold uppercase tracking-[0.1em] text-slate-500">Free</p>
          <div className="mt-3 flex items-end gap-1">
            <span className="text-[42px] font-bold leading-none tracking-[-0.03em] text-slate-900">$0</span>
            <span className="mb-1.5 text-[14px] text-slate-500">/mo</span>
          </div>
          <p className="mt-2 text-[13px] text-slate-600">Run the screeners — no account needed</p>
          <div className="mt-6 inline-flex h-10 w-full items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-[13px] font-semibold text-slate-500 select-none">
            No signup required
          </div>
          <ul className="mt-6 space-y-2">
            {[
              'Unlimited eligibility screener runs',
              'SBA 7(a) fee calculator (FY2026)',
              'SBA 504 two-tranche calculator',
              'Program comparison (7a vs 504 vs Express)',
              'Results not saved between sessions',
            ].map((f) => (
              <li key={f} className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                <span className="text-[13px] text-slate-700">{f}</span>
              </li>
            ))}
          </ul>
        </article>

        {/* Pro */}
        <article className="relative flex flex-col rounded-xl border border-emerald-400 bg-emerald-50/40 p-6 shadow-md">
          <div className="absolute -top-3 left-1/2 -translate-x-1/2">
            <span className="inline-flex items-center rounded-full bg-emerald-600 px-3 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white">
              Pro
            </span>
          </div>
          <p className="text-[13px] font-bold uppercase tracking-[0.1em] text-slate-500">Pro</p>
          <div className="mt-3 flex items-end gap-1">
            <span className="text-[42px] font-bold leading-none tracking-[-0.03em] text-slate-900">${proPrice}</span>
            <span className="mb-1.5 text-[14px] text-slate-500">/mo</span>
          </div>
          {interval === 'yearly' ? (
            <p className="mt-1 text-[12px] text-emerald-700 font-medium">${proPlan.yearlyPrice}/yr · 2 months free</p>
          ) : (
            <p className="mt-1 text-[12px] text-slate-500">Billed monthly · Cancel anytime</p>
          )}
          <p className="mt-2 text-[13px] text-slate-600">{proPlan.bestFor}</p>
          <button
            onClick={handleCheckout}
            disabled={loadingPlan === 'cp_pro'}
            className="cursor-pointer mt-6 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 text-[13px] font-semibold text-white hover:bg-emerald-700 transition-colors disabled:opacity-60"
          >
            {loadingPlan === 'cp_pro' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Get Pro — less than a coffee'}
          </button>
          <ul className="mt-6 space-y-2">
            {proPlan.features.map((f) => (
              <li key={f} className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                <span className="text-[13px] text-slate-700">{f}</span>
              </li>
            ))}
          </ul>
        </article>
      </section>

      {/* Cross-link to BondSBA */}
      <section className="rounded-2xl border border-[#0B1F3A]/15 bg-[#0B1F3A]/[0.03] px-7 py-6 max-w-3xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[13px] font-semibold text-slate-900">Also need contractor bond tools?</p>
            <p className="mt-0.5 text-[12px] text-slate-500">BondSBA handles WIP review, surety file prep, and carrier readiness for bond submissions.</p>
          </div>
          <a
            href="https://bondsba.com/pricing"
            className="cursor-pointer inline-flex h-9 shrink-0 items-center gap-2 rounded-lg border border-[#0B1F3A]/30 bg-[#0B1F3A] px-4 text-[13px] font-semibold text-white transition-colors hover:bg-[#12365F] sm:w-auto w-full justify-center"
          >
            BondSBA Pricing
          </a>
        </div>
      </section>

      <p className="text-[11px] text-slate-400 max-w-2xl">
        ClearPath tools are decision-support aids — not legal or lending determinations. Methodology shown at every step. Powered by BondSBA.
      </p>
    </div>
  );
}


function UsageMeter({ label, used = 0, limit = 0 }) {
  const safeLimit = limit || 0;
  const percent = safeLimit > 0 ? Math.min(100, Math.round((used / safeLimit) * 100)) : 0;

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-900">
        {used}
        <span className="text-slate-500"> / {limit == null ? 'Custom' : safeLimit}</span>
      </p>
      <div className="mt-2 h-2 rounded-full bg-slate-200">
        <div
          className={`h-2 rounded-full ${percent > 90 ? 'bg-red-500' : percent > 70 ? 'bg-amber-500' : 'bg-blue-600'}`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </article>
  );
}

export function BillingSettingsPage({ nav }) {
  const [loading, setLoading] = useState(true);
  const [portalLoading, setPortalLoading] = useState(false);
  const [error, setError] = useState('');
  const [payload, setPayload] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const response = await authFetch('/api/stripe/entitlement');
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || 'Could not load billing settings.');
        }
        if (!cancelled) setPayload(data);
      } catch (loadError) {
        if (!cancelled) setError(loadError.message || 'Could not load billing settings.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const openPortal = async () => {
    setPortalLoading(true);
    setError('');
    try {
      const response = await authFetch('/api/stripe/create-portal-session', { method: 'POST' });
      const data = await response.json();
      if (!response.ok) {
        const errMessage = typeof data.error === 'string'
          ? data.error
          : data.error?.message || data.error?.details || 'We could not open billing settings. Please try again.';
        throw new Error(errMessage);
      }
      const portalUrl = data.url || data.portalUrl;
      if (!portalUrl) throw new Error('Billing portal did not return a redirect URL.');
      window.location.href = portalUrl;
    } catch (portalError) {
      setError(portalError.message || 'We could not open billing settings. Please try again.');
    } finally {
      setPortalLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="inline-flex items-center gap-2 text-sm text-slate-700">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading billing settings…
        </div>
      </div>
    );
  }

  const entitlement = payload?.entitlement;
  const subscription = payload?.subscription;

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-[30px] font-bold tracking-[-0.03em] text-slate-900">Billing Settings</h1>
        <p className="mt-1 text-sm text-slate-600">Monitor plan status, usage, and renewal details.</p>
      </section>

      {error && (
        <div className="inline-flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <AlertCircle className="mt-0.5 h-4 w-4" />
          <span>{error}</span>
        </div>
      )}

      <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Current plan</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">
            {entitlement?.plan ? entitlement.plan.charAt(0).toUpperCase() + entitlement.plan.slice(1) : 'No active plan'}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <StatusChip
              label={subscription?.status || entitlement?.status || 'inactive'}
              variant={entitlement?.active ? 'ready' : 'review'}
            />
            {subscription?.interval && <StatusChip label={subscription.interval} variant="neutral" />}
          </div>
          <p className="mt-3 text-sm text-slate-600">
            Current period end: {subscription?.currentPeriodEnd ? new Date(subscription.currentPeriodEnd).toLocaleDateString() : 'N/A'}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              onClick={openPortal}
              disabled={portalLoading}
              className="inline-flex h-11 items-center rounded-[10px] border border-[#0B1F3A] bg-[#0B1F3A] px-4 text-sm font-semibold text-white hover:bg-[#12365F] disabled:opacity-60"
            >
              {portalLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Opening billing portal…
                </>
              ) : (
                'Manage Billing'
              )}
            </button>
            <button
              onClick={() => nav('pricing')}
              className="inline-flex h-11 items-center rounded-[10px] border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-900 hover:bg-slate-50"
            >
              Choose Plan
            </button>
          </div>
        </article>

        <div className="grid gap-3">
          <UsageMeter
            label="File checks used"
            used={entitlement?.fileChecksUsed || 0}
            limit={entitlement?.fileChecksLimit ?? null}
          />
          <UsageMeter
            label="Extraction credits used"
            used={entitlement?.extractionCreditsUsed || 0}
            limit={entitlement?.extractionCreditsLimit ?? null}
          />
          <UsageMeter
            label="Users"
            used={1}
            limit={entitlement?.usersLimit ?? 1}
          />
        </div>
      </section>

      <ProfessionalDisclaimer>{COMPLIANCE_DISCLAIMER}</ProfessionalDisclaimer>
    </div>
  );
}

export function BillingSuccessPage({ nav }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [status, setStatus] = useState(null);
  const [reveal, setReveal] = useState(false);

  useEffect(() => {
    // Trigger checkmark animation after first paint
    const t = setTimeout(() => setReveal(true), 80);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    let cancelled = false;
    // Embedded Payment Element returns setup_intent + setup_intent_client_secret
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get('session_id');
    const setupIntentId = params.get('setup_intent');

    // If user arrived from embedded Payment Element flow, no session to poll.
    // The webhook handles activation; we just show success after a beat.
    if (!sessionId && setupIntentId) {
      setTimeout(() => {
        if (!cancelled) {
          setStatus({ entitlement: { active: true, plan: params.get('plan') || 'professional' } });
          setLoading(false);
        }
      }, 1200);
      return () => { cancelled = true; };
    }

    if (!sessionId) {
      // No session and no setup intent — assume trial activated via embedded flow
      setTimeout(() => {
        if (!cancelled) {
          setStatus({ entitlement: { active: true, plan: 'professional' } });
          setLoading(false);
        }
      }, 1000);
      return () => { cancelled = true; };
    }

    const poll = async () => {
      let attempts = 0;
      while (attempts < 8 && !cancelled) {
        attempts += 1;
        try {
          const response = await authFetch(`/api/stripe/session-status?session_id=${encodeURIComponent(sessionId)}`);
          const data = await response.json();
          if (response.ok) {
            setStatus(data);
            if (data?.entitlement?.active) break;
          }
        } catch {
          // Continue polling.
        }
        await new Promise((resolve) => setTimeout(resolve, 2500));
      }
      if (!cancelled) setLoading(false);
    };

    poll();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 md:py-20">
      <section className="rounded-2xl border border-slate-200 bg-white p-8 md:p-12 shadow-[0_24px_60px_-20px_rgba(15,23,42,0.18)] text-center">
        {/* Animated checkmark — pure SVG stroke-dash */}
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-50 ring-4 ring-emerald-100">
          <svg viewBox="0 0 52 52" className="h-12 w-12">
            <circle cx="26" cy="26" r="24" fill="none" stroke="#10b981" strokeWidth="2"
              strokeDasharray="151" strokeDashoffset={reveal ? 0 : 151}
              style={{ transition: 'stroke-dashoffset 600ms cubic-bezier(0.16, 1, 0.3, 1)' }} />
            <path d="M14 27 l8 8 l16 -16" fill="none" stroke="#10b981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
              strokeDasharray="50" strokeDashoffset={reveal ? 0 : 50}
              style={{ transition: 'stroke-dashoffset 500ms cubic-bezier(0.16, 1, 0.3, 1) 350ms' }} />
          </svg>
        </div>

        <h1 className="text-[28px] font-semibold tracking-[-0.02em] text-slate-900 md:text-[32px]">You're in.</h1>
        <p className="mt-3 text-[15px] text-slate-600">
          Your 14-day BondSBA trial has started. We've saved your card — no charge until day 14.
        </p>

        {loading ? (
          <div className="mt-6 inline-flex items-center gap-2 text-[13px] text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Activating workspace…
          </div>
        ) : status?.entitlement?.active ? (
          <div className="mt-6 inline-flex items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1 text-[12px] font-semibold uppercase tracking-wider text-emerald-800">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Plan active: {status.entitlement.plan}
          </div>
        ) : error ? (
          <div className="mt-6 inline-flex items-start gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-left text-[13px] text-rose-800">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </div>
        ) : null}

        <div className="mt-8 grid gap-2 text-[13px] text-slate-600 text-left max-w-md mx-auto">
          <div className="flex items-start gap-2.5">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
            <span><span className="font-semibold text-slate-900">Day 11</span> — we'll email a reminder 3 days before charge</span>
          </div>
          <div className="flex items-start gap-2.5">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
            <span><span className="font-semibold text-slate-900">Day 14</span> — first charge to the card on file</span>
          </div>
          <div className="flex items-start gap-2.5">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
            <span><span className="font-semibold text-slate-900">Cancel anytime</span> — no charge if cancelled before day 14</span>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={() => nav('opsQueue')}
            className="inline-flex h-11 items-center rounded-[10px] border border-[#0B1F3A] bg-[#0B1F3A] px-4 text-sm font-semibold text-white hover:bg-[#12365F]"
          >
            Open Workspace
          </button>
          <button
            onClick={() => nav('billingSettings')}
            className="inline-flex h-11 items-center rounded-[10px] border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-900 hover:bg-slate-50"
          >
            Billing Settings
          </button>
        </div>
      </section>
      <ProfessionalDisclaimer>{COMPLIANCE_DISCLAIMER}</ProfessionalDisclaimer>
    </div>
  );
}
