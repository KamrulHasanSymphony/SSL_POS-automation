import { ApiClient } from './api-helper';
import { createLogger } from './logger';

const logger = createLogger('test-data-setup');

/**
 * STEP 17A: reads `key` off a parsed API response body trying both the
 * PascalCase name as declared on the backend's C# ViewModel (e.g. "Status")
 * and its camelCase equivalent (e.g. "status") — ASP.NET Core's default
 * System.Text.Json naming policy camelCases every response property (STEP
 * 16/17 root cause), but nothing reading a response here should have to
 * assume one casing over the other. Returns undefined if `obj` is nullish
 * or the key isn't present under either casing.
 *
 * Exported so the API test files (tests/api/*.spec.ts) can reuse this exact
 * lookup instead of each hand-rolling `body.status ?? body.Status` at every
 * call site. This is a deliberate, small duplication of api-helper.ts's own
 * private `readProp` (out of scope to modify per STEP 17A) rather than a
 * shared import — the two are independent, identically-behaved copies.
 */
export function readProp(obj: unknown, key: string): any {
  if (obj === null || typeof obj !== 'object') return undefined;
  const camelKey = key.length > 0 ? key[0].toLowerCase() + key.slice(1) : key;
  const record = obj as Record<string, unknown>;
  if (key in record) return record[key];
  if (camelKey in record) return record[camelKey];
  return undefined;
}

export interface CreatedEntity {
  /** Module name, matching the STEP 2 test-ID prefix, e.g. "SUPP", "PROD" */
  module: string;
  /** API path used to delete this record later, e.g. "/api/Supplier/Delete" */
  deletePath: string | null;
  /** Id/code returned by the Insert call, used as the Delete payload key */
  id: string | number;
}

/**
 * Generic prerequisite-data creation via the API layer.
 *
 * PER THE API SETUP RULE: use this only to seed data for a module that is a
 * PREREQUISITE of the test, never for the module actually under test. e.g. it
 * is fine to call `createViaApi(api, 'SUPP', '/api/Supplier/Insert', payload)`
 * to seed a Supplier while testing the Purchase workflow; it is not fine to
 * use this to "create" the Purchase itself in a Purchase-module test.
 *
 * Module-specific payload builders (exact ViewModel field names/required
 * values) should be added alongside each module's test implementation and
 * verified against the live API at that time — STEP 1 confirmed the Insert
 * routes exist and are `[Authorize]`-gated per module, but did not exhaustively
 * re-verify every DTO's required-field set (see STEP 1 §F).
 */
export async function createViaApi(
  api: ApiClient,
  module: string,
  insertPath: string,
  payload: Record<string, unknown>,
  deletePath: string | null = insertPath.replace(/Insert$/, 'Delete')
): Promise<CreatedEntity> {
  const response = await api.post(insertPath, payload);
  if (!response.ok()) {
    throw new Error(
      `Prerequisite data setup failed for module "${module}" at ${insertPath}: ` +
        `${response.status()} ${await response.text()}`
    );
  }
  const body = await response.json();
  // STEP 17A: ResultVM's fields (Status/Message/Id/DataVM) are declared
  // PascalCase in C# but serialize camelCase (System.Text.Json default
  // policy — see STEP 16/17). readProp() checks both casings so this works
  // regardless of which one a given deployment actually sends.
  const dataVM = readProp(body, 'DataVM');
  const id = readProp(body, 'Id') ?? readProp(dataVM, 'Id') ?? payload['Code'] ?? payload['code'];
  const status = readProp(body, 'Status');
  if (id === undefined || status === 'Fail') {
    throw new Error(
      `Prerequisite data setup failed for module "${module}" at ${insertPath}: ` +
        `Status="${status}" Message="${readProp(body, 'Message')}"`
    );
  }
  logger.info(`Created prerequisite ${module} record via API`, { id, insertPath });
  return { module, deletePath, id: id as string | number };
}

/**
 * Common shape for the four master-data "group" prerequisites' Insert
 * payload, confirmed directly from ShampanPOS_Api (STEP 5 source
 * verification): ProductGroupVM/UOMVM/CustomerGroupVM/SupplierGroupVM all
 * key off Name + CompanyId + BranchId + IsActive; Code is server-generated
 * and must NOT be supplied. `Name` has no server [Required] attribute on
 * some of these DTOs, but every Insert service does `Name.Trim()`
 * unconditionally — an omitted Name throws a NullReferenceException
 * server-side, so it is a de-facto required field for all four.
 */
export interface GroupPrerequisitePayload {
  name: string;
  companyId: number;
  branchId?: number;
  createdBy?: string;
}

function groupPayload(p: GroupPrerequisitePayload): Record<string, unknown> {
  return {
    Name: p.name,
    CompanyId: p.companyId,
    BranchId: p.branchId ?? p.companyId,
    IsActive: true,
    CreatedBy: p.createdBy ?? 'automation',
    CreatedFrom: 'API',
  };
}

/** PREREQUISITE ONLY (API Setup Rule) — never use to test the Product Group module itself. */
export async function createProductGroup(api: ApiClient, p: GroupPrerequisitePayload): Promise<CreatedEntity> {
  return createViaApi(api, 'PRODGROUP', '/api/ProductGroup/Insert', groupPayload(p));
}

/** PREREQUISITE ONLY (API Setup Rule) — never use to test the UOM module itself. */
export async function createUom(api: ApiClient, p: GroupPrerequisitePayload): Promise<CreatedEntity> {
  return createViaApi(api, 'UOM', '/api/UOM/Insert', groupPayload(p));
}

/** PREREQUISITE ONLY (API Setup Rule) — never use to test the Customer Group module itself. */
export async function createCustomerGroup(api: ApiClient, p: GroupPrerequisitePayload): Promise<CreatedEntity> {
  return createViaApi(api, 'CUSTGROUP', '/api/CustomerGroup/Insert', groupPayload(p));
}

/** PREREQUISITE ONLY (API Setup Rule) — never use to test the Supplier Group module itself. */
export async function createSupplierGroup(api: ApiClient, p: GroupPrerequisitePayload): Promise<CreatedEntity> {
  return createViaApi(api, 'SUPPGROUP', '/api/SupplierGroup/Insert', groupPayload(p));
}

/**
 * STEP 8 — API-only payload builders for Product/Customer/Supplier/
 * BankInformation/BankAccount, confirmed directly from ShampanPOS_Api
 * source at STEP 8.2 (ProductService.cs/CustomerService.cs/
 * SupplierService.cs/BankAccountService.cs — exact duplicate-check fields
 * and required-in-practice fields cited in each function below).
 *
 * UNLIKE the UI-facing STEP 5/6/7 rule ("Product/Customer/Supplier/
 * BankAccount must be tested through the real UI"), these ARE used to
 * directly exercise the module under test for STEP 8's "independent
 * API-level checks" category — that category exists specifically to probe
 * server-side behavior no UI-driven test can reach. Do not reuse these to
 * silently replace a UI-workflow assertion in a STEP 5/6/7-style test.
 */
export interface ProductApiPayload {
  name: string;
  companyId: number;
  branchId: number;
  productGroupId: number;
  /** Confirmed: ProductRepository.cs defaults UOMId to 1 when omitted — pass explicitly to avoid relying on that. */
  uomId: number;
  createdBy?: string;
}

/** Confirmed duplicate check: ProductService.cs — Name only, global (not company-scoped), not IsActive-filtered. */
export async function createProductApi(api: ApiClient, p: ProductApiPayload): Promise<CreatedEntity> {
  return createViaApi(api, 'PRODUCT', '/api/Product/Insert', {
    Name: p.name,
    CompanyId: p.companyId,
    BranchId: p.branchId,
    ProductGroupId: p.productGroupId,
    UOMId: p.uomId,
    CreatedBy: p.createdBy ?? 'automation',
  });
}

export interface CustomerApiPayload {
  name: string;
  telephoneNo: string;
  companyId: number;
  branchId: number;
  customerGroupId: number;
  createdBy?: string;
}

/** Confirmed duplicate check: CustomerService.cs — TelephoneNo + IsActive='1' (NOT Name — corrected finding, see STEP 8.2 report). */
export async function createCustomerApi(api: ApiClient, p: CustomerApiPayload): Promise<CreatedEntity> {
  return createViaApi(api, 'CUSTOMER', '/api/Customer/Insert', {
    Name: p.name,
    TelephoneNo: p.telephoneNo,
    CompanyId: p.companyId,
    BranchId: p.branchId,
    CustomerGroupId: p.customerGroupId,
    CreatedBy: p.createdBy ?? 'automation',
  });
}

export interface SupplierApiPayload {
  name: string;
  companyId: number;
  branchId: number;
  supplierGroupId: number;
  createdBy?: string;
}

/** Confirmed duplicate check: SupplierService.cs — Name only, global (not company-scoped), not IsActive-filtered. */
export async function createSupplierApi(api: ApiClient, p: SupplierApiPayload): Promise<CreatedEntity> {
  return createViaApi(api, 'SUPPLIER', '/api/Supplier/Insert', {
    Name: p.name,
    CompanyId: p.companyId,
    BranchId: p.branchId,
    SupplierGroupId: p.supplierGroupId,
    CreatedBy: p.createdBy ?? 'automation',
  });
}

/** PREREQUISITE for createBankAccountApi's BankId FK — confirmed reachable, api/BankInformation/Insert, same GroupPrerequisitePayload shape. */
export async function createBankInformationApi(api: ApiClient, p: GroupPrerequisitePayload): Promise<CreatedEntity> {
  return createViaApi(api, 'BANKINFO', '/api/BankInformation/Insert', groupPayload(p));
}

export interface BankAccountApiPayload {
  accountNo: string;
  accountName: string;
  bankId: number;
  branchName: string;
  companyId: number;
  createdBy?: string;
}

/** Confirmed duplicate check: BankAccountService.cs — AccountNo, scoped by CompanyId (unlike Product/Supplier's global check). */
export async function createBankAccountApi(api: ApiClient, p: BankAccountApiPayload): Promise<CreatedEntity> {
  return createViaApi(api, 'BANKACC', '/api/BankAccount/Insert', {
    AccountNo: p.accountNo,
    AccountName: p.accountName,
    BankId: p.bankId,
    BranchName: p.branchName,
    BranchId: p.companyId,
    CompanyId: p.companyId,
    CreatedBy: p.createdBy ?? 'automation',
  });
}
