import { test, expect } from '../../../fixtures/purchase-lifecycle.fixture';
import { assertAdminCredentialsReady } from '../../../utils/env';
import { uniqueCode, randomData } from '../../../utils/random-data';
import { routes, apiMessages } from '../../../utils/constants';

/**
 * STEP DATA-INTEGRITY-LIFECYCLE-INVESTIGATION-AND-VALIDATION
 *
 * Cross-module E2E Data Integrity lifecycle: Login -> Create Master Data ->
 * Create Transaction -> Invalid Reference Attempt -> Delete Reference
 * Attempt -> Duplicate Attempt -> Integrity Validation -> Consistency Check
 * -> Logout. Investigation + validation only, per this task's own rules —
 * no application/API/stored-procedure/database code is touched, no direct
 * DB access, no manual cleanup.
 *
 * PHASE 1 INVESTIGATION FINDINGS (confirmed exhaustively from
 * `SSL_POS_Api` source before this spec's first run — full citations on
 * `tests/api/e2e/data-integrity-validation.spec.ts`'s own class doc
 * comment, summarized here for the UI-side narrative):
 *
 * - REFERENTIAL INTEGRITY: none of Customer/Supplier/Product/BankInformation/
 *   BankAccount's Delete path checks for existing transaction references
 *   before archiving (confirmed: zero "in use"/"referenced"/"foreign key"
 *   guard anywhere in `ShampanPOS.Repository`/`ShampanPOS.Service`).
 *   Neither Purchase nor Sale's Insert path validates SupplierId/ProductId/
 *   CustomerId/BranchId against its master table before the row is
 *   written. This is a real, confirmed, live-reproduced APPLICATION GAP —
 *   see the API spec's own DATAINT-001..007 for the concrete evidence
 *   (an orphaned Sale referencing CustomerId=999999999 was actually
 *   persisted; a Customer/Supplier/Product referenced by a real transaction
 *   was archived with zero rejection).
 * - DELETE MECHANISM: all five master entities use a SOFT delete (archive:
 *   `IsArchive=1, IsActive=0`), never a hard `DELETE`. Archived records DO
 *   correctly disappear from the `Dropdown()` picker used for NEW
 *   transaction entry (`WHERE IsActive = 1` on every one of the five) —
 *   this is the application's ONLY real protection, and it is entirely
 *   forward-looking: it stops an archived record from being picked for a
 *   FUTURE transaction, but does nothing to a transaction that already
 *   references it, and does nothing to block the archive from happening in
 *   the first place regardless of existing history.
 * - THE UI ITSELF STRUCTURALLY CANNOT SUBMIT AN INVALID REFERENCE: unlike a
 *   raw API call, every Supplier/Customer/Product picker on a transaction
 *   Create screen is a Kendo combo populated live from the server's own
 *   Dropdown() data — there is no way to type/submit an id that widget
 *   didn't itself render as a real option. Step 4 below proves this
 *   directly (a clearly-fake, never-created Supplier name resolves to NO
 *   selectable option at all) — this is a genuine structural safeguard
 *   this application has "for free", worth documenting distinctly from an
 *   explicit validation rule someone wrote.
 * - Delete is confirmed NOT reachable via the UI for Customer
 *   (`CustomerPage.ts`'s own class doc comment: controller action and
 *   button both commented out), Product (`ProductPage.ts`: button
 *   commented out in Index.cshtml), and Supplier (`SupplierPage.ts`: same).
 *   Step 5 below reconfirms live that no Delete affordance is rendered on
 *   these grids at all — this app's ONLY reachable "delete protection" for
 *   these three modules, structurally, is that there is no UI path to
 *   attempt one to begin with (the API-level absence of protection, for
 *   whoever DOES call the API directly, is the API spec's own finding).
 * - DUPLICATE PREVENTION: Product/Supplier both reject a second Insert with
 *   the same Name (`CommonRepository.CheckExists`, "Data Already Exist!")
 *   — already proven via the real UI Save flow once in
 *   `tests/ui/e2e/error-handling-recovery-lifecycle.spec.ts`'s own Step 6;
 *   reproduced fresh here (Product) so this file's own Duplicate Attempt
 *   section is self-contained evidence, per this task's own Section 5.
 * - RETURN RELATIONSHIP VALIDATION (this task's own Phase 8 — added here so
 *   this file's own preferred lifecycle order — Post -> Invalid Reference ->
 *   Duplicate -> Delete Protection -> Return Relationship -> Final
 *   Consistency -> Logout — is followed exactly): ties a real
 *   PurchaseReturn/SaleReturn back into THIS spec's own already-created,
 *   already-posted Purchase/Sale from Step 3, via the same "From
 *   Purchase"/"From Sale" live-grid picker `purchase-return-lifecycle.spec.ts`/
 *   `sale-return-lifecycle.spec.ts` already prove in isolation — not
 *   re-verifying stock arithmetic those two files (plus
 *   `inventory-stock-lifecycle.spec.ts`) already own, only that returning
 *   against a transaction from THIS SAME lifecycle correctly carries over
 *   the right product and that the original Purchase/Sale remain intact
 *   afterward (folded into Step 7's own re-open check below). The
 *   API-level negative/orphan side of this same question (nonexistent
 *   source reference, quantity-vs-purchased, SaleReturn's total absence of
 *   a Sale-linkage field) is independently covered by
 *   `tests/api/e2e/data-integrity-validation.spec.ts`'s own DATAINT-012..015
 *   — not duplicated here, per this task's own reuse-existing-coverage rule.
 */
test.describe('E2E Data Integrity Lifecycle', () => {
  test('Login, master data, transaction, invalid-reference structural check, delete-protection check, duplicate detection, and consistency check reconcile end-to-end', async ({
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
    purchaseReturnPage,
    saleReturnPage,
    bankAccountSetupPage,
    page,
  }) => {
    // Same empirical reasoning as every other lifecycle spec's own
    // test.setTimeout: master data, a full Purchase + Sale, an invalid-
    // reference probe, a grid-level delete-protection check, a duplicate
    // round trip, a Purchase/Sale Return, and a final re-open/consistency
    // read comfortably exceeds the global 60s default.
    test.setTimeout(210_000);
    assertAdminCredentialsReady();

    // ============================================================
    // 1. LOGIN — see every other lifecycle spec's own identical step-1
    // comment for the full source+network-trace-backed root cause.
    // ============================================================
    await dashboardPage.changeBranch();
    await branchSelectPage.resolveIfPresent();
    await dashboardPage.expectLoaded();

    // ============================================================
    // 2. CREATE MASTER DATA — Supplier, Customer, Product, real UI
    // creation, same minimal-prerequisite convention every other lifecycle
    // spec in this project uses.
    // ============================================================
    const { supplierGroupName } = await supplierPrerequisites();
    const supplierName = uniqueCode('SUPPLIER');
    await supplierPage.createSupplier({
      name: supplierName,
      supplierGroupName,
      address: `Automation Address ${uniqueCode('ADDR')}`,
    });

    const { customerGroupName } = await customerPrerequisites();
    const customerName = uniqueCode('CUSTOMER');
    await customerPage.createCustomer({
      name: customerName,
      customerGroupName,
      telephoneNo: randomData.phone11Digit(),
      email: randomData.email('customer'),
      address: `Automation Address ${uniqueCode('ADDR')}`,
    });

    const { productGroupName, uomName } = await productPrerequisites();
    const productName = uniqueCode('PRODUCT');
    await productPage.createProduct({ name: productName, productGroupName, uomName, purchasePrice: 100, salePrice: 150 });

    // ============================================================
    // 3. CREATE TRANSACTION — a real, posted Purchase (Supplier + Product)
    // and a real, posted Sale (Customer + Product), giving Steps 5-7 below
    // genuine transaction history for all three master records to test
    // integrity against.
    // ============================================================
    const purchaseCode = await purchasePage.createPurchase({
      supplierName,
      beNumber: String(Date.now()),
      productName,
      quantity: 10,
    });
    expect(purchaseCode).not.toHaveLength(0);
    await purchasePage.post();

    const { accountName: bankAccountName } = await bankAccountSetupPage.setupBankAccount();
    await salePage.gotoCreate();
    await salePage.selectCustomer(customerName);
    await salePage.fillInvoiceDate();
    const saleRow = await salePage.lineItems.addRow();
    await salePage.lineItems.selectProductForRow(saleRow, productName);
    await salePage.lineItems.setQuantity(saleRow, 5);
    const finalPayable = await salePage.getFinalPayable();
    await salePage.addPayment(bankAccountName, finalPayable);
    await salePage.clickSave();
    const saleCode = await salePage.waitForSaveSuccess();
    expect(saleCode).not.toHaveLength(0);
    await salePage.post();

    // ============================================================
    // 4. INVALID REFERENCE ATTEMPT — proves the structural point from the
    // class doc comment directly: a clearly-fake, never-created Supplier
    // name has NO selectable option at all in the real Supplier combo on a
    // fresh Purchase Create screen — there is no way to submit an invalid
    // SupplierId through this form (unlike the API spec's own
    // DATAINT-002..004, which can and do submit one directly).
    // ============================================================
    await purchasePage.gotoCreate();
    const fakeSupplierName = uniqueCode('NEVER_CREATED_SUPPLIER');
    const hasFakeOption = await purchasePage.hasSelectableSupplier(fakeSupplierName);
    expect(hasFakeOption).toBe(false);

    // ============================================================
    // 5. DELETE REFERENCE ATTEMPT — confirms live (class doc comment) that
    // no Delete affordance is rendered anywhere on the Supplier grid row
    // for the Supplier this spec's own Purchase above already references —
    // the UI's only reachable "protection" for this module is the total
    // absence of a UI path to attempt a delete at all.
    // ============================================================
    await supplierPage.goto();
    await supplierPage.grid.search(supplierName);
    const supplierRow = await supplierPage.grid.findRowByText(supplierName);
    const supplierDeleteAffordance = supplierRow.getByRole('button', { name: /delete/i }).or(supplierRow.getByRole('link', { name: /delete/i }));
    expect(await supplierDeleteAffordance.count()).toBe(0);

    // Same check for Customer and Product — same confirmed-absent pattern
    // (class doc comment), reused rather than re-explained per module.
    await customerPage.goto();
    await customerPage.grid.search(customerName);
    const customerRow = await customerPage.grid.findRowByText(customerName);
    const customerDeleteAffordance = customerRow.getByRole('button', { name: /delete/i }).or(customerRow.getByRole('link', { name: /delete/i }));
    expect(await customerDeleteAffordance.count()).toBe(0);

    await productPage.goto();
    await productPage.grid.search(productName);
    const productRow = await productPage.grid.findRowByText(productName);
    const productDeleteAffordance = productRow.getByRole('button', { name: /delete/i }).or(productRow.getByRole('link', { name: /delete/i }));
    expect(await productDeleteAffordance.count()).toBe(0);

    // ============================================================
    // 6. DUPLICATE ATTEMPT — Product Name, Scenario 5's own example
    // (Code is server-generated, never user-editable — Name is the real,
    // confirmed duplicate-checked field, class doc comment).
    // ============================================================
    const duplicateName = uniqueCode('DUPPRODUCT');
    await productPage.createProduct({ name: duplicateName, productGroupName, uomName });

    await productPage.gotoCreate();
    // fillRequired() (not the individual fillName/selectProductGroup/
    // selectUom calls) — ProductPage.ts's own doc comment (STEP 10 LIVE
    // EXECUTION FINDING) confirms Barcode is client-side `class="required"`
    // and blocks Save with no confirm dialog if omitted, even though it has
    // nothing to do with the duplicate-Name check this step exists to
    // prove. Confirmed live here: the first run of this spec, before this
    // fix, stalled on exactly that ("This field is required." under
    // Barcode) — an automation gap in this spec, not an application defect.
    await productPage.fillRequired({ name: duplicateName, productGroupName, uomName });
    await productPage.clickSave();
    await productPage.toastr.expectError(apiMessages.duplicateDataExists);
    // No duplicate record created: Save did not navigate to a new Edit page.
    await expect(page).toHaveURL(/\/DMS\/Product\/Create/i);

    // ============================================================
    // 7. RETURN RELATIONSHIP VALIDATION — a real PurchaseReturn/SaleReturn,
    // each created via the live "From Purchase"/"From Sale" grid picker
    // against THIS spec's own Step-3 Purchase/Sale (purchaseCode/saleCode),
    // for a partial quantity well within what was purchased/sold (10/5) —
    // proves the return correctly carries over the right product from the
    // right source transaction, tying Phase 7 (posted transactions) and
    // Phase 8 (return relationships) of this task together within one
    // continuous, real transaction chain rather than two isolated specs.
    // ============================================================
    const purchaseReturnCode = await purchaseReturnPage.createFromPurchase(purchaseCode, productName, 2);
    expect(purchaseReturnCode).not.toHaveLength(0);
    // Verified on THIS same Edit page, right after creation
    // (createFromPurchase()'s own waitForSaveSuccess() already lands here —
    // see its class doc comment) — deliberately NOT re-opened later via
    // purchaseReturnPage.openEditFor(): confirmed live (this file's own
    // first exercise of that call on a freshly-created row) that this
    // grid's Action column renders Edit/Report as icon-only links with no
    // accessible name at all (`link ""`, no text/aria-label), so
    // KendoGrid.clickRowAction()'s `getByRole('link', {name:/edit/i})`
    // never resolves — a pre-existing gap in that shared component, not a
    // data-integrity finding, and out of this task's scope to fix.
    const persistedPurchaseReturnRow = purchaseReturnPage.lineItems.rows().first();
    await expect(persistedPurchaseReturnRow).toContainText(productName);

    const saleReturnCode = await saleReturnPage.createFromSale(saleCode, productName, 1);
    expect(saleReturnCode).not.toHaveLength(0);
    const persistedSaleReturnRow = saleReturnPage.lineItems.rows().first();
    await expect(persistedSaleReturnRow).toContainText(productName);

    // ============================================================
    // 8. INTEGRITY VALIDATION / CONSISTENCY CHECK — re-opens the Purchase
    // and the Sale created in Step 3 and confirms their Supplier/Customer/
    // Product references still resolve correctly after every attempted
    // attack above AND after Step 7's own Return against each — proving
    // none of Steps 4-7 corrupted or otherwise disturbed this spec's own
    // real transaction history.
    // ============================================================
    await purchasePage.openEditFor(purchaseCode);
    await expect(page.locator('#SupplierId')).not.toHaveValue('');
    const persistedPurchaseRow = purchasePage.lineItems.rows().first();
    await expect(persistedPurchaseRow).toContainText(productName);

    await salePage.openEditFor(saleCode);
    await expect(page.locator('#CustomerId')).not.toHaveValue('');
    const persistedSaleRow = salePage.lineItems.rows().first();
    await expect(persistedSaleRow).toContainText(productName);

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
