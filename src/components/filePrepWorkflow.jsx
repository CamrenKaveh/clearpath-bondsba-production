import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Keyboard, Link2, Loader2, Upload, AlertTriangle } from 'lucide-react';
import { ProfessionalDisclaimer, ScoreCard, StatusChip } from './opsDesignSystem';
import { getAuthToken } from '../shared/utils/supabaseClient';

export const DOCUMENT_DEFINITIONS = [
  { key: 'currentWipSchedule', label: 'Current WIP schedule', deduction: 20, action: 'Request current WIP schedule.' },
  { key: 'interimFinancials', label: 'Interim financials', deduction: 15, action: 'Request updated interim financials.' },
  { key: 'priorYearTaxReturns', label: 'Prior year tax returns', deduction: 10, action: 'Request prior year tax returns.' },
  { key: 'debtSchedule', label: 'Debt schedule', deduction: 8, action: 'Request updated debt schedule.' },
  { key: 'ownershipInfo', label: 'Ownership / guarantor info', deduction: 10, action: 'Confirm guarantor ownership details.' },
  { key: 'bondRequestDetails', label: 'Bond request details', deduction: 8, action: 'Add bond request scope details.' },
  { key: 'bankStatements', label: 'Bank statements', deduction: 6, action: 'Request latest bank statements.' },
];

const DEFAULT_DOCUMENTS = Object.fromEntries(DOCUMENT_DEFINITIONS.map((item) => [item.key, false]));

export const DEFAULT_FILE_PREP_STATE = {
  inputMethod: 'manual',
  contractorName: '',
  tradeType: 'Heavy civil',
  filePurpose: '',
  requestedAmount: '',
  documents: { ...DEFAULT_DOCUMENTS },
  wipStatus: 'missing',
  financialsStatus: 'missing',
  activeJobs: '',
  largestJobPercent: '',
  marginFade: 'no',
  underbillings: 'no',
  overbillings: 'no',
  costToComplete: 'partial',
  // Surety underwriting fields
  aggregateWP: '',          // carrier-set aggregate work program limit ($)
  totalBacklog: '',         // sum of remaining uncompleted contracts ($)
  largestJobAmount: '',     // single-job amount ($)
  workingCapital: '',       // current assets - current liabilities ($)
  equity: '',
  revenue: '',
  totalAssets: '',
  totalLiabilities: '',
  cpaLetterType: 'unknown', // unknown | compilation | review | audit
};

const SAMPLE_FILE_STATE = {
  ...DEFAULT_FILE_PREP_STATE,
  contractorName: 'Northline Civil LLC',
  filePurpose: 'Surety bonding',
  wipStatus: 'received',
  financialsStatus: 'missing',
  costToComplete: 'partial',
  marginFade: 'yes',
  underbillings: 'yes',
};

const INPUT_METHODS = [
  { id: 'upload', label: 'Upload file', icon: Upload },
  { id: 'connect', label: 'Connect system', icon: Link2 },
  { id: 'manual', label: 'Enter manually', icon: Keyboard },
];

const RISK_OPTIONS = [
  { value: 'no', label: 'No' },
  { value: 'unsure', label: 'Unsure' },
  { value: 'yes', label: 'Yes' },
];

const CTC_OPTIONS = [
  { value: 'yes', label: 'Yes' },
  { value: 'partial', label: 'Partial' },
  { value: 'no', label: 'No' },
];

function toNumber(value) {
  const parsed = Number(String(value || '').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function toTitle(value) {
  if (!value) return '';
  return `${value}`.slice(0, 1).toUpperCase() + `${value}`.slice(1);
}

function readinessStatus(score) {
  if (score >= 85) return { label: 'Ready for review', variant: 'ready' };
  if (score >= 70) return { label: 'Needs follow-up', variant: 'review' };
  if (score >= 50) return { label: 'Significant gaps', variant: 'critical' };
  return { label: 'Not ready', variant: 'critical' };
}

function wipStatus(value) {
  switch (value) {
    case 'Incomplete':
      return { label: 'Incomplete', variant: 'critical' };
    case 'Needs review':
      return { label: 'Needs review', variant: 'review' };
    case 'Elevated review':
      return { label: 'Elevated review', variant: 'critical' };
    case 'Concentration review':
      return { label: 'Concentration review', variant: 'review' };
    default:
      return { label: 'Ready for review', variant: 'ready' };
  }
}

export function evaluateFilePrepState(state) {
  let score = 100;
  const criticalGaps = [];
  const nextActions = [];

  // WIP status — 3-way (missing/stale/received), with fallback to document boolean
  const wipStat = state.wipStatus ?? (state.documents?.currentWipSchedule ? 'received' : 'missing');
  if (wipStat === 'missing') {
    score -= 20;
    criticalGaps.push({ item: 'Current WIP schedule', priority: 'Critical', status: 'Missing', nextAction: 'Request current WIP schedule.' });
    nextActions.push('Request current WIP schedule.');
  } else if (wipStat === 'stale') {
    score -= 10;
    criticalGaps.push({ item: 'Current WIP schedule', priority: 'Important', status: 'Stale', nextAction: 'Request updated WIP schedule.' });
    nextActions.push('Request updated WIP schedule.');
  }

  // Financials status — 3-way, with fallback to document boolean
  const finStat = state.financialsStatus ?? (state.documents?.interimFinancials ? 'received' : 'missing');
  if (finStat === 'missing') {
    score -= 15;
    criticalGaps.push({ item: 'Interim financials', priority: 'Critical', status: 'Missing', nextAction: 'Request updated interim financials.' });
    nextActions.push('Request updated interim financials.');
  } else if (finStat === 'stale') {
    score -= 8;
    criticalGaps.push({ item: 'Interim financials', priority: 'Important', status: 'Stale', nextAction: 'Request updated interim financials.' });
    nextActions.push('Request updated interim financials.');
  }

  DOCUMENT_DEFINITIONS.forEach((item) => {
    // Skip WIP and financials — handled above via status fields
    if (item.key === 'currentWipSchedule' || item.key === 'interimFinancials') return;
    if (!state.documents[item.key]) {
      score -= item.deduction;
      criticalGaps.push({
        item: item.label,
        priority: item.deduction >= 10 ? 'Critical' : 'Important',
        status: 'Missing',
        nextAction: item.action,
      });
      nextActions.push(item.action);
    }
  });

  const largestJobPercent = toNumber(state.largestJobPercent);
  if (largestJobPercent > 60) {
    score -= 15;
    criticalGaps.push({
      item: 'Largest job concentration',
      priority: 'Important',
      status: 'Needs review',
      nextAction: 'Review project dependency and capacity exposure.',
    });
    nextActions.push('Review project dependency and capacity exposure.');
  } else if (largestJobPercent > 40) {
    score -= 8;
    criticalGaps.push({
      item: 'Backlog concentration',
      priority: 'Important',
      status: 'Needs review',
      nextAction: 'Review backlog concentration before handoff.',
    });
    nextActions.push('Review backlog concentration before handoff.');
  }

  if (state.costToComplete === 'no') {
    score -= 12;
    criticalGaps.push({
      item: 'Cost-to-complete detail',
      priority: 'Critical',
      status: 'Incomplete',
      nextAction: 'Confirm cost-to-complete assumptions before handoff.',
    });
    nextActions.push('Confirm cost-to-complete assumptions before handoff.');
  } else if (state.costToComplete === 'partial') {
    score -= 6;
    criticalGaps.push({
      item: 'Cost-to-complete detail',
      priority: 'Important',
      status: 'Incomplete',
      nextAction: 'Complete cost-to-complete support by major jobs.',
    });
    nextActions.push('Complete cost-to-complete support by major jobs.');
  }

  if (state.marginFade === 'yes') {
    score -= 8;
    criticalGaps.push({
      item: 'Margin fade indicator',
      priority: 'Important',
      status: 'Needs review',
      nextAction: 'Review updated margin assumptions and gross profit drift.',
    });
    nextActions.push('Review updated margin assumptions and gross profit drift.');
  } else if (state.marginFade === 'unsure') {
    score -= 4;
  }

  if (state.underbillings === 'yes') {
    score -= 8;
    criticalGaps.push({
      item: 'Underbilling stress',
      priority: 'Critical',
      status: 'Needs review',
      nextAction: 'Validate billing timing and cash conversion.',
    });
    nextActions.push('Validate billing timing and cash conversion.');
  } else if (state.underbillings === 'unsure') {
    score -= 4;
  }

  if (state.overbillings === 'yes') {
    score -= 5;
    criticalGaps.push({
      item: 'Overbilling exposure',
      priority: 'Important',
      status: 'Needs review',
      nextAction: 'Verify earned-to-billed alignment by project.',
    });
    nextActions.push('Verify earned-to-billed alignment by project.');
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  const readiness = readinessStatus(score);

  let wipReviewStatus = 'Ready for review';
  let whyFlagged = 'No major WIP review indicators were selected.';
  let reviewNext = 'Confirm the WIP schedule is current before handoff.';

  if (wipStat === 'missing') {
    wipReviewStatus = 'Incomplete';
    whyFlagged = 'Current WIP schedule has not been received.';
    reviewNext = 'Request an updated WIP schedule before handoff.';
  } else if (wipStat === 'stale') {
    wipReviewStatus = 'Needs review';
    whyFlagged = 'WIP schedule is stale — confirm it reflects current job activity.';
    reviewNext = 'Request refreshed WIP schedule before handoff.';
  } else if (state.costToComplete === 'no') {
    wipReviewStatus = 'Needs review';
    whyFlagged = 'Cost-to-complete detail is incomplete.';
    reviewNext = 'Confirm cost-to-complete assumptions before sending the file.';
  } else if (state.marginFade === 'yes' || state.underbillings === 'yes') {
    wipReviewStatus = 'Elevated review';
    whyFlagged = 'Margin fade or underbillings are present across active jobs.';
    reviewNext = 'Review billing timing, cash conversion, and cost-to-complete assumptions.';
  } else if (largestJobPercent > 40) {
    wipReviewStatus = 'Concentration review';
    whyFlagged = 'Largest job represents more than 40% of backlog.';
    reviewNext = 'Review project dependency and capacity exposure.';
  }

  if (!nextActions.length) {
    nextActions.push('Generate handoff memo and mark file ready for review.');
  }

  const lenderHandoff =
    score >= 85 && criticalGaps.filter((gap) => gap.priority === 'Critical').length === 0
      ? 'Ready for review'
      : score >= 70
      ? 'In review'
      : 'Needs follow-up';

  const suretyHandoff =
    wipReviewStatus === 'Ready for review' && score >= 85
      ? 'Ready for review'
      : wipReviewStatus === 'Incomplete' || wipReviewStatus === 'Needs review' || wipReviewStatus === 'Elevated review'
      ? 'Needs WIP update'
      : 'Needs follow-up';

  const fileQuality =
    score >= 85 ? 'Strong file quality' : score >= 70 ? 'Moderate file quality' : 'Requires review';

  return {
    score,
    readiness,
    wipReviewStatus,
    wipReview: wipStatus(wipReviewStatus),
    whyFlagged,
    reviewNext,
    criticalGaps,
    nextActions: Array.from(new Set(nextActions)),
    lenderHandoff,
    suretyHandoff,
    fileQuality,
  };
}

function RangeSlider({ label, value, min, max, step, unit, onChange }) {
  return (
    <label className="block">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[13px] font-medium text-slate-700">{label}</span>
        <span className="text-[13px] font-semibold text-[#0369A1] tabular-nums">{value}{unit}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[11px] text-slate-400 tabular-nums">{min}{unit}</span>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-slate-200 accent-[#0369A1]"
        />
        <span className="text-[11px] text-slate-400 tabular-nums">{max}{unit}</span>
      </div>
    </label>
  );
}

function SegmentedControl({ label, value, options, onChange, colorMap }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-medium text-slate-700">{label}</span>
      <div
        className="rounded-[10px] bg-slate-100 p-[3px]"
        style={{ display: 'grid', gridTemplateColumns: `repeat(${options.length}, 1fr)` }}
      >
        {options.map((option) => {
          const isSelected = option.value === value;
          const semantic = colorMap?.[option.value];
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              className={`h-8 rounded-[8px] text-sm font-medium transition cursor-pointer ${
                isSelected
                  ? semantic
                    ? `${semantic} shadow-[0_1px_2px_rgba(15,23,42,0.08)]`
                    : 'bg-white text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.08)]'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </label>
  );
}

function InputMethodSelector({ value, onChange }) {
  return (
    <div>
      <div className="grid grid-cols-3 rounded-xl border border-slate-200 bg-slate-100 p-1">
        {INPUT_METHODS.map((method) => {
          const Icon = method.icon;
          const active = value === method.id;
          return (
            <button
              key={method.id}
              type="button"
              onClick={() => onChange(method.id)}
              className={`inline-flex h-9 items-center justify-center gap-1 rounded-lg text-sm font-medium ${
                active
                  ? 'bg-white text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.08)] ring-1 ring-slate-200'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{method.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ChecklistRow({ checked, label, onChange }) {
  return (
    <label className="flex min-h-[38px] items-center justify-between gap-3 rounded-[10px] border border-slate-200 bg-white px-2.5 py-2 hover:bg-slate-50">
      <span className="inline-flex items-center gap-2">
        <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-4 w-4 rounded border-slate-300" />
        <span className="text-sm text-slate-700">{label}</span>
      </span>
      <StatusChip label={checked ? 'Received' : 'Missing'} variant={checked ? 'ready' : 'critical'} />
    </label>
  );
}

function IntegrationConnectCard({ name, copy, enabled, onConnect }) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-sm font-semibold text-slate-900">{name}</p>
      <p className="mt-1 text-sm text-slate-600">{copy}</p>
      <button
        type="button"
        onClick={onConnect}
        disabled={!enabled}
        className={`mt-3 inline-flex h-10 items-center rounded-lg border px-3 text-sm font-semibold ${
          enabled
            ? 'border-[#0B1F3A] bg-[#0B1F3A] text-white hover:bg-[#12365F]'
            : 'cursor-not-allowed border-slate-300 bg-slate-100 text-slate-500'
        }`}
      >
        {enabled ? `Connect ${name}` : 'Connect later'}
      </button>
      {!enabled && (
        <p className="mt-2 text-xs text-slate-500">
          Can be connected later. Manual entry works now.
        </p>
      )}
    </article>
  );
}

function ReviewExtractedFields({
  rows,
  onToggle,
  onChangeValue,
  onApply,
  onDiscard,
  loading = false,
}) {
  if (!rows.length) return null;

  return (
    <article className="mt-3 rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-sm font-semibold text-slate-900">Review extracted fields</p>
      <p className="mt-1 text-sm text-slate-600">Confirm the values before they update the readiness check.</p>
      <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full min-w-[620px] border-collapse">
          <thead className="bg-slate-50">
            <tr className="border-b border-slate-200 text-[11px] font-semibold uppercase tracking-[0.04em] text-slate-500">
              <th className="px-3 py-2 text-left">Use</th>
              <th className="px-3 py-2 text-left">Field</th>
              <th className="px-3 py-2 text-left">Extracted value</th>
              <th className="px-3 py-2 text-left">Confidence</th>
              <th className="px-3 py-2 text-left">Source</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 text-sm text-slate-700">
            {rows.map((row) => (
              <tr key={row.key}>
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    checked={row.use}
                    onChange={(event) => onToggle(row.key, event.target.checked)}
                    className="h-4 w-4 rounded border-slate-300"
                    aria-label={`Use extracted field ${row.label}`}
                  />
                </td>
                <td className="px-3 py-2 font-medium text-slate-900">{row.label}</td>
                <td className="px-3 py-2">
                  <input
                    value={row.value}
                    onChange={(event) => onChangeValue(row.key, event.target.value)}
                    className="h-9 w-full rounded-[8px] border border-slate-300 px-2 text-sm text-slate-900"
                  />
                </td>
                <td className="px-3 py-2">{Math.round((row.confidence || 0) * 100)}%</td>
                <td className="px-3 py-2">{row.source || 'n/a'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onApply}
          disabled={loading}
          className="inline-flex h-10 items-center rounded-[10px] border border-[#0B1F3A] bg-[#0B1F3A] px-3 text-sm font-semibold text-white hover:bg-[#12365F] disabled:opacity-60"
        >
          Use Confirmed Fields
        </button>
        <button
          type="button"
          onClick={onDiscard}
          className="inline-flex h-10 items-center rounded-[10px] border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-900 hover:bg-slate-50"
        >
          Discard Extraction
        </button>
      </div>
      <p className="mt-2 text-xs text-slate-500">
        Extraction can reduce typing, but confirmed values should be reviewed by a professional.
      </p>
    </article>
  );
}

export function ReadinessPreview({ state, className = '' }) {
  const analysis = useMemo(() => evaluateFilePrepState(state), [state]);
  const topGaps = analysis.criticalGaps.slice(0, 3);

  return (
    <div className={`border-t border-slate-200 pt-5 ${className}`}>
      <div className="grid gap-3 md:grid-cols-2">
        <ScoreCard
          label="File Readiness"
          value={`${analysis.score}%`}
          statusLabel={analysis.readiness.label}
          statusVariant={analysis.readiness.variant}
          subtext={analysis.fileQuality}
        />
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">WIP Review</p>
          <div className="mt-1">
            <StatusChip label={analysis.wipReview.label} variant={analysis.wipReview.variant} />
          </div>
          <p className="mt-2 text-sm text-slate-700">Why flagged: {analysis.whyFlagged}</p>
          <p className="mt-2 text-sm text-slate-600">Review next: {analysis.reviewNext}</p>
        </article>
      </div>

      <div className="mt-3 rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Critical Gaps</p>
          {topGaps.length > 0 && <StatusChip label={`${topGaps.length} flagged`} variant="critical" />}
        </div>
        {topGaps.length ? (
          <ul className="mt-3 divide-y divide-slate-100">
            {topGaps.map((gap) => (
              <li key={`${gap.item}-${gap.priority}`} className="flex items-start gap-3 py-2 first:pt-0">
                <span className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-rose-500" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-slate-900">{gap.item}</p>
                  <p className="text-xs text-slate-500">Next: {gap.nextAction}</p>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-slate-600">No critical gaps in current input.</p>
        )}
      </div>

      <article className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Next action</p>
        <p className="mt-1 text-sm text-slate-700">{analysis.nextActions[0]}</p>
      </article>

      <ProfessionalDisclaimer className="mt-3">
        Operational review only. Professional judgment required.
      </ProfessionalDisclaimer>
    </div>
  );
}

export function ReadinessOutputPanel({ state }) {
  const analysis = useMemo(() => evaluateFilePrepState(state), [state]);
  const rows = analysis.criticalGaps.slice(0, 8);

  // The single headline number — only this one carries semantic color
  const scoreTone = analysis.readiness.variant === 'ready' ? 'text-emerald-700'
    : analysis.readiness.variant === 'review' ? 'text-amber-700'
    : analysis.readiness.variant === 'critical' ? 'text-rose-700' : 'text-slate-900';

  return (
    <div className="space-y-7">
      {/* Headline score — one big number, neutral chrome */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">File readiness score</p>
            <p className={`mt-2 text-[64px] font-semibold leading-none tabular-nums tracking-[-0.03em] ${scoreTone}`}>{analysis.score}<span className="text-[28px] text-slate-400">%</span></p>
            <p className="mt-2 text-[14px] text-slate-600">{analysis.readiness.label} · {analysis.fileQuality}</p>
          </div>
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-md border border-slate-200 bg-slate-200">
            <div className="bg-white px-4 py-2.5 min-w-[140px]">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Lender</p>
              <p className="mt-0.5 text-[13px] font-semibold text-slate-900">{analysis.lenderHandoff}</p>
            </div>
            <div className="bg-white px-4 py-2.5 min-w-[140px]">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Surety</p>
              <p className="mt-0.5 text-[13px] font-semibold text-slate-900">{analysis.suretyHandoff}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Critical gaps — clean table, color only in left dots */}
      <div>
        <div className="mb-3 flex items-baseline justify-between">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Critical gaps</p>
          {rows.length > 0 && <p className="text-[11px] text-slate-500">{rows.length} item{rows.length !== 1 ? 's' : ''} to resolve</p>}
        </div>
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full min-w-[640px] border-collapse">
            <thead className="bg-slate-50">
              <tr className="border-b border-slate-200 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                <th className="px-4 py-2.5 text-left">Item</th>
                <th className="px-4 py-2.5 text-left">Status</th>
                <th className="px-4 py-2.5 text-left">Next action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-[13px] text-slate-700">
              {(rows.length ? rows : [{ item: 'No critical gaps', priority: 'Info', status: 'Complete', nextAction: 'Generate handoff memo.' }]).map((gap) => {
                const dotColor = gap.status === 'Missing' ? 'bg-rose-500'
                  : gap.status === 'Incomplete' ? 'bg-amber-500'
                  : gap.status === 'Needs review' ? 'bg-slate-400' : 'bg-emerald-500';
                return (
                  <tr key={`${gap.item}-${gap.priority}-${gap.status}`}>
                    <td className="px-4 py-3 align-top">
                      <div className="flex items-start gap-2.5">
                        <span aria-hidden className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${dotColor}`} />
                        <div className="min-w-0">
                          <p className="font-medium text-slate-900">{gap.item}</p>
                          <p className="text-[11px] text-slate-400">{gap.priority}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top text-slate-700">{gap.status}</td>
                    <td className="px-4 py-3 align-top text-slate-500">{gap.nextAction}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Next actions — clean list */}
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 mb-3">Recommended next actions</p>
        <ul className="space-y-2.5 rounded-xl border border-slate-200 bg-white p-5">
          {analysis.nextActions.slice(0, 5).map((action) => (
            <li key={action} className="flex items-start gap-3 text-[14px] text-slate-700">
              <span aria-hidden className="mt-1.5 inline-block h-1 w-3 shrink-0 rounded-sm bg-slate-300" />
              <span>{action}</span>
            </li>
          ))}
        </ul>
      </div>

      <ProfessionalDisclaimer>
        BondSBA provides workflow infrastructure, operational analysis, and readiness support tools for finance and surety professionals. Outputs require professional review and do not replace underwriting, lending, accounting, legal, or surety decisions.
      </ProfessionalDisclaimer>
    </div>
  );
}

const STATUS_OPTIONS = [
  { value: 'missing', label: 'Missing' },
  { value: 'received', label: 'Received' },
  { value: 'stale', label: 'Stale' },
];

const STATUS_COLOR_MAP = {
  missing: 'bg-rose-50 text-rose-700 ring-1 ring-rose-200',
  received: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  stale: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
};

function CheckFileButton({ onRunReadiness }) {
  const [loading, setLoading] = useState(false);
  const handleClick = () => {
    setLoading(true);
    // onRunReadiness is synchronous nav; brief spinner for UX feedback
    setTimeout(() => {
      onRunReadiness();
      setLoading(false);
    }, 300);
  };
  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-[10px] border border-[#0B1F3A] bg-[#0B1F3A] px-4 text-sm font-semibold text-white hover:bg-[#12365F] disabled:opacity-60 disabled:cursor-not-allowed"
    >
      {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Checking…</> : 'Check File'}
    </button>
  );
}

export function ContractorFileInputPanel({
  state,
  onChange,
  onRunReadiness,
  onSkipToWorkspace = null,
  compact = false,
  showPreview = true,
  className = '',
}) {
  const [showDetails, setShowDetails] = useState(false);
  const updateState = (updates) => onChange({ ...state, ...updates });
  const updateField = (key, value) => updateState({ [key]: value });
  const updateDocument = (key, checked) =>
    onChange({ ...state, documents: { ...state.documents, [key]: checked } });
  const loadSample = () => onChange({ ...SAMPLE_FILE_STATE });
  const uploadEnabled = true;
  const fileInputRef = useRef(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [estimate, setEstimate] = useState(null);
  const [extractionRows, setExtractionRows] = useState([]);
  const [uploadWarnings, setUploadWarnings] = useState([]);
  const [uploadError, setUploadError] = useState('');
  const [estimating, setEstimating] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [integrationStatus, setIntegrationStatus] = useState({
    loading: false,
    loaded: false,
    quickbooksEnabled: false,
    procoreEnabled: false,
  });
  const [integrationMessage, setIntegrationMessage] = useState('');

  const extractionProviderConfigured =
    Boolean(estimate?.provider) && estimate.provider !== 'mock';

  useEffect(() => {
    if (state.inputMethod !== 'connect' || integrationStatus.loaded || integrationStatus.loading) return;
    let cancelled = false;
    const checkIntegrations = async () => {
      setIntegrationStatus((current) => ({ ...current, loading: true }));
      try {
        const [qbResponse, procoreResponse] = await Promise.all([
          fetch('/api/integrations/quickbooks/connect'),
          fetch('/api/integrations/procore/connect'),
        ]);
        const [qbPayload, procorePayload] = await Promise.all([
          qbResponse.json().catch(() => ({})),
          procoreResponse.json().catch(() => ({})),
        ]);
        if (cancelled) return;
        setIntegrationStatus({
          loading: false,
          loaded: true,
          quickbooksEnabled: qbPayload?.status === 'ready_for_oauth',
          procoreEnabled: procorePayload?.status === 'ready_for_oauth',
        });
      } catch {
        if (cancelled) return;
        setIntegrationStatus({
          loading: false,
          loaded: true,
          quickbooksEnabled: false,
          procoreEnabled: false,
        });
      }
    };
    checkIntegrations();
    return () => {
      cancelled = true;
    };
  }, [integrationStatus.loaded, integrationStatus.loading, state.inputMethod]);

  const toBase64 = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const raw = `${reader.result || ''}`;
        resolve(raw.split(',')[1] || raw);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const inferDocumentType = (name) => {
    const lower = `${name || ''}`.toLowerCase();
    if (lower.includes('wip')) return 'wip_schedule';
    if (lower.includes('tax')) return 'tax_return';
    if (lower.includes('debt')) return 'debt_schedule';
    if (lower.includes('bank')) return 'bank_statement';
    if (lower.includes('bond')) return 'bond_request';
    if (lower.includes('financial')) return 'financial_statement';
    return 'unknown';
  };

  const runExtractionCall = async (mode) => {
    if (!selectedFile) {
      setUploadError('Select a file before running extraction.');
      return null;
    }

    setUploadError('');
    const base64 = await toBase64(selectedFile);
    const response = await fetch('/api/extract-document', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode,
        documentType: inferDocumentType(selectedFile.name),
        file: {
          name: selectedFile.name,
          type: selectedFile.type,
          content: base64,
        },
      }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.error || payload.details || 'Extraction request failed.');
    }
    return payload;
  };

  const estimateExtraction = async () => {
    try {
      setEstimating(true);
      const payload = await runExtractionCall('estimate');
      if (!payload) return;
      setEstimate(payload);
      setUploadWarnings(payload.warnings || []);
      setExtractionRows([]);
    } catch (error) {
      setUploadError(error.message || 'Could not estimate extraction credits.');
    } finally {
      setEstimating(false);
    }
  };

  const extractFields = async () => {
    try {
      setExtracting(true);
      const payload = await runExtractionCall('extract');
      if (!payload) return;
      setEstimate(payload);
      setUploadWarnings(payload.warnings || []);
      setExtractionRows(
        (payload.fieldsForReview || []).map((row) => ({
          key: row.key,
          label: row.label,
          value: `${row.value ?? ''}`,
          confidence: row.confidence,
          source: row.source,
          use: true,
        }))
      );
    } catch (error) {
      setUploadError(error.message || 'We could not extract reliable fields from this document. You can enter the values manually.');
    } finally {
      setExtracting(false);
    }
  };

  const toggleExtractedRow = (key, checked) => {
    setExtractionRows((rows) => rows.map((row) => (row.key === key ? { ...row, use: checked } : row)));
  };

  const updateExtractedValue = (key, value) => {
    setExtractionRows((rows) => rows.map((row) => (row.key === key ? { ...row, value } : row)));
  };

  const applyConfirmedFields = () => {
    const selectedMap = extractionRows
      .filter((row) => row.use)
      .reduce((acc, row) => ({ ...acc, [row.key]: row.value }), {});

    const nextState = {};
    if (selectedMap.contractorName) nextState.contractorName = selectedMap.contractorName;
    if (selectedMap.activeJobs != null) nextState.activeJobs = `${selectedMap.activeJobs}`.replace(/[^0-9.-]/g, '');
    if (selectedMap.largestJobPercent != null) nextState.largestJobPercent = `${selectedMap.largestJobPercent}`.replace(/[^0-9.-]/g, '');
    if (selectedMap.underbillingsPresent != null) {
      const value = `${selectedMap.underbillingsPresent}`.toLowerCase();
      nextState.underbillings = value === 'true' ? 'yes' : value === 'false' ? 'no' : 'unsure';
    }
    if (selectedMap.overbillingsPresent != null) {
      const value = `${selectedMap.overbillingsPresent}`.toLowerCase();
      nextState.overbillings = value === 'true' ? 'yes' : value === 'false' ? 'no' : 'unsure';
    }
    if (selectedMap.costToCompleteAvailable) {
      const normalized = `${selectedMap.costToCompleteAvailable}`.toLowerCase();
      if (normalized.includes('yes')) nextState.costToComplete = 'yes';
      else if (normalized.includes('partial')) nextState.costToComplete = 'partial';
      else if (normalized.includes('no')) nextState.costToComplete = 'no';
    }
    if (Object.keys(nextState).length) {
      updateState(nextState);
    }
    setUploadError('');
  };

  const discardExtraction = () => {
    setExtractionRows([]);
    setEstimate(null);
    setUploadWarnings([]);
    setUploadError('');
  };

  const chooseFile = () => {
    fileInputRef.current?.click();
  };

  const importFromProcore = async () => {
    setIntegrationMessage('');
    try {
      const token = await getAuthToken().catch(() => null);
      if (!token) { setIntegrationMessage('Sign in to import.'); return; }
      const res = await fetch('/api/integrations/procore/connect?mode=summary', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await res.json().catch(() => ({}));
      if (payload?.status === 'not_connected') {
        setIntegrationMessage('Connect Procore first, then click Import.');
        return;
      }
      if (payload?.status !== 'connected' || !payload?.data) {
        setIntegrationMessage(payload?.detail || payload?.message || 'Import unavailable.');
        return;
      }
      const d = payload.data;
      const updates = {};
      if (d.companyName && !state.contractorName) updates.contractorName = d.companyName;
      if (d.activeProjects != null) updates.activeJobs = String(d.activeProjects);
      if (d.totalContractValue != null) updates.totalBacklog = String(Math.round(d.totalContractValue));
      onChange({ ...state, ...updates });
      setIntegrationMessage(`Imported ${d.activeProjects || 0} active projects from Procore${d.companyName ? ` · ${d.companyName}` : ''}.`);
    } catch (err) {
      setIntegrationMessage(`Procore import failed: ${err?.message || 'unknown error'}`);
    }
  };

  const importFromQuickBooks = async () => {
    setIntegrationMessage('');
    try {
      const token = await getAuthToken().catch(() => null);
      if (!token) { setIntegrationMessage('Sign in to import.'); return; }
      const res = await fetch('/api/integrations/quickbooks/company-summary', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await res.json().catch(() => ({}));
      if (payload?.status === 'not_connected') {
        setIntegrationMessage('Connect QuickBooks first, then click Import.');
        return;
      }
      if (payload?.status !== 'connected' || !payload?.data) {
        setIntegrationMessage(payload?.detail || payload?.message || 'Import unavailable.');
        return;
      }
      const d = payload.data;
      const updates = {};
      if (d.companyName) updates.contractorName = d.companyName;
      if (d.revenue != null) updates.revenue = String(Math.round(d.revenue));
      if (d.equity != null) updates.equity = String(Math.round(d.equity));
      if (d.totalAssets != null) updates.totalAssets = String(Math.round(d.totalAssets));
      if (d.totalLiabilities != null) updates.totalLiabilities = String(Math.round(d.totalLiabilities));
      onChange({ ...state, ...updates });
      setIntegrationMessage(`Imported from QuickBooks${d.companyName ? ` · ${d.companyName}` : ''}.`);
    } catch (err) {
      setIntegrationMessage(`Import failed: ${err?.message || 'unknown error'}`);
    }
  };

  const connectIntegration = async (provider) => {
    setIntegrationMessage('');
    try {
      const token = await getAuthToken().catch(() => null);
      if (!token) {
        setIntegrationMessage('Sign in first to connect an integration.');
        return;
      }
      const response = await fetch(`/api/integrations/${provider}/connect?mode=start`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await response.json().catch(() => ({}));
      if (payload?.authorizationUrl) {
        window.location.href = payload.authorizationUrl;
        return;
      }
      if (payload?.error || payload?.detail) {
        setIntegrationMessage(payload.detail || payload.error || 'Could not start integration flow.');
        return;
      }
      if (payload?.message) {
        setIntegrationMessage(payload.message);
        return;
      }
      setIntegrationMessage('This integration is not connected yet. Manual entry is available now.');
    } catch {
      setIntegrationMessage('Could not start integration flow. Manual entry is available now.');
    }
  };

  return (
    <section className={`rounded-[20px] border border-slate-200 bg-white p-6 shadow-[0_20px_50px_rgba(15,23,42,0.10),0_1px_2px_rgba(15,23,42,0.04)] ${className}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className={`${compact ? 'text-xl' : 'text-2xl'} font-bold tracking-[-0.02em] text-[#0B1F3A]`}>Start a 60-second file check</h2>
          <p className="mt-1 text-base text-slate-600">Enter the basics. Add details later.</p>
        </div>
        <StatusChip label="Pre-underwriting" variant="info" />
      </div>

      {/* L1 quick-check inputs */}
      <div className="mt-5 space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <label>
            <span className="mb-1.5 block text-[13px] font-medium text-slate-700">Contractor name</span>
            <input
              value={state.contractorName}
              onChange={(event) => updateField('contractorName', event.target.value)}
              placeholder="Northline Civil LLC"
              className="h-[42px] w-full rounded-[10px] border border-slate-300 px-3 text-sm text-slate-900 focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/20"
            />
          </label>
          <label>
            <span className="mb-1.5 block text-[13px] font-medium text-slate-700">File purpose</span>
            <select
              value={state.filePurpose}
              onChange={(event) => updateField('filePurpose', event.target.value)}
              className="h-[42px] w-full rounded-[10px] border border-slate-300 px-3 text-sm text-slate-900 focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/20 cursor-pointer"
            >
              <option value="">Select purpose…</option>
              <option value="Surety bonding">Surety bonding</option>
              <option value="SBA 7(a) loan">SBA 7(a) loan</option>
              <option value="Construction loan">Construction loan</option>
              <option value="Working capital">Working capital</option>
              <option value="Line of credit">Line of credit</option>
              <option value="Equipment financing">Equipment financing</option>
              <option value="Other">Other</option>
            </select>
          </label>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <SegmentedControl label="Current WIP schedule" value={state.wipStatus ?? 'missing'} options={STATUS_OPTIONS} colorMap={STATUS_COLOR_MAP} onChange={(value) => updateField('wipStatus', value)} />
          <SegmentedControl label="Interim financials" value={state.financialsStatus ?? 'missing'} options={STATUS_OPTIONS} colorMap={STATUS_COLOR_MAP} onChange={(value) => updateField('financialsStatus', value)} />
          <SegmentedControl label="Cost-to-complete detail" value={state.costToComplete} options={CTC_OPTIONS} onChange={(value) => updateField('costToComplete', value)} />
          <SegmentedControl label="Margin fade detected?" value={state.marginFade} options={RISK_OPTIONS} onChange={(value) => updateField('marginFade', value)} />
          <SegmentedControl label="Underbillings present?" value={state.underbillings} options={RISK_OPTIONS} onChange={(value) => updateField('underbillings', value)} />
        </div>
      </div>

      {/* Primary actions */}
      <div className="mt-5 flex flex-col gap-2">
        <CheckFileButton onRunReadiness={onRunReadiness} />
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={loadSample}
            className="text-sm font-medium text-slate-900 hover:text-slate-700 underline cursor-pointer"
          >
            Load sample file
          </button>
          {onSkipToWorkspace && state.contractorName?.trim() && (
            <button
              type="button"
              onClick={() => onSkipToWorkspace?.()}
              className="text-sm font-medium text-slate-500 hover:text-slate-700 cursor-pointer"
            >
              Skip to workspace →
            </button>
          )}
        </div>
      </div>

      {/* Collapsible add details */}
      <div className="mt-4 border-t border-slate-200 pt-4">
        <button
          type="button"
          onClick={() => setShowDetails((v) => !v)}
          className="flex w-full items-center justify-between text-sm font-semibold text-slate-700 hover:text-slate-900 cursor-pointer"
        >
          <span>Add details</span>
          <span className="text-slate-400">{showDetails ? '−' : '+'}</span>
        </button>

        {showDetails && (
          <div className="mt-4 space-y-4">
            <div>
              <InputMethodSelector value={state.inputMethod} onChange={(value) => updateField('inputMethod', value)} />
            </div>

            {state.inputMethod === 'upload' && (
              <article className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-900">Upload contractor documents</p>
                <p className="mt-1 text-sm text-slate-600">
                  Upload a WIP schedule, financials, debt schedule, or bond request. Review extracted fields before using them.
                </p>
                <p className="mt-1 text-xs text-slate-500">Accepted files: PDF, XLSX, CSV, PNG, JPG.</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.xlsx,.csv,.png,.jpg,.jpeg"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0] || null;
                    setSelectedFile(file);
                    setEstimate(null);
                    setExtractionRows([]);
                    setUploadWarnings([]);
                    setUploadError('');
                  }}
                />
                <div className="mt-3 rounded-xl border border-dashed border-slate-300 bg-white p-3">
                  <p className="text-sm text-slate-700">
                    {selectedFile ? `Selected file: ${selectedFile.name}` : 'No file selected yet.'}
                  </p>
                  {estimate && (
                    <p className="mt-1 text-xs text-slate-600">
                      Estimated pages: {estimate.pageCount || 1} · Estimated credits: {estimate.estimatedCredits ?? estimate.pageCount ?? 1}
                      {estimate.provider ? ` · Provider: ${estimate.provider}` : ''}
                    </p>
                  )}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" onClick={chooseFile} disabled={!uploadEnabled} className={`inline-flex h-10 items-center rounded-lg border px-3 text-sm font-semibold ${uploadEnabled ? 'border-[#0B1F3A] bg-[#0B1F3A] text-white hover:bg-[#12365F]' : 'cursor-not-allowed border-slate-300 bg-slate-100 text-slate-500'}`}>Upload File</button>
                  <button type="button" onClick={estimateExtraction} disabled={!selectedFile || estimating} className="inline-flex h-10 items-center rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-900 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60">{estimating ? 'Estimating…' : 'Estimate Credits'}</button>
                  <button type="button" onClick={extractFields} disabled={!selectedFile || !estimate || extracting} className="inline-flex h-10 items-center rounded-lg border border-[#0B1F3A] bg-[#0B1F3A] px-3 text-sm font-semibold text-white hover:bg-[#12365F] disabled:cursor-not-allowed disabled:opacity-60">{extracting ? 'Extracting…' : 'Extract Fields'}</button>
                </div>
                {!extractionProviderConfigured && (
                  <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                    Document extraction can be connected with Google Document AI, AWS Textract, or Mistral OCR. Manual entry is available now.
                  </div>
                )}
                {uploadError && <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{uploadError}</div>}
                {uploadWarnings.length > 0 && (
                  <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">Review notes</p>
                    <ul className="mt-1 space-y-1 text-sm text-amber-900">{uploadWarnings.map((warning) => <li key={warning}>• {warning}</li>)}</ul>
                  </div>
                )}
                <ReviewExtractedFields rows={extractionRows} onToggle={toggleExtractedRow} onChangeValue={updateExtractedValue} onApply={applyConfirmedFields} onDiscard={discardExtraction} loading={extracting} />
              </article>
            )}

            {state.inputMethod === 'connect' && (
              <div className="grid gap-3 md:grid-cols-2">
                <IntegrationConnectCard name="QuickBooks" copy="Import financial and company data for review." enabled={integrationStatus.quickbooksEnabled} onConnect={() => connectIntegration('quickbooks')} />
                <IntegrationConnectCard name="Procore" copy="Import project/job context for WIP review." enabled={integrationStatus.procoreEnabled} onConnect={() => connectIntegration('procore')} />
                <button
                  type="button"
                  onClick={importFromQuickBooks}
                  className="inline-flex h-10 items-center justify-center rounded-md border border-slate-300 bg-white px-3 text-[13px] font-semibold text-slate-900 hover:bg-slate-50"
                >
                  Import from QuickBooks (revenue · equity · assets · liabilities)
                </button>
                <button
                  type="button"
                  onClick={importFromProcore}
                  className="inline-flex h-10 items-center justify-center rounded-md border border-slate-300 bg-white px-3 text-[13px] font-semibold text-slate-900 hover:bg-slate-50"
                >
                  Import from Procore (active jobs · backlog)
                </button>
                {integrationStatus.loading && <p className="text-xs text-slate-600 md:col-span-2">Checking integration availability…</p>}
                {integrationMessage && <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 md:col-span-2">{integrationMessage}</p>}
              </div>
            )}

            <section>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Contractor details</p>
              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                <label>
                  <span className="mb-1.5 block text-[13px] font-medium text-slate-700">Trade type</span>
                  <select value={state.tradeType} onChange={(event) => updateField('tradeType', event.target.value)} className="h-[42px] w-full rounded-[10px] border border-slate-300 px-3 text-sm text-slate-900 focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/20">
                    {['Heavy civil', 'General contractor', 'Electrical', 'Mechanical', 'Concrete', 'Utilities', 'Roofing', 'Other'].map((option) => <option key={option}>{option}</option>)}
                  </select>
                </label>
                <div className="sm:col-span-2">
                  <RangeSlider
                    label="Requested amount / bond size"
                    value={toNumber((state.requestedAmount || '').replace(/[^0-9]/g, '')) || 500000}
                    min={50000}
                    max={10000000}
                    step={50000}
                    unit=""
                    onChange={(v) => updateField('requestedAmount', `$${v.toLocaleString()}`)}
                  />
                  <p className="mt-1 text-[11px] text-slate-400">{state.requestedAmount || '$500,000'}</p>
                </div>
              </div>
            </section>

            <section>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Documents received</p>
              <div className="mt-2 grid gap-2">
                {DOCUMENT_DEFINITIONS.map((document) => (
                  <ChecklistRow key={document.key} checked={Boolean(state.documents[document.key])} label={document.label} onChange={(checked) => updateDocument(document.key, checked)} />
                ))}
              </div>
            </section>

            <section>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">WIP detail</p>
              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                <RangeSlider label="Active jobs" value={toNumber(state.activeJobs) || 1} min={1} max={50} step={1} unit="" onChange={(v) => updateField('activeJobs', String(v))} />
                <RangeSlider label="Largest job % of backlog" value={toNumber(state.largestJobPercent) || 0} min={0} max={100} step={1} unit="%" onChange={(v) => updateField('largestJobPercent', String(v))} />
                <SegmentedControl label="Overbillings present?" value={state.overbillings} options={RISK_OPTIONS} onChange={(value) => updateField('overbillings', value)} />
              </div>
            </section>

            <section>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Surety underwriting inputs</p>
              <p className="mt-0.5 text-[11px] text-slate-500">Powers aggregate WP utilization, single-job concentration, and carrier appetite match.</p>
              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                <label>
                  <span className="mb-1.5 block text-[13px] font-medium text-slate-700">Aggregate work program ($)</span>
                  <input type="text" inputMode="numeric" value={state.aggregateWP} onChange={(e) => updateField('aggregateWP', e.target.value)} placeholder="50,000,000" className="h-[42px] w-full rounded-[10px] border border-slate-300 px-3 text-sm text-slate-900 focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/20" />
                </label>
                <label>
                  <span className="mb-1.5 block text-[13px] font-medium text-slate-700">Total backlog ($)</span>
                  <input type="text" inputMode="numeric" value={state.totalBacklog} onChange={(e) => updateField('totalBacklog', e.target.value)} placeholder="32,500,000" className="h-[42px] w-full rounded-[10px] border border-slate-300 px-3 text-sm text-slate-900 focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/20" />
                </label>
                <label>
                  <span className="mb-1.5 block text-[13px] font-medium text-slate-700">Largest single job ($)</span>
                  <input type="text" inputMode="numeric" value={state.largestJobAmount} onChange={(e) => updateField('largestJobAmount', e.target.value)} placeholder="8,200,000" className="h-[42px] w-full rounded-[10px] border border-slate-300 px-3 text-sm text-slate-900 focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/20" />
                </label>
                <label>
                  <span className="mb-1.5 block text-[13px] font-medium text-slate-700">Working capital ($)</span>
                  <input type="text" inputMode="numeric" value={state.workingCapital} onChange={(e) => updateField('workingCapital', e.target.value)} placeholder="3,200,000" className="h-[42px] w-full rounded-[10px] border border-slate-300 px-3 text-sm text-slate-900 focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/20" />
                </label>
                <label>
                  <span className="mb-1.5 block text-[13px] font-medium text-slate-700">Equity ($)</span>
                  <input type="text" inputMode="numeric" value={state.equity} onChange={(e) => updateField('equity', e.target.value)} placeholder="6,500,000" className="h-[42px] w-full rounded-[10px] border border-slate-300 px-3 text-sm text-slate-900 focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/20" />
                </label>
                <label>
                  <span className="mb-1.5 block text-[13px] font-medium text-slate-700">CPA letter type</span>
                  <select value={state.cpaLetterType} onChange={(e) => updateField('cpaLetterType', e.target.value)} className="h-[42px] w-full rounded-[10px] border border-slate-300 px-3 text-sm text-slate-900 focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/20">
                    <option value="unknown">Unknown / not received</option>
                    <option value="compilation">Compilation</option>
                    <option value="review">Reviewed</option>
                    <option value="audit">Audited</option>
                  </select>
                </label>
              </div>
            </section>
          </div>
        )}
      </div>

      {showPreview && <ReadinessPreview state={state} className="mt-4" />}
    </section>
  );
}

export function useFilePrepSummaryRow(state, id = 'FILE-001') {
  const analysis = useMemo(() => evaluateFilePrepState(state), [state]);
  return useMemo(
    () => ({
      id,
      contractor: state.contractorName?.trim() || 'Northline Civil LLC',
      filePurpose: state.filePurpose,
      readiness: analysis.score,
      wipStatus: analysis.wipReview.label,
      criticalGaps: analysis.criticalGaps.filter((gap) => gap.priority === 'Critical').length || analysis.criticalGaps.length,
      handoff: analysis.lenderHandoff,
      nextAction: analysis.nextActions[0],
      tradeType: toTitle(state.tradeType),
      requestedAmount: state.requestedAmount || '$750,000',
    }),
    [analysis, id, state.contractorName, state.filePurpose, state.tradeType, state.requestedAmount]
  );
}
