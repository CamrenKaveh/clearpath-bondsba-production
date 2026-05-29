export type AuditTraceStatus = 'PASS' | 'WARN' | 'FAIL';
export type AuditTraceFinalStatus = AuditTraceStatus | 'REQUIRES_REVIEW';
export type AuditVariableFormat = 'currency' | 'number' | 'percentage' | 'ratio' | 'integer' | 'text' | 'boolean';
export type ApplicationPipelineStatus = 'Draft' | 'Under Review' | 'Approved' | 'Action Required' | 'Declined';

export interface AuditVariableSource {
  documentId: string;
  documentName: string;
  fieldName: string;
  verifiedBy: string | null;
}

export interface AuditVariableUsed {
  key: string;
  label: string;
  value: string | number | boolean | null;
  format: AuditVariableFormat;
  confidence: number;
  source: AuditVariableSource;
}

export interface AuditTraceStep {
  sequence: number;
  stepName: string;
  formulaPattern: string;
  expression: string;
  result: string | number | boolean;
  status: AuditTraceStatus;
  thresholdCondition: string;
  rationale: string;
}

export interface AuditTraceDoc {
  id: string;
  applicationId: string;
  triggeredBy: string;
  engineVersion: string;
  createdAt: unknown;
  executionTimeMs: number;
  finalStatus: AuditTraceFinalStatus;
  steps: AuditTraceStep[];
  variablesUsed: AuditVariableUsed[];
}

export interface AuditTraceTerminalProps {
  trace: AuditTraceDoc;
  documentBasePath?: string;
}
