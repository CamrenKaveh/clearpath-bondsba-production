import { createHash, randomUUID } from 'crypto';
import { verifyAndAttachUser } from '../lib/middleware/auth.js';
import { assertUsageCapacity } from '../lib/billing/access.js';
import { getBillingContext } from '../lib/billing/context.js';
import { incrementEntitlementUsage, recordUsageEvent } from '../lib/billing/entitlements.js';
import { getSupabaseAdminClient } from '../lib/billing/supabaseAdmin.js';

const ALLOWED_TYPES = new Set([
  'wip_schedule',
  'financial_statement',
  'tax_return',
  'debt_schedule',
  'bank_statement',
  'bond_request',
  'unknown',
]);

const EXTRACTION_MEMORY_CACHE = new Map();

const GOOGLE_SCOPE = 'https://www.googleapis.com/auth/cloud-platform';

function hasGoogleConfig() {
  return Boolean(
    process.env.GOOGLE_DOCUMENT_AI_PROJECT_ID &&
      process.env.GOOGLE_DOCUMENT_AI_LOCATION &&
      process.env.GOOGLE_DOCUMENT_AI_PROCESSOR_ID &&
      process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
      process.env.GOOGLE_WORKLOAD_IDENTITY_PROVIDER &&
      process.env.VERCEL_OIDC_TOKEN
  );
}

function resolveProvider() {
  if (hasGoogleConfig()) return 'google-document-ai';
  return 'mock';
}

function isLocalRuntime(req) {
  const host = `${req?.headers?.host || ''}`.toLowerCase();
  if (
    host.includes('localhost') ||
    host.startsWith('127.0.0.1') ||
    host.includes('[::1]') ||
    host.startsWith('0.0.0.0')
  ) {
    return true;
  }

  return !process.env.VERCEL && process.env.NODE_ENV !== 'production';
}

function getGoogleConfig() {
  return {
    projectId: `${process.env.GOOGLE_DOCUMENT_AI_PROJECT_ID || ''}`.trim(),
    location: `${process.env.GOOGLE_DOCUMENT_AI_LOCATION || ''}`.trim(),
    processorId: `${process.env.GOOGLE_DOCUMENT_AI_PROCESSOR_ID || ''}`.trim(),
    serviceAccountEmail: `${process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || ''}`.trim(),
    workloadIdentityProvider: `${process.env.GOOGLE_WORKLOAD_IDENTITY_PROVIDER || ''}`.trim(),
    oidcToken: `${process.env.VERCEL_OIDC_TOKEN || ''}`.trim(),
  };
}

function normalizeWorkloadIdentityAudience(providerPath) {
  const raw = `${providerPath || ''}`.trim();
  if (!raw) return '';
  if (raw.startsWith('//iam.googleapis.com/')) return raw;
  if (raw.startsWith('https://iam.googleapis.com/')) return `//${raw.replace(/^https?:\/\//, '')}`;
  if (raw.startsWith('iam.googleapis.com/')) return `//${raw}`;
  return `//iam.googleapis.com/${raw.replace(/^\//, '')}`;
}

function inferMimeType(file) {
  if (typeof file?.type === 'string' && file.type.trim()) {
    return file.type.trim();
  }

  const lower = `${file?.name || ''}`.toLowerCase();
  if (lower.endsWith('.pdf')) return 'application/pdf';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.tiff') || lower.endsWith('.tif')) return 'image/tiff';
  if (lower.endsWith('.csv')) return 'text/csv';
  if (lower.endsWith('.xlsx')) return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  return 'application/octet-stream';
}

function normalizeDocumentType(value) {
  return ALLOWED_TYPES.has(value) ? value : 'unknown';
}

function safeBody(reqBody) {
  if (typeof reqBody === 'string') {
    try {
      return JSON.parse(reqBody);
    } catch {
      return {};
    }
  }
  return reqBody || {};
}

function extractBase64Payload(file) {
  if (!file) return null;
  if (typeof file === 'string') return file.split(',').pop() || file;
  if (typeof file.content === 'string') return file.content.split(',').pop() || file.content;
  if (typeof file.base64 === 'string') return file.base64.split(',').pop() || file.base64;
  return null;
}

function deriveFileName(file) {
  if (!file) return 'uploaded-document';
  if (typeof file === 'object' && file.name) return file.name;
  return 'uploaded-document';
}

function guessPageCount(file, base64Payload) {
  if (typeof file?.pageCount === 'number' && Number.isFinite(file.pageCount) && file.pageCount > 0) {
    return Math.max(1, Math.round(file.pageCount));
  }

  if (!base64Payload) return 1;
  const approximateBytes = Math.max(1, Math.floor((base64Payload.length * 3) / 4));
  // Approximate 250KB/page heuristic for mixed statement scans.
  const heuristicPages = Math.ceil(approximateBytes / 250000);
  return Math.max(1, Math.min(200, heuristicPages));
}

function computeFileHash(base64Payload, fileName, documentType) {
  return createHash('sha256')
    .update(`${fileName}:${documentType}:${base64Payload || ''}`)
    .digest('hex');
}

function parseLikelyWipColumns(csvText) {
  const lines = csvText.split(/\r?\n/).filter(Boolean);
  if (!lines.length) return { columns: [], warnings: ['No tabular rows detected in CSV content.'] };

  const header = lines[0]
    .split(',')
    .map((part) => part.trim().toLowerCase());

  const wipSignals = [
    ['job', 'job_name'],
    ['contract amount', 'contract_amount'],
    ['revised contract', 'revised_contract'],
    ['billed', 'billed_to_date'],
    ['cost to date', 'cost_to_date'],
    ['estimated cost to complete', 'estimated_cost_to_complete'],
    ['gross profit', 'gross_profit'],
    ['underbilling', 'underbilling'],
    ['overbilling', 'overbilling'],
    ['backlog', 'backlog'],
  ];

  const detected = [];
  for (const [pattern, mapped] of wipSignals) {
    const index = header.findIndex((col) => col.includes(pattern));
    if (index >= 0) {
      detected.push({ source: header[index], mappedField: mapped, columnIndex: index });
    }
  }

  const warnings = detected.length < 5
    ? ['Column mapping is uncertain. Review and map WIP columns manually before final use.']
    : [];

  return {
    columns: detected,
    warnings,
  };
}

function buildExtraction(documentType, pageCount, provider) {
  return {
    provider,
    confidence: provider === 'mock' ? 0.62 : 0.79,
    extractedFields: {
      contractorName: 'Northline Civil LLC',
      activeJobs: 12,
      totalBacklog: 4200000,
      largestJobPercent: 42,
      underbillingsPresent: true,
      overbillingsPresent: false,
      marginFadeIndicators: ['Two active jobs show gross margin deterioration.'],
      costToCompleteAvailable: 'partial',
      documentDate: new Date().toISOString().slice(0, 10),
      notes: [`${provider} extraction preview for ${documentType}`],
    },
    fieldsForReview: [
      { key: 'contractorName', label: 'Contractor name', value: 'Northline Civil LLC', confidence: 0.88, source: 'document-text' },
      { key: 'activeJobs', label: 'Active jobs', value: 12, confidence: 0.77, source: 'wip-table' },
      { key: 'largestJobPercent', label: 'Largest job % of backlog', value: 42, confidence: 0.69, source: 'wip-table' },
      { key: 'costToCompleteAvailable', label: 'Cost-to-complete detail', value: 'partial', confidence: 0.72, source: 'narrative' },
    ],
    warnings: [
      'Extraction can reduce typing, but confirmed values should be reviewed by a professional.',
      ...(provider === 'mock'
        ? ['Provider credentials are not configured; response is running in local demo mode.']
        : []),
    ],
    pageCount,
  };
}

function pickEntityByType(entities, patterns = []) {
  if (!Array.isArray(entities) || !patterns.length) return null;
  const lowered = patterns.map((pattern) => `${pattern}`.toLowerCase());
  return entities.find((entity) => {
    const type = `${entity?.type || ''}`.toLowerCase();
    return lowered.some((pattern) => type.includes(pattern));
  }) || null;
}

function readNormalizedEntityValue(entity) {
  if (!entity || typeof entity !== 'object') return null;

  const normalized = entity.normalizedValue || {};
  if (typeof normalized.text === 'string' && normalized.text.trim()) return normalized.text.trim();
  if (typeof normalized.integerValue === 'number' && Number.isFinite(normalized.integerValue)) return normalized.integerValue;
  if (typeof normalized.floatValue === 'number' && Number.isFinite(normalized.floatValue)) return normalized.floatValue;
  if (typeof normalized.booleanValue === 'boolean') return normalized.booleanValue;
  if (typeof entity.mentionText === 'string' && entity.mentionText.trim()) return entity.mentionText.trim();
  return null;
}

function parseNumber(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return null;
  const numeric = Number(value.replace(/[^0-9.-]/g, ''));
  return Number.isFinite(numeric) ? numeric : null;
}

function parseBoolean(value) {
  if (typeof value === 'boolean') return value;
  const lowered = `${value || ''}`.trim().toLowerCase();
  if (!lowered) return null;
  if (['yes', 'true', 'present', 'y', '1'].includes(lowered)) return true;
  if (['no', 'false', 'absent', 'n', '0'].includes(lowered)) return false;
  return null;
}

function parseCostToCompleteValue(value) {
  const lowered = `${value || ''}`.trim().toLowerCase();
  if (!lowered) return null;
  if (lowered.includes('partial')) return 'partial';
  if (['yes', 'available', 'complete'].some((item) => lowered.includes(item))) return 'yes';
  if (['no', 'missing', 'incomplete'].some((item) => lowered.includes(item))) return 'no';
  return null;
}

function regexCapture(text, regex) {
  const match = text.match(regex);
  if (!match || typeof match[1] !== 'string') return null;
  const value = match[1].trim();
  return value || null;
}

function buildGoogleWarnings(documentType) {
  return [
    `Document AI extraction completed for ${documentType}.`,
    'Extraction can reduce typing, but confirmed values should be reviewed by a professional.',
    'Values are decision-support only and require professional review before handoff.',
  ];
}

function buildRowsFromExtractedFields(extractedFields, confidenceByKey = {}, sourceByKey = {}) {
  const labels = {
    contractorName: 'Contractor name',
    activeJobs: 'Active jobs',
    largestJobPercent: 'Largest job % of backlog',
    underbillingsPresent: 'Underbillings present',
    overbillingsPresent: 'Overbillings present',
    costToCompleteAvailable: 'Cost-to-complete detail',
    documentDate: 'Document date',
  };

  return Object.entries(extractedFields)
    .filter(([, value]) => value !== null && value !== undefined && value !== '')
    .map(([key, value]) => ({
      key,
      label: labels[key] || key,
      value,
      confidence: confidenceByKey[key] ?? 0.66,
      source: sourceByKey[key] || 'document-ai',
    }));
}

async function exchangeOidcTokenForGoogleFederatedToken(oidcToken, audience) {
  const response = await fetch('https://sts.googleapis.com/v1/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      audience,
      grantType: 'urn:ietf:params:oauth:grant-type:token-exchange',
      requestedTokenType: 'urn:ietf:params:oauth:token-type:access_token',
      subjectTokenType: 'urn:ietf:params:oauth:token-type:jwt',
      scope: GOOGLE_SCOPE,
      subjectToken: oidcToken,
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.access_token) {
    throw new Error(payload.error_description || payload.error || 'Google STS token exchange failed.');
  }

  return payload.access_token;
}

async function impersonateGoogleServiceAccount(federatedAccessToken, serviceAccountEmail) {
  const endpoint = `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${encodeURIComponent(serviceAccountEmail)}:generateAccessToken`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${federatedAccessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      scope: [GOOGLE_SCOPE],
      lifetime: '3600s',
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.accessToken) {
    throw new Error(payload.error?.message || 'Google service account impersonation failed.');
  }

  return payload.accessToken;
}

async function callGoogleDocumentAi({
  projectId,
  location,
  processorId,
  accessToken,
  base64Payload,
  mimeType,
}) {
  const endpoint = `https://${location}-documentai.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/locations/${encodeURIComponent(location)}/processors/${encodeURIComponent(processorId)}:process`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      skipHumanReview: true,
      rawDocument: {
        content: base64Payload,
        mimeType,
      },
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error?.message || 'Google Document AI request failed.');
  }

  return payload;
}

function extractFieldsFromGoogleDocument(documentAiResponse = {}) {
  const document = documentAiResponse.document || {};
  const entities = Array.isArray(document.entities) ? document.entities : [];
  const text = typeof document.text === 'string' ? document.text : '';

  const extractedFields = {};
  const confidenceByKey = {};
  const sourceByKey = {};

  const entityMap = {
    contractorName: pickEntityByType(entities, ['contractor', 'company_name', 'business_name']),
    activeJobs: pickEntityByType(entities, ['active_jobs', 'active_job_count']),
    largestJobPercent: pickEntityByType(entities, ['largest_job_percent', 'backlog_concentration']),
    underbillingsPresent: pickEntityByType(entities, ['underbilling', 'underbillings_present']),
    overbillingsPresent: pickEntityByType(entities, ['overbilling', 'overbillings_present']),
    costToCompleteAvailable: pickEntityByType(entities, ['cost_to_complete', 'ctc_detail']),
    documentDate: pickEntityByType(entities, ['document_date', 'statement_date']),
  };

  const contractorText = regexCapture(text, /(?:contractor|company|business)\s*[:\-]\s*([^\n\r]+)/i);
  const activeJobsText = regexCapture(text, /active\s+jobs?\s*[:\-]\s*([0-9]+)/i);
  const largestJobText = regexCapture(text, /largest\s+job(?:\s+as\s+%?\s+of\s+backlog)?\s*[:\-]\s*([0-9.]+)\s*%?/i);
  const underbillingsText = regexCapture(text, /underbillings?\s*(?:present)?\s*[:\-]\s*(yes|no|true|false)/i);
  const overbillingsText = regexCapture(text, /overbillings?\s*(?:present)?\s*[:\-]\s*(yes|no|true|false)/i);
  const ctcText = regexCapture(text, /cost[\s-]*to[\s-]*complete(?:\s+detail)?\s*[:\-]\s*(yes|no|partial)/i);
  const dateText = regexCapture(text, /(?:document|statement)\s+date\s*[:\-]\s*([0-9]{4}-[0-9]{2}-[0-9]{2}|[0-9]{1,2}\/[0-9]{1,2}\/[0-9]{2,4})/i);

  const contractorValue = readNormalizedEntityValue(entityMap.contractorName) ?? contractorText ?? null;
  if (contractorValue) {
    extractedFields.contractorName = `${contractorValue}`.trim();
    confidenceByKey.contractorName = entityMap.contractorName?.confidence ?? 0.65;
    sourceByKey.contractorName = entityMap.contractorName ? 'entity' : 'text-pattern';
  }

  const activeJobsValue = parseNumber(readNormalizedEntityValue(entityMap.activeJobs) ?? activeJobsText);
  if (activeJobsValue != null) {
    extractedFields.activeJobs = Math.max(0, Math.round(activeJobsValue));
    confidenceByKey.activeJobs = entityMap.activeJobs?.confidence ?? 0.62;
    sourceByKey.activeJobs = entityMap.activeJobs ? 'entity' : 'text-pattern';
  }

  const largestJobValue = parseNumber(readNormalizedEntityValue(entityMap.largestJobPercent) ?? largestJobText);
  if (largestJobValue != null) {
    extractedFields.largestJobPercent = largestJobValue;
    confidenceByKey.largestJobPercent = entityMap.largestJobPercent?.confidence ?? 0.6;
    sourceByKey.largestJobPercent = entityMap.largestJobPercent ? 'entity' : 'text-pattern';
  }

  const underbillingsValue = parseBoolean(readNormalizedEntityValue(entityMap.underbillingsPresent) ?? underbillingsText);
  if (underbillingsValue != null) {
    extractedFields.underbillingsPresent = underbillingsValue;
    confidenceByKey.underbillingsPresent = entityMap.underbillingsPresent?.confidence ?? 0.58;
    sourceByKey.underbillingsPresent = entityMap.underbillingsPresent ? 'entity' : 'text-pattern';
  }

  const overbillingsValue = parseBoolean(readNormalizedEntityValue(entityMap.overbillingsPresent) ?? overbillingsText);
  if (overbillingsValue != null) {
    extractedFields.overbillingsPresent = overbillingsValue;
    confidenceByKey.overbillingsPresent = entityMap.overbillingsPresent?.confidence ?? 0.58;
    sourceByKey.overbillingsPresent = entityMap.overbillingsPresent ? 'entity' : 'text-pattern';
  }

  const costToCompleteValue = parseCostToCompleteValue(readNormalizedEntityValue(entityMap.costToCompleteAvailable) ?? ctcText);
  if (costToCompleteValue) {
    extractedFields.costToCompleteAvailable = costToCompleteValue;
    confidenceByKey.costToCompleteAvailable = entityMap.costToCompleteAvailable?.confidence ?? 0.59;
    sourceByKey.costToCompleteAvailable = entityMap.costToCompleteAvailable ? 'entity' : 'text-pattern';
  }

  const documentDateValue = readNormalizedEntityValue(entityMap.documentDate) ?? dateText ?? null;
  if (documentDateValue) {
    extractedFields.documentDate = `${documentDateValue}`.trim();
    confidenceByKey.documentDate = entityMap.documentDate?.confidence ?? 0.57;
    sourceByKey.documentDate = entityMap.documentDate ? 'entity' : 'text-pattern';
  }

  const confidenceValues = Object.values(confidenceByKey).filter((value) => typeof value === 'number' && Number.isFinite(value));
  const averageConfidence = confidenceValues.length
    ? confidenceValues.reduce((acc, value) => acc + value, 0) / confidenceValues.length
    : 0.55;

  return {
    confidence: Number(averageConfidence.toFixed(2)),
    extractedFields,
    fieldsForReview: buildRowsFromExtractedFields(extractedFields, confidenceByKey, sourceByKey),
  };
}

async function extractWithGoogleDocumentAi({
  base64Payload,
  file,
  documentType,
}) {
  const config = getGoogleConfig();
  const audience = normalizeWorkloadIdentityAudience(config.workloadIdentityProvider);
  if (!audience) {
    throw new Error('GOOGLE_WORKLOAD_IDENTITY_PROVIDER is not configured.');
  }

  const federatedToken = await exchangeOidcTokenForGoogleFederatedToken(config.oidcToken, audience);
  const serviceAccessToken = await impersonateGoogleServiceAccount(federatedToken, config.serviceAccountEmail);
  const docAiPayload = await callGoogleDocumentAi({
    projectId: config.projectId,
    location: config.location,
    processorId: config.processorId,
    accessToken: serviceAccessToken,
    base64Payload,
    mimeType: inferMimeType(file),
  });

  const parsed = extractFieldsFromGoogleDocument(docAiPayload);
  return {
    provider: 'google-document-ai',
    confidence: parsed.confidence,
    extractedFields: parsed.extractedFields,
    fieldsForReview: parsed.fieldsForReview,
    warnings: buildGoogleWarnings(documentType),
  };
}

async function getCachedExtraction({ userId, fileHash }) {
  if (!userId || !fileHash) return null;

  const memoryKey = `${userId}:${fileHash}`;
  if (EXTRACTION_MEMORY_CACHE.has(memoryKey)) {
    return EXTRACTION_MEMORY_CACHE.get(memoryKey);
  }

  try {
    const supabase = getSupabaseAdminClient();
    const { data } = await supabase
      .from('document_extractions')
      .select('*')
      .eq('user_id', userId)
      .eq('file_hash', fileHash)
      .limit(1);

    if (data?.[0]) {
      EXTRACTION_MEMORY_CACHE.set(memoryKey, data[0]);
      return data[0];
    }
  } catch {
    // Ignore DB cache failures for local mode.
  }

  return null;
}

async function persistExtraction({
  userId,
  organizationId,
  fileHash,
  fileName,
  documentType,
  provider,
  pageCount,
  confidence,
  extractedFields,
  confirmedFields = {},
  creditsUsed = pageCount,
  status = 'extracted',
}) {
  const memoryKey = `${userId}:${fileHash}`;
  const payload = {
    user_id: userId,
    organization_id: organizationId,
    file_hash: fileHash,
    file_name: fileName,
    provider,
    document_type: documentType,
    page_count: pageCount,
    credits_used: creditsUsed,
    confidence,
    extracted_fields: extractedFields,
    confirmed_fields: confirmedFields,
    status,
  };
  EXTRACTION_MEMORY_CACHE.set(memoryKey, payload);

  try {
    const supabase = getSupabaseAdminClient();
    await supabase.from('document_extractions').upsert(payload, {
      onConflict: 'user_id,file_hash',
    });
  } catch {
    // Ignore persistence issues in local non-configured environments.
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  const body = safeBody(req.body);
  const documentType = normalizeDocumentType(body.documentType);
  const file = body.file || null;
  const mode = body.mode === 'extract' ? 'extract' : 'estimate';
  const force = Boolean(body.force);
  const fileName = deriveFileName(file);
  const base64Payload = extractBase64Payload(file);

  if (!file || !base64Payload) {
    return res.status(400).json({ error: 'Missing file payload.' });
  }

  const authError = await verifyAndAttachUser(req);
  const user = authError ? null : req.user;
  const resolvedProvider = resolveProvider();
  const localRuntime = isLocalRuntime(req);
  const provider = resolvedProvider === 'google-document-ai' && !localRuntime ? 'google-document-ai' : 'mock';
  const pageCount = guessPageCount(file, base64Payload);
  const fileHash = computeFileHash(base64Payload, fileName, documentType);

  const warnings = [];
  if (fileName.toLowerCase().endsWith('.xlsx')) {
    warnings.push('XLSX parsing hook is ready; column mapping review is required before final use.');
  }
  if (fileName.toLowerCase().endsWith('.csv')) {
    const csvDecoded = Buffer.from(base64Payload, 'base64').toString('utf8');
    const parsed = parseLikelyWipColumns(csvDecoded);
    warnings.push(...parsed.warnings);
    if (parsed.columns.length) {
      warnings.push(`Detected likely WIP columns: ${parsed.columns.map((col) => `${col.source} → ${col.mappedField}`).join(', ')}.`);
    }
  }

  // Estimate mode never consumes credits and remains available without auth.
  if (mode === 'estimate') {
    return res.status(200).json({
      requestId: `extract_${randomUUID()}`,
      provider,
      pageCount,
      creditsUsed: 0,
      estimatedCredits: pageCount,
      confidence: null,
      extractedFields: {},
      fieldsForReview: [],
      fileHash,
      warnings: [
        `This file appears to be ${pageCount} page(s). Extraction will use ${pageCount} credit(s).`,
        ...warnings,
      ],
      requiresReview: true,
    });
  }

  // Local/dev or missing Google WIF env: return a safe mock extraction without billing.
  if (provider === 'mock') {
    const extraction = buildExtraction(documentType, pageCount, 'mock');
    extraction.warnings = [
      ...extraction.warnings,
      ...(localRuntime
        ? ['Running locally: using safe mock extraction. Manual entry remains available.']
        : ['Google Workload Identity Federation env vars are missing. Using safe mock extraction.']),
    ];
    return res.status(200).json({
      requestId: `extract_${randomUUID()}`,
      provider: 'mock',
      pageCount,
      creditsUsed: 0,
      confidence: extraction.confidence,
      extractedFields: extraction.extractedFields,
      fieldsForReview: extraction.fieldsForReview,
      fileHash,
      warnings: [...extraction.warnings, ...warnings],
      requiresReview: true,
    });
  }

  // Paid extraction mode requires signed-in billing context.
  if (!user) {
    return res.status(401).json({
      error: 'Authentication required for extraction.',
      details: 'Sign in to run extraction with billing credits, or continue with manual entry.',
    });
  }

  const context = await getBillingContext(user.userId);
  const cached = await getCachedExtraction({ userId: context.userId, fileHash });
  if (cached && !force) {
    return res.status(200).json({
      requestId: `extract_${randomUUID()}`,
      provider: cached.provider || provider,
      pageCount: cached.page_count || pageCount,
      creditsUsed: 0,
      confidence: cached.confidence || 0.7,
      extractedFields: cached.extracted_fields || {},
      fieldsForReview: Object.entries(cached.extracted_fields || {}).map(([key, value]) => ({
        key,
        label: key,
        value,
        confidence: cached.confidence || 0.7,
        source: 'cached',
      })),
      fileHash,
      fromCache: true,
      warnings: ['Using cached extraction to avoid duplicate credit usage.'],
      requiresReview: true,
    });
  }

  const usage = await assertUsageCapacity({
    userId: context.userId,
    organizationId: context.organizationId,
    counter: 'extraction_credit',
    quantity: pageCount,
  });
  if (!usage.allowed) {
    return res.status(402).json({
      error: 'Not enough extraction credits.',
      details: `This file requires ${pageCount} credit(s).`,
      requiredCredits: pageCount,
      remainingCredits: usage.remaining ?? 0,
      action: 'upgrade_or_manual',
    });
  }

  let extraction;
  try {
    extraction = await extractWithGoogleDocumentAi({
      base64Payload,
      file,
      documentType,
    });
  } catch (error) {
    return res.status(502).json({
      error: 'Document extraction failed.',
      details: error.message || 'Google Document AI could not process this file.',
      action: 'manual_fallback',
    });
  }

  const response = {
    requestId: `extract_${randomUUID()}`,
    provider: extraction.provider || provider,
    pageCount,
    creditsUsed: pageCount,
    confidence: extraction.confidence,
    extractedFields: extraction.extractedFields,
    fieldsForReview: extraction.fieldsForReview,
    fileHash,
    warnings: [...extraction.warnings, ...warnings],
    requiresReview: true,
  };

  await recordUsageEvent({
    userId: context.userId,
    organizationId: context.organizationId,
    eventType: 'extraction_credit',
    quantity: pageCount,
    metadata: {
      fileHash,
      documentType,
      provider: extraction.provider || provider,
      fileName,
    },
  }).catch(() => {});

  await incrementEntitlementUsage({
    userId: context.userId,
    organizationId: context.organizationId,
    counter: 'extraction_credits_used',
    quantity: pageCount,
  }).catch(() => {});

  await persistExtraction({
    userId: context.userId,
    organizationId: context.organizationId,
    fileHash,
    fileName,
    documentType,
    provider: extraction.provider || provider,
    pageCount,
    creditsUsed: pageCount,
    confidence: extraction.confidence,
    extractedFields: extraction.extractedFields,
    status: 'extracted',
  });

  return res.status(200).json(response);
}
