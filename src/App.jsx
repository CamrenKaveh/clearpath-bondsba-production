import React, { Suspense, lazy, useState, useMemo, useEffect, useRef } from 'react';
import {
  Shield, FileText, Activity, AlertCircle, AlertTriangle,
  Download, Clock, Menu, X,
  Layers, CheckSquare, Info, MessageSquare,
  Landmark, Calculator, Loader2, Copy, Check,
  CheckCircle, XCircle, Factory, Briefcase, Users, Printer, ExternalLink,
  ChevronRight, ArrowRight, LogOut, LogIn, Building2
} from 'lucide-react';
import {
  getAuthToken,
} from './shared/utils/supabaseClient';
import { useAuth } from './auth/useAuth';
import { AuthModal } from './auth/AuthModal';

import { exportTermSheetPDF, exportTermSheetHTML, printTermSheet } from './shared/utils/pdfExport';
import { SEO_LANDING_CONTENT, PAGE_STRUCTURED_DATA } from './data/seoContent.js';
import { SCREENER_QUESTIONS } from './data/screenerData.js';
import { PROGRAMS } from './data/programs.js';
import { calculateSBA7aGuarantyFee, calculateSBA504Project } from './domains/sba-loans/services/loanCalculator.js';
import { buildClientHandoffPackage } from './domains/sba-loans/services/termSheetGenerator.js';
import { JURISDICTIONS, findJurisdiction, findRegion } from './data/jurisdictions.js';
import { SuretyMetricsPanel } from './components/SuretyMetrics.jsx';
import { useScrollReveal } from './shared/hooks/useScrollReveal.js';
import { ReceptionDesk } from './components/ReceptionDesk.jsx';
import { SBALaneHome, BondLaneHome, SBAGuarantyPage, BondWipAnalysisPage } from './components/LanePages.jsx';
import AdSenseSlot, { ADSENSE_CLIENT, getStoredAdConsent, setConsentCookie, loadAdSenseScript, configureAutoAds } from './components/AdSlot.jsx';
import PremiumForm, { PremiumRadioOption, PremiumCheckboxOption, PremiumInput, PremiumSelect } from './domains/sba-loans/components/PremiumForm';
import { SuretyClient } from './domains/surety/api/suretyClient';
import {
  AppShell,
  BeforeAfterPanel,
  ContractorProfileHeader,
  DashboardMockup,
  EmptyState,
  FilterBar,
  HandoffMemoPreview,
  MarketingShell,
  OperationalAlert,
  ProductModuleCard,
  ProfessionalDisclaimer,
  ReadinessChecklist,
  ScoreCard,
  SectionHeader,
  SidebarNav,
  StatusChip,
  SubmissionTable,
  TopSearchBar,
  TrustPills,
  WorkflowTaskList,
  WorkflowStepper,
} from './components/opsDesignSystem';
import {
  ContractorFileInputPanel,
  DEFAULT_FILE_PREP_STATE,
  evaluateFilePrepState,
  ReadinessOutputPanel,
  useFilePrepSummaryRow,
} from './components/filePrepWorkflow';
import {
  BillingSettingsPage,
  BillingSuccessPage,
  PricingPage,
  ClearPathPricingPage,
  UpgradePrompt,
} from './components/billingExperience';
import { EmbeddedCheckoutPage } from './components/EmbeddedCheckout.jsx';

// AdSense inventory is configured in AdSlot.jsx with VITE_GOOGLE_ADSENSE_CLIENT,
// enable_page_level_ads: true, requestNonPersonalizedAds, data-ad-slot, and
// VITE_ADSENSE_SLOT_LANDING_TOP / VITE_ADSENSE_SLOT_LANDING_SIDEBAR env vars.

// ── User Profile Component ──
import { UserProfile } from './components/UserProfile';

const TermSheetTemplate = lazy(() => import('./domains/sba-loans/components/TermSheetTemplate'));
const GenerativeFeatures = lazy(() => import('./domains/sba-loans/components/GenerativeFeatures'));
const SuretyDashboard = lazy(() => import('./domains/surety/components/SuretyDashboard'));
const SpreadingEngine = lazy(() => import('./domains/surety/components/SpreadingEngine'));
const WIPAnalyzerModule = lazy(() => import('./domains/surety/components/WIPAnalyzer'));
const WipAuditTool = lazy(() => import('./domains/surety/components/WipAuditTool'));
const FeeWaiverCalculator = lazy(() => import('./domains/sba-loans/components/FeeWaiverCalculator'));
const EbitdaDscrEngine = lazy(() => import('./domains/sba-loans/components/EbitdaDscrEngine.jsx'));
const PrincipalInterestChart = lazy(() => import('./domains/sba-loans/components/AmortizationCharts').then(m => ({ default: m.PrincipalInterestChart })));
const RemainingBalanceChart = lazy(() => import('./domains/sba-loans/components/AmortizationCharts').then(m => ({ default: m.RemainingBalanceChart })));

// ── Authenticated API Call Helper ──
// Attaches a Bearer token when the user is signed in.
// If no session exists, the request goes through without auth (endpoints that
// require auth will return 401 with a clear message rather than crashing here).
async function fetchAPI(endpoint, method = 'GET', body = null) {
  const token = await getAuthToken().catch(() => null);

  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
  };

  const options = {
    method,
    headers,
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const res = await fetch(endpoint, options);

  if (!res.ok) {
    if (res.status === 401) {
      throw new Error('Authentication failed. Please sign in again.');
    }
    if (res.status === 403) {
      throw new Error('Permission denied. Your account does not have access to this feature.');
    }
    const error = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(error.error || error.message || `Request failed with status ${res.status}`);
  }

  return await res.json();
}

// ── AI via Vercel serverless — Claude claude-opus-4-7 (adaptive thinking, prompt caching) ──
async function fetchAI(prompt, systemInstruction = '', jsonMode = false) {
  // Exponential backoff: 1s, 3s, 8s. Rate-limit responses (429) get a longer 10s pause.
  const delays = [1000, 3000, 8000];
  for (let i = 0; i <= delays.length; i++) {
    try {
      const token = await getAuthToken().catch(() => null);
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ prompt, systemInstruction, jsonMode }),
      });
      if (res.status === 429) {
        // Rate limited — back off longer before retrying
        if (i === delays.length) throw new Error('Rate limit reached. Please wait a moment and try again.');
        await new Promise(r => setTimeout(r, 10000));
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      return data.result;
    } catch (err) {
      if (i === delays.length) throw new Error('AI service unavailable. Please retry.');
      await new Promise(r => setTimeout(r, delays[i]));
    }
  }
}

// ── Institutional Design Tokens ──
// Primary: Banking Navy #1B3A6B / Deep Navy #0A2540
// Accent actions only — no decorative color
const T = {
  card:        'bg-white border border-slate-200 rounded-xl shadow-[0_8px_24px_rgba(15,23,42,0.06)]',
  cardHover:   'bg-white border border-slate-200 hover:border-[#1B3A6B] rounded-xl shadow-[0_8px_24px_rgba(15,23,42,0.06)] hover:shadow-[0_12px_30px_rgba(15,23,42,0.10)] transition-all duration-150',
  input:       'w-full bg-white border border-slate-300 rounded-lg px-3 py-2.5 text-base text-slate-900 tabular-nums focus:outline-none focus:ring-2 focus:ring-[#1B3A6B]/20 focus:border-[#1B3A6B] transition-colors duration-150',
  label:       'block text-[12px] font-semibold text-slate-700 uppercase tracking-wide mb-1',
  btnPrimary:  'inline-flex items-center gap-2 rounded-lg bg-[#0B1F3A] hover:bg-[#12365F] text-white font-semibold text-sm px-4 py-2.5 border border-[#0B1F3A] shadow-[0_6px_18px_rgba(11,31,58,0.22)] transition-colors duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed',
  btnSecondary:'inline-flex items-center gap-2 bg-white hover:bg-slate-100 text-slate-900 font-semibold text-sm px-4 py-2.5 rounded-lg border border-slate-300 transition-colors duration-150 cursor-pointer disabled:opacity-50',
  btnGhost:    'inline-flex items-center gap-2 hover:bg-slate-100 text-slate-700 hover:text-slate-900 font-medium text-sm px-3 py-2 rounded-md transition-colors duration-150 cursor-pointer',
  sectionHead: 'text-xl font-bold text-slate-900',
  sectionHeadLarge: 'text-[2rem] font-bold text-slate-900',
  sectionHeadAlt: 'text-2xl font-bold text-[#1B3A6B]',
  kpiLabel:    'text-xs font-semibold text-slate-300 uppercase tracking-wide mb-1',
  kpiValue:    'text-[1.7rem] font-bold tabular-nums text-white',
  dataLabel:   'text-[11px] font-semibold text-slate-600 uppercase tracking-wide',
  dataValue:   'text-sm tabular-nums font-semibold text-slate-900',
  th:          'py-3 px-4 text-xs font-semibold text-white uppercase tracking-wide text-left',
  td:          'py-3 px-4 text-sm tabular-nums text-slate-800',
};

function ModuleFallback({ label = 'Loading workspace…' }) {
  return (
    <div className="border border-slate-300 bg-white p-6 flex items-center gap-3 text-sm text-slate-700">
      <Loader2 className="w-4 h-4 animate-spin text-slate-500" />
      <span>{label}</span>
    </div>
  );
}

const EDUCATIONAL_AD_PAGES = new Set(['home', 'contractorReadiness', 'requirements', 'documentsLanding', 'calculatorLanding', 'surety']);
const COMPLIANCE_DISCLAIMER = 'BondSBA provides workflow infrastructure, operational analysis, and readiness support tools for finance and surety professionals. Outputs require professional review and do not replace underwriting, lending, accounting, legal, or surety decisions.';

function trackEvent(name, payload = {}) {
  if (typeof window === 'undefined') return;
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ event: name, ...payload });
}


function AdConsentBanner({ visible = true }) {
  const [choice, setChoice] = useState(() => getStoredAdConsent());

  useEffect(() => {
    if (choice !== 'accepted' && choice !== 'rejected') return;
    loadAdSenseScript(ADSENSE_CLIENT);
    configureAutoAds(ADSENSE_CLIENT, choice);
  }, [choice]);

  const saveConsent = (value) => {
    setConsentCookie(value);
    // Notify AdSenseSlot components on this page to re-read the cookie.
    window.dispatchEvent(new Event('ad-consent-updated'));
    window.dispatchEvent(new Event('bondsba-ad-consent'));
    setChoice(value);
  };

  if (!visible || choice !== 'unknown') return null;

  const siteName = isClearpathDomain() ? 'ClearPath' : 'BondSBA';

  return (
    <div className="fixed bottom-4 right-4 z-50 w-[min(92vw,400px)] rounded-xl border border-slate-200 bg-white shadow-2xl">
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <p className="text-[13px] font-semibold text-slate-900">Cookie preferences</p>
          <button
            onClick={() => saveConsent('rejected')}
            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Decline and close"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        <p className="mt-1.5 text-[13px] text-slate-600 leading-relaxed">
          {siteName} uses cookies to serve ads that keep our free tools free. You can choose personalized or contextual-only ads.
        </p>
        <div className="mt-3 flex items-center gap-2">
          <button
            onClick={() => saveConsent('rejected')}
            className="inline-flex h-9 flex-1 items-center justify-center rounded-lg border border-slate-300 bg-white px-3 text-[13px] font-medium text-slate-700 hover:bg-slate-50"
          >
            Contextual only
          </button>
          <button
            onClick={() => saveConsent('accepted')}
            className="inline-flex h-9 flex-1 items-center justify-center rounded-lg bg-[#0B1F3A] px-3 text-[13px] font-semibold text-white hover:bg-[#12365F]"
          >
            Accept cookies
          </button>
        </div>
        <p className="mt-2.5 text-[11px] text-slate-400">
          Saved as a cookie for 1 year. Change anytime by clearing site cookies.
        </p>
      </div>
    </div>
  );
}

// ── Term Sheet Preview Modal ──
function TermSheetModal({ data, onClose }) {
  const handlePrintTermSheet = () => {
    const element = document.getElementById('term-sheet-printable');
    if (element) {
      printTermSheet(element);
    }
  };

  const handleExportPDF = () => {
    const element = document.getElementById('term-sheet-printable');
    if (element) {
      exportTermSheetPDF(element, 'bondsba-terminal-term-sheet.pdf');
    }
  };

  const handleExportHTML = () => {
    const element = document.getElementById('term-sheet-printable');
    if (element) {
      exportTermSheetHTML(element, 'bondsba-terminal-term-sheet.html');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/80 overflow-y-auto">
      <div className="bg-[#0A2540] border-b border-[#1B3A6B] sticky top-0 px-4 py-3 flex items-center justify-between shrink-0">
        <span className="text-white text-xs font-bold uppercase tracking-wide">Professional Term Sheet</span>
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrintTermSheet}
            className={T.btnSecondary + ' text-xs px-3 py-1.5'}
            aria-label="Print term sheet"
          >
            <Printer className="w-3.5 h-3.5" /> Print
          </button>
          <button
            onClick={handleExportPDF}
            className={T.btnPrimary + ' text-xs px-3 py-1.5'}
            aria-label="Download as PDF"
          >
            <Download className="w-3.5 h-3.5" /> PDF
          </button>
          <button
            onClick={handleExportHTML}
            className={T.btnSecondary + ' text-xs px-3 py-1.5'}
            aria-label="Download as HTML for editing"
          >
            <Download className="w-3.5 h-3.5" /> HTML
          </button>
          <button
            onClick={onClose}
            className="ml-2 text-slate-300 hover:text-white transition-colors duration-150 cursor-pointer"
            aria-label="Close term sheet"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
      <div className="flex-1 w-full bg-white overflow-y-auto">
        <div className="max-w-8.5in mx-auto p-8">
          <Suspense fallback={<ModuleFallback label="Loading term sheet…" />}>
            {data && <TermSheetTemplate data={data} />}
          </Suspense>
        </div>
      </div>
    </div>
  );
}

// ── Static data ──
const PAGE_CONFIG = {
  home: {
    path: '/',
    title: 'BondSBA Terminal | Cleaner Contractor Submissions Before Underwriting',
    description: 'BondSBA Terminal helps brokers, CPAs, and surety teams turn incomplete contractor files into cleaner SBA and surety submissions before they hit underwriting.',
    ogTitle: 'BondSBA Terminal — Cleaner Contractor Submissions Before Underwriting',
    robots: 'index, follow',
  },
  requirements: {
    path: '/sba-loan-requirements',
    title: 'SBA Loan Requirements | BondSBA Terminal',
    description: 'Review the main SBA loan requirements, including operating history, credit, equity, guarantor support, and use-of-proceeds rules before packaging a submission.',
    ogTitle: 'SBA Loan Requirements — BondSBA Terminal',
    robots: 'index, follow',
  },
  documentsLanding: {
    path: '/sba-loan-documents',
    title: 'SBA Loan Documents Checklist | BondSBA Terminal',
    description: 'Learn which SBA loan documents are commonly required, from tax returns and interim financials to debt schedules, entity documents, and use-of-proceeds support.',
    ogTitle: 'SBA Loan Documents — BondSBA Terminal',
    robots: 'index, follow',
  },
  calculatorLanding: {
    path: '/sba-7a-calculator',
    title: 'SBA Guaranty Fee Calculator + 7(a) Loan Guide | BondSBA Terminal',
    description: 'Estimate SBA guaranty fee, payment, term, rate, and amortization with a practical SBA 7(a) calculator guide before submission.',
    ogTitle: 'SBA 7(a) Calculator — BondSBA Terminal',
    robots: 'index, follow',
  },
  sba504: {
    path: '/sba-504-loans',
    title: 'SBA 504 Calculator | BondSBA Terminal',
    description: 'Estimate SBA 504 bank, CDC, borrower injection, payment, and FY2026 fee treatment before packaging a fixed-asset financing request.',
    ogTitle: 'SBA 504 Calculator — BondSBA Terminal',
    robots: 'index, follow',
  },
  calculator: {
    path: '/sba-loan-calculator',
    title: 'SBA Loan Calculator | BondSBA Terminal',
    description: 'Use BondSBA Terminal to estimate SBA 7(a) payments, debt service, fee waivers, amortization schedules, and financing scenarios for partner submissions.',
    ogTitle: 'SBA Loan Calculator — BondSBA Terminal',
    robots: 'noindex, nofollow',
  },
  screener: {
    path: '/sba-eligibility-screener',
    title: 'SBA Eligibility Screener | BondSBA Terminal',
    description: 'Screen SBA financing opportunities against operating history, credit, use of proceeds, and eligibility factors before partner review.',
    ogTitle: 'SBA Eligibility Screener — BondSBA Terminal',
    robots: 'index, follow',
  },
  checklist: {
    path: '/sba-document-checklist',
    title: 'SBA Document Checklist | BondSBA Terminal',
    description: 'Generate a clean SBA document checklist for borrower submissions, entity documents, tax returns, financials, and use-of-proceeds support.',
    ogTitle: 'SBA Document Checklist — BondSBA Terminal',
    robots: 'index, follow',
  },
  compare: {
    path: '/sba-program-comparison',
    title: 'SBA 7(a) vs 504 vs Express | BondSBA Terminal',
    description: 'Compare SBA 7(a), SBA 504, and SBA Express structures, rates, terms, limits, and use cases inside BondSBA Terminal.',
    ogTitle: 'SBA Program Comparison — BondSBA Terminal',
    robots: 'index, follow',
  },
  opsQueue: {
    path: '/workspace',
    title: 'Submission Ops Queue | BondSBA Terminal',
    description: 'Run a practical submission operations queue for brokers, CPAs, and surety teams with priority scoring, ownership handoff, and repeat-ready workflow cadence.',
    ogTitle: 'Submission Ops Queue — BondSBA Terminal',
    robots: 'index, follow',
  },
  readinessEngine: {
    path: '/readiness-engine',
    title: 'Submission Readiness Engine | BondSBA Terminal',
    description: 'Identify missing items, stale documents, and preparation gaps before lender or surety review in the BondSBA readiness engine.',
    ogTitle: 'Submission Readiness Engine — BondSBA Terminal',
    robots: 'noindex, nofollow',
  },
  contractorProfile: {
    path: '/contractor-profile',
    title: 'Contractor Operational Profile | BondSBA Terminal',
    description: 'Centralize contractor operational memory: WIP history, submission history, recurring missing items, and handoff context.',
    ogTitle: 'Contractor Operational Profile — BondSBA Terminal',
    robots: 'noindex, nofollow',
  },
  handoffMemos: {
    path: '/handoff-memo',
    title: 'Handoff Memo Generator | BondSBA Terminal',
    description: 'Create concise lender and surety handoff notes from contractor profile, WIP findings, and missing-item status.',
    ogTitle: 'Handoff Memo Generator — BondSBA Terminal',
    robots: 'noindex, nofollow',
  },
  // ── SBA SIDE ─────────────────────────────────────────────────────────────
  sbaHome: {
    path: '/sba',
    title: 'SBA Guaranty Readiness | BondSBA',
    description: 'Prepare cleaner SBA guaranty-backed loan submissions with eligibility, document checklist, repayment readiness, and lender packet support.',
    ogTitle: 'SBA Guaranty Readiness — BondSBA',
    robots: 'index, follow',
  },
  sbaGuaranty: {
    path: '/sba/guaranty',
    title: 'SBA Loan Guaranty Readiness | BondSBA',
    description: 'Organize borrower information, ownership, repayment support, and use of proceeds for a cleaner SBA guaranty-backed loan submission.',
    ogTitle: 'SBA Guaranty Readiness — BondSBA',
    robots: 'index, follow',
  },
  sbaEligibility: {
    path: '/sba/eligibility',
    title: 'SBA 7(a) Eligibility Screener | BondSBA',
    description: 'Screen borrower SBA 7(a) eligibility on size, ownership, and use of proceeds before a lender opens the file.',
    ogTitle: 'SBA Eligibility — BondSBA',
    robots: 'index, follow',
  },
  sbaDocumentChecklist: {
    path: '/sba/document-checklist',
    title: 'SBA Document Checklist | BondSBA',
    description: 'Lender-ready SBA document checklist: financials, tax returns, debt schedule, business plan, use of proceeds, ownership documents.',
    ogTitle: 'SBA Document Checklist — BondSBA',
    robots: 'index, follow',
  },
  sbaLoanReadiness: {
    path: '/sba/loan-readiness',
    title: 'SBA Loan Readiness Check | BondSBA',
    description: 'Score SBA loan submission readiness, surface missing items, and assess repayment support before lender review.',
    ogTitle: 'SBA Loan Readiness — BondSBA',
    robots: 'index, follow',
  },
  sbaLenderPacket: {
    path: '/sba/lender-packet',
    title: 'SBA Lender Packet Builder | BondSBA',
    description: 'Compile a lender-ready SBA packet with borrower summary, financial highlights, repayment analysis, and supporting documents.',
    ogTitle: 'SBA Lender Packet — BondSBA',
    robots: 'index, follow',
  },
  // ── BOND SIDE ────────────────────────────────────────────────────────────
  bondHome: {
    path: '/bonds',
    title: 'Bond Readiness | BondSBA',
    description: 'Prepare cleaner contractor bond submissions with WIP analysis, missing-document review, backlog risk summaries, and surety packet support.',
    ogTitle: 'Bond Readiness — BondSBA',
    robots: 'index, follow',
  },
  bondWipAnalysis: {
    path: '/bonds/wip-analysis',
    title: 'WIP Schedule Analysis | BondSBA',
    description: 'Analyze WIP backlog, profit fade, overbillings, underbillings, concentration risk, and missing support before surety underwriter review.',
    ogTitle: 'WIP Analysis — BondSBA',
    robots: 'index, follow',
  },
  bondReadiness: {
    path: '/bonds/bond-readiness',
    title: 'Bond Readiness Check | BondSBA',
    description: 'Score contractor bond submission readiness, flag missing items, and review carrier appetite fit before surety underwriting.',
    ogTitle: 'Bond Readiness — BondSBA',
    robots: 'index, follow',
  },
  bondSubmissionChecklist: {
    path: '/bonds/submission-checklist',
    title: 'Bond Submission Checklist | BondSBA',
    description: 'Carrier-ready bond submission checklist: WIP schedule, financials, tax returns, debt schedule, indemnity, and bond request.',
    ogTitle: 'Bond Submission Checklist — BondSBA',
    robots: 'index, follow',
  },
  bondSuretyPacket: {
    path: '/bonds/surety-packet',
    title: 'Surety Packet Builder | BondSBA',
    description: 'Compile a carrier-ready surety packet with contractor profile, WIP analysis, financial highlights, and operational signals.',
    ogTitle: 'Surety Packet — BondSBA',
    robots: 'index, follow',
  },
  guarantyFee: {
    path: '/sba-guaranty-fee-calculator',
    title: 'SBA 7(a) Guaranty Fee Calculator FY2026 | ClearPath',
    description: 'Calculate your SBA 7(a) loan guaranty fee instantly. Free calculator for SBA brokers and lenders. Updated for the FY2026 fee schedule.',
    ogTitle: 'SBA 7(a) Guaranty Fee Calculator FY2026 — ClearPath',
    robots: 'index, follow',
  },
  ebitdaDscr: { id: 'ebitdaDscr', path: '/sba-ebitda-dscr-calculator', title: 'Adjusted DSCR Calculator | ClearPath SBA Loans', description: 'Calculate your EBITDA add-backs and adjusted DSCR for SBA loan approval.' },
  feeWaiverCalc: {
    path: '/sba-manufacturer-fee-waiver',
    title: 'SBA Manufacturer Fee Waiver Calculator FY2026 | ClearPath SBA',
    description: 'Calculate upfront SBA guaranty fee savings for NAICS 31–33 manufacturers. FY2026 waiver active through Sept 30, 2026. Free instant calculator.',
    ogTitle: 'SBA Manufacturer Fee Waiver Calculator FY2026 — ClearPath',
    robots: 'index, follow',
  },
  pricing: {
    path: '/pricing',
    title: 'BondSBA Pricing | Contractor File-Prep Workspace',
    description: 'Plan pricing for contractor file-prep teams: readiness checks, WIP review workflow, and lender/surety handoff operations.',
    ogTitle: 'BondSBA Pricing',
    robots: 'index, follow',
  },
  checkout: {
    path: '/checkout',
    title: 'Checkout | BondSBA',
    description: 'Start your 14-day free trial.',
    ogTitle: 'BondSBA Checkout',
    robots: 'noindex, nofollow',
  },
  billingSuccess: {
    path: '/billing/success',
    title: 'Billing Success | BondSBA',
    description: 'Payment received. Activating your BondSBA workspace subscription.',
    ogTitle: 'Billing Success — BondSBA',
    robots: 'noindex, nofollow',
  },
  billingSettings: {
    path: '/settings/billing',
    title: 'Billing Settings | BondSBA',
    description: 'Manage BondSBA subscription status, usage, and billing controls.',
    ogTitle: 'Billing Settings — BondSBA',
    robots: 'noindex, nofollow',
  },
  integrations: {
    path: '/integrations',
    title: 'Integrations Hub | BondSBA Terminal',
    description: 'Connect email, CRM, AMS, accounting, and drive workflows to reduce re-keying and speed handoff.',
    ogTitle: 'Integrations Hub — BondSBA Terminal',
    robots: 'index, follow',
  },
  roi: {
    path: '/roi-dashboard',
    title: 'ROI Dashboard | BondSBA Terminal',
    description: 'Track cycle-time, rework, and conversion lift from submission-readiness operations.',
    ogTitle: 'ROI Dashboard — BondSBA Terminal',
    robots: 'index, follow',
  },
  trust: {
    path: '/trust-security',
    title: 'Trust & Security | BondSBA Terminal',
    description: 'Review controls, boundaries, and data-handling posture for sensitive workflow data.',
    ogTitle: 'Trust & Security — BondSBA Terminal',
    robots: 'index, follow',
  },
  surety: {
    path: '/surety-underwriting',
    title: 'Surety Underwriting Guide | BondSBA Terminal',
    description: 'Review the fundamentals of surety underwriting, contractor financial strength, WIP analysis, bond support capacity, and submission readiness before moving into the dashboard.',
    ogTitle: 'Surety Underwriting — BondSBA Terminal',
    robots: 'index, follow',
  },
  contractorReadiness: {
    path: '/contractor-submission-readiness',
    title: 'Contractor Submission Readiness | BondSBA Terminal',
    description: 'Prepare contractor financials, WIP, and supporting documents into a cleaner SBA or surety submission before underwriting review.',
    ogTitle: 'Contractor Submission Readiness — BondSBA Terminal',
    robots: 'index, follow',
  },
  suretyDashboard: {
    path: '/surety-dashboard',
    title: 'Surety Dashboard | BondSBA Terminal',
    description: 'Upload and review contractor bond submissions, financial documents, and supporting underwriting analysis inside BondSBA Terminal.',
    ogTitle: 'Surety Dashboard — BondSBA Terminal',
    robots: 'noindex, nofollow',
  },
  spreading: {
    path: '/financial-spreading',
    title: 'Financial Spreading Engine | BondSBA Terminal',
    description: 'Analyze contractor financials, EBITDA, leverage, and underwriting indicators with the BondSBA Terminal spreading engine.',
    ogTitle: 'Financial Spreading Engine — BondSBA Terminal',
    robots: 'noindex, nofollow',
  },
  wip: {
    path: '/wip-review',
    title: 'WIP Review | BondSBA Terminal',
    description: 'Review WIP quality, margin fade, underbilling stress, overbilling exposure, and backlog concentration before handoff.',
    ogTitle: 'WIP Review — BondSBA Terminal',
    robots: 'noindex, nofollow',
  },
  wipAudit: {
    path: '/free-wip-audit',
    title: 'Free Contractor WIP Audit Tool | BondSBA Terminal',
    description: 'Instantly check contractor overbilling and underbilling. Free tool — no account required. Flags carrier risk when underbillings exceed 10% of working capital.',
    ogTitle: 'Free Contractor WIP Audit Tool — BondSBA Terminal',
    robots: 'index, follow',
  },
};

const PATH_TO_PAGE = Object.fromEntries(
  Object.entries(PAGE_CONFIG).map(([pageId, config]) => [config.path, pageId])
);

const PATH_ALIASES = {
  '/workspace': 'opsQueue',
  '/submission-ops-queue': 'opsQueue',
  '/submission-workspace': 'opsQueue',
  '/wip-schedule-analyzer': 'wip',
  '/wip-intelligence': 'wip',
  '/wip-review': 'wip',
  '/handoff-memo': 'handoffMemos',
  '/handoff-memos': 'handoffMemos',
  // Lane routes use config-declared paths via PATH_TO_PAGE; no override needed.
};

const PAGE_THEMES = {
  home: { band: 'bg-slate-50', accent: 'text-slate-900' },
  contractorReadiness: { band: 'bg-slate-50', accent: 'text-slate-900' },
  requirements: { band: 'bg-slate-50', accent: 'text-slate-900' },
  documentsLanding: { band: 'bg-slate-50', accent: 'text-slate-900' },
  calculatorLanding: { band: 'bg-slate-50', accent: 'text-slate-900' },
  sba504: { band: 'bg-slate-50', accent: 'text-slate-900' },
  surety: { band: 'bg-slate-50', accent: 'text-slate-900' },
  opsQueue: { band: 'bg-slate-50', accent: 'text-slate-900' },
  compare: { band: 'bg-slate-50', accent: 'text-slate-900' },
  roi: { band: 'bg-slate-50', accent: 'text-slate-900' },
  trust: { band: 'bg-slate-50', accent: 'text-slate-900' },
};

function getDefaultLane() {
  try {
    const host = window.location.hostname;
    if (host.includes('clearpathsbaloan')) return 'sba';
    if (host.includes('bondsba') || host === 'localhost' || host === '127.0.0.1') return 'bond';
    const saved = window.localStorage.getItem('bondsba-lane');
    if (saved) return saved === 'sba' ? 'sba' : 'bond';
    return 'bond';
  } catch { return 'bond'; }
}

function resolvePageFromPath(pathname) {
  if (pathname === '/' || pathname === '') {
    const lane = getDefaultLane();
    return lane === 'sba' ? 'sbaHome' : 'bondHome';
  }
  return PATH_ALIASES[pathname] || PATH_TO_PAGE[pathname] || 'bondHome';
}

export function isClearpathDomain() {
  try {
    return ['clearpathsbaloan', 'clearpathsba'].some((host) => window.location.hostname.includes(host));
  }
  catch { return false; }
}



function updateHeadMetadata(pageId) {
  if (typeof document === 'undefined') return;

  const config = PAGE_CONFIG[pageId] || PAGE_CONFIG.home;
  const canonicalUrl = `https://bondsba.com${config.path}`;

  document.title = resolveTitleForDomain(config.title);

  const setMeta = (selector, attr, value) => {
    const el = document.head.querySelector(selector);
    if (el) el.setAttribute(attr, value);
  };

  setMeta('meta[name="description"]', 'content', resolveTitleForDomain(config.description));
  setMeta('link[rel="canonical"]', 'href', canonicalUrl);
  setMeta('meta[name="robots"]', 'content', config.robots || 'index, follow');
  setMeta('meta[property="og:url"]', 'content', canonicalUrl);
  setMeta('meta[property="og:title"]', 'content', config.ogTitle);
  setMeta('meta[property="og:description"]', 'content', config.description);
  setMeta('meta[name="twitter:url"]', 'content', canonicalUrl);
  setMeta('meta[name="twitter:title"]', 'content', config.ogTitle);
  setMeta('meta[name="twitter:description"]', 'content', config.description);
}


function updatePageStructuredData(pageId) {
  if (typeof document === 'undefined') return;

  const scriptId = 'page-structured-data';
  const data = PAGE_STRUCTURED_DATA[pageId] || [];
  let script = document.getElementById(scriptId);

  if (!data.length) {
    if (script) script.textContent = '';
    return;
  }

  if (!script) {
    script = document.createElement('script');
    script.id = scriptId;
    script.type = 'application/ld+json';
    document.head.appendChild(script);
  }

  const graphPayload = data.length <= 1
    ? data[0]
    : {
        '@context': 'https://schema.org',
        '@graph': data.map((entry) => {
          const copy = { ...entry };
          delete copy['@context'];
          return copy;
        }),
      };

  script.textContent = JSON.stringify(graphPayload);
}

// ── Error Boundary ──
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    console.error('BondSBA caught error:', error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-8">
          <div className="max-w-md text-center">
            <p className="text-sm font-semibold uppercase tracking-wide text-slate-400 mb-2">Something went wrong</p>
            <h1 className="text-xl font-bold text-slate-900 mb-3">An error occurred in this view</h1>
            <p className="text-sm text-slate-500 mb-6">{this.state.error?.message || 'Unknown error'}</p>
            <button
              onClick={() => { this.setState({ hasError: false, error: null }); window.location.href = '/'; }}
              className="inline-flex items-center justify-center rounded-lg border border-[#0B1F3A] bg-[#0B1F3A] px-4 py-2 text-sm font-semibold text-white hover:bg-[#12365F]"
            >
              Return to home
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// ── App shell ──
export default function App() {
  const [page, setPage] = useState(() => resolvePageFromPath(window.location.pathname));
  const normalizeLane = (side) => (side === 'bond' || side === 'surety' ? 'bond' : 'sba');
  const [initialLane, setInitialLane] = useState(() => getDefaultLane());
  const [mobileOpen, setMobileOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [authPrompt, setAuthPrompt] = useState('');
  const [entitlementSnapshot, setEntitlementSnapshot] = useState(null);
  const [jurisdiction, setJurisdictionState] = useState(() => {
    try { return window.localStorage.getItem('bondsba-jurisdiction') || 'US'; }
    catch { return 'US'; }
  });
  const [region, setRegionState] = useState(() => {
    try { return window.localStorage.getItem('bondsba-region') || ''; }
    catch { return ''; }
  });
  // Auto-open jurisdiction prompt once for bond-side visitors who have no region set.
  // Shows on first bond tool visit; once they set it, never shown again automatically.
  const [jurisdictionPromptOpen, setJurisdictionPromptOpen] = useState(() => {
    if (isClearpathDomain()) return false; // SBA side doesn't use bond jurisdiction
    try {
      const hasSetJurisdiction = Boolean(window.localStorage.getItem('bondsba-region'));
      const hasSeenPrompt = Boolean(window.localStorage.getItem('bondsba-jurisdiction-prompted'));
      return !hasSetJurisdiction && !hasSeenPrompt;
    } catch {
      return false;
    }
  });
  const setJurisdiction = (code) => {
    setJurisdictionState(code);
    try { window.localStorage.setItem('bondsba-jurisdiction', code); } catch {}
  };
  const setRegion = (code) => {
    setRegionState(code);
    try { window.localStorage.setItem('bondsba-region', code); } catch {}
  };
  const { user, loading } = useAuth();

  const handleSignIn = async () => {
    setAuthOpen(true);
  };

  // ClearPath: calculator is free (core free tool promise); only spreading+wip are Pro.
  // BondSBA: calculator also requires auth (higher-tier tool).
  const protectedPages = isClearpathDomain()
    ? new Set(['spreading', 'wip'])
    : new Set(['calculator', 'spreading', 'wip']);
  const billingProtectedPages = new Set(['billingSettings', 'billingSuccess']);
  const publicPreviewPages = new Set(['wip']);
  const monetizedPublicPages = new Set(['sbaHome', 'contractorReadiness', 'requirements', 'documentsLanding', 'calculatorLanding', 'surety', 'compare']);
  // Legacy reference kept for touchpoint regression checks:
  // const pageRequiresAuth = protectedPages.has(page);
  const pageRequiresAuth = (protectedPages.has(page) || billingProtectedPages.has(page)) && !publicPreviewPages.has(page);
  const showPublicAds = monetizedPublicPages.has(page);
  // ClearPath is fully free + ad-supported — ads always on, no Pro suppression.
  // BondSBA: ads shown to free (inactive) users; Pro plan suppresses all ads.
  const isPro = isClearpathDomain() ? false : Boolean(entitlementSnapshot?.entitlement?.active);
  const showAds = isClearpathDomain() ? true : !isPro;
  const canRenderPage = !pageRequiresAuth || user;

  const nav = (p) => {
    setPage(p);
    setMobileOpen(false);
    setAuthPrompt('');
    const config = PAGE_CONFIG[p] || PAGE_CONFIG.home;
    if (window.location.pathname !== config.path) {
      window.history.pushState({}, '', config.path);
    }
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  const navWithAuth = (p) => {
    if (!user && (protectedPages.has(p) || billingProtectedPages.has(p))) {
      setAuthPrompt('Sign in or create an account to run BondSBA Terminal submission tools.');
      setAuthOpen(true);
      setMobileOpen(false);
      return;
    }
    nav(p);
  };

  const requireAuth = (message = 'Sign in or create an account to run this analysis.') => {
    if (user) return true;
    setAuthPrompt(message);
    setAuthOpen(true);
    return false;
  };

  useEffect(() => {
    updateHeadMetadata(page);
    updatePageStructuredData(page);
  }, [page]);

  useEffect(() => {
    if (loading || user || !pageRequiresAuth) return;
    setAuthPrompt('Sign in or create an account to run BondSBA Terminal submission tools.');
    setAuthOpen(true);
  }, [loading, user, pageRequiresAuth]);

  useEffect(() => {
    const handlePopState = () => {
      setPage(resolvePageFromPath(window.location.pathname));
      setMobileOpen(false);
      setAuthPrompt('');
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadEntitlement = async () => {
      if (!user) {
        setEntitlementSnapshot(null);
        return;
      }
      try {
        const data = await fetchAPI('/api/stripe/entitlement');
        if (!cancelled) setEntitlementSnapshot(data);
      } catch {
        if (!cancelled) setEntitlementSnapshot(null);
      }
    };
    loadEntitlement();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const handleUploadDocument = async (file) => {
    try {
      const reader = new FileReader();
      const content = await new Promise((resolve, reject) => {
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      return await SuretyClient.processApplication(
        {
          name: file.name,
          content,
          type: file.type,
        },
        {
          documentType: 'unknown',
          analysisType: 'full',
          wipDetails: {},
          spreadingOptions: {
            underwriter: user?.email || 'BondSBA Workspace',
          },
        }
      );
    } catch (error) {
      console.error('Document processing failed:', error);
      throw error;
    }
  };

  const PAGE_LANES = {
    sbaHome: 'sba',
    sbaGuaranty: 'sba',
    sbaEligibility: 'sba',
    sbaDocumentChecklist: 'sba',
    sbaLoanReadiness: 'sba',
    sbaLenderPacket: 'sba',
    requirements: 'sba',
    documentsLanding: 'sba',
    calculatorLanding: 'sba',
    sba504: 'sba',
    calculator: 'sba',
    screener: 'sba',
    checklist: 'sba',
    compare: 'sba',
    guarantyFee: 'sba',
    bondHome: 'bond',
    bondWipAnalysis: 'bond',
    bondReadiness: 'bond',
    bondSubmissionChecklist: 'bond',
    bondSuretyPacket: 'bond',
    surety: 'bond',
    suretyDashboard: 'bond',
    spreading: 'bond',
    wip: 'bond',
    contractorReadiness: 'bond',
    readinessEngine: 'bond',
    opsQueue: 'bond',
    contractorProfile: 'bond',
    handoffMemos: 'bond',
  };

  const lane = PAGE_LANES[page] || initialLane;
  const NAV_ITEMS_BY_LANE = {
    sba: [
      { id: 'sbaHome', label: 'SBA Home', free: true },
      { id: 'guarantyFee', label: 'Guaranty Fee Calc', free: true },
      { id: 'screener', label: 'Eligibility Screener', free: true },
      { id: 'calculatorLanding', label: 'Calculator Guide', free: true },
      { id: 'sba504', label: '504', free: true },
      // No Pricing nav on ClearPath — it's a free site
    ],
    bond: [
      { id: 'bondHome', label: 'Bond Home' },
      { id: 'bondWipAnalysis', label: 'WIP Guide' },
      { id: 'readinessEngine', label: 'Readiness' },
      { id: 'opsQueue', label: 'Workspace' },
      { id: 'pricing', label: 'Pricing' },
    ],
  };
  const NAV_ITEMS = NAV_ITEMS_BY_LANE[lane === 'sba' ? 'sba' : 'bond'];

  const PAGE_SPOTLIGHT = {
    contractorReadiness: { label: 'Readiness Workspace', hint: 'Identify blockers and move files toward first-pass underwriter quality.', band: 'bg-slate-50 border-slate-200 text-slate-700', icon: CheckSquare, cta: { text: 'Open Ops Queue', id: 'opsQueue' } },
    readinessEngine: { label: 'Readiness Engine', hint: 'Track critical gaps, stale docs, and recommended next actions before lender or surety review.', band: 'bg-slate-50 border-slate-200 text-slate-700', icon: CheckSquare, cta: { text: 'Review Missing Items', id: 'readinessEngine' } },
    opsQueue: { label: 'Ops Queue Workspace', hint: 'Run owner-based follow-up so nothing critical stalls in inboxes.', band: 'bg-slate-50 border-slate-200 text-slate-700', icon: Layers, cta: { text: 'Run Readiness Check', id: 'readinessEngine' } },
    screener: { label: 'Eligibility Workspace', hint: 'Find hard stops early and prevent wasted underwriting cycles.', band: 'bg-slate-50 border-slate-200 text-slate-700', icon: Shield, cta: { text: 'Back to Overview', id: 'home' } },
    surety: { label: 'Surety Triage Workspace', hint: 'Prepare cleaner submission context before market outreach.', band: 'bg-slate-50 border-slate-200 text-slate-700', icon: Briefcase, cta: { text: 'Open Triage Workspace', id: 'suretyDashboard', requiresAuth: true } },
    compare: { label: 'Program Comparison', hint: 'Use side-by-side terms to align structure with borrower reality.', band: 'bg-slate-50 border-slate-200 text-slate-700', icon: Landmark, cta: { text: 'Open Calculator', id: 'calculator', requiresAuth: true } },
    roi: { label: 'ROI Workspace', hint: 'Quantify cycle-time and rework reduction across your team.', band: 'bg-slate-50 border-slate-200 text-slate-700', icon: Activity, cta: { text: 'Open Ops Queue', id: 'opsQueue' } },
    trust: { label: 'Trust & Security', hint: 'Verify controls, boundaries, and ownership protections.', band: 'bg-slate-50 border-slate-200 text-slate-700', icon: Shield, cta: { text: 'Open Methodology', id: 'contractorReadiness' } },
    checklist: { label: 'Checklist Workspace', hint: 'Generate clear missing-item outputs that teams can actually execute.', band: 'bg-slate-50 border-slate-200 text-slate-700', icon: CheckSquare, cta: { text: 'Open Screener', id: 'screener' } },
    calculator: { label: 'Calculator Workspace', hint: 'Model payments and structure before packaging lender conversations.', band: 'bg-slate-50 border-slate-200 text-slate-700', icon: Calculator, cta: { text: 'Open Comparison', id: 'compare' } },
    suretyDashboard: { label: 'Surety Dashboard', hint: 'Process contractor packets in a triage-first underwriting flow.', band: 'bg-slate-50 border-slate-200 text-slate-700', icon: Briefcase, cta: { text: 'Open WIP Review', id: 'wip' } },
    spreading: { label: 'Financial Spreading', hint: 'Normalize statements and surface risk indicators for review quality.', band: 'bg-slate-50 border-slate-200 text-slate-700', icon: FileText, cta: { text: 'Open Surety Dashboard', id: 'suretyDashboard', requiresAuth: true } },
    wip: { label: 'WIP Review', hint: 'Inspect job-level performance drift before underwriter review.', band: 'bg-slate-50 border-slate-200 text-slate-700', icon: Layers, cta: { text: 'Open File Prep Workspace', id: 'opsQueue' } },
    contractorProfile: { label: 'Contractor Profile', hint: 'Use persistent contractor memory for WIP history, repeated gaps, and handoff continuity.', band: 'bg-slate-50 border-slate-200 text-slate-700', icon: Building2, cta: { text: 'Open Handoff Memos', id: 'handoffMemos' } },
    handoffMemos: { label: 'Handoff Memo Generator', hint: 'Build concise lender and surety notes from readiness and WIP findings.', band: 'bg-slate-50 border-slate-200 text-slate-700', icon: FileText, cta: { text: 'Open Contractor Profile', id: 'contractorProfile' } },
    sba504: { label: 'SBA 504 Calculator', hint: 'Model bank, CDC, borrower injection, and FY2026 fee treatment for fixed-asset projects.', band: 'bg-slate-50 border-slate-200 text-slate-700', icon: Landmark, cta: { text: 'Open SBA Calculator', id: 'calculator', requiresAuth: true } },
    sbaHome: { label: 'SBA Home', hint: 'SBA loan readiness under the BondSBA domain.', band: 'bg-slate-50 border-slate-200 text-slate-700', icon: Landmark, cta: { text: 'Enter Bond Side', id: 'bondHome' } },
    bondHome: { label: 'Bond Home', hint: 'Bond readiness under the BondSBA domain.', band: 'bg-slate-50 border-slate-200 text-slate-700', icon: Shield, cta: { text: 'Enter SBA Side', id: 'sbaHome' } },
    bondWipAnalysis: { label: 'WIP Analysis Guide', hint: 'Learn WIP review before opening the workspace.', band: 'bg-slate-50 border-slate-200 text-slate-700', icon: Shield, cta: { text: 'Open Bond Home', id: 'bondHome' } },
    sbaGuaranty: { label: 'SBA Guaranty', hint: 'Prepare borrower files before lender review.', band: 'bg-slate-50 border-slate-200 text-slate-700', icon: Landmark, cta: { text: 'Open SBA Home', id: 'sbaHome' } },
    guarantyFee: { label: 'Guaranty Fee Calculator', hint: 'Calculate SBA 7(a) upfront and annual guaranty fees instantly.', band: 'bg-slate-50 border-slate-200 text-slate-700', icon: Calculator, cta: { text: 'Open SBA Home', id: 'sbaHome' } },
  };

  const JurisdictionSelector = () => {
    const j = findJurisdiction(jurisdiction);
    const r = findRegion(jurisdiction, region);
    const [open, setOpen] = useState(false);
    return (
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 text-[12px] font-semibold text-slate-700 hover:bg-slate-50"
          aria-label="Choose jurisdiction"
        >
          <span aria-hidden>{j.flag}</span>
          <span>{r ? r.code : j.code}</span>
          <span className="text-slate-400">▾</span>
        </button>
        {open && (
          <div className="absolute right-0 mt-1.5 w-72 rounded-md border border-slate-200 bg-white p-3 shadow-lg z-50" role="menu">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Country</p>
            <div className="grid grid-cols-2 gap-1">
              {JURISDICTIONS.map((opt) => (
                <button
                  key={opt.code}
                  type="button"
                  onClick={() => { setJurisdiction(opt.code); setRegion(opt.regions[0]?.code || ''); }}
                  className={`inline-flex items-center gap-1.5 rounded px-2 py-1 text-[12px] text-left ${opt.code === jurisdiction ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'}`}
                >
                  <span aria-hidden>{opt.flag}</span>
                  <span className="truncate">{opt.label}</span>
                </button>
              ))}
            </div>
            <p className="mt-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Region / Province / State</p>
            <select
              value={region}
              onChange={(e) => { setRegion(e.target.value); setOpen(false); }}
              className="w-full rounded border border-slate-200 bg-white px-2 py-1.5 text-[12px] text-slate-900 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
            >
              {j.regions.map((opt) => (
                <option key={opt.code} value={opt.code}>{opt.label}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="mt-3 inline-flex h-8 w-full items-center justify-center rounded bg-[#0B1F3A] text-[12px] font-semibold text-white hover:bg-[#12365F]"
            >
              Apply
            </button>
            <button
              type="button"
              onClick={() => { setOpen(false); setJurisdictionPromptOpen(true); }}
              className="mt-1 inline-flex w-full items-center justify-center px-2 py-1 text-[11px] text-slate-500 hover:text-slate-900"
            >
              Open full picker
            </button>
          </div>
        )}
      </div>
    );
  };

  const JurisdictionPrompt = () => {
    const [pickedCountry, setPickedCountry] = useState(jurisdiction);
    const [pickedRegion, setPickedRegion] = useState(region || (findJurisdiction(jurisdiction)?.regions?.[0]?.code || ''));
    const country = findJurisdiction(pickedCountry);
    const markSeen = () => {
      try { window.localStorage.setItem('bondsba-jurisdiction-prompted', '1'); } catch {}
    };
    const apply = () => {
      setJurisdiction(pickedCountry);
      setRegion(pickedRegion);
      markSeen();
      setJurisdictionPromptOpen(false);
    };
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
        <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-2xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Setup</p>
          <h2 className="mt-1 text-[22px] font-semibold tracking-[-0.02em] text-slate-900">Choose your jurisdiction</h2>
          <p className="mt-2 text-[13px] text-slate-600">
            BondSBA tailors statutes, regulators, contract documents, and bond conventions to your region. Pick your country and the state or province where you work most.
          </p>

          <div className="mt-5">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Country</label>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {JURISDICTIONS.map((opt) => (
                <button
                  key={opt.code}
                  type="button"
                  onClick={() => { setPickedCountry(opt.code); setPickedRegion(opt.regions[0]?.code || ''); }}
                  className={`inline-flex items-center justify-start gap-2 rounded-md border px-3 py-2 text-[13px] font-medium ${pickedCountry === opt.code ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}
                >
                  <span aria-hidden>{opt.flag}</span>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-5">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{pickedCountry === 'CA-COUNTRY' ? 'Province / territory' : pickedCountry === 'AU' ? 'State' : pickedCountry === 'GB' ? 'Nation' : 'State'}</label>
            <select
              value={pickedRegion}
              onChange={(e) => setPickedRegion(e.target.value)}
              className="mt-2 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-[14px] text-slate-900 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
            >
              {country.regions.map((opt) => (
                <option key={opt.code} value={opt.code}>{opt.label}</option>
              ))}
            </select>
          </div>

          <div className="mt-6 flex gap-2">
            <button
              type="button"
              onClick={apply}
              className="inline-flex h-10 flex-1 items-center justify-center rounded-md bg-[#0B1F3A] px-4 text-[13px] font-semibold text-white hover:bg-[#12365F]"
            >
              Apply jurisdiction
            </button>
            <button
              type="button"
              onClick={() => { setJurisdiction('US'); setRegion('CA'); markSeen(); setJurisdictionPromptOpen(false); }}
              className="inline-flex h-10 items-center justify-center rounded-md border border-slate-200 bg-white px-3 text-[12px] font-medium text-slate-600 hover:bg-slate-50"
            >
              Skip · use US default
            </button>
          </div>
          <p className="mt-3 text-[11px] text-slate-400">You can change this anytime from the header. Informational only — not legal advice.</p>
        </div>
      </div>
    );
  };

  // Per-tool accent — quiet identity, single 6px bar, never floods the page
  const NAV_ACCENTS = {
    opsQueue:        { bar: 'bg-slate-900',    dot: 'bg-slate-900' },
    readinessEngine: { bar: 'bg-emerald-500',  dot: 'bg-emerald-500' },
    wip:             { bar: 'bg-amber-500',    dot: 'bg-amber-500' },
    calculator:      { bar: 'bg-indigo-500',   dot: 'bg-indigo-500' },
    handoffMemos:    { bar: 'bg-slate-700',    dot: 'bg-slate-700' },
    pricing:         { bar: 'bg-slate-400',    dot: 'bg-slate-400' },
  };

  const NavLink = ({ id, label, requiresAuth = false, free = false }) => {
    const href = PAGE_CONFIG[id]?.path || '/';
    const isActive = page === id;
    const accent = NAV_ACCENTS[id] || NAV_ACCENTS.opsQueue;

    return (
      <a
        href={href}
        onClick={(event) => {
          event.preventDefault();
          if (requiresAuth) navWithAuth(id);
          else nav(id);
        }}
        className={`group relative inline-flex items-center gap-2 text-[15px] font-semibold px-3 py-2 min-h-10 transition-all duration-150 cursor-pointer rounded-lg ${
          isActive
            ? 'bg-slate-100 text-slate-900'
            : 'text-slate-700 hover:text-slate-900 hover:bg-slate-100'
        }`}
      >
        <span aria-hidden className={`inline-block h-1.5 w-1.5 rounded-full transition-opacity ${accent.dot} ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-60'}`} />
        {label}{free && <span className="ml-1 rounded bg-emerald-100 px-1 py-0.5 text-[9px] font-bold uppercase text-emerald-700">Free</span>}
      </a>
    );
  };

  const chooseLane = (nextLane) => {
    const normalized = normalizeLane(nextLane);
    try { window.localStorage.setItem("bondsba-lane", normalized); } catch {}
    setInitialLane(normalized);
    nav(normalized === 'bond' ? 'bondHome' : 'sbaHome');
  };

  return (
    <div
      className="min-h-screen bondsba-shell text-slate-900 selection:bg-blue-100 selection:text-slate-900"
      style={{ fontFamily: isClearpathDomain() ? "'Plus Jakarta Sans', system-ui, sans-serif" : "'IBM Plex Sans', system-ui, sans-serif" }}
    >
      {jurisdictionPromptOpen && <JurisdictionPrompt />}

      {/* ── Header ── */}
      <header className="sticky top-0 z-40 border-b border-[#0B1F3A]/30 bg-white/95 shadow-[0_8px_26px_rgba(15,23,42,0.06)] backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-[1240px] items-center justify-between gap-4 px-6">

          {/* Wordmark */}
          <button
            onClick={() => nav(lane === 'bond' ? 'bondHome' : 'sbaHome')}
            className="flex items-center gap-2.5 shrink-0 cursor-pointer"
            aria-label="BondSBA Terminal — Home"
          >
            <img src="/bondsba-icon.svg" alt="" className="h-6 w-6" />
            {isClearpathDomain() ? (
              <>
                <span className="text-lg font-bold tracking-[-0.01em] text-slate-900">ClearPath</span>
                <span className="hidden border-l border-slate-200 pl-2 text-xs font-semibold uppercase tracking-wide text-slate-500 sm:block">
                  Powered by BondSBA
                </span>
              </>
            ) : (
              <>
                <span className="text-lg font-bold tracking-[-0.01em] text-slate-900">BondSBA</span>
                <span className="hidden border-l border-slate-200 pl-2 text-xs font-semibold uppercase tracking-wide text-slate-500 sm:block">
                  Bond Readiness
                </span>
              </>
            )}
          </button>

          {/* Cross-domain link — no toggle, each domain is standalone */}
          {isClearpathDomain() ? (
            <a
              href="https://bondsba.com"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden md:inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-[12px] font-semibold text-slate-600 transition-colors hover:bg-white hover:text-slate-900"
            >
              <Shield className="h-3.5 w-3.5 text-slate-400" />
              Bond tools at BondSBA.com
            </a>
          ) : (
            <a
              href="https://clearpathsbaloan.com"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden md:inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[12px] font-semibold text-emerald-700 transition-colors hover:bg-emerald-100 hover:text-emerald-900"
            >
              <Landmark className="h-3.5 w-3.5 text-emerald-500" />
              Visit ClearPath SBA
              <ExternalLink className="h-3 w-3 text-emerald-400" />
            </a>
          )}

          {/* Desktop nav */}
          <nav className="hidden lg:flex items-center gap-1">
            {NAV_ITEMS.map(item => <NavLink key={item.id} {...item} />)}
          </nav>

          {/* Auth Section */}
          <div className="flex items-center gap-2 shrink-0">
            {!isClearpathDomain() && <div className="hidden md:block"><JurisdictionSelector /></div>}
            <a
              href="mailto:contactbondsba@gmail.com"
              className="hidden md:inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition-colors duration-150 hover:bg-slate-50 hover:text-slate-900"
            >
              Contact
            </a>
            {!loading && (
              user ? (
                <div className="flex items-center gap-2">
                  {!isClearpathDomain() && (
                    <button
                      onClick={() => nav(entitlementSnapshot?.entitlement?.active ? 'opsQueue' : 'pricing')}
                      className="inline-flex items-center gap-2 rounded-lg border border-[#0B1F3A] bg-[#0B1F3A] px-3 py-2 text-sm font-semibold text-white transition-colors duration-150 hover:bg-[#12365F]"
                      aria-label={entitlementSnapshot?.entitlement?.active ? 'Open workspace' : 'Choose plan'}
                    >
                      {entitlementSnapshot?.entitlement?.active ? 'Workspace' : 'Choose Plan'}
                    </button>
                  )}
                  <UserProfile />
                </div>
              ) : (
                <button
                  onClick={handleSignIn}
                  className="inline-flex items-center gap-2 rounded-lg border border-[#0B1F3A] bg-[#0B1F3A] px-3 py-2 text-sm font-semibold text-white transition-colors duration-150 hover:bg-[#12365F]"
                  aria-label="Get access with Google"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span className="hidden sm:block">Open Workspace</span>
                </button>
              )
            )}
          </div>

          {/* Mobile toggle */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="lg:hidden text-slate-600 hover:text-slate-900 transition-colors duration-150 cursor-pointer p-2 rounded-md hover:bg-slate-100"
            aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {mobileOpen && (
          <div className="lg:hidden border-t border-slate-200 bg-white px-4 py-3 flex flex-col gap-1">
            <div className="mb-2">
              {isClearpathDomain() ? (
                <a
                  href="https://bondsba.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-slate-50 text-sm font-semibold text-slate-700"
                >
                  Bond tools at BondSBA.com
                </a>
              ) : (
                <a
                  href="https://clearpathsbaloan.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-slate-50 text-sm font-semibold text-slate-700"
                >
                  SBA tools at ClearPathSBALoan.com
                </a>
              )}
            </div>
            {NAV_ITEMS.map(item => <NavLink key={item.id} {...item} />)}
          </div>
        )}
      </header>

      {/* ── Main content ── */}
      <main className="mx-auto max-w-[1240px] px-6 py-6 md:py-8 pb-24 md:pb-28">
        <ErrorBoundary>
        {page !== 'home' && PAGE_SPOTLIGHT[page] && (
          <nav className="mb-4 flex items-center gap-1.5 text-xs text-slate-400" aria-label="Breadcrumb">
            <button onClick={() => nav(lane === 'bond' ? 'bondHome' : 'sbaHome')} className="hover:text-slate-600 transition-colors">BondSBA</button>
            <span>/</span>
            <span className="font-medium text-slate-600">{PAGE_SPOTLIGHT[page].label}</span>
          </nav>
        )}
        {showAds && page !== 'pricing' && (isClearpathDomain() || page !== 'home') && (
          <AdSenseSlot placement="top" className="mb-4 rounded-lg" />
        )}
        {((authPrompt && !user) || (!loading && !user && pageRequiresAuth)) && (
          <div className="mb-4 flex items-start gap-3 border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800">
            <Shield className="mt-0.5 h-4 w-4 shrink-0 text-slate-600" />
            <div>
              <p className="font-semibold">Sign in to access this tool</p>
              <p className="mt-0.5">{authPrompt || 'Create a free account to run BondSBA submission tools. No credit card required.'}</p>
            </div>
          </div>
        )}
        {page === 'home'       && <Overview nav={nav} navWithAuth={navWithAuth} user={user} jurisdiction={jurisdiction} region={region} initialLane={initialLane} />}
        {page === 'sbaHome'    && <SBALaneHome nav={nav} navWithAuth={navWithAuth} user={user} onSignIn={() => { setAuthPrompt('Sign in to save your SBA eligibility results and document checklist.'); setAuthOpen(true); }} />}
        {page === 'bondHome'   && <BondHomeClassic nav={nav} navWithAuth={navWithAuth} user={user} onSignIn={() => { setAuthPrompt('Sign in to save your file analysis and carrier memo.'); setAuthOpen(true); }} />}
        {page === 'sbaGuaranty' && <SBAGuarantyPage nav={nav} navWithAuth={navWithAuth} />}
        {page === 'bondWipAnalysis' && <BondWipAnalysisPage nav={nav} navWithAuth={navWithAuth} />}
        {['home', 'bondHome', 'opsQueue', 'readinessEngine', 'wip', 'handoffMemos'].includes(page) && !region && !isClearpathDomain() && (
          <div className="mx-auto max-w-6xl px-4 -mb-2 pt-3">
            <button
              type="button"
              onClick={() => setJurisdictionPromptOpen(true)}
              className="flex w-full items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-left hover:bg-amber-100"
            >
              <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-500 text-white text-[12px] font-bold">!</span>
              <span className="flex-1">
                <span className="block text-[13px] font-semibold text-slate-900">Set your jurisdiction first</span>
                <span className="block text-[12px] text-slate-600">Pick your state/province so statutes, regulators, and bond conventions match your market.</span>
              </span>
              <span className="text-[12px] font-semibold text-amber-800">Choose →</span>
            </button>
          </div>
        )}
        {page === 'pricing' && !isClearpathDomain() && (
          <PricingPage nav={nav} user={user} onRequireAuth={requireAuth} />
        )}
        {page === 'checkout' && <EmbeddedCheckoutPage nav={nav} user={user} onRequireAuth={requireAuth} />}
        {page === 'billingSuccess' && canRenderPage && <BillingSuccessPage nav={nav} />}
        {page === 'billingSettings' && canRenderPage && <BillingSettingsPage nav={nav} />}
        {page === 'contractorReadiness' && <SEOLandingPage pageId="contractorReadiness" nav={nav} navWithAuth={navWithAuth} />}
        {page === 'readinessEngine' && <ReadinessEnginePage nav={nav} />}
        {page === 'requirements' && <SEOLandingPage pageId="requirements" nav={nav} navWithAuth={navWithAuth} />}
        {page === 'documentsLanding' && <SEOLandingPage pageId="documentsLanding" nav={nav} navWithAuth={navWithAuth} />}
        {page === 'calculatorLanding' && <SEOLandingPage pageId="calculatorLanding" nav={nav} navWithAuth={navWithAuth} />}
        {page === 'sba504' && <SBA504CalculatorLanding nav={nav} navWithAuth={navWithAuth} />}
        {page === 'calculator' && canRenderPage && <AmortizationTerminal nav={nav} user={user} onRequireAuth={requireAuth} />}
        {page === 'screener'   && <EligibilityScreener nav={nav} />}
        {page === 'checklist'  && <DocumentChecklist />}
        {page === 'opsQueue'   && <SubmissionOpsQueue nav={nav} navWithAuth={navWithAuth} user={user} entitlement={entitlementSnapshot?.entitlement || null} />}
        {page === 'compare'    && <ProgramComparison />}
        {page === 'guarantyFee' && <GuarantyFeeCalculator nav={nav} />}
        {page === 'integrations' && <IntegrationsHub />}
        {page === 'roi' && <ROIDashboard />}
        {page === 'trust' && <TrustSecurityPage />}
        {page === 'contractorProfile' && <ContractorProfilePage nav={nav} />}
        {page === 'handoffMemos' && <HandoffMemoGeneratorPage nav={nav} entitlement={entitlementSnapshot?.entitlement || null} />}
        {page === 'surety'     && <SEOLandingPage pageId="surety" nav={nav} navWithAuth={navWithAuth} />}
        {page === 'suretyDashboard' && canRenderPage && (
          <Suspense fallback={<ModuleFallback label="Loading surety workspace…" />}>
            <SuretyDashboard onNavigate={navWithAuth} onUploadDocument={handleUploadDocument} onRequireAuth={requireAuth} user={user} />
          </Suspense>
        )}
        {page === 'spreading'  && canRenderPage && (
          <Suspense fallback={<ModuleFallback label="Loading financial review…" />}>
            <SpreadingEngine onBack={() => nav('suretyDashboard')} />
          </Suspense>
        )}
        {page === 'wipAnalyzer' && canRenderPage && (
          <Suspense fallback={<ModuleFallback label="Loading WIP analyzer…" />}>
            <WIPAnalyzerModule onBack={() => nav('suretyDashboard')} />
          </Suspense>
        )}
        {page === 'wipAudit' && (
          <Suspense fallback={<ModuleFallback label="Loading WIP audit tool…" />}>
            <WipAuditTool nav={nav} />
          </Suspense>
        )}
        {page === 'feeWaiverCalc' && (
          <Suspense fallback={<ModuleFallback label="Loading fee waiver calculator…" />}>
            <FeeWaiverCalculator nav={nav} />
          </Suspense>
        )}
        {page === 'ebitdaDscr' && (
          <Suspense fallback={<ModuleFallback label="Loading DSCR calculator…" />}>
            <EbitdaDscrEngine nav={nav} />
          </Suspense>
        )}
        {page === 'wip'        && canRenderPage && <WipReviewPage nav={nav} />}
        </ErrorBoundary>
      </main>

      <AuthModal isOpen={authOpen} onClose={() => setAuthOpen(false)} />
      {/* Bottom ad slot — ClearPath maximizes placements; BondSBA keeps single top slot */}
      {showAds && isClearpathDomain() && page !== 'pricing' && (
        <div className="max-w-6xl mx-auto px-4 mt-6 mb-2">
          <AdSenseSlot placement="bottom" className="rounded-lg" />
        </div>
      )}
      <AdConsentBanner visible={showAds} />

      {/* ── Footer ── */}
      <footer className="bg-white border-t border-slate-200 mt-8">
        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="grid gap-8 md:grid-cols-4">
            <div className="md:col-span-2">
              <p className="text-sm font-bold text-slate-900">BondSBA</p>
              <p className="mt-1 text-xs text-slate-500 max-w-md">File-prep workflow for surety producers, construction lenders, and contractor finance brokers — built for the step before underwriting.</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-2">Tools</p>
              <ul className="space-y-1.5 text-xs text-slate-600">
                <li><button onClick={() => nav('opsQueue')} className="hover:text-slate-900">File Prep Workspace</button></li>
                <li><button onClick={() => nav('readinessEngine')} className="hover:text-slate-900">Submission Readiness</button></li>
                <li><button onClick={() => nav('wip')} className="hover:text-slate-900">WIP Review</button></li>
                <li><button onClick={() => nav('calculator')} className="hover:text-slate-900">SBA Calculator</button></li>
              </ul>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-2">Company</p>
              <ul className="space-y-1.5 text-xs text-slate-600">
                {!isClearpathDomain() && <li><button onClick={() => nav('pricing')} className="hover:text-slate-900">Pricing</button></li>}
                <li><a href="/privacy" className="hover:text-slate-900">Privacy</a></li>
                <li><a href="/terms" className="hover:text-slate-900">Terms</a></li>
                <li><a href="mailto:contactbondsba@gmail.com" className="hover:text-slate-900">Contact</a></li>
              </ul>
            </div>
          </div>
          <div className="mt-8 pt-5 border-t border-slate-200">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-2">Professional Use Notice</p>
            <p className="text-xs text-slate-500 leading-relaxed max-w-4xl">
              {COMPLIANCE_DISCLAIMER}
            </p>
            <p className="text-xs text-slate-400 mt-3">
              &copy; {new Date().getFullYear()} BondSBA. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// OVERVIEW (Home)
// ═══════════════════════════════════════════════════════════
const SEO_LINKS = [
  { id: 'contractorReadiness', path: '/contractor-submission-readiness', label: 'Contractor Submission Readiness' },
  { id: 'requirements', path: '/sba-loan-requirements', label: 'SBA Loan Requirements' },
  { id: 'documentsLanding', path: '/sba-loan-documents', label: 'SBA Loan Documents' },
  { id: 'calculatorLanding', path: '/sba-7a-calculator', label: 'SBA 7(a) Calculator' },
  { id: 'screener', path: '/sba-eligibility-screener', label: 'SBA Eligibility Screener' },
  { id: 'checklist', path: '/sba-document-checklist', label: 'SBA Document Checklist' },
  { id: 'opsQueue', path: '/workspace', label: 'Submission Ops Queue' },
  { id: 'compare', path: '/sba-program-comparison', label: 'SBA Program Comparison' },
  { id: 'surety', path: '/surety-underwriting', label: 'Surety Underwriting' },
  { id: 'sba504', path: '/sba-504-loans', label: 'SBA 504 Loans' },
  { id: 'contractorBonding', path: '/contractor-bonding', label: 'Contractor Bonding' },
];


const ROLE_CADENCE = {
  coordinator: {
    label: 'Entry-Level Coordinator',
    cadence: 'Daily',
    primary: 'opsQueue',
    backup: 'screener',
    outcomes: [
      'Keep borrower and contractor document packets complete',
      'Reduce missing-item follow-up loops',
      'Hand off cleaner files before underwriting touch time',
    ],
  },
  analyst: {
    label: 'Analyst / Associate',
    cadence: 'Daily + Weekly',
    primary: 'screener',
    backup: 'compare',
    outcomes: [
      'Pressure-test eligibility risk early',
      'Normalize assumptions across files',
      'Prioritize files that are ready for partner outreach',
    ],
  },
  producer: {
    label: 'Broker / Surety Producer',
    cadence: 'Weekly',
    primary: 'contractorReadiness',
    backup: 'suretyDashboard',
    outcomes: [
      'Shorten market feedback loops with cleaner submissions',
      'Improve close velocity on qualified files',
      'Spend less time reworking low-quality packets',
    ],
  },
  cpa: {
    label: 'Construction CPA / Fractional CFO',
    cadence: 'Weekly + Month-End',
    primary: 'documentsLanding',
    backup: 'surety',
    outcomes: [
      'Tighten documentation quality before financing and bonding asks',
      'Improve lender and underwriter confidence in financial package quality',
      'Create predictable submission process for client teams',
    ],
  },
  executive: {
    label: 'C-Level Executive',
    cadence: 'Weekly',
    primary: 'compare',
    backup: 'requirements',
    outcomes: [
      'Track submission readiness across active opportunities',
      'Reduce cycle time from inquiry to underwriter-ready file',
      'Drive repeatable operating rhythm across deal teams',
    ],
  },
};

function RepeatVisitHub({ nav, navWithAuth }) {
  const [role, setRole] = useState(() => {
    if (typeof window === 'undefined') return 'coordinator';
    return window.localStorage.getItem('bondsba-role') || 'coordinator';
  });
  const [visitCount, setVisitCount] = useState(() => {
    if (typeof window === 'undefined') return 1;
    return Number(window.localStorage.getItem('bondsba-visit-count') || '0') || 0;
  });
  const [lastVisit, setLastVisit] = useState(() => {
    if (typeof window === 'undefined') return '';
    return window.localStorage.getItem('bondsba-last-visit') || '';
  });
  const [todayComplete, setTodayComplete] = useState(() => {
    if (typeof window === 'undefined') return false;
    const today = new Date().toISOString().slice(0, 10);
    const doneDate = window.localStorage.getItem('bondsba-last-cadence-complete') || '';
    return doneDate === today;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const nowIso = new Date().toISOString();
    const nextVisitCount = visitCount + 1;
    setVisitCount(nextVisitCount);
    window.localStorage.setItem('bondsba-visit-count', String(nextVisitCount));
    window.localStorage.setItem('bondsba-last-visit', nowIso);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('bondsba-role', role);
  }, [role]);

  const roleConfig = ROLE_CADENCE[role] || ROLE_CADENCE.coordinator;

  const markCadenceComplete = () => {
    const today = new Date().toISOString().slice(0, 10);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('bondsba-last-cadence-complete', today);
    }
    setTodayComplete(true);
  };

  const downloadExcelWorkflowTemplate = () => {
    const rows = [
      ['Submission ID', 'Company', 'Lane (SBA/Surety/Both)', 'Missing Items Count', 'Readiness Status', 'Owner', 'Next Follow-Up Date', 'Notes'],
      ['SB-001', 'Example Contractor LLC', 'Both', '3', 'Conditional', 'Producer', '2026-05-18', 'Need updated WIP and debt schedule'],
      ['SB-002', 'Sample Builders Inc', 'Surety', '1', 'Ready', 'Coordinator', '2026-05-14', 'Queue for underwriter handoff'],
    ];
    const csv = rows.map((row) => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'bondsba-submission-ops-template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <section className="border border-slate-300 bg-white p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <p className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide mb-1">Operating Rhythm</p>
          <h2 className={T.sectionHead}>Built For Repeat Visits Across Your Entire Team</h2>
          <p className="mt-2 text-sm text-slate-600 leading-relaxed">
            Use BondSBA as a working operations layer, not a one-time calculator: daily packet cleanup, weekly readiness review, and executive-level cycle-time visibility.
          </p>
        </div>
        <div className="border border-slate-300 bg-slate-50 px-3 py-2 min-w-[220px]">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-600">Workspace Pulse</p>
          <p className="mt-1 text-xs text-slate-700 tabular-nums">Visit #{visitCount}</p>
          <p className="text-xs text-slate-600">
            {lastVisit ? `Last visit: ${new Date(lastVisit).toLocaleDateString()}` : 'First recorded visit'}
          </p>
          <p className="mt-1 text-xs text-slate-700">Cadence task: {todayComplete ? 'Done today' : 'Open'}</p>
        </div>
      </div>

      <div className="mt-4 grid lg:grid-cols-[minmax(0,1fr)_320px] gap-4">
        <div className="border border-slate-200 bg-slate-50 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-700 mb-2">Role-Based Workflow</p>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-2">
            {Object.entries(ROLE_CADENCE).map(([id, config]) => (
              <button
                key={id}
                onClick={() => setRole(id)}
                className={`text-left border px-3 py-2 text-xs transition-colors ${
                  role === id
                    ? 'border-[#1B3A6B] bg-white text-slate-900'
                    : 'border-slate-300 bg-white text-slate-700 hover:border-slate-500'
                }`}
              >
                <span className="block font-semibold">{config.label}</span>
                <span className="block text-slate-500 mt-0.5">{config.cadence} cadence</span>
              </button>
            ))}
          </div>
          <div className="mt-3 border border-slate-200 bg-white p-3">
            <p className="text-xs font-bold text-slate-900">{roleConfig.label}</p>
            <p className="text-xs text-slate-600 mt-0.5">Recommended cadence: {roleConfig.cadence}</p>
            <div className="mt-2 space-y-1">
              {roleConfig.outcomes.map((item) => (
                <p key={item} className="text-xs text-slate-700">{item}</p>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                onClick={() => navWithAuth(roleConfig.primary)}
                className={T.btnPrimary + ' text-xs py-1.5 px-3'}
              >
                Open Primary Workflow <ChevronRight className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => nav(roleConfig.backup)}
                className={T.btnSecondary + ' text-xs py-1.5 px-3'}
              >
                Open Support Workflow <ChevronRight className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={markCadenceComplete}
                className={T.btnGhost + ' text-xs'}
              >
                {todayComplete ? 'Cadence Completed' : 'Mark Today Complete'}
              </button>
            </div>
          </div>
        </div>

        <aside className="border border-slate-200 bg-white p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-700 mb-2">Excel Companion</p>
          <p className="text-xs text-slate-600 leading-relaxed">
            Practical extension path: keep teams in Excel for intake and queue management, then push only qualified files into BondSBA for readiness, analysis, and handoff output.
          </p>
          <div className="mt-3 space-y-2">
            {[
              'Queue tracker template (CSV) for current underwriting process',
              'Task-pane add-in MVP: pull selected rows and run readiness workflow',
              'Write-back status columns to preserve existing team process',
            ].map((line) => (
              <p key={line} className="text-xs text-slate-700">{line}</p>
            ))}
          </div>
          <button
            onClick={downloadExcelWorkflowTemplate}
            className={T.btnSecondary + ' w-full justify-center mt-3 text-xs py-1.5'}
          >
            Download Excel Workflow Template
          </button>
          <a
            href="/office-addin-excel/manifest.xml"
            className="mt-2 inline-flex w-full items-center justify-center border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:border-slate-500"
          >
            Download Excel Add-In Manifest
          </a>
        </aside>
      </div>
    </section>
  );
}

function DecisionCouncilPanel({ navWithAuth, user }) {
  const [scenario, setScenario] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [council, setCouncil] = useState(null);
  const [history, setHistory] = useState(() => {
    if (typeof window === 'undefined') return [];
    return JSON.parse(window.localStorage.getItem('bondsba-council-history') || '[]');
  });
  const hasSession = Boolean(user);

  const runCouncil = async () => {
    if (!scenario.trim()) return;
    setLoading(true);
    setError('');
    setCouncil(null);
    try {
      const prompt = `Analyze this contractor submission decision scenario:\n${scenario}\n\nReturn JSON with this exact shape:
{
  "broker": {"stance":"", "topRisks":["",""], "nextAction":""},
  "cpa_cfo": {"stance":"", "topRisks":["",""], "nextAction":""},
  "surety_producer": {"stance":"", "topRisks":["",""], "nextAction":""},
  "executive": {"stance":"", "topRisks":["",""], "nextAction":""},
  "consensus": {"decision":"go|conditional|no-go", "reason":"", "todayChecklist":["","",""]}
}`;
      const systemInstruction = 'You are BondSBA Decision Council for contractor finance and surety workflows. Be concise, practical, and risk-aware.';
      const result = await fetchAI(prompt, systemInstruction, true);
      setCouncil(result);
      const next = [{ ts: new Date().toISOString(), scenario: scenario.slice(0, 180), decision: result?.consensus?.decision || 'n/a' }, ...history].slice(0, 8);
      setHistory(next);
      window.localStorage.setItem('bondsba-council-history', JSON.stringify(next));
      trackEvent('workflow_start', { workflow: 'decision_council' });
    } catch (e) {
      const msg = String(e?.message || '');
      if (msg.includes('Authentication') || msg.includes('401') || msg.includes('403')) {
        setError('Sign in required to run Decision Council.');
      } else {
        setError('Decision Council unavailable. Check AI config and retry.');
      }
    } finally {
      setLoading(false);
    }
  };
  return (
    <section className="border border-slate-300 bg-white p-5">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">Decision Council</p>
          <h2 className={T.sectionHead}>Four-Perspective Decision Support</h2>
          <p className="text-sm text-slate-600 mt-1">Broker, CPA/CFO, surety producer, and executive viewpoints in one pass.</p>
        </div>
        <button onClick={() => navWithAuth('suretyDashboard')} className={T.btnSecondary + ' text-xs py-1.5 px-3'}>Open Workspace</button>
      </div>

      <div className="grid md:grid-cols-[minmax(0,1fr)_180px] gap-3">
        <textarea
          value={scenario}
          onChange={(e) => setScenario(e.target.value)}
          className={T.input + ' min-h-[112px]'}
          placeholder="Example: $2.8M bonded school project, thin working capital, WIP shows two underbilled jobs, owner credit 655, urgent bid deadline."
        />
        <button onClick={runCouncil} disabled={loading || !scenario.trim()} className={T.btnPrimary + ' justify-center h-fit'}>
          {loading ? 'Running…' : 'Run Council'}
        </button>
      </div>
      {!hasSession && (
        <p className="mt-2 text-xs text-amber-700">Sign in required. AI endpoints are auth-protected for reliability and abuse prevention.</p>
      )}
      {error && <p className="mt-2 text-xs text-red-700">{error}</p>}

      {council && (
        <div className="mt-4 grid md:grid-cols-2 gap-3">
          {[
            ['Broker', council.broker],
            ['CPA/CFO', council.cpa_cfo],
            ['Surety Producer', council.surety_producer],
            ['Executive', council.executive],
          ].map(([label, block]) => (
            <article key={label} className="border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-bold text-slate-900">{label}</p>
              <p className="text-xs text-slate-700 mt-1">{block?.stance}</p>
              <p className="text-[11px] text-slate-600 mt-2">{(block?.topRisks || []).join(' | ')}</p>
              <p className="text-xs text-slate-800 mt-2 font-medium">{block?.nextAction}</p>
            </article>
          ))}
          <article className="md:col-span-2 border border-slate-300 p-3">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-600">Consensus: {council?.consensus?.decision}</p>
            <p className="text-sm text-slate-800 mt-1">{council?.consensus?.reason}</p>
          </article>
        </div>
      )}
      {history.length > 0 && (
        <div className="mt-3 border border-slate-200 bg-slate-50 p-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600 mb-1">Recent Council Runs</p>
          {history.map((h) => <p key={h.ts} className="text-xs text-slate-700">{new Date(h.ts).toLocaleDateString()} · {h.decision} · {h.scenario}</p>)}
        </div>
      )}
    </section>
  );
}

function CrawlableLink({ href, label }) {
  return (
    <a href={href} className="text-xs font-semibold uppercase tracking-wide text-[#1B3A6B] hover:text-[#0A2540] underline underline-offset-2">
      {label}
    </a>
  );
}

function CTAButton({ action, nav, navWithAuth, className }) {
  const handler = action.requiresAuth ? navWithAuth : nav;
  return (
    <button onClick={() => handler(action.page)} className={className}>
      {action.label} <ChevronRight className="w-3.5 h-3.5" />
    </button>
  );
}

function SEOLandingPage({ pageId, nav, navWithAuth }) {
  const content = SEO_LANDING_CONTENT[pageId];
  const relatedLinks = SEO_LINKS.filter((link) => link.id !== pageId);
  const theme = PAGE_THEMES[pageId] || PAGE_THEMES.home;
  const trustSignals = [
    'Workflow-first submission prep',
    'Spreadsheet-compatible operations',
    'Owner-scoped execution rhythm',
  ];
  const pathway = [
    'Review requirements in context',
    'Open the matching workflow',
    'Resolve blockers before handoff',
    'Export a cleaner partner-ready packet',
  ];

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Ready to prep the file?</p>
            <p className="text-sm text-slate-700">Move from guide content into live workflow actions.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => nav('readinessEngine')} className="inline-flex h-10 items-center rounded-[10px] border border-[#0B1F3A] bg-[#0B1F3A] px-3 text-sm font-semibold text-white hover:bg-[#12365F]">
              Run Readiness Check
            </button>
            <button onClick={() => navWithAuth('wip')} className="inline-flex h-10 items-center rounded-[10px] border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-900 hover:bg-slate-50">
              Review WIP
            </button>
          </div>
        </div>
      </section>

      <section className={`border border-slate-300 p-6 rounded-xl shadow-sm ${theme.band}`}>
        <div className="grid gap-5 lg:grid-cols-[1.2fr,0.8fr]">
          <div className="max-w-4xl">
            <p className={`text-sm font-semibold uppercase tracking-wide mb-2 ${theme.accent}`}>{content.eyebrow}</p>
            <h1 className="text-4xl font-extrabold text-slate-900 leading-tight">{content.title}</h1>
            <p className="mt-3 text-base text-slate-700 leading-relaxed max-w-3xl">{content.intro}</p>
          </div>
          <aside className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">What teams trust here</p>
            <div className="mt-3 space-y-2">
              {trustSignals.map((signal) => (
                <p key={signal} className="text-sm text-slate-700">{signal}</p>
              ))}
            </div>
            <p className="mt-3 text-xs text-slate-500">Outputs support professional review and do not replace underwriting decisions.</p>
          </aside>
        </div>
        <div className="mt-4 flex flex-col sm:flex-row gap-3">
          <CTAButton action={content.primaryCta} nav={nav} navWithAuth={navWithAuth} className={T.btnPrimary + ' justify-center text-sm px-5 py-3'} />
          <CTAButton action={content.secondaryCta} nav={nav} navWithAuth={navWithAuth} className={T.btnSecondary + ' justify-center text-sm px-5 py-3'} />
        </div>
      </section>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_280px] gap-5">
        <section className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            {content.sections.map(([title, copy]) => (
              <article key={title} className="border border-slate-300 bg-white p-5 rounded-xl shadow-sm">
                <h2 className="text-lg font-bold text-slate-900">{title}</h2>
                <p className="mt-2 text-sm text-slate-700 leading-relaxed">{copy}</p>
              </article>
            ))}
          </div>

          <section className="border border-slate-300 bg-white p-5 rounded-xl shadow-sm">
            <div className="flex items-center justify-between gap-3 mb-3">
              <h2 className="text-xl font-bold text-slate-900">Related Guides & Tools</h2>
              <button onClick={() => nav(content.supportPage.page)} className={T.btnGhost + ' text-sm'}>
                {content.supportPage.label} →
              </button>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {relatedLinks.map((link) => (
                <div key={link.id} className="border border-slate-200 bg-slate-50 p-4 rounded-lg">
                  <CrawlableLink href={link.path} label={link.label} />
                  <p className="mt-2 text-sm text-slate-700 leading-relaxed">Open the guide, then move into the matching workflow.</p>
                </div>
              ))}
            </div>
          </section>

          <section className="border border-slate-300 bg-white p-5 rounded-xl shadow-sm">
            <h2 className="text-xl font-bold text-slate-900">Frequently Asked Questions</h2>
            <div className="mt-3 grid md:grid-cols-2 gap-4">
              {PAGE_STRUCTURED_DATA[pageId]
                .find((item) => item['@type'] === 'FAQPage')
                .mainEntity
                .map((faq) => (
                  <article key={faq.name} className="border-t border-slate-200 pt-3">
                    <h3 className="text-base font-bold text-slate-900">{faq.name}</h3>
                    <p className="mt-1 text-sm text-slate-700 leading-relaxed">{faq.acceptedAnswer.text}</p>
                  </article>
                ))}
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Move from research to file prep.</p>
                <p className="text-sm text-slate-700">Open workflow tools and prepare a cleaner lender or surety handoff.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => nav('opsQueue')} className="inline-flex h-10 items-center rounded-[10px] border border-[#0B1F3A] bg-[#0B1F3A] px-3 text-sm font-semibold text-white hover:bg-[#12365F]">
                  Open Workspace
                </button>
                <button onClick={() => nav('handoffMemos')} className="inline-flex h-10 items-center rounded-[10px] border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-900 hover:bg-slate-50">
                  Generate Handoff Memo
                </button>
              </div>
            </div>
          </section>

        </section>

        <aside className="space-y-4">
          <div className="border border-slate-300 bg-white p-4 rounded-xl shadow-sm">
            <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">Next Step</p>
            <p className="text-base text-slate-800 leading-relaxed">
              Move from research into action with the matching BondSBA tool flow, then package the result into a cleaner partner-ready submission.
            </p>
            <div className="mt-3 flex flex-col gap-2">
              <CTAButton action={content.primaryCta} nav={nav} navWithAuth={navWithAuth} className={T.btnPrimary + ' justify-center w-full'} />
              <CTAButton action={content.secondaryCta} nav={nav} navWithAuth={navWithAuth} className={T.btnSecondary + ' justify-center w-full'} />
            </div>
          </div>
          <div className="border border-slate-300 bg-white p-4 rounded-xl shadow-sm">
            <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">Workflow Path</p>
            <div className="space-y-2">
              {pathway.map((step, idx) => (
                <div key={step} className="flex items-start gap-2">
                  <span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full border border-slate-300 bg-slate-50 text-[11px] font-semibold text-slate-600">{idx + 1}</span>
                  <p className="text-sm text-slate-700">{step}</p>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function SBA504CalculatorLanding({ nav, navWithAuth }) {
  const [projectCost, setProjectCost] = useState('2500000');
  const [cdcRate, setCdcRate] = useState('6.35');
  const [bankRate, setBankRate] = useState('8.50');
  const [mfr, setMfr] = useState(false);
  const amount = Number(projectCost.replace(/,/g, '')) || 0;
  const project = useMemo(() => calculateSBA504Project({
    projectCost: amount,
    bankRate: Number(bankRate) || 0,
    cdcRate: Number(cdcRate) || 0,
    bankTermYears: 25,
    cdcTermYears: 25,
    borrowerNAICS: mfr ? 311 : 236,
  }), [amount, bankRate, cdcRate, mfr]);
  const usd = (v) => v.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  const usd2 = (v) => v.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="space-y-6">
      <section className="border border-slate-300 bg-white p-6 rounded-xl shadow-sm">
        <div className="grid gap-6 lg:grid-cols-[1fr,380px]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">SBA 504 Calculator</p>
            <h1 className="mt-2 text-4xl font-extrabold tracking-tight text-slate-900">Model the 504 capital stack before the lender conversation.</h1>
            <p className="mt-3 max-w-3xl text-base leading-relaxed text-slate-700">
              Estimate the 50% bank loan, 40% CDC debenture, 10% borrower injection, monthly debt service, and FY2026 504 fee treatment for owner-occupied real estate or major equipment.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button onClick={() => navWithAuth('calculator')} className={T.btnPrimary}>Open Full SBA Calculator</button>
              <button onClick={() => nav('compare')} className={T.btnSecondary}>Compare 7(a) vs 504</button>
            </div>
          </div>
          <aside className="border border-slate-200 bg-slate-50 p-4 rounded-lg">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">FY2026 Fee Posture</p>
            <p className="mt-2 text-sm text-slate-700">Standard 504: 0.50% upfront guaranty fee and 0.209% annual service fee on the CDC portion. NAICS 31-33 manufacturers: both are waived for FY2026.</p>
          </aside>
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-[420px,1fr]">
        <div className={T.card + ' p-5'}>
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-900">Project Inputs</h2>
          <div className="mt-4 space-y-4">
            <div>
              <label className={T.label} htmlFor="sba504-project-cost">Total Project Cost</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-500">$</span>
                <input
                  id="sba504-project-cost"
                  value={Number(projectCost.replace(/,/g, '')).toLocaleString()}
                  onChange={(e) => setProjectCost(e.target.value.replace(/[^0-9]/g, ''))}
                  className={T.input + ' pl-7'}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={T.label} htmlFor="sba504-bank-rate">Bank Rate</label>
                <input id="sba504-bank-rate" value={bankRate} onChange={(e) => setBankRate(e.target.value.replace(/[^0-9.]/g, ''))} className={T.input} />
              </div>
              <div>
                <label className={T.label} htmlFor="sba504-cdc-rate">CDC Rate</label>
                <input id="sba504-cdc-rate" value={cdcRate} onChange={(e) => setCdcRate(e.target.value.replace(/[^0-9.]/g, ''))} className={T.input} />
              </div>
            </div>
            <label className="flex items-start gap-3 border-t border-slate-200 pt-3 text-sm text-slate-700">
              <input type="checkbox" checked={mfr} onChange={(e) => setMfr(e.target.checked)} className="mt-1" />
              <span><strong className="text-slate-900">NAICS 31-33 manufacturer</strong><br />Apply FY2026 504 upfront and annual service fee waiver.</span>
            </label>
          </div>
        </div>

        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-4">
            {[
              ['Bank Loan', project.bankLoanAmount],
              ['CDC Loan', project.cdcLoanAmount],
              ['Borrower Injection', project.borrowerEquity],
              ['Monthly Debt Service', project.blendedMonthlyPayment],
            ].map(([label, value]) => (
              <div key={label} className="border border-slate-200 bg-white p-4 rounded-lg">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
                <p className="mt-1 text-xl font-bold tabular-nums text-slate-900">{label === 'Monthly Debt Service' ? usd2(value) : usd(value)}</p>
              </div>
            ))}
          </div>
          <div className="border border-slate-300 bg-white rounded-lg overflow-hidden">
            <table className="w-full border-collapse text-sm">
              <tbody className="divide-y divide-slate-200">
                {[
                  ['Bank portion', `${usd(project.bankLoanAmount)} at ${bankRate}%`],
                  ['CDC portion', `${usd(project.cdcLoanAmount)} at ${cdcRate}%`],
                  ['Borrower injection', `${usd(project.borrowerEquity)} (${project.equityPercent.toFixed(0)}%)`],
                  ['504 upfront guaranty fee', project.manufacturerWaiverApplied ? '$0 waived' : usd(project.upfrontGuarantyFee)],
                  ['First-year annual service fee', project.manufacturerWaiverApplied ? '$0 waived' : usd(project.firstYearAnnualServiceFee)],
                ].map(([label, value]) => (
                  <tr key={label}>
                    <td className="px-4 py-3 font-semibold text-slate-700">{label}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-900">{value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}

function OverviewLegacy({ nav, navWithAuth, user }) {
  const navTracked = (target, context, requiresAuth = false) => {
    trackEvent('cta_click', { target, context });
    if (requiresAuth) navWithAuth(target);
    else nav(target);
  };

  const TRUST_PILLS = [
    'Built for contractor finance teams',
    'Surety + lender workflows',
    'WIP-first operational review',
    'Professional review required',
  ];

  const HERO_METRICS = [
    ['Submission Readiness', '78%'],
    ['WIP Quality', '74'],
    ['Operational Risk', '63'],
    ['Critical Missing', '3'],
  ];

  const PIPELINE_ROWS = [
    { file: 'SB-1042', contractor: 'Ridgeway Civil', owner: 'Broker', status: 'Needs Follow-Up', docs: '9/12' },
    { file: 'SB-1048', contractor: 'Harbor Utility', owner: 'Surety', status: 'WIP Review', docs: '11/12' },
    { file: 'SB-1051', contractor: 'Northline Paving', owner: 'CPA/CFO', status: 'Ready for Handoff', docs: '12/12' },
  ];

  const PERSONA_LANES = [
    {
      id: 'broker',
      title: 'Contractor-Heavy Brokers',
      thisWeek: 'Clear blockers, assign owners, and ship cleaner files by Friday.',
      primary: { page: 'opsQueue', label: 'Open Ops Queue' },
      secondary: { page: 'screener', label: 'Run Screener' },
      accent: 'border-t-blue-600',
    },
    {
      id: 'cpa',
      title: 'Construction CPAs / Fractional CFOs',
      thisWeek: 'Harden WIP and financial consistency before external review.',
      primary: { page: 'checklist', label: 'Open Checklist' },
      secondary: { page: 'requirements', label: 'Review Requirements' },
      accent: 'border-t-indigo-600',
    },
    {
      id: 'surety',
      title: 'Surety Producers',
      thisWeek: 'Triage contractor files before underwriter time is spent.',
      primary: { page: 'suretyDashboard', label: 'Open Workspace', requiresAuth: true },
      secondary: { page: 'surety', label: 'Open Surety Guide' },
      accent: 'border-t-emerald-600',
    },
  ];

  const WORKFLOW_STEPS = [
    { step: '01', title: 'Intake + Normalize', copy: 'Ingest contractor packet and normalize key fields.' },
    { step: '02', title: 'Readiness + Gaps', copy: 'Score readiness and isolate critical missing items.' },
    { step: '03', title: 'WIP Intelligence', copy: 'Flag margin fade, underbilling stress, and concentration risk.' },
    { step: '04', title: 'Structured Handoff', copy: 'Export lender/surety memo with owner-ready next actions.' },
  ];

  const PRODUCT_SURFACES = [
    { id: 'opsQueue', name: 'Submission Workspace', benefit: 'Run owner-based daily follow-up operations with clear status ownership.', icon: Layers, signal: 'Queue + alerts + handoff status' },
    { id: 'wip', name: 'WIP Intelligence Engine', benefit: 'Detect margin fade, underbilling stress, and concentration pressure.', icon: Activity, signal: 'WIP quality + operational risk score', requiresAuth: true },
    { id: 'contractorReadiness', name: 'Submission Readiness Engine', benefit: 'Resolve missing items before underwriter review time is spent.', icon: CheckSquare, signal: 'Readiness % + critical gaps' },
    { id: 'suretyDashboard', name: 'Contractor Operational Profiles', benefit: 'Keep persistent contractor packet history and recurring risk context.', icon: Users, signal: 'Saved packets + profile notes', requiresAuth: true },
    { id: 'suretyDashboard', name: 'Handoff Memo Generator', benefit: 'Export lender-ready and surety-ready narrative outputs in one click.', icon: FileText, signal: 'Memo save + export controls', requiresAuth: true },
    { id: 'trust', name: 'Operational Trust Layer', benefit: 'Validate auth, ownership boundaries, and control posture for sensitive files.', icon: Shield, signal: 'Control matrix + audit posture' },
  ];

  const DIFFERENTIATORS = [
    ['SOP Delta-to-Task Engine', 'Policy change converts directly into checklist updates before send.'],
    ['90-Day WIP Freshness Guard', 'Blocks stale WIP from getting exported into handoff packets.'],
    ['One-Click WIP Ingest', 'Excel/CSV import replaces manual row-by-row re-entry work.'],
    ['Re-Ask Prevention Scoring', 'Pre-flags likely underwriter follow-ups so teams fix upfront.'],
    ['Underbilling / Profit-Fade Risk Sentinel', 'Flags hidden working-capital and fade stress before partner pushback.'],
    ['CPA-Grade Packet Verifier', 'Finds financial consistency gaps before rejection loops start.'],
    ['Shared Handoff Ledger', 'Broker, CPA/CFO, and surety teams work from one owner-scoped source of truth.'],
    ['Manufacturing Advantage Trigger', 'Highlights MARC and fee-logic advantages when applicable.'],
  ];

  const MOBILE_ROLE_LANES = PERSONA_LANES.map((lane) => ({
    id: lane.id,
    title: lane.title,
    action: lane.primary,
  }));

  const MOBILE_CORE_MODULES = PRODUCT_SURFACES.slice(0, 4);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 text-slate-900 md:px-8 md:py-10 space-y-6 md:space-y-10">
      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5 md:p-8">
        <div className="grid gap-7 lg:grid-cols-[1.05fr,1fr]">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">Pre-Underwriting Operating System</p>
            <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl md:text-5xl leading-tight">
              Cleaner contractor submissions before underwriting.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-relaxed text-slate-700">
              BondSBA organizes contractor readiness, WIP analysis, and handoff quality so brokers, CPAs, and surety teams spend less time chasing files and more time moving qualified submissions forward.
            </p>
            <div className="mt-5 grid gap-2 sm:flex sm:flex-wrap sm:gap-3">
              <button
                onClick={() => navTracked('opsQueue', 'overview_primary_workspace')}
                className={T.btnPrimary + ' justify-center px-5 py-3 w-full sm:w-auto'}
              >
                Open Submission Workspace
              </button>
              <button
                onClick={() => navTracked('wip', 'overview_secondary_wip', true)}
                className={T.btnSecondary + ' justify-center px-5 py-3 w-full sm:w-auto'}
              >
                Analyze WIP Schedule
              </button>
              <button
                onClick={() => navTracked('suretyDashboard', 'overview_secondary_surety_workspace')}
                className={T.btnSecondary + ' px-5 py-3 hidden sm:inline-flex'}
              >
                Open Triage Workspace
              </button>
            </div>
            <button
              onClick={() => navTracked('suretyDashboard', 'overview_secondary_surety_workspace_mobile')}
              className={T.btnGhost + ' sm:hidden w-full justify-center mt-1'}
            >
              Open Triage Workspace
            </button>
            <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Trusted Operating Posture</p>
              <p className="mt-1 text-sm text-slate-700">
                Built for broker, CPA/CFO, and surety handoff prep with clear queue ownership, cleaner file packaging, and practical daily execution.
              </p>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              {TRUST_PILLS.map((pill, idx) => (
                <span
                  key={pill}
                  className={`rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-600 ${
                    idx > 1 ? 'hidden sm:inline-flex' : 'inline-flex'
                  }`}
                >
                  {pill}
                </span>
              ))}
            </div>
          </div>

          <aside className="rounded-xl border border-slate-200 bg-slate-50 p-4 md:p-5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Operational Snapshot</p>
              <span className="rounded-full text-[11px] font-semibold uppercase tracking-wide text-slate-500 border border-slate-300 bg-white px-2.5 py-1">Sample Data</span>
            </div>
            <div className="mt-2 flex items-center justify-between gap-2 text-xs text-slate-500">
              <span>Data freshness: 2h ago</span>
              <span>Owner changes audited</span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3">
              {HERO_METRICS.map(([label, value]) => (
                <div key={label} className="rounded-lg border border-slate-200 bg-white px-3 py-2.5">
                  <p className="text-[11px] uppercase tracking-wide text-slate-500">{label}</p>
                  <p className="mt-0.5 text-2xl font-bold tabular-nums text-slate-900">{value}</p>
                </div>
              ))}
            </div>
            <div className="mt-3 rounded-lg border border-slate-200 bg-white overflow-hidden">
              <table className="hidden sm:table w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">File</th>
                    <th className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Status</th>
                    <th className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-right text-slate-500">Docs</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {PIPELINE_ROWS.map((row, idx) => (
                    <tr key={row.file} className={idx % 2 === 1 ? 'bg-slate-50' : 'bg-white'}>
                      <td className="px-3 py-2">
                        <p className="font-semibold text-slate-900">{row.file}</p>
                        <p className="text-xs text-slate-500">{row.contractor}</p>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-1">
                          <span className="inline-flex rounded border border-slate-300 bg-white px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-700">{row.status}</span>
                          <span className="inline-flex rounded border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-blue-700">{row.owner}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right font-semibold tabular-nums text-slate-700">{row.docs}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="sm:hidden divide-y divide-slate-100">
                {PIPELINE_ROWS.map((row) => (
                  <div key={row.file} className="px-3 py-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{row.file}</p>
                        <p className="text-xs text-slate-500">{row.contractor}</p>
                      </div>
                      <span className="text-sm font-semibold tabular-nums text-slate-700">{row.docs}</span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      <span className="inline-flex rounded border border-slate-300 bg-white px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-700">{row.status}</span>
                      <span className="inline-flex rounded border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-blue-700">{row.owner}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </section>

      <section className="md:hidden rounded-2xl border border-slate-200 bg-white shadow-sm p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-xl font-bold text-slate-900">Start by Role</h2>
          <span className="text-xs uppercase tracking-wide text-slate-500 font-semibold">10 sec</span>
        </div>
        <div className="mt-3 grid gap-2">
          {MOBILE_ROLE_LANES.map((lane) => (
            <button
              key={lane.id}
              onClick={() => navTracked(lane.action.page, `overview_mobile_lane_${lane.id}`, Boolean(lane.action.requiresAuth))}
              className={T.btnSecondary + ' justify-between w-full'}
            >
              <span className="text-left">{lane.title}</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          ))}
        </div>
      </section>

      <section className="md:hidden rounded-2xl border border-slate-200 bg-white shadow-sm p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-xl font-bold text-slate-900">Operating Flow</h2>
          <Clock className="w-4 h-4 text-slate-500" />
        </div>
        <div className="mt-3 space-y-2">
          {WORKFLOW_STEPS.map((step) => (
            <div key={step.step} className="border border-slate-200 rounded-lg bg-slate-50 px-3 py-2.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Step {step.step}</p>
              <p className="text-base font-semibold text-slate-900 mt-0.5">{step.title}</p>
              <p className="text-sm text-slate-700 mt-0.5">{step.copy}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="hidden md:grid gap-4 lg:grid-cols-[1.2fr,0.8fr]">
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-2xl font-bold text-slate-900">Role Lanes</h2>
            <span className="text-sm text-slate-500">Choose your lane and move this week’s files.</span>
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-3">
          {PERSONA_LANES.map((lane) => (
            <article key={lane.id} className={`border border-slate-200 border-t-4 rounded-xl bg-white p-4 ${lane.accent}`}>
              <p className="text-sm font-semibold uppercase tracking-wide text-slate-600">{lane.title}</p>
              <p className="mt-2 text-base text-slate-700 leading-relaxed">{lane.thisWeek}</p>
              <div className="mt-3 flex flex-col gap-2">
                <button
                  onClick={() => navTracked(lane.primary.page, `overview_lane_${lane.id}_primary`, Boolean(lane.primary.requiresAuth))}
                  className={T.btnPrimary + ' justify-center'}
                >
                  {lane.primary.label}
                </button>
                <button
                  onClick={() => navTracked(lane.secondary.page, `overview_lane_${lane.id}_secondary`, Boolean(lane.secondary.requiresAuth))}
                  className={T.btnSecondary + ' justify-center'}
                >
                  {lane.secondary.label}
                </button>
              </div>
            </article>
          ))}
          </div>
        </div>
        <aside className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-xl font-bold text-slate-900">Operating Flow</h3>
            <Clock className="w-4 h-4 text-slate-500" />
          </div>
          <div className="mt-3 space-y-3">
            {WORKFLOW_STEPS.map((step) => (
              <div key={step.step} className="border border-slate-200 rounded-lg bg-slate-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Step {step.step}</p>
                <p className="text-base font-semibold text-slate-900 mt-1">{step.title}</p>
                <p className="text-sm text-slate-700 mt-1">{step.copy}</p>
              </div>
            ))}
          </div>
        </aside>
      </section>

      <section className="hidden md:block rounded-2xl border border-slate-200 bg-white shadow-sm p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-2xl font-bold text-slate-900">Core Modules</h2>
          <button onClick={() => navTracked('contractorReadiness', 'overview_tools_methodology')} className={T.btnSecondary + ' text-sm'}>
            Open Methodology
          </button>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {PRODUCT_SURFACES.map((surface) => (
            <article key={surface.id} className="border border-slate-200 rounded-xl px-4 py-3 bg-white">
              <div className="flex items-center justify-between gap-2">
                <div className="inline-flex items-center gap-2">
                  {React.createElement(surface.icon, { className: 'w-4 h-4 text-slate-700' })}
                  <p className="text-sm font-bold uppercase tracking-wide text-slate-700">{surface.name}</p>
                </div>
                <button
                  onClick={() => navTracked(surface.id, `overview_surface_${surface.id}`, Boolean(surface.requiresAuth))}
                  className={T.btnSecondary + ' text-sm px-3 py-1.5'}
                >
                  Open
                </button>
              </div>
              <p className="mt-2 text-sm text-slate-700">{surface.benefit}</p>
              <p className="mt-1 text-xs text-slate-500">{surface.signal}</p>
            </article>
          ))}
        </div>
      </section>

      <details className="md:hidden rounded-2xl border border-slate-200 bg-white shadow-sm" open={false}>
        <summary className="cursor-pointer list-none px-4 py-3.5 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Core Modules</p>
            <p className="text-base font-semibold text-slate-900">Open key tools</p>
          </div>
          <span className="text-sm text-slate-500">Open</span>
        </summary>
        <div className="px-4 pb-4 grid gap-2.5">
          {MOBILE_CORE_MODULES.map((surface) => (
            <button
              key={`${surface.id}-${surface.name}`}
              onClick={() => navTracked(surface.id, `overview_mobile_surface_${surface.id}`, Boolean(surface.requiresAuth))}
              className={T.btnSecondary + ' justify-between w-full'}
            >
              <span className="text-left">{surface.name}</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          ))}
          <button onClick={() => navTracked('contractorReadiness', 'overview_tools_methodology_mobile')} className={T.btnPrimary + ' justify-center w-full'}>
            Open Methodology
          </button>
        </div>
      </details>

      <section className="hidden md:grid gap-4 md:grid-cols-2">
        <article className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-600">Before</p>
          <ul className="mt-2 space-y-1.5 text-sm text-slate-600">
              <li>Spreadsheet + PDF cleanup loops</li>
              <li>Email-driven follow-up and unclear ownership</li>
              <li>Stale WIP and repeated underwriter re-asks</li>
          </ul>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-600">After</p>
          <ul className="mt-2 space-y-1.5 text-sm text-slate-700">
              <li>Owner-scoped submission operations queue</li>
              <li>Readiness + WIP signals before handoff</li>
              <li>Cleaner lender and surety package exports</li>
          </ul>
        </article>
      </section>

      <details className="md:hidden rounded-2xl border border-slate-200 bg-white shadow-sm" open={false}>
        <summary className="cursor-pointer list-none px-4 py-3.5 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Before / After</p>
            <p className="text-base font-semibold text-slate-900">Why teams switch</p>
          </div>
          <span className="text-sm text-slate-500">Open</span>
        </summary>
        <div className="px-4 pb-4 space-y-3">
          <article className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-600">Before</p>
            <ul className="mt-2 space-y-1.5 text-sm text-slate-700">
              <li>Spreadsheet + PDF cleanup loops</li>
              <li>Email-driven follow-up and unclear ownership</li>
              <li>Stale WIP and repeated underwriter re-asks</li>
            </ul>
          </article>
          <article className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-600">After</p>
            <ul className="mt-2 space-y-1.5 text-sm text-slate-700">
              <li>Owner-scoped submission operations queue</li>
              <li>Readiness + WIP signals before handoff</li>
              <li>Cleaner lender and surety package exports</li>
            </ul>
          </article>
        </div>
      </details>

      <section className="hidden md:block rounded-2xl border border-slate-200 bg-white shadow-sm p-5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-2xl font-bold text-slate-900">Differentiators In Production Workflow</h2>
          <Info className="w-4 h-4 text-slate-500" />
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
            {DIFFERENTIATORS.map(([name, value]) => (
            <div key={name} className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-sm font-semibold text-slate-900">{name}</p>
                <p className="text-sm text-slate-700 mt-1">{value}</p>
              </div>
            ))}
          </div>
      </section>

      <details className="md:hidden rounded-2xl border border-slate-200 bg-white shadow-sm" open={false}>
        <summary className="cursor-pointer list-none px-4 py-3.5 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Differentiators</p>
            <p className="text-base font-semibold text-slate-900">Production workflow edges</p>
          </div>
          <span className="text-sm text-slate-500">Open</span>
        </summary>
        <div className="px-4 pb-4 grid gap-2.5">
          {DIFFERENTIATORS.slice(0, 5).map(([name, value]) => (
            <div key={name} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
              <p className="text-sm font-semibold text-slate-900">{name}</p>
              <p className="text-sm text-slate-700 mt-1">{value}</p>
            </div>
          ))}
        </div>
      </details>

      <details className="rounded-2xl border border-slate-200 bg-white shadow-sm" open={false}>
        <summary className="cursor-pointer list-none px-5 py-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Advanced Operations</p>
            <p className="text-base font-semibold text-slate-900">Role cadence, repeat-visit workflows, and Excel companion</p>
          </div>
          <span className="text-sm text-slate-500">Open</span>
        </summary>
        <div className="px-5 pb-5">
          <RepeatVisitHub nav={nav} navWithAuth={navWithAuth} />
        </div>
      </details>

      <details className="rounded-2xl border border-slate-200 bg-white shadow-sm" open={false}>
        <summary className="cursor-pointer list-none px-5 py-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Decision Support</p>
            <p className="text-base font-semibold text-slate-900">Four-perspective council for complex file decisions</p>
          </div>
          <span className="text-sm text-slate-500">Open</span>
        </summary>
        <div className="px-5 pb-5">
          <DecisionCouncilPanel navWithAuth={navWithAuth} user={user} />
        </div>
      </details>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-xl font-bold text-slate-900">Daily Use Loop</h3>
            <p className="text-base text-slate-700 mt-1">
              Start in queue, resolve blockers, run WIP checks, then export handoff. Repeat every day on live files.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => navTracked('opsQueue', 'overview_daily_loop_queue')} className={T.btnPrimary}>
              Open Queue
              <ArrowRight className="w-4 h-4" />
            </button>
            <button onClick={() => navTracked('suretyDashboard', 'overview_daily_loop_workspace', true)} className={T.btnSecondary}>
              Open Workspace
            </button>
          </div>
        </div>
        {!user && (
          <p className="mt-3 text-sm text-slate-600">
            Sign in to run protected analysis workflows and save packet outputs.
          </p>
        )}
        <p className="mt-3 text-xs text-slate-500">
          {COMPLIANCE_DISCLAIMER}
        </p>
      </section>
    </div>
  );
}

function ScoreRing({ score }) {
  const clampedScore = Math.max(0, Math.min(100, score));
  const color = clampedScore >= 85 ? '#059669' : clampedScore >= 70 ? '#d97706' : '#dc2626';
  return (
    <div className="relative mx-auto flex h-28 w-28 items-center justify-center">
      <svg className="absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 112 112">
        <circle cx="56" cy="56" r="46" fill="none" stroke="#e2e8f0" strokeWidth="10" />
        <circle
          cx="56" cy="56" r="46" fill="none"
          stroke={color} strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={`${2 * Math.PI * 46}`}
          strokeDashoffset={`${2 * Math.PI * 46 * (1 - clampedScore / 100)}`}
          style={{ transition: 'stroke-dashoffset 0.6s ease, stroke 0.4s ease' }}
        />
      </svg>
      <div className="text-center">
        <p className="text-2xl font-bold tabular-nums leading-none" style={{ color }}>{clampedScore}</p>
        <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Score</p>
      </div>
    </div>
  );
}

function Overview({ nav, navWithAuth = nav, jurisdiction = 'US', region = '', initialLane = 'sba' }) {
  const [filePrepState, setFilePrepState] = useState(DEFAULT_FILE_PREP_STATE);
  const [homeLane, setHomeLane] = useState(initialLane === 'bond' || initialLane === 'surety' ? 'bond' : 'sba');
  const analysis = useMemo(() => evaluateFilePrepState(filePrepState), [filePrepState]);
  const j = findJurisdiction(jurisdiction);
  const r = findRegion(jurisdiction, region) || j.regions[0];
  const carrierSample = j.carriers.slice(0, 3).join(', ');
  useScrollReveal();
  const heroLane = homeLane === 'sba'
    ? {
        eyebrow: 'SBA Loan Tools · 7(a) Guaranty Fee · 504 Calculator',
        title: 'SBA calculators that move from curiosity to a usable deal structure.',
        copy: 'Estimate 7(a) guaranty fees, 504 capital stacks, monthly debt service, fee waivers, and term-sheet assumptions before a borrower packet reaches lender review.',
        primary: { label: 'Open SBA Calculator', page: 'calculator', requiresAuth: true },
        secondary: { label: 'Model SBA 504', page: 'sba504' },
        tertiary: { label: 'Compare Programs', page: 'compare' },
      }
    : {
        eyebrow: 'Surety File Prep · Pre-Underwriting Workflow',
        title: 'Cleaner contractor submissions before underwriting.',
        copy: `Score readiness, flag WIP risk, and produce a structured carrier handoff memo before the file reaches ${carrierSample}, or any ${j.label} surety market.`,
        primary: { label: 'Enter Bond Homepage', page: 'bondHome' },
        secondary: { label: 'Learn WIP Analysis', page: 'bondWipAnalysis' },
        tertiary: { label: 'Try a Sample File Check', page: 'opsQueue' },
      };
  const handleHeroNav = (action) => {
    if (action.requiresAuth) navWithAuth(action.page);
    else nav(action.page);
  };
  const sideSlides = [
    {
      id: 'sba',
      name: 'SBA',
      label: 'SBA side',
      title: 'SBA loan calculators and deal prep',
      description: 'Run 7(a) guaranty fee estimates, SBA 504 capital-stack math, program comparison, and term-sheet prep from one side of BondSBA.',
      icon: Landmark,
      actions: [
        { label: 'Open SBA Calculator', page: 'calculator', requiresAuth: true },
        { label: 'SBA 504 Calculator', page: 'sba504' },
      ],
      bullets: ['7(a) guaranty fee', '504 bank / CDC / equity split', 'Term-sheet workflow'],
      stat: '$31.5k',
      statLabel: 'Sample 7(a) fee on $1.2M',
    },
    {
      id: 'bond',
      name: 'Bond',
      label: 'Contractor bond side',
      title: 'Contractor bond submission workflow',
      description: 'Prepare cleaner contractor bond files with readiness scoring, WIP review, financial spreading, and surety handoff output.',
      icon: Shield,
      actions: [
        { label: 'Enter Bond Homepage', page: 'bondHome' },
        { label: 'Learn WIP Analysis', page: 'bondWipAnalysis' },
      ],
      bullets: ['Contractor readiness', 'WIP risk review', 'Surety handoff memo'],
      stat: `${analysis.score}%`,
      statLabel: 'Sample readiness score',
    },
  ];
  const activeSlide = sideSlides.find((slide) => slide.id === homeLane) || sideSlides[0];
  const enterLaneHome = (lane) => {
    const nextLane = lane === 'bond' || lane === 'surety' ? 'bond' : 'sba';
    setHomeLane(nextLane);
    nav(nextLane === 'bond' ? 'bondHome' : 'sbaHome');
  };

  return (
    <div className="space-y-16 pb-10">
      {/* Reception desk — entry screen, pick a lane */}
      <ReceptionDesk onPickLane={enterLaneHome} />

      {/* Hero — asymmetric split, bigger presence */}
      <section id="lane-hero" className="pt-6 pb-8 md:pt-10 md:pb-12">
        <div className="grid gap-10 lg:grid-cols-[1.15fr_1fr] lg:items-center lg:gap-16">
          {/* Left — copy */}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{heroLane.eyebrow}</p>
            <h1 className="mt-4 text-[42px] font-semibold leading-[1.02] tracking-[-0.03em] text-slate-900 md:text-[60px] xl:text-[72px]">
              {heroLane.title}
            </h1>
            <p className="mt-6 max-w-xl text-[18px] leading-[1.5] text-slate-600 md:text-[19px]">
              {heroLane.copy}
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-3">
              <button onClick={() => handleHeroNav(heroLane.primary)} className="inline-flex h-14 items-center justify-center rounded-md bg-[#0B1F3A] px-7 text-[16px] font-semibold text-white shadow-[0_8px_22px_-6px_rgba(11,31,58,0.5)] hover:bg-[#12365F]">
                {heroLane.primary.label}
              </button>
              <button onClick={() => handleHeroNav(heroLane.secondary)} className="inline-flex h-12 items-center justify-center gap-1 text-[14px] font-semibold text-slate-700 hover:text-slate-900">
                {heroLane.secondary.label} →
              </button>
            </div>
            <button
              onClick={() => handleHeroNav(heroLane.tertiary)}
              className="mt-3 text-[12px] font-semibold text-slate-600 hover:text-slate-900"
            >
              {heroLane.tertiary.label}
            </button>

            {/* Powered by — high-value integration credibility strip */}
            <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-2 text-[12px] text-slate-500">
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Powered by</span>
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-[#2CA01C] text-[9px] font-bold text-white">QB</span>
                <span>QuickBooks</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-[#F47E42] text-[9px] font-bold text-white">PC</span>
                <span>Procore</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-slate-900 text-[9px] font-bold text-white">G</span>
                <span>Google Document AI</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-[#635BFF] text-[9px] font-bold text-white">$</span>
                <span>Stripe</span>
              </span>
            </div>
          </div>

          {/* Right — active side slide */}
          <div className="lg:pl-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_24px_60px_-20px_rgba(15,23,42,0.18)] lg:p-7">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400">BondSBA entry deck</p>
                <span className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> {activeSlide.name}
                </span>
              </div>
              <div className="mt-5 flex items-start gap-5">
                <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50">
                  {React.createElement(activeSlide.icon, { className: 'h-8 w-8 text-slate-800' })}
                </div>
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-slate-500">{activeSlide.label}</p>
                  <p className="mt-0.5 text-[24px] font-semibold tracking-[-0.02em] text-slate-900">{activeSlide.title}</p>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{activeSlide.description}</p>
                </div>
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-[140px,1fr]">
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{activeSlide.statLabel}</p>
                  <p className="mt-2 text-3xl font-bold tabular-nums text-slate-900">{activeSlide.stat}</p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-white p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Included</p>
                  <div className="mt-2 space-y-1.5">
                    {activeSlide.bullets.map((bullet) => (
                      <p key={bullet} className="text-sm font-medium text-slate-700">{bullet}</p>
                    ))}
                  </div>
                </div>
              </div>
              <div className="mt-5 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
                {activeSlide.actions.map((action, index) => (
                  <button
                    key={action.label}
                    onClick={() => handleHeroNav(action)}
                    className={index === 0 ? T.btnPrimary : T.btnSecondary}
                  >
                    {action.label}
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Trust strip — under hero, full width */}
        <div className="mt-14 flex flex-wrap items-center gap-x-8 gap-y-3 border-t border-slate-200 pt-7 text-[13px] text-slate-500">
          <span>Built for surety producers</span>
          <span className="hidden h-3 w-px bg-slate-200 sm:inline-block" />
          <span>Construction lenders</span>
          <span className="hidden h-3 w-px bg-slate-200 sm:inline-block" />
          <span>Finance brokers · CPAs</span>
          <span className="hidden h-3 w-px bg-slate-200 sm:inline-block" />
          <span>Manual entry · No data stored</span>
        </div>
      </section>

      {/* Design partner cohort — honest founder-stage signal */}
      <section className="reveal">
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm md:p-7">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div className="max-w-2xl">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex h-6 items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-600">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  New · Design Partner Cohort
                </span>
                <span className="text-[12px] text-slate-400">10 spots · 6 remaining</span>
              </div>
              <h2 className="mt-3 text-[22px] font-semibold tracking-[-0.02em] text-slate-900">Help shape BondSBA — lock founder pricing for life.</h2>
              <p className="mt-2 text-[14px] leading-relaxed text-slate-600">
                We're building this with the first 10 surety agencies. Early partners get: dedicated onboarding from the founder, weekly feedback calls, your feature requests prioritized, and lifetime founder pricing (50% off all plans, forever — including future paid features).
              </p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <button onClick={() => window.location.href = 'mailto:contactbondsba@gmail.com?subject=BondSBA%20Design%20Partner%20Inquiry'} className="inline-flex h-11 items-center justify-center rounded-md border border-slate-900 bg-slate-900 px-5 text-[13px] font-semibold text-white hover:bg-slate-700">
                Apply to cohort
              </button>
              <span className="text-[11px] text-slate-400">Open until June 30</span>
            </div>
          </div>
        </div>
      </section>

      {/* Integrations — flagship feature, restructured grid */}
      <section className="reveal">
        <div className="max-w-3xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Integrations</p>
          <h2 className="mt-2 text-[28px] font-semibold tracking-[-0.02em] text-slate-900 md:text-[32px]">Stop retyping. Connect the systems your contractors already use.</h2>
          <p className="mt-3 text-[15px] leading-[1.55] text-slate-600">
            Pull revenue and balance sheet from accounting. Pull backlog and job concentration from project management. Parse the WIP schedule PDF a controller emailed you. Every number lands in the file-prep panel — no copy-paste, no re-keying.
          </p>
        </div>

        {/* Featured: Google Document AI — the differentiator */}
        <div className="mt-7 overflow-hidden rounded-xl border border-slate-900 bg-slate-900 text-white shadow-[0_24px_60px_-20px_rgba(15,23,42,0.30)]">
          <div className="grid gap-6 p-6 md:grid-cols-[1.4fr_1fr] md:items-center md:p-8">
            <div>
              <div className="flex items-center gap-3">
                <div className="flex h-9 items-center gap-1.5 rounded-md bg-white/10 px-2.5 text-[10px] font-semibold uppercase tracking-wider text-white">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-300" /> Configured provider · Review required
                </div>
              </div>
              <p className="mt-3 text-[12px] font-semibold uppercase tracking-[0.14em] text-emerald-300">Google Document AI</p>
              <h3 className="mt-1 text-[24px] font-semibold tracking-[-0.02em] md:text-[28px]">Parse a WIP schedule PDF in 8 seconds.</h3>
              <p className="mt-3 text-[14px] leading-relaxed text-slate-300">
                Drop a contractor's WIP schedule, financial statement, debt schedule, or tax return into the workspace. Google Document AI extracts contract value, billed-to-date, cost-to-complete, gross profit, and overruns line by line. Confirm or edit the fields, then apply to the file. No human typing.
              </p>
              <button onClick={() => nav('opsQueue')} className="mt-5 inline-flex h-11 items-center rounded-md bg-white px-5 text-[13px] font-semibold text-slate-900 hover:bg-slate-100">
                Upload a document
              </button>
            </div>
            <div className="rounded-lg bg-white/5 p-5 ring-1 ring-white/10">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Supported document types</p>
              <ul className="mt-3 space-y-1.5 text-[13px] text-slate-200">
                <li className="flex items-center gap-2"><span className="inline-block h-1 w-3 rounded-sm bg-emerald-400" />WIP schedule (CCC + COGS)</li>
                <li className="flex items-center gap-2"><span className="inline-block h-1 w-3 rounded-sm bg-emerald-400" />Financial statement (B/S + I/S)</li>
                <li className="flex items-center gap-2"><span className="inline-block h-1 w-3 rounded-sm bg-emerald-400" />Debt schedule</li>
                <li className="flex items-center gap-2"><span className="inline-block h-1 w-3 rounded-sm bg-emerald-400" />Tax return</li>
                <li className="flex items-center gap-2"><span className="inline-block h-1 w-3 rounded-sm bg-emerald-400" />Bank statement</li>
                <li className="flex items-center gap-2"><span className="inline-block h-1 w-3 rounded-sm bg-emerald-400" />Bond request package</li>
              </ul>
              <p className="mt-4 text-[11px] text-slate-400">Provider connection is checked before use. Extracted fields stay reviewable with source context before they update the packet.</p>
            </div>
          </div>
        </div>

        {/* Secondary: 2-card grid for QB + Procore */}
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-[#2CA01C] text-white text-[13px] font-bold">QB</div>
                <div>
                  <p className="text-[15px] font-semibold text-slate-900">QuickBooks</p>
                  <p className="text-[12px] text-slate-500">Cloud accounting</p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-700">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> OAuth ready
              </span>
            </div>
            <p className="mt-3 text-[13px] text-slate-600">Begins OAuth from the workspace, then pulls company name, Profit & Loss, and Balance Sheet after the user connects an Intuit company.</p>
            <button onClick={() => nav('opsQueue')} className="mt-4 inline-flex h-9 items-center rounded-md border border-slate-300 bg-white px-3 text-[12px] font-semibold text-slate-900 hover:bg-slate-50">
              Connect in Workspace
            </button>
          </article>
          <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-[#F47E42] text-white text-[13px] font-bold">PC</div>
                <div>
                  <p className="text-[15px] font-semibold text-slate-900">Procore</p>
                  <p className="text-[12px] text-slate-500">Project management</p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-700">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> OAuth ready
              </span>
            </div>
            <p className="mt-3 text-[13px] text-slate-600">Begins OAuth from the workspace, then imports project context after the user connects a Procore company.</p>
            <button onClick={() => nav('opsQueue')} className="mt-4 inline-flex h-9 items-center rounded-md border border-slate-300 bg-white px-3 text-[12px] font-semibold text-slate-900 hover:bg-slate-50">
              Connect in Workspace
            </button>
          </article>
        </div>

        <p className="mt-4 max-w-3xl text-[11px] leading-relaxed text-slate-400">
          Read-only OAuth · Tokens encrypted in Supabase · Disconnect anytime. Google Document AI™ runs in your Google Cloud project; documents are not retained after extraction. QuickBooks® is a registered trademark of Intuit Inc. Procore® is a registered trademark of Procore Technologies, Inc. All trademarks referenced descriptively only.
        </p>
      </section>

      {/* Value math — quiet, demoted from dark to slate-50 so it stops fighting the hero */}
      <section className="reveal">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 md:p-10">
          <div className="grid gap-8 md:grid-cols-[1.1fr_1fr] md:items-center">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Producer math</p>
              <h2 className="mt-2 text-[26px] font-semibold leading-tight tracking-[-0.02em] text-slate-900 md:text-[32px]">One saved rejection pays for the year.</h2>
              <p className="mt-3 text-[15px] leading-relaxed text-slate-600">
                A bond submission that gets bounced for stale WIP or a missing CPA letter wastes 2–4 hours of producer time plus the contractor relationship hit. Catching the gap at file prep takes seconds.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg border border-slate-200 bg-white px-3 py-4">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Time per file</p>
                <p className="mt-2 text-[24px] font-semibold tabular-nums tracking-tight text-slate-900">&lt;5 min</p>
                <p className="mt-0.5 text-[11px] text-slate-500">vs 45 min manual prep<sup>*</sup></p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white px-3 py-4">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Submissions</p>
                <p className="mt-2 text-[24px] font-semibold tabular-nums tracking-tight text-slate-900">8–12</p>
                <p className="mt-0.5 text-[11px] text-slate-500">per producer / month</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white px-3 py-4">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Per producer</p>
                <p className="mt-2 text-[24px] font-semibold tabular-nums tracking-tight text-slate-900">$49</p>
                <p className="mt-0.5 text-[11px] text-slate-500">founder pricing · monthly</p>
              </div>
            </div>
          </div>
          <p className="mt-5 text-[11px] text-slate-400"><sup>*</sup>Estimated benchmark. Actual time-per-file depends on data source and document quality.</p>
        </div>
      </section>

      {/* How it works — explicit 4-step process */}
      <section className="reveal rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-5 flex items-baseline justify-between gap-4">
          <h2 className="text-[18px] font-semibold tracking-[-0.02em] text-slate-900">How it works</h2>
          <p className="text-xs uppercase tracking-wide text-slate-400">~60 seconds</p>
        </div>
        <ol className="grid gap-4 md:grid-cols-4">
          {[
            ['01', 'Enter file details', 'Contractor basics, WIP status, financials — no upload required.'],
            ['02', 'Get readiness score', 'See gaps, stale docs, and missing items before they kill a submission.'],
            ['03', 'Review WIP risk', 'Margin fade, underbilling, backlog concentration flags surfaced.'],
            ['04', 'Hand off cleanly', 'Generate a structured memo your underwriter can act on immediately.'],
          ].map(([num, title, copy]) => (
            <li key={num} className="border-l-2 border-slate-200 pl-4">
              <p className="text-[11px] font-mono font-semibold tracking-wider text-slate-400">{num}</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">{title}</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">{copy}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-6 py-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Underwriter-ready output</p>
          <h2 className="mt-2 text-[24px] font-semibold tracking-[-0.02em] text-slate-900 md:text-[30px]">
            The result is a packet your team can defend.
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600">
            BondSBA turns intake noise into a source-backed review file: what is missing, what changed, where the number came from, and what the producer should resolve before a carrier or lender sees it.
          </p>
        </div>
        <div className="grid gap-px bg-slate-100 lg:grid-cols-[1fr_1.15fr]">
          <div className="bg-white p-6">
            <div className="grid grid-cols-2 gap-3">
              {[
                ['Readiness', `${analysis.score}%`, analysis.readiness.label],
                ['Missing Items', `${analysis.criticalGaps.length}`, 'Owner assigned'],
                ['WIP Review', analysis.wipReview.label, 'Exception memo'],
                ['Handoff', analysis.suretyHandoff, 'Export ready'],
              ].map(([label, value, hint]) => (
                <div key={label} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
                  <p className="mt-2 text-xl font-semibold tracking-[-0.02em] text-slate-900">{value}</p>
                  <p className="mt-0.5 text-[11px] text-slate-500">{hint}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-white p-6">
            <div className="overflow-hidden rounded-lg border border-slate-200">
              <table className="w-full border-collapse text-left text-sm">
                <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Evidence</th>
                    <th className="px-3 py-2 font-semibold">Source</th>
                    <th className="px-3 py-2 font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {[
                    ['Current WIP schedule', filePrepState.wipStatus === 'received' ? 'Received file' : 'Missing/stale intake', analysis.wipReview.label],
                    ['Interim financials', filePrepState.financialsStatus === 'received' ? 'Received file' : 'Missing/stale intake', analysis.fileQuality],
                    ['Cost-to-complete detail', filePrepState.costToCompleteDetail === 'yes' ? 'WIP columns' : 'Reviewer note', analysis.reviewNext],
                    ['Carrier handoff memo', 'BondSBA packet export', analysis.suretyHandoff],
                  ].map(([evidence, source, action]) => (
                    <tr key={evidence}>
                      <td className="px-3 py-2 font-medium text-slate-900">{evidence}</td>
                      <td className="px-3 py-2 text-slate-600">{source}</td>
                      <td className="px-3 py-2 text-slate-600">{action}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* Live file check panel + score — below the fold persuasion */}
      <section className="grid gap-6 lg:grid-cols-[1fr_auto]">
        <ContractorFileInputPanel
          state={filePrepState}
          onChange={setFilePrepState}
          onRunReadiness={() => nav('readinessEngine')}
          onSkipToWorkspace={() => nav('opsQueue')}
        />
        <div className="flex flex-col gap-4 lg:w-52">
          <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <ScoreRing score={analysis.score} />
            <p className="mt-3 text-center text-sm font-semibold text-slate-900">{analysis.readiness.label}</p>
            <p className="text-center text-xs text-slate-500">File readiness</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Key signals</p>
            <div className="space-y-1">
              <ProofRow label="Critical gaps" value={`${analysis.criticalGaps.filter((g) => g.priority === 'Critical').length}`} chipLabel="Review" chipVariant="review" />
              <ProofRow label="WIP quality" chipLabel={analysis.wipReview.label} chipVariant={analysis.wipReview.variant} />
              <ProofRow label="Margin fade" value={toSentenceCase(filePrepState.marginFade)} chipLabel={filePrepState.marginFade === 'yes' ? 'Review' : 'Ready'} chipVariant={filePrepState.marginFade === 'yes' ? 'review' : 'ready'} />
              <ProofRow label="Surety handoff" chipLabel={analysis.suretyHandoff} chipVariant={analysis.suretyHandoff === 'Ready for review' ? 'ready' : 'review'} />
            </div>
          </div>
        </div>
      </section>

      {/* Methodology — establishes domain authority via specific surety vocabulary */}
      <section className="reveal">
        <div className="max-w-3xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Methodology</p>
          <h2 className="mt-2 text-[28px] font-semibold tracking-[-0.02em] text-slate-900 md:text-[32px]">Built around the producer's pre-submission workflow.</h2>
          <p className="mt-3 text-[15px] leading-[1.55] text-slate-600">
            Every check mirrors what surety underwriters look for across most major markets — completed contracts schedule, cost-to-complete reasonableness, single-job concentration, working capital adequacy, retainage discipline. Underwriting thresholds and bond statutes vary by jurisdiction; BondSBA flags operational signals, not jurisdictional compliance.
          </p>
        </div>
        <div className="mt-7 grid gap-px overflow-hidden rounded-xl border border-slate-200 bg-slate-200 md:grid-cols-4">
          {[
            ['Completed Contracts', 'Cross-checks reported vs WIP-derived gross profit. Flags margin fade before the carrier does.'],
            ['Cost-to-Complete', 'Validates remaining cost reasonableness and detects over-billings ahead of underwriting.'],
            ['Backlog Concentration', 'Surfaces single-job and customer concentration above carrier appetite thresholds.'],
            ['Working Capital', 'Tests current-asset coverage and retainage realism against typical aggregate program ratios.'],
          ].map(([title, copy]) => (
            <div key={title} className="bg-white p-5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Signal</p>
              <p className="mt-2 text-[14px] font-semibold text-slate-900">{title}</p>
              <p className="mt-1.5 text-[13px] leading-relaxed text-slate-500">{copy}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Jurisdiction-specific industry reference */}
      <section className="reveal">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Your jurisdiction</p>
            <span className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-600">
              <span aria-hidden>{j.flag}</span>
              {r ? `${r.label} · ` : ''}{j.label}
            </span>
          </div>
          <span className="text-[11px] text-slate-400">Change in the header anytime</span>
        </div>

        {/* Region statute card — the highest-value industry reference */}
        {r && (
          <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 bg-slate-50 px-5 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Controlling law · {r.label}</p>
              <p className="mt-1 text-[15px] font-semibold tracking-[-0.01em] text-slate-900">{r.statute}</p>
            </div>
            <div className="grid gap-px bg-slate-100 md:grid-cols-3">
              <div className="bg-white p-4">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Regulator</p>
                <p className="mt-1 text-[13px] text-slate-700">{r.regulator}</p>
              </div>
              <div className="bg-white p-4">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Bond convention</p>
                <p className="mt-1 text-[13px] text-slate-700">{r.bondNote}</p>
              </div>
              <div className="bg-white p-4">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Contract document standard</p>
                <p className="mt-1 text-[13px] text-slate-700">{j.docStandard}</p>
              </div>
            </div>
            <div className="border-t border-slate-100 bg-slate-50 px-5 py-3">
              <p className="text-[11px] text-slate-500">
                <span className="font-semibold text-slate-700">Federal / national framework:</span> {j.federalStatute}
              </p>
            </div>
          </div>
        )}

        {/* Carrier list */}
        <div className="mt-5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{j.label} surety markets we structure handoffs for</p>
          <div className="mt-2 flex flex-wrap gap-x-6 gap-y-2 text-[13px] text-slate-600">
            {j.carriers.map((carrier, idx) => (
              <React.Fragment key={carrier}>
                <span>{carrier}</span>
                {idx < j.carriers.length - 1 && <span className="hidden h-3 w-px self-center bg-slate-200 sm:inline-block" />}
              </React.Fragment>
            ))}
          </div>
        </div>

        <p className="mt-4 max-w-3xl text-[12px] leading-relaxed text-slate-400">
          Carrier names are trade names of their respective insurers, referenced descriptively only (US: nominative fair use; Canada: honest use under §22 Trademarks Act; UK/AU: descriptive use). BondSBA is independent — not affiliated with, endorsed by, or sponsored by any listed carrier. CCDC document references are descriptive only; CCDC documents are copyright Canadian Construction Documents Committee. Statute, regulator, and bond-convention references are informational; not legal advice. BondSBA is a file-prep and analysis tool — we do not place, sell, or broker bonds. Statute compliance and bond placement are your firm's responsibility.
        </p>
      </section>

      {/* Why BondSBA — comparison list, not 4 equal cards */}
      <section className="reveal overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-6 py-5">
          <h2 className="text-[22px] font-bold leading-[1.15] tracking-[-0.03em] text-slate-900">One focused step, not a full platform.</h2>
          <p className="mt-1 text-sm text-slate-500">Built only for the file-prep step before formal review.</p>
        </div>
        <div className="divide-y divide-slate-100">
          {[
            ['Surety lifecycle platforms (Tinubu, NetRate, Surety2000)', 'Carrier-side', 'Built for issuance, carrier workflows, and bond administration — not the producer\'s pre-submission file.', false],
            ['Construction software (Procore, Sage 300)', 'Org-wide', 'Requires deep adoption, user roles, and project config before any single bond file gets clearer.', false],
            ['Generic prep checklists / spreadsheets', 'Manual', 'No scoring, no margin-fade detection, no carrier-ready memo — just a list of things you already know to ask for.', false],
            ['BondSBA', '60-second producer check', 'Designed for the surety producer\'s pre-submission workflow: readiness score, WIP signals, missing-item list, carrier handoff memo.', true],
          ].map(([title, badge, copy, highlight]) => (
            <div key={title} className={`flex items-start gap-4 px-6 py-4 ${highlight ? 'bg-slate-50' : ''}`}>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`text-sm font-semibold ${highlight ? 'text-slate-900' : 'text-slate-700'}`}>{title}</span>
                  <span className={`rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${highlight ? 'bg-slate-900 text-white' : 'border border-slate-200 bg-white text-slate-500'}`}>{badge}</span>
                </div>
                <p className="mt-0.5 text-sm text-slate-500">{copy}</p>
              </div>
              {highlight && <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-slate-900" />}
            </div>
          ))}
        </div>
      </section>

      {/* Who it's for — divide-y list, not 4 cards */}
      <section className="reveal overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-6 py-5">
          <h2 className="text-[22px] font-bold leading-[1.15] tracking-[-0.03em] text-slate-900">Who uses BondSBA</h2>
        </div>
        <div className="divide-y divide-slate-100">
          {[
            ['Surety producers', 'Primary user.', 'WIP visibility, missing-item tracking, and structured handoff notes before bond submission.'],
            ['Construction lenders', 'File completeness and WIP quality review before credit analysis begins.', ''],
            ['Contractor finance brokers', 'Standardize intake, follow-up, and lender handoffs across contractor financing requests.', ''],
            ['Construction CPAs', 'Organize WIP, financials, and supporting docs for financing and bonding conversations.', ''],
          ].map(([title, badge, copy]) => (
            <div key={title} className="flex items-start gap-4 px-6 py-4">
              <div className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400" />
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-slate-900">{title}</p>
                  {badge && <span className="rounded-md bg-slate-900 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">{badge}</span>}
                </div>
                {copy && <p className="mt-0.5 text-sm text-slate-500">{copy}</p>}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing teaser — horizontal strip */}
      <section className="reveal rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-[22px] font-bold leading-[1.15] tracking-[-0.03em] text-slate-900">Pricing built around file volume.</h2>
            <p className="mt-1 text-sm text-slate-500">Start free with manual checks. Add extraction credits when needed.</p>
          </div>
          <button onClick={() => nav('pricing')} className="inline-flex h-10 items-center justify-center rounded-[10px] border border-[#0B1F3A] bg-[#0B1F3A] px-4 text-sm font-semibold text-white hover:bg-[#12365F]">
            View Pricing
          </button>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-slate-200 bg-slate-200 md:grid-cols-4">
          {[
            ['Starter', '$9/mo', false, 'Manual checks only'],
            ['Solo', '$29/mo', false, '50 extraction credits'],
            ['Professional', '$79/mo', true, '200 credits · team access'],
            ['Operations', '$199/mo', false, 'Unlimited · priority support'],
          ].map(([name, price, highlight, hint]) => (
            <div key={name} className={`flex flex-col px-4 py-3 ${highlight ? 'bg-slate-50' : 'bg-white'}`}>
              <p className={`text-xs font-semibold ${highlight ? 'text-[#0B1F3A]' : 'text-slate-500'}`}>{name}</p>
              <p className={`mt-1 text-xl font-bold tabular-nums tracking-tight ${highlight ? 'text-[#0B1F3A]' : 'text-[#0B1F3A]'}`}>{price}</p>
              <p className="mt-0.5 text-[11px] text-slate-400">{hint}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Disclaimer — strip, no card */}
      <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50/50 px-5 py-4">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
        <p className="text-sm text-amber-800">
          <span className="font-semibold">Professional review required.</span>{' '}
          BondSBA outputs require professional judgment and do not replace underwriting, lending, accounting, legal, or surety decisions.
        </p>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-[28px] font-bold leading-[1.15] tracking-[-0.03em] text-slate-900">Start with cleaner contractor submissions.</h2>
        <p className="mt-1 text-sm text-slate-600">Enter file details, check readiness, review WIP risk, and prepare a cleaner handoff.</p>
        <div className="mt-4 grid gap-2 sm:flex">
          <button onClick={() => nav('opsQueue')} className="inline-flex h-11 items-center justify-center rounded-[10px] border border-[#0B1F3A] bg-[#0B1F3A] px-4 text-sm font-semibold text-white hover:bg-[#12365F]">
            Start 60-second check
          </button>
          <button onClick={() => nav('opsQueue')} className="inline-flex h-11 items-center justify-center rounded-[10px] border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-900 hover:bg-slate-50">
            Open Workspace
          </button>
        </div>
      </section>
    </div>
  );
}

function resolveTitleForDomain(title) {
  if (!isClearpathDomain()) return title;
  if (title.includes('ClearPath')) return title;
  return title
    .replace(/\|\s*BondSBA(?: Terminal)?/g, '| ClearPath — Powered by BondSBA')
    .replace(/—\s*BondSBA(?: Terminal)?/g, '— ClearPath — Powered by BondSBA')
    .replace(/^BondSBA Terminal/, 'ClearPath — Powered by BondSBA');
}

function BondHomeClassic({ nav, navWithAuth = nav, user = null, onSignIn }) {
  const [filePrepState, setFilePrepState] = useState(DEFAULT_FILE_PREP_STATE);
  const analysis = useMemo(() => evaluateFilePrepState(filePrepState), [filePrepState]);

  // Detect if user hasn't interacted with the panel yet
  const isPanelEmpty = !filePrepState.contractorName &&
    !filePrepState.requestedAmount &&
    filePrepState.marginFade !== 'yes' &&
    filePrepState.underbillings !== 'yes';

  const WORKFLOW = [
    { n: '01', title: 'Intake + normalize', copy: 'Enter contractor name, file purpose, WIP schedule status, financials, and critical flags.' },
    { n: '02', title: 'Score readiness', copy: 'See file completeness %, critical gaps, and stale documents before a carrier touches it.' },
    { n: '03', title: 'WIP risk review', copy: 'Flag margin fade, underbilling stress, overbilling exposure, and backlog concentration.' },
    { n: '04', title: 'Resolve + assign', copy: 'Assign missing items to owners. Track next action on every open item.' },
    { n: '05', title: 'Generate memo', copy: 'One-click structured handoff memo for the lender or surety carrier.' },
  ];

  const TRUST_SIGNALS = [
    { label: 'WIP-first methodology', detail: 'Every file scored on WIP schedule quality before anything else.' },
    { label: 'No black-box outputs', detail: 'Methodology shown at every step — no unexplained scores.' },
    { label: 'Producer-verified only', detail: 'Outputs require sign-off before carrier submission.' },
    { label: 'Built for surety workflow', detail: 'Not generic fintech — built around the bond file lifecycle.' },
  ];

  return (
    <div className="space-y-8 pb-8" style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif" }}>

      {/* ── Hero + File Check ── */}
      <section className="grid gap-8 rounded-2xl border border-[#0B1F3A]/15 bg-gradient-to-br from-[#0B1F3A] to-[#12365F] p-6 text-white shadow-[0_24px_48px_-12px_rgba(11,31,58,0.35)] lg:grid-cols-[1fr_1.1fr] lg:p-10">
        <div className="flex flex-col justify-center">
          <div className="inline-flex w-fit items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-300" />
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-200">Surety Bond Readiness · Pre-Underwriting</p>
          </div>
          <h1 className="mt-4 text-[28px] font-bold leading-[1.08] tracking-[-0.03em] text-white md:text-[36px] xl:text-[44px]">
            Submission readiness for surety producers.
          </h1>
          <p className="mt-4 max-w-[42ch] text-[15px] leading-relaxed text-blue-100/90">
            Score WIP risk, surface missing documents, and produce a structured carrier memo — in 60 seconds.
          </p>
          {/* Trust pill row */}
          <div className="mt-5 flex flex-wrap gap-2">
            {['Methodology shown', 'No black box', 'Built for producers'].map(pill => (
              <span key={pill} className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-semibold text-blue-200">
                <span className="h-1 w-1 rounded-full bg-blue-300" />
                {pill}
              </span>
            ))}
          </div>

          {/* 5-step inline stepper — show 3 inline, +2 more */}
          <div className="mt-5 flex flex-wrap items-center gap-1">
            {WORKFLOW.slice(0, 3).map((s, i) => (
              <div key={s.n} className="flex items-center">
                <div className="flex items-center gap-1.5">
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-white/15 text-[10px] font-bold text-white">{s.n}</span>
                  <span className="text-[11px] font-medium text-blue-200">{s.title}</span>
                </div>
                {i < 2 && <ChevronRight className="mx-1 h-3 w-3 text-blue-400/50" />}
              </div>
            ))}
            <span className="ml-2 text-[11px] text-blue-300/60">+2 more steps</span>
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            <button onClick={() => nav('opsQueue')} className="cursor-pointer inline-flex h-11 items-center justify-center rounded-[10px] border border-white/20 bg-white px-5 text-sm font-semibold text-[#0B1F3A] transition-colors hover:bg-blue-50">
              Open Workspace
            </button>
            <button onClick={() => nav('wipAnalyzer')} className="cursor-pointer inline-flex h-11 items-center justify-center rounded-[10px] border border-white/25 bg-white/10 px-5 text-sm font-medium text-white transition-colors hover:bg-white/20">
              Analyze WIP
            </button>
          </div>
        </div>

        {/* File check panel — light card on dark bg */}
        <div className="overflow-hidden min-w-0 rounded-xl border border-white/10 bg-white/[0.07] p-1 backdrop-blur-sm">
          <div className="overflow-x-auto rounded-lg bg-white p-4">
            <ContractorFileInputPanel
              state={filePrepState}
              onChange={setFilePrepState}
              onRunReadiness={() => nav('readinessEngine')}
              onSkipToWorkspace={() => nav('opsQueue')}
            />
          </div>
        </div>
      </section>

      {/* ── Live signals from panel ── */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-3 mb-4">
          <h2 className="text-[20px] font-bold tracking-[-0.02em] text-slate-900">Your file — scored live</h2>
          <span className="rounded-full bg-[#0B1F3A]/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-[#0B1F3A]">From your input above</span>
        </div>
        {isPanelEmpty ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="h-10 w-10 rounded-full bg-[#0B1F3A]/[0.08] flex items-center justify-center mb-3">
              <FileText className="h-5 w-5 text-[#0B1F3A]/40" />
            </div>
            <p className="text-[14px] font-semibold text-slate-700">Fill in the file panel above to see live signals</p>
            <p className="mt-1 text-[12px] text-slate-400 max-w-[32ch]">Readiness score, WIP flags, and carrier handoff status update as you type.</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            <article className="rounded-xl border border-[#0B1F3A]/15 bg-[#0B1F3A]/[0.03] p-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#0B1F3A]">Readiness</p>
              <div className="mt-3 space-y-2 text-sm">
                <ProofRow label="File readiness" value={`${analysis.score}%`} chipLabel={analysis.readiness.label} chipVariant={analysis.readiness.variant} />
                <ProofRow label="Critical gaps" value={`${analysis.criticalGaps.filter(g => g.priority === 'Critical').length}`} chipLabel="Review" chipVariant="review" />
                <ProofRow label="Stale documents" value={`${Math.max(0, analysis.criticalGaps.length - 1)}`} chipLabel="Needs update" chipVariant="review" />
                <ProofRow label="Surety handoff" value={analysis.suretyHandoff} chipLabel={analysis.suretyHandoff} chipVariant={analysis.suretyHandoff === 'Ready for review' ? 'ready' : 'review'} />
              </div>
            </article>
            <article className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-600">WIP signals</p>
              <div className="mt-3 space-y-2 text-sm">
                <ProofRow label="WIP quality" value={`${Math.max(0, Math.min(100, analysis.score + 10))}`} chipLabel={analysis.wipReview.label} chipVariant={analysis.wipReview.variant} />
                <ProofRow label="Margin fade" value={toSentenceCase(filePrepState.marginFade)} chipLabel={filePrepState.marginFade === 'yes' ? 'Review' : 'Ready'} chipVariant={filePrepState.marginFade === 'yes' ? 'review' : 'ready'} />
                <ProofRow label="Underbilling stress" value={toSentenceCase(filePrepState.underbillings)} chipLabel={filePrepState.underbillings === 'yes' ? 'Critical' : 'Ready'} chipVariant={filePrepState.underbillings === 'yes' ? 'critical' : 'ready'} />
                <ProofRow label="Concentration risk" value={filePrepState.largestJobPercent ? `${filePrepState.largestJobPercent}%` : 'N/A'} chipLabel={Number(filePrepState.largestJobPercent || 0) > 40 ? 'Needs review' : 'Ready'} chipVariant={Number(filePrepState.largestJobPercent || 0) > 40 ? 'review' : 'ready'} />
              </div>
            </article>
          </div>
        )}
      </section>

      {/* ── Save nudge (unauthenticated + panel filled) ── */}
      {!user && !isPanelEmpty && (
        <div className="flex items-center justify-between gap-4 rounded-xl border border-[#0B1F3A]/15 bg-[#0B1F3A]/[0.03] px-5 py-4 flex-wrap">
          <div>
            <p className="text-[13px] font-semibold text-slate-900">Save this file analysis</p>
            <p className="text-[12px] text-slate-500 mt-0.5">Sign in to keep your readiness score and carrier memo. Free account, no card required.</p>
          </div>
          <button
            onClick={onSignIn}
            className="cursor-pointer inline-flex h-9 shrink-0 items-center gap-2 rounded-lg bg-[#0B1F3A] px-4 text-[13px] font-semibold text-white transition-colors hover:bg-[#12365F]"
          >
            Save results
          </button>
        </div>
      )}

      {/* ── Trust signals ── */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#0B1F3A]/50">Why producers use BondSBA</p>
        <div className="mt-4 divide-y divide-slate-100">
          {TRUST_SIGNALS.map(ts => (
            <div key={ts.label} className="flex items-start gap-4 py-3 first:pt-0 last:pb-0">
              <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#0B1F3A]" />
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-slate-900">{ts.label}</p>
                <p className="text-[12px] leading-relaxed text-slate-500">{ts.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Integration cards ── */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-5">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#0B1F3A]/50">Premium Integrations</p>
          <h2 className="mt-1.5 text-[20px] font-bold tracking-[-0.02em] text-slate-900">Works where your data already lives</h2>
          <p className="mt-1 text-[13px] text-slate-500">Pull WIP schedules and financial data directly — no manual re-entry.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {/* Procore card */}
          <div
            className="group relative overflow-hidden rounded-xl border border-slate-200 bg-gradient-to-br from-white to-slate-50/60 p-5 shadow-sm transition-all duration-200 hover:border-[#0B1F3A]/30 hover:shadow-[0_12px_30px_rgba(11,31,58,0.10)] cursor-default"
            style={{ perspective: '800px' }}
          >
            <div className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.6) 0%, transparent 60%)', backdropFilter: 'blur(1px)' }} />
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#F97316] shadow-[0_4px_12px_rgba(249,115,22,0.35)]">
                  <Factory className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-[13px] font-bold text-slate-900">Procore</p>
                  <p className="text-[11px] text-slate-500">Construction management</p>
                </div>
                <span className="ml-auto rounded-full border border-orange-200 bg-orange-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-orange-600">Coming soon</span>
              </div>
              <p className="text-[13px] leading-relaxed text-slate-600">Import WIP schedules and project data directly from Procore. Eliminate manual extraction — surface risk signals in seconds.</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {['WIP import', 'Job cost sync', 'Auto-schedule'].map(tag => (
                  <span key={tag} className="rounded-full border border-orange-100 bg-orange-50 px-2 py-0.5 text-[10px] font-semibold text-orange-700">{tag}</span>
                ))}
              </div>
            </div>
          </div>
          {/* QuickBooks card */}
          <div
            className="group relative overflow-hidden rounded-xl border border-slate-200 bg-gradient-to-br from-white to-slate-50/60 p-5 shadow-sm transition-all duration-200 hover:border-[#0B1F3A]/30 hover:shadow-[0_12px_30px_rgba(11,31,58,0.10)] cursor-default"
            style={{ perspective: '800px' }}
          >
            <div className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.6) 0%, transparent 60%)', backdropFilter: 'blur(1px)' }} />
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#2CA01C] shadow-[0_4px_12px_rgba(44,160,28,0.35)]">
                  <Calculator className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-[13px] font-bold text-slate-900">QuickBooks</p>
                  <p className="text-[11px] text-slate-500">Accounting &amp; financials</p>
                </div>
                <span className="ml-auto rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-green-600">Coming soon</span>
              </div>
              <p className="text-[13px] leading-relaxed text-slate-600">Pull balance sheets, P&L statements, and job-cost ledgers from QuickBooks. Normalize financials for surety review automatically.</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {['P&L import', 'Balance sheet', 'Job-cost ledger'].map(tag => (
                  <span key={tag} className="rounded-full border border-green-100 bg-green-50 px-2 py-0.5 text-[10px] font-semibold text-green-700">{tag}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── USP comparison ── */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-[20px] font-bold tracking-[-0.02em] text-slate-900">What BondSBA is — and isn't</h2>
        <p className="mt-1 text-[13px] text-slate-500">Purpose-built for the one step before carrier review. Not general construction software.</p>
        <div className="mt-4 divide-y divide-slate-100 rounded-xl border border-slate-200 overflow-hidden">
          {[
            ['Full construction platforms', 'Weeks of setup, broad adoption needed', false],
            ['Surety lifecycle systems', 'Built for bond issuance and administration', false],
            ['Generic fintech tools', 'Not calibrated for WIP or surety workflow', false],
            ['BondSBA', '60-second file check — WIP, readiness, handoff memo', true],
          ].map(([title, copy, highlight]) => (
            <div key={title} className={`flex items-center gap-4 px-4 py-3.5 ${highlight ? 'bg-[#0B1F3A]' : 'bg-white'}`}>
              {highlight
                ? <CheckCircle className="h-4 w-4 shrink-0 text-blue-300" />
                : <XCircle className="h-4 w-4 shrink-0 text-slate-300" />
              }
              <div className="flex-1 min-w-0">
                <p className={`text-[13px] font-semibold ${highlight ? 'text-white' : 'text-slate-600'}`}>{title}</p>
                <p className={`text-[12px] ${highlight ? 'text-blue-200' : 'text-slate-400'}`}>{copy}</p>
              </div>
              {highlight && <span className="shrink-0 rounded-full bg-white/15 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-blue-200">This</span>}
            </div>
          ))}
        </div>
      </section>

      {/* ── Who it's for ── */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-[20px] font-bold tracking-[-0.02em] text-slate-900">Built for these teams</h2>
        <div className="mt-4 divide-y divide-slate-100">
          {[
            ['Surety producers', 'Triage contractor files before underwriter time is spent. WIP risk and readiness score in 60 seconds.'],
            ['Construction CPAs / fractional CFOs', 'Validate WIP consistency and financial packaging before financing or bonding conversations.'],
            ['Contractor finance brokers', 'Standardize file intake and handoffs. One source of truth for every open submission.'],
            ['Construction lenders', 'Review file completeness and WIP quality signals before credit committee.'],
          ].map(([role, copy]) => (
            <div key={role} className="flex items-start gap-4 py-3">
              <div className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-[#0B1F3A]" />
              <div>
                <p className="text-[13px] font-semibold text-slate-900">{role}</p>
                <p className="text-[12px] leading-relaxed text-slate-500">{copy}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Pricing strip ── */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-[20px] font-bold tracking-[-0.02em] text-slate-900">Pricing by file volume</h2>
            <p className="mt-1 text-[13px] text-slate-500">Start free. Add credits when your team scales.</p>
          </div>
          <button onClick={() => nav('pricing')} className="cursor-pointer inline-flex h-9 items-center justify-center rounded-lg border border-[#0B1F3A] bg-[#0B1F3A] px-4 text-[13px] font-semibold text-white transition-colors hover:bg-[#12365F]">
            View full pricing
          </button>
        </div>
        <div className="mt-5 divide-y divide-slate-100 rounded-xl border border-slate-200 overflow-hidden">
          {[
            ['Starter', '$9/mo', '25 files/month', false],
            ['Solo', '$29/mo', '100 files/month', false],
            ['Professional', '$79/mo', '350 files/month', true],
            ['Operations', '$199/mo', 'Unlimited + team seats', false],
          ].map(([name, price, volume, rec]) => (
            <div key={name} className={`flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 ${rec ? 'bg-[#0B1F3A]' : 'bg-white'}`}>
              <div className="flex-1 min-w-0">
                <p className={`text-[13px] font-semibold ${rec ? 'text-white' : 'text-slate-900'}`}>{name}</p>
                <p className={`text-[12px] ${rec ? 'text-blue-200' : 'text-slate-400'}`}>{volume}</p>
              </div>
              <div className="flex items-center gap-2">
                <p className={`text-[15px] font-bold tabular-nums ${rec ? 'text-white' : 'text-[#0B1F3A]'}`}>{price}</p>
                {rec && <span className="rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-blue-200">Popular</span>}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Disclaimer ── */}
      <section className="rounded-xl border border-slate-200 bg-slate-50 p-5">
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Professional use</p>
        <p className="mt-1.5 text-[11px] leading-relaxed text-slate-500">
          BondSBA flags operational signals — WIP risk, missing documents, concentration, margin fade — to support producer review. Outputs require professional sign-off before carrier handoff. Not CPA-attested. Not an insurance product. Does not place or broker bonds.
        </p>
      </section>
    </div>
  );
}

function toSentenceCase(value = '') {
  if (!value) return 'N/A';
  return value.slice(0, 1).toUpperCase() + value.slice(1);
}

function ProofRow({ label, value, chipLabel, chipVariant }) {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-slate-200 pb-2 last:border-b-0 last:pb-0">
      <span className="text-slate-600">{label}</span>
      <span className="inline-flex items-center gap-2">
        <span className="font-semibold tabular-nums text-slate-900">{value}</span>
        <StatusChip label={chipLabel} variant={chipVariant} />
      </span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// AMORTIZATION TERMINAL
// ═══════════════════════════════════════════════════════════
function pmt(rate, nper, pv) {
  if (rate === 0) return pv / nper;
  return (rate * pv * Math.pow(1 + rate, nper)) / (Math.pow(1 + rate, nper) - 1);
}

function AmortizationTerminal({ nav, user, onRequireAuth }) {
  const [amount,   setAmount]   = useState('450000');
  const [rateStr,  setRateStr]  = useState('10.50');
  const [years,    setYears]    = useState('10');
  const [prog,     setProg]     = useState('7a_10');
  const [mfr,      setMfr]      = useState(false);
  const [borrowerName, setBorrowerName] = useState('');
  const [useOfProceeds, setUseOfProceeds] = useState('Working capital and growth capital');
  const [netOperatingIncome, setNetOperatingIncome] = useState('100000');
  const [lenderName, setLenderName] = useState('Client / Lender Review');

  const [extractNotes,      setExtractNotes]      = useState('');
  const [extracting,        setExtracting]        = useState(false);
  const [extractStatus,     setExtractStatus]     = useState(null);
  const [narrative,         setNarrative]         = useState('');
  const [plainEnglish,      setPlainEnglish]      = useState('');
  const [explaining,        setExplaining]        = useState(false);
  const [officerEmail,      setOfficerEmail]      = useState('');
  const [generating,        setGenerating]        = useState(false);
  const [generateStatus,    setGenerateStatus]    = useState(null);
  const [termSheetData,     setTermSheetData]     = useState(null);
  const [modalOpen,         setModalOpen]         = useState(false);
  const [copied,            setCopied]            = useState(null);
  const [error,             setError]             = useState(null);

  const principal   = parseFloat(amount.replace(/,/g, '')) || 0;
  const noiValue    = parseFloat(netOperatingIncome.replace(/,/g, '')) || 0;
  const annualRate  = parseFloat(rateStr) / 100 || 0;
  const termYears   = parseInt(years) || 0;
  const n           = termYears * 12;
  const mr          = annualRate / 12;
  const selectedProg = PROGRAMS.find(p => p.id === prog);
  const is504 = prog === '504';
  const guarantyFeeAnalysis = useMemo(() => calculateSBA7aGuarantyFee({
    loanAmount: principal,
    termMonths: n,
    isManufacturer: mfr,
    program: prog === 'express' ? 'express' : 'standard',
  }), [principal, n, mfr, prog]);
  const sba504Project = useMemo(() => calculateSBA504Project({
    projectCost: principal,
    cdcRate: parseFloat(rateStr) || 0,
    cdcTermYears: termYears || 25,
    borrowerNAICS: mfr ? 311 : 236,
  }), [principal, rateStr, termYears, mfr]);
  const monthly     = useMemo(() => principal > 0 && n > 0 ? pmt(mr, n, principal) : 0, [principal, mr, n]);
  const displayedMonthly = is504 ? sba504Project.blendedMonthlyPayment : monthly;
  const totalRepaid   = monthly * n;
  const totalInterest = totalRepaid - principal;
  const principalPct  = totalRepaid > 0 ? (principal / totalRepaid) * 100 : 0;

  const estFee = useMemo(() => {
    if (prog.includes('7a') || prog === 'express') return guarantyFeeAnalysis.guarantyFee;
    if (prog === '504')      return sba504Project.upfrontGuarantyFee;
    if (prog === 'express')  return principal * 0.02;
    return principal * 0.025;
  }, [guarantyFeeAnalysis.guarantyFee, principal, prog, sba504Project.upfrontGuarantyFee]);
  const finalFee   = estFee;
  const feeWaived = is504 ? sba504Project.manufacturerWaiverApplied : guarantyFeeAnalysis.waiverApplied;

  const usd  = (v) => v.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  const usd2 = (v) => v.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const quickScenarios = [
    {
      label: '7(a) Working Capital',
      amount: '450000',
      rate: '10.50',
      years: '10',
      program: '7a_10',
      use: 'Working capital and growth capital',
      noi: '100000',
    },
    {
      label: '7(a) Real Estate',
      amount: '1500000',
      rate: '9.75',
      years: '25',
      program: '7a_25',
      use: 'Owner-occupied real estate acquisition',
      noi: '280000',
    },
    {
      label: 'SBA 504 Building',
      amount: '2500000',
      rate: '6.35',
      years: '25',
      program: '504',
      use: 'Owner-occupied building purchase',
      noi: '400000',
    },
    {
      label: 'Equipment',
      amount: '750000',
      rate: '10.25',
      years: '10',
      program: '7a_10',
      use: 'Equipment purchase and installation',
      noi: '180000',
    },
  ];

  const applyScenario = (scenario) => {
    setAmount(scenario.amount);
    setRateStr(scenario.rate);
    setYears(scenario.years);
    setProg(scenario.program);
    setUseOfProceeds(scenario.use);
    setNetOperatingIncome(scenario.noi);
    setPlainEnglish('');
  };

  const buildPlainEnglishFallback = () => {
    const programLabel = PROGRAMS.find(p => p.id === prog)?.label || 'SBA loan';
    const feeText = feeWaived
      ? 'The main SBA upfront fee appears waived under the manufacturer assumption.'
      : `The estimated upfront SBA fee is ${usd(finalFee)}.`;
    const structureText = is504
      ? `This looks like a 504 structure: about ${usd(sba504Project.bankLoanAmount)} from the bank, ${usd(sba504Project.cdcLoanAmount)} from the CDC/SBA piece, and ${usd(sba504Project.borrowerEquity)} from the borrower.`
      : `This looks like a ${programLabel} structure with estimated monthly debt service of ${usd2(displayedMonthly)}.`;
    return `${structureText} ${feeText} Before sending this to a client or lender, confirm final use of proceeds, borrower cash flow, equity injection, collateral, ownership, and SBA eligibility.`;
  };

  const handleExplain = async () => {
    setExplaining(true);
    setError(null);
    try {
      const programLabel = PROGRAMS.find(p => p.id === prog)?.label || 'SBA loan';
      const prompt = `Explain this SBA calculator result in plain English for a business owner and referral partner. Avoid jargon, use 4 short bullets, and include "what to confirm next".\n\nProgram: ${programLabel}\nBorrower: ${borrowerName || 'Borrower'}\nUse of proceeds: ${useOfProceeds}\nAmount/project cost: ${usd(principal)}\nRate: ${rateStr}%\nTerm: ${years} years\nEstimated monthly payment: ${usd2(displayedMonthly)}\nEstimated SBA fee: ${usd(finalFee)}\nManufacturer waiver: ${feeWaived ? 'yes' : 'no'}\nNOI: ${usd(noiValue)}\n\nReturn JSON: { explanation: "..." }`;
      const result = await fetchAI(prompt, 'You explain SBA loan math in practical client-friendly language. Be accurate, concise, and clear.', true);
      setPlainEnglish(result?.explanation || buildPlainEnglishFallback());
    } catch {
      setPlainEnglish(buildPlainEnglishFallback());
    } finally {
      setExplaining(false);
    }
  };

  const copy = (text, id) => {
    navigator.clipboard.writeText(text).catch(() => {
      const ta = Object.assign(document.createElement('textarea'), { value: text, style: 'position:fixed;top:0;left:0' });
      document.body.appendChild(ta); ta.focus(); ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
    });
    setCopied(id); setTimeout(() => setCopied(null), 1400);
  };

  const exportCSV = () => {
    let csv = 'Month,Payment,Principal,Interest,Balance\n';
    let bal = principal;
    for (let i = 1; i <= n; i++) {
      const int = bal * mr, pri = monthly - int; bal = Math.max(0, bal - pri);
      csv += `${i},${monthly.toFixed(2)},${pri.toFixed(2)},${int.toFixed(2)},${bal.toFixed(2)}\n`;
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `Amortization_${principal}.csv`; a.click();
  };

  const copyAll = () => {
    let tsv = 'Month\tPayment\tPrincipal\tInterest\tBalance\n';
    let bal = principal;
    for (let i = 1; i <= n; i++) {
      const int = bal * mr, pri = monthly - int; bal = Math.max(0, bal - pri);
      tsv += `${i}\t${monthly.toFixed(2)}\t${pri.toFixed(2)}\t${int.toFixed(2)}\t${bal.toFixed(2)}\n`;
    }
    copy(tsv, 'all');
  };

  const handleExtract = async () => {
    if (!extractNotes.trim()) return;
    setExtracting(true);
    setError(null);
    setExtractStatus(null);
    try {
      const data = await fetchAI(
        `Extract commercial loan parameters from: "${extractNotes}"\n\nReturn JSON: { amount, program (7a_25|7a_10|express|504), years, assessment }`,
        'Commercial loan structuring assistant. Return valid JSON only.',
        true
      );
      if (data.amount)   setAmount(Number(data.amount).toLocaleString());
      if (data.program && PROGRAMS.some(p => p.id === data.program)) setProg(data.program);
      if (data.years)    setYears(data.years);
      if (data.assessment) setNarrative(data.assessment);
      setExtractStatus('success');
      setTimeout(() => setExtractStatus(null), 3000);
    } catch (e) {
      setError(e.message);
      setExtractStatus('error');
    }
    finally { setExtracting(false); }
  };

  const handleCompile = async () => {
    if (!onRequireAuth?.('Sign in or create an account to generate term sheets and call BondSBA Terminal APIs.')) {
      setError('Sign in required before generating term sheets.');
      return;
    }

    setGenerating(true);
    setError(null);
    setGenerateStatus(null);
    try {
      // Call backend API to calculate loan analysis
      const apiResponse = await fetchAPI(
        '/api/v1/sba-loans/calculate-amortization',
        'POST',
        {
          requestedAmount: principal,
          annualRate: parseFloat(rateStr),
          loanTermYears: parseInt(years),
          program: selectedProg?.label || prog,
          netOperatingIncome: noiValue,
          totalProjectCost: is504 ? principal : Math.max(principal, principal * 1.1),
          borrowerNAICS: mfr ? 311 : 234, // 311 = Manufacturing (triggers waiver)
          borrowerName: borrowerName || '[Borrower Name]',
        }
      );

      // Extract analysis data from API response
      const analysis = apiResponse.data || apiResponse.analysis || {};
      const progLabel = PROGRAMS.find(p => p.id === prog)?.label;

      // Get underwriting narrative from AI
      const narrativeData = await fetchAI(
        `Generate a polished 2-3 sentence executive underwriting summary for a professional SBA client handoff:\n\nBorrower: ${borrowerName || 'Borrower'}\nProgram: ${progLabel}\nUse of proceeds: ${useOfProceeds}\nPrincipal/project cost: $${amount}\nRate: ${rateStr}%\nMonthly Payment: ${usd2(displayedMonthly)}\nNOI: ${usd(noiValue)}\nPlain-language client summary: ${plainEnglish || buildPlainEnglishFallback()}\n\nReturn JSON: { narrative: "..." }`,
        'Commercial banking underwriter. Keep summary concise, polished, and suitable for a top-tier lending or advisory handoff.',
        true
      ).catch(() => ({ narrative: 'Structurally sound commercial expansion opportunity with strong market fundamentals.' }));
      const dscrValue = typeof analysis.dscr === 'object'
        ? Number(analysis.dscr?.dscr || 1.25)
        : Number(analysis.dscr || 1.25);
      const handoff = buildClientHandoffPackage({
        borrowerName: borrowerName || '[Borrower Name]',
        program: progLabel,
        requestedAmount: principal,
        annualRate: parseFloat(rateStr),
        loanTermYears: parseInt(years),
        monthlyPayment: displayedMonthly,
        guarantyFee: finalFee,
        netOperatingIncome: noiValue,
        totalProjectCost: is504 ? principal : Math.max(principal, principal * 1.1),
        useOfProceeds,
        borrowerNAICS: mfr ? 311 : 234,
        sba504Project: is504 ? sba504Project : null,
      });

      // Build term sheet data from API response
      const termSheetData = {
        parties: {
          borrower: borrowerName || '[Borrower Name]',
          lender: lenderName || 'Client / Lender Review',
          officer: officerEmail ? officerEmail.split('@')[0] : 'Loan Officer'
        },
        facility: {
          amount: principal,
          program: progLabel,
          index: 'Prime',
          margin: (parseFloat(rateStr) - 8.5).toFixed(2),
          annual_rate: rateStr,
          term: parseInt(years),
          payments: n
        },
        debt_service: {
          monthly: displayedMonthly,
          annual: displayedMonthly * 12,
          dscr: dscrValue
        },
        equity: {
          required_pct: 10,
          required_amount: principal * 0.1
        },
        collateral: [
          'Commercial real estate or equipment',
          'Personal guarantees from principal owners'
        ],
        covenants: {
          dscr_min: Math.max(1.0, dscrValue),
          current_ratio_min: 1.2,
          debt_ratio_max: 2.0,
          testing_frequency: 'Annual'
        },
        fees: {
          origination_pct: analysis.fees?.originationFeePercent || 0.75,
          origination: analysis.fees?.originationFee || (principal * 0.0075),
          guaranty_pct: analysis.fees?.guarantyFeePercent || guarantyFeeAnalysis.feeRateLabel,
          guaranty: analysis.fees?.guarantyFee ?? finalFee,
          waiver_applicable: feeWaived,
          waiver_savings: analysis.fees?.waiverSavings || 0,
          total_fees: analysis.fees?.totalFees ?? ((analysis.fees?.originationFee || 0) + (analysis.fees?.guarantyFee || finalFee))
        },
        handoff,
        plain_english: plainEnglish || handoff.clientSummary,
        narrative: narrativeData.narrative || 'Structurally sound commercial expansion opportunity with strong market fundamentals.',
        effective_date: new Date().toLocaleDateString(),
        maturity_date: new Date(new Date().setFullYear(new Date().getFullYear() + parseInt(years))).toLocaleDateString()
      };

      setTermSheetData(termSheetData);
      setGenerateStatus('success');
      setModalOpen(true);
    } catch (e) {
      console.error('Error in handleCompile:', e);
      setError(e.message || 'Failed to generate term sheet. Please try again.');
      setGenerateStatus('error');
    }
    finally { setGenerating(false); }
  };

  // Full amortization schedule for charting and display
  const fullScheduleData = useMemo(() => {
    const rows = [];
    let bal = principal;
    for (let i = 1; i <= n; i++) {
      const int = bal * mr, pri = monthly - int;
      bal = Math.max(0, bal - pri);
      rows.push({ m: i, pay: monthly, pri, int, bal });
    }
    return rows;
  }, [principal, mr, monthly, n]);

  // First 12 months for table display
  const scheduleRows = useMemo(() => {
    return fullScheduleData.slice(0, 12);
  }, [fullScheduleData]);

  return (
    <>
      {modalOpen && termSheetData && (
        <TermSheetModal data={termSheetData} onClose={() => setModalOpen(false)} />
      )}

      <div className="space-y-4">
        {/* Page header */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-4 mb-1">
          <div>
            <h1 className="text-[22px] font-bold tracking-[-0.02em] text-slate-900">SBA Loan Calculator</h1>
            <p className="mt-0.5 text-sm text-slate-500">
              Loan structuring · Amortization · Term sheet · FY26 fee waiver
            </p>
          </div>
          <span className="hidden sm:inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
            SBA SOP 50 10 7
          </span>
        </div>

        {error && (
          <div className="flex items-start gap-3 bg-white border border-red-400 border-l-4 border-l-red-600 px-4 py-3 text-sm text-red-800">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> {error}
          </div>
        )}

        {!user && (
          <div className="flex items-start gap-3 bg-white border border-slate-200 border-l-4 border-l-slate-900 rounded-md px-4 py-3 flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-start gap-3">
              <Info className="w-4 h-4 shrink-0 mt-0.5 text-slate-600" />
              <div className="text-sm text-slate-700">
                <p className="font-semibold text-slate-900">Sign in to use the calculator</p>
                <p className="text-xs mt-0.5 text-slate-500">Loan amortization and term sheet generation are protected — sign in or create a free account to continue.</p>
              </div>
            </div>
            <button
              onClick={() => onRequireAuth?.('Sign in or create an account to use API-powered loan tools.')}
              className={T.btnPrimary + ' text-xs py-1.5 px-3 shrink-0'}
            >
              Sign In
            </button>
          </div>
        )}

        <div className="grid lg:grid-cols-12 gap-4">

          {/* ── LEFT COLUMN: Inputs ── */}
          <div className="lg:col-span-5 space-y-3">

            {/* ── Phase 2: Generative Features Panel ── */}
            <Suspense fallback={<ModuleFallback label="Loading generative tools…" />}>
              <GenerativeFeatures
                onExtractParameters={handleExtract}
                onCompileTermSheet={handleCompile}
                extractLoading={extracting}
                compileLoading={generating}
                extractStatus={extractStatus}
                compileStatus={generateStatus}
                dealNotes={extractNotes}
                onDealNotesChange={setExtractNotes}
                loanComplete={Boolean(amount && principal > 0)}
                extractComplete={extractStatus === 'success'}
              />
            </Suspense>

            <div className={T.card + ' p-4'}>
              <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wide mb-3">Quick Start</h2>
              <div className="grid grid-cols-2 gap-2">
                {quickScenarios.map((scenario) => (
                  <button
                    key={scenario.label}
                    onClick={() => applyScenario(scenario)}
                    className="min-h-[52px] rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-left text-xs font-semibold text-slate-800 hover:border-[#1B3A6B] hover:bg-white"
                  >
                    {scenario.label}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs text-slate-500">Pick a starting point, then adjust only what changed.</p>
            </div>

            <div className={T.card + ' p-4'}>
              <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wide mb-4">Client Handoff Details</h2>
              <div className="space-y-3">
                <div>
                  <label className={T.label} htmlFor="borrower-name">Borrower / Client Name</label>
                  <input
                    id="borrower-name"
                    value={borrowerName}
                    onChange={(e) => setBorrowerName(e.target.value)}
                    placeholder="Example Contractor LLC"
                    className={T.input}
                  />
                </div>
                <div>
                  <label className={T.label} htmlFor="use-of-proceeds">Use of Proceeds</label>
                  <select
                    id="use-of-proceeds"
                    value={useOfProceeds}
                    onChange={(e) => setUseOfProceeds(e.target.value)}
                    className={T.input}
                  >
                    <option>Working capital and growth capital</option>
                    <option>Owner-occupied real estate acquisition</option>
                    <option>Equipment purchase and installation</option>
                    <option>Business acquisition financing</option>
                    <option>Debt refinance and cash flow improvement</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={T.label} htmlFor="noi-input">Annual NOI / Cash Flow</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 text-sm font-semibold">$</span>
                      <input
                        id="noi-input"
                        value={Number(netOperatingIncome.replace(/,/g, '')).toLocaleString()}
                        onChange={(e) => setNetOperatingIncome(e.target.value.replace(/[^0-9]/g, ''))}
                        className={T.input + ' pl-7'}
                      />
                    </div>
                  </div>
                  <div>
                    <label className={T.label} htmlFor="lender-name">Handoff To</label>
                    <input
                      id="lender-name"
                      value={lenderName}
                      onChange={(e) => setLenderName(e.target.value)}
                      placeholder="Lender / Advisor"
                      className={T.input}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Loan Parameters */}
            <div className={T.card + ' p-4'}>
              <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wide mb-4">Loan Parameters</h2>

              <div className="space-y-4">
                {/* Program */}
                <div>
                  <label className={T.label} htmlFor="prog-select">SBA Program</label>
                  <select
                    id="prog-select"
                    value={prog}
                    onChange={e => {
                      setProg(e.target.value);
                      const p = PROGRAMS.find(p => p.id === e.target.value);
                      if (p && parseInt(years) > p.maxY) setYears(String(p.maxY));
                    }}
                    className={T.input}
                  >
                    {PROGRAMS.map(p => (
                      <option key={p.id} value={p.id}>{p.label} — {p.note || p.rate}</option>
                    ))}
                  </select>
                </div>

                {/* Amount */}
                <div>
                  <label className={T.label} htmlFor="amount-input">{is504 ? 'Total Project Cost (USD)' : 'Requested Capital (USD)'}</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 text-sm font-semibold">$</span>
                    <input
                      id="amount-input"
                      type="text"
                      value={Number(amount.replace(/,/g, '')).toLocaleString()}
                      onChange={e => setAmount(e.target.value.replace(/[^0-9]/g, ''))}
                      className={T.input + ' pl-7'}
                    />
                  </div>
                </div>

                {/* Rate + Term */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className={T.label} htmlFor="rate-slider">Interest Rate</label>
                      <span className="text-xs font-bold tabular-nums text-slate-900 bg-slate-100 border border-slate-300 px-2 py-0.5">{rateStr}%</span>
                    </div>
                    <input
                      id="rate-slider"
                      type="range" min="4" max="20" step="0.25"
                      value={rateStr}
                      onChange={e => setRateStr(parseFloat(e.target.value).toFixed(2))}
                      className="w-full"
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className={T.label} htmlFor="term-slider">Loan Term</label>
                      <span className="text-xs font-bold tabular-nums text-slate-900 bg-slate-100 border border-slate-300 px-2 py-0.5">{years} yr</span>
                    </div>
                    <input
                      id="term-slider"
                      type="range" min="1" max={selectedProg?.maxY || 25}
                      value={years}
                      onChange={e => setYears(e.target.value)}
                      className="w-full"
                    />
                  </div>
                </div>

                {/* FY26 Waiver */}
                <div className="border-t border-slate-200 pt-3">
                  <label className="flex items-start gap-3 cursor-pointer group">
                    <div className={`w-4 h-4 mt-0.5 border-2 flex items-center justify-center shrink-0 transition-colors duration-150 ${mfr ? 'bg-[#1B3A6B] border-[#1B3A6B]' : 'bg-white border-slate-400 group-hover:border-slate-600'}`}>
                      <input type="checkbox" className="sr-only" checked={mfr} onChange={e => setMfr(e.target.checked)} />
                      {mfr && <Check className="w-2.5 h-2.5 text-white" />}
                    </div>
                    <div>
                      <span className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                        Apply FY26 NAICS 31-33 Manufacturer Fee Waiver
                      </span>
                      <p className="text-xs text-slate-600 mt-0.5">
                        Eliminates upfront SBA guaranty fees for manufacturing entities.{' '}
                        <strong className="text-slate-800">Expires Sep 30, 2026.</strong>
                      </p>
                    </div>
                  </label>
                </div>

                {is504 && (
                  <div className="grid grid-cols-3 gap-2 border-t border-slate-200 pt-3">
                    {[
                      ['Bank', sba504Project.bankLoanAmount],
                      ['CDC', sba504Project.cdcLoanAmount],
                      ['Equity', sba504Project.borrowerEquity],
                    ].map(([label, value]) => (
                      <div key={label} className="border border-slate-200 bg-slate-50 px-2 py-2">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
                        <p className="mt-0.5 text-sm font-bold tabular-nums text-slate-900">{usd(value)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Officer Details (for term sheet) */}
            <div className={T.card + ' p-4'}>
              <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wide mb-4">Officer Details</h2>
              <div className="space-y-3">
                <div>
                  <label className={T.label} htmlFor="officer-email">Originating Officer Email</label>
                  <input
                    id="officer-email"
                    type="email"
                    value={officerEmail}
                    onChange={e => setOfficerEmail(e.target.value)}
                    placeholder="officer@institution.com"
                    className={T.input}
                  />
                </div>
              </div>
            </div>

          </div>

          {/* ── RIGHT COLUMN: Output ── */}
          <div className="lg:col-span-7 space-y-4">

            {/* KPI Summary Bar */}
            <div className="bg-[#0A2540] border border-[#1B3A6B] p-5">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
                <div>
                  <p className={T.kpiLabel}>Monthly D/S</p>
                  <p className={T.kpiValue + ' text-3xl'}>{usd2(displayedMonthly)}</p>
                </div>
                <div>
                  <p className={T.kpiLabel}>Total Interest</p>
                  <p className={T.kpiValue + ' text-3xl'}>{usd(totalInterest)}</p>
                </div>
                <div>
                  <p className={T.kpiLabel}>Annual Rate</p>
                  <p className={T.kpiValue + ' text-2xl'}>{rateStr}%</p>
                </div>
                <div>
                  <p className={T.kpiLabel}>{is504 ? '504 Upfront Fee' : 'Guaranty Fee'}</p>
                  <p className={`${T.kpiValue} ${feeWaived ? 'text-green-300' : ''}`}>
                    {usd(finalFee)}
                    {feeWaived && <span className="ml-2 text-xs font-bold text-green-300 uppercase tracking-wide">Waived</span>}
                  </p>
                  {!is504 && <p className="text-xs tabular-nums text-slate-400">{guarantyFeeAnalysis.guaranteePercent.toFixed(0)}% guaranteed · {guarantyFeeAnalysis.feeRateLabel}</p>}
                  {is504 && <p className="text-xs tabular-nums text-slate-400">CDC portion · annual fee {feeWaived ? '$0' : usd(sba504Project.firstYearAnnualServiceFee)}</p>}
                </div>
              </div>

              {/* Principal / Interest composition bar */}
              <div>
                <div className="flex justify-between text-xs font-semibold uppercase tracking-wide mb-1.5">
                  <span className="text-white">Principal — {principalPct.toFixed(0)}%</span>
                  <span className="text-slate-400">Interest — {(100 - principalPct).toFixed(0)}%</span>
                </div>
                <div className="h-2 bg-[#1B3A6B] overflow-hidden flex border border-slate-600">
                  <div
                    className="bg-white h-full transition-all duration-150"
                    style={{ width: `${principalPct}%` }}
                  />
                  <div className="bg-slate-600 h-full flex-1" />
                </div>
                <div className="mt-1.5 flex items-center gap-4 text-xs text-slate-400">
                  <span className="tabular-nums">{years}-year term · {n} payments · {rateStr}% annual rate</span>
                  {feeWaived && (
                    <span className="text-green-300 font-bold uppercase tracking-wide">FY26 Waiver Active</span>
                  )}
                </div>
              </div>
            </div>

            {/* Guarantee Fee Breakdown Panel */}
            {!is504 && principal > 0 && (
              <div className="border border-slate-200 bg-white rounded-xl overflow-hidden shadow-sm">
                <div className="bg-[#0A2540] px-5 py-3 flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-widest text-slate-200">SBA Guarantee Analysis</span>
                  {feeWaived && <span className="text-xs font-bold uppercase text-green-300 bg-green-900/40 border border-green-700/40 px-2 py-0.5 rounded-full">FY26 Waiver Applied</span>}
                  {!feeWaived && <span className="text-xs text-slate-400">{guarantyFeeAnalysis.feeRateLabel} fee rate</span>}
                </div>
                <div className="divide-y divide-slate-100">
                  {[
                    { label: 'Loan Amount', value: usd(principal) },
                    { label: 'SBA Guarantee %', value: guarantyFeeAnalysis.guaranteePercent.toFixed(0) + '%' },
                    { label: 'Guaranteed Amount', value: usd(guarantyFeeAnalysis.guaranteedAmount) },
                    { label: 'Upfront Guarantee Fee', value: feeWaived ? '$0 Waived' : usd2(finalFee), highlight: feeWaived },
                    { label: 'Annual Service Fee', value: '0.55% of guaranteed balance' },
                    { label: 'Est. Yr-1 Service Fee', value: usd2((guarantyFeeAnalysis.guaranteedAmount || 0) * 0.0055) },
                  ].map(({ label, value, highlight }) => (
                    <div key={label} className="flex items-center justify-between px-5 py-2.5">
                      <span className="text-xs font-medium text-slate-500">{label}</span>
                      <span className={highlight ? 'text-xs font-bold tabular-nums text-green-600' : 'text-xs font-bold tabular-nums text-slate-800'}>{value}</span>
                    </div>
                  ))}
                  {(guarantyFeeAnalysis.notes || []).map((note, i) => (
                    <div key={i} className="px-5 py-2 bg-amber-50">
                      <p className="text-[11px] text-amber-700">{note}</p>
                    </div>
                  ))}
                </div>
                <div className="px-5 py-3 bg-slate-50 border-t border-slate-200">
                  <p className="text-[11px] text-slate-400 leading-relaxed">Per SBA SOP 50 10 7, FY2026. Annual service fee accrues on outstanding guaranteed balance.</p>
                </div>
              </div>
            )}
            <div className="border border-slate-300 bg-white p-4 rounded-xl shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-600">Plain-English Client Explanation</p>
                  <p className="mt-1 text-sm text-slate-600">Generate client-friendly language for emails, calls, and handoff memos.</p>
                </div>
                <button
                  onClick={handleExplain}
                  disabled={explaining || principal <= 0}
                  className={T.btnSecondary + ' shrink-0'}
                >
                  {explaining ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquare className="h-4 w-4" />}
                  Explain Simply
                </button>
              </div>
              <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-sm leading-relaxed text-slate-700 whitespace-pre-line">
                  {plainEnglish || buildPlainEnglishFallback()}
                </p>
              </div>
            </div>

            {/* Amortization Charts (Phase 3) */}
            <Suspense fallback={<div className="h-48 animate-pulse bg-slate-100 rounded" />}>
              <PrincipalInterestChart scheduleData={fullScheduleData} />
              <RemainingBalanceChart scheduleData={fullScheduleData} />
            </Suspense>

            {/* Amortization Schedule */}
            <div className="border border-slate-300 overflow-hidden bg-white">
              <div className="bg-slate-50 border-b border-slate-300 px-4 py-2.5 flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-slate-600" />
                  <span className="text-xs font-bold text-slate-900 uppercase tracking-wide">Amortization Schedule</span>
                  <span className="text-xs text-slate-600 border border-slate-300 px-1.5 py-0.5 bg-white tabular-nums">
                    First 12 months of {n}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={copyAll} className={T.btnSecondary + ' text-xs py-1.5 px-3'} aria-label="Copy amortization data to clipboard">
                    {copied === 'all' ? <Check className="w-3.5 h-3.5 text-[#1B3A6B]" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied === 'all' ? 'Copied' : 'Copy Data'}
                  </button>
                  <button onClick={exportCSV} className={T.btnSecondary + ' text-xs py-1.5 px-3'} aria-label="Export amortization schedule as CSV">
                    <Download className="w-3.5 h-3.5" /> Export CSV
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto overflow-y-auto max-h-[480px]">
                <table className="w-full border-collapse min-w-[560px]">
                  <caption className="sr-only">SBA Loan Amortization Schedule — First 12 Months</caption>
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-[#0A2540]">
                      <th className={T.th + ' w-16'}>Mo.</th>
                      <th className={T.th + ' text-right'}>Payment</th>
                      <th className={T.th + ' text-right'}>Principal</th>
                      <th className={T.th + ' text-right'}>Interest</th>
                      <th className={T.th + ' text-right'}>Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {scheduleRows.map((r, idx) => (
                      <tr key={r.m} className={`${idx % 2 === 1 ? 'bg-slate-50' : 'bg-white'} hover:bg-slate-100 transition-colors duration-150 group`}>
                        <td className="py-2 px-4 text-xs font-bold tabular-nums text-slate-800">{r.m}</td>
                        {[['pay', r.pay], ['pri', r.pri], ['int', r.int], ['bal', r.bal]].map(([k, v]) => (
                          <td
                            key={k}
                            onClick={() => copy(usd2(v), `${k}-${r.m}`)}
                            className="py-2 px-4 text-right text-sm tabular-nums cursor-pointer"
                            title={`Copy ${k}`}
                          >
                            <span className={`
                              ${k === 'pay' ? 'font-semibold text-slate-900' : ''}
                              ${k === 'int' ? 'text-slate-600' : 'text-slate-800'}
                              ${k === 'bal' ? 'font-medium' : ''}
                            `}>
                              {copied === `${k}-${r.m}`
                                ? <span className="text-[#1B3A6B] font-semibold">Copied</span>
                                : usd2(v)
                              }
                            </span>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-50 border-t border-slate-200">
                      <td colSpan={5} className="py-2 px-4 text-center text-xs text-slate-500 uppercase tracking-wide font-semibold">
                        Displaying months 1–{Math.min(n, 12)} of {n} · Click any cell to copy · Export CSV for full schedule
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <div className="border-t border-slate-200 p-4">
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════
// ELIGIBILITY SCREENER
// ═══════════════════════════════════════════════════════════
function EligibilityScreener({ nav }) {
  const [current,  setCurrent]  = useState(0);
  const [answers,  setAnswers]  = useState({});
  const [selected, setSelected] = useState('');
  const [result,   setResult]   = useState(null);

  const q = SCREENER_QUESTIONS[current];

  const evaluateAnswers = (nextAnswers) => {
    const detail = SCREENER_QUESTIONS.map(question => {
      const opt = question.options.find(o => o.value === nextAnswers[question.id]);
      return {
        id: question.id,
        question: question.q,
        answer: opt?.label || 'Not answered',
        flag: opt?.flag || 'none',
      };
    });
    const hardStops = detail.filter(item => item.flag === 'red');
    const conditions = detail.filter(item => item.flag === 'yellow');
    const score = Math.max(0, Math.round(100 - hardStops.length * 30 - conditions.length * 12));
    const status = hardStops.length > 0 ? 'disqualified' : conditions.length > 0 ? 'conditional' : 'approved';
    return { status, score, detail, hardStops, conditions };
  };

  const advance = () => {
    if (!selected) return;
    const next = { ...answers, [q.id]: selected };
    setAnswers(next);
    setSelected('');
    if (current + 1 >= SCREENER_QUESTIONS.length) {
      setResult(evaluateAnswers(next));
    } else {
      setCurrent(c => c + 1);
    }
  };

  const reset = () => { setCurrent(0); setAnswers({}); setSelected(''); setResult(null); };

  if (result) {
    const cfg = {
      approved:     { label: 'Pre-Qualification: Approved',     summary: 'Strong file. Proceed to structure the request and collect documentation.' },
      conditional:  { label: 'Pre-Qualification: Conditional',  summary: 'Potentially workable file. Address the listed conditions before lender submission.' },
      disqualified: { label: 'Pre-Qualification: Disqualified', summary: 'Hard-stop criteria found. Standard SBA financing is unlikely under current inputs.' },
    }[result.status];

    const borderCls = result.status === 'approved' ? 'border-l-green-700'  : result.status === 'conditional' ? 'border-l-amber-600' : 'border-l-red-700';
    const textCls   = result.status === 'approved' ? 'text-green-800'      : result.status === 'conditional' ? 'text-amber-800'     : 'text-red-800';
    const bgCls     = result.status === 'approved' ? 'bg-green-50'         : result.status === 'conditional' ? 'bg-amber-50'        : 'bg-red-50';

    return (
      <div className="max-w-4xl mx-auto space-y-4">
        <div className={`bg-white border border-slate-300 border-l-4 ${borderCls} p-6`}>
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-5">
            <div>
              <div className={`inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wide px-2 py-1 mb-3 ${bgCls} ${textCls} border ${result.status === 'approved' ? 'border-green-300' : result.status === 'conditional' ? 'border-amber-300' : 'border-red-300'}`}>
                {result.status === 'approved' && <CheckCircle className="w-3.5 h-3.5" />}
                {cfg.label}
              </div>
              <h1 className="text-2xl font-bold text-slate-900">Eligibility analysis complete</h1>
              <p className="mt-1 text-sm text-slate-700">{cfg.summary}</p>
            </div>
            <div className="border border-slate-300 bg-slate-50 px-4 py-3 text-center min-w-[120px]">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-600">Readiness Score</p>
              <p className={`text-3xl font-bold tabular-nums ${textCls}`}>{result.score}</p>
              <p className="text-xs text-slate-500">out of 100</p>
            </div>
          </div>

          <p className="text-sm text-slate-800 leading-relaxed mb-6">
            {result.status === 'approved'
              ? 'Application parameters satisfy foundational SBA SOP 50 10 7 credit requirements. Proceed to loan structuring and document collection.'
              : result.status === 'conditional'
              ? 'One or more conditional factors identified. Application may qualify subject to lender discretion and compensating documentation.'
              : 'One or more hard-stop criteria identified under SBA SOP 50 10 7. Standard SBA program financing is not available under current parameters.'}
          </p>

          <div className="grid md:grid-cols-2 gap-3 mb-6">
            <div className="border border-slate-300 bg-slate-50 p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-900 mb-2">Flags Found</p>
              <p className="text-sm text-slate-700">
                {result.hardStops.length} hard stop{result.hardStops.length === 1 ? '' : 's'} · {result.conditions.length} condition{result.conditions.length === 1 ? '' : 's'}
              </p>
            </div>
            <div className="border border-slate-300 bg-slate-50 p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-900 mb-2">Recommended Next Step</p>
              <p className="text-sm text-slate-700">
                {result.status === 'approved' ? 'Build the amortization model and checklist.' : result.status === 'conditional' ? 'Resolve conditional items before packaging.' : 'Consider alternative financing pathways.'}
              </p>
            </div>
          </div>

          {(result.hardStops.length > 0 || result.conditions.length > 0) && (
            <div className="border border-slate-300 overflow-hidden mb-6">
              <div className="bg-slate-50 border-b border-slate-300 px-4 py-2">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">Items Requiring Attention</span>
              </div>
              {[...result.hardStops, ...result.conditions].map(item => (
                <div key={item.id} className="px-4 py-3 border-b border-slate-100 last:border-0">
                  <p className="text-xs font-semibold text-slate-900">{item.question}</p>
                  <p className={`text-xs mt-0.5 ${item.flag === 'red' ? 'text-red-700' : 'text-amber-700'}`}>{item.answer}</p>
                </div>
              ))}
            </div>
          )}

          {(result.status === 'approved' || result.status === 'conditional') && (
            <div className="grid sm:grid-cols-2 gap-3 mb-6">
              <button onClick={() => nav('calculator')} className={T.btnPrimary + ' justify-center'}>
                <Calculator className="w-4 h-4" /> Open Amortization Terminal
              </button>
              <button onClick={() => nav('checklist')} className={T.btnSecondary + ' justify-center'}>
                <CheckSquare className="w-4 h-4" /> Build Document Checklist
              </button>
            </div>
          )}

          {result.status === 'disqualified' && (
            <div className="border border-slate-300 overflow-hidden mb-6">
              <div className="bg-slate-50 border-b border-slate-300 px-4 py-2">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">Alternative Financing Pathways</span>
              </div>
              {[
                ['SBA Microloan Program',       'Loans up to $50,000; more flexible credit requirements for early-stage businesses.'],
                ['CDFI Network',                'Community Development Financial Institutions serve borrowers outside standard SBA thresholds.'],
                ['Credit Score Remediation',    'FICO above 650 unlocks standard SBA eligibility. Disciplined payment history over 60–90 days typically produces measurable score improvement.'],
                ['SBA Lender Match',            'Official SBA platform matching applicants with lenders specializing in non-standard files.'],
              ].map(([title, desc]) => (
                <div key={title} className="px-4 py-3 border-b border-slate-100 last:border-0 flex items-start gap-3">
                  <ChevronRight className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold text-slate-900">{title}</p>
                    <p className="text-xs text-slate-600 mt-0.5">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          <button onClick={reset} className={T.btnSecondary} aria-label="Start new eligibility inquiry">New Inquiry</button>
        </div>
        <AdSenseSlot placement="landingBottom" className="mt-4 rounded-sm" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-4">

      <PremiumForm
        title={`${q.q}`}
        subtitle={q.hint || 'Select the option that best describes your situation.'}
        currentStep={current + 1}
        totalSteps={SCREENER_QUESTIONS.length}
        onBack={() => {
          if (current > 0) {
            setCurrent(c => c - 1);
            setSelected(answers[SCREENER_QUESTIONS[current - 1].id] || '');
          }
        }}
        onNext={advance}
        onSubmit={advance}
        backDisabled={current === 0}
        nextDisabled={!selected}
        isLastStep={current + 1 === SCREENER_QUESTIONS.length}
        nextLabel={current + 1 === SCREENER_QUESTIONS.length ? 'Submit for Analysis' : 'Continue'}
        submitLabel="Get Final Result"
      >
        {/* Options */}
        <div className="space-y-3">
          {q.options.map((opt) => (
            <PremiumRadioOption
              key={opt.value}
              value={opt.value}
              selected={selected === opt.value}
              label={opt.label}
              description={null}
              flag={opt.flag || 'none'}
              onChange={setSelected}
            />
          ))}
        </div>
      </PremiumForm>

    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// DOCUMENT CHECKLIST
// ═══════════════════════════════════════════════════════════
function DocumentChecklist() {
  const [loanType,    setLoanType]    = useState('');
  const [entity,      setEntity]      = useState('');
  const [explaining,  setExplaining]  = useState(null);
  const [explanation, setExplanation] = useState('');
  const [loading,     setLoading]     = useState(false);
  const [checked,     setChecked]     = useState(new Set());

  const items = (loanType && entity) ? [
    'SBA Form 1919 — Borrower Information Form',
    'SBA Form 413 — Personal Financial Statement',
    '3 Years Federal Business Tax Returns',
    'YTD Profit & Loss Statement and Balance Sheet',
    'Business Debt Schedule',
    'Government-Issued Photo Identification',
    entity === 'LLC' ? 'LLC Operating Agreement' : 'Articles of Incorporation',
    loanType === 'real_estate' ? 'Commercial Real Estate Purchase Contract' : 'Detailed Use of Proceeds Statement',
  ] : [];

  const explain = async (item) => {
    setExplaining(item); setLoading(true); setExplanation('');
    try {
      const text = await fetchAI(
        `In 2–3 precise sentences, explain why the SBA requires this document for underwriting: "${item}". Be strictly factual.`,
        'Formal commercial banking compliance system.'
      );
      setExplanation(text);
    } catch {
      setExplanation('Definition unavailable. Consult SBA SOP 50 10 7 directly.');
    } finally { setLoading(false); }
  };

  const toggle = (item) => {
    const next = new Set(checked);
    next.has(item) ? next.delete(item) : next.add(item);
    setChecked(next);
  };

  const completedCount = items.filter(i => checked.has(i)).length;
  const hasSelection = Boolean(loanType && entity);

  const exportChecklist = () => {
    if (!items.length) return;
    const now = new Date().toLocaleString();
    const rows = items.map((item, index) => `
      <tr>
        <td>${index + 1}</td>
        <td>${item}</td>
        <td>${checked.has(item) ? 'Confirmed' : 'Outstanding'}</td>
      </tr>
    `).join('');
    const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>BondSBA Terminal Document Checklist</title>
  <style>
    body { font-family: Arial, sans-serif; color: #0f172a; margin: 32px; line-height: 1.5; }
    h1 { margin: 0 0 4px; color: #0A2540; }
    p { margin: 4px 0 16px; }
    table { border-collapse: collapse; width: 100%; margin-top: 20px; }
    th, td { border: 1px solid #cbd5e1; padding: 10px; text-align: left; font-size: 13px; }
    th { background: #0A2540; color: white; }
    .summary { background: #f8fafc; border: 1px solid #cbd5e1; padding: 12px; margin-top: 16px; }
  </style>
</head>
<body>
  <h1>BondSBA Terminal Document Checklist</h1>
  <p>Generated ${now}</p>
  <div class="summary">
    <strong>Transaction:</strong> ${loanType.replace(/_/g, ' ') || 'Not selected'}<br />
    <strong>Entity:</strong> ${entity || 'Not selected'}<br />
    <strong>Progress:</strong> ${completedCount} of ${items.length} confirmed
  </div>
  <table>
    <thead><tr><th>#</th><th>Document</th><th>Status</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <p>This checklist is a planning aid. Verify requirements against current SBA SOP and lender policy.</p>
</body>
</html>`;
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'bondsba-terminal-document-checklist.html';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div className="flex items-center justify-between border-b border-slate-300 pb-3">
        <div>
          <h1 className={`${T.sectionHead} text-xl`}>Compliance Document Checklist</h1>
          <p className="text-sm text-slate-600 mt-0.5">Generate entity- and transaction-specific SBA document requirements</p>
        </div>
      </div>

      <div className={T.card + ' p-5'}>
        <div className="grid sm:grid-cols-2 gap-6">
          <PremiumSelect
            id="loan-type"
            label="Transaction Classification"
            value={loanType}
            onChange={e => { setLoanType(e.target.value); setExplaining(null); setChecked(new Set()); }}
            options={[
              { value: '', label: 'Select transaction type…' },
              { value: 'working_capital', label: 'Working Capital / Equipment Acquisition' },
              { value: 'real_estate', label: 'Commercial Real Estate' },
              { value: 'acquisition', label: 'Business Acquisition' },
            ]}
            required
          />
          <PremiumSelect
            id="entity-type"
            label="Borrowing Entity Structure"
            value={entity}
            onChange={e => { setEntity(e.target.value); setExplaining(null); setChecked(new Set()); }}
            options={[
              { value: '', label: 'Select entity type…' },
              { value: 'LLC', label: 'Limited Liability Company (LLC)' },
              { value: 'Corp', label: 'S-Corporation / C-Corporation' },
              { value: 'SoleProp', label: 'Sole Proprietorship' },
            ]}
            required
          />
        </div>
      </div>

      {!hasSelection && (
        <section className="border border-slate-300 bg-white rounded-xl shadow-sm p-5">
          <h2 className="text-lg font-bold text-slate-900">Start With Two Inputs</h2>
          <p className="mt-2 text-sm text-slate-700">
            Select transaction type and entity structure to generate the working checklist your team can execute.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {[
              ['Pick Loan Type', 'Working capital, real estate, or acquisition path.'],
              ['Pick Entity', 'LLC, corporation, or sole prop requirements.'],
              ['Export Checklist', 'Download the missing-item report for follow-up.'],
            ].map(([title, copy]) => (
              <article key={title} className="border border-slate-200 bg-slate-50 rounded-lg p-3">
                <p className="text-sm font-semibold text-slate-900">{title}</p>
                <p className="mt-1 text-sm text-slate-700">{copy}</p>
              </article>
            ))}
          </div>
        </section>
      )}

      {items.length > 0 && (
        <div className="space-y-4">
          <AdSenseSlot placement="inFeed" className="rounded-sm" />
        <div className="grid gap-3 md:grid-cols-4">
          <div className="border border-slate-300 bg-white p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">Transaction</p>
            <p className="mt-1 text-sm font-bold text-slate-900">{loanType.replace(/_/g, ' ')}</p>
          </div>
          <div className="border border-slate-300 bg-white p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">Entity</p>
            <p className="mt-1 text-sm font-bold text-slate-900">{entity}</p>
          </div>
          <div className="border border-slate-300 bg-white p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">Documents</p>
            <p className="mt-1 text-sm font-bold text-slate-900">{items.length} required</p>
          </div>
          <div className="border border-slate-300 bg-white p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">Report Status</p>
            <p className="mt-1 text-sm font-bold text-slate-900">{completedCount === items.length ? 'Packet ready to share' : 'Checklist report ready'}</p>
          </div>
        </div>

        <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-700">
          <span className="font-semibold text-slate-900">Report ready:</span> Download the checklist packet to share a clean missing-items view instead of walking the borrower through the screen.
        </div>

        <div className="border border-slate-300 overflow-hidden bg-white">
          <div className="bg-slate-50 border-b border-slate-300 px-4 py-2.5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-slate-900 uppercase tracking-wide">Required Documents</span>
              <span className="text-xs tabular-nums text-slate-700 bg-white border border-slate-300 px-2 py-0.5">
                {completedCount} / {items.length} confirmed
              </span>
            </div>
            <button
              onClick={exportChecklist}
              className={T.btnSecondary + ' text-xs py-1.5 px-3'}
            >
              <Download className="w-3.5 h-3.5" /> Download Report
            </button>
          </div>

          {/* Progress bar */}
          <div className="h-0.5 bg-slate-200">
            <div
              className="h-full bg-[#1B3A6B] transition-all duration-150"
              style={{ width: `${items.length > 0 ? (completedCount / items.length) * 100 : 0}%` }}
            />
          </div>

          <div className="divide-y divide-slate-200">
            {items.map((item) => (
              <div key={item}>
                <div
                  onClick={() => toggle(item)}
                  className="px-4 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors duration-150 cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-5 h-5 border-2 flex items-center justify-center shrink-0 rounded-sm transition-colors duration-150 ${checked.has(item) ? 'bg-[#1B3A6B] border-[#1B3A6B]' : 'bg-white border-slate-400 group-hover:border-slate-600'}`}>
                      {checked.has(item) && <Check className="w-3 h-3 text-white" />}
                    </div>
                    <span className={`text-sm font-medium transition-colors duration-150 ${checked.has(item) ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
                      {item}
                    </span>
                  </div>
                  <button
                    onClick={e => { e.stopPropagation(); explain(item); }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity duration-150 text-xs font-bold text-slate-700 uppercase tracking-wide bg-white border border-slate-300 hover:border-slate-500 px-2.5 py-1.5 flex items-center gap-1.5 cursor-pointer rounded-sm shrink-0"
                    aria-label={`Define: ${item}`}
                  >
                    <MessageSquare className="w-3 h-3" /> Define
                  </button>
                </div>

                {explaining === item && (
                  <div className="px-12 py-3 bg-slate-50 border-t border-slate-200">
                    {loading
                      ? <div className="flex items-center gap-2 text-slate-600 text-xs"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Retrieving definition…</div>
                      : (
                        <div className="text-xs text-slate-800 leading-relaxed">
                          {explanation}
                          <p className="mt-2 pt-2 border-t border-slate-200 text-xs text-slate-500 font-medium">
                            AI-generated reference only. Verify all document requirements against current{' '}
                            <strong>SBA SOP 50 10 7</strong> and your authorized SBA Preferred Lender.
                          </p>
                        </div>
                      )
                    }
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
        </div>
      )}

    </div>
  );
}

function IntegrationsHub() {
  const integrations = [
    { name: 'Email', value: 'Gmail/Outlook thread capture for owner follow-up', status: 'Planned', impact: 'Reduces inbox-based handoff misses' },
    { name: 'CRM / AMS', value: 'Salesforce/HubSpot/AMS sync for stage + owner + notes', status: 'Planned', impact: 'Maintains one execution source of truth' },
    { name: 'Accounting', value: 'QuickBooks/Xero export for packet consistency checks', status: 'Planned', impact: 'Reduces manual re-keying of financials' },
    { name: 'Drive', value: 'Google Drive/SharePoint folder map for completeness', status: 'Planned', impact: 'Flags missing supporting documents faster' },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      <section className="rounded-xl border border-slate-300 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className={T.sectionHead}>Integrations Hub</h1>
            <p className="text-sm text-slate-600 mt-1">Connect existing systems to reduce re-keying and improve handoff continuity.</p>
          </div>
          <div className="grid grid-cols-2 gap-2 text-right">
            <div className="border border-slate-200 rounded-lg bg-slate-50 px-3 py-2">
              <p className="text-[11px] uppercase tracking-wide text-slate-500">Connectors</p>
              <p className="text-xl font-bold tabular-nums text-slate-900">{integrations.length}</p>
            </div>
            <div className="border border-slate-200 rounded-lg bg-slate-50 px-3 py-2">
              <p className="text-[11px] uppercase tracking-wide text-slate-500">Mode</p>
              <p className="text-sm font-semibold text-slate-900 mt-1">CSV fallback</p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid md:grid-cols-2 gap-3">
        {integrations.map((item) => (
          <article key={item.name} className="rounded-xl border border-slate-300 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <p className="text-base font-bold text-slate-900">{item.name}</p>
              <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-700">{item.status}</span>
            </div>
            <p className="mt-2 text-sm text-slate-700 leading-relaxed">{item.value}</p>
            <p className="mt-2 text-xs text-slate-500">{item.impact}</p>
          </article>
        ))}
      </section>
    </div>
  );
}

function ROIDashboard() {
  const [baselineDays, setBaselineDays] = useState(21);
  const [currentDays, setCurrentDays] = useState(13);
  const [reworkBefore, setReworkBefore] = useState(9);
  const [reworkNow, setReworkNow] = useState(4);
  const [convBefore, setConvBefore] = useState(18);
  const [convNow, setConvNow] = useState(29);
  const cycleLift = Math.max(0, Math.round(((baselineDays - currentDays) / baselineDays) * 100));
  const reworkLift = Math.max(0, Math.round(((reworkBefore - reworkNow) / reworkBefore) * 100));
  const convLift = Math.max(0, convNow - convBefore);

  const impactRows = [
    ['Cycle-time reduction', `${cycleLift}%`],
    ['Rework reduction', `${reworkLift}%`],
    ['Conversion lift', `+${convLift} pts`],
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      <section className="rounded-xl border border-slate-300 bg-white p-5 shadow-sm">
        <h1 className={T.sectionHead}>ROI Dashboard</h1>
        <p className="text-sm text-slate-600 mt-1">Measure cycle-time, rework, and conversion movement from cleaner submission workflows.</p>
        <div className="mt-4 grid md:grid-cols-3 gap-3">
          {impactRows.map(([label, value]) => (
            <article key={label} className="border border-slate-200 bg-slate-50 rounded-lg p-3">
              <p className="text-sm text-slate-600">{label}</p>
              <p className="mt-1 text-3xl font-bold tabular-nums text-slate-900">{value}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-slate-300 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900">Scenario Inputs</h2>
        <div className="mt-3 grid md:grid-cols-3 gap-3">
          <label className="border border-slate-200 bg-slate-50 rounded-lg p-3">
            <p className="text-[11px] uppercase tracking-wide text-slate-500">Cycle Days (Before / Now)</p>
            <div className="mt-2 flex items-center gap-2">
              <input type="number" value={baselineDays} min={1} onChange={(e) => setBaselineDays(Math.max(1, Number(e.target.value) || 1))} className={T.input} />
              <span className="text-slate-500">→</span>
              <input type="number" value={currentDays} min={1} onChange={(e) => setCurrentDays(Math.max(1, Number(e.target.value) || 1))} className={T.input} />
            </div>
          </label>
          <label className="border border-slate-200 bg-slate-50 rounded-lg p-3">
            <p className="text-[11px] uppercase tracking-wide text-slate-500">Rework Items (Before / Now)</p>
            <div className="mt-2 flex items-center gap-2">
              <input type="number" value={reworkBefore} min={1} onChange={(e) => setReworkBefore(Math.max(1, Number(e.target.value) || 1))} className={T.input} />
              <span className="text-slate-500">→</span>
              <input type="number" value={reworkNow} min={0} onChange={(e) => setReworkNow(Math.max(0, Number(e.target.value) || 0))} className={T.input} />
            </div>
          </label>
          <label className="border border-slate-200 bg-slate-50 rounded-lg p-3">
            <p className="text-[11px] uppercase tracking-wide text-slate-500">Conversion % (Before / Now)</p>
            <div className="mt-2 flex items-center gap-2">
              <input type="number" value={convBefore} min={0} max={100} onChange={(e) => setConvBefore(Math.max(0, Math.min(100, Number(e.target.value) || 0)))} className={T.input} />
              <span className="text-slate-500">→</span>
              <input type="number" value={convNow} min={0} max={100} onChange={(e) => setConvNow(Math.max(0, Math.min(100, Number(e.target.value) || 0)))} className={T.input} />
            </div>
          </label>
        </div>
      </section>
    </div>
  );
}

function TrustSecurityPage() {
  const controls = [
    { name: 'Authentication', control: 'Protected workflows require signed-in session', owner: 'Platform', status: 'Active' },
    { name: 'Authorization', control: 'Role and domain isolation checks on sensitive routes', owner: 'API', status: 'Active' },
    { name: 'Abuse Protection', control: 'Rate limiting on high-cost and high-risk endpoints', owner: 'Edge', status: 'Active' },
    { name: 'Crawl Boundaries', control: 'Noindex policy on protected application pages', owner: 'Web', status: 'Active' },
    { name: 'Auditability', control: 'Sensitive actions logged for operational review', owner: 'Security', status: 'Active' },
  ];

  const downloadSummary = () => {
    const lines = [
      'BondSBA Trust & Security Summary',
      `Generated: ${new Date().toISOString()}`,
      '',
      ...controls.map((c) => `${c.name}: ${c.control} [Owner: ${c.owner}] [Status: ${c.status}]`),
      '',
      'This summary supports workflow due diligence and does not replace legal/security review.',
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'bondsba-trust-security-summary.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      <section className="rounded-xl border border-slate-300 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className={T.sectionHead}>Trust & Security</h1>
            <p className="text-sm text-slate-600 mt-1">Operational controls designed for sensitive submission workflows and owner-scoped execution.</p>
          </div>
          <button onClick={downloadSummary} className={T.btnSecondary}>
            <Download className="w-4 h-4" /> Download Summary
          </button>
        </div>
        <div className="mt-4 grid md:grid-cols-3 gap-3">
          {[
            ['Protected Routes', 'Enabled'],
            ['Role Controls', 'Enforced'],
            ['Audit Coverage', 'Active'],
          ].map(([label, value]) => (
            <article key={label} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-[11px] uppercase tracking-wide text-slate-500">{label}</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">{value}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-slate-300 bg-white p-5 shadow-sm overflow-x-auto">
        <h2 className="text-lg font-bold text-slate-900">Control Matrix</h2>
        <table className="w-full min-w-[680px] mt-3 border-collapse">
          <thead>
            <tr className="bg-[#0A2540]">
              <th className={T.th}>Domain</th>
              <th className={T.th}>Control</th>
              <th className={T.th}>Owner</th>
              <th className={T.th}>Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {controls.map((row, idx) => (
              <tr key={row.name} className={idx % 2 ? 'bg-slate-50' : 'bg-white'}>
                <td className={T.td + ' font-semibold'}>{row.name}</td>
                <td className={T.td}>{row.control}</td>
                <td className={T.td}>{row.owner}</td>
                <td className={T.td}>
                  <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
                    {row.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function WorkflowSteps({ active, nav }) {
  const steps = [
    ['opsQueue', 'Intake'],
    ['readinessEngine', 'Readiness'],
    ['wip', 'WIP Review'],
    ['handoffMemos', 'Handoff'],
  ];
  const activeIdx = steps.findIndex(([k]) => k === active);
  return (
    <nav aria-label="Workflow progress" className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-slate-500">
      {steps.map(([key, label], idx) => {
        const isActive = idx === activeIdx;
        const isDone = idx < activeIdx;
        const clickable = nav && key !== active;
        return (
          <React.Fragment key={key}>
            <button
              type="button"
              onClick={() => clickable && nav(key)}
              disabled={!clickable}
              className={`inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 ${
                isActive ? 'font-semibold text-slate-900' : isDone ? 'text-slate-600 hover:bg-slate-100' : 'text-slate-400'
              } ${clickable ? 'cursor-pointer' : 'cursor-default'}`}
            >
              <span className={`flex h-4 w-4 items-center justify-center rounded-full font-mono text-[10px] ${isActive ? 'bg-slate-900 text-white' : isDone ? 'bg-slate-300 text-slate-700' : 'bg-slate-100 text-slate-400'}`}>{idx + 1}</span>
              {label}
            </button>
            {idx < steps.length - 1 && <span className="text-slate-300">›</span>}
          </React.Fragment>
        );
      })}
    </nav>
  );
}

function ReadinessEnginePage({ nav }) {
  const [filePrepState, setFilePrepState] = useState(DEFAULT_FILE_PREP_STATE);

  return (
    <div className="space-y-4">
      <div className="pb-5 mb-2">
        <div className="flex items-center gap-2 mb-3">
          <span aria-hidden className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Bond · Readiness</p>
        </div>
        <WorkflowSteps active="readinessEngine" nav={nav} />
        <h1 className="mt-3 text-[26px] font-semibold tracking-[-0.02em] text-slate-900 md:text-[30px]">Submission Readiness</h1>
        <p className="mt-1 max-w-2xl text-[14px] text-slate-500">Find missing items, stale documents, and handoff gaps before lender or surety review.</p>
        <div className="mt-5 h-px w-full bg-slate-200" />
      </div>

      <section className="grid gap-4 lg:grid-cols-[1.35fr_1fr]">
        <div className="order-2 lg:order-1">
          <ReadinessOutputPanel state={filePrepState} />
        </div>
        <div className="order-1 lg:order-2">
          <ContractorFileInputPanel
            state={filePrepState}
            onChange={setFilePrepState}
            onRunReadiness={() => nav('readinessEngine')}
            onSkipToWorkspace={() => nav('opsQueue')}
            compact
            showPreview={false}
          />
        </div>
      </section>
    </div>
  );
}

function WipReviewPage({ nav }) {
  const [state, setState] = useState({
    ...DEFAULT_FILE_PREP_STATE,
    inputMethod: 'manual',
    contractorName: 'Northline Civil LLC',
    activeJobs: '12',
    largestJobPercent: '42',
    wipStatus: 'received',
    financialsStatus: 'received',
    marginFade: 'yes',
    underbillings: 'yes',
    overbillings: 'no',
    costToComplete: 'partial',
  });
  const analysis = useMemo(() => evaluateFilePrepState(state), [state]);

  const marginStatus = state.marginFade === 'yes' ? 'Moderate' : state.marginFade === 'unsure' ? 'Needs review' : 'Low';
  const underbillingStatus = state.underbillings === 'yes' ? 'Elevated' : state.underbillings === 'unsure' ? 'Needs review' : 'Low';
  const overbillingStatus = state.overbillings === 'yes' ? 'Needs review' : 'Low';
  const concentrationStatus = Number(state.largestJobPercent || 0) > 40 ? 'Needs review' : 'Low';
  const dataQualityStatus = state.documents.currentWipSchedule && state.costToComplete !== 'no' ? 'Strong' : 'Needs review';

  const wipCards = [
    ['WIP Quality', `${Math.max(0, Math.min(100, analysis.score + 10))}`, analysis.wipReview.label, analysis.whyFlagged, analysis.reviewNext],
    ['Margin Fade', marginStatus, marginStatus, 'Why flagged: margin fade signal based on quick review input.', 'Review next: validate cost-to-complete assumptions.'],
    ['Underbilling Stress', underbillingStatus, underbillingStatus, 'Why flagged: underbilling marker from active jobs.', 'Review next: confirm billing timing and cash conversion.'],
    ['Overbilling Exposure', overbillingStatus, overbillingStatus, 'Why flagged: overbilling marker from active jobs.', 'Review next: verify earned-to-billed alignment.'],
    ['Backlog Concentration', concentrationStatus, concentrationStatus, `Why flagged: largest job is ${state.largestJobPercent || '0'}% of backlog.`, 'Review next: assess dependency and capacity strain.'],
    ['Data Quality', dataQualityStatus, dataQualityStatus, 'Why flagged: based on WIP receipt and cost-to-complete detail.', 'Review next: refresh documentation and assumptions.'],
  ];

  return (
    <div className="space-y-4">
      <div className="pb-5 mb-2">
        <div className="flex items-center gap-2 mb-3">
          <span aria-hidden className="inline-block h-2 w-2 rounded-full bg-amber-500" />
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Bond · WIP Review</p>
        </div>
        <WorkflowSteps active="wip" nav={nav} />
        <h1 className="mt-3 text-[26px] font-semibold tracking-[-0.02em] text-slate-900 md:text-[30px]">WIP Review</h1>
        <p className="mt-1 max-w-2xl text-[14px] text-slate-500">Review WIP quality, margin fade, underbillings, overbillings, and backlog concentration before handoff.</p>
        <div className="mt-5 h-px w-full bg-slate-200" />
      </div>

      <section className="grid gap-4 xl:grid-cols-[40%_60%]">
        <ContractorFileInputPanel
          state={state}
          onChange={setState}
          onRunReadiness={() => {}}
          onSkipToWorkspace={() => nav('opsQueue')}
          compact
          showPreview={false}
        />

        <div className="space-y-4">
          <SuretyMetricsPanel state={state} />

          <div className="grid gap-3 md:grid-cols-2">
            {wipCards.map(([title, status, chip, why, next]) => {
              const whyText = String(why).replace(/^Why flagged:\s*/i, '');
              const nextText = String(next).replace(/^Review next:\s*/i, '');
              return (
                <article key={title} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[13px] font-semibold text-slate-900">{title}</p>
                    <StatusChip
                      label={chip}
                      variant={
                        chip === 'Elevated' || chip === 'Needs review'
                          ? 'review'
                          : chip === 'Low' || chip === 'Strong'
                          ? 'ready'
                          : chip === 'Moderate'
                          ? 'info'
                          : 'neutral'
                      }
                    />
                  </div>
                  <dl className="mt-3 space-y-2 text-[13px] leading-snug">
                    <div className="grid grid-cols-[64px_1fr] gap-2">
                      <dt className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 pt-0.5">Signal</dt>
                      <dd className="text-slate-700">{whyText}</dd>
                    </div>
                    <div className="grid grid-cols-[64px_1fr] gap-2 border-t border-slate-100 pt-2">
                      <dt className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 pt-0.5">Next</dt>
                      <dd className="text-slate-600">{nextText}</dd>
                    </div>
                  </dl>
                </article>
              );
            })}
          </div>

          <ProfessionalDisclaimer>
            BondSBA highlights operational patterns that may require professional review. It does not replace underwriting judgment.
          </ProfessionalDisclaimer>
        </div>
      </section>
    </div>
  );
}

function ContractorProfilePage({ nav }) {
  const [activeTab, setActiveTab] = useState('overview');

  const tabItems = [
    ['overview', 'Overview'],
    ['submissions', 'Submissions'],
    ['wip', 'WIP History'],
    ['documents', 'Documents'],
    ['readiness', 'Readiness'],
    ['memos', 'Memos'],
    ['observations', 'Observations'],
  ];

  const submissions = [
    { id: 'SB-1042', status: 'In preparation', readiness: '74%', lender: 'Needs follow-up', surety: 'Needs WIP update', owner: 'Analyst', updated: '2026-05-16' },
    { id: 'SB-1051', status: 'Ready for review', readiness: '88%', lender: 'Ready for review', surety: 'Ready for review', owner: 'Producer', updated: '2026-05-14' },
  ];
  const wipRows = [
    { date: '2026-05-10', quality: 82, fade: 'Moderate', underbilling: 'Elevated', overbilling: 'Low', concentration: 'Needs review', notes: 'Two jobs driving most backlog.' },
    { date: '2026-04-15', quality: 79, fade: 'Moderate', underbilling: 'Moderate', overbilling: 'Low', concentration: 'Moderate', notes: 'Freshness guard triggered on one aging schedule.' },
  ];
  const documents = [
    { type: 'Interim financials', status: 'Stale', received: '2026-03-29', stale: 'Yes', notes: 'Update requested.' },
    { type: 'WIP schedule', status: 'Complete', received: '2026-05-10', stale: 'No', notes: 'Needs cost-to-complete annotation.' },
    { type: 'Tax returns', status: 'Complete', received: '2026-02-18', stale: 'No', notes: 'Current cycle covered.' },
  ];

  return (
    <div className="space-y-4">
      <ContractorProfileHeader
        name="Northline Civil LLC"
        tradeType="Civil infrastructure contractor"
        location="Texas, United States"
        readinessScore={78}
        wipQualityScore={82}
        riskLevel="Moderate"
        onPrimaryAction={() => nav('opsQueue')}
        onSecondaryAction={() => nav('wip')}
        onTertiaryAction={() => nav('handoffMemos')}
      />

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap gap-2">
          {tabItems.map(([id, label]) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`${activeTab === id ? T.btnPrimary : T.btnSecondary} text-sm py-2 px-3`}
            >
              {label}
            </button>
          ))}
        </div>

        {activeTab === 'overview' && (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <article className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Company Overview</p>
              <p className="mt-2 text-sm text-slate-700">
                Heavy civil contractor with municipal and utility backlog. Recurring readiness issue: stale interim financials during fast growth cycles.
              </p>
            </article>
            <article className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Recurring Missing Items</p>
              <ul className="mt-2 space-y-1 text-sm text-slate-700">
                <li>• Updated interim financials</li>
                <li>• Detailed cost-to-complete assumptions</li>
                <li>• Bond request scope updates</li>
              </ul>
            </article>
          </div>
        )}

        {activeTab === 'submissions' && (
          <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full min-w-[860px] border-collapse">
              <thead className="bg-slate-50">
                <tr className="border-b border-slate-200 text-[11px] uppercase tracking-[0.04em] text-slate-500">
                  <th className="px-3 py-2 text-left">Submission</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-right">Readiness</th>
                  <th className="px-3 py-2 text-left">Lender Handoff</th>
                  <th className="px-3 py-2 text-left">Surety Handoff</th>
                  <th className="px-3 py-2 text-left">Owner</th>
                  <th className="px-3 py-2 text-left">Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm text-slate-800">
                {submissions.map((row) => (
                  <tr key={row.id}>
                    <td className="px-3 py-2 font-semibold">{row.id}</td>
                    <td className="px-3 py-2">{row.status}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{row.readiness}</td>
                    <td className="px-3 py-2">{row.lender}</td>
                    <td className="px-3 py-2">{row.surety}</td>
                    <td className="px-3 py-2">{row.owner}</td>
                    <td className="px-3 py-2">{row.updated}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'wip' && (
          <div className="mt-4 grid gap-3">
            {wipRows.map((row) => (
              <article key={row.date} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-900">{row.date}</p>
                  <div className="flex flex-wrap gap-2">
                    <StatusChip label={`Quality ${row.quality}`} variant="info" />
                    <StatusChip label={`Margin fade ${row.fade}`} variant={row.fade === 'Moderate' ? 'review' : 'ready'} />
                    <StatusChip label={`Underbilling ${row.underbilling}`} variant={row.underbilling === 'Elevated' ? 'critical' : 'review'} />
                  </div>
                </div>
                <p className="mt-2 text-sm text-slate-700">
                  Overbilling exposure: {row.overbilling} · Backlog concentration: {row.concentration}
                </p>
                <p className="mt-1 text-sm text-slate-600">{row.notes}</p>
              </article>
            ))}
          </div>
        )}

        {activeTab === 'documents' && (
          <div className="mt-4 grid gap-2">
            {documents.map((doc) => (
              <div key={doc.type} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold">{doc.type}</p>
                  <StatusChip label={doc.status} variant={doc.status === 'Complete' ? 'ready' : 'review'} />
                </div>
                <p className="mt-1 text-xs text-slate-600">
                  Received: {doc.received} · Stale: {doc.stale} · {doc.notes}
                </p>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'readiness' && (
          <div className="mt-4">
            <WorkflowTaskList
              items={[
                { title: 'Update interim financials', owner: 'Controller', due: '2026-05-19', priority: 'high' },
                { title: 'Confirm guarantor details', owner: 'CPA', due: '2026-05-20', priority: 'medium' },
                { title: 'Finalize bond request scope', owner: 'Producer', due: '2026-05-21', priority: 'medium' },
              ]}
            />
          </div>
        )}

        {activeTab === 'memos' && (
          <div className="mt-4 grid gap-2">
            {['Lender handoff memo — 2026-05-14', 'Surety handoff memo — 2026-05-10'].map((memo) => (
              <div key={memo} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">{memo}</div>
            ))}
          </div>
        )}

        {activeTab === 'observations' && (
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm text-slate-700">
              Operational observation: this contractor performs well when billing cadence is tight, but readiness degrades when interim financial refreshes exceed 45 days. Prioritize freshness guard tasks in every cycle.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

function HandoffMemoGeneratorPage({ nav, entitlement }) {
  const [memoType, setMemoType] = useState('Lender handoff');
  const [contractor, setContractor] = useState('Northline Civil LLC');
  const [submission, setSubmission] = useState('SB-1042');
  const [status, setStatus] = useState('');
  const [request, setRequest] = useState('Working capital support for active civil backlog and surety continuity.');
  const [includeSections, setIncludeSections] = useState({
    wip: true,
    gaps: true,
    followUp: true,
    disclaimer: true,
  });
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);
  // Producer sign-off — gate Copy/Export until producer affirms they verified the data.
  // Resolves CPA professional-liability concern + contractor narrative-control concern.
  const [producerVerified, setProducerVerified] = useState(false);
  const [producerName, setProducerName] = useState('');
  const planActive = Boolean(entitlement?.active);
  const canSaveMemo = planActive && (entitlement?.features?.basic_handoff_memo ?? false);
  const watermarkLine = producerVerified && producerName
    ? `OPERATIONAL SIGNALS ONLY · NOT CPA-ATTESTED · DATA VERIFIED BY ${producerName.toUpperCase()} ON ${new Date().toISOString().slice(0, 10)}`
    : `OPERATIONAL SIGNALS ONLY · NOT CPA-ATTESTED · PRODUCER SIGN-OFF PENDING`;

  const analysis = evaluateFilePrepState({
    ...DEFAULT_FILE_PREP_STATE,
    contractorName: contractor,
    largestJobPercent: '42',
    wipStatus: 'received',
    financialsStatus: 'missing',
    marginFade: 'yes',
    underbillings: 'yes',
    costToComplete: 'partial',
    documents: {
      ...DEFAULT_FILE_PREP_STATE.documents,
      debtSchedule: true,
    },
  });

  const previewSections = [
    { title: 'Contractor overview', body: `${contractor} is in active pre-underwriting prep with ${analysis.readiness.label.toLowerCase()} file status.` },
    { title: 'Current request', body: request },
    includeSections.wip
      ? { title: 'WIP review findings', body: `${analysis.wipReview.label}. ${analysis.whyFlagged} Review next: ${analysis.reviewNext}` }
      : null,
    includeSections.gaps
      ? {
          title: 'Critical gaps',
          body: analysis.criticalGaps.length
            ? analysis.criticalGaps.slice(0, 4).map((gap) => `- ${gap.item}: ${gap.nextAction}`).join('\n')
            : 'No critical gaps identified in this draft.',
        }
      : null,
    includeSections.followUp
      ? { title: 'Follow-up questions', body: analysis.nextActions.slice(0, 3).map((action) => `- ${action}`).join('\n') }
      : null,
    { title: 'Lender/surety handoff notes', body: `Lender handoff: ${analysis.lenderHandoff}. Surety handoff: ${analysis.suretyHandoff}.` },
    includeSections.disclaimer ? { title: 'Professional review disclaimer', body: COMPLIANCE_DISCLAIMER } : null,
    { title: '— Verification —', body: watermarkLine },
  ].filter(Boolean);

  const requireSignOff = () => {
    if (!producerVerified || !producerName.trim()) {
      setStatus('Sign off below before copying or exporting.');
      window.setTimeout(() => setStatus(''), 2500);
      return false;
    }
    return true;
  };

  const copyMemo = async () => {
    if (!requireSignOff()) return;
    const text = previewSections.map((section) => `${section.title}\n${section.body}`).join('\n\n');
    await navigator.clipboard.writeText(text).catch(() => {});
    setStatus('Copied memo.');
    window.setTimeout(() => setStatus(''), 1500);
  };

  const saveDraft = () => {
    if (!canSaveMemo) {
      setShowUpgradePrompt(true);
      setStatus('');
      return;
    }
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(
        'bondsba-handoff-memo-draft',
        JSON.stringify({ memoType, contractor, submission, request, includeSections, ts: new Date().toISOString() })
      );
    }
    setStatus('Draft saved.');
    window.setTimeout(() => setStatus(''), 1500);
  };

  const exportMemo = () => {
    if (!requireSignOff()) return;
    if (!canSaveMemo) {
      setShowUpgradePrompt(true);
      setStatus('');
      return;
    }
    const payload = previewSections.map((section) => `${section.title}\n${section.body}`).join('\n\n');
    const blob = new Blob([payload], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${contractor.replace(/\s+/g, '-').toLowerCase()}-${memoType.replace(/\s+/g, '-').toLowerCase()}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setStatus('Exported memo.');
    window.setTimeout(() => setStatus(''), 1500);
  };

  const markHandoffReady = () => {
    if (!canSaveMemo) {
      setShowUpgradePrompt(true);
      setStatus('');
      return;
    }
    nav('opsQueue');
  };

  return (
    <div className="space-y-4">
      <div className="pb-5 mb-2">
        <div className="flex items-center gap-2 mb-3">
          <span aria-hidden className="inline-block h-2 w-2 rounded-full bg-slate-700" />
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Bond · Handoff</p>
        </div>
        <WorkflowSteps active="handoffMemos" nav={nav} />
        <h1 className="mt-3 text-[26px] font-semibold tracking-[-0.02em] text-slate-900 md:text-[30px]">Handoff Memo</h1>
        <p className="mt-1 max-w-2xl text-[14px] text-slate-500">Create concise lender or surety handoff notes from readiness and WIP review.</p>
        <div className="mt-5 h-px w-full bg-slate-200" />
      </div>

      <section className="grid gap-4 xl:grid-cols-[42%_58%]">
        <article className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          {showUpgradePrompt && (
            <UpgradePrompt
              title="Upgrade to continue"
              body="Your current plan does not include saved handoff memo workflow actions. You can still copy memo text for manual review."
              onViewPricing={() => nav('pricing')}
              onManualFallback={() => {
                setShowUpgradePrompt(false);
                setStatus('Manual fallback active. Copy memo remains available.');
              }}
            />
          )}
          <div className="grid gap-2 md:grid-cols-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-600">
              Contractor
              <input value={contractor} onChange={(event) => setContractor(event.target.value)} className="mt-1 h-10 w-full rounded-[10px] border border-slate-300 px-3 text-sm font-normal normal-case tracking-normal text-slate-900" />
            </label>
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-600">
              Submission
              <input value={submission} onChange={(event) => setSubmission(event.target.value)} className="mt-1 h-10 w-full rounded-[10px] border border-slate-300 px-3 text-sm font-normal normal-case tracking-normal text-slate-900" />
            </label>
          </div>

          <label className="text-xs font-semibold uppercase tracking-wide text-slate-600">
            Memo type
            <select value={memoType} onChange={(event) => setMemoType(event.target.value)} className="mt-1 h-10 w-full rounded-[10px] border border-slate-300 px-3 text-sm font-normal normal-case tracking-normal text-slate-900">
              <option>Lender handoff</option>
              <option>Surety handoff</option>
              <option>Internal review</option>
            </select>
          </label>

          <label className="text-xs font-semibold uppercase tracking-wide text-slate-600">
            Current request
            <textarea rows={4} value={request} onChange={(event) => setRequest(event.target.value)} className="mt-1 min-h-[92px] w-full rounded-[10px] border border-slate-300 px-3 py-2 text-sm font-normal normal-case tracking-normal text-slate-900" />
          </label>

          <article className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Sections</p>
            <div className="mt-2 grid gap-2">
              {[
                ['wip', 'Include WIP findings'],
                ['gaps', 'Include critical gaps'],
                ['followUp', 'Include follow-up questions'],
                ['disclaimer', 'Include professional disclaimer'],
              ].map(([key, label]) => (
                <label key={key} className="inline-flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                  <span>{label}</span>
                  <input type="checkbox" checked={includeSections[key]} onChange={(event) => setIncludeSections((current) => ({ ...current, [key]: event.target.checked }))} className="h-4 w-4 rounded border-slate-300" />
                </label>
              ))}
            </div>
          </article>

          {/* Producer sign-off — gates Copy / Export. Required by professional-liability council finding. */}
          <article className={`rounded-xl border p-4 ${producerVerified ? 'border-emerald-200 bg-emerald-50/40' : 'border-amber-200 bg-amber-50/40'}`}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-600">Producer verification</p>
            <p className="mt-1 text-[13px] text-slate-700">
              Confirm you reviewed the extracted figures, WIP signals, and contractor narrative. Memo carries an "operational signals only · not CPA-attested" watermark with your name and verification date.
            </p>
            <label className="mt-3 flex items-start gap-2">
              <input
                type="checkbox"
                checked={producerVerified}
                onChange={(e) => setProducerVerified(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-slate-300"
              />
              <span className="text-[13px] text-slate-700">
                I have reviewed the data in this memo and confirm it reflects my own assessment of the contractor file. Operational signals only — not a CPA attestation.
              </span>
            </label>
            <div className="mt-3">
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500">Your name</label>
              <input
                type="text"
                value={producerName}
                onChange={(e) => setProducerName(e.target.value)}
                placeholder="Producer name as it should appear on the memo"
                disabled={!producerVerified}
                className="mt-1 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 disabled:bg-slate-100 disabled:text-slate-400"
              />
            </div>
          </article>

          <div className="grid gap-2 sm:grid-cols-2">
            <button onClick={saveDraft} className="inline-flex h-10 items-center justify-center rounded-[10px] border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-900 hover:bg-slate-50">Save Draft</button>
            <button onClick={copyMemo} className="inline-flex h-10 items-center justify-center rounded-[10px] border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-900 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed" disabled={!producerVerified || !producerName.trim()}>Copy Memo</button>
            <button onClick={exportMemo} className="inline-flex h-10 items-center justify-center rounded-[10px] border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-900 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed" disabled={!producerVerified || !producerName.trim()}>Export</button>
            <button onClick={markHandoffReady} className="inline-flex h-10 items-center justify-center rounded-[10px] border border-[#0B1F3A] bg-[#0B1F3A] px-3 text-sm font-semibold text-white hover:bg-[#12365F]">Mark Handoff Ready</button>
          </div>
          {status && <p className="text-sm font-semibold text-slate-600">{status}</p>}
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <HandoffMemoPreview sections={previewSections} />
          <ProfessionalDisclaimer className="mt-3">{COMPLIANCE_DISCLAIMER}</ProfessionalDisclaimer>
        </article>
      </section>
    </div>
  );
}

function SubmissionOpsQueue({ nav, entitlement }) {
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('All');
  const [upgradePrompt, setUpgradePrompt] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [liveEntitlement, setLiveEntitlement] = useState(entitlement || null);
  const [inputState, setInputState] = useState({
    ...DEFAULT_FILE_PREP_STATE,
    contractorName: 'Northline Civil LLC',
    requestedAmount: '$750,000',
    largestJobPercent: '42',
    documents: {
      ...DEFAULT_FILE_PREP_STATE.documents,
      currentWipSchedule: true,
      interimFinancials: false,
      debtSchedule: true,
      ownershipInfo: false,
      bondRequestDetails: false,
    },
    marginFade: 'yes',
    underbillings: 'yes',
    overbillings: 'no',
    costToComplete: 'partial',
  });
  const computedRow = useFilePrepSummaryRow(inputState, 'SB-1042');
  const computedAnalysis = useMemo(() => evaluateFilePrepState(inputState), [inputState]);
  const activeEntitlement = liveEntitlement || entitlement || null;
  const hasActivePlan = Boolean(activeEntitlement?.active);
  const fileChecksLimit = activeEntitlement?.fileChecksLimit;
  const fileChecksUsed = activeEntitlement?.fileChecksUsed ?? 0;
  const fileCheckRemaining =
    fileChecksLimit == null ? Infinity : Math.max(0, fileChecksLimit - fileChecksUsed);
  const canCreateFileChecks = hasActivePlan && fileCheckRemaining > 0;
  const canGenerateMemo = hasActivePlan && (activeEntitlement?.features?.basic_handoff_memo ?? false);

  useEffect(() => {
    setLiveEntitlement(entitlement || null);
  }, [entitlement]);

  const consumeFileCheck = async (actionLabel = 'file check') => {
    if (!canCreateFileChecks) {
      setUpgradePrompt(
        hasActivePlan
          ? `Your current plan has reached file-check limits for ${actionLabel}.`
          : `An active plan is required for ${actionLabel}.`
      );
      return false;
    }
    try {
      setActionLoading(true);
      const payload = await fetchAPI('/api/ops/file-check', 'POST', {
        action: actionLabel,
        quantity: 1,
      });
      if (payload?.entitlement) {
        setLiveEntitlement(payload.entitlement);
      }
      return true;
    } catch (error) {
      setUpgradePrompt(error?.message || 'Could not record file check usage. Please try again.');
      return false;
    } finally {
      setActionLoading(false);
    }
  };

  const requireMemoAccess = () => {
    if (canGenerateMemo) return true;
    setUpgradePrompt('Your current plan does not include saved memo workflow access.');
    return false;
  };

  const sampleRows = [
    computedRow,
    {
      id: 'SB-1051',
      contractor: 'Apex Mechanical Contractors',
      filePurpose: 'Lender review',
      readiness: 91,
      wipStatus: 'Ready for review',
      criticalGaps: 0,
      handoff: 'Ready for review',
      nextAction: 'Generate memo',
      tradeType: 'Mechanical',
      requestedAmount: '$1,200,000',
    },
    {
      id: 'SB-1063',
      contractor: 'Stonebridge Utilities Inc.',
      filePurpose: 'Surety bonding',
      readiness: 54,
      wipStatus: 'Elevated review',
      criticalGaps: 6,
      handoff: 'Not ready',
      nextAction: 'Review gaps',
      tradeType: 'Utilities',
      requestedAmount: '$980,000',
    },
    {
      id: 'SB-1070',
      contractor: 'Harborview Concrete Group',
      filePurpose: 'Internal review',
      readiness: 73,
      wipStatus: 'Needs review',
      criticalGaps: 2,
      handoff: 'In preparation',
      nextAction: 'Request WIP',
      tradeType: 'Concrete',
      requestedAmount: '$640,000',
    },
  ];

  const [selectedId, setSelectedId] = useState(sampleRows[0].id);
  const filteredRows = useMemo(() => {
    return sampleRows.filter((row) => {
      const query = search.trim().toLowerCase();
      if (query && !`${row.contractor} ${row.id} ${row.nextAction}`.toLowerCase().includes(query)) return false;
      if (activeFilter === 'Needs follow-up') return row.readiness < 85;
      if (activeFilter === 'WIP review') return row.wipStatus !== 'Ready for review';
      if (activeFilter === 'Ready for memo') return row.handoff === 'Ready for review';
      if (activeFilter === 'Critical gaps') return row.criticalGaps > 0;
      return true;
    });
  }, [activeFilter, sampleRows, search]);

  const selectedRow = filteredRows.find((row) => row.id === selectedId) || filteredRows[0] || sampleRows[0];

  const metrics = useMemo(() => {
    const list = sampleRows;
    return {
      total: list.length,
      avgReadiness: Math.round(list.reduce((sum, row) => sum + row.readiness, 0) / list.length),
      wipReview: list.filter((row) => row.wipStatus !== 'Ready for review').length,
      critical: list.reduce((sum, row) => sum + row.criticalGaps, 0),
      readyMemo: list.filter((row) => row.handoff === 'Ready for review').length,
    };
  }, [sampleRows]);

  return (
    <div className="space-y-4">
      {upgradePrompt && (
        <UpgradePrompt
          title="Upgrade to continue"
          body={upgradePrompt}
          onViewPricing={() => nav('pricing')}
          onManualFallback={() => {
            setUpgradePrompt('');
            nav('readinessEngine');
          }}
        />
      )}
      <section className="pb-5 mb-2">
        <div className="flex items-center gap-2 mb-3">
          <span aria-hidden className="inline-block h-2 w-2 rounded-full bg-slate-900" />
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Bond · Workspace</p>
        </div>
        <WorkflowSteps active="opsQueue" nav={nav} />
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-[26px] font-semibold tracking-[-0.02em] text-slate-900 md:text-[30px]">File Prep Workspace</h1>
            <p className="mt-1 max-w-2xl text-[14px] text-slate-500">Track contractor files from intake to handoff.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={async () => {
                if (!(await consumeFileCheck('new file checks'))) return;
                nav('readinessEngine');
              }}
              disabled={actionLoading}
              className="inline-flex h-10 items-center rounded-[10px] border border-[#0B1F3A] bg-[#0B1F3A] px-3 text-sm font-semibold text-white hover:bg-[#12365F]"
            >
              New File Check
            </button>
            <button
              onClick={async () => {
                if (!(await consumeFileCheck('importing file checks'))) return;
                setInputState({ ...DEFAULT_FILE_PREP_STATE });
              }}
              disabled={actionLoading}
              className="inline-flex h-10 items-center rounded-[10px] border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-900 hover:bg-slate-50"
            >
              Import File
            </button>
          </div>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-5">
        <ScoreCard label="Active submissions" value={metrics.total} statusLabel="Live queue" statusVariant="info" />
        <ScoreCard label="Average readiness" value={`${metrics.avgReadiness}%`} statusLabel={metrics.avgReadiness >= 85 ? 'Ready for review' : 'Needs follow-up'} statusVariant={metrics.avgReadiness >= 85 ? 'ready' : 'review'} />
        <ScoreCard label="WIP reviews needed" value={metrics.wipReview} statusLabel={metrics.wipReview ? 'Needs review' : 'Clear'} statusVariant={metrics.wipReview ? 'review' : 'ready'} />
        <ScoreCard label="Critical missing items" value={metrics.critical} statusLabel={metrics.critical ? 'Critical gap' : 'Clear'} statusVariant={metrics.critical ? 'critical' : 'ready'} />
        <ScoreCard label="Handoffs ready" value={metrics.readyMemo} statusLabel={metrics.readyMemo ? 'Ready for review' : 'In prep'} statusVariant={metrics.readyMemo ? 'ready' : 'neutral'} />
      </div>

      <section className="grid gap-4 xl:grid-cols-[58%_42%]">
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-slate-900">Submission queue</p>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search contractors"
              className="h-10 w-full rounded-[10px] border border-slate-300 px-3 text-sm text-slate-900 md:w-56"
            />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {['All', 'Needs follow-up', 'WIP review', 'Ready for memo', 'Critical gaps'].map((filter) => (
              <button
                key={filter}
                onClick={() => setActiveFilter(filter)}
                className={`inline-flex h-9 items-center rounded-md border px-3 text-xs font-semibold uppercase tracking-wide ${
                  activeFilter === filter ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                {filter}
              </button>
            ))}
          </div>
          <div className="mt-3 overflow-hidden rounded-xl border border-slate-200">
            <table className="w-full border-collapse">
              <thead className="bg-slate-50">
                <tr className="border-b border-slate-200 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                  <th className="px-3 py-2.5 text-left">Contractor</th>
                  <th className="px-3 py-2.5 text-right">Readiness</th>
                  <th className="px-3 py-2.5 text-left">WIP Status</th>
                  <th className="px-3 py-2.5 text-right">Gaps</th>
                  <th className="px-3 py-2.5 text-left">Handoff</th>
                  <th className="px-3 py-2.5 text-left">Next Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-[13px] text-slate-700">
                {filteredRows.map((row) => (
                  <tr
                    key={row.id}
                    onClick={() => setSelectedId(row.id)}
                    className={`cursor-pointer ${selectedId === row.id ? 'bg-slate-100' : 'bg-white hover:bg-slate-50'}`}
                  >
                    <td className="px-3 py-2.5 font-semibold text-slate-900">{row.contractor}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-slate-900">{row.readiness}%</td>
                    <td className="px-3 py-2.5">
                      <StatusChip label={row.wipStatus} variant={row.wipStatus === 'Ready for review' ? 'ready' : row.wipStatus === 'Elevated review' ? 'critical' : 'review'} />
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{row.criticalGaps}</td>
                    <td className="px-3 py-2.5">{row.handoff}</td>
                    <td className="px-3 py-2.5 text-slate-500">{row.nextAction}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-slate-900">{selectedRow.contractor}</p>
            <StatusChip label={selectedRow.filePurpose} variant="info" />
          </div>
          <p className="mt-1 text-xs uppercase tracking-wide text-slate-500">{selectedRow.id}</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <ScoreCard label="File Readiness" value={`${selectedRow.readiness}%`} statusLabel={selectedRow.readiness >= 85 ? 'Ready for review' : 'Needs follow-up'} statusVariant={selectedRow.readiness >= 85 ? 'ready' : 'review'} />
            <ScoreCard label="WIP Review" value={selectedRow.wipStatus} statusLabel={selectedRow.wipStatus} statusVariant={selectedRow.wipStatus === 'Ready for review' ? 'ready' : selectedRow.wipStatus === 'Elevated review' ? 'critical' : 'review'} />
            <ScoreCard label="Critical Gaps" value={selectedRow.criticalGaps} statusLabel={selectedRow.criticalGaps > 0 ? 'Needs action' : 'Clear'} statusVariant={selectedRow.criticalGaps > 0 ? 'critical' : 'ready'} />
            <ScoreCard label="Memo Status" value={selectedRow.handoff} statusLabel={selectedRow.handoff} statusVariant={selectedRow.handoff === 'Ready for review' ? 'ready' : 'review'} />
          </div>

          {selectedRow.id === computedRow.id && (
            <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
              <p className="font-semibold text-slate-900">Selected file details</p>
              <p className="mt-1">WIP review: {computedAnalysis.whyFlagged}</p>
              <p className="mt-1">Next: {computedAnalysis.nextActions[0]}</p>
            </div>
          )}

          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <button onClick={() => nav('readinessEngine')} className="inline-flex h-10 items-center justify-center rounded-[10px] border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-900 hover:bg-slate-50">Run Readiness</button>
            <button onClick={() => nav('wip')} className="inline-flex h-10 items-center justify-center rounded-[10px] border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-900 hover:bg-slate-50">Review WIP</button>
            <button onClick={() => nav('checklist')} className="inline-flex h-10 items-center justify-center rounded-[10px] border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-900 hover:bg-slate-50">Request Items</button>
            <button
              onClick={() => nav('handoffMemos')}
              className="inline-flex h-10 items-center justify-center rounded-[10px] border border-[#0B1F3A] bg-[#0B1F3A] px-3 text-sm font-semibold text-white hover:bg-[#12365F]"
            >
              Generate Memo
            </button>
          </div>
        </article>
      </section>

      <ProfessionalDisclaimer>{COMPLIANCE_DISCLAIMER}</ProfessionalDisclaimer>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// PROGRAM COMPARISON
// ═══════════════════════════════════════════════════════════
function ProgramComparison() {
  const ROWS = [
    ['Maximum Loan Amount',        '$5,000,000',           '$5,500,000',                 '$500,000'                 ],
    ['Interest Rate Basis',        'Variable (Prime + 2.75%)', 'Fixed — CDC Portion',    'Variable (Prime + 4.50%)' ],
    ['Maximum Term — Real Estate', '25 years',             '20 years',                   'N/A'                      ],
    ['Maximum Term — Equipment',   '10 years',             'N/A',                        '10 years'                 ],
    ['Maximum Term — Working Cap', '10 years',             'N/A',                        '10 years'                 ],
    ['Required Equity Injection',  '10–20%',               '10–15%',                     'Lender discretion'        ],
    ['Owner-Occupied RE Required', 'No',                   'Yes — minimum 51%',          'No'                       ],
    ['SBA Guaranty',               'Up to 85%',            'CDC debenture — 40%',        'Up to 50%'                ],
    ['Typical Processing Time',    '30–90 days',           '45–90 days',                 '36–hour SBA response'     ],
    ['Primary Use Case',           'Acquisitions, RE, WC', 'Owner-occ. commercial RE',   'Quick working capital'    ],
  ];

  const MOBILE_PROGRAMS = [
    { label: 'SBA 7(a)', column: 1 },
    { label: 'SBA 504', column: 2 },
    { label: 'SBA Express', column: 3 },
  ];

  const FIT_CARDS = [
    {
      title: 'SBA 7(a)',
      bestFor: 'Flexible general-purpose requests',
      watchFor: 'Variable rate exposure and stronger underwriting package',
    },
    {
      title: 'SBA 504',
      bestFor: 'Owner-occupied real estate and fixed assets',
      watchFor: 'Structure complexity and longer multi-party execution',
    },
    {
      title: 'SBA Express',
      bestFor: 'Smaller requests requiring speed',
      watchFor: 'Lower guaranty and tighter lender risk appetite',
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between border-b border-slate-300 pb-3">
        <div>
          <h1 className={`${T.sectionHead} text-xl`}>SBA Program Comparison Matrix</h1>
          <p className="text-sm text-slate-600 mt-0.5">Side-by-side comparison of primary federal lending products — SBA 7(a), 504, and Express</p>
        </div>
      </div>

      <div className="grid gap-3 md:hidden">
        {MOBILE_PROGRAMS.map((program) => (
          <section key={program.label} className="border border-slate-300 bg-white">
            <h2 className="bg-[#0A2540] px-4 py-3 text-xs font-bold uppercase tracking-wide text-white">
              {program.label}
            </h2>
            <dl className="divide-y divide-slate-200">
              {ROWS.map((row, rowIndex) => (
                <div
                  key={`${program.label}-${row[0]}`}
                  className={`grid grid-cols-[1fr,1fr] gap-3 px-4 py-3 ${rowIndex % 2 === 1 ? 'bg-slate-50' : 'bg-white'}`}
                >
                  <dt className="text-[11px] font-bold uppercase tracking-wide text-slate-700">{row[0]}</dt>
                  <dd className="text-sm font-medium tabular-nums text-slate-900">{row[program.column]}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>

      <div className="hidden border border-slate-300 overflow-x-auto bg-white md:block">
        <table className="w-full border-collapse min-w-[700px]">
          <thead>
            <tr className="bg-[#0A2540]">
              <th className={T.th + ' w-56'}>Parameter</th>
              <th className={T.th}>SBA 7(a) — General Purpose</th>
              <th className={T.th}>SBA 504 — Real Estate</th>
              <th className={T.th}>SBA Express</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {ROWS.map((row, i) => (
              <tr key={i} className={`${i % 2 === 1 ? 'bg-slate-50' : 'bg-white'} hover:bg-slate-100 transition-colors duration-150`}>
                <td className="py-2.5 px-4 text-xs font-bold text-slate-800 uppercase tracking-wide border-r border-slate-200">
                  {row[0]}
                </td>
                {row.slice(1).map((cell, j) => (
                  <td key={j} className="py-2.5 px-4 text-sm tabular-nums text-slate-800 border-r border-slate-100 last:border-0">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section className="grid gap-3 md:grid-cols-3">
        {FIT_CARDS.map((card) => (
          <article key={card.title} className="rounded-xl border border-slate-300 bg-white p-4 shadow-sm">
            <p className="text-base font-bold text-slate-900">{card.title}</p>
            <p className="mt-2 text-sm text-slate-700"><span className="font-semibold text-slate-900">Best fit:</span> {card.bestFor}</p>
            <p className="mt-1 text-sm text-slate-700"><span className="font-semibold text-slate-900">Watch:</span> {card.watchFor}</p>
          </article>
        ))}
      </section>

      <section className="rounded-xl border border-slate-300 bg-white p-4 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">Next step</p>
          <p className="text-sm text-slate-600">Move from comparison into live modeling and readiness workflows.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href={PAGE_CONFIG.calculator.path} className={T.btnPrimary}>
            Open Calculator
          </a>
          <a href={PAGE_CONFIG.screener.path} className={T.btnSecondary}>
            Open Screener
          </a>
        </div>
      </section>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// SBA 7(a) GUARANTY FEE CALCULATOR
// ═══════════════════════════════════════════════════════════
function GuarantyFeeCalculator({ nav }) {
  const [loanAmount, setLoanAmount] = useState('');
  const [loanTerm, setLoanTerm] = useState('10');
  const [calculated, setCalculated] = useState(null);

  const handleAmountChange = (e) => {
    const raw = e.target.value.replace(/[^0-9]/g, '');
    setLoanAmount(raw ? Number(raw).toLocaleString('en-US') : '');
    setCalculated(null);
  };

  const calculate = () => {
    const amount = Number(String(loanAmount).replace(/[^0-9]/g, ''));
    if (!amount || amount <= 0) return;

    // Guarantee percentage
    const guarantyPct = amount <= 150000 ? 0.85 : 0.75;
    const guaranteedAmount = amount * guarantyPct;

    // Upfront guaranty fee (FY2026 schedule)
    let upfrontFee = 0;
    if (amount <= 150000) {
      upfrontFee = 0; // waived
    } else if (amount <= 700000) {
      upfrontFee = guaranteedAmount * 0.030;
    } else if (amount <= 1000000) {
      upfrontFee = guaranteedAmount * 0.035;
    } else {
      const guaranteedAt1M = 1000000 * 0.75;
      upfrontFee = guaranteedAt1M * 0.035 + (guaranteedAmount - guaranteedAt1M) * 0.0375;
    }

    // Annual service fee: 0.55% of outstanding guaranteed balance (first-year estimate)
    const annualServiceFee = guaranteedAmount * 0.0055;

    setCalculated({
      amount,
      guarantyPct,
      guaranteedAmount,
      upfrontFee,
      annualServiceFee,
      totalCostYear1: upfrontFee + annualServiceFee,
      loanTerm,
    });
  };

  const fmt = (n) =>
    n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 md:py-12">
      {/* Hero header */}
      <div className="rounded-2xl bg-gradient-to-br from-[#0B1F3A] to-[#12365F] px-6 py-8 mb-8 shadow-[0_12px_40px_rgba(11,31,58,0.22)]">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1">
          <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-blue-200">ClearPath · SBA Tools</span>
        </div>
        <h1 className="text-[28px] font-bold leading-tight tracking-[-0.02em] text-white md:text-[36px]">
          SBA 7(a) Guaranty Fee Calculator FY2026
        </h1>
        <p className="mt-2 text-[15px] leading-relaxed text-blue-100/80 max-w-[44ch]">
          Instantly calculate the SBA guaranty fee and annual service fee for any 7(a) loan amount. Updated for the FY2026 fee schedule.
        </p>
      </div>

      {/* Input card */}
      <div className="rounded-xl border border-[#0B1F3A]/10 bg-white p-6 shadow-sm mb-6">
        <h2 className="text-[16px] font-bold text-[#0B1F3A] mb-5">Enter Loan Details</h2>
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label className="block text-[12px] font-semibold text-slate-700 uppercase tracking-wide mb-1.5">
              Loan Amount
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-semibold">$</span>
              <input
                type="text"
                inputMode="numeric"
                value={loanAmount}
                onChange={handleAmountChange}
                placeholder="500,000"
                className="w-full rounded-lg border border-slate-300 pl-7 pr-4 py-2.5 text-base text-slate-900 tabular-nums focus:outline-none focus:ring-2 focus:ring-[#1B3A6B]/20 focus:border-[#1B3A6B] transition-colors"
              />
            </div>
          </div>
          <div>
            <label className="block text-[12px] font-semibold text-slate-700 uppercase tracking-wide mb-1.5">
              Loan Term
            </label>
            <select
              value={loanTerm}
              onChange={(e) => { setLoanTerm(e.target.value); setCalculated(null); }}
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#1B3A6B]/20 focus:border-[#1B3A6B] transition-colors bg-white"
            >
              <option value="10">10 years (equipment / working capital)</option>
              <option value="25">25 years (real estate)</option>
            </select>
          </div>
        </div>
        <button
          onClick={calculate}
          className="mt-5 inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[#0B1F3A] px-6 text-[14px] font-bold text-white shadow-[0_6px_18px_rgba(11,31,58,0.22)] transition-colors hover:bg-[#12365F]"
        >
          <Calculator className="h-4 w-4" />
          Calculate Guaranty Fee
        </button>
      </div>

      {/* Results */}
      {calculated && (
        <div className="rounded-xl border border-[#0B1F3A]/15 bg-white shadow-sm overflow-hidden mb-6">
          <div className="bg-[#0B1F3A] px-6 py-4">
            <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-blue-200">Fee Breakdown — {fmt(calculated.amount)} Loan</p>
          </div>
          <div className="divide-y divide-slate-100">
            {[
              ['Loan Amount', fmt(calculated.amount), null],
              [`SBA Guaranty Percentage`, `${Math.round(calculated.guarantyPct * 100)}%`, calculated.amount <= 150000 ? 'Loans ≤ $150K' : 'Loans > $150K'],
              ['Guaranteed Amount', fmt(calculated.guaranteedAmount), null],
              ['Upfront Guaranty Fee', fmt(calculated.upfrontFee), calculated.upfrontFee === 0 ? 'Waived — loans ≤ $150K' : null],
              ['Annual SBA Service Fee (0.55%)', `${fmt(calculated.annualServiceFee)}/yr`, null],
              ['Total Cost of Guaranty (Year 1)', fmt(calculated.totalCostYear1), 'upfront fee + first-year service fee'],
            ].map(([label, value, note], i) => (
              <div key={i} className={`flex items-center justify-between gap-4 px-6 py-3.5 ${i === 5 ? 'bg-slate-50' : ''}`}>
                <div>
                  <p className={`text-[13px] ${i === 5 ? 'font-bold text-slate-900' : 'font-medium text-slate-700'}`}>{label}</p>
                  {note && <p className="text-[11px] text-slate-400 mt-0.5">{note}</p>}
                </div>
                <p className={`text-[14px] tabular-nums font-bold shrink-0 ${i === 5 ? 'text-[#0B1F3A]' : 'text-slate-900'}`}>{value}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Fee schedule reference */}
      <div className="rounded-xl border border-[#0B1F3A]/10 bg-white p-6 mb-6">
        <h2 className="text-[14px] font-bold text-[#0B1F3A] mb-4">FY2026 SBA 7(a) Guaranty Fee Schedule</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="bg-[#0B1F3A]">
                <th className="py-2.5 px-4 text-left text-[11px] font-semibold text-white uppercase tracking-wide">Loan Amount</th>
                <th className="py-2.5 px-4 text-left text-[11px] font-semibold text-white uppercase tracking-wide">Guaranty %</th>
                <th className="py-2.5 px-4 text-left text-[11px] font-semibold text-white uppercase tracking-wide">Fee Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {[
                ['≤ $150,000', '85%', '0% — Waived'],
                ['$150,001 – $700,000', '75%', '3.0% of guaranteed portion'],
                ['$700,001 – $1,000,000', '75%', '3.5% of guaranteed portion'],
                ['$1,000,001 – $5,000,000', '75%', '3.5% up to $1M + 3.75% above'],
              ].map(([range, gPct, fee], i) => (
                <tr key={i} className={i % 2 === 1 ? 'bg-slate-50/60' : ''}>
                  <td className="py-3 px-4 text-slate-800">{range}</td>
                  <td className="py-3 px-4 text-slate-700">{gPct}</td>
                  <td className="py-3 px-4 font-semibold text-[#0B1F3A]">{fee}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-[11px] text-slate-400">Annual service fee: 0.55% of outstanding guaranteed balance. Rates subject to SBA annual revision.</p>
      </div>

      {/* CTA row */}
      <div className="flex flex-wrap gap-3">
        <button onClick={() => nav('screener')} className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#0B1F3A] px-5 text-[13px] font-bold text-white hover:bg-[#12365F] transition-colors">
          <CheckSquare className="h-4 w-4" />
          Run Eligibility Screener
        </button>
        <button onClick={() => nav('calculatorLanding')} className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#0B1F3A]/20 bg-white px-5 text-[13px] font-semibold text-[#0B1F3A] hover:bg-slate-50 transition-colors">
          Full Payment Calculator
        </button>
        <button onClick={() => nav('sbaHome')} className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-5 text-[13px] font-semibold text-slate-700 hover:bg-slate-50 transition-colors">
          Back to SBA Home
        </button>
      </div>

      {/* Disclaimer */}
      <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400 mb-1">Disclaimer</p>
        <p className="text-[11px] leading-relaxed text-slate-500">Fee calculations are estimates based on the FY2026 SBA 7(a) fee schedule. Actual fees are determined by your lender and the SBA at time of approval. Annual service fee accrues on the outstanding guaranteed balance, which declines over the loan term. Consult your SBA lender for exact figures.</p>
      </div>
    </div>
  );
}
