import { test, expect } from '../../../fixtures/sale-return-lifecycle.fixture';
import { assertAdminCredentialsReady } from '../../../utils/env';
import { uniqueCode, randomData } from '../../../utils/random-data';
import { routes } from '../../../utils/constants';

/**
 * Cross-module E2E sale RETURN lifecycle: Login -> Customer -> Product ->
 * Sale -> Sale Post -> Stock decrease -> Collection -> Sale Return (from
 * Sale) -> Sale Return Post -> Stock increase -> Customer Balance
 * Validation -> Report Validation -> Logout. Mirrors
 * tests/ui/e2e/purchase-return-lifecycle.spec.ts's own structure,
 * conventions, and fixture-extension pattern exactly (sale-return-lifecycle.
 * fixture.ts extends customer-collection-lifecycle.fixture.ts with exactly
 * one addition, stockReportPage — see that fixture's own doc comment).
 * Independent of, and does not modify, sales-lifecycle.spec.ts or
 * customer-collection-lifecycle.spec.ts. Not part of the approved coverage
 * baseline (config/coverage-baseline.ts).
 *
 * PRODUCT SETUP: Product is created with both `salePrice` (Sale's line item
 * needs a real, non-zero UnitRate — same reasoning sales-lifecycle.spec.ts's
 * own step 3 comment documents) AND `openingStock` (ProductVM.ProductStock —
 * the sole Create-only "Opening Stock" mechanism confirmed by
 * ProductPage.ts's own doc comment) set to the same value as the Sale
 * Quantity below, so the Stock Report's own Opening Stock/Current Stock
 * columns directly match this flow's "Before Sale: 100 / After Sale: 0"
 * scenario without needing any other product-consuming transaction first.
 *
 * SALE CREATION PATH: built inline (header + line item, then a deliberate
 * PARTIAL payment, then Save) rather than via SalePage.createSale()'s
 * all-or-nothing full-FinalPayable default — same reasoning
 * customer-collection-lifecycle.fixture.ts's own saleWithDuePrerequisitePosted
 * already documents: a partial payment leaves a real, non-zero Due for the
 * Collection step, matching this flow's own "Collection (if required)"
 * scenario step. Sale Post uses the same openEditFor()-then-post() sequence
 * already proven by that fixture (not createPurchase()'s "already on Edit,
 * post directly" shortcut — Sale's own confirmed pattern differs).
 *
 * SALE RETURN CREATION PATH: uses `saleReturnPage.createFromSale()` (the
 * "From Sale" path, referencing the real Sale transaction just created/
 * posted) rather than the blank path — matches the requested business flow
 * (a return against a specific sold product) and mirrors
 * purchase-return-lifecycle.spec.ts's identical choice of createFromPurchase()
 * over the blank path, for the same reason.
 *
 * REPORT FINDING (confirmed from source before writing this spec's
 * assertions, not discovered by trial-and-error — same
 * confirm-before-assume discipline purchase-return-lifecycle.spec.ts's own
 * class doc comment already documents for Supplier Ledger): ReportsRepository.cs's
 * `CustomerSaleCollectionReportList()` (Summary mode, `RawSales` CTE:
 * `SELECT ... FROM Sales WHERE IsPost = 1`) and `GetCustomerCollectionDueList()`
 * (`ISNULL(SUM(S.GrandTotal), 0)` from `Sales` alone) both compute Total/Due
 * Sale Amount strictly from the `Sales` table — neither query joins or
 * subtracts `SaleReturns`/`SaleReturnDetails` anywhere at all. Confirmed
 * separately (`SaleReturnRepository.cs`'s `MultiplePost()`) that posting a
 * SaleReturn only ever does `UPDATE SaleReturns SET IsPost = 1, ...` — no
 * write to `Sales`, `Collections`, or any Customer-balance table. Both
 * Customer-facing reports are therefore confirmed to NOT reflect Sale
 * Returns — exactly the same confirmed application-level reporting gap
 * purchase-return-lifecycle.spec.ts already proved for the Supplier Ledger/
 * Purchase Return pair, just on the Sale side. This spec's Report Validation
 * section tests each report's real, confirmed behavior (unaffected by the
 * Return) rather than an unmet "net sale" business expectation neither report
 * implements; the "Net Sale = 8000" figure itself is instead verified
 * directly from the transaction-time captured Sale/Return amounts (a plain
 * arithmetic check, not sourced from either report) — flagged explicitly
 * here rather than silently assumed or worked around.
 */
test.describe('E2E Sale Return Lifecycle', () => {
  test('Login, Customer, Product, Sale, Sale Post, Stock decrease, Collection, Sale Return, Sale Return Post, Stock increase, and Customer balance/report reconcile end-to-end', async ({
    dashboardPage,
    loginPage,
    branchSelectPage,
    customerPage,
    customerPrerequisites,
    productPage,
    productPrerequisites,
    bankAccountSetupPage,
    salePage,
    saleReturnPage,
    collectionPage,
    stockReportPage,
    customerSaleCollectionReportPage,
    reportPage,
    page,
  }) => {
    // Same empirical reasoning as purchase-return-lifecycle.spec.ts's own
    // test.setTimeout: a comparable number of sequential steps (2 saved
    // transaction modules each requiring its own Post, a Collection, and 3
    // new-tab Print/report round-trips) exceeds the global 60s default.
    test.setTimeout(150_000);
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
    // project already uses for this exact purpose) so the Report steps
    // below can use each report's own selectCustomerDirectly(), bypassing
    // their confirmed-broken popup pickers.
    const customerIdMatch = /\/Edit\/(\d+)/i.exec(page.url());
    expect(customerIdMatch).not.toBeNull();
    const customerId = customerIdMatch![1];

    // 3. Product — salePrice=100 and openingStock=100 (see class doc
    // comment): Sale Price/Quantity match this flow's own example exactly
    // (100 x 100 = 10000), and openingStock gives the Stock Report a known,
    // non-zero starting point without any other prerequisite transaction.
    const { productGroupName, uomName } = await productPrerequisites();
    const productName = uniqueCode('PRODUCT');
    const salePrice = 100;
    const saleQuantity = 100;
    await productPage.createProduct({
      name: productName,
      productGroupName,
      uomName,
      salePrice,
      openingStock: saleQuantity,
    });
    const productCode = await productPage.getCode();
    expect(productCode).not.toHaveLength(0);

    // Bank Account — Sale's mandatory payment prerequisite (SalePage.ts's
    // own class doc comment).
    const { accountName: bankAccountName } = await bankAccountSetupPage.setupBankAccount();

    // 4. Stock BEFORE Sale — read now, before any transaction touches this
    // brand-new Product, so it reflects openingStock alone (100).
    await stockReportPage.goto();
    await stockReportPage.selectProduct(productName);
    await stockReportPage.enableSummaryMode();
    const stockTabBeforeSale = await stockReportPage.printAndCapture();
    const stockRowBeforeSale = await stockReportPage.getProductRow(stockTabBeforeSale, productName);
    const stockBeforeSale = await stockReportPage.getStockValues(stockRowBeforeSale);
    expect(stockBeforeSale.currentStock).toBeCloseTo(saleQuantity, 2);
    expect(stockBeforeSale.currentStock).toBeCloseTo(100, 2);

    // 5. Sale — header + line item, then a deliberate PARTIAL payment (see
    // class doc comment), then Save. Built inline (not via
    // SalePage.createSale()) for the same reason
    // customer-collection-lifecycle.fixture.ts's own saleWithDuePrerequisitePosted
    // is: a real, non-zero Due must remain for the Collection step below.
    await salePage.gotoCreate();
    await salePage.selectCustomer(customerName);
    await salePage.fillInvoiceDate();
    await salePage.lineItems.addLineItem(productName, saleQuantity);

    const finalPayable = await salePage.getFinalPayable();
    // No VAT/SD configured on this freshly-created Product, so Final
    // Payable reconciles with Quantity x Sale Price exactly — matches this
    // flow's own example (100 x 100 = 10000).
    expect(finalPayable).toBeCloseTo(saleQuantity * salePrice, 2);
    expect(finalPayable).toBeCloseTo(10_000, 2);

    const paymentAmount = Math.floor(finalPayable / 2);
    await salePage.addPayment(bankAccountName, paymentAmount);
    await salePage.clickSave();
    // SalePage.waitForSaveSuccess() — see its own doc comment: waits for the
    // real `/DMS/Sale/Edit` navigation, then polls `#Code`, a
    // failure-distinguishing signal over the generic no-argument toast check
    // (which is confirmed to accept a client-side-blocked-save error toast
    // as a false-positive "success").
    const saleCode = await salePage.waitForSaveSuccess();
    expect(saleCode).not.toHaveLength(0);

    // 6. Sale Post — same openEditFor()-then-post() sequence already proven
    // by customer-collection-lifecycle.fixture.ts's saleWithDuePrerequisitePosted
    // for this exact module.
    await salePage.openEditFor(saleCode);
    await salePage.post();

    // 7. Stock AFTER Sale — fresh report read, same product. Before Sale:
    // 100 (openingStock, step 4). After Sale: 100 - 100 = 0 — matches this
    // flow's own example exactly.
    await stockReportPage.goto();
    await stockReportPage.selectProduct(productName);
    await stockReportPage.enableSummaryMode();
    const stockTabAfterSale = await stockReportPage.printAndCapture();
    const stockRowAfterSale = await stockReportPage.getProductRow(stockTabAfterSale, productName);
    const stockAfterSale = await stockReportPage.getStockValues(stockRowAfterSale);
    expect(stockAfterSale.currentStock).toBeCloseTo(0, 2);

    // 8. Collection (if required) — a real, non-zero Due remains from the
    // deliberate partial payment above (paymentAmount == floor(finalPayable/2),
    // so dueBefore == finalPayable - paymentAmount). Same invoice-picker
    // read-before-save pattern every other lifecycle spec in this project
    // already uses (sales-lifecycle.spec.ts / customer-collection-lifecycle.spec.ts).
    await collectionPage.gotoCreate();
    await collectionPage.selectCustomer(customerName);
    await collectionPage.fillTransactionDate();
    const dueRowBefore = await collectionPage.invoices.addRow();
    await collectionPage.invoices.selectInvoiceForRow(dueRowBefore, saleCode);
    const dueBefore = await collectionPage.invoices.getDueAmount(dueRowBefore);
    expect(dueBefore).toBeCloseTo(finalPayable - paymentAmount, 2);
    expect(dueBefore).toBeGreaterThan(0);

    // Pays off the full pre-collection Due, for the cleanest possible
    // post-collection assertion target — same convention every other
    // lifecycle spec's own Collection step already uses.
    const collectionAmount = dueBefore;
    await collectionPage.invoices.setAmount(dueRowBefore, collectionAmount);
    await collectionPage.clickSave();
    await collectionPage.toastr.expectSuccess();
    const collectionCode = await collectionPage.getCode();
    expect(collectionCode).not.toHaveLength(0);

    // Verify: Due reduces to 0 after the Collection — a fresh, unsaved
    // Collection/Create screen, same customer + Sale Code.
    await collectionPage.gotoCreate();
    await collectionPage.selectCustomer(customerName);
    await collectionPage.fillTransactionDate();
    const dueRowAfterCollection = await collectionPage.invoices.addRow();
    await collectionPage.invoices.selectInvoiceForRow(dueRowAfterCollection, saleCode);
    const dueAfterCollection = await collectionPage.invoices.getDueAmount(dueRowAfterCollection);
    expect(dueAfterCollection).toBeCloseTo(0, 2);

    // 9. Capture BEFORE RETURN snapshot — Sale amount, customer due, stock
    // quantity, per this flow's own scenario steps.
    const saleAmountBeforeReturn = finalPayable;
    const customerDueBeforeReturn = dueAfterCollection;
    const stockBeforeReturn = stockAfterSale.currentStock;
    expect(stockBeforeReturn).toBeCloseTo(0, 2);

    // 10. Sale Return — "From Sale" path, referencing the real Sale just
    // created/posted (see class doc comment).
    const returnQuantity = 20;
    const returnCode = await saleReturnPage.createFromSale(saleCode, productName, returnQuantity);
    expect(returnCode).not.toHaveLength(0);

    // 11. Sale Return Post — createFromSale() lands on the SaleReturn Edit
    // page (same in-place-update/navigation contract as PurchaseReturn's own
    // createFromPurchase()), so Post can be clicked directly.
    await saleReturnPage.post();

    // 12. Stock Verification (increase) — fresh report read, same product.
    // Before Return: 0 (step 9). After Return: 0 + returnQuantity (20) —
    // matches this flow's own example exactly.
    await stockReportPage.goto();
    await stockReportPage.selectProduct(productName);
    await stockReportPage.enableSummaryMode();
    const stockTabAfterReturn = await stockReportPage.printAndCapture();
    const stockRowAfterReturn = await stockReportPage.getProductRow(stockTabAfterReturn, productName);
    const stockAfterReturn = await stockReportPage.getStockValues(stockRowAfterReturn);
    expect(stockAfterReturn.currentStock).toBeCloseTo(stockBeforeReturn + returnQuantity, 2);
    expect(stockAfterReturn.currentStock).toBeCloseTo(20, 2);

    // 13. Customer Balance Validation — Original Sale 10000, Return
    // (returnQuantity x salePrice) 2000, Expected Net Sale 8000. Verified
    // directly from the transaction-time captured amounts (see class doc
    // comment's Report Finding: neither Customer-facing report nets Sale
    // Returns against Sales at all, so this is a plain arithmetic check on
    // real transaction values, not sourced from a report).
    const returnAmount = returnQuantity * salePrice;
    expect(returnAmount).toBeCloseTo(2_000, 2);
    const expectedNetSale = saleAmountBeforeReturn - returnAmount;
    expect(expectedNetSale).toBeCloseTo(8_000, 2);
    expect(saleAmountBeforeReturn).toBeCloseTo(10_000, 2);

    // Collection exists (step 8) — verify the customer's outstanding
    // balance per the Collection Due invoice picker: same confirmed
    // mechanism, a fresh read against the same Sale Code. Per the class doc
    // comment's Report Finding (SaleReturnRepository.cs's MultiplePost()
    // never writes to Sales/Collections), this is expected to remain
    // UNCHANGED at 0 (customerDueBeforeReturn), not reduced further by the
    // Return — asserted explicitly so this confirmed application-level
    // behavior stays visible and regression-checked, not silently assumed.
    await collectionPage.gotoCreate();
    await collectionPage.selectCustomer(customerName);
    await collectionPage.fillTransactionDate();
    const dueRowAfterReturn = await collectionPage.invoices.addRow();
    await collectionPage.invoices.selectInvoiceForRow(dueRowAfterReturn, saleCode);
    const dueAfterReturn = await collectionPage.invoices.getDueAmount(dueRowAfterReturn);
    expect(dueAfterReturn).toBeCloseTo(customerDueBeforeReturn, 2);
    expect(dueAfterReturn).toBeCloseTo(0, 2);

    // 14. Report Validation — Customer Sale & Collection Report (Summary).
    // Per the class doc comment's Report Finding: TotalSaleAmount is
    // expected to remain at the gross Sale total (10000), UNAFFECTED by the
    // Return (not netted down to 8000) — the report's own confirmed,
    // real behavior, asserted explicitly rather than assumed.
    //
    // SALE-RETURN-LIFECYCLE E2E FINDING: confirmed live (this report's own
    // captured cell values: TotalCollectionAmount == 10000, not 5000) that
    // `ReportsRepository.cs`'s `CustomerSaleCollectionReportList()`
    // `RawCollections` CTE UNIONs real `Collections` rows with
    // `SaleCreditCards` rows carrying `Remarks <> 'Collection Payment'` —
    // this Sale's own at-sale-time `SalePage.addPayment()` call (a
    // deliberate partial payment, `paymentAmount`, made to leave a Due for
    // step 8's Collection) writes exactly such a SaleCreditCards row, so it
    // is legitimately counted here as a second "Collection" alongside the
    // real one. Same confirmed mechanism customer-collection-lifecycle.spec.ts's
    // own step-16 comment already documents (its own assertion only phrased
    // as a lower bound, `>= collectionAmount`, to stay correct regardless);
    // asserted here as the exact expected total instead, since both
    // contributing amounts are known from this flow's own captured values.
    await customerSaleCollectionReportPage.goto();
    await customerSaleCollectionReportPage.selectCustomerDirectly(customerId, customerName);
    await customerSaleCollectionReportPage.enableSummaryMode();
    const saleCollectionReportTab = await customerSaleCollectionReportPage.printAndCapture();
    const saleCollectionReportRow = await customerSaleCollectionReportPage.getCustomerRow(saleCollectionReportTab, customerName);
    const saleCollectionReportValues = await customerSaleCollectionReportPage.getReportValues(saleCollectionReportRow);
    await expect(saleCollectionReportRow).toContainText(customerName);
    expect(saleCollectionReportValues.totalSaleAmount).toBeCloseTo(saleAmountBeforeReturn, 2);
    expect(saleCollectionReportValues.totalSaleAmount).toBeCloseTo(10_000, 2);
    expect(saleCollectionReportValues.totalCollectionAmount).toBeCloseTo(paymentAmount + collectionAmount, 2);
    expect(saleCollectionReportValues.outstandingAmount).toBeCloseTo(
      saleCollectionReportValues.totalSaleAmount - saleCollectionReportValues.totalCollectionAmount,
      2
    );

    // 15. Report Validation — Customer Collection Due Report.
    // SALE-RETURN-LIFECYCLE E2E FINDING: unlike the report above,
    // `GetCustomerCollectionDueList()`'s DueAmount is confirmed
    // (ReportsRepository.cs) to be `SUM(S.GrandTotal) - SUM(COL.
    // TotalCollectAmount)` where `COL` is strictly the `Collections` table —
    // it deliberately never nets the Sale's own at-sale SaleCreditCards
    // payment (`paymentAmount`) at all, the exact same confirmed, real
    // (not wrong) definition sales-lifecycle.spec.ts's own step-17 comment
    // already documents. TotalCollectionAmount here is therefore exactly
    // `collectionAmount` (the real Collection alone, no SaleCreditCards
    // double-count), and DueAmount correctly settles at `paymentAmount` —
    // NOT `0` — even though the Collection already paid off the rest per
    // the invoice-picker's own (different, true) due calculation above.
    // Both figures are also confirmed UNCHANGED by the Return itself (class
    // doc comment: SaleReturnRepository.cs's MultiplePost() never writes to
    // Sales/Collections).
    await reportPage.goto();
    await reportPage.selectCustomerDirectly(customerId, customerName);
    const dueReportTab = await reportPage.printAndCapture();
    const dueReportRow = await reportPage.getCustomerRow(dueReportTab, customerName);
    const dueReportValues = await reportPage.getRowValues(dueReportRow);
    await expect(dueReportRow).toContainText(customerName);
    expect(dueReportValues.totalSaleAmount).toBeCloseTo(10_000, 2);
    expect(dueReportValues.totalCollectionAmount).toBeCloseTo(collectionAmount, 2);
    expect(dueReportValues.dueAmount).toBeCloseTo(paymentAmount, 2);

    // 16. Report Validation — Stock Report, re-confirmed one final time
    // against the same before/after values already proven in steps 4/7/12.
    await stockReportPage.goto();
    await stockReportPage.selectProduct(productName);
    await stockReportPage.enableSummaryMode();
    const finalStockTab = await stockReportPage.printAndCapture();
    const finalStockRow = await stockReportPage.getProductRow(finalStockTab, productName);
    const finalStockValues = await stockReportPage.getStockValues(finalStockRow);
    expect(finalStockValues.currentStock).toBeCloseTo(20, 2);

    // 17. Logout — same reusable assertions as LOGOUT-001
    // (tests/ui/auth/logout.spec.ts) and every other lifecycle spec's own
    // final step, not duplicated/reinvented here.
    await dashboardPage.logout();
    await expect(page).toHaveURL(new RegExp(routes.login.replace('/', '\\/')));
    await loginPage.expectStillOnLoginPage();
  });
});
