import { FieldValue, Timestamp, getFirestore } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import type {
  AuditTraceDoc,
  AuditTraceFinalStatus,
  AuditTraceStatus,
  AuditTraceStep,
  AuditVariableUsed,
  BorrowerApplicationState,
  ExecuteUnderwritingRequest,
  ParsedField,
  UserRole,
} from './types';

const ENGINE_VERSION = 'sba-surety-underwriting-v1.0.0';
const MIN_DSCR = 1.25;
const MIN_CREDIT_SCORE = 650;
const MIN_CONFIDENCE = 0.85;

function requireUnderwriterRole(rawRoles: unknown): void {
  const roles = Array.isArray(rawRoles) ? rawRoles : [rawRoles];
  const authorizedRoles = new Set<UserRole>(['Admin', 'Underwriter', 'RiskOfficer']);
  const hasAuthorizedRole = roles.some((role) => typeof role === 'string' && authorizedRoles.has(role as UserRole));

  if (!hasAuthorizedRole) {
    throw new HttpsError('permission-denied', 'Only authorized underwriting staff may execute this engine.');
  }
}

function asFiniteNumber(value: unknown, fieldName: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new HttpsError('failed-precondition', `Application field ${fieldName} must be a finite number.`);
  }
  return value;
}

function assertParsedNumber(field: unknown, fieldName: string): ParsedField<number> {
  if (!field || typeof field !== 'object') {
    throw new HttpsError('failed-precondition', `Application field ${fieldName} is missing.`);
  }

  const record = field as Partial<ParsedField<number>>;
  return {
    value: asFiniteNumber(record.value, fieldName),
    confidence: asFiniteNumber(record.confidence, `${fieldName}.confidence`),
    source: {
      documentId: String(record.source?.documentId ?? 'unknown'),
      documentName: String(record.source?.documentName ?? 'Unlinked source document'),
      fieldName: String(record.source?.fieldName ?? fieldName),
      verifiedBy: record.source?.verifiedBy ? String(record.source.verifiedBy) : null,
    },
  };
}

function buildApplicationState(applicationId: string, raw: FirebaseFirestore.DocumentData): BorrowerApplicationState {
  const cashFlow = assertParsedNumber(raw.cashFlow, 'cashFlow');
  const annualDebtService = assertParsedNumber(raw.annualDebtService, 'annualDebtService');
  const derivedDscr = annualDebtService.value === 0 ? null : cashFlow.value / annualDebtService.value;

  return {
    id: applicationId,
    borrowerName: String(raw.borrowerName ?? 'Unnamed borrower'),
    status: raw.status ?? 'Under Review',
    stakeholderEmails: Array.isArray(raw.stakeholderEmails) ? raw.stakeholderEmails.map(String) : [],
    creditScore: assertParsedNumber(raw.creditScore, 'creditScore'),
    cashFlow,
    annualDebtService,
    dscr: {
      value: typeof raw.dscr?.value === 'number' ? raw.dscr.value : derivedDscr,
      confidence: typeof raw.dscr?.confidence === 'number' ? raw.dscr.confidence : Math.min(cashFlow.confidence, annualDebtService.confidence),
      source: raw.dscr?.source ?? cashFlow.source,
    },
    affiliateRevenue: assertParsedNumber(raw.affiliateRevenue, 'affiliateRevenue'),
    industrySizeThreshold: assertParsedNumber(raw.industrySizeThreshold, 'industrySizeThreshold'),
  };
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
}

function stepStatus(condition: boolean, warnCondition: boolean): AuditTraceStatus {
  if (condition) return 'PASS';
  if (warnCondition) return 'WARN';
  return 'FAIL';
}

function variableFromParsedField(
  key: string,
  label: string,
  format: AuditVariableUsed['format'],
  field: ParsedField<number | null>,
): AuditVariableUsed {
  return {
    key,
    label,
    value: field.value,
    format,
    confidence: field.confidence,
    source: field.source,
  };
}

function deriveFinalStatus(steps: AuditTraceStep[], variablesUsed: AuditVariableUsed[]): AuditTraceFinalStatus {
  if (steps.some((step) => step.status === 'FAIL')) return 'FAIL';
  if (variablesUsed.some((variable) => variable.confidence < MIN_CONFIDENCE)) return 'REQUIRES_REVIEW';
  if (steps.some((step) => step.status === 'WARN')) return 'WARN';
  return 'PASS';
}

function buildTrace(application: BorrowerApplicationState, triggeredBy: string, traceId: string, startedAt: number): AuditTraceDoc {
  const dscr = application.dscr.value ?? 0;
  const dscrStatus = stepStatus(dscr >= MIN_DSCR, dscr >= 1.1);
  const creditStatus = stepStatus(application.creditScore.value >= MIN_CREDIT_SCORE, application.creditScore.value >= 620);
  const affiliatePass = application.affiliateRevenue.value <= application.industrySizeThreshold.value;
  const affiliateStatus = stepStatus(affiliatePass, application.affiliateRevenue.value <= application.industrySizeThreshold.value * 1.05);
  const confidenceFloor = Math.min(
    application.creditScore.confidence,
    application.cashFlow.confidence,
    application.annualDebtService.confidence,
    application.affiliateRevenue.confidence,
    application.industrySizeThreshold.confidence,
  );
  const confidenceStatus = stepStatus(confidenceFloor >= MIN_CONFIDENCE, confidenceFloor >= 0.75);

  const steps: AuditTraceStep[] = [
    {
      sequence: 1,
      stepName: 'Debt service coverage ratio',
      formulaPattern: 'cashFlow / annualDebtService',
      expression: `${formatCurrency(application.cashFlow.value)} / ${formatCurrency(application.annualDebtService.value)}`,
      result: Number(dscr.toFixed(3)),
      status: dscrStatus,
      thresholdCondition: `DSCR >= ${MIN_DSCR}`,
      rationale: dscrStatus === 'PASS' ? 'Repayment coverage satisfies institutional SBA floor.' : 'Coverage is below underwriting policy floor and requires escalation.',
    },
    {
      sequence: 2,
      stepName: 'Credit score floor',
      formulaPattern: 'creditScore >= minimumCreditScore',
      expression: `${application.creditScore.value} >= ${MIN_CREDIT_SCORE}`,
      result: application.creditScore.value,
      status: creditStatus,
      thresholdCondition: `Credit score >= ${MIN_CREDIT_SCORE}`,
      rationale: creditStatus === 'PASS' ? 'Guarantor credit profile clears minimum risk screen.' : 'Credit score is beneath policy floor or near the warning band.',
    },
    {
      sequence: 3,
      stepName: 'Affiliate size threshold',
      formulaPattern: 'affiliateRevenue <= industrySizeThreshold',
      expression: `${formatCurrency(application.affiliateRevenue.value)} <= ${formatCurrency(application.industrySizeThreshold.value)}`,
      result: affiliatePass,
      status: affiliateStatus,
      thresholdCondition: 'Affiliate aggregation must remain inside applicable SBA size standard.',
      rationale: affiliateStatus === 'PASS' ? 'Affiliate revenue remains inside declared industry threshold.' : 'Affiliate aggregation may exceed SBA size eligibility boundaries.',
    },
    {
      sequence: 4,
      stepName: 'Parsed-data confidence boundary',
      formulaPattern: 'min(variable.confidence[]) >= confidenceFloor',
      expression: `${confidenceFloor.toFixed(2)} >= ${MIN_CONFIDENCE}`,
      result: Number(confidenceFloor.toFixed(3)),
      status: confidenceStatus,
      thresholdCondition: `Minimum parser confidence >= ${MIN_CONFIDENCE}`,
      rationale: confidenceStatus === 'PASS' ? 'All critical parsed variables clear confidence boundary.' : 'One or more parsed values requires human verification before reliance.',
    },
  ];

  const variablesUsed: AuditVariableUsed[] = [
    variableFromParsedField('creditScore', 'Credit Score', 'integer', application.creditScore),
    variableFromParsedField('cashFlow', 'Cash Flow', 'currency', application.cashFlow),
    variableFromParsedField('annualDebtService', 'Annual Debt Service', 'currency', application.annualDebtService),
    variableFromParsedField('dscr', 'Debt Service Coverage Ratio', 'ratio', application.dscr),
    variableFromParsedField('affiliateRevenue', 'Affiliate Revenue', 'currency', application.affiliateRevenue),
    variableFromParsedField('industrySizeThreshold', 'Industry Size Threshold', 'currency', application.industrySizeThreshold),
  ];

  return {
    id: traceId,
    applicationId: application.id,
    triggeredBy,
    engineVersion: ENGINE_VERSION,
    createdAt: Timestamp.now(),
    executionTimeMs: Date.now() - startedAt,
    finalStatus: deriveFinalStatus(steps, variablesUsed),
    steps,
    variablesUsed,
  };
}

export const executeUnderwritingTrace = onCall<ExecuteUnderwritingRequest>(
  { region: 'us-central1', cors: true, enforceAppCheck: true },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Authentication is required.');
    }

    requireUnderwriterRole(request.auth.token.roles ?? request.auth.token.role);

    const applicationId = request.data.applicationId;
    if (!applicationId || typeof applicationId !== 'string') {
      throw new HttpsError('invalid-argument', 'applicationId is required.');
    }

    const startedAt = Date.now();
    const db = getFirestore();
    const applicationRef = db.collection('applications').doc(applicationId);
    const applicationSnap = await applicationRef.get();

    if (!applicationSnap.exists) {
      throw new HttpsError('not-found', 'Application was not found.');
    }

    const application = buildApplicationState(applicationId, applicationSnap.data() ?? {});
    const traceRef = applicationRef.collection('auditTraces').doc();
    const trace = buildTrace(application, request.auth.uid, traceRef.id, startedAt);

    await db.runTransaction(async (transaction) => {
      transaction.create(traceRef, trace);
      transaction.update(applicationRef, {
        lastAuditTraceId: trace.id,
        lastAuditTraceStatus: trace.finalStatus,
        lastAuditTraceCreatedAt: trace.createdAt,
        updatedAt: FieldValue.serverTimestamp(),
      });
    });

    return trace;
  },
);
