import { test, expect } from '@playwright/test';
import {
  loadValidationDataset,
  resolveExpectedMessage,
  resolveInput,
} from '../../utils/test-data-loader';
import { assertValidDataset, ValidationDatasetError } from '../../utils/validation-dataset';

/**
 * FRAMEWORK-ONLY proof test for the Phase 6 data-driven layer. Pure Node +
 * the project's existing utilities — NO UI, NO authentication, NO remote API,
 * NO application data creation. Lives in the `framework` Playwright project
 * (leading-underscore filename) so it never triggers per-worker login. Tagged
 * @framework-only so the @smoke/@sanity/@regression grep scripts skip it.
 *
 * It verifies only the dataset infrastructure: JSON loads, typed cases are
 * returned, bad files/rows fail clearly, and message-key / dynamic-input
 * resolution work against the existing constants.ts / random-data.ts.
 */

const SHIPPED_DATASETS = [
  'Masters/customer.validation.json',
  'Masters/product.validation.json',
  'Masters/supplier.validation.json',
  'Masters/customer-advance.validation.json',
  'Masters/lookup-common.validation.json',
  'Banking/bank-information.validation.json',
  'Setup/user-profile.validation.json',
  'Setup/company-profile.validation.json',
];

test.describe('Phase 6 data-driven loader @framework-only', () => {
  test('loads a real dataset and returns typed cases', async () => {
    const ds = loadValidationDataset('Masters/customer.validation.json');
    expect(ds.module).toBe('Customer');
    expect(ds.cases.length).toBeGreaterThan(0);
    for (const c of ds.cases) {
      expect(c.id.length).toBeGreaterThan(0);
      expect(c.field.length).toBeGreaterThan(0);
      expect(['valid', 'invalid']).toContain(c.expectedResult);
    }
  });

  test('throws a clear error for a missing dataset file', async () => {
    expect(() => loadValidationDataset('Masters/does-not-exist.validation.json')).toThrow(/not found/i);
  });

  test('refuses to load outside the TestData root', async () => {
    expect(() => loadValidationDataset('../../package.json')).toThrow(ValidationDatasetError);
  });

  test('rejects a dataset row missing a required field', async () => {
    const bad = {
      module: 'X',
      form: 'Y',
      cases: [{ id: 'R1', module: 'X', form: 'Y', field: 'F', fieldType: 'text', expectedResult: 'invalid' }],
    };
    expect(() => assertValidDataset(bad, 'in-memory')).toThrow(/Row: R1[\s\S]*Missing: caseType/);
  });

  test('rejects an unknown caseType', async () => {
    const bad = {
      module: 'X',
      form: 'Y',
      cases: [
        { id: 'R1', module: 'X', form: 'Y', field: 'F', fieldType: 'text', caseType: 'not-real', expectedResult: 'invalid' },
      ],
    };
    expect(() => assertValidDataset(bad, 'in-memory')).toThrow(/Unknown caseType: not-real/);
  });

  test('rejects an invalid expectedResult', async () => {
    const bad = {
      module: 'X',
      form: 'Y',
      cases: [
        { id: 'R1', module: 'X', form: 'Y', field: 'F', fieldType: 'text', caseType: 'required', expectedResult: 'maybe' },
      ],
    };
    expect(() => assertValidDataset(bad, 'in-memory')).toThrow(/expectedResult must be/);
  });

  test('rejects duplicate row ids', async () => {
    const row = { module: 'X', form: 'Y', field: 'F', fieldType: 'text', caseType: 'required', expectedResult: 'invalid' };
    const bad = { module: 'X', form: 'Y', cases: [{ id: 'DUP', ...row }, { id: 'DUP', ...row }] };
    expect(() => assertValidDataset(bad, 'in-memory')).toThrow(/Duplicate row id: DUP/);
  });

  test('resolves an expectedMessageKey to the existing constant', async () => {
    expect(resolveExpectedMessage('customer.telephoneRequired')).toBe('Telephone No. is required.');
    expect(resolveExpectedMessage('supplier.addressRequired')).toBe('Address is required.');
    expect(resolveExpectedMessage('api.duplicateDataExists')).toBe('Data Already Exist!');
  });

  test('throws for an unknown message key (never invents text)', async () => {
    expect(() => resolveExpectedMessage('customer.doesNotExist')).toThrow(/Unknown message/);
    expect(() => resolveExpectedMessage('nosuchgroup.whatever')).toThrow(/Unknown message group/);
    expect(() => resolveExpectedMessage('malformedkey')).toThrow(/Invalid expectedMessageKey/);
  });

  test('resolves dynamic input tokens via random-data; passes literals through', async () => {
    const code = resolveInput({ generator: 'uniqueCode', arg: 'TEST' });
    expect(typeof code).toBe('string');
    expect(code as string).toMatch(/^AUTO_TEST_\d{14}_[0-9a-f]{4}$/);

    const phone = resolveInput({ generator: 'randomData.phone11Digit' });
    expect(phone as string).toMatch(/^01\d{9}$/);

    expect(resolveInput('plain-literal')).toBe('plain-literal');
    expect(resolveInput(42)).toBe(42);
    expect(resolveInput(undefined)).toBeUndefined();
  });

  test('every expectedMessageKey in every shipped dataset resolves', async () => {
    for (const rel of SHIPPED_DATASETS) {
      const ds = loadValidationDataset(rel);
      for (const c of ds.cases) {
        if (c.expectedMessageKey) {
          expect(() => resolveExpectedMessage(c.expectedMessageKey as string), `${rel} :: ${c.id}`).not.toThrow();
        }
      }
    }
  });
});
