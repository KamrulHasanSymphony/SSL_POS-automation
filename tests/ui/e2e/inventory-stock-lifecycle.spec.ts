import { test, expect } from '../../../fixtures/purchase-lifecycle.fixture';
import { assertAdminCredentialsReady } from '../../../utils/env';
import { uniqueCode, randomData } from '../../../utils/random-data';
import { routes } from '../../../utils/constants';

/**
 * Cross-module E2E inventory STOCK lifecycle: Login -> Supplier -> Customer ->
 * Product (Opening Stock 50) -> Purchase (+100) -> Purchase Post -> Sale
 * (-30) -> Sale Post -> Purchase Return (-20) -> Purchase Return Post -> Sale
 * Return (+10) -> Sale Return Post -> Final Stock reconciliation (110), all
 * verified against the ONE SAME Product's Stock Report row after every
 * single transaction. Deliberately a NEW file, no new fixture: this spec's
 * own module list (Supplier, Customer, Product, Purchase, Sale,
 * PurchaseReturn, SaleReturn, StockReportPage) is already the exact set
 * `purchase-lifecycle.fixture.ts` exposes (transactions.fixture.ts's six
 * transaction page objects + masters.fixture.ts's three master page objects
 * + its own stockReportPage/supplierLedgerPage addition) — reused as-is, per
 * this project's "reuse existing fixtures" convention, with no extension
 * needed. Independent of, and does not modify, purchase-lifecycle.spec.ts,
 * purchase-return-lifecycle.spec.ts, or sale-return-lifecycle.spec.ts. Not
 * part of the approved coverage baseline (config/coverage-baseline.ts).
 *
 * PRODUCT SETUP: a single Product is created once with `openingStock: 50`
 * (ProductVM.ProductStock — the sole Create-only "Opening Stock" mechanism,
 * confirmed by ProductPage.ts's own doc comment), `purchasePrice: 100`
 * (Purchase's own save handler rejects a line item with UnitPrice <= 0 —
 * confirmed by purchase-return-lifecycle.spec.ts's own step-3 comment) and
 * `salePrice: 150` (Sale's line item needs a real, non-zero UnitRate —
 * confirmed by sales-lifecycle.spec.ts's own step-3 comment) — the SAME
 * Product is then carried through all four stock-moving transactions below,
 * so the Stock Report's Current Stock column reflects the cumulative effect
 * of every one of them, exactly matching this flow's own reconciliation
 * formula.
 *
 * TRANSACTION CREATION PATHS: Purchase uses `purchasePage.createPurchase()`
 * (blank/manual — no Purchase Order step, matching this task's own
 * requested scenario and purchase-return-lifecycle.spec.ts's identical
 * choice) and Sale uses `salePage.createSale()` (its all-or-nothing
 * full-FinalPayable convenience — a deliberate simplification versus
 * sales-lifecycle.spec.ts's/sale-return-lifecycle.spec.ts's own manual
 * partial-payment builds: this spec is scoped strictly to stock quantity
 * movement, not Due/Collection, so a full payment avoids that unrelated
 * complexity entirely while still exercising Sale's own mandatory-payment
 * save path for real). Both Returns use their "From X" paths
 * (`purchaseReturnPage.createFromPurchase()` / `saleReturnPage.createFromSale()`),
 * referencing the real Purchase/Sale just created/posted — the more
 * realistic real-world scenario, matching purchase-return-lifecycle.spec.ts's/
 * sale-return-lifecycle.spec.ts's own identical choice over each module's
 * blank path. All four `create*()` calls already land their respective
 * module on its own `/Edit/{id}` page on success (confirmed by each page
 * object's own doc comment), so every Post below is clicked directly with
 * no re-navigation, mirroring purchase-return-lifecycle.spec.ts's own
 * "already on Edit, post directly" convention.
 */
test.describe('E2E Inventory Stock Lifecycle', () => {
  test('Login, Supplier, Customer, Product, Purchase, Sale, Purchase Return, Sale Return, and Stock Report reconcile end-to-end', async ({
    dashboardPage,
    branchSelectPage,
    supplierPage,
    supplierPrerequisites,
    customerPage,
    customerPrerequisites,
    productPage,
    productPrerequisites,
    bankAccountSetupPage,
    purchasePage,
    salePage,
    purchaseReturnPage,
    saleReturnPage,
    stockReportPage,
    page,
  }) => {
    // Same empirical reasoning as purchase-return-lifecycle.spec.ts's/
    // sale-return-lifecycle.spec.ts's own test.setTimeout: 4 saved
    // transaction modules, each requiring its own Post, plus 5 Stock Report
    // round-trips, exceeds the global 60s default by a wide margin.
    test.setTimeout(180_000);
    assertAdminCredentialsReady();

    // 1. Login — see purchase-return-lifecycle.spec.ts's identical step-1
    // comment for the full source+network-trace-backed root cause.
    await dashboardPage.changeBranch();
    await branchSelectPage.resolveIfPresent();
    await dashboardPage.expectLoaded();

    // 2. Supplier — Purchase/Purchase Return's prerequisite.
    const { supplierGroupName } = await supplierPrerequisites();
    const supplierName = uniqueCode('SUPPLIER');
    await supplierPage.createSupplier({
      name: supplierName,
      supplierGroupName,
      address: `Automation Address ${uniqueCode('ADDR')}`,
    });

    // 3. Customer — Sale/Sale Return's prerequisite.
    const { customerGroupName } = await customerPrerequisites();
    const customerName = uniqueCode('CUSTOMER');
    await customerPage.createCustomer({
      name: customerName,
      customerGroupName,
      telephoneNo: randomData.phone11Digit(),
      email: randomData.email('customer'),
      address: `Automation Address ${uniqueCode('ADDR')}`,
    });

    // 4. Product — see class doc comment: openingStock=50, purchasePrice=100,
    // salePrice=150, all three set together since this ONE Product is
    // carried through every transaction below.
    const { productGroupName, uomName } = await productPrerequisites();
    const productName = uniqueCode('PRODUCT');
    const openingStock = 50;
    const purchasePrice = 100;
    const salePrice = 150;
    await productPage.createProduct({
      name: productName,
      productGroupName,
      uomName,
      openingStock,
      purchasePrice,
      salePrice,
    });
    const productCode = await productPage.getCode();
    expect(productCode).not.toHaveLength(0);

    // Bank Account — Sale's mandatory payment prerequisite (SalePage.ts's
    // own class doc comment).
    const { accountName: bankAccountName } = await bankAccountSetupPage.setupBankAccount();

    // ============================================================
    // STEP 1: Opening Stock Validation — read now, before any transaction
    // touches this brand-new Product, so it reflects openingStock alone.
    // ============================================================
    await stockReportPage.goto();
    await stockReportPage.selectProduct(productName);
    await stockReportPage.enableSummaryMode();
    const openingStockTab = await stockReportPage.printAndCapture();
    const openingStockRow = await stockReportPage.getProductRow(openingStockTab, productName);
    const openingStockValues = await stockReportPage.getStockValues(openingStockRow);
    expect(openingStockValues.currentStock).toBeCloseTo(openingStock, 2);
    expect(openingStockValues.currentStock).toBeCloseTo(50, 2);

    // ============================================================
    // STEP 2: Purchase Transaction — quantity 100. Expected stock:
    // 50 + 100 = 150.
    // ============================================================
    const purchaseQuantity = 100;
    const purchaseCode = await purchasePage.createPurchase({
      supplierName,
      beNumber: String(Date.now()),
      productName,
      quantity: purchaseQuantity,
    });
    expect(purchaseCode).not.toHaveLength(0);
    // createPurchase() already lands on the Purchase Edit page (see class
    // doc comment), so Post can be clicked directly, no re-navigation
    // needed — same convention purchase-return-lifecycle.spec.ts's own
    // step-5 comment already documents for this exact module.
    await purchasePage.post();

    await stockReportPage.goto();
    await stockReportPage.selectProduct(productName);
    await stockReportPage.enableSummaryMode();
    const afterPurchaseTab = await stockReportPage.printAndCapture();
    const afterPurchaseRow = await stockReportPage.getProductRow(afterPurchaseTab, productName);
    const afterPurchaseValues = await stockReportPage.getStockValues(afterPurchaseRow);
    expect(afterPurchaseValues.currentStock).toBeCloseTo(openingStock + purchaseQuantity, 2);
    expect(afterPurchaseValues.currentStock).toBeCloseTo(150, 2);

    // ============================================================
    // STEP 3: Sale Transaction — quantity 30. Expected stock: 150 - 30 = 120.
    // ============================================================
    const saleQuantity = 30;
    const saleCode = await salePage.createSale({
      customerName,
      productName,
      quantity: saleQuantity,
      bankAccountName,
    });
    expect(saleCode).not.toHaveLength(0);
    // createSale() already lands on the Sale Edit page (SalePage.ts's own
    // doc comment: waitForSaveSuccess() waits for exactly that navigation),
    // so Post can be clicked directly, same "already on Edit" convention as
    // Purchase above.
    await salePage.post();

    await stockReportPage.goto();
    await stockReportPage.selectProduct(productName);
    await stockReportPage.enableSummaryMode();
    const afterSaleTab = await stockReportPage.printAndCapture();
    const afterSaleRow = await stockReportPage.getProductRow(afterSaleTab, productName);
    const afterSaleValues = await stockReportPage.getStockValues(afterSaleRow);
    expect(afterSaleValues.currentStock).toBeCloseTo(afterPurchaseValues.currentStock - saleQuantity, 2);
    expect(afterSaleValues.currentStock).toBeCloseTo(120, 2);

    // ============================================================
    // STEP 4: Purchase Return — "From Purchase" path, referencing the real
    // Purchase just created/posted. Quantity 20. Expected stock:
    // 120 - 20 = 100.
    // ============================================================
    const purchaseReturnQuantity = 20;
    const purchaseReturnCode = await purchaseReturnPage.createFromPurchase(purchaseCode, productName, purchaseReturnQuantity);
    expect(purchaseReturnCode).not.toHaveLength(0);
    // createFromPurchase() already lands on the PurchaseReturn Edit page
    // (PurchaseReturnPage.ts's own waitForSaveSuccess()), so Post can be
    // clicked directly.
    await purchaseReturnPage.post();

    await stockReportPage.goto();
    await stockReportPage.selectProduct(productName);
    await stockReportPage.enableSummaryMode();
    const afterPurchaseReturnTab = await stockReportPage.printAndCapture();
    const afterPurchaseReturnRow = await stockReportPage.getProductRow(afterPurchaseReturnTab, productName);
    const afterPurchaseReturnValues = await stockReportPage.getStockValues(afterPurchaseReturnRow);
    expect(afterPurchaseReturnValues.currentStock).toBeCloseTo(afterSaleValues.currentStock - purchaseReturnQuantity, 2);
    expect(afterPurchaseReturnValues.currentStock).toBeCloseTo(100, 2);

    // ============================================================
    // STEP 5: Sale Return — "From Sale" path, referencing the real Sale
    // just created/posted. Quantity 10. Expected stock: 100 + 10 = 110.
    // ============================================================
    const saleReturnQuantity = 10;
    const saleReturnCode = await saleReturnPage.createFromSale(saleCode, productName, saleReturnQuantity);
    expect(saleReturnCode).not.toHaveLength(0);
    // createFromSale() already lands on the SaleReturn Edit page
    // (SaleReturnPage.ts's own waitForSaveSuccess() — SALE-RETURN-LIFECYCLE
    // E2E FINDING, see that page object's own doc comment), so Post can be
    // clicked directly.
    await saleReturnPage.post();

    await stockReportPage.goto();
    await stockReportPage.selectProduct(productName);
    await stockReportPage.enableSummaryMode();
    const finalStockTab = await stockReportPage.printAndCapture();
    const finalStockRow = await stockReportPage.getProductRow(finalStockTab, productName);
    const finalStockValues = await stockReportPage.getStockValues(finalStockRow);
    expect(finalStockValues.currentStock).toBeCloseTo(afterPurchaseReturnValues.currentStock + saleReturnQuantity, 2);
    expect(finalStockValues.currentStock).toBeCloseTo(110, 2);

    // ============================================================
    // Stock Reconciliation — every movement captured above, checked against
    // this flow's own formula:
    //   Opening + Purchase - Sale - PurchaseReturn + SaleReturn = Final Stock
    //   50 + 100 - 30 - 20 + 10 = 110
    // ============================================================
    const reconciledStock =
      openingStock + purchaseQuantity - saleQuantity - purchaseReturnQuantity + saleReturnQuantity;
    expect(reconciledStock).toBeCloseTo(110, 2);
    expect(finalStockValues.currentStock).toBeCloseTo(reconciledStock, 2);

    // 6. Logout — same reusable assertions as LOGOUT-001
    // (tests/ui/auth/logout.spec.ts) and every other lifecycle spec's own
    // final step, not duplicated/reinvented here.
    await dashboardPage.logout();
    await expect(page).toHaveURL(new RegExp(routes.login.replace('/', '\\/')));
  });
});
