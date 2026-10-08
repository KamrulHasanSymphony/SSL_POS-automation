/**
 * Phase 7 — in-memory fake ValidationFormAdapter for framework proof tests.
 * Simulates accepted/rejected values, a validation message, blocked submission,
 * and a cleanup hook. It does NOT simulate the POS app — it only records calls
 * and returns configured outcomes so the generic runner can be exercised with
 * NO UI, auth, DB, API, or network.
 */
import { FieldValidationCase } from '../utils/validation-dataset';
import { ValidationFormAdapter } from './validation-adapter';

export interface FakeAdapterScenario {
  /** Returned by getValidationMessage() (MESSAGE_EXACT / MESSAGE_PATTERN cases). */
  validationMessage?: string | null;
  /** Returned by isSubmissionBlocked() (SUBMISSION_BLOCKED cases). */
  submissionBlocked?: boolean;
  /** If set, verifyAccepted() rejects with this (ACCEPTED-failure path). */
  acceptError?: Error;
}

export interface RecordedInteraction {
  field: string;
  value: unknown;
  caseId: string;
}

export class FakeValidationAdapter implements ValidationFormAdapter {
  opened = 0;
  prepared = 0;
  triggered = 0;
  cleaned = 0;
  readonly received: RecordedInteraction[] = [];

  constructor(private readonly scenario: FakeAdapterScenario = {}) {}

  async open(): Promise<void> {
    this.opened += 1;
  }

  async prepareCase(_testCase: FieldValidationCase): Promise<void> {
    this.prepared += 1;
  }

  async setFieldValue(field: string, value: unknown, testCase: FieldValidationCase): Promise<void> {
    this.received.push({ field, value, caseId: testCase.id });
  }

  async triggerValidation(_testCase: FieldValidationCase): Promise<void> {
    this.triggered += 1;
  }

  async getValidationMessage(_field: string, _testCase: FieldValidationCase): Promise<string | null> {
    return this.scenario.validationMessage ?? null;
  }

  async isSubmissionBlocked(_testCase: FieldValidationCase): Promise<boolean> {
    return this.scenario.submissionBlocked ?? false;
  }

  async verifyAccepted(_testCase: FieldValidationCase): Promise<void> {
    if (this.scenario.acceptError) throw this.scenario.acceptError;
  }

  async cleanupCase(_testCase: FieldValidationCase): Promise<void> {
    this.cleaned += 1;
  }

  /** Convenience for assertions: the most recently received value. */
  lastValue(): unknown {
    return this.received.length ? this.received[this.received.length - 1].value : undefined;
  }
}
