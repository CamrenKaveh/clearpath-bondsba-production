import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import { getParserInstance } from '../../src/core/parser-instance.js';
import { verifyAndAttachUser } from '../middleware/auth.js';
import { enforceRateLimit } from '../middleware/rbac.js';
import { validateHttpMethod, validateRequiredFields, formatErrorResponse } from '../middleware/validation.js';
import { getServerSupabaseServiceRoleKey, getServerSupabaseUrl } from '../supabase/config.js';
import { SpreadingEngine } from '../../src/domains/surety/services/spreadingEngine.js';
import { WIPAnalyzer } from '../../src/domains/surety/services/wipAnalyzer.js';
import { buildReadinessReport, buildUnderwritingSummary } from '../../src/domains/surety/services/readinessReport.js';
import {
  createApplication,
  getApplication,
  initializeSuretyDB,
  listApplications,
} from '../../src/domains/surety/db/suretyDatabase.js';

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

async function requireUser(req, res) {
  const authError = await verifyAndAttachUser(req);
  if (!authError) return true;
  res.status(authError.statusCode).json(JSON.parse(authError.body));
  return false;
}

function parseDocumentType(documentType) {
  return documentType || 'unknown';
}

function buildFinancials(raw = {}) {
  return {
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
}

async function runSuretyAnalysis({ normalizedData, wipDetails = {}, analysisType = 'full', spreadingOptions = {} }) {
  let spreadingAnalysis = null;
  if (['spreading', 'full'].includes(analysisType)) {
    const spreadingEngine = new SpreadingEngine();
    spreadingAnalysis = await spreadingEngine.generateSpread(normalizedData, {
      underwriter: spreadingOptions.underwriter || 'System',
    });
  }

  let wipAnalysis = null;
  if (['wip', 'full'].includes(analysisType)) {
    const wipAnalyzer = new WIPAnalyzer();
    wipAnalysis = await wipAnalyzer.analyzeWIP(normalizedData, wipDetails);
  }

  return {
    spreadingAnalysis,
    wipAnalysis,
    underwritingSummary: buildUnderwritingSummary({
      spreadingAnalysis,
      wipAnalysis,
      financials: normalizedData.financials,
    }),
  };
}

export async function handleSuretyUpload(req, res) {
  if (!(await requireUser(req, res))) return;

  const methodError = validateHttpMethod(req, ['POST']);
  if (methodError) {
    const { statusCode, body } = formatErrorResponse(methodError);
    return res.status(statusCode).json(typeof body === 'string' ? JSON.parse(body) : body);
  }

  try {
    const { document, documentType = 'unknown', extractTables = true, extractText = true } = req.body || {};
    const fieldError = validateRequiredFields({ document }, ['document']);
    if (fieldError) {
      const { statusCode, body } = formatErrorResponse(fieldError);
      return res.status(statusCode).json(typeof body === 'string' ? JSON.parse(body) : body);
    }

    if (!document.name || !document.content) {
      return res.status(400).json({ error: 'Document must have name and content properties' });
    }
    if (typeof document.name !== 'string' || !document.name.trim()) {
      return res.status(400).json({ error: 'Document name must be a non-empty string' });
    }

    const parseResult = await getParserInstance().parse(
      { name: document.name, content: document.content, type: document.type || 'application/pdf' },
      { documentType: parseDocumentType(documentType), extractTables, extractText }
    );

    if (parseResult.errors && parseResult.errors.length > 0) {
      return res.status(400).json({
        error: `Document parsing failed with ${parseResult.errors.length} error(s)`,
        details: parseResult.errors,
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        documentId: `doc_${randomUUID()}`,
        documentName: document.name,
        documentType,
        parsed: {
          raw: parseResult.raw,
          normalized: parseResult.normalized,
          metadata: parseResult.metadata,
        },
        qualityMetrics: {
          hasErrors: false,
          errorCount: 0,
          errors: [],
        },
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Document upload error:', error);
    return res.status(500).json({
      error: `Failed to process document: ${error.message}`,
      errorType: error.constructor.name,
      timestamp: new Date().toISOString(),
    });
  }
}

export async function handleSuretyProcess(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let persistenceAvailable = true;
  try {
    if (!(await requireUser(req, res))) return;

    try {
      ensureSuretyDB();
    } catch (error) {
      persistenceAvailable = false;
      console.warn('Surety DB persistence unavailable, running analysis-only mode:', error.message);
    }

    const rateLimitError = enforceRateLimit(req, 15, 60 * 1000);
    if (rateLimitError) return res.status(rateLimitError.statusCode).json(JSON.parse(rateLimitError.body));

    const {
      document,
      documentType = 'balance-sheet',
      analysisType = 'full',
      wipDetails = {},
      spreadingOptions = {},
    } = req.body || {};

    if (!document) return res.status(400).json({ error: 'Missing required field: document' });
    if (!document.name || !document.content) {
      return res.status(400).json({ error: 'Document must have name and content properties' });
    }

    const timestamp = new Date().toISOString();
    const parseResult = await getParserInstance().parse(
      { name: document.name, content: document.content, type: document.type || 'text/plain' },
      { documentType, extractTables: true, extractText: true }
    );

    if (parseResult.errors && parseResult.errors.length > 0) {
      return res.status(422).json({
        error: `Document parsing failed with ${parseResult.errors.length} error(s)`,
        details: parseResult.errors,
      });
    }

    const raw = parseResult.normalized?.financials || parseResult.raw || {};
    const normalizedData = {
      financials: buildFinancials(raw),
      documentMetadata: {
        type: documentType,
        fileName: document.name,
        uploadedAt: timestamp,
      },
    };

    const { spreadingAnalysis, wipAnalysis, underwritingSummary } = await runSuretyAnalysis({
      normalizedData,
      wipDetails,
      analysisType,
      spreadingOptions,
    });
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

    const documentId = `doc_${randomUUID()}`;
    const responseData = {
      documentId,
      documentName: document.name,
      documentType,
      analysisId: `analysis_${randomUUID()}`,
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

    return res.status(200).json({ success: true, data: responseData });
  } catch (error) {
    console.error('Process endpoint error:', error);
    return res.status(500).json({ error: `Processing failed: ${error.message}` });
  }
}

async function getRequestOrganizationId(client, userId) {
  if (!userId) return null;

  try {
    const { data, error } = await client
      .from('user_roles')
      .select('organization_id')
      .eq('user_id', userId)
      .single();

    if (error) return null;
    return data?.organization_id || null;
  } catch {
    return null;
  }
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || '').trim());
}

function formatApplication(application) {
  return {
    applicationId: application.id,
    createdAt: application.created_at,
    updatedAt: application.updated_at,
    applicantName: application.applicant_name,
    businessType: application.business_type,
    industry: application.industry,
    overallRiskLevel: application.overall_risk_level,
    status: application.status,
    analysis: application.analysis_result,
  };
}

export async function handleSuretyApplications(req, res) {
  if (!['GET', 'POST'].includes(req.method)) return res.status(405).json({ error: 'Method not allowed' });

  if (!(await requireUser(req, res))) return;

  let client;
  try {
    ensureSuretyDB();
    client = getServiceRoleClient();
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }

  const rateLimitError = enforceRateLimit(req, 30, 60 * 1000);
  if (rateLimitError) return res.status(rateLimitError.statusCode).json(JSON.parse(rateLimitError.body));

  const organizationId = await getRequestOrganizationId(client, req.user.userId);

  if (req.method === 'GET') {
    try {
      const { applicationId, limit = '6' } = req.query || {};
      if (applicationId) {
        if (!isUuid(applicationId)) return res.status(400).json({ error: 'Invalid applicationId format' });

        const record = await getApplication(applicationId, req.user.userId, organizationId);
        return res.status(200).json({
          success: true,
          data: {
            ...formatApplication(record.application),
            analyses: record.analyses,
            documents: record.documents,
            riskFactors: record.riskFactors,
            recommendations: record.recommendations,
          },
        });
      }

      const records = await listApplications({
        userId: req.user.userId,
        organizationId,
        limit: Math.max(1, Math.min(Number.parseInt(limit, 10) || 6, 20)),
      });

      return res.status(200).json({ success: true, data: records.map(formatApplication) });
    } catch (error) {
      console.error('Failed to load surety applications:', error);
      return res.status(500).json({ error: `Failed to load surety applications: ${error.message}` });
    }
  }

  try {
    const { documentId, documentName, documentType, applicantName, businessType, industry, analysis } = req.body || {};
    if (!analysis) return res.status(400).json({ error: 'Missing analysis payload' });

    const result = await createApplication({
      userId: req.user.userId,
      organizationId,
      documentId,
      documentName,
      documentType,
      applicantName,
      businessType,
      industry,
      analysis,
    });
    const record = await getApplication(result.applicationId, req.user.userId, organizationId);

    return res.status(200).json({
      success: true,
      data: {
        ...formatApplication(record.application),
        analyses: record.analyses,
        documents: record.documents,
        riskFactors: record.riskFactors,
        recommendations: record.recommendations,
      },
    });
  } catch (error) {
    console.error('Failed to save surety application:', error);
    return res.status(500).json({ error: `Failed to save surety application: ${error.message}` });
  }
}

export async function handleSuretySpreading(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!(await requireUser(req, res))) return;

  const rateLimitError = enforceRateLimit(req, 20, 60 * 1000);
  if (rateLimitError) return res.status(rateLimitError.statusCode).json(JSON.parse(rateLimitError.body));

  try {
    const { normalizedData, underwriter = 'System' } = req.body || {};
    const financials = normalizedData?.financials || normalizedData;
    if (!financials) return res.status(400).json({ error: 'Missing normalizedData payload' });

    const data = {
      financials: buildFinancials(financials),
      documentMetadata: normalizedData?.documentMetadata || {
        type: 'financial-statement',
        uploadedAt: new Date().toISOString(),
      },
    };
    const spreadingEngine = new SpreadingEngine();
    const spreadingAnalysis = await spreadingEngine.generateSpread(data, { underwriter });
    return res.status(200).json({ success: true, data: spreadingAnalysis });
  } catch (error) {
    console.error('Spreading endpoint error:', error);
    return res.status(500).json({ error: `Spreading calculation failed: ${error.message}` });
  }
}
