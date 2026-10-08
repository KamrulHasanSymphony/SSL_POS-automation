/**
 * Phase 7 — Reusable Validation Framework: adapter contract + shared execution
 * types.
 *
 * A `ValidationFormAdapter` is the ONLY module-specific layer. The generic
 * runner (validation-runner.ts) talks to this interface and never to a Page
 * Object, a selector, a DB provider, or SQL. Each module (Customer, Product, …)
 * implements this against its existing Page Object in a later phase.
 */
import { FieldValidationCase } from '../utils/validation-dataset';

/** Execution status for a single case — a BLOCKED_* status is NOT a test failure. */
export type ExecutionStatus =
  | 'RUNNABLE'
  | 'BLOCKED_AUTH'
  | 'BLOCKED_API'
  | 'BLOCKED_DB'
  | 'NEEDS_RUNTIME_VERIFICATION';

/** How the runner asserts the outcome of a case. */
export type AssertionMode =
  | 'MESSAGE_EXACT'
  | 'MESSAGE_PATTERN'
  | 'SUBMISSION_BLOCKED'
  | 'ACCEPTED'
  | 'CUSTOM';

/**
 * Module-specific interaction contract. Only `open`, `setFieldValue`, and
 * `triggerValidation` are required; the rest are optional so a module can start
 * minimal. Implementations wrap the module's existing Page Object (reusing
 * BasePage helpers: clickSave, confirmDialog, toastr, expectRequiredIndicatorVisible, …).
 */
export interface ValidationFormAdapter {
  /** Navigate to / open a fresh form for a case. */
  open(): Promise<void>;
  /** Optional per-case setup (e.g. select a prerequisite, switch to Create/Edit). */
  prepareCase?(testCase: FieldValidationCase): Promise<void>;
  /** Set the field under test to the resolved value (literal / generated / DB-sourced). */
  setFieldValue(field: string, value: unknown, testCase: FieldValidationCase): Promise<void>;
  /** Submit / blur / otherwise trigger the application's validation. */
  triggerValidation(testCase: FieldValidationCase): Promise<void>;
  /** Read the field's validation message, or null if none is shown. */
  getValidationMessage?(field: string, testCase: FieldValidationCase): Promise<string | null>;
  /** True if submission was blocked (no persistence / still on form). */
  isSubmissionBlocked?(testCase: FieldValidationCase): Promise<boolean>;
  /** Assert the value was accepted (e.g. saved / navigated). Throws on failure. */
  verifyAccepted?(testCase: FieldValidationCase): Promise<void>;
  /** Optional per-case cleanup for anything the case created (UI/API only — never a DB write). */
  cleanupCase?(testCase: FieldValidationCase): Promise<void>;
}
