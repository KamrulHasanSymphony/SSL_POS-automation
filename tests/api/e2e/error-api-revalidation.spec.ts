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
 * STEP ERROR-HANDLING-RECOVERY-REVALIDATION
 *
 * Re-validates every API-level finding `error-api-validation.spec.ts`
 * ("the previous lifecycle") already established (ERRVAL-001..006), plus
 * this task's own additional Phase 4-9 scenarios (duplicate BE Number,
 * rollback re-test, failed-response Id contract, Purchase/List zero-result
 * crash) — a pure re-measurement exercise per this task's own rules: no
 * application/API/SQL/database change, no direct DB access, no fabricated
 * response. Reuses `fixtures/base.fixture`'s `apiClient` + `utils/
 * test-data-setup.ts` (the SAME helper `error-api-validation.spec.ts`/
 * `data-integrity-validation.spec.ts` already use) rather than
 * `SecurityApiClient.ts` — that class is deliberately scoped to raw
 * auth-boundary probing (no cleanup-fixture integration, no
 * prerequisite-payload builders), a worse fit for this file's own
 * CRUD-with-cleanup revalidation shape, per this task's own "reuse... or
 * another existing helper" instruction.
 *
 * PHASE 1/2 RE-VERIFICATION (every one of the previous lifecycle's own
 * findings independently re-confirmed LIVE before writing a single
 * assertion here — none assumed still true; every citation a file:line or
 * live-response fact):
 *
 * - ERRVAL-001/002 (missing/non-numeric SupplierId -> 400): re-confirmed
 *   live, unchanged — `PurchaseVM.SupplierId`'s `[Required]` +
 *   `[ApiController]`'s automatic model validation still rejects both
 *   before `PurchaseController.Insert`'s own action body runs.
 * - ERRVAL-003 (Sale nonexistent CustomerId): re-confirmed live, unchanged
 *   — `Status: "Success"`, a real orphaned Sale persists.
 * - ERRVAL-004 (Sale Quantity far exceeding 0 on-hand stock): re-confirmed
 *   live, unchanged — `Status: "Success"`, no server-side stock check
 *   exists anywhere in `SaleRepository.cs`/`SaleService.cs` (re-grepped
 *   fresh for this file: zero `StockInHand`/`ProductStock`/`CurrentStock`/
 *   `AvailableStock` matches).
 * - ERRVAL-005 (Purchase invalid ProductId): RE-VERIFIED WITH A CORRECTED,
 *   MORE PRECISE PAYLOAD than the previous lifecycle's own attempt — the
 *   original ERRVAL-005 happened to omit `OthersAmount`, which forces a
 *   DIFFERENT failure (a missing SQL parameter, re-tested separately below
 *   as ERR-REVAL-008/rollback) that is real, reproducible evidence for
 *   TRANSACTION ROLLBACK but was never actually proof of a referential
 *   check on `ProductId` itself (already flagged as this exact caveat in
 *   `data-integrity-validation.spec.ts`'s own class doc comment for
 *   DATAINT-003). This file's own ERR-REVAL-003 below supplies every OTHER
 *   field a real Save would (`OthersAmount` included), isolating the
 *   ProductId question cleanly: confirmed live — invalid ProductId is
 *   ACCEPTED (`Status: "Success"`) when the rest of the payload is
 *   well-formed. Referential-integrity gap on Purchase.ProductId is STILL
 *   PRESENT, now proven cleanly rather than conflated with the rollback
 *   finding.
 * - ERRVAL-006 (PurchaseDate < InvoiceDateTime): re-confirmed live,
 *   unchanged — the exact same message, typo included
 *   ("Purchase Date cannot be smaller then Invoice Date!").
 * - Duplicate Purchase BE Number: re-confirmed live, unchanged — a second
 *   Insert reusing the same BE Number returns `Status: "Success"` again,
 *   `PurchaseService.cs` still contains zero `CheckExists`/`Exists(` calls
 *   (re-grepped fresh for this file).
 * - Transaction rollback: re-confirmed live, unchanged — a genuine
 *   detail-insert failure (missing `@OthersAmount` SQL parameter, the
 *   SAME reproducible trigger the previous lifecycle used) still rolls the
 *   shared `SqlTransaction` back before returning `Status: "Fail"`.
 * - Failed-response Id leak: re-confirmed live, unchanged — the SAME
 *   rollback response above still carries the pre-rollback master `Id` in
 *   its top-level `Id` field (e.g. `"3220"`), despite `Status: "Fail"` and
 *   despite that row never actually existing after rollback.
 * - Purchase/List zero-result crash: re-confirmed live AND newly
 *   root-caused to the exact line (`PurchaseService.cs:735-798`'s own
 *   `List()`): when the underlying repository query matches zero rows,
 *   `lst` (`List<PurchaseVM>`) is empty, and line 765's
 *   `lst.FirstOrDefault().purchaseDetailList = details;` throws a
 *   `NullReferenceException` on the null `FirstOrDefault()` result — caught
 *   by the SAME method's own outer `catch`, which overwrites `Message`/
 *   `ExMessage` with the raw exception text but NEVER resets `Status` back
 *   to `"Fail"` (line 787-788 only touch `Message`/`ExMessage`) — the exact
 *   source of the live-confirmed, contract-breaking shape
 *   `Status: "Success"` + a raw `NullReferenceException` message in the
 *   same response.
 * - No server-side logging framework: re-confirmed by a fresh grep (not
 *   reused from a prior finding) of the current `ShampanPOS`/
 *   `ShampanPOS.Service`/`ShampanPOS.Repository` tree for `ILogger`,
 *   `Serilog`, `NLog`, `ApplicationInsights` — zero matches; no
 *   `UseExceptionHandler` in `Program.cs`; no logging package referenced in
 *   `ShampanPOS.csproj`. Unchanged.
 */
test.describe('Independent API checks — Error Handling & Recovery Re-validation', () => {
  test(`ERR-REVAL-001 Purchase Insert with SupplierId omitted is still rejected with 400 ${tags.regression} ${tags.negative} ${tags.p1}`, async ({
    apiClient,
  }) => {
    assertAdminCredentialsReady();
    const companyId = apiClient.getCompanyId();
    expect(companyId, 'apiClient must be authenticated to obtain a CompanyId').not.toBeNull();

    const response = await apiClient.post('/api/Purchase/Insert', {
      BranchId: companyId,
      CompanyId: companyId,
      BENumber: uniqueCode('APIPUR'),
      InvoiceDateTime: today(),
      PurchaseDate: today(),
      TransactionType: 'Purchase',
      IsPost: false,
      CreatedBy: 'automation',
      // SupplierId deliberately omitted.
    });

    // FIXED vs STILL PRESENT: this is the "Secure/Expected" baseline case —
    // still correctly rejected, unchanged from the previous lifecycle.
    expect(response.status()).toBe(400);
  });

  test(`ERR-REVAL-002 Purchase Insert with a non-numeric SupplierId is still rejected with 400 ${tags.regression} ${tags.negative} ${tags.p2}`, async ({
    apiClient,
  }) => {
    assertAdminCredentialsReady();
    const companyId = apiClient.getCompanyId();
    expect(companyId, 'apiClient must be authenticated to obtain a CompanyId').not.toBeNull();

    const response = await apiClient.post('/api/Purchase/Insert', {
      SupplierId: 'not-a-number',
      BranchId: companyId,
      CompanyId: companyId,
      BENumber: uniqueCode('APIPUR'),
      InvoiceDateTime: today(),
      PurchaseDate: today(),
      TransactionType: 'Purchase',
      IsPost: false,
      CreatedBy: 'automation',
    });

    expect(response.status()).toBe(400);
  });

  test(`ERR-REVAL-003 Purchase Insert with an invalid ProductId (otherwise well-formed) is still accepted — referential gap confirmed STILL PRESENT ${tags.knownDefect} ${tags.regression} ${tags.p1}`, async ({
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

    // Every OTHER PurchaseDetailVM field a real Save would populate is
    // supplied explicitly (OthersAmount included) — isolates the ProductId
    // question cleanly, unlike the previous lifecycle's own ERRVAL-005
    // (class doc comment).
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

    // STILL PRESENT (Category C): the secure/correct behavior is rejection;
    // this asserts the CONFIRMED actual behavior instead.
    expect(readProp(body, 'Status')).toBe('Success');
  });

  test(`ERR-REVAL-004 Sale Insert with a nonexistent CustomerId is still accepted — STILL PRESENT ${tags.knownDefect} ${tags.regression} ${tags.p1}`, async ({
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

    expect(readProp(body, 'Status')).toBe('Success');
  });

  test(`ERR-REVAL-005 Sale Insert with Quantity far exceeding on-hand stock (0) is still accepted — no server-side stock check, STILL PRESENT ${tags.knownDefect} ${tags.regression} ${tags.p1}`, async ({
    apiClient,
    cleanup,
  }) => {
    assertAdminCredentialsReady();
    const companyId = apiClient.getCompanyId();
    expect(companyId, 'apiClient must be authenticated to obtain a CompanyId').not.toBeNull();

    const productGroup = await createProductGroup(apiClient, { name: uniqueCode('PRODGROUP'), companyId: companyId! });
    cleanup.register(productGroup);
    // A brand-new Product, never purchased/stocked — on-hand stock is 0.
    const product = await createProductApi(apiClient, {
      name: uniqueCode('NOSTOCK'),
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

    // Deliberately NOT a wastefully huge quantity — 500 units against a
    // Product with 0 confirmed on-hand stock is already sufficient live
    // proof; no destructive/unnecessarily large transaction is created.
    const response = await apiClient.post('/api/Sale/Insert', {
      CustomerId: Number(customer.id),
      BranchId: companyId,
      CompanyId: companyId,
      InvoiceDateTime: today(),
      TransactionType: 'Sale',
      IsPost: false,
      CreatedBy: 'automation',
      saleDetailsList: [{ ProductId: Number(product.id), Quantity: 500, UnitRate: 100, SubTotal: 50_000 }],
    });
    const body = await response.json();

    expect(readProp(body, 'Status')).toBe('Success');
  });

  test(`ERR-REVAL-006 Purchase Insert with PurchaseDate before InvoiceDateTime still returns the same clean, intentional business message ${tags.regression} ${tags.p2}`, async ({
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

    const invoiceDate = new Date();
    const purchaseDateBeforeInvoice = new Date(invoiceDate.getTime() - 24 * 60 * 60 * 1000);

    const response = await apiClient.post('/api/Purchase/Insert', {
      SupplierId: Number(supplier.id),
      BranchId: companyId,
      CompanyId: companyId,
      BENumber: uniqueCode('APIPUR'),
      InvoiceDateTime: invoiceDate.toISOString(),
      PurchaseDate: purchaseDateBeforeInvoice.toISOString(),
      TransactionType: 'Purchase',
      IsPost: false,
      CreatedBy: 'automation',
      purchaseDetailList: [],
    });
    const body = await response.json();

    // STILL PRESENT as Secure/Expected behavior — unchanged.
    expect(readProp(body, 'Status')).toBe('Fail');
    expect(readProp(body, 'Message')).toBe('Purchase Date cannot be smaller then Invoice Date!');
  });

  test(`ERR-REVAL-007 Duplicate Purchase BE Number is still NOT blocked — STILL PRESENT ${tags.knownDefect} ${tags.regression} ${tags.p1}`, async ({
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
    expect(readProp(firstBody, 'Status'), 'prerequisite Purchase must succeed for this to be a meaningful duplicate check').toBe('Success');

    const second = await apiClient.post('/api/Purchase/Insert', purchasePayload(sharedBeNumber));
    const secondBody = await second.json();

    expect(readProp(secondBody, 'Status')).toBe('Success');
  });

  test(`ERR-REVAL-008 Purchase Insert failure during detail insert still rolls back the master, but still leaks the pre-rollback Id ${tags.regression} ${tags.negative} ${tags.p0}`, async ({
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

    // Same reproducible trigger as the previous lifecycle's own ERRVAL-005:
    // OthersAmount deliberately omitted forces a missing-SQL-parameter
    // failure inside InsertDetails, exercised here for TWO distinct
    // Phase 6/7 questions at once (rollback completeness + Id-leak
    // contract), not the ProductId referential question (ERR-REVAL-003
    // above isolates that cleanly instead).
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
    const exMessage = String(readProp(body, 'ExMessage') ?? '');

    await test.info().attach('err-reval-008-rollback-response.json', { body: JSON.stringify(body, null, 2), contentType: 'application/json' });

    // PHASE 6 — rollback mechanism itself: STILL WORKS (Secure/Expected).
    expect(status).toBe('Fail');

    // PHASE 7 — failed-response contract: STILL PRESENT (Category C). The
    // secure/correct behavior would be Id: "0"/null on a Fail response;
    // this asserts the CONFIRMED actual behavior instead — a real,
    // pre-rollback master Id still leaks through.
    expect(leakedId, 'the pre-rollback master Id is still leaked into a Fail response').not.toBe('0');
    expect(Number(leakedId)).toBeGreaterThan(0);

    // PHASE 8 — error information disclosure: STILL PRESENT (Category C).
    // Raw internal detail (SQL parameter name) plus a full .NET stack
    // trace, including the internal source file path and line number.
    expect(exMessage).toContain('.cs:line');
    expect(exMessage).toMatch(/System\.Exception|SqlException|parameter/i);

    // PHASE 9 (orphan check) — independently confirm the leaked Id is not
    // listable, i.e. genuinely rolled back, not merely mis-reported. Uses
    // the application's OWN List endpoint (no direct DB query, per this
    // task's own rules) — wrapped, since ERR-REVAL-009 below independently
    // proves this exact endpoint crashes on a zero-result lookup (a
    // separate, already-captured finding, not allowed to turn this
    // rollback check into a false failure).
    if (Number(leakedId) > 0) {
      const listResponse = await apiClient.post('/api/Purchase/List', { Id: String(leakedId) });
      const listBody = await listResponse.json();
      await test.info().attach('err-reval-008-rollback-orphan-check.json', { body: JSON.stringify(listBody, null, 2), contentType: 'application/json' });
      // Never a real, successfully-returned Purchase record for the
      // rolled-back Id (either a clean empty result or the zero-result
      // crash — both are consistent with "no such row exists"; a genuine
      // matching PurchaseVM row in DataVM would be the one outcome that
      // actually disproves rollback).
      const dataVM = readProp(listBody, 'DataVM');
      const returnedPurchases = Array.isArray(dataVM) ? dataVM : dataVM ? [dataVM] : [];
      expect(returnedPurchases.some((p: unknown) => String(readProp(p, 'Id')) === String(leakedId))).toBe(false);
    }
  });

  test(`ERR-REVAL-009 Purchase List with a guaranteed nonexistent Id still throws a NullReferenceException instead of a clean empty result ${tags.knownDefect} ${tags.regression} ${tags.p1}`, async ({
    apiClient,
  }) => {
    assertAdminCredentialsReady();
    const companyId = apiClient.getCompanyId();
    expect(companyId, 'apiClient must be authenticated to obtain a CompanyId').not.toBeNull();

    const response = await apiClient.post('/api/Purchase/List', { Id: '999999999' });
    const body = await response.json();

    await test.info().attach('err-reval-009-zero-result-response.json', { body: JSON.stringify(body, null, 2), contentType: 'application/json' });

    // STILL PRESENT (Category C), root-caused to PurchaseService.cs:765
    // (`lst.FirstOrDefault().purchaseDetailList = ...` on an empty list) —
    // see class doc comment. Never a raw crash reaching the client as an
    // unhandled 500 (the outer catch in PurchaseService.List() does catch
    // it), but the CONTRACT itself is broken: Status stays "Success" while
    // Message/ExMessage carry a raw NullReferenceException — asserting the
    // CONFIRMED actual behavior, not the clean-empty-result contract this
    // task's own Phase 9 describes as the secure expectation.
    expect(response.status(), 'must never be an unhandled server crash').toBeLessThan(500);
    expect(String(readProp(body, 'ExMessage') ?? '')).toContain('NullReferenceException');
    // The exact contract-inconsistency this class doc comment documents:
    // Status still reads "Success" despite the exception.
    expect(readProp(body, 'Status')).toBe('Success');
    expect(String(readProp(body, 'Message') ?? '')).toContain('Object reference not set');
  });
});
