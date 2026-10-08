import { test, expect } from '../../../fixtures/sale-return-lifecycle.fixture';
import { assertAdminCredentialsReady } from '../../../utils/env';
import { uniqueCode, randomData } from '../../../utils/random-data';
import { routes } from '../../../utils/constants';

/**
 * Cross-module E2E Sales Order CONVERSION lifecycle: Login -> Customer ->
 * Product -> Sale Order -> Sale Order Conversion ("From Sale Order") -> Sale
 * -> Sale Post -> Stock decrease -> Collection -> Customer Due -> Report
 * Validation -> Logout. Deliberately a NEW file, no new fixture:
 * `sale-return-lifecycle.fixture.ts` already exposes every page object this
 * flow needs (customerPage/productPage/bankAccountSetupPage/saleOrderPage/
 * salePage/collectionPage from its own upstream chain, plus
 * customerSaleCollectionReportPage/reportPage/stockReportPage added along
 * the way) — reused as-is, per this project's "reuse existing fixtures"
 * convention. Independent of, and does not modify, sales-lifecycle.spec.ts,
 * customer-collection-lifecycle.spec.ts, or any other lifecycle spec. Not
 * part of the approved coverage baseline (config/coverage-baseline.ts).
 *
 * SALE ORDER -> SALE CONVERSION MECHANISM: confirmed from source
 * (`SaleController.cs`'s `FromSaleOrder()`/`GetFromSaleOrder()` actions,
 * `FromSaleOrderController.js`) that a real, dedicated "From Sale Order"
 * conversion path exists — the exact structural analog of Purchase's own
 * "From Purchase Order" path — but had NO page-object coverage anywhere in
 * this project before this spec. `SalePage.createFromSaleOrder()` was added
 * (see that file's own doc comment for the full source citation) mirroring
 * `PurchasePage.createFromPurchaseOrder()`'s already-proven shape: a
 * `#GridDataList` grid of existing Sale Orders, `#btnSelect` converts the
 * chosen one into a pre-populated Sale `Create` view (Customer + line items
 * carried over, `SaleOrderId` set, `Operation = "add"`), reusing
 * `SalePage.waitForSaveSuccess()` unchanged (same confirmed
 * `window.location.href = "/DMS/Sale/Edit/" + id` redirect on a genuine
 * "add" save).
 *
 * MANDATORY-PAYMENT / DUE FIGURES (confirmed from source before writing this
 * spec's assertions, not discovered by trial-and-error — same
 * confirm-before-assume discipline every other lifecycle spec in this
 * project already applies): `SaleController.js`'s Save handler enforces the
 * SAME mandatory-payment gate on a Sale converted from a Sale Order as on a
 * blank Sale — `cardDetails.length === 0` -> "Please complete the payment
 * before submitting the sale.", and separately `CardTotal <= 0` ->
 * "Payment amount must be greater than zero." (both unconditional, neither
 * gated by `IsManualSale`). A Sale with literally ZERO at-sale payment —
 * which the task's own "Due Before: 7500" figure implicitly assumes — is
 * therefore confirmed IMPOSSIBLE to save through this real UI. This spec
 * instead uses the same deliberately-small nominal payment (`1`) already
 * established and proven by `banking.fixture.ts`'s own
 * `saleWithDuePrerequisite` for this identical reason, and verifies the
 * REAL resulting Due/Collection figures it produces (captured dynamically
 * from the live app, not hardcoded) rather than asserting a number the
 * application cannot actually produce. Sale Order Amount and Total Sale
 * Amount themselves are UNAFFECTED by this (GrandTotal is independent of
 * the at-sale payment amount) and are asserted as the task's own exact
 * 7,500 throughout.
 *
 * REPORT FINDING (already confirmed by sale-return-lifecycle.spec.ts's own
 * class doc comment, reused here rather than re-derived): the Customer
 * Collection Due Report's (`GetCustomerCollectionDueList`) DueAmount is
 * `SUM(Sales.GrandTotal) - SUM(Collections.TotalCollectAmount)` — it never
 * nets the Sale's own at-sale SaleCreditCards payment, so it correctly
 * settles at the nominal payment amount (`1`), not `0`, even once the
 * Collection has paid off the rest. The task's own "Due = 0" expectation is
 * instead verified via the Collection invoice-picker's own TRUE due
 * calculation (nets both the at-sale payment and the Collection), which
 * this spec confirms independently.
 */
test.describe('E2E Sales Order Conversion Lifecycle', () => {
  test('Login, Customer, Product, Sale Order, Sale Order Conversion, Sale Post, Stock decrease, Collection, Due, and Report reconcile end-to-end', async ({
    dashboardPage,
    branchSelectPage,
    customerPage,
    customerPrerequisites,
    productPage,
    productPrerequisites,
    bankAccountSetupPage,
    saleOrderPage,
    salePage,
    collectionPage,
    stockReportPage,
    customerSaleCollectionReportPage,
    reportPage,
    page,
  }) => {
    // Same empirical reasoning as every other lifecycle spec's own
    // test.setTimeout: 2 saved transaction modules (Sale Order + its
    // conversion to Sale), a Post, a Collection, and 3 new-tab Print/report
    // round-trips exceeds the global 60s default by a wide margin.
    test.setTimeout(180_000);
    assertAdminCredentialsReady();

    // 1. Login — see purchase-return-lifecycle.spec.ts's identical step-1
    // comment for the full source+network-trace-backed root cause.
    await dashboardPage.changeBranch();
    await branchSelectPage.resolveIfPresent();
    await dashboardPage.expectLoaded();

    // 2. Customer.
    const { customerGroupName } = await customerPrerequisites();
    const customerName = uniqueCode('CUSTOMER');
    await customerPage.createCustomer({
      name: customerName,
      customerGroupName,
      telephoneNo: randomData.phone11Digit(),
      email: randomData.email('customer'),
      address: `Automation Address ${uniqueCode('ADDR')}`,
    });
    // Captured here (from the post-create Edit URL redirect — same
    // confirmed-reliable mechanism every other lifecycle spec in this
    // project already uses) so the Report steps below can use each report's
    // own selectCustomerDirectly(), bypassing their confirmed-broken popup
    // pickers.
    const customerIdMatch = /\/Edit\/(\d+)/i.exec(page.url());
    expect(customerIdMatch).not.toBeNull();
    const customerId = customerIdMatch![1];

    // 3. Product — openingStock=100, purchasePrice=100 (per this flow's own
    // requested Product setup, even though no Purchase transaction is made
    // in this scenario), salePrice=150.
    const { productGroupName, uomName } = await productPrerequisites();
    const productName = uniqueCode('PRODUCT');
    const openingStock = 100;
    const salePrice = 150;
    await productPage.createProduct({
      name: productName,
      productGroupName,
      uomName,
      openingStock,
      purchasePrice: 100,
      salePrice,
    });
    const productCode = await productPage.getCode();
    expect(productCode).not.toHaveLength(0);

    // Bank Account — Sale's mandatory payment prerequisite (SalePage.ts's
    // own class doc comment), needed regardless of Sale Order origin (see
    // class doc comment's Mandatory-Payment finding).
    const { accountName: bankAccountName } = await bankAccountSetupPage.setupBankAccount();

    // Stock BEFORE Sale — read now, before any transaction touches this
    // brand-new Product, so it reflects openingStock alone (100). No
    // Purchase transaction exists in this scenario, so this is also the
    // ONLY "before" baseline needed for the eventual Sale.
    await stockReportPage.goto();
    await stockReportPage.selectProduct(productName);
    await stockReportPage.enableSummaryMode();
    const stockTabBeforeSale = await stockReportPage.printAndCapture();
    const stockRowBeforeSale = await stockReportPage.getProductRow(stockTabBeforeSale, productName);
    const stockBeforeSale = await stockReportPage.getStockValues(stockRowBeforeSale);
    expect(stockBeforeSale.currentStock).toBeCloseTo(openingStock, 2);
    expect(stockBeforeSale.currentStock).toBeCloseTo(100, 2);

    // ============================================================
    // STEP 1: Create Sale Order — quantity 50. UnitRate is auto-populated
    // from the Product's own SalePrice (150) when selected in the line-item
    // picker (same confirmed mechanism Sale's own line items use) — no
    // separate Rate input exists on Sale Order. Expected Sale Order Amount:
    // 50 x 150 = 7500.
    // ============================================================
    const orderQuantity = 50;
    const saleOrderCode = await saleOrderPage.createSaleOrder({
      customerName,
      productName,
      quantity: orderQuantity,
    });
    // Validate: Save success + Code generated.
    expect(saleOrderCode).not.toHaveLength(0);

    // Validate: Product exists, Quantity preserved, Rate/Total correct —
    // read directly off the just-saved Sale Order's own line-item row.
    const saleOrderRow = saleOrderPage.lineItems.rows().first();
    await expect(saleOrderRow).toContainText(productName);
    const saleOrderQuantityCell = await saleOrderPage.lineItems.quantityCell(saleOrderRow);
    const saleOrderQuantityValue = parseFloat(((await saleOrderQuantityCell.textContent()) ?? '0').replace(/[^0-9.-]/g, ''));
    const saleOrderUnitPriceCell = await saleOrderPage.lineItems.unitPriceCell(saleOrderRow);
    const saleOrderUnitPriceValue = parseFloat(((await saleOrderUnitPriceCell.textContent()) ?? '0').replace(/[^0-9.-]/g, ''));
    const saleOrderLineTotalCell = await saleOrderPage.lineItems.lineTotalCell(saleOrderRow);
    const saleOrderAmount = parseFloat(((await saleOrderLineTotalCell.textContent()) ?? '0').replace(/[^0-9.-]/g, ''));
    expect(saleOrderQuantityValue).toBeCloseTo(orderQuantity, 2);
    expect(saleOrderUnitPriceValue).toBeCloseTo(salePrice, 2);
    // No VAT/SD configured on this freshly-created Product, so the line
    // Total reconciles with Quantity x Rate exactly — matches this flow's
    // own example (50 x 150 = 7500).
    expect(saleOrderAmount).toBeCloseTo(orderQuantity * salePrice, 2);
    expect(saleOrderAmount).toBeCloseTo(7_500, 2);

    // SALES-ORDER-CONVERSION-LIFECYCLE E2E FINDING: confirmed live
    // (`findRowAcrossPages` scanning every page of `/DMS/Sale/FromSaleOrder`'s
    // own `#GridDataList` and never finding this just-created Sale Order)
    // and directly from source (`SaleOrderRepository.cs`'s
    // `FromSaleOrderGridData` — both its count and data queries carry an
    // unconditional `WHERE ... AND H.IsPost = 1`) that a Sale Order must be
    // POSTED before it is even listed in the "From Sale Order" picker — the
    // same "must be Posted" business rule already confirmed for every other
    // "From X" conversion picker in this project (Purchase Order -> Purchase,
    // Purchase -> Purchase Return, Sale -> Sale Return), just not yet
    // exercised for Sale Order -> Sale specifically. `SaleOrderPage.post()`
    // already exists and needed no change — createSaleOrder() already lands
    // on the Sale Order Edit page, so Post is clicked directly here, same
    // "already on Edit" convention used throughout this spec.
    await saleOrderPage.post();

    // ============================================================
    // STEP 2: Convert Sale Order To Sale — "From Sale Order" path,
    // referencing the real Sale Order just created/posted (see class doc
    // comment's Sale Order -> Sale Conversion Mechanism). A nominal
    // `1`-unit payment is supplied (see class doc comment's
    // Mandatory-Payment finding) — the smallest valid value satisfying the
    // app's own confirmed, unconditional "payment amount must be greater
    // than zero" gate, leaving the largest possible real Due for the
    // Collection step below.
    // ============================================================
    const atSalePayment = 1;
    const saleCode = await salePage.createFromSaleOrder(saleOrderCode, bankAccountName, atSalePayment);
    // Validate: Sale Code generated, Sale created successfully.
    expect(saleCode).not.toHaveLength(0);
    expect(saleCode).not.toBe(saleOrderCode);

    // Validate: Product copied correctly, Quantity remains 50 — read
    // directly off the converted Sale's own (pre-populated, read-only —
    // see class doc comment: row Add/Delete is blocked here) line-item row.
    const saleRow = salePage.lineItems.rows().first();
    await expect(saleRow).toContainText(productName);
    const saleQuantityCell = await salePage.lineItems.quantityCell(saleRow);
    const saleQuantityValue = parseFloat(((await saleQuantityCell.textContent()) ?? '0').replace(/[^0-9.-]/g, ''));
    const saleUnitPriceCell = await salePage.lineItems.unitPriceCell(saleRow);
    const saleUnitPriceValue = parseFloat(((await saleUnitPriceCell.textContent()) ?? '0').replace(/[^0-9.-]/g, ''));
    const saleLineTotalCell = await salePage.lineItems.lineTotalCell(saleRow);
    const saleAmount = parseFloat(((await saleLineTotalCell.textContent()) ?? '0').replace(/[^0-9.-]/g, ''));
    expect(saleQuantityValue).toBeCloseTo(orderQuantity, 2);
    expect(saleQuantityValue).toBeCloseTo(50, 2);
    expect(saleUnitPriceValue).toBeCloseTo(salePrice, 2);
    expect(saleAmount).toBeCloseTo(saleOrderAmount, 2);
    expect(saleAmount).toBeCloseTo(7_500, 2);

    // Sale's own FinalPayable — read here (after the conversion landed on
    // Sale/Edit) to independently confirm the carried-over GrandTotal.
    const finalPayable = await salePage.getFinalPayable();
    expect(finalPayable).toBeCloseTo(7_500, 2);

    // ============================================================
    // STEP 3: Post Sale — createFromSaleOrder() already lands on the Sale
    // Edit page (SalePage.waitForSaveSuccess()), so Post can be clicked
    // directly, same "already on Edit" convention already proven by
    // purchase-return-lifecycle.spec.ts/inventory-stock-lifecycle.spec.ts
    // for their own analogous modules.
    // ============================================================
    await salePage.post();

    // Validate Stock — Before Sale: 100 (captured above). After Sale:
    // 100 - 50 = 50, matches this flow's own example exactly.
    await stockReportPage.goto();
    await stockReportPage.selectProduct(productName);
    await stockReportPage.enableSummaryMode();
    const stockTabAfterSale = await stockReportPage.printAndCapture();
    const stockRowAfterSale = await stockReportPage.getProductRow(stockTabAfterSale, productName);
    const stockAfterSale = await stockReportPage.getStockValues(stockRowAfterSale);
    expect(stockAfterSale.currentStock).toBeCloseTo(stockBeforeSale.currentStock - orderQuantity, 2);
    expect(stockAfterSale.currentStock).toBeCloseTo(50, 2);

    // ============================================================
    // STEP 4: Customer Collection — against the generated Sale. Due Before
    // is the REAL Due left by the nominal at-sale payment (see class doc
    // comment's Mandatory-Payment finding): finalPayable - atSalePayment =
    // 7500 - 1 = 7499, not the task's own idealized 7500 (confirmed
    // unreachable through this real UI). Collects that full real Due, for
    // the cleanest possible post-collection assertion target — same
    // convention every other lifecycle spec's own Collection step already
    // uses.
    // ============================================================
    await collectionPage.gotoCreate();
    await collectionPage.selectCustomer(customerName);
    await collectionPage.fillTransactionDate();
    const dueRowBefore = await collectionPage.invoices.addRow();
    await collectionPage.invoices.selectInvoiceForRow(dueRowBefore, saleCode);
    const dueBefore = await collectionPage.invoices.getDueAmount(dueRowBefore);
    expect(dueBefore).toBeCloseTo(finalPayable - atSalePayment, 2);
    expect(dueBefore).toBeCloseTo(7_499, 2);

    const collectionAmount = dueBefore;
    await collectionPage.invoices.setAmount(dueRowBefore, collectionAmount);
    await collectionPage.clickSave();
    await collectionPage.toastr.expectSuccess();
    const collectionCode = await collectionPage.getCode();
    expect(collectionCode).not.toHaveLength(0);

    // Validate: Due After = 0 — a fresh, unsaved Collection/Create screen,
    // same customer + Sale Code, using the invoice-picker's own TRUE due
    // calculation (nets both the at-sale payment and this Collection).
    await collectionPage.gotoCreate();
    await collectionPage.selectCustomer(customerName);
    await collectionPage.fillTransactionDate();
    const dueRowAfter = await collectionPage.invoices.addRow();
    await collectionPage.invoices.selectInvoiceForRow(dueRowAfter, saleCode);
    const dueAfter = await collectionPage.invoices.getDueAmount(dueRowAfter);
    expect(dueAfter).toBeCloseTo(dueBefore - collectionAmount, 2);
    expect(dueAfter).toBeCloseTo(0, 2);

    // ============================================================
    // STEP 5: Report Validation.
    // ============================================================

    // Customer Sale Report (Customer Sale & Collection Report, Summary
    // mode): Total Sale Amount = 7500 — GrandTotal is independent of the
    // at-sale payment amount, so this is the task's own exact figure.
    // Total Collection Amount here is confirmed (sale-return-lifecycle.spec.ts's
    // own class doc comment's Report Finding) to also include the at-sale
    // SaleCreditCards payment alongside the real Collection —
    // atSalePayment(1) + collectionAmount(7499) = 7500 exactly.
    await customerSaleCollectionReportPage.goto();
    await customerSaleCollectionReportPage.selectCustomerDirectly(customerId, customerName);
    await customerSaleCollectionReportPage.enableSummaryMode();
    const saleReportTab = await customerSaleCollectionReportPage.printAndCapture();
    const saleReportRow = await customerSaleCollectionReportPage.getCustomerRow(saleReportTab, customerName);
    const saleReportValues = await customerSaleCollectionReportPage.getReportValues(saleReportRow);
    await expect(saleReportRow).toContainText(customerName);
    expect(saleReportValues.totalSaleAmount).toBeCloseTo(7_500, 2);
    // Customer Collection Report: Collection Amount >= 7500 (task's own
    // lower-bound phrasing) — confirmed exactly 7500 here.
    expect(saleReportValues.totalCollectionAmount).toBeGreaterThanOrEqual(7_500 - 0.01);
    expect(saleReportValues.totalCollectionAmount).toBeCloseTo(atSalePayment + collectionAmount, 2);

    // Customer Due Report (Customer Collection Due Report). Per class doc
    // comment's Report Finding: DueAmount never nets the at-sale payment,
    // so it settles at atSalePayment (1), not the task's idealized 0 — the
    // task's "Due = 0" is verified above via the invoice-picker's own TRUE
    // due (dueAfter), which IS confirmed to reach exactly 0.
    await reportPage.goto();
    await reportPage.selectCustomerDirectly(customerId, customerName);
    const dueReportTab = await reportPage.printAndCapture();
    const dueReportRow = await reportPage.getCustomerRow(dueReportTab, customerName);
    const dueReportValues = await reportPage.getRowValues(dueReportRow);
    await expect(dueReportRow).toContainText(customerName);
    expect(dueReportValues.totalSaleAmount).toBeCloseTo(7_500, 2);
    expect(dueReportValues.totalCollectionAmount).toBeCloseTo(collectionAmount, 2);
    expect(dueReportValues.dueAmount).toBeCloseTo(atSalePayment, 2);

    // Stock Report: Current Stock = 50 — re-confirmed one final time
    // against the same value already proven above.
    await stockReportPage.goto();
    await stockReportPage.selectProduct(productName);
    await stockReportPage.enableSummaryMode();
    const finalStockTab = await stockReportPage.printAndCapture();
    const finalStockRow = await stockReportPage.getProductRow(finalStockTab, productName);
    const finalStockValues = await stockReportPage.getStockValues(finalStockRow);
    expect(finalStockValues.currentStock).toBeCloseTo(50, 2);

    // 6. Logout — same reusable assertions as LOGOUT-001
    // (tests/ui/auth/logout.spec.ts) and every other lifecycle spec's own
    // final step, not duplicated/reinvented here.
    await dashboardPage.logout();
    await expect(page).toHaveURL(new RegExp(routes.login.replace('/', '\\/')));
  });
});
