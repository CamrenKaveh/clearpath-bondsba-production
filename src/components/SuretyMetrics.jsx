/**
 * Surety-specific underwriting metrics.
 * Aggregate Work Program utilization, single-job concentration, working-capital
 * adequacy, and rough carrier appetite match. All computed client-side from
 * file-prep state — no API call.
 */
import React from 'react';

const toNum = (v) => Number(String(v).replace(/[$,]/g, '')) || 0;
const usd = (v) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v);

// Rough US-market carrier appetite profile (illustrative — informational only).
const CARRIER_PROFILES = [
  { name: 'ICW Group',        sweetBondLow: 250000,  sweetBondHigh: 5_000_000,   wcRatioMin: 0.05, notes: 'Emerging/mid-sized contractors; faster turnaround.' },
  { name: 'Merchants Bonding',sweetBondLow: 100000,  sweetBondHigh: 3_000_000,   wcRatioMin: 0.05, notes: 'Small-to-mid GC and trade contractors.' },
  { name: 'CNA Surety',       sweetBondLow: 500000,  sweetBondHigh: 15_000_000,  wcRatioMin: 0.08, notes: 'Diversified mid-market; broad appetite.' },
  { name: 'Travelers',        sweetBondLow: 5_000_000, sweetBondHigh: 75_000_000, wcRatioMin: 0.10, notes: 'Established contractors $5M+ aggregate.' },
  { name: 'Liberty Mutual',   sweetBondLow: 2_000_000, sweetBondHigh: 50_000_000, wcRatioMin: 0.10, notes: 'Strong financials, complex programs.' },
  { name: 'Old Republic',     sweetBondLow: 1_000_000, sweetBondHigh: 25_000_000, wcRatioMin: 0.08, notes: 'Specialty trades, niche markets.' },
  { name: 'Zurich',           sweetBondLow: 2_000_000, sweetBondHigh: 100_000_000,wcRatioMin: 0.10, notes: 'Large complex and international.' },
  { name: 'AmTrust',          sweetBondLow: 100000,  sweetBondHigh: 2_500_000,   wcRatioMin: 0.05, notes: 'Smaller programs, license bonds.' },
  { name: 'Chubb',            sweetBondLow: 3_000_000, sweetBondHigh: 50_000_000, wcRatioMin: 0.10, notes: 'Established mid-to-large contractors.' },
];

function classify(pct, lowAt, midAt) {
  if (pct == null || !isFinite(pct)) return 'neutral';
  if (pct >= midAt) return 'critical';
  if (pct >= lowAt) return 'review';
  return 'ready';
}

function Bar({ pct, tone }) {
  const pctSafe = Math.max(0, Math.min(100, Math.round(pct || 0)));
  const color = tone === 'critical' ? 'bg-rose-500' : tone === 'review' ? 'bg-amber-500' : tone === 'ready' ? 'bg-emerald-500' : 'bg-slate-300';
  return (
    <div className="h-1.5 w-full rounded-full bg-slate-100">
      <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${pctSafe}%` }} />
    </div>
  );
}

function Metric({ label, value, sub, tone, footer }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-1 text-[26px] font-semibold tabular-nums tracking-[-0.02em] text-slate-900">{value}</p>
      {sub && <p className="text-[12px] text-slate-500">{sub}</p>}
      {footer != null && <div className="mt-3"><Bar pct={footer.pct} tone={tone} /><p className="mt-1 text-[11px] text-slate-500">{footer.label}</p></div>}
    </div>
  );
}

export function SuretyMetricsPanel({ state, className = '' }) {
  const awp = toNum(state.aggregateWP);
  const backlog = toNum(state.totalBacklog);
  const requested = toNum(state.requestedAmount);
  const largestJob = toNum(state.largestJobAmount);
  const wc = toNum(state.workingCapital);
  const equity = toNum(state.equity);

  // 1. Aggregate WP utilization
  const utilizationPct = awp > 0 ? ((backlog + requested) / awp) * 100 : null;
  const utilizationTone = classify(utilizationPct, 70, 90);
  const remaining = awp > 0 ? awp - backlog - requested : null;

  // 2. Single-job concentration vs equity (typical 25% threshold)
  const singleJobEquityPct = equity > 0 && largestJob > 0 ? (largestJob / equity) * 100 : null;
  const singleJobTone = classify(singleJobEquityPct, 20, 30);

  // 3. Working capital / aggregate WP (target ≥ 5%)
  const wcRatio = awp > 0 && wc > 0 ? (wc / awp) * 100 : null;
  const wcTone = wcRatio == null ? 'neutral' : wcRatio >= 10 ? 'ready' : wcRatio >= 5 ? 'review' : 'critical';

  // 4. Carrier appetite shortlist
  const carrierFit = requested > 0
    ? CARRIER_PROFILES.map((c) => {
        const inSweet = requested >= c.sweetBondLow && requested <= c.sweetBondHigh;
        const wcOk = wcRatio == null ? null : (wcRatio / 100) >= c.wcRatioMin;
        const score = (inSweet ? 1 : 0) + (wcOk === true ? 1 : 0);
        return { ...c, inSweet, wcOk, score };
      }).sort((a, b) => b.score - a.score)
    : [];

  const hasAnyData = awp || backlog || requested || largestJob || wc || equity;

  if (!hasAnyData) {
    return (
      <div className={`rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-center ${className}`}>
        <p className="text-[13px] text-slate-600">Enter aggregate work program, backlog, and requested bond to surface surety underwriting metrics.</p>
      </div>
    );
  }

  return (
    <section className={`space-y-4 ${className}`}>
      <div className="flex items-baseline justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Surety underwriting metrics</p>
        <p className="text-[11px] text-slate-400">Informational · check with your carrier</p>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Metric
          label="Aggregate WP utilization"
          value={utilizationPct != null ? `${utilizationPct.toFixed(0)}%` : '—'}
          sub={awp > 0 ? `${usd(backlog + requested)} of ${usd(awp)}` : 'Enter aggregate WP + backlog'}
          tone={utilizationTone}
          footer={utilizationPct != null ? { pct: utilizationPct, label: remaining != null ? `${usd(Math.max(0, remaining))} room remaining` : '' } : null}
        />
        <Metric
          label="Single-job vs equity"
          value={singleJobEquityPct != null ? `${singleJobEquityPct.toFixed(0)}%` : '—'}
          sub={equity > 0 && largestJob > 0 ? `${usd(largestJob)} on ${usd(equity)} equity` : 'Enter largest job + equity'}
          tone={singleJobTone}
          footer={singleJobEquityPct != null ? { pct: singleJobEquityPct, label: singleJobEquityPct > 25 ? 'Above typical 25% comfort threshold' : 'Within typical comfort range' } : null}
        />
        <Metric
          label="Working capital / aggregate WP"
          value={wcRatio != null ? `${wcRatio.toFixed(1)}%` : '—'}
          sub={awp > 0 && wc > 0 ? `${usd(wc)} WC on ${usd(awp)} program` : 'Enter working capital + AWP'}
          tone={wcTone}
          footer={wcRatio != null ? { pct: Math.min(100, wcRatio * 4), label: wcRatio < 5 ? 'Below 5% — request CPA support' : wcRatio < 10 ? 'Marginal — 5-10%' : 'Adequate — ≥10%' } : null}
        />
      </div>

      {state.cpaLetterType && state.cpaLetterType !== 'unknown' && requested > 0 && (
        (() => {
          const need = requested >= 5_000_000 ? 'audit' : requested >= 1_000_000 ? 'review' : 'compilation';
          const haveRank = { compilation: 1, review: 2, audit: 3 }[state.cpaLetterType] || 0;
          const needRank = { compilation: 1, review: 2, audit: 3 }[need] || 0;
          const ok = haveRank >= needRank;
          return (
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">CPA letter check</p>
                <span className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${ok ? 'border-slate-200 bg-slate-50 text-slate-700' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${ok ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                  {ok ? 'Meets' : 'Shortfall'}
                </span>
              </div>
              <p className="mt-2 text-[13px] text-slate-700">
                {ok
                  ? `${state.cpaLetterType[0].toUpperCase() + state.cpaLetterType.slice(1)}-level financials meet typical carrier expectation for ${usd(requested)} bond.`
                  : `${usd(requested)} bond typically requires ${need}-level financials. Current: ${state.cpaLetterType}.`}
              </p>
            </div>
          );
        })()
      )}

      {carrierFit.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-4 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Carrier appetite match · {usd(requested)} bond</p>
          </div>
          <div className="divide-y divide-slate-100">
            {carrierFit.slice(0, 6).map((c) => (
              <div key={c.name} className="flex items-start gap-3 px-4 py-2.5">
                <div className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${c.score === 2 ? 'bg-slate-900' : c.score === 1 ? 'bg-slate-500' : 'bg-slate-300'}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-[13px] font-semibold text-slate-900">{c.name}</p>
                    <p className="text-[11px] text-slate-500">{usd(c.sweetBondLow)}–{usd(c.sweetBondHigh)} sweet spot</p>
                  </div>
                  <p className="mt-0.5 text-[12px] text-slate-500">
                    {c.inSweet ? '✓ bond size in sweet spot' : '· bond size outside typical sweet spot'} ·{' '}
                    {c.wcOk === true ? '✓ WC ratio OK' : c.wcOk === false ? '· WC below carrier minimum' : '· WC unknown'}
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-400">{c.notes}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="border-t border-slate-100 px-4 py-2 text-[11px] text-slate-400">
            Profiles based on public market positioning. Not a placement guarantee. Always confirm appetite with your carrier rep.
          </div>
        </div>
      )}
    </section>
  );
}
