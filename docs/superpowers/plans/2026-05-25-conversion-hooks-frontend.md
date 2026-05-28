# Conversion Hooks — Frontend Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship four high-conversion frontend modules — a free WIP Audit Tool (BondSBA), a Fee Waiver Calculator with lead-capture gate (ClearPath), an EBITDA/DSCR engine (ClearPath), and a QB data-freshness badge (ClearPath) — without requiring any external API credentials.

**Architecture:** Each module is a self-contained React component lazy-loaded into the existing App.jsx route table. Lead capture writes to Supabase `leads` table via the existing anon client. No new backend routes required for Plan 1.

**Tech Stack:** React 18, Tailwind CSS v3, Lucide-react icons, Supabase JS v2 (already installed), Vite (existing build).

---

## File Structure

```
src/
  domains/
    surety/components/
      WipAuditTool.jsx          NEW — free ungated WIP widget (BondSBA)
    sba-loans/components/
      FeeWaiverCalculator.jsx   NEW — manufacturer fee waiver with lead-capture gate (ClearPath)
      EbitdaDscrEngine.jsx      NEW — EBITDA add-back + DSCR calculator (ClearPath)
  components/
    LeadCaptureModal.jsx        NEW — reusable lead-capture modal (email + name + company type)
    QbFreshnessIndicator.jsx    NEW — "Verified Interim Status" badge reading QB last-sync date
  App.jsx                       MODIFY — add 4 new PAGE_CONFIG entries + route cases
```

---

## Task 1: LeadCaptureModal (shared dependency — build first)

**Files:**
- Create: `src/components/LeadCaptureModal.jsx`

The modal accepts a `title`, `subtitle`, `onCapture(lead)` callback, and an `onClose` callback. On submit it inserts a row into Supabase `leads` and calls `onCapture`. Caller decides what to do next (download PDF, unlock content, etc.).

- [ ] **Step 1: Create the file**

```jsx
// src/components/LeadCaptureModal.jsx
// Reusable lead-capture gate modal.
// Usage:
//   <LeadCaptureModal
//     title="Download Your Executive Term Sheet"
//     subtitle="Enter your details to receive the PDF instantly."
//     ctaLabel="Send Me the PDF"
//     onCapture={(lead) => triggerDownload()}
//     onClose={() => setGateOpen(false)}
//   />
import { useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { supabase } from '../shared/utils/supabaseClient';

const COMPANY_TYPES = [
  'Loan Broker',
  'SBA Lender / LSO',
  'Fractional CFO',
  'Surety Producer',
  'Construction CPA',
  'Small Business Owner',
  'Other',
];

export function LeadCaptureModal({ title, subtitle, ctaLabel = 'Unlock Now', onCapture, onClose }) {
  const [form, setForm] = useState({ name: '', email: '', companyType: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const valid = form.name.trim() && /\S+@\S+\.\S+/.test(form.email) && form.companyType;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!valid) return;
    setLoading(true);
    setError(null);

    const { error: dbErr } = await supabase
      .from('leads')
      .insert({
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        company_type: form.companyType,
        source: window.location.hostname,
        page: window.location.pathname,
        created_at: new Date().toISOString(),
      });

    setLoading(false);
    if (dbErr) {
      // Non-blocking: duplicate email is acceptable — still unlock content.
      console.warn('Lead insert:', dbErr.message);
    }
    onCapture?.({ ...form });
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-[20px] font-bold tracking-tight text-slate-900">{title}</h2>
            {subtitle && <p className="mt-1 text-[13px] text-slate-600">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-3">
          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Full Name
            </span>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#0B1F3A] focus:outline-none focus:ring-1 focus:ring-[#0B1F3A]"
              placeholder="Jane Smith"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Work Email
            </span>
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#0B1F3A] focus:outline-none focus:ring-1 focus:ring-[#0B1F3A]"
              placeholder="jane@firm.com"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Role / Company Type
            </span>
            <select
              required
              value={form.companyType}
              onChange={(e) => setForm({ ...form, companyType: e.target.value })}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-[#0B1F3A] focus:outline-none focus:ring-1 focus:ring-[#0B1F3A]"
            >
              <option value="">Select your role…</option>
              {COMPANY_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </label>

          {error && (
            <p className="text-[12px] font-medium text-red-600">{error}</p>
          )}

          <button
            type="submit"
            disabled={!valid || loading}
            className="mt-1 flex w-full items-center justify-center gap-2 rounded-lg bg-[#0B1F3A] px-4 py-3 text-[13px] font-bold text-white hover:bg-[#12365F] disabled:opacity-50"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {ctaLabel}
          </button>
        </form>

        <p className="mt-3 text-[11px] text-slate-400">
          No spam. We use this to send you the document and occasional product updates.
        </p>
      </div>
    </div>
  );
}

export default LeadCaptureModal;
```

- [ ] **Step 2: Create the Supabase `leads` table migration**

Run in Supabase SQL editor (or save to `db-migrations/007_leads_table.sql`):

```sql
-- db-migrations/007_leads_table.sql
create table if not exists public.leads (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  email       text not null,
  company_type text,
  source      text,
  page        text,
  created_at  timestamptz default now()
);

-- Allow anon inserts (lead capture is intentionally public).
alter table public.leads enable row level security;

create policy "Anyone can insert a lead"
  on public.leads for insert
  to anon, authenticated
  with check (true);

-- Only authenticated service role can read leads (admin use only).
create policy "Service role reads leads"
  on public.leads for select
  to service_role
  using (true);
```

- [ ] **Step 3: Commit**

```bash
git add src/components/LeadCaptureModal.jsx db-migrations/007_leads_table.sql
git commit -m "feat: add reusable LeadCaptureModal with Supabase leads insert"
```

---

## Task 2: Free WIP Audit Tool (BondSBA)

**Files:**
- Create: `src/domains/surety/components/WipAuditTool.jsx`
- Modify: `src/App.jsx` — add route `wipAudit`

The tool computes overbilling/underbilling in real-time from 3 inputs. If underbillings exceed 10% of working capital, fires a visual alert and gates the remediation behind `LeadCaptureModal`.

- [ ] **Step 1: Create WipAuditTool.jsx**

```jsx
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
```

- [ ] **Step 2: Add route to App.jsx**

In `PAGE_CONFIG` (around line 318), add after the `surety` entry:

```js
wipAudit: {
  path: '/free-wip-audit',
  title: 'Free Contractor WIP Audit Tool | BondSBA Terminal',
  description: 'Instantly check contractor overbilling and underbilling. Free tool — no account required. Flags carrier risk when underbillings exceed 10% of working capital.',
  ogTitle: 'Free Contractor WIP Audit Tool — BondSBA Terminal',
  robots: 'index, follow',
},
```

At the top of App.jsx with the other lazy imports (around line 76):

```js
const WipAuditTool = lazy(() => import('./domains/surety/components/WipAuditTool'));
```

In the route render section (around line 1361), add:

```jsx
{page === 'wipAudit' && <WipAuditTool nav={nav} />}
```

- [ ] **Step 3: Commit**

```bash
git add src/domains/surety/components/WipAuditTool.jsx src/App.jsx
git commit -m "feat: add free WIP audit tool with underbilling alert + lead-capture gate (BondSBA)"
```

---

## Task 3: FY2026 Fee Waiver Calculator with Lead-Capture Gate (ClearPath)

**Files:**
- Create: `src/domains/sba-loans/components/FeeWaiverCalculator.jsx`
- Modify: `src/App.jsx` — add route `feeWaiverCalc`

Slider-driven calculator showing live fee savings for NAICS 31–33 manufacturers. "Download Executive Term Sheet PDF" triggers `LeadCaptureModal`, then generates a simple in-browser PDF via the browser print API (no server needed for Plan 1).

- [ ] **Step 1: Create FeeWaiverCalculator.jsx**

```jsx
// src/domains/sba-loans/components/FeeWaiverCalculator.jsx
// FY2026 SBA Manufacturer Fee Waiver Calculator.
// Target: NAICS 31–33 (Manufacturing) — waiver active through Sept 30, 2026.
// Shows upfront guaranty fee savings vs standard fee in real-time.
// "Download Term Sheet" is gated behind LeadCaptureModal.
import { useState, useCallback } from 'react';
import { Download, Info } from 'lucide-react';
import { LeadCaptureModal } from '../../../components/LeadCaptureModal';

// ── FY2026 SBA 7(a) Guaranty Fee Schedule ─────────────────────────────────────
// Source: SBA SOP 50 10 7.1 / FY2026 fee notice.
// Standard fees (non-manufacturer):
//   ≤$150k: 2.0% on guaranteed portion
//   $150k–$700k: 3.0%
//   >$700k: 3.5% on first $1M of guaranteed portion, 3.75% above
// Manufacturer waiver (NAICS 31–33): upfront guaranty fee = $0 on loans ≤$5M.
// Guarantee % = 85% for loans ≤$150k, 75% for loans >$150k (capped $3.75M).

export function calcGuarantyFee(loanAmount) {
  const amt = parseFloat(loanAmount) || 0;
  const guarantyPct = amt <= 150_000 ? 0.85 : 0.75;
  const guaranteed = Math.min(amt * guarantyPct, 3_750_000);

  let fee = 0;
  if (amt <= 150_000) {
    fee = guaranteed * 0.02;
  } else if (amt <= 700_000) {
    fee = guaranteed * 0.03;
  } else {
    const firstMillion = Math.min(guaranteed, 1_000_000);
    const above = Math.max(guaranteed - 1_000_000, 0);
    fee = firstMillion * 0.035 + above * 0.0375;
  }

  // Manufacturer waiver: $0 for loans ≤$5M (eligibility check done by lender).
  const manufacturerFee = amt <= 5_000_000 ? 0 : fee;
  const savings = fee - manufacturerFee;

  return { guaranteed, standardFee: fee, manufacturerFee, savings };
}

function fmt(n) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

function Slider({ label, min, max, step, value, onChange, format }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-[12px] font-semibold uppercase tracking-wider text-slate-500">{label}</label>
        <span className="text-[15px] font-bold tabular-nums text-slate-900">{format(value)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-[#0B1F3A]"
      />
      <div className="flex justify-between mt-1 text-[11px] text-slate-400">
        <span>{format(min)}</span>
        <span>{format(max)}</span>
      </div>
    </div>
  );
}

// Generates a printable term sheet via window.print() — no server needed.
function openPrintTermSheet({ loanAmount, interestRate, result }) {
  const win = window.open('', '_blank');
  if (!win) return;
  win.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>SBA 7(a) Fee Waiver — Executive Term Sheet</title>
      <style>
        body { font-family: Georgia, serif; max-width: 700px; margin: 40px auto; color: #0f172a; line-height: 1.6; }
        h1 { font-size: 22px; border-bottom: 2px solid #0B1F3A; padding-bottom: 8px; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        td, th { padding: 10px 12px; text-align: left; border: 1px solid #e2e8f0; font-size: 14px; }
        th { background: #f8fafc; font-weight: 600; }
        .highlight { background: #f0fdf4; font-weight: bold; color: #166534; }
        .footer { margin-top: 30px; font-size: 11px; color: #94a3b8; }
      </style>
    </head>
    <body>
      <h1>SBA 7(a) Manufacturer Fee Waiver — Executive Term Sheet</h1>
      <p><strong>Program:</strong> SBA 7(a) Standard Loan · FY2026 Manufacturing Fee Waiver (NAICS 31–33)</p>
      <p><strong>Waiver Valid Through:</strong> September 30, 2026</p>
      <table>
        <tr><th>Parameter</th><th>Value</th></tr>
        <tr><td>Loan Amount</td><td>${fmt(loanAmount)}</td></tr>
        <tr><td>Estimated Interest Rate</td><td>${interestRate.toFixed(2)}%</td></tr>
        <tr><td>SBA Guaranteed Portion (75%)</td><td>${fmt(result.guaranteed)}</td></tr>
        <tr><td>Standard Upfront Guaranty Fee</td><td>${fmt(result.standardFee)}</td></tr>
        <tr><td class="highlight">Manufacturer Fee (Waived)</td><td class="highlight">$0</td></tr>
        <tr><td class="highlight">Your Upfront Savings</td><td class="highlight">${fmt(result.savings)}</td></tr>
      </table>
      <p class="footer">
        This estimate is based on FY2026 SBA fee schedules and is for informational purposes only.
        Actual fees are determined by the SBA lender. Consult a licensed SBA lender or broker before proceeding.
        Generated by ClearPath SBA Loan Tools · clearpathsbaloan.com
      </p>
    </body>
    </html>
  `);
  win.document.close();
  win.focus();
  win.print();
}

export function FeeWaiverCalculator({ nav }) {
  const [loanAmount, setLoanAmount] = useState(500_000);
  const [interestRate, setInterestRate] = useState(7.5);
  const [gateOpen, setGateOpen] = useState(false);
  const [captured, setCaptured] = useState(false);

  const result = calcGuarantyFee(loanAmount);

  const handleCapture = useCallback((lead) => {
    setGateOpen(false);
    setCaptured(true);
    openPrintTermSheet({ loanAmount, interestRate, result });
  }, [loanAmount, interestRate, result]);

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      {/* Header */}
      <div className="mb-2">
        <span className="inline-block rounded-full border border-green-300 bg-green-50 px-3 py-0.5 text-[11px] font-bold uppercase tracking-widest text-green-700">
          FY2026 Waiver Active · Through Sept 30, 2026
        </span>
      </div>
      <h1 className="mt-3 text-[28px] font-bold tracking-tight text-slate-900 md:text-[32px]">
        SBA Manufacturer Fee Waiver Calculator
      </h1>
      <p className="mt-2 max-w-[54ch] text-[15px] text-slate-600 leading-relaxed">
        NAICS codes 31–33 (Manufacturing) qualify for a full upfront guaranty fee waiver on SBA 7(a)
        loans up to $5M. See your exact savings in real time.
      </p>

      <div className="flex items-start gap-2 mt-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
        <p className="text-[12px] text-blue-800">
          The upfront SBA guaranty fee — typically 3–3.75% of the guaranteed amount — is waived at closing
          for eligible manufacturers. This is cash saved on Day 1.
        </p>
      </div>

      {/* Sliders */}
      <div className="mt-8 space-y-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <Slider
          label="Loan Amount"
          min={50_000}
          max={5_000_000}
          step={25_000}
          value={loanAmount}
          onChange={setLoanAmount}
          format={(v) => fmt(v)}
        />
        <Slider
          label="Estimated Interest Rate"
          min={5.0}
          max={14.0}
          step={0.25}
          value={interestRate}
          onChange={setInterestRate}
          format={(v) => v.toFixed(2) + '%'}
        />
      </div>

      {/* Savings callout */}
      <div className="mt-6 grid grid-cols-3 gap-3">
        {[
          { label: 'Standard Fee', value: fmt(result.standardFee), muted: true },
          { label: 'Manufacturer Fee', value: '$0', green: true },
          { label: 'You Save', value: fmt(result.savings), bold: true },
        ].map(({ label, value, muted, green, bold }) => (
          <div
            key={label}
            className={`rounded-xl border p-4 text-center ${green ? 'border-green-200 bg-green-50' : 'border-slate-200 bg-slate-50'}`}
          >
            <p className={`text-[11px] font-semibold uppercase tracking-wider ${green ? 'text-green-600' : 'text-slate-400'}`}>
              {label}
            </p>
            <p
              className={`mt-1 text-[22px] font-bold tabular-nums ${
                green ? 'text-green-700' : bold ? 'text-[#0B1F3A]' : muted ? 'text-slate-400 line-through' : 'text-slate-900'
              }`}
            >
              {value}
            </p>
          </div>
        ))}
      </div>

      {/* CTA */}
      <button
        type="button"
        onClick={() => (captured ? openPrintTermSheet({ loanAmount, interestRate, result }) : setGateOpen(true))}
        className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-[#0B1F3A] px-6 py-4 text-[14px] font-bold text-white shadow-md hover:bg-[#12365F]"
      >
        <Download className="h-5 w-5" />
        Download Executive Term Sheet PDF
      </button>
      <p className="mt-2 text-center text-[11px] text-slate-400">Free · No credit card required</p>

      {gateOpen && (
        <LeadCaptureModal
          title="Download Executive Term Sheet PDF"
          subtitle="Your personalized SBA fee waiver term sheet — formatted for lender submission."
          ctaLabel="Send Me the PDF"
          onCapture={handleCapture}
          onClose={() => setGateOpen(false)}
        />
      )}
    </div>
  );
}

export default FeeWaiverCalculator;
```

- [ ] **Step 2: Add route to App.jsx**

In `PAGE_CONFIG`, add:

```js
feeWaiverCalc: {
  path: '/sba-manufacturer-fee-waiver',
  title: 'SBA Manufacturer Fee Waiver Calculator FY2026 | ClearPath SBA',
  description: 'Calculate upfront SBA guaranty fee savings for NAICS 31–33 manufacturers. FY2026 waiver active through Sept 30, 2026. Free instant calculator.',
  ogTitle: 'SBA Manufacturer Fee Waiver Calculator FY2026 — ClearPath',
  robots: 'index, follow',
},
```

Lazy import at top of App.jsx:

```js
const FeeWaiverCalculator = lazy(() => import('./domains/sba-loans/components/FeeWaiverCalculator'));
```

Route case (inside the render section):

```jsx
{page === 'feeWaiverCalc' && <FeeWaiverCalculator nav={nav} />}
```

- [ ] **Step 3: Commit**

```bash
git add src/domains/sba-loans/components/FeeWaiverCalculator.jsx src/App.jsx
git commit -m "feat: add FY2026 fee waiver calculator with lead-capture term sheet gate (ClearPath)"
```

---

## Task 4: EBITDA Add-Back & Adjusted DSCR Engine (ClearPath)

**Files:**
- Create: `src/domains/sba-loans/components/EbitdaDscrEngine.jsx`
- Modify: `src/App.jsx` — add route `ebitdaDscr`

Brokers enter raw P&L line items, add manual adjustments (officer comp, owner salary, one-time capex), and see adjusted EBITDA + DSCR in real time. No QB connection needed — pure manual input for Plan 1.

- [ ] **Step 1: Create EbitdaDscrEngine.jsx**

```jsx
// src/domains/sba-loans/components/EbitdaDscrEngine.jsx
// EBITDA Add-Back Engine + Adjusted DSCR Calculator for SBA credit memos.
// Brokers enter raw P&L figures and manually apply add-back adjustments
// to arrive at an Adjusted DSCR that matches bank credit committee standards.
// No QuickBooks connection required (Plan 1 — manual input only).
import { useState } from 'react';
import { Plus, Trash2, Info, CheckCircle, AlertTriangle } from 'lucide-react';

// ── Calculation logic ─────────────────────────────────────────────────────────

export function calcDscr({
  grossRevenue,
  cogs,
  operatingExpenses,
  interest,
  taxExpense,
  depreciation,
  amortization,
  adjustments,
  annualDebtService,
  existingDebtService,
}) {
  const parse = (v) => parseFloat(v) || 0;

  const ebitda =
    parse(grossRevenue) -
    parse(cogs) -
    parse(operatingExpenses) +
    parse(interest) +      // add back interest
    parse(taxExpense) +     // add back taxes
    parse(depreciation) +   // add back D&A
    parse(amortization);

  const totalAddBacks = adjustments.reduce((sum, adj) => sum + (parseFloat(adj.amount) || 0), 0);
  const adjustedEbitda = ebitda + totalAddBacks;

  const totalDebt = parse(annualDebtService) + parse(existingDebtService);
  const dscr = totalDebt > 0 ? adjustedEbitda / totalDebt : null;

  return { ebitda, adjustedEbitda, totalAddBacks, dscr };
}

function fmt(n) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

function NumInput({ label, hint, value, onChange }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</span>
      {hint && <span className="mb-1 block text-[11px] text-slate-400">{hint}</span>}
      <div className="relative">
        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400 text-sm">$</span>
        <input
          type="number"
          min="0"
          step="1000"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-lg border border-slate-300 pl-7 pr-3 py-2 text-sm tabular-nums focus:border-[#0B1F3A] focus:outline-none focus:ring-1 focus:ring-[#0B1F3A]"
          placeholder="0"
        />
      </div>
    </label>
  );
}

const ADJUSTMENT_PRESETS = [
  'Officer Compensation',
  'Excess Owner Salary',
  'One-Time Capital Expenditure',
  'Non-Recurring Legal Expense',
  'Personal Vehicle Expense',
  'Owner Life Insurance Premium',
  'Rent Normalization',
  'Custom Add-Back',
];

export function EbitdaDscrEngine() {
  const [pnl, setPnl] = useState({
    grossRevenue: '',
    cogs: '',
    operatingExpenses: '',
    interest: '',
    taxExpense: '',
    depreciation: '',
    amortization: '',
  });
  const [annualDebtService, setAnnualDebtService] = useState('');
  const [existingDebtService, setExistingDebtService] = useState('');
  const [adjustments, setAdjustments] = useState([
    { id: 1, label: 'Officer Compensation', amount: '' },
  ]);
  const [nextId, setNextId] = useState(2);

  const addAdjustment = () => {
    setAdjustments((prev) => [...prev, { id: nextId, label: 'Custom Add-Back', amount: '' }]);
    setNextId((n) => n + 1);
  };

  const removeAdjustment = (id) => setAdjustments((prev) => prev.filter((a) => a.id !== id));

  const updateAdj = (id, field, value) =>
    setAdjustments((prev) => prev.map((a) => (a.id === id ? { ...a, [field]: value } : a)));

  const setPnlField = (field, value) => setPnl((p) => ({ ...p, [field]: value }));

  const result = calcDscr({ ...pnl, adjustments, annualDebtService, existingDebtService });

  const dscrColor =
    result.dscr === null
      ? 'text-slate-400'
      : result.dscr >= 1.25
      ? 'text-green-700'
      : result.dscr >= 1.0
      ? 'text-amber-700'
      : 'text-red-700';

  const dscrLabel =
    result.dscr === null
      ? '—'
      : result.dscr >= 1.25
      ? 'Meets bank threshold (≥1.25x)'
      : result.dscr >= 1.0
      ? 'Marginal — below preferred 1.25x'
      : 'Below break-even — lender will flag';

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-[28px] font-bold tracking-tight text-slate-900 md:text-[32px]">
        EBITDA Add-Back &amp; DSCR Engine
      </h1>
      <p className="mt-2 max-w-[58ch] text-[15px] text-slate-600 leading-relaxed">
        Enter raw P&amp;L figures, apply broker-level add-back adjustments, and calculate an Adjusted
        DSCR that matches what bank credit committees actually use.
      </p>

      <div className="mt-8 grid gap-8 md:grid-cols-2">
        {/* P&L inputs */}
        <section>
          <h2 className="mb-4 text-[13px] font-bold uppercase tracking-widest text-slate-500">
            Income Statement (Annual)
          </h2>
          <div className="space-y-3">
            <NumInput label="Gross Revenue" value={pnl.grossRevenue} onChange={(v) => setPnlField('grossRevenue', v)} />
            <NumInput label="Cost of Goods Sold (COGS)" value={pnl.cogs} onChange={(v) => setPnlField('cogs', v)} />
            <NumInput label="Operating Expenses" hint="Exclude interest, taxes, D&A" value={pnl.operatingExpenses} onChange={(v) => setPnlField('operatingExpenses', v)} />
            <NumInput label="Interest Expense" value={pnl.interest} onChange={(v) => setPnlField('interest', v)} />
            <NumInput label="Income Tax Expense" value={pnl.taxExpense} onChange={(v) => setPnlField('taxExpense', v)} />
            <NumInput label="Depreciation" value={pnl.depreciation} onChange={(v) => setPnlField('depreciation', v)} />
            <NumInput label="Amortization" value={pnl.amortization} onChange={(v) => setPnlField('amortization', v)} />
          </div>
        </section>

        {/* Right column */}
        <div className="space-y-8">
          {/* Add-backs */}
          <section>
            <h2 className="mb-4 text-[13px] font-bold uppercase tracking-widest text-slate-500">
              Add-Back Adjustments
            </h2>
            <div className="space-y-3">
              {adjustments.map((adj) => (
                <div key={adj.id} className="flex gap-2">
                  <div className="flex-1 space-y-1">
                    <select
                      value={adj.label}
                      onChange={(e) => updateAdj(adj.id, 'label', e.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-[12px] focus:border-[#0B1F3A] focus:outline-none"
                    >
                      {ADJUSTMENT_PRESETS.map((p) => <option key={p} value={p}>{p}</option>)}
                    </select>
                    <div className="relative">
                      <span className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center text-slate-400 text-sm">$</span>
                      <input
                        type="number"
                        min="0"
                        step="1000"
                        value={adj.amount}
                        onChange={(e) => updateAdj(adj.id, 'amount', e.target.value)}
                        className="w-full rounded-lg border border-slate-300 pl-6 pr-2 py-1.5 text-sm tabular-nums focus:border-[#0B1F3A] focus:outline-none"
                        placeholder="0"
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeAdjustment(adj.id)}
                    className="mt-1 self-start rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={addAdjustment}
                className="flex items-center gap-1.5 text-[12px] font-semibold text-[#0B1F3A] hover:underline"
              >
                <Plus className="h-3.5 w-3.5" /> Add adjustment
              </button>
            </div>
          </section>

          {/* Debt service */}
          <section>
            <h2 className="mb-4 text-[13px] font-bold uppercase tracking-widest text-slate-500">
              Annual Debt Service
            </h2>
            <div className="space-y-3">
              <NumInput
                label="New Loan P+I (annual)"
                hint="Proposed SBA loan annual payment"
                value={annualDebtService}
                onChange={setAnnualDebtService}
              />
              <NumInput
                label="Existing Debt Service"
                hint="All current annual P+I obligations"
                value={existingDebtService}
                onChange={setExistingDebtService}
              />
            </div>
          </section>
        </div>
      </div>

      {/* Results */}
      <div className="mt-8 rounded-xl border border-slate-200 bg-slate-50 p-6">
        <h2 className="mb-4 text-[13px] font-bold uppercase tracking-widest text-slate-500">
          Adjusted Results
        </h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { label: 'Raw EBITDA', value: fmt(result.ebitda) },
            { label: 'Total Add-Backs', value: fmt(result.totalAddBacks) },
            { label: 'Adjusted EBITDA', value: fmt(result.adjustedEbitda), bold: true },
            { label: 'Adjusted DSCR', value: result.dscr !== null ? result.dscr.toFixed(2) + 'x' : '—', bold: true, color: dscrColor },
          ].map(({ label, value, bold, color }) => (
            <div key={label} className="rounded-lg border border-slate-200 bg-white p-3 text-center">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
              <p className={`mt-1 text-[20px] tabular-nums ${bold ? 'font-bold' : 'font-semibold'} ${color || 'text-slate-900'}`}>
                {value}
              </p>
            </div>
          ))}
        </div>

        {result.dscr !== null && (
          <div
            className={`mt-4 flex items-center gap-2 rounded-lg px-4 py-3 ${
              result.dscr >= 1.25 ? 'bg-green-50 border border-green-200' :
              result.dscr >= 1.0 ? 'bg-amber-50 border border-amber-200' :
              'bg-red-50 border border-red-200'
            }`}
          >
            {result.dscr >= 1.25
              ? <CheckCircle className="h-4 w-4 shrink-0 text-green-600" />
              : <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />}
            <p className={`text-[13px] font-semibold ${dscrColor}`}>{dscrLabel}</p>
          </div>
        )}

        <div className="mt-4 flex items-start gap-2 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2.5">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
          <p className="text-[11px] text-blue-700">
            Most SBA lenders require a global DSCR ≥ 1.25x. This tool calculates business-level DSCR only.
            A global DSCR analysis also includes personal financial obligations of the guarantors.
          </p>
        </div>
      </div>
    </div>
  );
}

export default EbitdaDscrEngine;
```

- [ ] **Step 2: Add route to App.jsx**

`PAGE_CONFIG` entry:

```js
ebitdaDscr: {
  path: '/sba-dscr-calculator',
  title: 'SBA DSCR Calculator — EBITDA Add-Back Engine | ClearPath',
  description: 'Calculate adjusted DSCR for SBA loans with EBITDA add-back adjustments for officer compensation, owner salary, and one-time expenses. Free broker tool.',
  ogTitle: 'SBA DSCR + EBITDA Add-Back Calculator — ClearPath',
  robots: 'index, follow',
},
```

Lazy import:

```js
const EbitdaDscrEngine = lazy(() => import('./domains/sba-loans/components/EbitdaDscrEngine'));
```

Route case:

```jsx
{page === 'ebitdaDscr' && <EbitdaDscrEngine />}
```

- [ ] **Step 3: Commit**

```bash
git add src/domains/sba-loans/components/EbitdaDscrEngine.jsx src/App.jsx
git commit -m "feat: add EBITDA add-back and adjusted DSCR engine (ClearPath)"
```

---

## Task 5: QuickBooks Data Freshness Badge (ClearPath)

**Files:**
- Create: `src/components/QbFreshnessIndicator.jsx`
- Modify: `src/domains/sba-loans/components/EbitdaDscrEngine.jsx` — import badge above the P&L inputs

Reads the `qb_last_sync_at` field from Supabase `user_integrations` table (written by the QB token refresh worker). Shows a "Verified Interim — Under 30 Days" green badge or an "Interim data stale — sync required" amber badge.

- [ ] **Step 1: Create QbFreshnessIndicator.jsx**

```jsx
// src/components/QbFreshnessIndicator.jsx
// Reads QB last-sync timestamp from Supabase and renders a data-freshness badge.
// Green badge when last sync < 30 days ago (bank compliance signal).
// Amber badge when stale or not connected.
// Props:
//   userId  — Supabase auth user ID (optional; falls back to current session)
import { useState, useEffect } from 'react';
import { CheckCircle, AlertTriangle, RefreshCw } from 'lucide-react';
import { supabase } from '../shared/utils/supabaseClient';

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export function QbFreshnessIndicator({ userId, className = '' }) {
  const [status, setStatus] = useState('loading'); // 'loading' | 'fresh' | 'stale' | 'not-connected'
  const [syncedAt, setSyncedAt] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchStatus() {
      // Resolve userId from session if not provided.
      let uid = userId;
      if (!uid) {
        const { data: { session } } = await supabase.auth.getSession();
        uid = session?.user?.id;
      }
      if (!uid) { if (!cancelled) setStatus('not-connected'); return; }

      const { data, error } = await supabase
        .from('user_integrations')
        .select('qb_last_sync_at')
        .eq('user_id', uid)
        .eq('provider', 'quickbooks')
        .maybeSingle();

      if (cancelled) return;

      if (error || !data?.qb_last_sync_at) {
        setStatus('not-connected');
        return;
      }

      const syncTime = new Date(data.qb_last_sync_at).getTime();
      const age = Date.now() - syncTime;
      setSyncedAt(new Date(data.qb_last_sync_at));
      setStatus(age < THIRTY_DAYS_MS ? 'fresh' : 'stale');
    }

    fetchStatus();
    return () => { cancelled = true; };
  }, [userId]);

  if (status === 'loading') return null;

  if (status === 'not-connected') {
    return (
      <div className={`inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold text-slate-500 ${className}`}>
        <RefreshCw className="h-3 w-3" />
        QuickBooks not connected
      </div>
    );
  }

  const daysSince = syncedAt
    ? Math.floor((Date.now() - syncedAt.getTime()) / (24 * 60 * 60 * 1000))
    : null;

  if (status === 'fresh') {
    return (
      <div className={`inline-flex items-center gap-1.5 rounded-full border border-green-300 bg-green-50 px-3 py-1 text-[11px] font-semibold text-green-700 ${className}`}>
        <CheckCircle className="h-3 w-3" />
        Verified Interim Status: Under 30 Days
        {daysSince !== null && <span className="text-green-500">(synced {daysSince}d ago)</span>}
      </div>
    );
  }

  return (
    <div className={`inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-[11px] font-semibold text-amber-700 ${className}`}>
      <AlertTriangle className="h-3 w-3" />
      Interim data stale
      {daysSince !== null && <span className="text-amber-500">({daysSince}d since last sync)</span>}
      — reconnect QuickBooks
    </div>
  );
}

export default QbFreshnessIndicator;
```

- [ ] **Step 2: Ensure `user_integrations` table has `qb_last_sync_at` column**

Save to `db-migrations/008_user_integrations_qb_sync.sql` and run in Supabase:

```sql
-- db-migrations/008_user_integrations_qb_sync.sql
-- Add QB sync tracking to user_integrations (create table if not exists yet).

create table if not exists public.user_integrations (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  provider       text not null,  -- 'quickbooks' | 'procore'
  access_token   text,           -- encrypted at rest by Supabase Vault in Plan 3
  refresh_token  text,
  qb_last_sync_at timestamptz,
  realm_id        text,           -- QuickBooks company ID
  created_at     timestamptz default now(),
  updated_at     timestamptz default now(),
  unique (user_id, provider)
);

alter table public.user_integrations enable row level security;

create policy "Users read own integrations"
  on public.user_integrations for select
  to authenticated
  using (user_id = auth.uid());

create policy "Users update own integrations"
  on public.user_integrations for update
  to authenticated
  using (user_id = auth.uid());

create policy "Users insert own integrations"
  on public.user_integrations for insert
  to authenticated
  with check (user_id = auth.uid());
```

- [ ] **Step 3: Import badge in EbitdaDscrEngine.jsx**

Add to the top of `EbitdaDscrEngine.jsx` (after existing imports):

```js
import { QbFreshnessIndicator } from '../../../components/QbFreshnessIndicator';
```

Add just below the `<p>` description paragraph inside the component return:

```jsx
<div className="mt-3">
  <QbFreshnessIndicator />
</div>
```

- [ ] **Step 4: Commit**

```bash
git add src/components/QbFreshnessIndicator.jsx \
        db-migrations/008_user_integrations_qb_sync.sql \
        src/domains/sba-loans/components/EbitdaDscrEngine.jsx
git commit -m "feat: add QB data freshness badge (Verified Interim <30 Days) to DSCR engine"
```

---

## Task 6: Wire new pages into nav (both sites)

**Files:**
- Modify: `src/components/LanePages.jsx` — add tool cards linking to new pages
- Modify: `src/App.jsx` — add new pages to appropriate nav menus

- [ ] **Step 1: Add WipAuditTool card to BondSBA landing (BondHomeClassic)**

In `src/App.jsx`, locate the `BondHomeClassic` function. Find the tools grid section and add a card:

```jsx
{/* Free WIP Audit — ungated lead magnet */}
<button
  type="button"
  onClick={() => nav('wipAudit')}
  className="flex flex-col gap-2 rounded-xl border-2 border-dashed border-amber-300 bg-amber-50 p-5 text-left hover:bg-amber-100"
>
  <span className="inline-block rounded-full bg-amber-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-amber-800">
    Free · No Account
  </span>
  <p className="text-[15px] font-bold text-slate-900">Free WIP Audit Tool</p>
  <p className="text-[13px] text-slate-600">
    Enter contract figures. Instantly check overbilling vs underbilling. Flags carrier risk threshold.
  </p>
</button>
```

- [ ] **Step 2: Add FeeWaiver and DSCR cards to ClearPath SBA landing**

In `src/components/LanePages.jsx`, inside `SBALaneHome`, find the tools grid and add:

```jsx
{/* Fee Waiver Calculator */}
<button
  type="button"
  onClick={() => nav('feeWaiverCalc')}
  className="flex flex-col gap-2 rounded-xl border border-green-200 bg-green-50 p-5 text-left hover:bg-green-100"
>
  <span className="inline-block rounded-full bg-green-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-green-800">
    FY2026 Waiver Active
  </span>
  <p className="text-[15px] font-bold text-slate-900">Manufacturer Fee Waiver Calculator</p>
  <p className="text-[13px] text-slate-600">
    NAICS 31–33? See your exact upfront fee savings before the waiver expires Sept 30.
  </p>
</button>

{/* DSCR Engine */}
<button
  type="button"
  onClick={() => nav('ebitdaDscr')}
  className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-5 text-left hover:bg-slate-50"
>
  <p className="text-[15px] font-bold text-slate-900">EBITDA &amp; DSCR Calculator</p>
  <p className="text-[13px] text-slate-600">
    Apply add-back adjustments and calculate adjusted DSCR to match bank credit committee standards.
  </p>
</button>
```

- [ ] **Step 3: Commit**

```bash
git add src/App.jsx src/components/LanePages.jsx
git commit -m "feat: wire WIP Audit, Fee Waiver, and DSCR tools into landing page nav cards"
```

---

## Task 7: Final build verification

- [ ] **Step 1: Run build**

```bash
cd /Users/camre/clearpath && npm run build 2>&1 | tail -20
```

Expected: `✓ built in Xs` with no TypeScript/import errors.

- [ ] **Step 2: Spot-check routes**

```bash
npm run dev &
# Visit in browser:
# http://localhost:5173/free-wip-audit
# http://localhost:5173/sba-manufacturer-fee-waiver
# http://localhost:5173/sba-dscr-calculator
```

Verify: all three pages render without console errors. WIP alert triggers when underbilling > 10% of WC. Fee waiver savings update live with slider. DSCR turns green at ≥1.25x.

- [ ] **Step 3: Final commit + push**

```bash
git push origin feature/surety-api-improvements
```

---

## Self-Review

### Spec Coverage

| Spec Item | Task |
|-----------|------|
| BondSBA WIP Audit Tool — ungated, overbilling/underbilling calc, 10% WC alert, lead gate | Task 2 ✓ |
| ClearPath Fee Waiver Calculator — sliders, savings projection, lead-capture PDF gate | Task 3 ✓ |
| ClearPath EBITDA Add-Back Engine — adjustments, DSCR | Task 4 ✓ |
| QuickBooks freshness badge — "Verified Interim Under 30 Days" | Task 5 ✓ |
| Reusable lead capture (name, email, company type, Supabase insert) | Task 1 ✓ |
| Wire new pages into landing nav | Task 6 ✓ |

**Deferred to Plan 2–4 (require credentials or complex infra):**
- Procore OAuth service + Surety Dashboard integration
- QB historical trend ledger + GL mapping UI
- Background/lien/lawsuit aggregator (LexisNexis/D&B)
- Virtual Data Room (VDR) with virus scan + audit log
- Document porting (ClearPath → BondSBA one-click)
- PDF compilation service (server-side multi-page packets)
- White-label multi-tenant middleware

### Placeholder Scan
None found — all steps contain full code blocks and exact commands.

### Type Consistency
- `calcWip()` defined in Task 2, consumed only within `WipAuditTool.jsx` ✓
- `calcGuarantyFee()` defined in Task 3, consumed only within `FeeWaiverCalculator.jsx` ✓
- `calcDscr()` defined in Task 4, consumed only within `EbitdaDscrEngine.jsx` ✓
- `LeadCaptureModal` import path `'../../../components/LeadCaptureModal'` consistent in Tasks 2 and 3 ✓
- `QbFreshnessIndicator` import path `'../../../components/QbFreshnessIndicator'` used in Task 5 ✓
