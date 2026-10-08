/**
 * Phase 7 — generic validation runner. DB-AGNOSTIC, PAGE-SELECTOR-AGNOSTIC,
 * MODULE-AGNOSTIC. It drives a `ValidationFormAdapter` and asserts the outcome;
 * it never imports a DB provider, mssql, raw SQL, or a Page Object. DB values
 * arrive only through resolveCaseInput() + an optional provider registry.
 *
 *   dataset -> filter -> runValidationCase({ testCase, adapter, providerRegistry })
 *
 * A BLOCKED_* status is returned, NOT thrown — a DB case without a provider is
 * BLOCKED_DB, never a FAIL, and never silently backfilled with fake data.
 */
import { FieldValidationCase } from '../utils/validation-dataset';
import { resolveCaseInput, DbProviderRegistry } from '../data-providers/input-source-resolver';
import { ValidationFormAdapter, ExecutionStatus, AssertionMode } from './validation-adapter';
import {
  resolveAssertionMode,
  assertMessageExact,
  assertSubmissionBlocked,
} from './validation-assertions';
import {
  buildCaseDiagnostics,
  formatDiagnostics,
  CaseDiagnostics,
} from './validation-diagnostics';
import { isDbDependent, isApiDependent, needsRuntimeVerification } from './validation-filter';

export interface RunEnvironment {
  /** Pass false to force BLOCKED_AUTH (e.g. real-UI planning while auth is down). Default: not auth-gated. */
  authAvailable?: boolean;
  /** Pass false to force BLOCKED_API for API-dependent cases. Default: true. */
  apiAvailable?: boolean;
}

export interface RunValidationCaseArgs {
  testCase: FieldValidationCase;
  adapter: ValidationFormAdapter;
  providerRegistry?: DbProviderRegistry;
  env?: RunEnvironment;
}

export interface ValidationRunResult {
  caseId: string;
  status: ExecutionStatus;
  assertionMode?: AssertionMode;
  resolvedValue?: unknown;
  diagnostics: CaseDiagnostics;
}

/**
 * Decides the execution status BEFORE touching the adapter. Blocking statuses
 * short-circuit the run. NEEDS_RUNTIME_VERIFICATION still executes (it is an
 * advisory, not a block).
 */
export function classifyCase(args: RunValidationCaseArgs): ExecutionStatus {
  const { testCase, providerRegistry, env } = args;
  if (isDbDependent(testCase) && !providerRegistry) return 'BLOCKED_DB';
  if (isApiDependent(testCase) && env?.apiAvailable === false) return 'BLOCKED_API';
  if (env?.authAvailable === false) return 'BLOCKED_AUTH';
  if (needsRuntimeVerification(testCase)) return 'NEEDS_RUNTIME_VERIFICATION';
  return 'RUNNABLE';
}

const BLOCKING: ReadonlySet<ExecutionStatus> = new Set<ExecutionStatus>([
  'BLOCKED_DB',
  'BLOCKED_API',
  'BLOCKED_AUTH',
]);

/**
 * Runs one validation case end-to-end against its adapter. Returns a result
 * carrying the execution status and safe diagnostics. Throws (with Case-ID-led
 * diagnostics) only on a genuine assertion/adapter failure of a RUNNABLE case.
 */
export async function runValidationCase(args: RunValidationCaseArgs): Promise<ValidationRunResult> {
  const { testCase, adapter, providerRegistry } = args;
  const status = classifyCase(args);

  if (BLOCKING.has(status)) {
    return {
      caseId: testCase.id,
      status,
      diagnostics: buildCaseDiagnostics(testCase, status, undefined, 'skipped — blocked prerequisite'),
    };
  }

  // Resolve the input (literal / generator / DB inputSource). A DB case without
  // a registry would throw BLOCKED here — classify already caught that, but
  // stay defensive and surface it as BLOCKED_DB rather than a failure.
  let resolvedValue: unknown;
  try {
    resolvedValue = await resolveCaseInput(testCase, providerRegistry);
  } catch (err) {
    if ((err as Error).message.includes('BLOCKED')) {
      return {
        caseId: testCase.id,
        status: 'BLOCKED_DB',
        diagnostics: buildCaseDiagnostics(testCase, 'BLOCKED_DB', undefined, (err as Error).message),
      };
    }
    throw err;
  }

  const mode = resolveAssertionMode(testCase);
  let interacted = false;
  try {
    await adapter.open();
    if (adapter.prepareCase) await adapter.prepareCase(testCase);
    interacted = true;
    await adapter.setFieldValue(testCase.field, resolvedValue, testCase);
    await adapter.triggerValidation(testCase);

    switch (mode) {
      case 'ACCEPTED':
        if (adapter.verifyAccepted) await adapter.verifyAccepted(testCase);
        break;
      case 'MESSAGE_EXACT': {
        const actual = adapter.getValidationMessage
          ? await adapter.getValidationMessage(testCase.field, testCase)
          : null;
        assertMessageExact(actual, testCase);
        break;
      }
      case 'SUBMISSION_BLOCKED': {
        const blocked = adapter.isSubmissionBlocked ? await adapter.isSubmissionBlocked(testCase) : false;
        assertSubmissionBlocked(blocked, testCase);
        break;
      }
      case 'MESSAGE_PATTERN':
      case 'CUSTOM':
        // Reserved for adapters that assert internally in verifyAccepted/triggerValidation.
        break;
    }
  } catch (err) {
    const diag = buildCaseDiagnostics(testCase, status, resolvedValue, `assertion-mode=${mode}`);
    throw new Error(`${(err as Error).message}\n  diagnostics: ${formatDiagnostics(diag)}`);
  } finally {
    if (interacted && adapter.cleanupCase) {
      await adapter.cleanupCase(testCase).catch(() => undefined);
    }
  }

  return {
    caseId: testCase.id,
    status,
    assertionMode: mode,
    resolvedValue,
    diagnostics: buildCaseDiagnostics(testCase, status, resolvedValue, `assertion-mode=${mode}`),
  };
}
