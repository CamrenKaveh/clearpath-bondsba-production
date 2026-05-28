// src/domains/surety/components/WipAuditTool.jsx
// Free, ungated WIP audit widget for BondSBA.
// Inputs: Contract Price, Costs Incurred, Billings to Date, Working Capital.
// Outputs: % complete, earned revenue, over/underbilling, alert if underbilling > 10% WC.
// Remediation strategy is gated behind LeadCaptureModal.
import { useState, useCallback } from 'react';
import { AlertTriangle, CheckCircle, ChevronRight, Lock } from 'lucide-react';
import { LeadCaptureModal } from '../../../components/LeadCaptureModal';

// ── Pure calculation logic (easy to unit test) ────────────────────────────────
export function calcWip({ contractPrice, costsIncurred, billingsToDate, workingCapital }) {
  const price = parseFloat(contractPrice) || 0;
  const costs = parseFloat(costsIncurred) || 0;
  const billings = parseFloat(billingsToDate) || 0;
  const wc = parseFloat(workingCapital) || 0;

  if (price <= 0 || costs < 0) return null;

  const pctComplete = price > 0 ? Math.min(costs / price, 1) : 0;
  const earnedRevenue = price * pctComplete;
  const overUnder = billings - earnedRevenue; // positive = overbilled, negative = underbilled
  const underbillingPct = wc > 0 && overUnder < 0 ? Math.abs(overUnder) / wc : 0;
  const alertTriggered = underbillingPct > 0.1; // >10% of WC

  return {
    pctComplete,
    earnedRevenue,
    overUnder,
    underbillingPct,
    alertTriggered,
    isOverbilled: overUnder > 0,
  };
}

function fmt(n) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

function pct(n) {
  return (n * 100).toFixed(1) + '%';
}

function NumericInput({ label, hint, value, onChange }) {
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
          min="0"
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

export function WipAuditTool({ nav }) {
  const [contractPrice, setContractPrice] = useState('');
  const [costsIncurred, setCostsIncurred] = useState('');
  const [billingsToDate, setBillingsToDate] = useState('');
  const [workingCapital, setWorkingCapital] = useState('');
  const [gateOpen, setGateOpen] = useState(false);
  const [unlocked, setUnlocked] = useState(false);

  const result = calcWip({ contractPrice, costsIncurred, billingsToDate, workingCapital });

  const handleCapture = useCallback(() => {
    setGateOpen(false);
    setUnlocked(true);
  }, []);

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      {/* Header */}
      <div className="mb-8">
        <span className="inline-block rounded-full border border-amber-300 bg-amber-50 px-3 py-0.5 text-[11px] font-bold uppercase tracking-widest text-amber-700">
          Free Tool · No Account Required
        </span>
        <h1 className="mt-3 text-[28px] font-bold tracking-tight text-slate-900 md:text-[32px]">
          Free Contractor WIP Audit
        </h1>
        <p className="mt-2 max-w-[52ch] text-[15px] text-slate-600 leading-relaxed">
          Enter project figures to instantly check whether your contractor is overbilled or underbilled —
          and whether that gap creates a carrier risk.
        </p>
      </div>

      {/* Input grid */}
      <div className="grid gap-4 sm:grid-cols-2">
        <NumericInput
          label="Contract Price"
          hint="Total contract value (original + approved change orders)"
          value={contractPrice}
          onChange={setContractPrice}
        />
        <NumericInput
          label="Total Costs Incurred"
          hint="All job costs posted through the period end date"
          value={costsIncurred}
          onChange={setCostsIncurred}
        />
        <NumericInput
          label="Total Billings to Date"
          hint="All progress billings submitted by the contractor"
          value={billingsToDate}
          onChange={setBillingsToDate}
        />
        <NumericInput
          label="Working Capital"
          hint="Current assets minus current liabilities (from balance sheet)"
          value={workingCapital}
          onChange={setWorkingCapital}
        />
      </div>

      {/* Results */}
      {result && (
        <div className="mt-8 space-y-4">
          {/* Summary row */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: '% Complete', value: pct(result.pctComplete) },
              { label: 'Earned Revenue', value: fmt(result.earnedRevenue) },
              {
                label: result.isOverbilled ? 'Overbilling' : 'Underbilling',
                value: fmt(Math.abs(result.overUnder)),
                highlight: true,
                warn: !result.isOverbilled,
              },
            ].map(({ label, value, highlight, warn }) => (
              <div
                key={label}
                className={`rounded-xl border p-3 text-center ${
                  warn
                    ? 'border-red-200 bg-red-50'
                    : highlight
                    ? 'border-amber-200 bg-amber-50'
                    : 'border-slate-200 bg-slate-50'
                }`}
              >
                <p className={`text-[11px] font-semibold uppercase tracking-wider ${warn ? 'text-red-500' : 'text-slate-500'}`}>
                  {label}
                </p>
                <p className={`mt-1 text-[20px] font-bold tabular-nums ${warn ? 'text-red-700' : 'text-slate-900'}`}>
                  {value}
                </p>
              </div>
            ))}
          </div>

          {/* Status badge */}
          <div
            className={`flex items-start gap-3 rounded-xl border p-4 ${
              result.isOverbilled
                ? 'border-amber-200 bg-amber-50'
                : result.alertTriggered
                ? 'border-red-200 bg-red-50'
                : 'border-green-200 bg-green-50'
            }`}
          >
            {result.isOverbilled ? (
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            ) : result.alertTriggered ? (
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
            ) : (
              <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />
            )}
            <div>
              <p className={`text-[13px] font-bold ${result.alertTriggered && !result.isOverbilled ? 'text-red-800' : result.isOverbilled ? 'text-amber-800' : 'text-green-800'}`}>
                {result.isOverbilled
                  ? `Contractor is overbilled by ${fmt(result.overUnder)}.`
                  : result.alertTriggered
                  ? `⚠ Underbilling exceeds 10% of working capital — carrier risk threshold crossed.`
                  : `Underbilling is within acceptable range (under 10% of working capital).`}
              </p>
              {result.alertTriggered && !result.isOverbilled && (
                <p className="mt-1 text-[12px] text-red-700">
                  Underbilling represents {pct(result.underbillingPct)} of working capital.
                  Surety carriers treat gaps above 10% as a liquidity stress signal.
                </p>
              )}
            </div>
          </div>

          {/* Remediation gate */}
          {result.alertTriggered && !result.isOverbilled && !unlocked && (
            <button
              type="button"
              onClick={() => setGateOpen(true)}
              className="flex w-full items-center justify-between rounded-xl border-2 border-[#0B1F3A] bg-[#0B1F3A] px-5 py-4 text-left text-white hover:bg-[#12365F]"
            >
              <div>
                <p className="text-[13px] font-bold">Unlock Your Carrier-Ready Document Checklist</p>
                <p className="mt-0.5 text-[12px] text-blue-200">
                  Tailored to this risk tier — includes remediation steps for underbilling stress.
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <Lock className="h-4 w-4 opacity-70" />
                <ChevronRight className="h-4 w-4" />
              </div>
            </button>
          )}

          {unlocked && (
            <div className="rounded-xl border border-green-200 bg-green-50 px-5 py-4">
              <p className="text-[13px] font-bold text-green-800">
                ✓ Checklist unlocked — check your email for your carrier-ready document list.
              </p>
              <p className="mt-1 text-[12px] text-green-700">
                Meanwhile, open the{' '}
                <button
                  type="button"
                  onClick={() => nav?.('opsQueue')}
                  className="underline hover:no-underline"
                >
                  Submission Ops Queue
                </button>{' '}
                to start building this file.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Lead capture modal */}
      {gateOpen && (
        <LeadCaptureModal
          title="Unlock Your Carrier-Ready Custom Document Checklist"
          subtitle="We'll send a tailored checklist for this risk tier — including the exact documents that address underbilling stress."
          ctaLabel="Send Me the Checklist"
          onCapture={handleCapture}
          onClose={() => setGateOpen(false)}
        />
      )}
    </div>
  );
}

export default WipAuditTool;
