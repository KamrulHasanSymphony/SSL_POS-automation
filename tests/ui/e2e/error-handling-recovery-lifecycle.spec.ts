import { test, expect } from '../../../fixtures/purchase-lifecycle.fixture';
import { assertAdminCredentialsReady } from '../../../utils/env';
import { uniqueCode, randomData } from '../../../utils/random-data';
import { routes, apiMessages } from '../../../utils/constants';
import { KendoLineItemGrid } from '../../../components/common-grid/KendoLineItemGrid';

/**
 * STEP ERROR-HANDLING-RECOVERY-LIFECYCLE-INVESTIGATION-AND-VALIDATION
 *
 * Cross-module E2E Error Handling & Recovery lifecycle: Login -> Invalid
 * Product Creation -> Validation Verification -> Invalid Purchase Attempt
 * -> Error Message Verification -> Failed Transaction Verification -> Valid
 * Transaction Creation -> Duplicate Transaction Attempt -> API Invalid
 * Request Test -> Error Logging Verification -> Logout. Investigation +
 * validation only, per this task's own rules — no application/database
 * code is touched, no DB cleanup shortcut, no fake API response.
 *
 * PHASE 1 INVESTIGATION FINDINGS (confirmed exhaustively from source before
 * this spec's first run — every citation below is a file:line fact, not an
 * assumption; full detail in this project's SSL_POS_Api source and cross-
 * referenced against ShampanPOSUI's client-side JS):
 *
 * - ARCHITECTURE: `ShampanPOSUI`'s own "repo" layer (`ShampanPOS.Repo/*.cs`,
 *   e.g. `PurchaseRepo.cs`) is a THIN HTTP CLIENT — every method just POSTs
 *   to the exact same `SSL_POS_Api` REST endpoints this project's `tests/api/*`
 *   suite already calls directly (`HttpRequestHelper.PostData("api/Purchase/Insert", ...)`).
 *   The UI and the API are NOT two independent implementations — a UI
 *   Create/Save ultimately hits the identical Controller/Service/Repository
 *   code path this spec's own investigation reads from. This is why a
 *   server-side rule (e.g. the duplicate-Name check) is reachable and
 *   provable through the real UI, not only via a raw API call.
 *
 * - REQUIRED-FIELD VALIDATION already has thorough atomic coverage
 *   (`tests/ui/masters/product.spec.ts` PROP-PROD-003/004/005, `tests/ui/purchase/purchase.spec.ts`
 *   PROP-PUR-003/004, `tests/ui/sales/sale.spec.ts` PROP-SALE-003,
 *   `tests/ui/banking/payment.spec.ts` PROP-PAY-003, `tests/ui/banking/collection.spec.ts`
 *   PROP-COL-003) — this spec exercises ONE representative case per module
 *   (Product Name, Purchase Supplier) inline, as steps of one continuous
 *   narrative, rather than re-asserting the full matrix those files already
 *   own.
 *
 * - NEGATIVE-NUMBER HANDLING DIFFERS PER MODULE (confirmed live from
 *   `Areas/DMS/js/Controllers/*.js`, not assumed uniform): Purchase's
 *   Quantity/OthersAmount cell editors have an explicit `if (value < 0)`
 *   guard that resets the cell AND fires a live toastr
 *   ("Negative quantity is not allowed." / "Negative value is not allowed.") —
 *   already covered by `PurchasePage.expectNegativeQuantityRejected()`
 *   (PROP-PUR-005). Sale's Quantity/UnitRate editors, and Payment's/
 *   Collection's own Amount editors, are all plain
 *   `kendoNumericTextBox({ min: 0(.01) })` with NO `if (value < 0)`/toastr
 *   handler at all — Kendo's own `min` option silently clamps a negative
 *   entry to 0 with no user-visible error whatsoever. This spec's own Step
 *   4b is the first live check of that silent-clamp behavior for Sale
 *   (previously confirmed from source only).
 *
 * - DUPLICATE-CHECK SCOPE DIFFERS PER MODULE (confirmed from
 *   `ShampanPOS.Service/*.cs`, `CommonRepository.CheckExists`): Product and
 *   Supplier both do a GLOBAL (not company-scoped) duplicate check on Name
 *   alone; Customer checks TelephoneNo+IsActive instead of Name (already
 *   covered by `tests/api/duplicate-validation.spec.ts`, PROP-API-004/005/006).
 *   Purchase has NO duplicate check on BE Number/Invoice Number at all —
 *   confirmed absent from `PurchaseService.cs` (zero `CheckExists`/`Exists(`
 *   call anywhere in that file). This spec's own Step 6 exercises the
 *   Product case live THROUGH THE UI (new ground — the existing API suite
 *   only exercises this via raw API calls).
 *
 * - EXCEPTION LOGGING: the API project has NO ELMAH/Serilog/NLog/ILogger
 *   equivalent whatsoever (confirmed: zero logging-framework package in
 *   `SSL_POS_Api/ShampanPOS/ShampanPOS.csproj`, no `UseExceptionHandler`/
 *   middleware in `Program.cs`). Every controller's own `catch (Exception ex)`
 *   puts `ex.Message` (and, one layer down in several Services,
 *   `ex.ToString()` — the full stack trace) directly into the JSON response
 *   body's `Message`/`ExMessage` fields — there is no server-side log at
 *   all for an API-layer exception; the client-visible response IS the only
 *   record. The UI project's own ELMAH (`ShampanPOSUI/Web.config`'s
 *   `<elmah>` section) is SQL-backed with `allowRemoteAccess="false"` — a
 *   real log exists there, but only for UI-side exceptions, not API ones,
 *   and only reachable from the server's own localhost. Step 8 re-confirms
 *   that remote-access restriction live.
 *
 * - TRANSACTION ROLLBACK: `PurchaseService.Insert()`/`SaleService.Insert()`
 *   each open ONE shared `SqlTransaction` and pass it into both the master
 *   `Insert()` call and every line item's `InsertDetails()` call — a
 *   detail-insert failure throws, is caught by the ONE outer catch, and
 *   `transaction.Rollback()` runs before any response is returned. This is
 *   confirmed source-correct for both modules — see
 *   `tests/api/e2e/error-api-validation.spec.ts`'s own class doc comment
 *   for the live API-level proof of this exact mechanism (a UI-only test
 *   cannot safely force a detail-insert failure without an invalid Product,
 *   which the UI's own product picker cannot select in the first place —
 *   this is why that verification lives in the API spec, not here).
 */
test.describe('E2E Error Handling & Recovery Lifecycle', () => {
  test('Login, invalid entry rejection, valid transaction, duplicate detection, API/error-logging checks reconcile end-to-end', async ({
    dashboardPage,
    branchSelectPage,
    loginPage,
    supplierPrerequisites,
    supplierPage,
    customerPrerequisites,
    customerPage,
    productPrerequisites,
    productPage,
    purchasePage,
    salePage,
    apiClient,
    page,
  }) => {
    // Same empirical reasoning as every other lifecycle spec's own
    // test.setTimeout: 2 rejected attempts, 1 full valid transaction + Post,
    // a duplicate-creation round trip, and an API/ELMAH check comfortably
    // exceeds the global 60s default.
    test.setTimeout(180_000);
    assertAdminCredentialsReady();

    // ============================================================
    // 1. LOGIN — see every other lifecycle spec's own identical step-1
    // comment for the full source+network-trace-backed root cause.
    // ============================================================
    await dashboardPage.changeBranch();
    await branchSelectPage.resolveIfPresent();
    await dashboardPage.expectLoaded();

    // ============================================================
    // 2. INVALID PRODUCT CREATION -> VALIDATION VERIFICATION — Scenario 1
    // (Required Field Validation), Product module. Save is attempted with
    // NO fields filled at all.
    // ============================================================
    await productPage.gotoCreate();
    await productPage.clickSave();
    await productPage.expectNameRequiredValidation();
    // Save blocked: no navigation away from Create, matching this task's
    // own "No transaction created" expectation.
    await expect(page).toHaveURL(/\/DMS\/Product\/Create/i);

    // ============================================================
    // 3. INVALID PURCHASE ATTEMPT -> ERROR MESSAGE VERIFICATION — Scenario 1
    // (Purchase without Supplier) then Scenario 2 (negative Quantity),
    // continuing on the SAME unsaved Create form.
    // ============================================================
    await purchasePage.gotoCreate();
    await purchasePage.clickSave();
    await purchasePage.expectSupplierRequiredIndicated();
    await expect(page).toHaveURL(/\/DMS\/Purchase\/Create/i);
    // No transaction created: the server-generated #Code field is still empty.
    expect(await purchasePage.getCode()).toBe('');

    const { supplierGroupName } = await supplierPrerequisites();
    const supplierName = uniqueCode('SUPPLIER');
    await supplierPage.createSupplier({
      name: supplierName,
      supplierGroupName,
      address: `Automation Address ${uniqueCode('ADDR')}`,
    });

    const { productGroupName, uomName } = await productPrerequisites();
    const productName = uniqueCode('PRODUCT');
    await productPage.createProduct({ name: productName, productGroupName, uomName, purchasePrice: 100, salePrice: 150 });

    await purchasePage.gotoCreate();
    await purchasePage.selectSupplier(supplierName);
    // FULL-REGRESSION-RUN FIX (confirmed automation defect): #BENumber is
    // `<input type="number">` — `uniqueCode('PUR')` contains letters and
    // fails outright ("Cannot type text into input[type=number]"), first
    // caught live when this spec ran inside the full regression suite.
    // String(Date.now()) matches the same fix already proven elsewhere in
    // this project (purchase-lifecycle.spec.ts/banking.fixture.ts) for this
    // exact field.
    await purchasePage.fillBeNumber(String(Date.now()));
    await purchasePage.fillDates();
    const negativeRow = await purchasePage.lineItems.addRow();
    await purchasePage.lineItems.selectProductForRow(negativeRow, productName);
    // Scenario 2 — Negative Quantity Validation: confirmed live toastr
    // rejection ("Negative quantity is not allowed."), PurchasePage's own
    // already-proven method (PROP-PUR-005).
    await purchasePage.expectNegativeQuantityRejected(negativeRow);

    // ============================================================
    // 4a. FAILED TRANSACTION VERIFICATION — after both the missing-Supplier
    // attempt and the negative-Quantity rejection above, no Purchase record
    // exists: still on the Create screen, #Code still empty. Verified via
    // the application's own rendered form state — no DB query, per this
    // task's own rules.
    // ============================================================
    await expect(page).toHaveURL(/\/DMS\/Purchase\/Create/i);
    expect(await purchasePage.getCode()).toBe('');

    // ============================================================
    // 4b. NUMERIC VALIDATION CONTRAST — Sale's own Quantity editor
    // (class doc comment: confirmed from source to have NO `if (value < 0)`/
    // toastr guard, unlike Purchase's). First live check of this: setting a
    // negative Quantity is expected to be SILENTLY clamped to 0 by Kendo's
    // own `min` option, with no error message shown at all — a real,
    // documented client-side-validation gap, not a crash.
    // ============================================================
    const { customerGroupName } = await customerPrerequisites();
    const customerName = uniqueCode('CUSTOMER');
    await customerPage.createCustomer({
      name: customerName,
      customerGroupName,
      telephoneNo: randomData.phone11Digit(),
      email: randomData.email('customer'),
      address: `Automation Address ${uniqueCode('ADDR')}`,
    });

    await salePage.gotoCreate();
    await salePage.selectCustomer(customerName);
    const saleRow = await salePage.lineItems.addRow();
    await salePage.lineItems.selectProductForRow(saleRow, productName);
    await salePage.lineItems.setQuantity(saleRow, -5);
    const clampedQuantityCell = await salePage.lineItems.quantityCell(saleRow);
    const clampedQuantity = await KendoLineItemGrid.cellValue(clampedQuantityCell);
    expect(clampedQuantity).toBeGreaterThanOrEqual(0);
    // No toastr error is expected for this specific case (documented gap,
    // not asserted as a defect here — this task is investigation/
    // documentation only, not a fix).

    // ============================================================
    // 5. VALID TRANSACTION CREATION — a genuine, correctly-filled Purchase,
    // saved and posted, giving Step 6 something real to duplicate against
    // and proving the failed attempts above did not leave the form/session
    // in a broken state.
    // ============================================================
    await purchasePage.gotoCreate();
    await purchasePage.selectSupplier(supplierName);
    await purchasePage.fillBeNumber(String(Date.now()));
    await purchasePage.fillDates();
    const validRow = await purchasePage.lineItems.addRow();
    await purchasePage.lineItems.selectProductForRow(validRow, productName);
    await purchasePage.lineItems.setQuantity(validRow, 10);
    await purchasePage.clickSave();
    await page.waitForURL(/\/DMS\/Purchase\/Edit/i);
    const purchaseCode = await purchasePage.getCode();
    expect(purchaseCode).not.toHaveLength(0);
    await purchasePage.post();

    // ============================================================
    // 6. DUPLICATE TRANSACTION ATTEMPT — Scenario 3, Product module.
    // Confirmed from source (ProductService.cs's CheckExists call): a
    // second Product Insert with the same Name anywhere in the company is
    // rejected with "Data Already Exist!" — already proven via a raw API
    // call (tests/api/duplicate-validation.spec.ts, PROP-API-004). This is
    // the first live proof that the SAME rejection surfaces through the
    // real UI Save flow (class doc comment's "architecture" finding: the UI
    // proxies to the identical endpoint).
    // ============================================================
    const duplicateName = uniqueCode('DUPPRODUCT');
    await productPage.createProduct({ name: duplicateName, productGroupName, uomName });

    await productPage.gotoCreate();
    await productPage.fillName(duplicateName);
    await productPage.selectProductGroup(productGroupName);
    await productPage.selectUom(uomName);
    await productPage.clickSave();
    await productPage.toastr.expectError(apiMessages.duplicateDataExists);
    // No duplicate record created: Save did not navigate to a new Edit page.
    await expect(page).toHaveURL(/\/DMS\/Product\/Create/i);

    // ============================================================
    // 7. API INVALID REQUEST TEST — Scenario 5, lightweight check within
    // this UI-authenticated session (the full server-side validation matrix
    // is covered in depth by tests/api/e2e/error-api-validation.spec.ts;
    // this step only confirms the same authenticated session's API calls
    // fail cleanly, not with a raw crash). Confirmed from source
    // (PurchaseVM.SupplierId: `[Required(ErrorMessage = "Supplier is
    // required")]`, combined with [ApiController]'s automatic model-state
    // validation, never suppressed anywhere in Program.cs) that omitting
    // SupplierId is rejected by the FRAMEWORK itself, before the
    // controller's own action (and its raw-exception-message catch block)
    // ever runs.
    // ============================================================
    const invalidPurchaseResponse = await apiClient.post('/api/Purchase/Insert', {
      BranchId: 1,
      BENumber: uniqueCode('APIPUR'),
      InvoiceDateTime: new Date().toISOString(),
      PurchaseDate: new Date().toISOString(),
      TransactionType: 'Purchase',
      IsPost: false,
      CreatedBy: 'automation',
      // SupplierId deliberately omitted.
    });
    expect(invalidPurchaseResponse.status()).toBe(400);

    // ============================================================
    // 8. ERROR LOGGING VERIFICATION — confirms live (class doc comment's
    // own citation, Web.config's `<elmah><security allowRemoteAccess="false" />`)
    // that ELMAH's error-log viewer is NOT reachable remotely, even from
    // this authenticated admin session. Read-only navigation only — this
    // does not exercise or rely on any ELMAH internal markup (unconfirmed
    // live), only that no error log content is exposed to a remote browser.
    // ============================================================
    const elmahResponse = await page.goto('/elmah.axd').catch(() => null);
    if (elmahResponse) {
      const elmahBody = await elmahResponse.text().catch(() => '');
      // Never a raw unhandled crash, and never the real error-log listing
      // (which would render actual exception Type/Message/Source text from
      // logged errors — the one confirmed distinguishing signal available
      // without asserting on unconfirmed ELMAH-internal DOM/CSS).
      expect(elmahResponse.status()).not.toBe(500);
      expect(elmahBody).not.toMatch(/Error Log for/i);
    }

    // ============================================================
    // 9. LOGOUT — same reusable assertions as LOGOUT-001
    // (tests/ui/auth/logout.spec.ts) and every other lifecycle spec's own
    // final step, not duplicated/reinvented here.
    // ============================================================
    await dashboardPage.logout();
    await expect(page).toHaveURL(new RegExp(routes.login.replace('/', '\\/')));
    await loginPage.expectStillOnLoginPage();
  });
});
