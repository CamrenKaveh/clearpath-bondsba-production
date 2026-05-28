/**
 * LanePages — Bond and SBA side home pages.
 * Bond: amber/slate palette, 4-step grid
 * SBA:  emerald/slate palette, 3-step linear + secondary tools
 */
import React, { useState } from 'react';
import AdSenseSlot from './AdSlot.jsx';
import {
  Landmark, Shield, FileText, CheckSquare, ListChecks,
  Briefcase, ArrowRight, Calculator, ChevronDown, ChevronUp,
  TrendingUp, Layers, BookOpen, BarChart2, AlertTriangle, ClipboardCheck, Tag, Activity,
} from 'lucide-react';

/* ── Shared tokens ─────────────────────────────────────────── */
const TOKENS = {
  bond: {
    dot:          'bg-amber-400',
    badge:        'bg-amber-500 text-white',
    num:          'bg-amber-50 text-amber-700',
    icon:         'text-amber-600',
    accent:       'border-amber-200 bg-amber-50/50',
    ring:         'ring-amber-400/40',
    btn:          'bg-[#78350f] hover:bg-[#92400e] text-white shadow-[0_6px_18px_-4px_rgba(120,53,15,0.45)]',
    tagBg:        'bg-amber-500',
    label:        'BOND SIDE',
    hoverBorder:  'hover:border-amber-300',
    cardHover:    'hover:shadow-[0_18px_38px_-12px_rgba(120,53,15,0.15)]',
    bar:          'bg-amber-400',
  },
  sba: {
    dot:          'bg-blue-400',
    badge:        'bg-[#0B1F3A] text-white',
    num:          'bg-[#0B1F3A]/[0.08] text-[#0B1F3A]',
    icon:         'text-[#1a3a6b]',
    accent:       'border-[#0B1F3A]/15 bg-[#0B1F3A]/[0.03]',
    ring:         'ring-[#1a3a6b]/30',
    btn:          'bg-[#0B1F3A] hover:bg-[#12365F] text-white shadow-[0_6px_18px_-4px_rgba(11,31,58,0.4)]',
    tagBg:        'bg-[#0B1F3A]',
    label:        'SBA SIDE',
    hoverBorder:  'hover:border-[#1a3a6b]/30',
    cardHover:    'hover:shadow-[0_18px_38px_-12px_rgba(11,31,58,0.12)]',
    bar:          'bg-[#1a3a6b]',
  },
};

/* ── Eyebrow ────────────────────────────────────────────────── */
function LaneEyebrow({ side }) {
  const t = TOKENS[side];
  return (
    <div className="flex items-center gap-2.5">
      <span aria-hidden className={`inline-block h-2 w-2 rounded-full ${t.dot}`} />
      <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400">{t.label}</p>
    </div>
  );
}

/* ── Accent bar (top of page) ───────────────────────────────── */
function LaneAccentBar({ side }) {
  const t = TOKENS[side];
  return (
    <div className={`h-1 w-full rounded-full mb-8 opacity-60 ${t.bar}`} />
  );
}

/* ── Step card ──────────────────────────────────────────────── */
function StepCard({ number, icon: Icon, title, description, cta, onClick, side, featured = false }) {
  const t = TOKENS[side];
  return (
    <button
      onClick={onClick}
      className={`group relative flex h-full flex-col rounded-xl border bg-white p-5 text-left transition-all ${
        featured
          ? `border-slate-200 ring-1 ${t.ring} shadow-md ${t.cardHover}`
          : `border-slate-200 shadow-sm hover:border-slate-300 ${t.cardHover}`
      }`}
    >
      {featured && (
        <span className={`absolute -top-2.5 left-4 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${t.badge}`}>
          Start here
        </span>
      )}

      <div className="flex items-center gap-3">
        <span className={`inline-flex h-8 w-8 items-center justify-center rounded-lg text-[11px] font-bold ${t.num}`}>
          {number}
        </span>
        <Icon className={`h-5 w-5 ${t.icon}`} />
      </div>

      <h3 className="mt-4 text-[15px] font-semibold tracking-[-0.01em] text-slate-900">{title}</h3>
      <p className="mt-1.5 flex-1 text-[13px] leading-relaxed text-slate-600">{description}</p>

      <span className={`mt-4 inline-flex items-center gap-1 text-[12px] font-semibold ${t.icon}`}>
        {cta}
        <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
      </span>
    </button>
  );
}

/* ── Compact secondary row ──────────────────────────────────── */
function SecondaryTool({ icon: Icon, title, description, onClick, side }) {
  const t = TOKENS[side];
  return (
    <button
      onClick={onClick}
      className={`group flex w-full items-center gap-4 rounded-lg border border-slate-200 bg-slate-50/60 px-4 py-3 text-left transition-all hover:border-slate-300 hover:bg-white ${t.cardHover}`}
    >
      <Icon className={`h-4 w-4 shrink-0 ${t.icon} group-hover:opacity-100 opacity-70`} />
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-semibold text-slate-800">{title}</p>
        <p className="text-[11px] text-slate-500 truncate">{description}</p>
      </div>
      <ArrowRight className={`h-3.5 w-3.5 shrink-0 ${t.icon} opacity-50 transition-transform group-hover:translate-x-1 group-hover:opacity-100`} />
    </button>
  );
}

/* ── Methodology box ────────────────────────────────────────── */
function MethodologyBox({ title, items, side }) {
  const t = TOKENS[side];
  return (
    <div className={`rounded-xl border p-5 ${t.accent}`}>
      <p className={`text-[10px] font-bold uppercase tracking-[0.18em] mb-3 ${side === 'bond' ? 'text-amber-700' : 'text-emerald-700'}`}>
        {title}
      </p>
      <ul className="space-y-2">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-2.5 text-[12px] text-slate-700 leading-relaxed">
            <span className={`mt-1.5 inline-block h-1 w-4 shrink-0 rounded-full ${t.bar}`} />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ── Disclaimer ─────────────────────────────────────────────── */
function Disclaimer({ text, side }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400 mb-1">Disclaimer</p>
      <p className="text-[11px] leading-relaxed text-slate-500">{text}</p>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   BOND LANE HOME  —  amber/slate, 4-step grid
══════════════════════════════════════════════════════════════ */
export function BondLaneHome({ nav, navWithAuth = nav }) {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 md:py-12">
      <LaneAccentBar side="bond" />
      <LaneEyebrow side="bond" />

      <h1 className="mt-3 text-[32px] font-semibold leading-[1.05] tracking-[-0.03em] text-slate-900 md:text-[44px]">
        Bond Readiness
      </h1>
      <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-slate-500">
        Prepare cleaner contractor bond submissions — WIP analysis, document scoring, backlog risk, and surety packet output before a carrier sees the file.
      </p>

      {/* 2×2 grid of steps */}
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <StepCard
          number="01"
          icon={BarChart2}
          title="WIP Analysis"
          description="Backlog, profit fade, overbillings, underbillings, concentration — before the file reaches a carrier."
          cta="Run WIP analysis"
          onClick={() => nav('wipAnalyzer')}
          side="bond"
          featured
        />
        <StepCard
          number="02"
          icon={CheckSquare}
          title="Bond Readiness Score"
          description="Score file completeness, surface stale documents, and see your readiness percentage before submission."
          cta="Check readiness"
          onClick={() => nav('readinessEngine')}
          side="bond"
        />
        <StepCard
          number="03"
          icon={ListChecks}
          title="Submission Workspace"
          description="Track contractor files from intake to handoff — owner, status, next action, missing items."
          cta="Open workspace"
          onClick={() => nav('opsQueue')}
          side="bond"
        />
        <StepCard
          number="04"
          icon={Briefcase}
          title="Surety Packet Builder"
          description="Structured carrier handoff memo with operational-signals watermark. Producer-verified output."
          cta="Build packet"
          onClick={() => navWithAuth('handoffMemos')}
          side="bond"
        />
      </div>

      {/* Free tools row */}
      <div className="mt-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400 mb-2">Free tools</p>
        <SecondaryTool
          icon={ClipboardCheck}
          title="Free WIP Audit Tool"
          description="Instantly check if your WIP schedule will trigger a carrier inquiry — free, no login required."
          onClick={() => nav('wipAudit')}
          side="bond"
        />
      </div>

      {/* Professional Plan CTA */}
      <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50/60 p-5 flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-amber-600">Professional Plan</p>
          <p className="mt-1 text-[16px] font-bold text-slate-900">Unlock full bond workflow access</p>
          <p className="mt-1 text-[13px] text-slate-600">WIP analysis, surety packet builder, and submission workspace — $15/mo. No setup fee.</p>
        </div>
        <button
          onClick={() => nav('pricing')}
          className="inline-flex h-10 shrink-0 items-center gap-2 rounded-lg bg-amber-500 px-5 text-[13px] font-bold text-white transition-colors hover:bg-amber-600"
        >
          View pricing
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>

      {/* Methodology */}
      <div className="mt-8">
        <MethodologyBox
          side="bond"
          title="How WIP analysis works"
          items={[
            'Backlog vs aggregate work program — single-job concentration (carrier comfort: ≤25% of equity)',
            'Profit fade: original estimated GP vs current revised estimated GP per job',
            'Billing position: billed-to-date vs earned-to-date, overbilling and underbilling exposure',
            'Outputs show methodology — no black-box scoring',
          ]}
        />
      </div>

      {/* Disclaimer */}
      <div className="mt-4">
        <Disclaimer
          side="bond"
          text="BondSBA flags operational signals — margin fade, concentration, working-capital adequacy — to support producer review. Not CPA-attested. Not an insurance product. Does not place or broker bonds. Outputs require producer sign-off before carrier handoff."
        />
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   SBA LANE HOME  —  navy palette, 3-step column + secondary
══════════════════════════════════════════════════════════════ */
export function SBALaneHome({ nav, navWithAuth = nav, user = null, onSignIn }) {
  const [openFaq, setOpenFaq] = useState(null);
  const FAQ = [
    {
      q: 'Who qualifies for an SBA 7(a) loan?',
      a: 'Most for-profit US small businesses qualify if they meet SBA size standards, operate in an eligible industry, have a demonstrated need for credit, and intend to use proceeds for legitimate business purposes. Passive businesses, lenders, and certain non-profits are excluded.',
    },
    {
      q: 'What is the SBA guaranty fee and how is it calculated?',
      a: 'The SBA charges a one-time guaranty fee based on the guaranteed portion of the loan (typically 75–85% of the loan amount) and the loan term. For loans over $150K, the FY2026 fee is 0% for terms ≤12 months, 2% for loans up to $700K, 3% for loans $700K–$5M. Small loans and veteran-owned businesses may qualify for fee waivers.',
    },
    {
      q: 'What documents do I need for an SBA loan?',
      a: 'Most lenders require 2–3 years of business and personal tax returns, year-to-date financial statements, a business plan or use-of-proceeds statement, personal financial statement (SBA Form 413), and any existing business debt schedule. Our checklist tool generates the full list specific to your situation.',
    },
    {
      q: 'What is the difference between SBA 7(a) and SBA 504?',
      a: 'SBA 7(a) is general-purpose — working capital, equipment, acquisitions. SBA 504 is for major fixed assets like commercial real estate or large equipment. 504 loans are structured as bank / CDC / equity splits and typically carry lower long-term rates but require 10% borrower equity.',
    },
    {
      q: 'How long does SBA loan approval take?',
      a: 'Preferred Lender Program (PLP) lenders can approve in 2–5 business days. Standard processing through the SBA takes 5–10 business days after a complete application. Total closing (including lender review) typically runs 30–90 days depending on collateral and complexity.',
    },
  ];

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 md:py-12">

      {/* Hero — navy gradient banner */}
      <div className="rounded-2xl bg-gradient-to-br from-[#0B1F3A] to-[#12365F] px-6 py-8 md:px-10 md:py-10 mb-8 shadow-[0_12px_40px_rgba(11,31,58,0.22)]">
        {/* Powered-by badge */}
        <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1">
          <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-blue-200">From the makers of BondSBA</span>
        </div>

        <h1 className="text-[28px] font-bold leading-[1.06] tracking-[-0.03em] text-white md:text-[40px]">
          SBA Loan Eligibility Screener &amp; Calculator for Brokers
        </h1>
        <p className="mt-3 max-w-[48ch] text-[16px] leading-relaxed text-blue-100/80">
          Screen eligibility, build the document file, and calculate the deal — hard stops surface at intake before a lender opens the file.
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            onClick={() => nav('screener')}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-white px-5 text-[13px] font-bold text-[#0B1F3A] shadow transition-colors hover:bg-blue-50"
          >
            <CheckSquare className="h-4 w-4" />
            Run Eligibility Screener
          </button>
          <button
            onClick={() => nav('guarantyFee')}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-white/30 bg-white/10 px-5 text-[13px] font-semibold text-white transition-colors hover:bg-white/20"
          >
            <Calculator className="h-4 w-4" />
            Guaranty Fee Calculator
          </button>
        </div>
      </div>

      {/* 3-step linear flow — horizontal on desktop */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <StepCard
          number="01"
          icon={CheckSquare}
          title="Screen Eligibility"
          description="Find out in minutes if you qualify — before spending time on paperwork."
          cta="Run eligibility check"
          onClick={() => nav('screener')}
          side="sba"
          featured
        />
        <StepCard
          number="02"
          icon={FileText}
          title="Build Your Document Checklist"
          description="Know exactly what your lender needs — SBA-required docs, nothing missing."
          cta="Open checklist"
          onClick={() => nav('checklist')}
          side="sba"
        />
        <StepCard
          number="03"
          icon={Calculator}
          title="Calculate the Deal"
          description="See monthly payment, guaranty fee, and deal terms before talking to a lender."
          cta="Open calculator"
          onClick={() => nav('calculatorLanding')}
          side="sba"
        />
      </div>

      {/* Single trust line */}
      <p className="mt-4 text-[12px] text-slate-400 text-center">
        Methodology shown at every step — size standard, ownership, and use-of-proceeds checks. No scoring ambiguity.
      </p>

      <AdSenseSlot placement="inFeed" className="my-6 rounded-sm" />

      {/* ── Save nudge (unauthenticated) ── */}
      {!user && (
        <div className="mt-4 flex items-center justify-between gap-4 rounded-xl border border-[#0B1F3A]/15 bg-[#0B1F3A]/[0.03] px-5 py-4 flex-wrap">
          <div>
            <p className="text-[13px] font-semibold text-slate-900">Save your eligibility results</p>
            <p className="text-[12px] text-slate-500 mt-0.5">Sign in to keep your screener output and document checklist. Free, no card needed.</p>
          </div>
          <button
            onClick={onSignIn}
            className="cursor-pointer inline-flex h-9 shrink-0 items-center gap-2 rounded-lg bg-[#0B1F3A] px-4 text-[13px] font-semibold text-white transition-colors hover:bg-[#12365F]"
          >
            Save results
          </button>
        </div>
      )}

      <AdSenseSlot placement="landingMid" className="my-4 rounded-sm" compact />

      {/* Additional tools — card grid, prominent */}
      <div className="mt-6">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400 mb-3">More SBA tools</p>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">

          {/* Guaranty Fee Calculator — featured */}
          <button
            onClick={() => nav('guarantyFee')}
            className="group col-span-full md:col-span-2 flex flex-col min-h-[180px] rounded-xl border border-[#0B1F3A]/15 bg-white p-6 text-left shadow-sm hover:border-[#0B1F3A]/30 hover:shadow-md transition-all"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#0B1F3A]">
                <Calculator className="h-5 w-5 text-white" />
              </div>
              <span className="rounded-full bg-[#0B1F3A] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">New</span>
            </div>
            <h3 className="text-[16px] font-bold text-[#0B1F3A]">SBA 7(a) Guaranty Fee Calculator FY2026</h3>
            <p className="mt-1.5 flex-1 text-[13px] leading-relaxed text-slate-600">Calculate upfront guaranty fee and annual service fee instantly — FY2026 fee schedule, 7(a) tiers, and guaranteed portion breakdown.</p>
            <span className="mt-4 inline-flex items-center gap-1 text-[12px] font-semibold text-[#0B1F3A]">
              Calculate fee
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
            </span>
          </button>

          <button
            onClick={() => nav('sba504')}
            className="group flex flex-col min-h-[180px] rounded-xl border border-[#0B1F3A]/10 bg-white p-6 text-left shadow-sm hover:border-[#0B1F3A]/25 hover:shadow-md transition-all"
          >
            <Landmark className="h-5 w-5 text-[#1a3a6b] mb-3" />
            <h3 className="text-[14px] font-bold text-[#0B1F3A]">SBA 504 Calculator</h3>
            <p className="mt-1.5 flex-1 text-[12px] leading-relaxed text-slate-600">Bank / CDC / equity split + FY2026 fees for fixed-asset projects.</p>
            <span className="mt-4 inline-flex items-center gap-1 text-[12px] font-semibold text-[#1a3a6b]">
              Open <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
            </span>
          </button>

          <button
            onClick={() => nav('compare')}
            className="group flex flex-col min-h-[180px] rounded-xl border border-[#0B1F3A]/10 bg-white p-6 text-left shadow-sm hover:border-[#0B1F3A]/25 hover:shadow-md transition-all"
          >
            <TrendingUp className="h-5 w-5 text-[#1a3a6b] mb-3" />
            <h3 className="text-[14px] font-bold text-[#0B1F3A]">Program Comparison</h3>
            <p className="mt-1.5 flex-1 text-[12px] leading-relaxed text-slate-600">7(a) vs 504 vs Express — structures, limits, and use cases side by side.</p>
            <span className="mt-4 inline-flex items-center gap-1 text-[12px] font-semibold text-[#1a3a6b]">
              Compare <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
            </span>
          </button>

          <button
            onClick={() => nav('feeWaiverCalc')}
            className="group flex flex-col min-h-[180px] rounded-xl border border-[#0B1F3A]/10 bg-white p-6 text-left shadow-sm hover:border-[#0B1F3A]/25 hover:shadow-md transition-all"
          >
            <div className="flex items-center gap-2 mb-3">
              <Tag className="h-5 w-5 text-[#1a3a6b]" />
              <span className="rounded-full bg-[#0B1F3A] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">Fee Savings</span>
            </div>
            <h3 className="text-[14px] font-bold text-[#0B1F3A]">FY2026 Manufacturer Fee Waiver</h3>
            <p className="mt-1.5 flex-1 text-[12px] leading-relaxed text-slate-600">See exactly how much you save on SBA guaranty fees as a manufacturer — plus download your term sheet.</p>
            <span className="mt-4 inline-flex items-center gap-1 text-[12px] font-semibold text-[#1a3a6b]">
              Calculate savings <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
            </span>
          </button>

          <button
            onClick={() => nav('ebitdaDscr')}
            className="group flex flex-col min-h-[180px] rounded-xl border border-[#0B1F3A]/10 bg-white p-6 text-left shadow-sm hover:border-[#0B1F3A]/25 hover:shadow-md transition-all"
          >
            <div className="flex items-center gap-2 mb-3">
              <Activity className="h-5 w-5 text-[#1a3a6b]" />
              <span className="rounded-full bg-[#0B1F3A] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">Free Tool</span>
            </div>
            <h3 className="text-[14px] font-bold text-[#0B1F3A]">EBITDA &amp; DSCR Calculator</h3>
            <p className="mt-1.5 flex-1 text-[12px] leading-relaxed text-slate-600">Calculate your adjusted cash flow and debt service coverage ratio — the numbers lenders actually use.</p>
            <span className="mt-4 inline-flex items-center gap-1 text-[12px] font-semibold text-[#1a3a6b]">
              Open calculator <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
            </span>
          </button>

        </div>
      </div>

      {/* Cross-link to BondSBA bond side — authority callout */}
      <div className="mt-6 rounded-xl border border-[#0B1F3A]/20 bg-gradient-to-r from-[#0B1F3A]/[0.04] to-slate-50/60 p-5">
        <div className="flex items-center gap-3 mb-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#0B1F3A]">
            <Shield className="h-4 w-4 text-white" />
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#0B1F3A]/60">Also from BondSBA</p>
            <p className="text-[14px] font-bold text-slate-900">Contractor surety bond file prep</p>
          </div>
        </div>
        <p className="text-[13px] leading-relaxed text-slate-500 mb-4">
          WIP risk scoring, bond readiness check, missing-document flags, and structured carrier packet — built for the step before underwriting.
        </p>
        <a
          href="https://bondsba.com"
          target="_blank"
          rel="noopener noreferrer"
          className="cursor-pointer inline-flex w-full sm:w-auto h-9 items-center justify-center gap-2 rounded-lg border border-[#0B1F3A]/30 bg-[#0B1F3A] px-4 text-[13px] font-semibold text-white transition-colors hover:bg-[#12365F]"
        >
          Go to BondSBA.com
          <ArrowRight className="h-3.5 w-3.5" />
        </a>
      </div>

      {/* FAQ — SEO section */}
      <section className="mt-8">
        <h2 className="text-[20px] font-bold tracking-[-0.02em] text-slate-900">Frequently asked SBA loan questions</h2>
        <p className="mt-1 text-[13px] text-slate-500">Common questions from brokers and borrowers before the application starts.</p>
        <div className="mt-4 divide-y divide-slate-200 rounded-xl border border-slate-200 overflow-hidden">
          {FAQ.map((item, i) => (
            <div key={i} className="bg-white">
              <button
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
              >
                <span className="text-[14px] font-semibold text-slate-900">{item.q}</span>
                {openFaq === i
                  ? <ChevronUp className="h-4 w-4 shrink-0 text-[#1a3a6b]" />
                  : <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
                }
              </button>
              {openFaq === i && (
                <div className="px-5 pb-4">
                  <p className="text-[13px] leading-relaxed text-slate-600">{item.a}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Disclaimer */}
      <div className="mt-6">
        <Disclaimer
          side="sba"
          text="SBA eligibility determinations are made by lenders and the SBA. ClearPath tools are decision-support aids — not legal or lending determinations. Methodology shown at every step. Powered by BondSBA."
        />
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   SBA GUARANTY PAGE  (standalone detail view)
══════════════════════════════════════════════════════════════ */
export function SBAGuarantyPage({ nav, navWithAuth = nav }) {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 md:py-14">
      <LaneEyebrow side="sba" />
      <h1 className="mt-3 text-[32px] font-semibold leading-[1.05] tracking-[-0.03em] text-slate-900 md:text-[42px]">
        Prepare a cleaner SBA guaranty-backed loan submission.
      </h1>
      <p className="mt-4 max-w-2xl text-[16px] leading-relaxed text-slate-600">
        Organize borrower information, ownership details, repayment support, use of proceeds, and required documents before a lender reviews the file.
      </p>
      <div className="mt-10 space-y-10">
        <section>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">1 — What it is</p>
          <h2 className="mt-2 text-[22px] font-semibold tracking-[-0.02em] text-slate-900">What is SBA guaranty readiness?</h2>
          <p className="mt-3 text-[14px] leading-relaxed text-slate-600">
            SBA guaranty readiness is a pre-submission check that surfaces missing items, stale documents, and eligibility gaps before a lender opens the file. The goal is fewer back-and-forths.
          </p>
        </section>
        <section>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">2 — What you get</p>
          <h2 className="mt-2 text-[22px] font-semibold tracking-[-0.02em] text-slate-900">Readiness score with missing-item detail</h2>
          <p className="mt-3 text-[14px] leading-relaxed text-slate-600">
            Each document category is scored. Missing or stale items are flagged. Outputs include a structured list of what's complete, what's missing, and what needs updating.
          </p>
        </section>
        <section>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">3 — Output</p>
          <h2 className="mt-2 text-[22px] font-semibold tracking-[-0.02em] text-slate-900">Exportable lender packet</h2>
          <p className="mt-3 text-[14px] leading-relaxed text-slate-600">
            Export a structured readiness summary ready for lender review. Methodology shown — not black-box.
          </p>
        </section>
        <section className="rounded-xl border border-slate-200 bg-slate-50 p-5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Disclaimer</p>
          <p className="mt-2 text-[12px] leading-relaxed text-slate-600">
            Operational signals only. Not CPA-attested. BondSBA is independent of any surety carrier and does not place, sell, or broker bonds. Carrier appetite indicators are directional based on public market positioning.
          </p>
        </section>
        <div>
          <button
            onClick={() => nav('screener')}
            className="inline-flex h-12 items-center justify-center rounded-md bg-[#0B1F3A] px-6 text-[15px] font-semibold text-white shadow-[0_8px_22px_-6px_rgba(11,31,58,0.4)] hover:bg-[#12365F]"
          >
            Start eligibility screening
          </button>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   BOND WIP ANALYSIS PAGE  (standalone detail view)
══════════════════════════════════════════════════════════════ */
export function BondWipAnalysisPage({ nav, navWithAuth = nav }) {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 md:py-14">
      <LaneEyebrow side="bond" />
      <h1 className="mt-3 text-[32px] font-semibold leading-[1.05] tracking-[-0.03em] text-slate-900 md:text-[42px]">
        WIP analysis before a carrier sees the file.
      </h1>
      <p className="mt-4 max-w-2xl text-[16px] leading-relaxed text-slate-600">
        Surface backlog risk, profit fade, and billing position issues before the file reaches a surety carrier.
      </p>
      <div className="mt-10 space-y-10">
        <section>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">1 — What it is</p>
          <h2 className="mt-2 text-[22px] font-semibold tracking-[-0.02em] text-slate-900">Work-in-progress schedule review</h2>
          <p className="mt-3 text-[14px] leading-relaxed text-slate-600">
            A WIP schedule review pulls backlog, progress billing, and gross profit data from your contractor's schedule and flags concentration, fade, and billing risk before carrier submission.
          </p>
        </section>
        <section>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">2 — What we check</p>
          <ul className="mt-3 space-y-2">
            {[
              'Backlog concentration — single-job share of equity',
              'Profit fade — original vs revised estimated GP per job',
              'Billing position — overbillings and underbillings exposure',
              'Missing support — jobs without updated schedules',
            ].map((item) => (
              <li key={item} className="flex items-start gap-2">
                <span className="mt-2 inline-block h-1 w-3 shrink-0 rounded-sm bg-amber-400" />
                <span className="text-[14px] leading-relaxed text-slate-600">{item}</span>
              </li>
            ))}
          </ul>
        </section>
        <section>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">3 — Output</p>
          <h2 className="mt-2 text-[22px] font-semibold tracking-[-0.02em] text-slate-900">Exportable surety packet</h2>
          <p className="mt-2 text-[14px] leading-relaxed text-slate-600">
            Producer signs off on extracted data. Output is a structured handoff memo with operational-signals-only watermark and verification date. Format aligns to US carrier conventions.
          </p>
        </section>
        <section className="rounded-xl border border-slate-200 bg-slate-50 p-5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Disclaimer</p>
          <p className="mt-2 text-[12px] leading-relaxed text-slate-600">
            Operational signals only. Not CPA-attested. BondSBA is independent of any surety carrier and does not place, sell, or broker bonds. Carrier appetite indicators are directional based on public market positioning.
          </p>
        </section>
        <div>
          <button
            onClick={() => navWithAuth('wipAnalyzer')}
            className="inline-flex h-12 items-center justify-center rounded-md bg-amber-700 px-6 text-[15px] font-semibold text-white shadow-[0_8px_22px_-6px_rgba(120,53,15,0.45)] hover:bg-amber-800"
          >
            Analyze a WIP Schedule
          </button>
        </div>
      </div>
    </div>
  );
}
