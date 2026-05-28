/**
 * Surety Process Endpoint
 *
 * POST /api/v1/surety/process
 *
 * Combined endpoint: parses a financial document and runs surety underwriting
 * analysis in a single request. Designed for the SuretyApplicationForm demo flow.
 *
 * Request body:
 * {
 *   document: { name: string, content: string, type: string },
 *   documentType?: 'balance-sheet' | 'income-statement' | 'tax-return' | 'cash-flow' | 'unknown',
 *   analysisType?: 'spreading' | 'wip' | 'full',
 *   wipDetails?: { contracts: [...] },
 *   spreadingOptions?: { underwriter: string }
 * }
 *
 * Response:
 * {
 *   success: true,
 *   data: {
 *     documentId: string,
 *     documentName: string,
 *     documentType: string,
 *     analysisId: string,
 *     timestamp: string,
 *     parsed: { raw, normalized, metadata },
 *     spreadingAnalysis: { ... } | null,
 *     wipAnalysis: { ... } | null,
 *     underwritingSummary: { overallRiskLevel, keyMetrics, recommendations, warnings }
 *   }
 * }
 */

import { getParserInstance } from '../../../src/core/parser-instance.js';
import { verifyAndAttachUser } from '../../../lib/middleware/auth.js';
import { enforceRateLimit } from '../../../lib/middleware/rbac.js';
import { SpreadingEngine } from '../../../src/domains/surety/services/spreadingEngine.js';
import { createApplication, initializeSuretyDB } from '../../../src/domains/surety/db/suretyDatabase.js';
import { WIPAnalyzer } from '../../../src/domains/surety/services/wipAnalyzer.js';
import { buildReadinessReport, buildUnderwritingSummary } from '../../../src/domains/surety/services/readinessReport.js';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import { getServerSupabaseServiceRoleKey, getServerSupabaseUrl } from '../../../lib/supabase/config.js';

let serviceRoleClient = null;
let suretyDbInitialized = false;

function getServiceRoleClient() {
  if (serviceRoleClient) return serviceRoleClient;

  const supabaseUrl = getServerSupabaseUrl();
  const serviceRoleKey = getServerSupabaseServiceRoleKey();
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Supabase service role config missing on server');
  }

  serviceRoleClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
  return serviceRoleClient;
}

function ensureSuretyDB() {
  if (suretyDbInitialized) return;
  initializeSuretyDB(getServiceRoleClient());
  suretyDbInitialized = true;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let persistenceAvailable = true;

  try {
    try {
      ensureSuretyDB();
    } catch (error) {
      persistenceAvailable = false;
      console.warn('Surety DB persistence unavailable, running analysis-only mode:', error.message);
    }

    const authError = await verifyAndAttachUser(req);
    if (authError) {
      const { statusCode, body } = authError;
      return res.status(statusCode).json(JSON.parse(body));
    }

    const rateLimitError = enforceRateLimit(req, 15, 60 * 1000);
    if (rateLimitError) {
      const { statusCode, body } = rateLimitError;
      return res.status(statusCode).json(JSON.parse(body));
    }

    const {
      document,
      documentType = 'balance-sheet',
      analysisType = 'full',
      wipDetails = {},
      spreadingOptions = {},
    } = req.body || {};

    // Validate required fields
    if (!document) {
      return res.status(400).json({ error: 'Missing required field: document' });
    }
    if (!document.name || !document.content) {
      return res.status(400).json({ error: 'Document must have name and content properties' });
    }

    const documentId = `doc_${randomUUID()}`;
    const analysisId = `analysis_${randomUUID()}`;
    const timestamp = new Date().toISOString();

    // ── Step 1: Parse Document ──
    const parser = getParserInstance();
    let parseResult;
    try {
      parseResult = await parser.parse(
        { name: document.name, content: document.content, type: document.type || 'text/plain' },
        { documentType, extractTables: true, extractText: true }
      );
    } catch (err) {
      return res.status(422).json({ error: `Document parsing failed: ${err.message}` });
    }

    if (parseResult.errors && parseResult.errors.length > 0) {
      return res.status(422).json({
        error: `Document parsing failed with ${parseResult.errors.length} error(s)`,
        details: parseResult.errors,
      });
    }

    // ── Step 2: Build normalized financial data ──
    // Pull financials from parse result, falling back to zeros for demo resilience
    const raw = parseResult.normalized?.financials || parseResult.raw || {};
    const financials = {
      revenue: raw.revenue || 0,
      grossProfit: raw.grossProfit || 0,
      expenses: raw.expenses || 0,
      netIncome: raw.netIncome || 0,
      liabilities: raw.liabilities || { total: 0 },
      equity: raw.equity || 0,
      assets: raw.assets || 0,
      businessAge: raw.businessAge || 1,
      industryType: raw.industryType || 'General',
    };

    const normalizedData = {
      financials,
      documentMetadata: {
        type: documentType,
        fileName: document.name,
        uploadedAt: timestamp,
      },
    };

    // ── Step 3: Run Spreading Engine ──
    let spreadingAnalysis = null;
    if (['spreading', 'full'].includes(analysisType)) {
      try {
        const spreadingEngine = new SpreadingEngine();
        spreadingAnalysis = await spreadingEngine.generateSpread(normalizedData, {
          underwriter: spreadingOptions.underwriter || 'System',
        });
      } catch (err) {
        console.error('Spreading engine error:', err);
        spreadingAnalysis = { error: err.message };
      }
    }

    // ── Step 4: Run WIP Analyzer ──
    let wipAnalysis = null;
    if (['wip', 'full'].includes(analysisType)) {
      try {
        const wipAnalyzer = new WIPAnalyzer();
        wipAnalysis = await wipAnalyzer.analyzeWIP(normalizedData, wipDetails);
      } catch (err) {
        console.error('WIP analyzer error:', err);
        wipAnalysis = { error: err.message };
      }
    }

    // ── Step 5: Generate Underwriting Summary ──
    const underwritingSummary = buildUnderwritingSummary({ spreadingAnalysis, wipAnalysis, financials });
    const readinessReport = buildReadinessReport({
      documentName: document.name,
      documentType,
      parsed: {
        raw: parseResult.raw,
        normalized: parseResult.normalized,
        metadata: parseResult.metadata,
      },
      spreadingAnalysis,
      wipAnalysis,
      underwritingSummary,
    });

    const responseData = {
      documentId,
      documentName: document.name,
      documentType,
      analysisId,
      timestamp,
      parsed: {
        raw: parseResult.raw,
        normalized: parseResult.normalized,
        metadata: parseResult.metadata,
      },
      spreadingAnalysis,
      wipAnalysis,
      underwritingSummary,
      readinessReport,
      metadata: {
        analysisType,
        underwriter: spreadingOptions.underwriter || 'System',
        parseQuality: parseResult.metadata?.qualityMetrics || null,
      },
    };

    if (persistenceAvailable) {
      const created = await createApplication({
        userId: req.user.userId,
        documentId,
        documentName: document.name,
        documentType,
        applicantName: document.name.replace(/\.[^.]+$/, ''),
        businessType: 'Contractor Submission',
        industry: normalizedData.financials.industryType || 'General',
        analysis: responseData,
      });
      responseData.applicationId = created.applicationId;
      responseData.persistenceMode = 'stored';
    } else {
      responseData.applicationId = null;
      responseData.persistenceMode = 'analysis-only';
      responseData.persistenceNotice = 'Saved packet persistence is unavailable in this environment.';
    }

    return res.status(200).json({
      success: true,
      data: responseData,
    });
  } catch (error) {
    console.error('Process endpoint error:', error);
    return res.status(500).json({ error: `Processing failed: ${error.message}` });
  }
}
