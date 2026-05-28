// src/domains/sba-loans/components/EbitdaDscrEngine.jsx
// EBITDA Add-Back & Adjusted DSCR Calculator for ClearPath SBA Loans.
// Inputs: income statement line items + proposed debt service.
// Outputs: EBITDA, adjusted cash flow, DSCR ratio with approval indicator.
// "Get Lender-Ready DSCR Summary" is gated behind LeadCaptureModal.
import { useState } from 'react';
import { LeadCaptureModal } from '../../../components/LeadCaptureModal';
import QbFreshnessIndicator from '../../../components/QbFreshnessIndicator';

// ── Pure calculation logic (easy to unit test) ────────────────────────────────
export function calcDscr({ netIncome, depreciation, amortization, interest, taxes, ownerAddBacks, proposedAnnualDebt }) {
  const ebitda = netIncome + depreciation + amortization + interest + taxes;
  const adjustedCashFlow = ebitda + ownerAddBacks;
  const dscr = proposedAnnualDebt > 0 ? adjustedCashFlow / proposedAnnualDebt : null;
  return { ebitda, adjustedCashFlow, dscr };
}

const currencyFmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

function fmt(n) {
  return currencyFmt.format(n);
}

function NumericInput({ label, hint, value, onChange, allowNegative }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[12px] font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </span>
      {hint && <span className="mb-1.5 block text-[11px] text-slate-400">{hint}</span>}
      <div className="relative">
        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400 text-sm">$</span>
        <input
          type="number"
          min={allowNegative ? undefined : '0'}
          step="1000"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-lg border border-slate-300 pl-7 pr-3 py-2.5 text-sm tabular-nums focus:border-[#0B1F3A] focus:outline-none focus:ring-1 focus:ring-[#0B1F3A]"
          placeholder="0"
        />
      </div>
    </label>
  );
}

function DscrBadge({ dscr }) {
  if (dscr === null) {
    return (
      <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">
        Enter Debt Service to See DSCR
      </span>
    );
  }
  if (dscr >= 1.25) {
    return (
      <span className="inline-flex items-center rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-800">
        Strong — Lender-Favorable
      </span>
    );
  }
  if (dscr >= 1.0) {
    return (
      <span className="inline-flex items-center rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
        Marginal — Additional Documentation Likely
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-800">
      Below Threshold — Restructuring Recommended
    </span>
  );
}

export function EbitdaDscrEngine({ nav, qbLastSyncedAt = null }) {
  const [netIncome, setNetIncome] = useState('');
  const [depreciation, setDepreciation] = useState('');
  const [amortization, setAmortization] = useState('');
  const [interest, setInterest] = useState('');
  const [taxes, setTaxes] = useState('');
  const [ownerAddBacks, setOwnerAddBacks] = useState('');
  const [proposedAnnualDebt, setProposedAnnualDebt] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [captured, setCaptured] = useState(false);

  const parse = (v) => parseFloat(v) || 0;

  const result = calcDscr({
    netIncome: parse(netIncome),
    depreciation: parse(depreciation),
    amortization: parse(amortization),
    interest: parse(interest),
    taxes: parse(taxes),
    ownerAddBacks: parse(ownerAddBacks),
    proposedAnnualDebt: parse(proposedAnnualDebt),
  });

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      {/* QB Freshness Indicator */}
      <QbFreshnessIndicator lastSyncedAt={qbLastSyncedAt} className="mb-4" />

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Adjusted DSCR Calculator</h1>
        <p className="mt-1 text-sm text-slate-500">
          Enter your income statement figures to compute EBITDA, apply SBA-approved add-backs,
          and see your Debt Service Coverage Ratio.
        </p>
      </div>

      {/* Income Statement Inputs */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 space-y-4">
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
          Income Statement
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <NumericInput
            label="Net Income / Net Loss ($)"
            value={netIncome}
            onChange={setNetIncome}
            allowNegative
          />
          <NumericInput
            label="Depreciation ($)"
            value={depreciation}
            onChange={setDepreciation}
          />
          <NumericInput
            label="Amortization ($)"
            value={amortization}
            onChange={setAmortization}
          />
          <NumericInput
            label="Interest Expense ($)"
            value={interest}
            onChange={setInterest}
          />
          <NumericInput
            label="Income Tax Expense ($)"
            value={taxes}
            onChange={setTaxes}
          />
          <NumericInput
            label="Owner Add-Backs / Non-Recurring Items ($)"
            hint="Legitimate add-backs: owner salary above market, one-time legal fees, personal expenses run through business"
            value={ownerAddBacks}
            onChange={setOwnerAddBacks}
          />
        </div>
      </div>

      {/* Proposed Debt Service */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
          Proposed Debt Service
        </h2>
        <div className="max-w-xs">
          <NumericInput
            label="Annual Debt Service on Proposed Loan ($)"
            value={proposedAnnualDebt}
            onChange={setProposedAnnualDebt}
          />
        </div>
      </div>

      {/* Results */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">
          Results
        </h2>
        <div className="grid grid-cols-3 gap-4 mb-5">
          <div className="bg-slate-50 rounded-lg p-4">
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">EBITDA</div>
            <div className="text-lg font-bold tabular-nums text-slate-900">{fmt(result.ebitda)}</div>
          </div>
          <div className="bg-slate-50 rounded-lg p-4">
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Adjusted Cash Flow</div>
            <div className="text-lg font-bold tabular-nums text-slate-900">{fmt(result.adjustedCashFlow)}</div>
          </div>
          <div className="bg-slate-50 rounded-lg p-4">
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">DSCR Ratio</div>
            <div className="text-lg font-bold tabular-nums text-slate-900">
              {result.dscr !== null ? `${result.dscr.toFixed(2)}x` : '—'}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-slate-600">Status:</span>
          <DscrBadge dscr={result.dscr} />
        </div>
      </div>

      {/* CTA */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
        {captured ? (
          <p className="text-sm font-medium text-green-700">
            Check your email — your DSCR summary is on the way.
          </p>
        ) : (
          <button
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-[#0B1F3A] hover:bg-[#12365F] text-white font-semibold text-sm px-5 py-3 shadow-[0_6px_18px_rgba(11,31,58,0.22)] transition-colors duration-150 cursor-pointer"
          >
            Get a Lender-Ready DSCR Summary
          </button>
        )}
      </div>

      <LeadCaptureModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onCapture={() => {
          setModalOpen(false);
          setCaptured(true);
        }}
        title="Get Your Lender-Ready DSCR Summary"
        subtitle="We'll email a formatted cash flow analysis your lender will actually read."
      />
    </div>
  );
}

export default EbitdaDscrEngine;
