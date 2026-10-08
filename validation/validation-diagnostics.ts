/**
 * Phase 7 — diagnostics: deterministic test titles and a safe, structured
 * failure diagnostic. NEVER logs secrets (DB password / connection string,
 * auth password, API token, cookie). Password-type field inputs are redacted.
 */
import { FieldValidationCase } from '../utils/validation-dataset';
import { ExecutionStatus } from './validation-adapter';

const REDACTED = '[REDACTED]';

/** True for fields whose value must never be logged. */
export function isSensitiveField(testCase: FieldValidationCase): boolean {
  if (testCase.fieldType === 'password') return true;
  return /password|token|secret|cookie|apikey|api_key/i.test(testCase.field);
}

/** Returns a loggable form of a case's input value, redacting sensitive fields. */
export function redactValue(testCase: FieldValidationCase, value: unknown): string {
  if (isSensitiveField(testCase)) return REDACTED;
  if (value === undefined) return '(none)';
  if (value === null) return '(null)';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

/** `[CUS-TEL-001] Customer :: TelephoneNo :: required :: invalid` */
export function buildValidationTestTitle(testCase: FieldValidationCase): string {
  return `[${testCase.id}] ${testCase.module} :: ${testCase.field} :: ${testCase.caseType} :: ${testCase.expectedResult}`;
}

export interface CaseDiagnostics {
  caseId: string;
  module: string;
  form: string;
  field: string;
  caseType: string;
  inputSourceType: 'literal' | 'generator' | 'database' | 'none';
  /** provider/method ONLY for DB-backed cases — never SQL/connection details. */
  dbProvider?: string;
  dbMethod?: string;
  expectedResult: string;
  expectedMessageKey?: string;
  priority?: string;
  executionStatus: ExecutionStatus;
  /** Redacted; sensitive fields show [REDACTED]. */
  resolvedInput?: string;
  note?: string;
}

function classifyInputSourceType(testCase: FieldValidationCase): CaseDiagnostics['inputSourceType'] {
  if (testCase.inputSource) return 'database';
  if (testCase.input && typeof testCase.input === 'object' && 'generator' in (testCase.input as object)) {
    return 'generator';
  }
  if (testCase.input !== undefined) return 'literal';
  return 'none';
}

/** Builds the structured diagnostic for a case (safe to log / attach to a failure). */
export function buildCaseDiagnostics(
  testCase: FieldValidationCase,
  executionStatus: ExecutionStatus,
  resolvedValue?: unknown,
  note?: string
): CaseDiagnostics {
  const diag: CaseDiagnostics = {
    caseId: testCase.id,
    module: testCase.module,
    form: testCase.form,
    field: testCase.field,
    caseType: testCase.caseType,
    inputSourceType: classifyInputSourceType(testCase),
    expectedResult: testCase.expectedResult,
    expectedMessageKey: testCase.expectedMessageKey,
    priority: testCase.priority,
    executionStatus,
    note,
  };
  if (testCase.inputSource) {
    diag.dbProvider = testCase.inputSource.provider;
    diag.dbMethod = testCase.inputSource.method;
  }
  if (resolvedValue !== undefined || diag.inputSourceType !== 'none') {
    diag.resolvedInput = redactValue(testCase, resolvedValue);
  }
  return diag;
}

/** One-line, secret-free rendering of a diagnostic, always leading with the Case ID. */
export function formatDiagnostics(diag: CaseDiagnostics): string {
  const parts = [
    `caseId=${diag.caseId}`,
    `module=${diag.module}`,
    `form=${diag.form}`,
    `field=${diag.field}`,
    `caseType=${diag.caseType}`,
    `inputSource=${diag.inputSourceType}`,
    diag.dbProvider ? `provider=${diag.dbProvider}` : undefined,
    diag.dbMethod ? `method=${diag.dbMethod}` : undefined,
    `expected=${diag.expectedResult}`,
    diag.expectedMessageKey ? `messageKey=${diag.expectedMessageKey}` : undefined,
    diag.priority ? `priority=${diag.priority}` : undefined,
    `status=${diag.executionStatus}`,
    diag.resolvedInput !== undefined ? `input=${diag.resolvedInput}` : undefined,
    diag.note ? `note=${diag.note}` : undefined,
  ].filter((p): p is string => p !== undefined);
  return parts.join(' | ');
}
