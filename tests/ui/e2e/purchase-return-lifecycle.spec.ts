import { test, expect } from '../../../fixtures/purchase-lifecycle.fixture';
import { assertAdminCredentialsReady } from '../../../utils/env';
import { uniqueCode } from '../../../utils/random-data';
import { supplierFormSelectors, productFormSelectors, purchaseFormSelectors } from '../../../utils/constants';
import { KendoMultiColumnComboBox } from '../../../components/kendo/KendoMultiColumnComboBox';

/**
 * Cross-module E2E purchase RETURN lifecycle: Login -> Supplier -> Product ->
 * Purchase -> Purchase Post -> Stock increase -> Purchase Return (from
 * Purchase) -> Purchase Return Post -> Stock decrease -> Supplier Ledger ->
 * Logout. Mirrors tests/ui/e2e/purchase-lifecycle.spec.ts's own structure,
 * conventions, and fixture chain exactly (same `purchase-lifecycle.fixture.ts`
 * — no new fixture needed, it already exposes every page object this flow
 * needs: purchasePage, purchaseReturnPage, stockReportPage,
 * supplierLedgerPage). Independent of, and does not modify,
 * purchase-lifecycle.spec.ts. Not part of the approved coverage baseline
 * (config/coverage-baseline.ts).
 *
 * PURCHASE CREATION PATH: uses `purchasePage.createPurchase()` (the blank/
 * manual flow), not "From Purchase Order" — this flow has no Purchase Order
 * step, matching the task's own requested scenario (Supplier -> Product ->
 * Purchase directly). Product is created with `purchasePrice` set (see
 * ProductPage.ts's own doc comment: Purchase's save handler rejects a line
 * item with UnitPrice <= 0), NOT via `purchasePartyPrerequisites()`, which
 * deliberately omits it — same reasoning purchase-lifecycle.spec.ts's own
 * step-3 comment already documents for the identical prerequisite gap.
 *
 * PURCHASE RETURN CREATION PATH: uses `purchaseReturnPage.createFromPurchase()`
 * (the "From Purchase" path, referencing the real Purchase transaction just
 * created/posted) rather than the blank path — matches the requested
 * business flow (a return against a specific purchased product) and is the
 * more realistic real-world scenario.
 *
 * SUPPLIER LEDGER FINDING (confirmed from source before writing this spec,
 * not discovered by trial-and-error): ReportsRepository.cs's
 * `SupplierPurchasePaymentReportList()` (Summary mode) computes
 * `TotalPurchaseAmount = SUM(Purchases.GrandTotal) WHERE IsPost = 1` — this
 * query has NO reference to `PurchaseReturns` anywhere at all (no JOIN, no
 * subtraction). The Supplier Ledger (Supplier Purchase & Payment Report) is
 * therefore confirmed to NOT reflect Purchase Returns — `TotalPurchaseAmount`
 * stays at the gross gross Purchase total even after a Purchase Return is
 * posted. This spec's Supplier Ledger assertions test the report's real,
 * confirmed behavior (unaffected by the Return) rather than an unmet "net
 * purchase" business expectation the current application does not
 * implement — flagged explicitly in this file rather than silently assumed
 * or worked around, per this project's Live DOM/evidence-based conventions.
 */
test.describe('E2E Purchase Return Lifecycle', () => {
  test('Login, Supplier, Product, Purchase, Purchase Post, Stock increase, Purchase Return, Purchase Return Post, Stock decrease, and Supplier Ledger reconcile end-to-end', async ({
    dashboardPage,
    branchSelectPage,
    supplierPage,
    supplierPrerequisites,
    productPage,
    productPrerequisites,
    purchasePage,
    purchaseReturnPage,
    stockReportPage,
    supplierLedgerPage,
    page,
  }) => {
    // Same empirical reasoning as purchase-lifecycle.spec.ts's own
    // test.setTimeout: a comparable number of sequential steps (2 saved
    // transaction modules each requiring its own Post, 2 new-tab
    // Print/report round-trips) exceeds the global 60s default.
    test.setTimeout(120_000);
    assertAdminCredentialsReady();

    // 1. Login — see purchase-lifecycle.spec.ts's identical step-1 comment
    // for the full source+network-trace-backed root cause.
    await dashboardPage.changeBranch();
    await branchSelectPage.resolveIfPresent();
    await dashboardPage.expectLoaded();

    // 2. Supplier.
    const { supplierGroupName } = await supplierPrerequisites();
    const supplierName = uniqueCode('SUPPLIER');
    await supplierPage.createSupplier({
      name: supplierName,
      supplierGroupName,
      address: `Automation Address ${uniqueCode('ADDR')}`,
    });
    await supplierPage.openEditFor(supplierName);
    const supplierCode = await supplierPage.getCode();
    expect(supplierCode).not.toHaveLength(0);
    // Captured here (from the already-visited Edit URL) — same
    // confirmed-necessary mechanism purchase-lifecycle.spec.ts/
    // financial-lifecycle.spec.ts already use: the Supplier Ledger's own
    // picker popup cannot reliably find a just-created Supplier.
    const supplierIdMatch = /\/Edit\/(\d+)/i.exec(page.url());
    expect(supplierIdMatch).not.toBeNull();
    const supplierId = supplierIdMatch![1];
    await expect(page.locator(supplierFormSelectors.name)).toHaveValue(supplierName);

    // 3. Product — purchasePrice=100 (see class doc comment: required for
    // Purchase's own save validation, and matches this flow's example Rate).
    const { productGroupName, uomName } = await productPrerequisites();
    const productName = uniqueCode('PRODUCT');
    const purchaseRate = 100;
    await productPage.createProduct({ name: productName, productGroupName, uomName, purchasePrice: purchaseRate });
    const productCode = await productPage.getCode();
    expect(productCode).not.toHaveLength(0);
    await expect(page.locator(productFormSelectors.name)).toHaveValue(productName);

    // 4. Purchase — blank/manual creation (no Purchase Order in this flow).
    const purchaseQuantity = 100;
    const beNumber = String(Date.now());
    const purchaseCode = await purchasePage.createPurchase({
      supplierName,
      beNumber,
      productName,
      quantity: purchaseQuantity,
    });
    expect(purchaseCode).not.toHaveLength(0);

    // Verify: Supplier selected, line item Quantity/Rate/Total — same
    // verification shape purchase-lifecycle.spec.ts's own Purchase Order
    // step already uses, applied here to the Purchase itself since this
    // flow has no separate Purchase Order step to verify it on.
    //
    // PURCHASE-RETURN-LIFECYCLE E2E FINDING: unlike Purchase Order (no
    // post-save navigation), `createPurchase()` navigates to
    // `/DMS/Purchase/Edit/{id}` (see PurchasePage.ts's own doc comment) —
    // same confirmed "Kendo re-initializes combos client-side after the
    // /Edit/ navigation lands, a single immediate read can race ahead of
    // that" finding purchase-lifecycle.spec.ts's own Product verification
    // step already documents. Polls instead of a single read for the same
    // reason.
    const purchaseSupplierCombo = new KendoMultiColumnComboBox(page, purchaseFormSelectors.supplierId);
    await expect.poll(() => purchaseSupplierCombo.getSelectedText()).toContain(supplierName);
    const purchaseRow = purchasePage.lineItems.rows().first();
    await expect(purchaseRow).toContainText(productName);
    const quantityCell = await purchasePage.lineItems.quantityCell(purchaseRow);
    const quantityValue = parseFloat(((await quantityCell.textContent()) ?? '0').replace(/[^0-9.-]/g, ''));
    const unitPriceCell = await purchasePage.lineItems.unitPriceCell(purchaseRow);
    const rateValue = parseFloat(((await unitPriceCell.textContent()) ?? '0').replace(/[^0-9.-]/g, ''));
    const lineTotalCell = await purchasePage.lineItems.lineTotalCell(purchaseRow);
    const purchaseTotal = parseFloat(((await lineTotalCell.textContent()) ?? '0').replace(/[^0-9.-]/g, ''));
    expect(quantityValue).toBeCloseTo(purchaseQuantity, 2);
    expect(rateValue).toBeCloseTo(purchaseRate, 2);
    // No VAT/SD configured on this freshly-created Product, so Total
    // reconciles with Quantity x Rate exactly — matches this flow's example
    // (100 x 100 = 10000).
    expect(purchaseTotal).toBeCloseTo(purchaseQuantity * purchaseRate, 2);
    expect(purchaseTotal).toBeCloseTo(10_000, 2);

    // 5. Purchase Post — createPurchase() already lands on the Purchase Edit
    // page, so Post can be clicked directly, no re-navigation needed.
    await purchasePage.post();

    // 6. Stock Verification (increase) — this Product was just created (no
    // prior transactions), and this Purchase is its only stock-affecting
    // transaction so far, so Current Stock == purchaseQuantity exactly.
    await stockReportPage.goto();
    await stockReportPage.selectProduct(productName);
    await stockReportPage.enableSummaryMode();
    const stockTabBeforeReturn = await stockReportPage.printAndCapture();
    const stockRowBeforeReturn = await stockReportPage.getProductRow(stockTabBeforeReturn, productName);
    const stockBeforeReturn = await stockReportPage.getStockValues(stockRowBeforeReturn);
    expect(stockBeforeReturn.currentStock).toBeCloseTo(purchaseQuantity, 2);
    expect(stockBeforeReturn.currentStock - stockBeforeReturn.openingStock).toBeCloseTo(purchaseQuantity, 2);

    // 7. Capture Supplier Ledger values BEFORE the Return — required
    // Posted-only (ReportsRepository.cs: `WHERE PUR.IsPost = 1`), same
    // business rule already proven in purchase-lifecycle.spec.ts.
    await supplierLedgerPage.goto();
    await supplierLedgerPage.selectSupplierDirectly(supplierId, supplierName);
    await supplierLedgerPage.enableSummaryMode();
    const ledgerTabBeforeReturn = await supplierLedgerPage.printAndCapture();
    const ledgerRowBeforeReturn = await supplierLedgerPage.getSupplierRow(ledgerTabBeforeReturn, supplierName);
    const ledgerBeforeReturn = await supplierLedgerPage.getLedgerValues(ledgerRowBeforeReturn);
    expect(ledgerBeforeReturn.totalPurchaseAmount).toBeCloseTo(purchaseTotal, 2);
    // No Payment made in this flow, so the full Purchase Amount is Outstanding.
    expect(ledgerBeforeReturn.outstandingAmount).toBeCloseTo(
      ledgerBeforeReturn.totalPurchaseAmount - ledgerBeforeReturn.totalPaymentAmount,
      2
    );

    // 8. Purchase Return — "From Purchase" path, referencing the real
    // Purchase just created/posted (see class doc comment).
    const returnQuantity = 20;
    const returnCode = await purchaseReturnPage.createFromPurchase(purchaseCode, productName, returnQuantity);
    expect(returnCode).not.toHaveLength(0);

    // 9. Purchase Return Post — createFromPurchase() lands on the
    // PurchaseReturn Edit page (same in-place-update/navigation contract as
    // Purchase's own createPurchase()), so Post can be clicked directly.
    await purchaseReturnPage.post();

    // 10. Stock Verification (decrease) — fresh report read, same product.
    // Before Return: purchaseQuantity (100). After Return: purchaseQuantity
    // - returnQuantity (80) — matches this flow's example exactly.
    await stockReportPage.goto();
    await stockReportPage.selectProduct(productName);
    await stockReportPage.enableSummaryMode();
    const stockTabAfterReturn = await stockReportPage.printAndCapture();
    const stockRowAfterReturn = await stockReportPage.getProductRow(stockTabAfterReturn, productName);
    const stockAfterReturn = await stockReportPage.getStockValues(stockRowAfterReturn);
    expect(stockAfterReturn.currentStock).toBeCloseTo(purchaseQuantity - returnQuantity, 2);
    expect(stockAfterReturn.currentStock).toBeCloseTo(80, 2);

    // 11. Supplier Ledger AFTER the Return — see class doc comment's
    // Supplier Ledger finding: this report's TotalPurchaseAmount is
    // confirmed (from source) to never reference PurchaseReturns at all, so
    // it is expected to remain UNCHANGED from the before-Return read, not
    // netted down to 8000. Asserted explicitly (not silently skipped) so
    // this confirmed application-level reporting gap stays visible and
    // regression-checked, rather than assumed.
    await supplierLedgerPage.goto();
    await supplierLedgerPage.selectSupplierDirectly(supplierId, supplierName);
    await supplierLedgerPage.enableSummaryMode();
    const ledgerTabAfterReturn = await supplierLedgerPage.printAndCapture();
    const ledgerRowAfterReturn = await supplierLedgerPage.getSupplierRow(ledgerTabAfterReturn, supplierName);
    const ledgerAfterReturn = await supplierLedgerPage.getLedgerValues(ledgerRowAfterReturn);
    expect(ledgerAfterReturn.totalPurchaseAmount).toBeCloseTo(ledgerBeforeReturn.totalPurchaseAmount, 2);
    expect(ledgerAfterReturn.totalPurchaseAmount).toBeCloseTo(10_000, 2);

    // 12. Logout — same reusable assertions as LOGOUT-001
    // (tests/ui/auth/logout.spec.ts) and every other lifecycle spec's own
    // final step, not duplicated/reinvented here.
    await dashboardPage.logout();
  });
});
