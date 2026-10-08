import { test, expect } from '@playwright/test';
import { FieldValidationCase } from '../../utils/validation-dataset';
import { loadValidationDataset } from '../../utils/test-data-loader';
import { runValidationCase, classifyCase } from '../../validation/validation-runner';
import { FakeValidationAdapter } from '../../validation/fake-validation-adapter';
import {
  filterValidationCases,
  summarizeDatasetPlan,
  isDbDependent,
} from '../../validation/validation-filter';
import {
  buildValidationTestTitle,
  buildCaseDiagnostics,
  formatDiagnostics,
  isSensitiveField,
} from '../../validation/validation-diagnostics';
import { resolveAssertionMode } from '../../validation/validation-assertions';
import { DbProviderRegistry } from '../../data-providers/input-source-resolver';
import {
  FakeCustomerDataProvider,
  FakeCustomerGroupDataProvider,
} from '../../data-providers/customer-db-provider';

/**
 * FRAMEWORK-ONLY proof for the Phase 7 reusable validation framework. NO UI,
 * NO auth, NO real DB, NO API, NO network — a FakeValidationAdapter and fake DB
 * providers stand in. Verifies the runner, adapter contract, assertion modes,
 * filters, DB-aware input resolution, blocked-case handling, and diagnostics.
 */

const fakeRegistry: DbProviderRegistry = {
  customer: new FakeCustomerDataProvider(),
  customerGroup: new FakeCustomerGroupDataProvider(),
};

function makeCase(over: Partial<FieldValidationCase>): FieldValidationCase {
  return {
    id: 'X-001',
    module: 'Customer',
    form: 'Create',
    field: 'Name',
    fieldType: 'text',
    caseType: 'required',
    expectedResult: 'invalid',
    ...over,
  };
}

test.describe('Phase 7 validation framework @framework-only', () => {
  test('1. literal input resolves and reaches the adapter', async () => {
    const adapter = new FakeValidationAdapter();
    const res = await runValidationCase({
      testCase: makeCase({ id: 'LIT-1', caseType: 'special-character', input: "O'Brien", expectedResult: 'valid' }),
      adapter,
    });
    expect(res.status).toBe('RUNNABLE');
    expect(adapter.lastValue()).toBe("O'Brien");
  });

  test('2. runtime generator input resolves', async () => {
    const adapter = new FakeValidationAdapter();
    await runValidationCase({
      testCase: makeCase({
        id: 'GEN-1', field: 'TelephoneNo', caseType: 'valid-format',
        input: { generator: 'randomData.phone11Digit' }, expectedResult: 'valid',
      }),
      adapter,
    });
    expect(adapter.lastValue()).toMatch(/^01\d{9}$/);
  });

  test('3. DB inputSource resolves via fake provider', async () => {
    const adapter = new FakeValidationAdapter();
    const res = await runValidationCase({
      testCase: makeCase({
        id: 'DB-1', field: 'CustomerGroupId', fieldType: 'combobox', caseType: 'valid-format',
        inputSource: { type: 'database', provider: 'customerGroup', method: 'getAnyActiveCustomerGroup' },
        expectedResult: 'valid', tags: ['needs-db'],
      }),
      adapter,
      providerRegistry: fakeRegistry,
    });
    expect(res.status).toBe('RUNNABLE');
    expect((adapter.lastValue() as { id: number }).id).toBe(5);
  });

  test('4. DB inputSource WITHOUT registry is BLOCKED_DB (not a failure)', async () => {
    const adapter = new FakeValidationAdapter();
    const res = await runValidationCase({
      testCase: makeCase({
        id: 'DB-2', field: 'CustomerGroupId', fieldType: 'combobox', caseType: 'valid-format',
        inputSource: { type: 'database', provider: 'customerGroup', method: 'getAnyActiveCustomerGroup' },
        expectedResult: 'valid',
      }),
      adapter,
    });
    expect(res.status).toBe('BLOCKED_DB');
    expect(adapter.opened).toBe(0); // short-circuited, no interaction, no fake backfill
  });

  test('5. MESSAGE_EXACT passes against resolved constant', async () => {
    const adapter = new FakeValidationAdapter({ validationMessage: 'Telephone No. is required.' });
    const res = await runValidationCase({
      testCase: makeCase({ id: 'MSG-1', field: 'TelephoneNo', caseType: 'required', expectedMessageKey: 'customer.telephoneRequired' }),
      adapter,
    });
    expect(res.assertionMode).toBe('MESSAGE_EXACT');
  });

  test('6. wrong validation message fails with Case-ID-led diagnostics', async () => {
    const adapter = new FakeValidationAdapter({ validationMessage: 'Something else entirely' });
    await expect(
      runValidationCase({
        testCase: makeCase({ id: 'MSG-FAIL-1', field: 'TelephoneNo', expectedMessageKey: 'customer.telephoneRequired' }),
        adapter,
      })
    ).rejects.toThrow(/caseId=MSG-FAIL-1/);
  });

  test('7. ACCEPTED path (valid) passes', async () => {
    const adapter = new FakeValidationAdapter();
    const res = await runValidationCase({
      testCase: makeCase({ id: 'ACC-1', caseType: 'valid-format', input: 'Valid Name', expectedResult: 'valid' }),
      adapter,
    });
    expect(res.assertionMode).toBe('ACCEPTED');
  });

  test('8. SUBMISSION_BLOCKED path: passes when blocked, fails when not', async () => {
    const blockedCase = makeCase({ id: 'SB-1', field: 'Name', caseType: 'whitespace', input: '   ' });
    const okAdapter = new FakeValidationAdapter({ submissionBlocked: true });
    expect((await runValidationCase({ testCase: blockedCase, adapter: okAdapter })).assertionMode).toBe('SUBMISSION_BLOCKED');

    const notBlocked = new FakeValidationAdapter({ submissionBlocked: false });
    await expect(runValidationCase({ testCase: makeCase({ id: 'SB-2', caseType: 'whitespace' }), adapter: notBlocked })).rejects.toThrow(/BLOCKED/);
  });

  test('9. runtime-verification filtering excludes flagged cases', async () => {
    const ds = { module: 'M', form: 'F', cases: [
      makeCase({ id: 'R1', tags: ['needs-runtime-verification'] }),
      makeCase({ id: 'R2' }),
    ] };
    expect(filterValidationCases(ds, { includeRuntimeVerification: false }).map((c) => c.id)).toEqual(['R2']);
  });

  test('10. API-dependent filtering excludes needs-api cases', async () => {
    const ds = { module: 'M', form: 'F', cases: [
      makeCase({ id: 'A1', caseType: 'duplicate', tags: ['needs-api'] }),
      makeCase({ id: 'A2' }),
    ] };
    expect(filterValidationCases(ds, { includeApiDependent: false }).map((c) => c.id)).toEqual(['A2']);
  });

  test('11. DB-dependent filtering excludes inputSource/needs-db cases', async () => {
    const ds = { module: 'M', form: 'F', cases: [
      makeCase({ id: 'D1', inputSource: { type: 'database', provider: 'customer', method: 'getAnyActiveCustomerName' } }),
      makeCase({ id: 'D2', tags: ['needs-db'] }),
      makeCase({ id: 'D3' }),
    ] };
    expect(filterValidationCases(ds, { includeDbDependent: false }).map((c) => c.id)).toEqual(['D3']);
  });

  test('12. priority filtering (P0)', async () => {
    const ds = { module: 'M', form: 'F', cases: [
      makeCase({ id: 'P0a', priority: 'P0' }),
      makeCase({ id: 'P1a', priority: 'P1' }),
    ] };
    expect(filterValidationCases(ds, { priorities: ['P0'] }).map((c) => c.id)).toEqual(['P0a']);
  });

  test('13. caseType filtering', async () => {
    const ds = { module: 'M', form: 'F', cases: [
      makeCase({ id: 'C1', caseType: 'required' }),
      makeCase({ id: 'C2', caseType: 'unicode-bangla', input: 'নাম', expectedResult: 'valid' }),
    ] };
    expect(filterValidationCases(ds, { caseTypes: ['unicode-bangla'] }).map((c) => c.id)).toEqual(['C2']);
  });

  test('14. field filtering', async () => {
    const ds = { module: 'M', form: 'F', cases: [
      makeCase({ id: 'F1', field: 'TelephoneNo' }),
      makeCase({ id: 'F2', field: 'Email' }),
    ] };
    expect(filterValidationCases(ds, { fields: ['TelephoneNo'] }).map((c) => c.id)).toEqual(['F1']);
  });

  test('15. cleanup hook runs for a runnable case, not for a blocked one', async () => {
    const ranAdapter = new FakeValidationAdapter();
    await runValidationCase({ testCase: makeCase({ id: 'CL-1', caseType: 'valid-format', input: 'x', expectedResult: 'valid' }), adapter: ranAdapter });
    expect(ranAdapter.cleaned).toBe(1);

    const blockedAdapter = new FakeValidationAdapter();
    await runValidationCase({
      testCase: makeCase({ id: 'CL-2', inputSource: { type: 'database', provider: 'customer', method: 'getAnyActiveCustomerName' }, caseType: 'duplicate' }),
      adapter: blockedAdapter,
    });
    expect(blockedAdapter.cleaned).toBe(0);
  });

  test('16. diagnostics redact password-type field values', async () => {
    const pwdCase = makeCase({ id: 'PWD-1', field: 'ConfirmPassword', fieldType: 'password', caseType: 'dependent-field' });
    expect(isSensitiveField(pwdCase)).toBe(true);
    const diag = buildCaseDiagnostics(pwdCase, 'RUNNABLE', 'SuperSecretValue');
    expect(diag.resolvedInput).toBe('[REDACTED]');
    expect(formatDiagnostics(diag)).not.toContain('SuperSecretValue');
  });

  test('17. deterministic test title', async () => {
    const c = makeCase({ id: 'CUS-TEL-001', field: 'TelephoneNo', caseType: 'required', expectedResult: 'invalid' });
    expect(buildValidationTestTitle(c)).toBe('[CUS-TEL-001] Customer :: TelephoneNo :: required :: invalid');
  });

  test('18. classifyCase honours auth/api/db gating', async () => {
    const dbCase = makeCase({ id: 'CZ-1', inputSource: { type: 'database', provider: 'customer', method: 'getAnyActiveCustomerName' }, caseType: 'duplicate' });
    expect(classifyCase({ testCase: dbCase, adapter: new FakeValidationAdapter() })).toBe('BLOCKED_DB');

    const apiCase = makeCase({ id: 'CZ-2', caseType: 'duplicate', tags: ['needs-api'] });
    expect(classifyCase({ testCase: apiCase, adapter: new FakeValidationAdapter(), env: { apiAvailable: false } })).toBe('BLOCKED_API');

    const anyCase = makeCase({ id: 'CZ-3' });
    expect(classifyCase({ testCase: anyCase, adapter: new FakeValidationAdapter(), env: { authAvailable: false } })).toBe('BLOCKED_AUTH');

    const rv = makeCase({ id: 'CZ-4', tags: ['needs-runtime-verification'] });
    expect(classifyCase({ testCase: rv, adapter: new FakeValidationAdapter() })).toBe('NEEDS_RUNTIME_VERIFICATION');
  });

  test('19. real CUS-GRP-002 resolves a CustomerGroup via fake provider', async () => {
    const ds = loadValidationDataset('Masters/customer.validation.json');
    const grp = ds.cases.find((c) => c.id === 'CUS-GRP-002');
    expect(grp, 'CUS-GRP-002 present').toBeTruthy();
    const adapter = new FakeValidationAdapter();
    const res = await runValidationCase({ testCase: grp!, adapter, providerRegistry: fakeRegistry });
    expect(res.status).toBe('RUNNABLE');
    expect((adapter.lastValue() as { id: number }).id).toBe(5);
  });

  test('20. real CUS-DUP-001 resolves an existing name + asserts duplicate message', async () => {
    const ds = loadValidationDataset('Masters/customer.validation.json');
    const dup = ds.cases.find((c) => c.id === 'CUS-DUP-001');
    expect(dup, 'CUS-DUP-001 present').toBeTruthy();
    expect(resolveAssertionMode(dup!)).toBe('MESSAGE_EXACT');
    const adapter = new FakeValidationAdapter({ validationMessage: 'Data Already Exist!' });
    const res = await runValidationCase({ testCase: dup!, adapter, providerRegistry: fakeRegistry });
    expect(res.status).toBe('RUNNABLE');
    expect(adapter.lastValue()).toBe('Fake Customer One');
  });

  test('21. real customer dataset planning summary (no UI)', async () => {
    const ds = loadValidationDataset('Masters/customer.validation.json');
    const plan = summarizeDatasetPlan(ds);
    expect(plan.total).toBe(ds.cases.length);
    expect(plan.dbDependent).toBeGreaterThanOrEqual(2); // CUS-GRP-002 + CUS-DUP-001
    expect(plan.byPriority['P0']).toBeGreaterThanOrEqual(1);
    expect(ds.cases.filter(isDbDependent).length).toBe(plan.dbDependent);
    expect(plan.runnableWithoutDbApiRuntime).toBeLessThan(plan.total);
  });
});
