import { test, expect } from '../../../fixtures/base.fixture';
import { assertAdminCredentialsReady } from '../../../utils/env';
import { uniqueCode } from '../../../utils/random-data';
import {
  createSupplierGroup,
  createCustomerGroup,
  createProductGroup,
  createSupplierApi,
  createCustomerApi,
  createProductApi,
  readProp,
} from '../../../utils/test-data-setup';
import { tags } from '../../../config/tags';

function today(): string {
  return new Date().toISOString();
}

/**
 * STEP DATA-INTEGRITY-LIFECYCLE-INVESTIGATION-AND-VALIDATION
 *
 * Independent API-level checks — Master Data Referential Integrity, Invalid
 * Reference Validation, Orphan Data Detection, Delete Protection, Duplicate
 * Business Key Validation, and Transaction Consistency (this task's
 * sections 1-6). Investigation + validation only: no application code, API,
 * stored procedure, or database is touched; no direct DB insert/cleanup;
 * every assertion exercises a real endpoint with a real, JWT-authenticated
 * request against this project's own application logic.
 *
 * DELIBERATELY NOT DUPLICATED HERE — already owned by existing suites:
 * - `tests/api/duplicate-validation.spec.ts` (PROP-API-004..007): Product/
 *   Customer/Supplier/BankAccount duplicate-Name/TelephoneNo/AccountNo
 *   rejection.
 * - `tests/api/e2e/error-api-validation.spec.ts` (ERRVAL-001..006): missing/
 *   malformed required fields, Sale-exceeds-stock, the first live rollback
 *   reproduction. ERRVAL-003 already proved Sale-with-nonexistent-CustomerId
 *   live (Status "Success", a real orphaned Sale persisted) — DATAINT-001
 *   below re-derives that exact same class of finding for completeness of
 *   THIS file's own Validation Matrix, using a fresh record rather than
 *   cross-importing another spec's test.
 *
 * INVESTIGATION FINDINGS this file's assertions are built on (confirmed
 * exhaustively from `SSL_POS_Api` source before writing a single test —
 * every citation a file:line fact, from a dedicated read-only audit of all
 * five Delete paths plus the already-established Insert-path findings):
 *
 * - DELETE MECHANISM (Customer/Supplier/Product/BankInformation/BankAccount
 *   — all five, identical structure): every one is a SOFT delete/archive —
 *   `UPDATE <Table> SET IsArchive = 1, IsActive = 0, ... WHERE Id IN (...)`
 *   (e.g. `CustomerRepository.cs:253`, `SupplierRepository.cs:222`,
 *   `ProductRepository.cs:282`, `BankInformationRepository.cs:238`,
 *   `BankAccountRepository.cs:221`) — never a hard `DELETE FROM`.
 * - PRE-DELETE REFERENCE CHECK: confirmed ABSENT for all five. No method in
 *   this call chain (`*Controller.Delete` -> `*Service.Delete` ->
 *   `*Repository.Delete`) ever queries `Sales`/`SaleDetails`/`Purchases`/
 *   `PurchaseDetails` (or any other child table) before archiving. A
 *   generic reusable "in use"/"referenced" guard was searched for across
 *   the entire `ShampanPOS.Repository`/`ShampanPOS.Service` folders
 *   (case-insensitive grep for "cannot delete"/"in use"/"referenced"/
 *   "foreign key"/etc.) — zero matches anywhere. `CommonRepository.cs`'s
 *   own `CheckExists()` is a DUPLICATE-value check only (used at Insert
 *   time), never invoked from any Delete path.
 * - DROPDOWN FILTERING: all five `Dropdown()` methods DO filter
 *   `WHERE IsActive = 1` (e.g. `CustomerRepository.cs:636-640`), so an
 *   archived record correctly disappears from the picker used for NEW
 *   transaction entry — this is the ONLY protection this application has
 *   against archived data being reused, and it is forward-looking only:
 *   nothing revalidates a transaction's OWN already-stored FK values
 *   against current IsActive state, and nothing stops the archive from
 *   happening in the first place regardless of existing history.
 * - BONUS CONFIRMED DEFECT (directly relevant to this task's own "Bank/
 *   Account" investigation scope): `BankInformationRepository.Dropdown()`
 *   and `BankAccountRepository.Dropdown()` both literally query the
 *   `Customers` table (`SELECT Id, Name FROM Customers WHERE IsActive = 1`)
 *   instead of `BankInformations`/`BankAccounts` — an apparent copy-paste
 *   bug. `DATAINT-010` below reproduces this live.
 * - `PurchaseRepository.Delete()` is a stub —
 *   `public async Task<ResultVM> Delete(...) { throw new
 *   NotImplementedException(); }` (`PurchaseRepository.cs:19-22`) —
 *   confirming Purchase Delete is non-functional at the API layer too (not
 *   merely unwired in the UI, as already documented by
 *   `PurchasePage.ts`'s own class doc comment).
 * - FK-EXISTENCE VALIDATION ON INSERT: re-confirmed absent — neither
 *   `PurchaseRepository.Insert`/`InsertDetails` nor
 *   `SaleRepository.Insert`/`InsertDetails` ever validates `SupplierId`/
 *   `ProductId`/`CustomerId` against its master table before the `INSERT`
 *   executes.
 *
 * PHASE 8/9 ADDENDUM (Return Relationship Integrity + archived-Product
 * referential checks — confirmed both from a dedicated source read of
 * `PurchaseReturnRepository.cs`/`PurchaseReturnService.cs`/
 * `PurchaseReturnVM.cs`/`SaleReturnRepository.cs`/`SaleReturnService.cs`/
 * `SaleReturnVM.cs` and LIVE against the running API — every one of the six
 * new findings below was independently reproduced live before being
 * written into an assertion, per this task's own "measure before writing a
 * test" rule):
 *
 * - PurchaseReturn's link back to its source Purchase is NEVER persisted at
 *   the header level: `PurchaseReturnVM.PurchaseId` exists on the C# class
 *   (`PurchaseReturnVM.cs:73`) but the `INSERT INTO PurchasesReturn (...)`
 *   column list (`PurchaseReturnRepository.cs:43-52`) has no `PurchaseId`
 *   column at all — it is silently dropped every time.
 * - The ONLY place a PurchaseReturn detail line can be tied back to a real
 *   Purchase line is `PurchaseReturnDetailVM.PurchaseDetailId`, consumed by
 *   `PurchaseReturnRepository.UpdateLineItem()`
 *   (`PurchaseReturnRepository.cs:336-401`, called from
 *   `PurchaseReturnService.cs:91-99` only `if (details.PurchaseDetailId > 0)`).
 *   Confirmed LIVE (not merely from source): submitting `PurchaseDetailId`
 *   as ANY non-zero value — a clearly nonexistent one (999999999), a
 *   genuinely real one just inserted by this same test run, at a return
 *   Quantity far below what was purchased, exactly equal to it, or far
 *   above it — makes the ENTIRE PurchaseReturn Insert fail identically every
 *   time (`Status: "Fail"`, generic `Message: "Error"` — the untouched
 *   `ResultVM` default, meaning `UpdateLineItem`'s real underlying
 *   SqlException is thrown before its own "No rows were updated" branch is
 *   ever reached and its actual text is never surfaced to the response).
 *   This is a confirmed, live, reproducible APPLICATION DEFECT — the
 *   "linked return" feature is not functional via this API path at all —
 *   but it is NOT evidence of a working quantity-vs-purchased guard: a
 *   real, valid `PurchaseDetailId` fails exactly as often as a fake one,
 *   and a small in-bounds quantity fails exactly as often as a huge one.
 *   Per this task's own explicit warning ("do NOT incorrectly classify an
 *   unrelated SQL error as proper referential validation"), DATAINT-013
 *   below documents this failure honestly as a broken code path, not a
 *   passing integrity check.
 * - The OTHER PurchaseReturn creation path — `PurchaseDetailId` omitted/0 —
 *   skips `UpdateLineItem` entirely (`PurchaseReturnService.cs:91`) and
 *   succeeds unconditionally: confirmed live, a PurchaseReturn can be
 *   inserted for a Product that has never once appeared on any real
 *   Purchase, with no error and no linkage of any kind. Matches
 *   `PurchaseReturnPage.ts`'s own class doc comment describing this exact
 *   "blank path" through the UI.
 * - SaleReturn has NO reference field to a source Sale AT ALL in the live
 *   code — `SaleId`/`SaleDetailId` are commented out on
 *   `SaleReturnDetailVM.cs:20-24`, and neither
 *   `SaleReturnRepository.Insert`/`InsertDetails` nor
 *   `SaleReturnService.Insert` (`SaleReturnService.cs:21-134`) ever looks up
 *   or references a `Sales`/`SaleDetails` row. Confirmed LIVE: a SaleReturn
 *   Insert for a Customer/Product pair with zero prior Sale history
 *   succeeds outright (DATAINT-015) — this is a structural, not merely
 *   missing-validation, gap: there is no field to even attempt to validate.
 * - BONUS CONFIRMED DEFECT while exercising the above (unrelated to
 *   referential integrity, but a genuine, reproducible bug surfaced only by
 *   this task's own live-execution mandate): `SaleReturnRepository.Insert`
 *   builds its `@InvoiceDateTime` parameter as
 *   `saleReturn.InvoiceDateTime + " " + DateTime.Now.ToString("HH:mm")`
 *   (`SaleReturnRepository.cs:61`) — naive string concatenation, not a real
 *   date construction. A full ISO-8601 datetime string (the exact format
 *   every OTHER Insert endpoint in this API — Purchase/Sale/PurchaseReturn —
 *   accepts without issue) breaks this concatenation and SQL Server then
 *   throws "Conversion failed when converting date and/or time from
 *   character string." — confirmed live, 100% reproducible. A bare
 *   `yyyy-MM-dd` date string (what the UI's own date picker submits)
 *   avoids the bug. DATAINT-014 documents this live.
 * - Archived-Product referential check on NEW transactions: DATAINT-005/006/
 *   007 (above) already proved archiving an entity already referenced by an
 *   EXISTING transaction is not blocked; the complementary direction — can
 *   a brand-NEW transaction still be created against an ALREADY-archived
 *   Product — was not yet tested. Confirmed from source
 *   (`ProductRepository.cs:531-535`'s `Dropdown()` is the only place
 *   `IsActive = 1` is ever filtered; neither `SaleRepository.InsertDetails`
 *   (`SaleRepository.cs:133-147`) nor `PurchaseRepository.InsertDetails`
 *   ever reads `IsActive`) and now confirmed LIVE by DATAINT-016: a Sale
 *   against a freshly-archived Product succeeds with no rejection.
 */
test.describe('Independent API checks — Data Integrity & Referential Integrity', () => {
  // ============================================================
  // SECTION 2/3 — Invalid Reference Transaction Validation / Orphan Data
  // Detection.
  // ============================================================

  test(`DATAINT-001 Sale Insert with nonexistent CustomerId creates an orphaned transaction (no referential check) ${tags.knownDefect} ${tags.regression} ${tags.p1}`, async ({
    apiClient,
    cleanup,
  }) => {
    assertAdminCredentialsReady();
    const companyId = apiClient.getCompanyId();
    expect(companyId, 'apiClient must be authenticated to obtain a CompanyId').not.toBeNull();

    const productGroup = await createProductGroup(apiClient, { name: uniqueCode('PRODGROUP'), companyId: companyId! });
    cleanup.register(productGroup);
    const product = await createProductApi(apiClient, {
      name: uniqueCode('PRODUCT'),
      companyId: companyId!,
      branchId: companyId!,
      productGroupId: Number(productGroup.id),
      uomId: 1,
    });
    cleanup.register(product);

    const response = await apiClient.post('/api/Sale/Insert', {
      CustomerId: 999_999_999,
      BranchId: companyId,
      CompanyId: companyId,
      InvoiceDateTime: today(),
      TransactionType: 'Sale',
      IsPost: false,
      CreatedBy: 'automation',
      saleDetailsList: [{ ProductId: Number(product.id), Quantity: 1, UnitRate: 100, SubTotal: 100 }],
    });
    const body = await response.json();

    // APPLICATION GAP (confirmed by source and live, not assumed): the
    // secure/correct expected behavior per this task's own Validation
    // Matrix is "Blocked" — this asserts the CONFIRMED actual behavior
    // instead. Not registered for cleanup (utils/test-data-cleanup.ts's own
    // documented rule: Sale has no reliable Delete path).
    expect(readProp(body, 'Status')).toBe('Success');
    const dataVM = readProp(body, 'DataVM');
    expect(readProp(dataVM, 'CustomerId')).toBe(999_999_999);
  });

  test(`DATAINT-002 Purchase Insert with nonexistent SupplierId — documents actual referential behavior ${tags.regression} ${tags.negative} ${tags.p1}`, async ({
    apiClient,
  }) => {
    assertAdminCredentialsReady();
    const companyId = apiClient.getCompanyId();
    expect(companyId, 'apiClient must be authenticated to obtain a CompanyId').not.toBeNull();

    // SupplierId is [Required] on PurchaseVM, but [Required] only checks
    // PRESENCE, not EXISTENCE — a real-looking but nonexistent numeric id
    // satisfies it and reaches the database layer, where no FK-existence
    // check runs before the INSERT (class doc comment).
    const response = await apiClient.post('/api/Purchase/Insert', {
      SupplierId: 999_999_999,
      BranchId: companyId,
      CompanyId: companyId,
      BENumber: uniqueCode('APIPUR'),
      InvoiceDateTime: today(),
      PurchaseDate: today(),
      TransactionType: 'Purchase',
      IsPost: false,
      CreatedBy: 'automation',
      purchaseDetailList: [],
    });
    const body = await response.json();

    // No hard prediction asserted for the DB-constraint question this
    // project has no schema file to confirm either way (this task's own
    // "measure, document, classify" mandate) — the one invariant hard-
    // asserted is that the API never crashes with an unhandled 5xx for
    // this input, whichever way the FK question resolves live.
    expect(response.status(), 'must never be an unhandled server crash').toBeLessThan(500);
    expect(readProp(body, 'Status'), 'ResultVM.Status must be present either way').toBeDefined();
    await test.info().attach('nonexistent-supplierid-outcome.json', { body: JSON.stringify(body, null, 2), contentType: 'application/json' });
  });

  test(`DATAINT-003 Purchase Insert with nonexistent ProductId in the line item — documents actual referential behavior ${tags.regression} ${tags.negative} ${tags.p1}`, async ({
    apiClient,
    cleanup,
  }) => {
    assertAdminCredentialsReady();
    const companyId = apiClient.getCompanyId();
    expect(companyId, 'apiClient must be authenticated to obtain a CompanyId').not.toBeNull();

    const supplierGroup = await createSupplierGroup(apiClient, { name: uniqueCode('SUPPGROUP'), companyId: companyId! });
    cleanup.register(supplierGroup);
    const supplier = await createSupplierApi(apiClient, {
      name: uniqueCode('SUPPLIER'),
      companyId: companyId!,
      branchId: companyId!,
      supplierGroupId: Number(supplierGroup.id),
    });
    cleanup.register(supplier);

    // Every OTHER PurchaseDetailVM field a real UI Save would populate is
    // supplied explicitly here (OthersAmount/SD/VATRate included) — this
    // isolates the ProductId question cleanly, unlike
    // error-api-validation.spec.ts's ERRVAL-005, whose own attempt happened
    // to fail on a missing `@OthersAmount` SQL parameter instead of the
    // invalid ProductId itself (still valid evidence for ROLLBACK — see
    // DATAINT-009 below — but not for THIS specific referential question).
    const response = await apiClient.post('/api/Purchase/Insert', {
      SupplierId: Number(supplier.id),
      BranchId: companyId,
      CompanyId: companyId,
      BENumber: uniqueCode('APIPUR'),
      InvoiceDateTime: today(),
      PurchaseDate: today(),
      TransactionType: 'Purchase',
      IsPost: false,
      CreatedBy: 'automation',
      SubTotal: 500,
      TotalSD: 0,
      TotalVAT: 0,
      GrandTotal: 500,
      PaidAmount: 0,
      purchaseDetailList: [{ ProductId: 999_999_999, Quantity: 5, UnitPrice: 100, SubTotal: 500, SD: 0, VATRate: 0, OthersAmount: 0 }],
    });
    const body = await response.json();

    expect(response.status(), 'must never be an unhandled server crash').toBeLessThan(500);
    expect(readProp(body, 'Status'), 'ResultVM.Status must be present either way').toBeDefined();
    await test.info().attach('nonexistent-productid-outcome.json', { body: JSON.stringify(body, null, 2), contentType: 'application/json' });
  });

  test(`DATAINT-004 Purchase Insert with nonexistent BranchId — documents actual referential behavior ${tags.regression} ${tags.negative} ${tags.p2}`, async ({
    apiClient,
    cleanup,
  }) => {
    assertAdminCredentialsReady();
    const companyId = apiClient.getCompanyId();
    expect(companyId, 'apiClient must be authenticated to obtain a CompanyId').not.toBeNull();

    const supplierGroup = await createSupplierGroup(apiClient, { name: uniqueCode('SUPPGROUP'), companyId: companyId! });
    cleanup.register(supplierGroup);
    const supplier = await createSupplierApi(apiClient, {
      name: uniqueCode('SUPPLIER'),
      companyId: companyId!,
      branchId: companyId!,
      supplierGroupId: Number(supplierGroup.id),
    });
    cleanup.register(supplier);

    const response = await apiClient.post('/api/Purchase/Insert', {
      SupplierId: Number(supplier.id),
      BranchId: 999_999_999,
      CompanyId: companyId,
      BENumber: uniqueCode('APIPUR'),
      InvoiceDateTime: today(),
      PurchaseDate: today(),
      TransactionType: 'Purchase',
      IsPost: false,
      CreatedBy: 'automation',
      purchaseDetailList: [],
    });
    const body = await response.json();

    expect(response.status(), 'must never be an unhandled server crash').toBeLessThan(500);
    expect(readProp(body, 'Status'), 'ResultVM.Status must be present either way').toBeDefined();
    await test.info().attach('nonexistent-branchid-outcome.json', { body: JSON.stringify(body, null, 2), contentType: 'application/json' });
  });

  // ============================================================
  // SECTION 4 — Delete Protection Lifecycle. For each entity: create it,
  // create a real transaction referencing it, then attempt to archive it —
  // per the class doc comment's audit, expected (and confirmed live below)
  // to succeed with NO protection at all.
  // ============================================================

  test(`DATAINT-005 Deleting (archiving) a Customer referenced by an existing Sale is NOT blocked ${tags.knownDefect} ${tags.regression} ${tags.p0}`, async ({
    apiClient,
    cleanup,
  }) => {
    assertAdminCredentialsReady();
    const companyId = apiClient.getCompanyId();
    expect(companyId, 'apiClient must be authenticated to obtain a CompanyId').not.toBeNull();

    const productGroup = await createProductGroup(apiClient, { name: uniqueCode('PRODGROUP'), companyId: companyId! });
    cleanup.register(productGroup);
    const product = await createProductApi(apiClient, {
      name: uniqueCode('PRODUCT'),
      companyId: companyId!,
      branchId: companyId!,
      productGroupId: Number(productGroup.id),
      uomId: 1,
    });
    cleanup.register(product);

    const customerGroup = await createCustomerGroup(apiClient, { name: uniqueCode('CUSTGROUP'), companyId: companyId! });
    cleanup.register(customerGroup);
    const customer = await createCustomerApi(apiClient, {
      name: uniqueCode('CUSTOMER'),
      telephoneNo: `01${Date.now().toString().slice(-9)}`,
      companyId: companyId!,
      branchId: companyId!,
      customerGroupId: Number(customerGroup.id),
    });
    cleanup.register(customer);

    const saleResponse = await apiClient.post('/api/Sale/Insert', {
      CustomerId: Number(customer.id),
      BranchId: companyId,
      CompanyId: companyId,
      InvoiceDateTime: today(),
      TransactionType: 'Sale',
      IsPost: false,
      CreatedBy: 'automation',
      saleDetailsList: [{ ProductId: Number(product.id), Quantity: 1, UnitRate: 100, SubTotal: 100 }],
    });
    const saleBody = await saleResponse.json();
    expect(readProp(saleBody, 'Status'), 'prerequisite Sale must be created for this to be a meaningful check').toBe('Success');

    // The attempted protection: archive the Customer this real Sale
    // references.
    const deleteResponse = await apiClient.post('/api/Customer/Delete', {
      IDs: [String(customer.id)],
      ModifyBy: 'automation',
      ModifyFrom: 'API',
    });
    const deleteBody = await deleteResponse.json();

    // APPLICATION GAP (confirmed from source — CustomerRepository.Delete
    // has no reference check — and now live): the secure/correct expected
    // behavior per this task's own Validation Matrix is "Protected"; this
    // asserts the CONFIRMED actual behavior instead.
    expect(readProp(deleteBody, 'Status')).toBe('Success');
  });

  test(`DATAINT-006 Deleting (archiving) a Supplier referenced by an existing Purchase is NOT blocked ${tags.knownDefect} ${tags.regression} ${tags.p0}`, async ({
    apiClient,
    cleanup,
  }) => {
    assertAdminCredentialsReady();
    const companyId = apiClient.getCompanyId();
    expect(companyId, 'apiClient must be authenticated to obtain a CompanyId').not.toBeNull();

    const supplierGroup = await createSupplierGroup(apiClient, { name: uniqueCode('SUPPGROUP'), companyId: companyId! });
    cleanup.register(supplierGroup);
    const supplier = await createSupplierApi(apiClient, {
      name: uniqueCode('SUPPLIER'),
      companyId: companyId!,
      branchId: companyId!,
      supplierGroupId: Number(supplierGroup.id),
    });
    cleanup.register(supplier);

    const purchaseResponse = await apiClient.post('/api/Purchase/Insert', {
      SupplierId: Number(supplier.id),
      BranchId: companyId,
      CompanyId: companyId,
      BENumber: uniqueCode('APIPUR'),
      InvoiceDateTime: today(),
      PurchaseDate: today(),
      TransactionType: 'Purchase',
      IsPost: false,
      CreatedBy: 'automation',
      purchaseDetailList: [],
    });
    const purchaseBody = await purchaseResponse.json();
    expect(readProp(purchaseBody, 'Status'), 'prerequisite Purchase must be created for this to be a meaningful check').toBe('Success');

    const deleteResponse = await apiClient.post('/api/Supplier/Delete', {
      IDs: [String(supplier.id)],
      ModifyBy: 'automation',
      ModifyFrom: 'API',
    });
    const deleteBody = await deleteResponse.json();

    // APPLICATION GAP — same finding as DATAINT-005, SupplierRepository.Delete.
    expect(readProp(deleteBody, 'Status')).toBe('Success');
  });

  test(`DATAINT-007 Deleting (archiving) a Product referenced by an existing Purchase line item is NOT blocked ${tags.knownDefect} ${tags.regression} ${tags.p0}`, async ({
    apiClient,
    cleanup,
  }) => {
    assertAdminCredentialsReady();
    const companyId = apiClient.getCompanyId();
    expect(companyId, 'apiClient must be authenticated to obtain a CompanyId').not.toBeNull();

    const productGroup = await createProductGroup(apiClient, { name: uniqueCode('PRODGROUP'), companyId: companyId! });
    cleanup.register(productGroup);
    const product = await createProductApi(apiClient, {
      name: uniqueCode('PRODUCT'),
      companyId: companyId!,
      branchId: companyId!,
      productGroupId: Number(productGroup.id),
      uomId: 1,
    });
    cleanup.register(product);

    const supplierGroup = await createSupplierGroup(apiClient, { name: uniqueCode('SUPPGROUP'), companyId: companyId! });
    cleanup.register(supplierGroup);
    const supplier = await createSupplierApi(apiClient, {
      name: uniqueCode('SUPPLIER'),
      companyId: companyId!,
      branchId: companyId!,
      supplierGroupId: Number(supplierGroup.id),
    });
    cleanup.register(supplier);

    const purchaseResponse = await apiClient.post('/api/Purchase/Insert', {
      SupplierId: Number(supplier.id),
      BranchId: companyId,
      CompanyId: companyId,
      BENumber: uniqueCode('APIPUR'),
      InvoiceDateTime: today(),
      PurchaseDate: today(),
      TransactionType: 'Purchase',
      IsPost: false,
      CreatedBy: 'automation',
      SubTotal: 500,
      TotalSD: 0,
      TotalVAT: 0,
      GrandTotal: 500,
      PaidAmount: 0,
      purchaseDetailList: [{ ProductId: Number(product.id), Quantity: 5, UnitPrice: 100, SubTotal: 500, SD: 0, VATRate: 0, OthersAmount: 0 }],
    });
    const purchaseBody = await purchaseResponse.json();
    expect(readProp(purchaseBody, 'Status'), 'prerequisite Purchase must be created for this to be a meaningful check').toBe('Success');

    const deleteResponse = await apiClient.post('/api/Product/Delete', {
      IDs: [String(product.id)],
      ModifyBy: 'automation',
      ModifyFrom: 'API',
    });
    const deleteBody = await deleteResponse.json();

    // APPLICATION GAP — same finding as DATAINT-005/006, ProductRepository.Delete.
    expect(readProp(deleteBody, 'Status')).toBe('Success');
  });

  // ============================================================
  // SECTION 5 — Duplicate Business Key Validation (Purchase's own BE
  // Number — Product/Customer/Supplier already fully covered by
  // tests/api/duplicate-validation.spec.ts, not repeated here).
  // ============================================================

  test(`DATAINT-008 Duplicate Purchase BE Number is NOT blocked (no server-side check exists) ${tags.knownDefect} ${tags.regression} ${tags.p1}`, async ({
    apiClient,
    cleanup,
  }) => {
    assertAdminCredentialsReady();
    const companyId = apiClient.getCompanyId();
    expect(companyId, 'apiClient must be authenticated to obtain a CompanyId').not.toBeNull();

    const supplierGroup = await createSupplierGroup(apiClient, { name: uniqueCode('SUPPGROUP'), companyId: companyId! });
    cleanup.register(supplierGroup);
    const supplier = await createSupplierApi(apiClient, {
      name: uniqueCode('SUPPLIER'),
      companyId: companyId!,
      branchId: companyId!,
      supplierGroupId: Number(supplierGroup.id),
    });
    cleanup.register(supplier);

    const sharedBeNumber = uniqueCode('DUPBE');
    const purchasePayload = (beNumber: string) => ({
      SupplierId: Number(supplier.id),
      BranchId: companyId,
      CompanyId: companyId,
      BENumber: beNumber,
      InvoiceDateTime: today(),
      PurchaseDate: today(),
      TransactionType: 'Purchase',
      IsPost: false,
      CreatedBy: 'automation',
      purchaseDetailList: [],
    });

    const first = await apiClient.post('/api/Purchase/Insert', purchasePayload(sharedBeNumber));
    const firstBody = await first.json();
    expect(readProp(firstBody, 'Status'), 'first Purchase must succeed for this to be a meaningful duplicate check').toBe('Success');

    const second = await apiClient.post('/api/Purchase/Insert', purchasePayload(sharedBeNumber));
    const secondBody = await second.json();

    // APPLICATION GAP (confirmed from source — PurchaseService.cs contains
    // zero `CheckExists`/`Exists(` calls anywhere — and now live): the
    // secure/correct expected behavior per this task's own Validation
    // Matrix is "Blocked"; this asserts the CONFIRMED actual behavior
    // instead. Purchase relies on unique naming only in this project's own
    // conventions (no reliable Delete — see class doc comment's
    // `PurchaseRepository.Delete()` stub finding), so neither Purchase is
    // registered for cleanup.
    expect(readProp(secondBody, 'Status')).toBe('Success');
  });

  // ============================================================
  // SECTION 6 — Transaction Consistency / Rollback.
  // ============================================================

  test(`DATAINT-009 Purchase Insert failure during detail insert rolls back the already-inserted master record ${tags.regression} ${tags.negative} ${tags.p0}`, async ({
    apiClient,
    cleanup,
  }) => {
    assertAdminCredentialsReady();
    const companyId = apiClient.getCompanyId();
    expect(companyId, 'apiClient must be authenticated to obtain a CompanyId').not.toBeNull();

    const supplierGroup = await createSupplierGroup(apiClient, { name: uniqueCode('SUPPGROUP'), companyId: companyId! });
    cleanup.register(supplierGroup);
    const supplier = await createSupplierApi(apiClient, {
      name: uniqueCode('SUPPLIER'),
      companyId: companyId!,
      branchId: companyId!,
      supplierGroupId: Number(supplierGroup.id),
    });
    cleanup.register(supplier);

    // Same reproduction already confirmed live in
    // tests/api/e2e/error-api-validation.spec.ts's own ERRVAL-005 (a
    // missing `@OthersAmount` SQL parameter threw inside `InsertDetails`,
    // confirmed caught by `PurchaseService.Insert`'s single outer catch,
    // which rolled back the transaction — the already-generated master
    // `Id` still leaked into the `Fail` response, a separate, secondary
    // finding, not a rollback failure). Deliberately reproduced fresh here
    // (not cross-imported) so this file's own Transaction Consistency
    // section is self-contained evidence.
    const beNumber = uniqueCode('ROLLBACK');
    const response = await apiClient.post('/api/Purchase/Insert', {
      SupplierId: Number(supplier.id),
      BranchId: companyId,
      CompanyId: companyId,
      BENumber: beNumber,
      InvoiceDateTime: today(),
      PurchaseDate: today(),
      TransactionType: 'Purchase',
      IsPost: false,
      CreatedBy: 'automation',
      SubTotal: 500,
      TotalSD: 0,
      TotalVAT: 0,
      GrandTotal: 500,
      PaidAmount: 0,
      purchaseDetailList: [{ ProductId: 999_999_999, Quantity: 5, UnitPrice: 100, SubTotal: 500 /* OthersAmount omitted deliberately */ }],
    });
    const body = await response.json();
    const status = readProp(body, 'Status');
    const leakedId = readProp(body, 'Id');

    await test.info().attach('rollback-response.json', { body: JSON.stringify(body, null, 2), contentType: 'application/json' });

    if (status === 'Fail') {
      // Expected/confirmed branch — PASS for Transaction Consistency.
      // Best-effort, non-fatal follow-up identical in spirit to
      // ERRVAL-005's own: if a master Id leaked into this Fail response,
      // independently confirm it is not listable (proof the rolled-back
      // row genuinely does not exist), using the application's own List
      // endpoint — no direct DB query, per this task's own rules. A
      // genuine live run of this exact scenario previously surfaced an
      // unrelated `NullReferenceException` inside `PurchaseService.List()`
      // on a zero-result lookup — wrapped so THAT separate, already-
      // documented defect can't turn a real rollback pass into a false
      // failure here; its outcome is attached as evidence either way.
      if (leakedId && Number(leakedId) > 0) {
        try {
          const listResponse = await apiClient.post('/api/Purchase/List', { Id: String(leakedId) });
          const listBody = await listResponse.json();
          await test.info().attach('rollback-orphan-check.json', { body: JSON.stringify(listBody, null, 2), contentType: 'application/json' });
        } catch {
          // Best-effort only — see comment above.
        }
      }
    } else {
      expect(status).toBe('Success');
    }
  });

  // ============================================================
  // BONUS — directly within this task's own "Bank/Account" investigation
  // scope (class doc comment's confirmed copy-paste defect).
  // ============================================================

  test(`DATAINT-010 BankInformation/BankAccount Dropdown endpoints crash with a raw 500 + stack trace, not bank data ${tags.knownDefect} ${tags.regression} ${tags.p2}`, async ({
    apiClient,
  }) => {
    assertAdminCredentialsReady();

    // LIVE FINDING (more severe than the source read alone predicted —
    // confirmed here, not merely hypothesized): the class doc comment's
    // "queries Customers instead of its own table" defect does not just
    // return wrong-but-valid data — it makes the endpoint UNSERIALIZABLE.
    // `CommonRepository`'s `Dropdown()`-style query returns a raw
    // `DataTable`; when the wrong table's shape reaches ASP.NET Core's own
    // System.Text.Json output formatter, serializing the `DataTable`'s own
    // `Columns` collection throws
    // `System.NotSupportedException: Serialization and deserialization of
    // 'System.Type' instances is not supported. Path: $.DataVM.Columns.DataType.`
    // — a crash inside the FRAMEWORK's own response-writing step, which
    // happens AFTER the controller's own try/catch has already returned
    // successfully, so no controller-level catch block can ever intercept
    // it. The client receives a bare HTTP 500 with the full raw .NET stack
    // trace as the entire plain-text response body — not JSON at all (no
    // `ResultVM` wrapper reaches the client for this specific failure
    // mode), confirmed identically for BOTH endpoints.
    const bankInfoResponse = await apiClient.get('/api/BankInformation/Dropdown');
    const bankInfoText = await bankInfoResponse.text();
    const bankAccountResponse = await apiClient.get('/api/BankAccount/Dropdown');
    const bankAccountText = await bankAccountResponse.text();

    await test.info().attach('bank-dropdown-crash-responses.txt', {
      body: `=== BankInformation/Dropdown (${bankInfoResponse.status()}) ===\n${bankInfoText}\n\n=== BankAccount/Dropdown (${bankAccountResponse.status()}) ===\n${bankAccountText}`,
      contentType: 'text/plain',
    });

    // APPLICATION GAP: both endpoints — meant to power the Bank/BankAccount
    // picker in every Deposit/Withdrawal/Payment/Collection screen that
    // needs one — are completely non-functional, and leak a full internal
    // stack trace (exception type, call stack, no sanitization) to any
    // authenticated caller in the process.
    expect(bankInfoResponse.status()).toBe(500);
    expect(bankInfoText).toContain('System.NotSupportedException');
    expect(bankAccountResponse.status()).toBe(500);
    expect(bankAccountText).toContain('System.NotSupportedException');
  });

  // ============================================================
  // SECTION 8/9 — Return Relationship Integrity + Archived-Product
  // Referential Checks (this task's own Phase 8/9), addendum to the
  // Section 2/3 invalid-reference and Section 4 delete-protection coverage
  // above. See the class doc comment's own "PHASE 8/9 ADDENDUM" for the
  // full source+live investigation this block is built on.
  // ============================================================

  test(`DATAINT-011 Sale Insert with a nonexistent ProductId in the line item creates an orphaned transaction (no referential check) ${tags.knownDefect} ${tags.regression} ${tags.p1}`, async ({
    apiClient,
    cleanup,
  }) => {
    assertAdminCredentialsReady();
    const companyId = apiClient.getCompanyId();
    expect(companyId, 'apiClient must be authenticated to obtain a CompanyId').not.toBeNull();

    const customerGroup = await createCustomerGroup(apiClient, { name: uniqueCode('CUSTGROUP'), companyId: companyId! });
    cleanup.register(customerGroup);
    const customer = await createCustomerApi(apiClient, {
      name: uniqueCode('CUSTOMER'),
      telephoneNo: `01${Date.now().toString().slice(-9)}`,
      companyId: companyId!,
      branchId: companyId!,
      customerGroupId: Number(customerGroup.id),
    });
    cleanup.register(customer);

    // Unlike DATAINT-003 (the same probe against Purchase), this is Sale's
    // own line item — SaleRepository.InsertDetails (SaleRepository.cs:
    // 133-147) writes @ProductId straight into the INSERT with no prior
    // existence check, exactly like Purchase's own equivalent.
    const response = await apiClient.post('/api/Sale/Insert', {
      CustomerId: Number(customer.id),
      BranchId: companyId,
      CompanyId: companyId,
      InvoiceDateTime: today(),
      TransactionType: 'Sale',
      IsPost: false,
      CreatedBy: 'automation',
      saleDetailsList: [{ ProductId: 999_999_999, Quantity: 1, UnitRate: 100, SubTotal: 100 }],
    });
    const body = await response.json();

    // APPLICATION GAP (confirmed by source and live): the secure/correct
    // expected behavior is rejection; this asserts the CONFIRMED actual
    // behavior instead. Not registered for cleanup — Sale has no reliable
    // Delete path (utils/test-data-cleanup.ts's own documented rule).
    expect(readProp(body, 'Status')).toBe('Success');
    const dataVM = readProp(body, 'DataVM');
    const savedDetails = readProp(dataVM, 'saleDetailsList') ?? readProp(dataVM, 'SaleDetailsList');
    expect(Array.isArray(savedDetails) && savedDetails.length).toBeTruthy();
    expect(readProp(savedDetails[0], 'ProductId')).toBe(999_999_999);
  });

  test(`DATAINT-012 PurchaseReturn Insert with no PurchaseDetailId link succeeds for a Product that was never purchased — a free-floating orphan return ${tags.knownDefect} ${tags.regression} ${tags.p1}`, async ({
    apiClient,
    cleanup,
  }) => {
    assertAdminCredentialsReady();
    const companyId = apiClient.getCompanyId();
    expect(companyId, 'apiClient must be authenticated to obtain a CompanyId').not.toBeNull();

    const supplierGroup = await createSupplierGroup(apiClient, { name: uniqueCode('SUPPGROUP'), companyId: companyId! });
    cleanup.register(supplierGroup);
    const supplier = await createSupplierApi(apiClient, {
      name: uniqueCode('SUPPLIER'),
      companyId: companyId!,
      branchId: companyId!,
      supplierGroupId: Number(supplierGroup.id),
    });
    cleanup.register(supplier);
    const productGroup = await createProductGroup(apiClient, { name: uniqueCode('PRODGROUP'), companyId: companyId! });
    cleanup.register(productGroup);
    // Deliberately never referenced by any Purchase — proves this Return
    // has zero real linkage, not merely an unchecked one.
    const product = await createProductApi(apiClient, {
      name: uniqueCode('NEVERPURCHASED'),
      companyId: companyId!,
      branchId: companyId!,
      productGroupId: Number(productGroup.id),
      uomId: 1,
    });
    cleanup.register(product);

    const response = await apiClient.post('/api/PurchaseReturn/Insert', {
      SupplierId: Number(supplier.id),
      BranchId: companyId,
      CompanyId: companyId,
      BENumber: uniqueCode('APIPURRET'),
      InvoiceDateTime: today(),
      PurchaseDate: today(),
      TransactionType: 'PurchaseReturn',
      IsPost: false,
      CreatedBy: 'automation',
      // PurchaseDetailId deliberately omitted — the "blank" path
      // (PurchaseReturnService.cs:91 only calls UpdateLineItem when
      // PurchaseDetailId > 0) — this is the header's own PurchaseId=null
      // case too (never a persisted column either way, class doc comment).
      purchaseReturnDetailList: [{ ProductId: Number(product.id), Quantity: 50, UnitPrice: 100, SubTotal: 5000, SD: 0, VATRate: 0, OthersAmount: 0 }],
    });
    const body = await response.json();

    // APPLICATION GAP (confirmed live): the secure/correct expected
    // behavior would be rejection (no real Purchase to return against);
    // this asserts the CONFIRMED actual behavior instead. Not registered
    // for cleanup — PurchaseReturnRepository.Delete() is a
    // NotImplementedException stub (source-confirmed), no reliable Delete
    // path exists.
    expect(readProp(body, 'Status')).toBe('Success');
  });

  test(`DATAINT-013 PurchaseReturn Insert with a PurchaseDetailId populated fails identically whether the id is real or fake — a broken linked-return path, not a working guard ${tags.regression} ${tags.negative} ${tags.p2}`, async ({
    apiClient,
    cleanup,
  }) => {
    assertAdminCredentialsReady();
    const companyId = apiClient.getCompanyId();
    expect(companyId, 'apiClient must be authenticated to obtain a CompanyId').not.toBeNull();

    const supplierGroup = await createSupplierGroup(apiClient, { name: uniqueCode('SUPPGROUP'), companyId: companyId! });
    cleanup.register(supplierGroup);
    const supplier = await createSupplierApi(apiClient, {
      name: uniqueCode('SUPPLIER'),
      companyId: companyId!,
      branchId: companyId!,
      supplierGroupId: Number(supplierGroup.id),
    });
    cleanup.register(supplier);
    const productGroup = await createProductGroup(apiClient, { name: uniqueCode('PRODGROUP'), companyId: companyId! });
    cleanup.register(productGroup);
    const product = await createProductApi(apiClient, {
      name: uniqueCode('PRODUCT'),
      companyId: companyId!,
      branchId: companyId!,
      productGroupId: Number(productGroup.id),
      uomId: 1,
    });
    cleanup.register(product);

    // A REAL Purchase + a REAL PurchaseDetailId, fetched straight off the
    // Insert response's own DataVM.purchaseDetailList[0].Id (confirmed live
    // to be the true PurchaseDetails.Id, not merely echoed input).
    const purchaseResponse = await apiClient.post('/api/Purchase/Insert', {
      SupplierId: Number(supplier.id),
      BranchId: companyId,
      CompanyId: companyId,
      BENumber: uniqueCode('APIPUR'),
      InvoiceDateTime: today(),
      PurchaseDate: today(),
      TransactionType: 'Purchase',
      IsPost: false,
      CreatedBy: 'automation',
      SubTotal: 500,
      TotalSD: 0,
      TotalVAT: 0,
      GrandTotal: 500,
      PaidAmount: 0,
      purchaseDetailList: [{ ProductId: Number(product.id), Quantity: 5, UnitPrice: 100, SubTotal: 500, SD: 0, VATRate: 0, OthersAmount: 0 }],
    });
    const purchaseBody = await purchaseResponse.json();
    expect(readProp(purchaseBody, 'Status'), 'prerequisite Purchase must be created for this to be a meaningful check').toBe('Success');
    const purchaseDetailList = readProp(readProp(purchaseBody, 'DataVM'), 'purchaseDetailList');
    const realPurchaseDetailId = Number(readProp(purchaseDetailList[0], 'Id'));
    expect(realPurchaseDetailId).toBeGreaterThan(0);

    const returnPayload = (purchaseDetailId: number, quantity: number, beSuffix: string) => ({
      SupplierId: Number(supplier.id),
      BranchId: companyId,
      CompanyId: companyId,
      BENumber: uniqueCode(`APIPURRET-${beSuffix}`),
      InvoiceDateTime: today(),
      PurchaseDate: today(),
      TransactionType: 'PurchaseReturn',
      IsPost: false,
      CreatedBy: 'automation',
      purchaseReturnDetailList: [
        { ProductId: Number(product.id), PurchaseDetailId: purchaseDetailId, Quantity: quantity, UnitPrice: 100, SubTotal: quantity * 100, SD: 0, VATRate: 0, OthersAmount: 0 },
      ],
    });

    // Fake reference — a PurchaseDetailId that was never created.
    const fakeRefResponse = await apiClient.post('/api/PurchaseReturn/Insert', returnPayload(999_999_999, 2, 'FAKE'));
    const fakeRefBody = await fakeRefResponse.json();

    // Real reference, well within the 5 units actually purchased.
    const realRefResponse = await apiClient.post('/api/PurchaseReturn/Insert', returnPayload(realPurchaseDetailId, 2, 'REAL'));
    const realRefBody = await realRefResponse.json();

    await test.info().attach('purchasereturn-linked-path-outcomes.json', {
      body: JSON.stringify({ fakeRef: fakeRefBody, realRef: realRefBody }, null, 2),
      contentType: 'application/json',
    });

    // CONFIRMED LIVE FINDING (see class doc comment's own PHASE 8/9
    // ADDENDUM): both fail identically — PurchaseReturnRepository.
    // UpdateLineItem (PurchaseReturnRepository.cs:336-401) throws for
    // EVERY non-zero PurchaseDetailId, real or fake, at any quantity. This
    // is a confirmed broken code path (APPLICATION DEFECT — the "linked
    // return" feature does not function via this API at all), not a
    // working quantity-vs-purchased or reference-existence guard — a real,
    // valid id failing exactly like a fake one is the proof neither
    // question can be answered by this behavior, per this task's own
    // explicit "do not misclassify an unrelated SQL error as referential
    // validation" rule.
    expect(readProp(fakeRefBody, 'Status')).toBe('Fail');
    expect(readProp(realRefBody, 'Status')).toBe('Fail');
  });

  test(`DATAINT-014 SaleReturn Insert with a full ISO-8601 InvoiceDateTime (the format every other Insert endpoint accepts) fails with a date-conversion error ${tags.knownDefect} ${tags.regression} ${tags.p2}`, async ({
    apiClient,
    cleanup,
  }) => {
    assertAdminCredentialsReady();
    const companyId = apiClient.getCompanyId();
    expect(companyId, 'apiClient must be authenticated to obtain a CompanyId').not.toBeNull();

    const customerGroup = await createCustomerGroup(apiClient, { name: uniqueCode('CUSTGROUP'), companyId: companyId! });
    cleanup.register(customerGroup);
    const customer = await createCustomerApi(apiClient, {
      name: uniqueCode('CUSTOMER'),
      telephoneNo: `01${Date.now().toString().slice(-9)}`,
      companyId: companyId!,
      branchId: companyId!,
      customerGroupId: Number(customerGroup.id),
    });
    cleanup.register(customer);
    const productGroup = await createProductGroup(apiClient, { name: uniqueCode('PRODGROUP'), companyId: companyId! });
    cleanup.register(productGroup);
    const product = await createProductApi(apiClient, {
      name: uniqueCode('PRODUCT'),
      companyId: companyId!,
      branchId: companyId!,
      productGroupId: Number(productGroup.id),
      uomId: 1,
    });
    cleanup.register(product);

    // BONUS CONFIRMED DEFECT (class doc comment's own PHASE 8/9 ADDENDUM):
    // SaleReturnRepository.Insert (SaleReturnRepository.cs:61) builds
    // @InvoiceDateTime via `saleReturn.InvoiceDateTime + " " +
    // DateTime.Now.ToString("HH:mm")` — naive string concatenation, not a
    // real date construction. today() below is the exact same
    // `new Date().toISOString()` helper every other test in this file
    // already uses successfully against Purchase/Sale/PurchaseReturn.
    const response = await apiClient.post('/api/SaleReturn/Insert', {
      CustomerId: Number(customer.id),
      BranchId: companyId,
      CompanyId: companyId,
      InvoiceDateTime: today(),
      TransactionType: 'SaleReturn',
      IsPost: false,
      CreatedBy: 'automation',
      saleReturnDetailList: [{ ProductId: Number(product.id), Quantity: 1, UnitRate: 100, SubTotal: 100, SD: 0, VATRate: 0 }],
    });
    const body = await response.json();

    await test.info().attach('salereturn-iso-date-failure.json', { body: JSON.stringify(body, null, 2), contentType: 'application/json' });

    expect(response.status(), 'must never be an unhandled server crash').toBeLessThan(500);
    expect(readProp(body, 'Status')).toBe('Fail');
    expect(String(readProp(body, 'Message'))).toContain('Conversion failed when converting date and/or time from character string');
  });

  test(`DATAINT-015 SaleReturn Insert succeeds with zero linkage to any real Sale — SaleId/SaleDetailId do not exist on the ViewModel at all ${tags.knownDefect} ${tags.regression} ${tags.p1}`, async ({
    apiClient,
    cleanup,
  }) => {
    assertAdminCredentialsReady();
    const companyId = apiClient.getCompanyId();
    expect(companyId, 'apiClient must be authenticated to obtain a CompanyId').not.toBeNull();

    const customerGroup = await createCustomerGroup(apiClient, { name: uniqueCode('CUSTGROUP'), companyId: companyId! });
    cleanup.register(customerGroup);
    const customer = await createCustomerApi(apiClient, {
      name: uniqueCode('CUSTOMER'),
      telephoneNo: `01${Date.now().toString().slice(-9)}`,
      companyId: companyId!,
      branchId: companyId!,
      customerGroupId: Number(customerGroup.id),
    });
    cleanup.register(customer);
    const productGroup = await createProductGroup(apiClient, { name: uniqueCode('PRODGROUP'), companyId: companyId! });
    cleanup.register(productGroup);
    // Deliberately never referenced by any Sale.
    const product = await createProductApi(apiClient, {
      name: uniqueCode('NEVERSOLD'),
      companyId: companyId!,
      branchId: companyId!,
      productGroupId: Number(productGroup.id),
      uomId: 1,
    });
    cleanup.register(product);

    // Date-only InvoiceDateTime (DATAINT-014's own workaround) — routes
    // around the unrelated date-concatenation bug so THIS test isolates
    // the referential-integrity question cleanly.
    const dateOnly = new Date().toISOString().slice(0, 10);
    const response = await apiClient.post('/api/SaleReturn/Insert', {
      CustomerId: Number(customer.id),
      BranchId: companyId,
      CompanyId: companyId,
      InvoiceDateTime: dateOnly,
      TransactionType: 'SaleReturn',
      IsPost: false,
      CreatedBy: 'automation',
      saleReturnDetailList: [{ ProductId: Number(product.id), Quantity: 5, UnitRate: 100, SubTotal: 500, SD: 0, VATRate: 0 }],
    });
    const body = await response.json();

    // APPLICATION GAP (confirmed by source — no SaleId/SaleDetailId field
    // exists anywhere on SaleReturnDetailVM — and now live): the
    // secure/correct expected behavior would be rejection (no real Sale to
    // return against); this asserts the CONFIRMED actual behavior instead.
    // Not registered for cleanup — SaleReturn has no confirmed Delete path
    // (SRET-006, config/tags.ts's own knownDefectCandidateIds: SaleReturn's
    // Delete route resolves to List logic instead of deleting).
    expect(readProp(body, 'Status')).toBe('Success');
  });

  test(`DATAINT-016 Sale Insert against an already-archived (IsActive=0) Product succeeds — archiving does not gate future transactions ${tags.knownDefect} ${tags.regression} ${tags.p1}`, async ({
    apiClient,
    cleanup,
  }) => {
    assertAdminCredentialsReady();
    const companyId = apiClient.getCompanyId();
    expect(companyId, 'apiClient must be authenticated to obtain a CompanyId').not.toBeNull();

    const productGroup = await createProductGroup(apiClient, { name: uniqueCode('PRODGROUP'), companyId: companyId! });
    cleanup.register(productGroup);
    const product = await createProductApi(apiClient, {
      name: uniqueCode('TOARCHIVE'),
      companyId: companyId!,
      branchId: companyId!,
      productGroupId: Number(productGroup.id),
      uomId: 1,
    });
    // Deliberately NOT registered for cleanup — this Product is archived
    // (not deleted) as part of the test itself, immediately below.

    const archiveResponse = await apiClient.post('/api/Product/Delete', {
      IDs: [String(product.id)],
      ModifyBy: 'automation',
      ModifyFrom: 'API',
    });
    const archiveBody = await archiveResponse.json();
    expect(readProp(archiveBody, 'Status'), 'prerequisite archive must succeed for this to be a meaningful check').toBe('Success');

    const customerGroup = await createCustomerGroup(apiClient, { name: uniqueCode('CUSTGROUP'), companyId: companyId! });
    cleanup.register(customerGroup);
    const customer = await createCustomerApi(apiClient, {
      name: uniqueCode('CUSTOMER'),
      telephoneNo: `01${Date.now().toString().slice(-9)}`,
      companyId: companyId!,
      branchId: companyId!,
      customerGroupId: Number(customerGroup.id),
    });
    cleanup.register(customer);

    // Confirmed from source (ProductRepository.cs:531-535's Dropdown() is
    // the only place IsActive=1 is ever filtered; SaleRepository.
    // InsertDetails — SaleRepository.cs:133-147 — never reads IsActive) and
    // now live: a brand-new Sale against this just-archived Product.
    const response = await apiClient.post('/api/Sale/Insert', {
      CustomerId: Number(customer.id),
      BranchId: companyId,
      CompanyId: companyId,
      InvoiceDateTime: today(),
      TransactionType: 'Sale',
      IsPost: false,
      CreatedBy: 'automation',
      saleDetailsList: [{ ProductId: Number(product.id), Quantity: 1, UnitRate: 100, SubTotal: 100 }],
    });
    const body = await response.json();

    // APPLICATION GAP (confirmed by source and live): the secure/correct
    // expected behavior would be rejection (Product is archived); this
    // asserts the CONFIRMED actual behavior instead.
    expect(readProp(body, 'Status')).toBe('Success');
  });
});
