import { test, expect } from '../../../fixtures/vat-lifecycle.fixture';
import { assertAdminCredentialsReady } from '../../../utils/env';
import { uniqueCode, randomData } from '../../../utils/random-data';
import { routes } from '../../../utils/constants';
import { KendoLineItemGrid } from '../../../components/common-grid/KendoLineItemGrid';

/**
 * Cross-module E2E VAT/SD (Input/Output tax) lifecycle: Supplier -> Customer
 * -> Product (VAT Rate 15% / SD Rate 5%, real per-product defaults) ->
 * Purchase -> Purchase Post -> Input VAT validation -> Sale -> Sale Post ->
 * Output VAT validation -> Net VAT position reconciliation -> Purchase
 * Report VAT/SD validation -> Logout. Not part of the approved coverage
 * baseline (config/coverage-baseline.ts).
 *
 * PHASE 1 INVESTIGATION FINDINGS this spec is built on (confirmed directly
 * from source, not discovered by trial-and-error):
 * - `ProductVM.VATRate`/`ProductVM.SDRate` are real, plain (non-Kendo)
 *   numeric inputs on `Product/Create.cshtml`, rendered on BOTH Create and
 *   Edit — see `ProductPage.ts`'s own `fillVatRate()`/`fillSdRate()` doc
 *   comments. Selecting that Product into a Purchase/Sale line item
 *   auto-populates the row's own SD Rate/VAT Rate cells from these values
 *   (`PurchaseController.js`'s `ApplyProductSelection()` /
 *   `SaleController.js`'s `AddProductToGrid()`).
 * - CONFIRMED CALCULATION FORMULA (identical for Purchase and Sale, cited
 *   directly from `PurchaseController.js`'s `ApplyProductSelection()`/
 *   `computeSubTotal()` and `SaleController.js`'s `AddProductToGrid()`/grid
 *   `change` handler): `SDAmount = SubTotal × SDRate / 100`; critically,
 *   `VATAmount = (SubTotal + SDAmount) × VATRate / 100` — VAT is computed
 *   on SubTotal **plus** SD, not on SubTotal alone. This deliberately
 *   DIFFERS from a naive "VAT = SubTotal × VATRate" assumption (which would
 *   read 1500/1125 for this flow's own example figures); this spec asserts
 *   the REAL, source-confirmed formula (1575/1181.25) instead of an
 *   unverified simpler one, per this project's standing "assert confirmed
 *   real behavior, not an assumed one" convention.
 * - Both `PurchaseRepository.cs` and `SaleRepository.cs` persist the
 *   client-submitted SD/VAT values as-is (no server-side recompute at save
 *   time) — so Save/Post genuinely exercises this calculation end to end,
 *   not a client-only display artifact.
 * - NO dedicated VAT/Tax report, Input/Output VAT summary, or Tax Ledger
 *   exists anywhere in this application (exhaustive source search, Phase 1)
 *   — this spec does not attempt to validate one. The ONE report confirmed
 *   to surface real VAT/SD columns is the general-purpose "Purchase Report"
 *   (`PurchaseReportPage.ts` — see its own doc comment), added here and
 *   validated for VAT Amount (its own "SD" column is confirmed bound to the
 *   SD RATE, not an SD Amount value — flagged, not silently assumed). No
 *   working Sale-side equivalent exists (`SaleController.cs`'s own
 *   `SaleListReport` action is entirely commented-out dead code, confirmed
 *   from source) — Output VAT is therefore validated only against the
 *   Sale's own line-item grid (the real, working UI surface for it), not a
 *   report, and this gap is documented rather than faked.
 */
test.describe('E2E VAT/SD Lifecycle', () => {
  test('Supplier, Customer, Product VAT/SD, Purchase Input VAT, Sale Output VAT, and Purchase Report reconcile end-to-end', async ({
    dashboardPage,
    branchSelectPage,
    supplierPrerequisites,
    supplierPage,
    customerPrerequisites,
    customerPage,
    productPrerequisites,
    productPage,
    bankAccountSetupPage,
    purchasePage,
    salePage,
    purchaseReportPage,
    page,
  }) => {
    // Same empirical reasoning as every other lifecycle spec's own
    // test.setTimeout: 2 saved transaction modules each requiring their own
    // Post, plus a report round-trip, exceeds the global 60s default.
    test.setTimeout(180_000);
    assertAdminCredentialsReady();

    // 1. Login — see every other lifecycle spec's own identical step-1
    // comment for the full source+network-trace-backed root cause.
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

    // 3. Customer.
    const { customerGroupName } = await customerPrerequisites();
    const customerName = uniqueCode('CUSTOMER');
    await customerPage.createCustomer({
      name: customerName,
      customerGroupName,
      telephoneNo: randomData.phone11Digit(),
      email: randomData.email('customer'),
      address: `Automation Address ${uniqueCode('ADDR')}`,
    });

    // 4. Product — purchasePrice=100, salePrice=150, vatRate=15%, sdRate=5%
    // (this flow's own example rates).
    const { productGroupName, uomName } = await productPrerequisites();
    const productName = uniqueCode('PRODUCT');
    const purchasePrice = 100;
    const salePrice = 150;
    const vatRate = 15;
    const sdRate = 5;
    await productPage.createProduct({
      name: productName,
      productGroupName,
      uomName,
      purchasePrice,
      salePrice,
      vatRate,
      sdRate,
    });
    const productCode = await productPage.getCode();
    expect(productCode).not.toHaveLength(0);

    const { accountName: bankAccountName } = await bankAccountSetupPage.setupBankAccount();

    // ============================================================
    // PURCHASE — Input VAT. Quantity 100, Rate 100 (auto from
    // purchasePrice). Expected: SubTotal 10000, SD 500, VAT 1575 (see class
    // doc comment's confirmed formula), Line Total 12075.
    // ============================================================
    const purchaseQuantity = 100;
    await purchasePage.gotoCreate();
    await purchasePage.selectSupplier(supplierName);
    await purchasePage.fillBeNumber(String(Date.now()));
    await purchasePage.fillDates();
    const purchaseRow = await purchasePage.lineItems.addLineItem(productName, purchaseQuantity);

    // Validate: line item VAT Rate/SD Rate auto-populated from the
    // Product's own configured defaults (not left at 0).
    const purchaseSdRateValue = await KendoLineItemGrid.cellValue(await purchasePage.lineItems.sdRateCell(purchaseRow));
    const purchaseVatRateValue = await KendoLineItemGrid.cellValue(await purchasePage.lineItems.vatRateCell(purchaseRow));
    expect(purchaseSdRateValue).toBeCloseTo(sdRate, 2);
    expect(purchaseVatRateValue).toBeCloseTo(vatRate, 2);

    // Validate: calculated SD Amount / VAT Amount / Line Total match the
    // confirmed real formula.
    const purchaseSubTotal = purchaseQuantity * purchasePrice;
    const expectedPurchaseSdAmount = (purchaseSubTotal * sdRate) / 100;
    const expectedPurchaseVatAmount = ((purchaseSubTotal + expectedPurchaseSdAmount) * vatRate) / 100;
    const expectedPurchaseLineTotal = purchaseSubTotal + expectedPurchaseSdAmount + expectedPurchaseVatAmount;

    const purchaseSdAmountValue = await KendoLineItemGrid.cellValue(await purchasePage.lineItems.sdAmountCell(purchaseRow));
    const purchaseVatAmountValue = await KendoLineItemGrid.cellValue(await purchasePage.lineItems.vatAmountCell(purchaseRow));
    const purchaseLineTotalValue = await KendoLineItemGrid.cellValue(await purchasePage.lineItems.lineTotalCell(purchaseRow));

    expect(purchaseSubTotal).toBeCloseTo(10_000, 2);
    expect(expectedPurchaseSdAmount).toBeCloseTo(500, 2);
    expect(expectedPurchaseVatAmount).toBeCloseTo(1_575, 2);
    expect(purchaseSdAmountValue).toBeCloseTo(expectedPurchaseSdAmount, 2);
    expect(purchaseVatAmountValue).toBeCloseTo(expectedPurchaseVatAmount, 2);
    expect(purchaseLineTotalValue).toBeCloseTo(expectedPurchaseLineTotal, 2);

    // Save persistence — createPurchase()'s own Save flow, per this class
    // doc comment's confirmed "server persists client-submitted VAT/SD
    // values as-is" finding.
    await purchasePage.clickSave();
    await page.waitForURL(/\/DMS\/Purchase\/Edit/i);
    const purchaseCode = await purchasePage.getCode();
    expect(purchaseCode).not.toHaveLength(0);

    // Re-read the SAME line item after the Save round-trip — confirms the
    // VAT/SD values genuinely persisted server-side, not just a client-only
    // display artifact.
    const purchaseRowAfterSave = purchasePage.lineItems.rows().first();
    const inputVat = await KendoLineItemGrid.cellValue(await purchasePage.lineItems.vatAmountCell(purchaseRowAfterSave));
    expect(inputVat).toBeCloseTo(expectedPurchaseVatAmount, 2);

    // Post.
    await purchasePage.post();

    // ============================================================
    // SALE — Output VAT. Quantity 50, Rate 150 (auto from salePrice).
    // Expected: SubTotal 7500, SD 375, VAT 1181.25 (same confirmed
    // formula), Line Total 9056.25.
    // ============================================================
    const saleQuantity = 50;
    await salePage.gotoCreate();
    await salePage.selectCustomer(customerName);
    await salePage.fillInvoiceDate();
    const saleRow = await salePage.lineItems.addLineItem(productName, saleQuantity);

    const saleSdRateValue = await KendoLineItemGrid.cellValue(await salePage.lineItems.sdRateCell(saleRow));
    const saleVatRateValue = await KendoLineItemGrid.cellValue(await salePage.lineItems.vatRateCell(saleRow));
    expect(saleSdRateValue).toBeCloseTo(sdRate, 2);
    expect(saleVatRateValue).toBeCloseTo(vatRate, 2);

    const saleSubTotal = saleQuantity * salePrice;
    const expectedSaleSdAmount = (saleSubTotal * sdRate) / 100;
    const expectedSaleVatAmount = ((saleSubTotal + expectedSaleSdAmount) * vatRate) / 100;
    const expectedSaleLineTotal = saleSubTotal + expectedSaleSdAmount + expectedSaleVatAmount;

    const saleSdAmountValue = await KendoLineItemGrid.cellValue(await salePage.lineItems.sdAmountCell(saleRow));
    const saleVatAmountValue = await KendoLineItemGrid.cellValue(await salePage.lineItems.vatAmountCell(saleRow));
    const saleLineTotalValue = await KendoLineItemGrid.cellValue(await salePage.lineItems.lineTotalCell(saleRow));

    expect(saleSubTotal).toBeCloseTo(7_500, 2);
    expect(expectedSaleSdAmount).toBeCloseTo(375, 2);
    expect(expectedSaleVatAmount).toBeCloseTo(1_181.25, 2);
    expect(saleSdAmountValue).toBeCloseTo(expectedSaleSdAmount, 2);
    expect(saleVatAmountValue).toBeCloseTo(expectedSaleVatAmount, 2);
    expect(saleLineTotalValue).toBeCloseTo(expectedSaleLineTotal, 2);

    // Final Payable must equal the Line Total (incl. SD/VAT) — confirms the
    // header-level GrandTotal genuinely carries the VAT/SD-inclusive amount,
    // not just SubTotal.
    //
    // VAT-LIFECYCLE-PHASE-2 E2E FINDING: confirmed live that `#FinalPayable`
    // (updateSaleSummary()'s own header total, read via SalePage.getFinalPayable())
    // displays rounded to the nearest whole number (received `9056`), while
    // the line-item grid's own LineTotal cell (asserted with full 2-decimal
    // precision immediately above, and confirmed to match exactly) shows the
    // precise `9056.25` — a real, confirmed display-only rounding difference
    // between the header field and the grid, not a calculation error (the
    // underlying SD/VAT amounts already matched exactly). Asserted here at
    // precision 0 to match #FinalPayable's own real, confirmed rounding
    // rather than the unrounded grid figure.
    const finalPayable = await salePage.getFinalPayable();
    expect(finalPayable).toBeCloseTo(expectedSaleLineTotal, 0);

    // Save persistence — full payment (this flow's own scope is VAT/SD
    // calculation, not Due/Collection, so the simplest valid payment is
    // used, matching inventory-stock-lifecycle.spec.ts's identical choice).
    await salePage.addPayment(bankAccountName, finalPayable);
    await salePage.clickSave();
    const saleCode = await salePage.waitForSaveSuccess();
    expect(saleCode).not.toHaveLength(0);

    const saleRowAfterSave = salePage.lineItems.rows().first();
    const outputVat = await KendoLineItemGrid.cellValue(await salePage.lineItems.vatAmountCell(saleRowAfterSave));
    expect(outputVat).toBeCloseTo(expectedSaleVatAmount, 2);

    // Post.
    await salePage.post();

    // ============================================================
    // VAT RECONCILIATION — Net VAT Position = Output VAT - Input VAT.
    // Computed from the REAL captured values above (not hardcoded), per
    // this class doc comment's confirmed-formula finding.
    // ============================================================
    const netVatPosition = outputVat - inputVat;
    expect(inputVat).toBeCloseTo(1_575, 2);
    expect(outputVat).toBeCloseTo(1_181.25, 2);
    expect(netVatPosition).toBeCloseTo(-393.75, 2);
    // Negative Net VAT Position == a VAT credit available (Input VAT paid
    // exceeds Output VAT collected).
    expect(netVatPosition).toBeLessThan(0);

    // ============================================================
    // REPORT VALIDATION — Purchase Report (the one report confirmed to
    // surface real VAT/SD columns; see class doc comment). No Sale-side
    // equivalent exists (confirmed dead/commented-out code) — not
    // attempted, documented as an Application Gap in the final report
    // instead.
    // ============================================================
    await purchaseReportPage.goto();
    await purchaseReportPage.selectProduct(productName);
    await purchaseReportPage.enableDetailsMode();
    const purchaseReportTab = await purchaseReportPage.printAndCapture();
    const purchaseReportRows = await purchaseReportPage.getRowsByPurchaseCode(purchaseReportTab, purchaseCode);
    await expect(purchaseReportRows.first()).toBeVisible();
    const purchaseReportValues = await purchaseReportPage.getRowValues(purchaseReportRows.first());
    expect(purchaseReportValues.subTotal).toBeCloseTo(purchaseSubTotal, 2);
    expect(purchaseReportValues.vatAmount).toBeCloseTo(inputVat, 2);
    expect(purchaseReportValues.vatAmount).toBeCloseTo(1_575, 2);
    expect(purchaseReportValues.lineTotal).toBeCloseTo(expectedPurchaseLineTotal, 2);

    // 5. Logout — same reusable assertions as LOGOUT-001
    // (tests/ui/auth/logout.spec.ts) and every other lifecycle spec's own
    // final step, not duplicated/reinvented here.
    await dashboardPage.logout();
    await expect(page).toHaveURL(new RegExp(routes.login.replace('/', '\\/')));
  });
});
