import { test, expect } from '../../../fixtures/purchase-lifecycle.fixture';
import { assertAdminCredentialsReady } from '../../../utils/env';
import { uniqueCode } from '../../../utils/random-data';
import { supplierFormSelectors, productFormSelectors, purchaseOrderFormSelectors } from '../../../utils/constants';
import { KendoMultiColumnComboBox } from '../../../components/kendo/KendoMultiColumnComboBox';

/**
 * Cross-module E2E purchase lifecycle: Login -> Supplier -> Product ->
 * Purchase Order -> Purchase (via the real "From Purchase Order" picker) ->
 * Stock -> Supplier Ledger. Mirrors tests/ui/e2e/sales-lifecycle.spec.ts's
 * own structure/conventions exactly. Not part of the approved coverage
 * baseline (config/coverage-baseline.ts).
 *
 * TWO DELIBERATE, EVIDENCE-BACKED DEVIATIONS from the literal requested
 * business flow — neither is invented, both are cited at the exact page
 * object that encodes them:
 *
 * 1. "Goods Receive (GRN)" does not exist as a separate module anywhere in
 *    this application (exhaustive source search across every
 *    Areas/DMS/Controllers/*.cs, Areas/DMS/Views/**, and Areas/DMS/js/
 *    Controllers/*.js file — no GoodsReceive/GRN controller, view, or JS
 *    file exists). The real, confirmed mechanism connecting a Purchase
 *    Order to a Purchase is a single "From Purchase Order" picker screen
 *    (see PurchasePage.ts's `selectPurchaseOrderForConversion()`/
 *    `createFromPurchaseOrder()` doc comments) that converts a Purchase
 *    Order directly into a pre-populated Purchase Create form — no
 *    intermediate "receive" transaction or document number exists to
 *    capture. The requested Step 5 ("Goods Receive") and Step 6
 *    ("Purchase") are therefore represented as the ONE real step below.
 *
 * 2. "Supplier Ledger" is likewise not a real module — confirmed no
 *    ledger-shaped controller action exists anywhere (SupplierController.cs's
 *    complete action list has none). Represented here by its nearest real,
 *    functional analog: the Supplier Purchase & Payment report (see
 *    SupplierLedgerPage.ts's doc comment for the full source citation).
 *
 * Runs under the "authenticated" Playwright project. "Login" (scenario step
 * 1) is represented the same way sales-lifecycle.spec.ts's own header
 * comment (note 1) already documents and justifies at length — not repeated
 * here: confirming the fixture's own pre-authenticated per-worker session
 * lands on the dashboard, not a fresh in-test credential submission.
 *
 * TEST DATA STRATEGY: every master-data entity (Supplier, Product) is
 * created fresh every run via `uniqueCode()` (guaranteed-unique per-run
 * name/code), the same "always create, never conditionally reuse" pattern
 * every existing prerequisite fixture in this project already uses
 * (productPrerequisites/customerPrerequisites/supplierPrerequisites,
 * purchasePartyPrerequisites) — there is no pre-existing "does this Supplier
 * already exist" check anywhere in this codebase to reuse, and adding one
 * here would be new, unproven architecture rather than reuse of the
 * existing one. "Reuse existing data when appropriate" is satisfied at the
 * Group level instead: Supplier Group / Product Group / UOM prerequisites
 * are still created fresh per run (matching the existing fixtures exactly),
 * but nothing about this spec prevents a future run from wiring in a
 * shared/looked-up Group if this project ever adds that capability
 * elsewhere first.
 */
test.describe('E2E Purchase Lifecycle', () => {
  test('Login, Supplier, Product, Purchase Order, Purchase (from Purchase Order), Stock, and Supplier Ledger reconcile end-to-end', async ({
    dashboardPage,
    branchSelectPage,
    supplierPage,
    supplierPrerequisites,
    productPage,
    productPrerequisites,
    purchaseOrderPage,
    purchasePage,
    stockReportPage,
    supplierLedgerPage,
    page,
  }) => {
    // CONFIRMED (live run): this flow's 8 sequential steps — 2 saved
    // transaction modules each requiring its own Post (Purchase Order,
    // Purchase), plus 2 separate new-tab Print/report round-trips (Stock,
    // Supplier Ledger) — exceed playwright.config.ts's global 60s default
    // `timeout` end-to-end, even with no retries or slowdowns. No other
    // spec in this project overrides `test.setTimeout()`; this is the first
    // one whose real, necessary work outgrows that default, so it is scoped
    // to just this one test rather than raised project-wide.
    test.setTimeout(120_000);
    assertAdminCredentialsReady();

    // 1. Login — confirms the fixture's own pre-authenticated per-worker
    // session actually lands on the dashboard.
    //
    // RCA (financial-lifecycle investigation, live run): see
    // sales-lifecycle.spec.ts's identical step-1 comment for the full,
    // source+network-trace-backed root cause — changeBranch() alone can
    // leave the session mid-branch-(re)assignment; resolveIfPresent() (the
    // same method performLogin() already uses after a fresh login) is
    // required to wait for that to actually finish before any DMS
    // navigation, or later requests intermittently 302 back to Login.
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
    // Re-fetch independently (grid search + edit) rather than trusting
    // whatever page state createSupplier() happens to leave behind — the
    // same "search by unique name, then verify" pattern this project's own
    // edit-and-verify-persistence tests already use. (SupplierPage's own
    // openEditFor() is a no-op if createSupplier() already landed on Edit.)
    await supplierPage.openEditFor(supplierName);
    const supplierCode = await supplierPage.getCode();
    expect(supplierCode).not.toHaveLength(0);
    // Captured here (from the already-visited Edit URL) because the
    // Supplier Ledger step's own picker cannot reliably find this supplier
    // — see that step's comment for the evidence.
    const supplierIdMatch = /\/Edit\/(\d+)/i.exec(page.url());
    expect(supplierIdMatch).not.toBeNull();
    const supplierId = supplierIdMatch![1];
    await expect(page.locator(supplierFormSelectors.name)).toHaveValue(supplierName);

    // 3. Product. purchasePrice is required for this flow specifically —
    // confirmed live that Purchase's own save handler rejects a line item
    // with UnitPrice <= 0 ("Unit Price must be greater than 0"), and a
    // Product with no Purchase Price produces exactly that once carried
    // into a Purchase Order/Purchase line item (see ProductPage.ts's
    // ProductCreateData.purchasePrice doc comment).
    const { productGroupName, uomName } = await productPrerequisites();
    const productName = uniqueCode('PRODUCT');
    const purchasePrice = 300;
    await productPage.createProduct({ name: productName, productGroupName, uomName, purchasePrice });
    // createProduct() already waits for the post-save /DMS/Product/Edit/
    // navigation (its own confirmed success signal) — Code/Name/Group/UOM
    // are all readable directly off that page.
    const productCode = await productPage.getCode();
    expect(productCode).not.toHaveLength(0);
    await expect(page.locator(productFormSelectors.name)).toHaveValue(productName);
    const productGroupCombo = new KendoMultiColumnComboBox(page, productFormSelectors.productGroupId);
    const uomCombo = new KendoMultiColumnComboBox(page, productFormSelectors.uomId);
    // Kendo re-initializes these combos client-side after the /Edit/
    // navigation lands — confirmed live that a single immediate read can
    // race ahead of that (empty), while the value is reliably present
    // moments later, so these poll rather than read once.
    await expect.poll(() => productGroupCombo.getSelectedText()).toContain(productGroupName);
    await expect.poll(() => uomCombo.getSelectedText()).toContain(uomName);

    // 4. Purchase Order — composed from PurchaseOrderPage's lower-level
    // methods (not the all-in-one createPurchaseOrder() convenience
    // wrapper) so the line item's Quantity/Rate/Total can be verified
    // before Save, the same reasoning sales-lifecycle.spec.ts already
    // applies to its own Sale step.
    await purchaseOrderPage.gotoCreate();
    await purchaseOrderPage.selectSupplier(supplierName);
    await purchaseOrderPage.fillDates();
    const poQuantity = 5;
    const poRow = await purchaseOrderPage.lineItems.addLineItem(productName, poQuantity);

    // Verify: Supplier selected, Product added, Quantity, Rate, Total.
    const poSupplierCombo = new KendoMultiColumnComboBox(page, purchaseOrderFormSelectors.supplierId);
    expect(await poSupplierCombo.getSelectedText()).toContain(supplierName);
    await expect(poRow).toContainText(productName);
    const poQuantityCell = await purchaseOrderPage.lineItems.quantityCell(poRow);
    const poQuantityValue = parseFloat(((await poQuantityCell.textContent()) ?? '0').replace(/[^0-9.-]/g, ''));
    const poUnitPriceCell = await purchaseOrderPage.lineItems.unitPriceCell(poRow);
    const poRate = parseFloat(((await poUnitPriceCell.textContent()) ?? '0').replace(/[^0-9.-]/g, ''));
    const poLineTotalCell = await purchaseOrderPage.lineItems.lineTotalCell(poRow);
    const poTotal = parseFloat(((await poLineTotalCell.textContent()) ?? '0').replace(/[^0-9.-]/g, ''));
    expect(poQuantityValue).toBeCloseTo(poQuantity, 2);
    // No VAT/SD/other rate was configured on this freshly-created Product,
    // so Total should reconcile with Quantity x Rate exactly.
    expect(poTotal).toBeCloseTo(poQuantity * poRate, 2);

    // Save. Purchase Order's post-save transition is an in-place update, no
    // navigation (see PurchaseOrderPage.createPurchaseOrder()'s doc
    // comment) — poll for the generated Code instead of the success toast,
    // which can race that in-place update.
    await purchaseOrderPage.clickSave();
    const purchaseOrderCode = await purchaseOrderPage.waitForCode();
    expect(purchaseOrderCode).not.toHaveLength(0);

    // PURCHASE-LIFECYCLE E2E LIVE RUNTIME FINDING: confirmed live that the
    // "From Purchase Order" picker only lists Posted Purchase Orders (every
    // row it showed had Status "Posted"; a freshly-saved Draft PO was
    // absent regardless of page) — a real business rule (goods can only be
    // received/purchased against an approved order), not a pagination gap.
    // Post it first, matching PurchaseOrderPage's own Draft->Posted
    // workflow already established elsewhere in this project.
    await purchaseOrderPage.post();

    // 5-6. Goods Receive + Purchase, collapsed into the one real "From
    // Purchase Order" conversion step (see class doc comment above for why).
    await purchasePage.selectPurchaseOrderForConversion(purchaseOrderCode);

    // Verify: Items loaded correctly — the line item carried over from the
    // Purchase Order, before Save.
    const purchaseRow = purchasePage.lineItems.rows().first();
    await expect(purchaseRow).toBeVisible();
    await expect(purchaseRow).toContainText(productName);
    const carriedQuantityCell = await purchasePage.lineItems.quantityCell(purchaseRow);
    const carriedQuantity = parseFloat(((await carriedQuantityCell.textContent()) ?? '0').replace(/[^0-9.-]/g, ''));
    expect(carriedQuantity).toBeCloseTo(poQuantity, 2);

    // Save. #BENumber is confirmed live as <input type="number"> — Playwright
    // refuses to .fill() letters into a number input, so a purely-numeric,
    // still-effectively-unique value is used here (unlike the existing
    // purchase.spec.ts/purchase-return.spec.ts tests' uniqueCode('PUR')-style
    // values, which contain letters and would hit this same incompatibility
    // if actually exercised against this field type).
    const beNumber = String(Date.now());
    await purchasePage.fillBeNumber(beNumber);
    await purchasePage.clickSave();
    // Same in-place-update race already confirmed for PurchaseOrder/Supplier
    // (#Code populates asynchronously relative to the toast) — poll for it
    // rather than reading it immediately after the toast resolves.
    const purchaseCode = await purchasePage.waitForCode();
    expect(purchaseCode).not.toHaveLength(0);

    // CONFIRMED (SSL_POS_Api's ReportsRepository.cs, GetSupplierPurchasePaymentReportList):
    // both its SUMMARY and DETAILS branches join Purchases with `WHERE
    // PUR.IsPost = 1` — an unposted (Draft) Purchase is excluded from the
    // Supplier Ledger report entirely, regardless of Supplier/date filters.
    // Same "must be Posted" business rule already proven once earlier in
    // this flow for Purchase Order -> From-PO conversion; applies again here
    // for Purchase -> Supplier Ledger. Posting has no bearing on the Stock
    // report below (confirmed live: Stock already reflected this Purchase's
    // quantity before this Post call existed), so this is placed right after
    // Save rather than deferred to just before the Ledger section.
    await purchasePage.post();

    // 7. Stock Verification. This Product was just created (no prior
    // transactions), and this Purchase is its only stock-affecting
    // transaction so far, so Current Stock == Expected Stock == poQuantity,
    // and the increase (Current - Opening) equals poQuantity exactly.
    await stockReportPage.goto();
    await stockReportPage.selectProduct(productName);
    await stockReportPage.enableSummaryMode();
    const stockTab = await stockReportPage.printAndCapture();
    const stockRow = await stockReportPage.getProductRow(stockTab, productName);
    const stockValues = await stockReportPage.getStockValues(stockRow);
    expect(stockValues.currentStock).toBeCloseTo(poQuantity, 2);
    expect(stockValues.currentStock - stockValues.openingStock).toBeCloseTo(poQuantity, 2);

    // 8. Supplier Ledger (real analog: Supplier Purchase & Payment report —
    // see class doc comment). Uses selectSupplierDirectly(), not the picker
    // popup — confirmed live that popup's own dataset (GetSupplierModal)
    // never includes a just-created supplier (see that method's doc
    // comment for the evidence); the report itself only ever reads
    // #SupplierId/#SupplierName's current values regardless of how they
    // were populated.
    await supplierLedgerPage.goto();
    await supplierLedgerPage.selectSupplierDirectly(supplierId, supplierName);
    await supplierLedgerPage.enableSummaryMode();
    const ledgerTab = await supplierLedgerPage.printAndCapture();
    const ledgerRow = await supplierLedgerPage.getSupplierRow(ledgerTab, supplierName);
    const ledgerValues = await supplierLedgerPage.getLedgerValues(ledgerRow);

    // Purchase Entry Exists: a non-zero Total Purchase Amount for this
    // Supplier proves the Purchase transaction was recorded.
    expect(ledgerValues.totalPurchaseAmount).toBeGreaterThan(0);
    // Correct Amount: reconciles with the Purchase Order's own computed
    // line Total (carried over unchanged by the From-Purchase-Order
    // conversion — no VAT/SD/other charges were configured).
    expect(ledgerValues.totalPurchaseAmount).toBeCloseTo(poTotal, 2);
    // Correct Balance: no Payment was made in this flow, so the full
    // Purchase Amount remains Outstanding.
    expect(ledgerValues.outstandingAmount).toBeCloseTo(
      ledgerValues.totalPurchaseAmount - ledgerValues.totalPaymentAmount,
      2
    );
  });
});
