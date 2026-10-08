import { test, expect } from '@playwright/test';
import {
  assertReadOnlySql,
  assertDbConfigReady,
  ReadOnlySqlViolationError,
  DbConfigError,
} from '../../data-providers/db-safety';
import {
  CUSTOMER_QUERIES,
  CUSTOMER_GROUP_QUERIES,
  createCustomerDbProvider,
  FakeCustomerDataProvider,
  FakeCustomerGroupDataProvider,
} from '../../data-providers/customer-db-provider';
import { resolveInputSource, resolveCaseInput, DbProviderRegistry } from '../../data-providers/input-source-resolver';
import { assertValidDataset, FieldValidationCase } from '../../utils/validation-dataset';
import { loadValidationDataset } from '../../utils/test-data-loader';

/**
 * FRAMEWORK-ONLY proof for the Customer DB-driven data layer. NO real database,
 * NO UI, NO authentication, NO remote API — a fake provider stands in. Verifies
 * the read-only guard, config guard, typed DB-source resolution, and that live
 * integration is correctly BLOCKED.
 */

const fakeRegistry: DbProviderRegistry = {
  customer: new FakeCustomerDataProvider(),
  customerGroup: new FakeCustomerGroupDataProvider(),
};

test.describe('Customer DB provider (read-only) @framework-only', () => {
  test('assertReadOnlySql accepts SELECT and all shipped query templates', async () => {
    expect(assertReadOnlySql('SELECT 1')).toBe('SELECT 1');
    for (const q of [...Object.values(CUSTOMER_QUERIES), ...Object.values(CUSTOMER_GROUP_QUERIES)]) {
      expect(() => assertReadOnlySql(q)).not.toThrow();
    }
  });

  test('assertReadOnlySql rejects every write / DDL keyword and statement stacking', async () => {
    const writes = [
      "INSERT INTO Customers (Name) VALUES ('x')",
      'UPDATE Customers SET Name = 1',
      'DELETE FROM Customers',
      'MERGE Customers',
      'TRUNCATE TABLE Customers',
      'DROP TABLE Customers',
      'ALTER TABLE Customers ADD X int',
      'CREATE TABLE X (a int)',
      'EXEC sp_GetCustomerList',
      'SELECT 1; DROP TABLE Customers',
    ];
    for (const w of writes) {
      expect(() => assertReadOnlySql(w), w).toThrow(ReadOnlySqlViolationError);
    }
  });

  test('assertDbConfigReady refuses incomplete or non-readonly configuration', async () => {
    expect(() => assertDbConfigReady({})).toThrow(/Missing: DB_SERVER/);
    expect(() =>
      assertDbConfigReady({ DB_SERVER: 's', DB_DATABASE: 'd', DB_USERNAME: 'u', DB_PASSWORD: 'p' })
    ).toThrow(/DB_READONLY must be explicitly/);
    const cfg = assertDbConfigReady({
      DB_SERVER: 's',
      DB_DATABASE: 'd',
      DB_USERNAME: 'u',
      DB_PASSWORD: 'p',
      DB_READONLY: 'true',
    });
    expect(cfg.server).toBe('s');
    expect(cfg.database).toBe('d');
    expect(cfg.readonly).toBe(true);
    expect(cfg.port).toBe(1433);
  });

  test('createCustomerDbProvider refuses to connect (BLOCKED) with and without config', async () => {
    expect(() => createCustomerDbProvider(undefined, {})).toThrow(DbConfigError);
    expect(() =>
      createCustomerDbProvider(undefined, {
        DB_SERVER: 's',
        DB_DATABASE: 'd',
        DB_USERNAME: 'u',
        DB_PASSWORD: 'p',
        DB_READONLY: 'true',
      })
    ).toThrow(/BLOCKED — CUSTOMER DB QUERY SCOPE REQUIRES VERIFIED COMPANY\/BRANCH/);
  });

  test('fake providers return deterministic records via intent methods', async () => {
    const c = await fakeRegistry.customer.getAnyActiveCustomer();
    expect(c.id).toBe(1001);
    expect(await fakeRegistry.customer.getAnyActiveCustomerName()).toBe('Fake Customer One');
    expect(await fakeRegistry.customer.customerExistsByName('Fake Customer Two')).toBe(true);
    expect(await fakeRegistry.customer.customerExistsByName('Nope')).toBe(false);
    expect(await fakeRegistry.customer.getCustomerById(9999)).toBeNull();
    const g = await fakeRegistry.customerGroup.getAnyActiveCustomerGroup();
    expect(g.id).toBe(5);
  });

  test('resolveInputSource dispatches allow-listed tokens to the fake providers', async () => {
    const name = await resolveInputSource(
      { type: 'database', provider: 'customer', method: 'getAnyActiveCustomerName' },
      fakeRegistry
    );
    expect(name).toBe('Fake Customer One');
    const group = await resolveInputSource(
      { type: 'database', provider: 'customerGroup', method: 'getAnyActiveCustomerGroup' },
      fakeRegistry
    );
    expect((group as { id: number }).id).toBe(5);
  });

  test('resolveCaseInput: literal/generator need no DB; DB-sourced needs a registry', async () => {
    const literalCase: FieldValidationCase = {
      id: 'T1', module: 'Customer', form: 'Create', field: 'Name', fieldType: 'text',
      caseType: 'special-character', input: 'O\'Brien', expectedResult: 'valid',
    };
    expect(await resolveCaseInput(literalCase)).toBe("O'Brien");

    const genCase: FieldValidationCase = {
      id: 'T2', module: 'Customer', form: 'Create', field: 'TelephoneNo', fieldType: 'text',
      caseType: 'valid-format', input: { generator: 'randomData.phone11Digit' } as unknown, expectedResult: 'valid',
    };
    expect(await resolveCaseInput(genCase)).toMatch(/^01\d{9}$/);

    const dbCase: FieldValidationCase = {
      id: 'T3', module: 'Customer', form: 'Create', field: 'CustomerGroupId', fieldType: 'combobox',
      caseType: 'valid-format',
      inputSource: { type: 'database', provider: 'customerGroup', method: 'getAnyActiveCustomerGroup' },
      expectedResult: 'valid',
    };
    await expect(resolveCaseInput(dbCase)).rejects.toThrow(/BLOCKED/);
    const resolved = await resolveCaseInput(dbCase, fakeRegistry);
    expect((resolved as { id: number }).id).toBe(5);
  });

  test('dataset validator rejects raw SQL and unknown provider/method in inputSource', async () => {
    const withSql = {
      module: 'M', form: 'F',
      cases: [{ id: 'S1', module: 'M', form: 'F', field: 'X', fieldType: 'text', caseType: 'duplicate', expectedResult: 'invalid', inputSource: { sql: 'SELECT 1' } }],
    };
    expect(() => assertValidDataset(withSql, 'in-memory')).toThrow(/raw SQL is not allowed/);

    const badMethod = {
      module: 'M', form: 'F',
      cases: [{ id: 'S2', module: 'M', form: 'F', field: 'X', fieldType: 'text', caseType: 'duplicate', expectedResult: 'invalid', inputSource: { type: 'database', provider: 'customer', method: 'dropEverything' } }],
    };
    expect(() => assertValidDataset(badMethod, 'in-memory')).toThrow(/not allow-listed/);
  });

  test('shipped customer dataset: every inputSource row is allow-listed', async () => {
    const ds = loadValidationDataset('Masters/customer.validation.json');
    const dbRows = ds.cases.filter((c) => c.inputSource);
    expect(dbRows.length).toBeGreaterThan(0);
    for (const row of dbRows) {
      expect(['customer', 'customerGroup']).toContain(row.inputSource!.provider);
    }
  });
});
