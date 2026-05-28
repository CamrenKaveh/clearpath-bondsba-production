/**
 * api/v1/[[...route]].js
 *
 * Single catch-all handler for all /api/v1/* routes.
 * Keeps the Vercel Hobby deployment under the 12-function cap.
 *
 * Routes handled:
 *   POST /api/v1/auth/verify-turnstile
 *   POST /api/v1/auth/callback
 *   POST /api/v1/surety/analyze
 *   POST /api/v1/surety/process
 *   GET|POST /api/v1/surety/applications
 *   POST /api/v1/surety/upload
 *   POST /api/v1/surety/spreading
 *   POST /api/v1/sba-loans/calculate-amortization
 *   POST /api/v1/sba-loans/generate-term-sheet
 *   POST /api/v1/sba-loans/upload
 *   POST /api/v1/ops/weekly-brief
 */

import { verifyAndAttachUser } from '../lib/middleware/auth.js';
import { requirePermission, enforceDomainIsolation, enforceRateLimit } from '../lib/middleware/rbac.js';
import { validateRequestBody, FINANCIAL_SCHEMA } from '../lib/middleware/sanitization.js';
import { validateHttpMethod, validateRequiredFields, formatErrorResponse, formatSuccessResponse } from '../lib/middleware/validation.js';
import { asyncHandler } from '../lib/middleware/exceptions.js';
import { calculateLoanAnalysis, calculateSBA504Project } from '../src/domains/sba-loans/services/loanCalculator.js';
import { generateTermSheet } from '../src/domains/sba-loans/services/termSheetGenerator.js';
import { SpreadingEngine } from '../src/domains/surety/services/spreadingEngine.js';
import { WIPAnalyzer } from '../src/domains/surety/services/wipAnalyzer.js';
import { buildReadinessReport, buildUnderwritingSummary } from '../src/domains/surety/services/readinessReport.js';
import {
  handleSuretyApplications,
  handleSuretyProcess,
  handleSuretySpreading,
  handleSuretyUpload,
} from '../lib/api/suretyRoutes.js';
import { handleSbaUpload } from '../lib/api/sbaRoutes.js';
import { handleAuthCallback } from '../lib/api/authRoutes.js';
import { handleWeeklyBrief } from '../lib/api/opsRoutes.js';
import { randomUUID } from 'crypto';
import Anthropic from '@anthropic-ai/sdk';

const TURNSTILE_TEST_SECRET_KEYS = new Set([
  '1x0000000000000000000000000000000AA',
  '2x0000000000000000000000000000000AA',
  '3x0000000000000000000000000000000AA',
]);

// ─── Router ───────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  const segments = Array.isArray(req.query.route) ? req.query.route : (req.query.route ? [req.query.route] : []);
  const route = segments.join('/');

  switch (route) {
    case 'auth/verify-turnstile':
      return handleVerifyTurnstile(req, res);
    case 'auth/callback':
      return handleAuthCallback(req, res);
    case 'surety/analyze':
      return handleSuretyAnalyze(req, res);
    case 'surety/process':
      return handleSuretyProcess(req, res);
    case 'surety/applications':
      return handleSuretyApplications(req, res);
    case 'surety/upload':
      return handleSuretyUpload(req, res);
    case 'surety/spreading':
      return handleSuretySpreading(req, res);
    case 'sba-loans/calculate-amortization':
      return handleCalculateAmortization(req, res);
    case 'sba-loans/generate-term-sheet':
      return handleGenerateTermSheet(req, res);
    case 'sba-loans/upload':
      return handleSbaUpload(req, res);
    case 'ops/weekly-brief':
      return handleWeeklyBrief(req, res);
    default:
      return res.status(404).json({ error: `Route /api/v1/${route} not found` });
  }
}

// ─── POST /api/v1/auth/verify-turnstile ───────────────────────────────────────

async function handleVerifyTurnstile(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { token } = req.body || {};
  if (!token) return res.status(400).json({ error: 'Cloudflare verification token is required' });

  if (token === 'dev-turnstile-token' && process.env.NODE_ENV !== 'production') {
    return res.status(200).json({ success: true, mode: 'development' });
  }

  const secretKey = process.env.TURNSTILE_SECRET_KEY;
  if (!secretKey) return res.status(500).json({ error: 'Cloudflare verification is not configured' });

  if (process.env.NODE_ENV === 'production' && TURNSTILE_TEST_SECRET_KEYS.has(secretKey)) {
    return res.status(500).json({ error: 'Cloudflare production secret is not configured' });
  }

  try {
    const cfRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret: secretKey, response: token }),
    });
    if (!cfRes.ok) throw new Error(`Cloudflare Turnstile API error: ${cfRes.status}`);
    const data = await cfRes.json();
    if (!data.success) return res.status(400).json({ error: 'Cloudflare verification failed', details: data['error-codes'] || [] });
    return res.status(200).json({ success: true, challengeTs: data.challenge_ts, hostname: data.hostname });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to verify Cloudflare challenge', message: err.message });
  }
}

// ─── POST /api/v1/surety/analyze ─────────────────────────────────────────────

const handleSuretyAnalyze = asyncHandler(async (req, res) => {
  const authError = await verifyAndAttachUser(req);
  if (authError) return res.status(authError.statusCode).json(JSON.parse(authError.body));

  const permError = requirePermission(req, 'analysis', 'execute', 'surety');
  if (permError) return res.status(permError.statusCode).json(JSON.parse(permError.body));

  const domainError = enforceDomainIsolation(req, 'surety');
  if (domainError) return res.status(domainError.statusCode).json(JSON.parse(domainError.body));

  const rateLimitError = enforceRateLimit(req, 20, 60 * 1000);
  if (rateLimitError) return res.status(rateLimitError.statusCode).json(JSON.parse(rateLimitError.body));

  const valError = validateRequestBody(req, FINANCIAL_SCHEMA);
  if (valError) return res.status(valError.statusCode).json(JSON.parse(valError.body));

  const { financials, wipDetails = {}, documentMetadata = {}, analysisType = 'full', spreadingOptions = {} } = req.body || {};

  for (const field of ['revenue', 'grossProfit', 'expenses', 'netIncome', 'equity', 'assets', 'businessAge']) {
    if (financials[field] !== undefined && typeof financials[field] !== 'number') {
      return res.status(400).json({ error: `Field "${field}" must be a number, got ${typeof financials[field]}` });
    }
  }
  if (financials.liabilities && typeof financials.liabilities.total !== 'number') {
    return res.status(400).json({ error: 'Field "liabilities.total" must be a number' });
  }

  const analysisId = `analysis_${randomUUID()}`;
  const timestamp = new Date().toISOString();
  const normalizedData = {
    financials: {
      revenue: financials.revenue || 0,
      grossProfit: financials.grossProfit || 0,
      expenses: financials.expenses || 0,
      netIncome: financials.netIncome || 0,
      liabilities: financials.liabilities || { total: 0 },
      equity: financials.equity || 0,
      assets: financials.assets || 0,
      businessAge: financials.businessAge || 1,
      industryType: financials.industryType || 'General',
    },
    documentMetadata: documentMetadata || { type: 'financial-statement', uploadedAt: timestamp },
  };

  let spreadingAnalysis = null;
  if (['spreading', 'full'].includes(analysisType)) {
    const engine = new SpreadingEngine();
    spreadingAnalysis = await engine.generateSpread(normalizedData, { underwriter: spreadingOptions.underwriter || 'System' });
  }

  let wipAnalysis = null;
  if (['wip', 'full'].includes(analysisType)) {
    const wip = new WIPAnalyzer();
    wipAnalysis = await wip.analyzeWIP(normalizedData, wipDetails);
  }

  const underwritingSummary = buildUnderwritingSummary({ spreadingAnalysis, wipAnalysis, financials: normalizedData.financials });
  const readinessReport = buildReadinessReport({
    documentName: documentMetadata.fileName || 'Uploaded financial package',
    documentType: documentMetadata.type || 'financial-statement',
    parsed: { normalized: normalizedData, metadata: documentMetadata },
    spreadingAnalysis, wipAnalysis, underwritingSummary,
  });

  return res.status(200).json({
    success: true,
    data: {
      analysisId, timestamp, spreadingAnalysis, wipAnalysis, underwritingSummary, readinessReport,
      metadata: {
        underwriter: spreadingOptions.underwriter || 'System',
        analysisCompletedAt: new Date().toISOString(),
        businessAge: normalizedData.financials.businessAge,
        industryType: normalizedData.financials.industryType,
      },
    },
  });
});

// ─── POST /api/v1/sba-loans/calculate-amortization ───────────────────────────

async function handleCalculateAmortization(req, res) {
  const authError = await verifyAndAttachUser(req);
  if (authError) return res.status(authError.statusCode).json(JSON.parse(authError.body));

  const methodError = validateHttpMethod(req, ['POST']);
  if (methodError) return res.status(methodError.statusCode || 405).json(JSON.parse(methodError.body || '{"error":"Method not allowed"}'));

  try {
    const { requestedAmount, principal = requestedAmount, annualRate, termMonths, loanTermYears = Math.round((termMonths || 0) / 12), program = 'Working Capital', netOperatingIncome = 0, totalProjectCost, borrowerNAICS, fy2026MfrWaiver = false } = req.body || {};

    const fieldError = validateRequiredFields({ principal, annualRate, loanTermYears }, ['principal', 'annualRate', 'loanTermYears']);
    if (fieldError) return res.status(400).json(JSON.parse(formatErrorResponse(fieldError).body));

    if (principal <= 0 || annualRate <= 0 || loanTermYears <= 0) {
      return res.status(400).json({ error: 'Invalid parameters: principal, rate, and term must be positive' });
    }

    const analysis = calculateLoanAnalysis({
      requestedAmount: principal, annualRate, loanTermYears, netOperatingIncome,
      totalProjectCost: totalProjectCost || principal,
      borrowerNAICS: fy2026MfrWaiver ? 311 : borrowerNAICS,
      program: String(program).toLowerCase().includes('express') ? 'express' : 'standard',
    });
    const sba504Project = String(program).toLowerCase().includes('504')
      ? calculateSBA504Project({
          projectCost: totalProjectCost || principal,
          cdcRate: annualRate,
          cdcTermYears: loanTermYears,
          borrowerNAICS: fy2026MfrWaiver ? 311 : borrowerNAICS,
        })
      : null;

    const { statusCode, body } = formatSuccessResponse({
      monthlyPayment: analysis.monthlyPayment.amount,
      annualPayment: analysis.annualDebtService,
      totalPayment: analysis.monthlyPayment.amount * loanTermYears * 12,
      totalInterest: analysis.totalInterest,
      netProceeds: analysis.fees.netProceeds,
      fees: {
        originationFee: analysis.fees.originationFee,
        originationFeePercent: analysis.fees.originationFeePercent,
        guarantyFee: analysis.fees.guarantyFee,
        guarantyFeePercent: analysis.fees.guarantyFeePercent,
        totalFees: analysis.fees.totalFees,
        waiverApplied: analysis.fees.isManufacturerWaiverApplied,
      },
      program, termYears: loanTermYears, annualRate,
      dscr: analysis.dscr, affordability: analysis.affordability,
      equityAnalysis: analysis.equityAnalysis,
      sba504Project,
      schedule: analysis.amortizationSchedule,
    });
    return res.status(statusCode).json(JSON.parse(body));
  } catch (err) {
    return res.status(500).json({ error: 'Failed to calculate amortization', details: err.message });
  }
}

// ─── POST /api/v1/sba-loans/generate-term-sheet ──────────────────────────────

async function handleGenerateTermSheet(req, res) {
  const authError = await verifyAndAttachUser(req);
  if (authError) return res.status(authError.statusCode).json(JSON.parse(authError.body));

  const rateLimitError = enforceRateLimit(req, 5, 60 * 1000);
  if (rateLimitError) return res.status(rateLimitError.statusCode).json(JSON.parse(rateLimitError.body));

  try {
    const { loanParams, borrowerInfo, parsedFinancials, lenderInfo } = req.body || {};

    const fieldError = validateRequiredFields({ loanParams, borrowerInfo }, ['loanParams', 'borrowerInfo']);
    if (fieldError) return res.status(400).json(JSON.parse(formatErrorResponse(fieldError).body));

    const result = await generateTermSheet({ loanParams, borrowerInfo, parsedFinancials, lenderInfo });
    const { statusCode, body } = formatSuccessResponse(result);
    return res.status(statusCode).json(JSON.parse(body));
  } catch (err) {
    return res.status(500).json({ error: 'Failed to generate term sheet', details: err.message });
  }
}
