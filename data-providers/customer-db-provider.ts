/**
 * Phase 7 (Customer DB-driven data) — Customer / CustomerGroup read-only DB
 * provider layer.
 *
 * Policy: the POS application database is READ-ONLY from Automation. This layer
 * exposes INTENT-based methods; raw SQL lives here only (never in specs), is
 * SELECT-only, and is guarded by assertReadOnlySql(). WRITES ARE NEVER ISSUED
 * from this provider — Customer CREATE happens through the UI (or the verified
 * POS API), exercising the application's own business rules.
 *
 * SCHEMA IS VERIFIED, NOT GUESSED. Confirmed from the application source
 * (read-only inspection), SQL Server:
 *   Table `Customers`      — Id (PK, IDENTITY), Code, Name, BanglaName,
 *                            CustomerGroupId, CompanyId, BranchId, Address,
 *                            BanglaAddress, TelephoneNo, FaxNo, Email, TINNo,
 *                            BINNo, NIDNo, Comments, IsArchive, IsActive, ...
 *   Table `CustomerGroups` — Id (PK), Code, Name, CompanyId, BranchId,
 *                            Description, Comments, IsArchive, IsActive
 *   Active record          — IsActive = 1 AND IsArchive = 0
 *                            (Delete sets IsArchive = 1, IsActive = 0)
 *   Tenant scope           — CompanyId AND BranchId (MUST be filtered)
 *   Evidence: ShampanPOS_Api/ShampanPOS.Repository/CustomerRepository.cs +
 *             CustomerGroupRepository.cs + DB Master/sp_GetCustomerList.sql
 *
 * LIVE INTEGRATION IS BLOCKED THIS PHASE:
 *   - No read-only DB configuration is present in automation/.env.
 *   - No SQL driver dependency is installed in the Automation project.
 *   - Company/Branch scope cannot be determined because UI authentication is
 *     blocked (invalid credentials) — so queries cannot be safely scoped.
 * Therefore createCustomerDbProvider() refuses to connect and throws a clear
 * BLOCKED error. The interface, typing, query templates, read-only guards, and
 * a fake provider for unit tests are delivered now; the concrete SQL-Server
 * implementation is wired only once a verified read-only credential + the
 * authenticated company/branch scope are available.
 */
import { assertReadOnlySql, assertDbConfigReady } from './db-safety';

/** Minimal Customer shape the tests actually need (NOT the full app model). */
export interface CustomerDbRecord {
  id: number | string;
  name?: string;
  banglaName?: string;
  telephoneNo?: string;
  email?: string;
  address?: string;
  customerGroupId?: number | string;
  companyId?: number | string;
  branchId?: number | string;
}

export interface CustomerGroupDbRecord {
  id: number | string;
  name?: string;
  companyId?: number | string;
  branchId?: number | string;
}

/** Company/Branch scope every query must respect (sourced from the authenticated session). */
export interface TenantScope {
  companyId: number | string;
  branchId: number | string;
}

/** Intent-based read-only Customer access. SQL never leaks out of implementations. */
export interface CustomerDataProvider {
  getAnyActiveCustomer(): Promise<CustomerDbRecord>;
  getCustomerById(id: number | string): Promise<CustomerDbRecord | null>;
  getCustomerForEdit(): Promise<CustomerDbRecord>;
  findCustomerByName(name: string): Promise<CustomerDbRecord | null>;
  customerExistsByName(name: string): Promise<boolean>;
  /** Existing active customer NAME — used to drive duplicate-name negative tests. */
  getAnyActiveCustomerName(): Promise<string>;
}

export interface CustomerGroupDataProvider {
  getAnyActiveCustomerGroup(): Promise<CustomerGroupDbRecord>;
  getCustomerGroupById(id: number | string): Promise<CustomerGroupDbRecord | null>;
}

/**
 * Verified SELECT-only query templates (SQL Server). Parameters (@CompanyId,
 * @BranchId, @Id, @Name) are BOUND at execution — never string-concatenated.
 * Each is validated by assertReadOnlySql() at module load (below), so a stray
 * write keyword here fails fast.
 */
export const CUSTOMER_QUERIES = {
  anyActiveCustomer:
    'SELECT TOP 1 Id, Code, Name, BanglaName, TelephoneNo, Email, Address, CustomerGroupId, CompanyId, BranchId ' +
    'FROM Customers WHERE IsActive = 1 AND IsArchive = 0 AND CompanyId = @CompanyId AND BranchId = @BranchId ORDER BY Id DESC',
  customerById:
    'SELECT Id, Code, Name, BanglaName, TelephoneNo, Email, Address, CustomerGroupId, CompanyId, BranchId ' +
    'FROM Customers WHERE Id = @Id AND CompanyId = @CompanyId AND BranchId = @BranchId',
  findByName:
    'SELECT TOP 1 Id, Code, Name, TelephoneNo, Email, CustomerGroupId, CompanyId, BranchId ' +
    'FROM Customers WHERE Name = @Name AND CompanyId = @CompanyId AND BranchId = @BranchId',
  existsByName:
    'SELECT COUNT(1) AS Cnt FROM Customers WHERE Name = @Name AND CompanyId = @CompanyId AND BranchId = @BranchId',
  anyActiveCustomerName:
    'SELECT TOP 1 Name FROM Customers WHERE IsActive = 1 AND IsArchive = 0 AND Name IS NOT NULL ' +
    'AND CompanyId = @CompanyId AND BranchId = @BranchId ORDER BY Id DESC',
} as const;

export const CUSTOMER_GROUP_QUERIES = {
  anyActiveGroup:
    'SELECT TOP 1 Id, Name, CompanyId, BranchId FROM CustomerGroups ' +
    'WHERE IsActive = 1 AND IsArchive = 0 AND CompanyId = @CompanyId AND BranchId = @BranchId ORDER BY Id DESC',
  groupById:
    'SELECT Id, Name, CompanyId, BranchId FROM CustomerGroups ' +
    'WHERE Id = @Id AND CompanyId = @CompanyId AND BranchId = @BranchId',
} as const;

// Fail fast at load if any template is not read-only.
for (const q of [...Object.values(CUSTOMER_QUERIES), ...Object.values(CUSTOMER_GROUP_QUERIES)]) {
  assertReadOnlySql(q);
}

/**
 * Factory for a LIVE provider. Refuses to connect this phase: validates that a
 * read-only DB config exists, then throws BLOCKED because (a) no SQL driver is
 * wired and (b) company/branch scope needs verified authentication. It never
 * connects to an unknown database or guesses a server/scope.
 */
export function createCustomerDbProvider(
  _scope?: TenantScope,
  env: NodeJS.ProcessEnv = process.env
): CustomerDataProvider & CustomerGroupDataProvider {
  // Throws DbConfigError if config is missing/incomplete (the current state).
  assertDbConfigReady(env);
  throw new Error(
    'BLOCKED — CUSTOMER DB QUERY SCOPE REQUIRES VERIFIED COMPANY/BRANCH. ' +
      'A read-only DB config was supplied, but the live SQL-Server provider is not wired ' +
      '(no driver) and the company/branch scope cannot be confirmed while UI authentication is blocked. ' +
      'Use FakeCustomerDataProvider in framework tests; wire the concrete provider once a verified ' +
      'read-only credential and the authenticated scope are available.'
  );
}

/** In-memory fake for framework/unit tests — no real DB, deterministic. */
export class FakeCustomerDataProvider implements CustomerDataProvider {
  constructor(
    private readonly rows: CustomerDbRecord[] = [
      { id: 1001, name: 'Fake Customer One', telephoneNo: '01700000001', email: 'one@example-test.invalid', customerGroupId: 5, companyId: 1, branchId: 1 },
      { id: 1002, name: 'Fake Customer Two', telephoneNo: '01700000002', email: 'two@example-test.invalid', customerGroupId: 5, companyId: 1, branchId: 1 },
    ]
  ) {}

  async getAnyActiveCustomer(): Promise<CustomerDbRecord> {
    if (this.rows.length === 0) throw new Error('FakeCustomerDataProvider: no rows configured.');
    return this.rows[0];
  }
  async getCustomerById(id: number | string): Promise<CustomerDbRecord | null> {
    return this.rows.find((r) => String(r.id) === String(id)) ?? null;
  }
  async getCustomerForEdit(): Promise<CustomerDbRecord> {
    return this.getAnyActiveCustomer();
  }
  async findCustomerByName(name: string): Promise<CustomerDbRecord | null> {
    return this.rows.find((r) => r.name === name) ?? null;
  }
  async customerExistsByName(name: string): Promise<boolean> {
    return this.rows.some((r) => r.name === name);
  }
  async getAnyActiveCustomerName(): Promise<string> {
    const row = await this.getAnyActiveCustomer();
    if (!row.name) throw new Error('FakeCustomerDataProvider: first row has no name.');
    return row.name;
  }
}

export class FakeCustomerGroupDataProvider implements CustomerGroupDataProvider {
  constructor(
    private readonly rows: CustomerGroupDbRecord[] = [{ id: 5, name: 'Fake Customer Group', companyId: 1, branchId: 1 }]
  ) {}

  async getAnyActiveCustomerGroup(): Promise<CustomerGroupDbRecord> {
    if (this.rows.length === 0) throw new Error('FakeCustomerGroupDataProvider: no rows configured.');
    return this.rows[0];
  }
  async getCustomerGroupById(id: number | string): Promise<CustomerGroupDbRecord | null> {
    return this.rows.find((r) => String(r.id) === String(id)) ?? null;
  }
}
