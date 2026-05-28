/**
 * Surety Analysis Endpoint
 *
 * POST /api/v1/surety/analyze
 *
 * Accepts normalized financial data and runs comprehensive surety underwriting analysis.
 * Orchestrates SpreadingEngine (as-allowed adjustments) and WIPAnalyzer (construction contracts).
 *
 * Authentication: Required (OAuth via PKCE)
 * Authorization: Requires 'analysis:execute' permission in 'surety' domain
 *
 * Request body:
 * {
 *   financials: {
 *     revenue: number,
 *     grossProfit: number,
 *     expenses: number,
 *     netIncome: number,
 *     liabilities: { total: number },
 *     equity: number,
 *     assets?: number,
 *     businessAge?: number,
 *     industryType?: string
 *   },
 *   wipDetails?: { contracts: [...] },
 *   documentMetadata?: { type, fileName, uploadedAt },
 *   analysisType?: 'spreading' | 'wip' | 'full' (default: 'full'),
 *   spreadingOptions?: { underwriter: string }
 * }
 *
 * Response:
 * {
 *   success: true,
 *   data: {
 *     analysisId: string,
 *     timestamp: string,
 *     spreadingAnalysis: { ... },
 *     wipAnalysis: { ... },
 *     underwritingSummary: {
 *       overallRiskLevel: string,
 *       keyMetrics: { ... },
 *       recommendations: [ ... ],
 *       warnings: [ ... ]
 *     },
 *     metadata: { underwriter, completedAt, businessAge, industryType }
 *   },
 *   error?: { code, message }
 * }
 */

import { verifyAndAttachUser } from '../../../lib/middleware/auth.js';
import { requirePermission, enforceDomainIsolation, enforceRateLimit } from '../../../lib/middleware/rbac.js';
import { validateRequestBody, FINANCIAL_SCHEMA } from '../../../lib/middleware/sanitization.js';
import { formatErrorResponse } from '../../../lib/middleware/validation.js';
import { asyncHandler } from '../../../lib/middleware/exceptions.js';
import { auditLog } from '../../../src/shared/security/auditLogger.js';
import { SpreadingEngine } from '../../../src/domains/surety/services/spreadingEngine.js';
import { WIPAnalyzer } from '../../../src/domains/surety/services/wipAnalyzer.js';
import { buildReadinessReport, buildUnderwritingSummary } from '../../../src/domains/surety/services/readinessReport.js';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import { getServerSupabaseServiceRoleKey, getServerSupabaseUrl } from '../../../lib/supabase/config.js';

let serviceRoleClient = null;

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

export default asyncHandler(async (req, res) => {
  let supabaseClient = null;
  try {
    supabaseClient = getServiceRoleClient();
  } catch (error) {
    console.warn('Surety analyze audit persistence unavailable:', error.message);
  }

  // ✅ 1. AUTHENTICATE: Verify user identity
  const authError = await verifyAndAttachUser(req);
  if (authError) {
    const { statusCode, body } = authError;
    return res.status(statusCode).json(JSON.parse(body));
  }

  // ✅ 2. AUTHORIZE: Check user has 'analysis:execute' permission in Surety domain
  const permError = requirePermission(req, 'analysis', 'execute', 'surety');
  if (permError) {
    const { statusCode, body } = permError;
    return res.status(statusCode).json(JSON.parse(body));
  }

  // ✅ 3. DOMAIN ISOLATION: Ensure user can only access Surety domain data
  const domainError = enforceDomainIsolation(req, 'surety');
  if (domainError) {
    const { statusCode, body } = domainError;
    return res.status(statusCode).json(JSON.parse(body));
  }

  // Limit expensive underwriting analysis requests
  const rateLimitError = enforceRateLimit(req, 20, 60 * 1000);
  if (rateLimitError) {
    const { statusCode, body } = rateLimitError;
    return res.status(statusCode).json(JSON.parse(body));
  }

  // ✅ 4. VALIDATE INPUT: Sanitize and validate all inputs
  const valError = validateRequestBody(req, FINANCIAL_SCHEMA);
  if (valError) {
    const { statusCode, body } = valError;
    return res.status(statusCode).json(JSON.parse(body));
  }

  // Safe to use req.body now - it's been validated and sanitized
  const {
    financials,
    wipDetails = {},
    documentMetadata = {},
    analysisType = 'full',
    spreadingOptions = {},
  } = req.body || {};

  // Issue #8: Type validation - ensure all numeric fields are actually numbers
  const numericFields = ['revenue', 'grossProfit', 'expenses', 'netIncome', 'equity', 'assets', 'businessAge'];
  for (const field of numericFields) {
    if (financials[field] !== undefined && typeof financials[field] !== 'number') {
      const { statusCode, body } = formatErrorResponse({
        message: `Field "${field}" must be a number, got ${typeof financials[field]}`,
      }, 400);
      return res.status(statusCode).json(JSON.parse(body));
    }
  }

  if (financials.liabilities && typeof financials.liabilities.total !== 'number') {
    const { statusCode, body } = formatErrorResponse({
      message: 'Field "liabilities.total" must be a number',
    }, 400);
    return res.status(statusCode).json(JSON.parse(body));
  }

  // Issue #5: Use UUID for guaranteed uniqueness
  const analysisId = `analysis_${randomUUID()}`;
  const timestamp = new Date().toISOString();

  // ✅ 5. PREPARE NORMALIZED DATA STRUCTURE
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
      industryType: financials.industryType || 'General'
    },
    documentMetadata: documentMetadata || {
      type: 'financial-statement',
      uploadedAt: timestamp
    }
  };

  // ✅ 6. RUN SPREADING ENGINE ANALYSIS
  let spreadingAnalysis = null;
  if (['spreading', 'full'].includes(analysisType)) {
    try {
      const spreadingEngine = new SpreadingEngine();
      spreadingAnalysis = await spreadingEngine.generateSpread(
        normalizedData,
        { underwriter: spreadingOptions.underwriter || 'System' }
      );
    } catch (error) {
      console.error('Spreading analysis error:', error);
      const { statusCode, body } = formatErrorResponse({
        message: `Spreading analysis failed: ${error.message}`,
        code: 'SPREADING_ENGINE_ERROR',
      });
      // bug_021: audit failed analyses so they appear in compliance trail
      if (supabaseClient) {
        await auditLog(supabaseClient, {
          userId: req.user.userId,
          action: 'SURETY_ANALYSIS_FAILED',
          resourceType: 'analysis',
          resourceId: analysisId,
          apiEndpoint: req.url,
          httpMethod: 'POST',
          responseStatus: statusCode,
          analysisMetadata: { analysisType, failureStage: 'spreading', errorCode: 'SPREADING_ENGINE_ERROR' },
          severity: 'ERROR',
        }).catch(e => console.error('Audit log failed:', e));
      }
      return res.status(statusCode).json(JSON.parse(body));
    }
  }

  // ✅ 7. RUN WIP ANALYZER (if requested)
  let wipAnalysis = null;
  if (['wip', 'full'].includes(analysisType)) {
    try {
      const wipAnalyzer = new WIPAnalyzer();
      wipAnalysis = await wipAnalyzer.analyzeWIP(normalizedData, wipDetails);
    } catch (error) {
      console.error('WIP analysis error:', error);
      const { statusCode, body } = formatErrorResponse({
        message: `WIP analysis failed: ${error.message}`,
        code: 'WIP_ANALYZER_ERROR',
      });
      // bug_021: audit failed analyses so they appear in compliance trail
      if (supabaseClient) {
        await auditLog(supabaseClient, {
          userId: req.user.userId,
          action: 'SURETY_ANALYSIS_FAILED',
          resourceType: 'analysis',
          resourceId: analysisId,
          apiEndpoint: req.url,
          httpMethod: 'POST',
          responseStatus: statusCode,
          analysisMetadata: { analysisType, failureStage: 'wip', errorCode: 'WIP_ANALYZER_ERROR' },
          severity: 'ERROR',
        }).catch(e => console.error('Audit log failed:', e));
      }
      return res.status(statusCode).json(JSON.parse(body));
    }
  }

  // ✅ 8. GENERATE UNDERWRITING SUMMARY
  const underwritingSummary = buildUnderwritingSummary({
    spreadingAnalysis,
    wipAnalysis,
    financials: normalizedData.financials  // Pass financials for ratio analysis
  });
  const readinessReport = buildReadinessReport({
    documentName: documentMetadata.fileName || 'Uploaded financial package',
    documentType: documentMetadata.type || 'financial-statement',
    parsed: {
      normalized: normalizedData,
      metadata: documentMetadata,
    },
    spreadingAnalysis,
    wipAnalysis,
    underwritingSummary,
  });

  // ✅ 9. AUDIT LOG: Record successful analysis
  if (supabaseClient) {
    await auditLog(supabaseClient, {
      userId: req.user.userId,
      sessionId: req.headers['x-request-id'] || analysisId,
      action: 'SURETY_ANALYSIS_EXECUTED',
      resourceType: 'analysis',
      resourceId: analysisId,
      apiEndpoint: req.url,
      httpMethod: 'POST',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      responseStatus: 200,
      financialData: {
        revenue: financials.revenue,
        netIncome: financials.netIncome,
        businessAge: normalizedData.financials.businessAge,
        industryType: normalizedData.financials.industryType
      },
      analysisMetadata: {
        analysisType,
        riskLevel: underwritingSummary.overallRiskLevel,
        keyFindingsCount: underwritingSummary.warnings.length
      },
      severity: 'INFO'
    }).catch(e => console.error('Audit log failed:', e));
  }

  // ✅ 10. RETURN SUCCESS RESPONSE
  return res.status(200).json({
    success: true,
    data: {
      analysisId,
      timestamp,
      spreadingAnalysis,
      wipAnalysis,
      underwritingSummary,
      readinessReport,
      metadata: {
        underwriter: spreadingOptions.underwriter || 'System',
        analysisCompletedAt: new Date().toISOString(),
        businessAge: normalizedData.financials.businessAge,
        industryType: normalizedData.financials.industryType
      }
    }
  });
});
