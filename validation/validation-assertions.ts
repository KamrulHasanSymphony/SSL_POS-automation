/**
 * Phase 7 — assertion logic. Pure (no Playwright): compares actual adapter
 * output against the case's expectation and throws a plain Error on mismatch.
 * Expected message text is ALWAYS resolved from utils/constants.ts via
 * resolveExpectedMessage() — never duplicated here.
 */
import { FieldValidationCase } from '../utils/validation-dataset';
import { resolveExpectedMessage } from '../utils/test-data-loader';
import { AssertionMode } from './validation-adapter';

export class ValidationAssertionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationAssertionError';
  }
}

/**
 * Chooses the assertion mode from the case shape:
 *   expectedResult 'valid'               -> ACCEPTED
 *   'invalid' + expectedMessageKey       -> MESSAGE_EXACT
 *   'invalid' + no message key           -> SUBMISSION_BLOCKED
 * (MESSAGE_PATTERN / CUSTOM are available for adapters that opt in explicitly.)
 */
export function resolveAssertionMode(testCase: FieldValidationCase): AssertionMode {
  if (testCase.expectedResult === 'valid') return 'ACCEPTED';
  if (testCase.expectedMessageKey) return 'MESSAGE_EXACT';
  return 'SUBMISSION_BLOCKED';
}

/** Asserts the actual validation message equals the resolved expected constant. */
export function assertMessageExact(actual: string | null, testCase: FieldValidationCase): void {
  if (!testCase.expectedMessageKey) {
    throw new ValidationAssertionError(`Case ${testCase.id}: MESSAGE_EXACT requires an expectedMessageKey.`);
  }
  const expected = resolveExpectedMessage(testCase.expectedMessageKey);
  const got = (actual ?? '').trim();
  if (got !== expected) {
    throw new ValidationAssertionError(
      `Case ${testCase.id}: expected message "${expected}" but got "${got}".`
    );
  }
}

/** Asserts the actual message matches a pattern (MESSAGE_PATTERN mode). */
export function assertMessagePattern(actual: string | null, pattern: RegExp, testCase: FieldValidationCase): void {
  const got = (actual ?? '').trim();
  if (!pattern.test(got)) {
    throw new ValidationAssertionError(
      `Case ${testCase.id}: message "${got}" did not match ${pattern.toString()}.`
    );
  }
}

/** Asserts submission was blocked (invalid case with no exact message). */
export function assertSubmissionBlocked(blocked: boolean, testCase: FieldValidationCase): void {
  if (!blocked) {
    throw new ValidationAssertionError(
      `Case ${testCase.id}: expected submission to be BLOCKED (invalid input) but it was not.`
    );
  }
}
