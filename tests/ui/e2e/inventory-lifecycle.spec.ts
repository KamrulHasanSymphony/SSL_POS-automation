import { test, expect } from '../../../fixtures/inventory-lifecycle.fixture';
import { assertAdminCredentialsReady } from '../../../utils/env';
import { uniqueCode } from '../../../utils/random-data';
import { productFormSelectors } from '../../../utils/constants';
import { captureNetworkDiagnostics, sameOrigin, isRealNetworkFailure } from '../../../utils/network-diagnostics';

/**
 * Cross-module E2E inventory/stock lifecycle: Login -> Product + Opening
 * Stock -> Stock Increase Verification -> Purchase (the only real
 * stock-increasing transaction available) -> Stock Ledger Verification ->
 * Stock Report Verification. Mirrors tests/ui/e2e/purchase-lifecycle.spec.ts's
 * structure/conventions exactly. Not part of the approved coverage baseline
 * (config/coverage-baseline.ts).
 *
 * SOURCE INVESTIGATION SUMMARY (exhaustive search of every
 * Areas/**\/Controllers/*.cs and Areas/**\/Controllers/*.cs under both the
 * ShampanPOSUI and SSL_POS_Api projects, every Areas/**\/Views/**\/*.cshtml,
 * every Areas/**\/js/Controllers/*.js, the DB-seeded navigation menu
 * (`Menu Schema and Data.sql`), and the stock-transaction SQL in
 * ProductRepository.cs) — see StockReportPage.ts/ProductPage.ts for the
 * per-field citations this test relies on. Four requested steps do NOT exist
 * as separate modules; each is either substituted with its real mechanism or
 * proven absent with no substitute available:
 *
 * 1. "Opening Stock / Initial Stock Entry" is NOT a separate module. It is a
 *    single `ProductStock` numeric field on Product/Create.cshtml, rendered
 *    ONLY when creating (absent on Edit), and confirmed WRITE-ONCE
 *    (ProductRepository.cs's INSERT binds `@ProductStock`; its UPDATE
 *    statement has no such parameter at all). A dedicated
 *    "ProductsOpeningStocks" import module exists in source but is fully
 *    dead code — excluded from every .csproj's compilation, and its own
 *    service class (`ProductStockService.cs`) instantiates a repository
 *    class with no source file, so it could not even compile if re-enabled.
 *    "Create Product" and "Opening Stock Entry" are therefore ONE real step
 *    below: ProductPage.createProduct() with `openingStock` set.
 *
 * 2. "Stock Transfer" — NO EVIDENCE FOUND anywhere (no controller, view, JS
 *    controller, menu entry, or SQL table/branch across either project).
 *    SKIPPED — no substitute exists; this application has no
 *    location-to-location stock movement of any kind.
 *
 * 3. "Stock Adjustment (Increase/Decrease)" — NO EVIDENCE FOUND. The
 *    superseded inline stock-ledger SQL still present in ProductRepository.cs
 *    (`GetStockReport`'s dead code path) enumerates exactly four
 *    stock-moving transaction types — Purchase, Sale Return (In), Sale,
 *    Purchase Return (Out) — with no fifth UNION branch for any adjustment
 *    table. SKIPPED — no substitute exists.
 *
 * 4. "Warehouse Transfer" — NO EVIDENCE FOUND, and more fundamentally,
 *    "Warehouse" is not a concept in this application at all (confirmed:
 *    zero matches for the word outside a FontAwesome icon class on an
 *    unrelated menu node; the only location/stock-scoping model anywhere is
 *    `Branch` — `BranchProfileVM`/`BranchId`, no `WarehouseVM`). SKIPPED —
 *    no substitute exists.
 *
 * 5. "Stock Ledger Verification" IS real, but is not a separate module — it
 *    is the SAME Stock Report screen (`ProductController.ReportList()`)
 *    with its `isSummary` flag OFF, rendering `Reports/StockDetailsReport`
 *    instead of `Reports/StockSummaryReport`: a genuine per-transaction
 *    ledger (SL, Type, Ref. No, Date, Opening, In Qty, Out Qty, Closing
 *    Stock) grouped per product. See StockReportPage.enableDetailsMode()/
 *    getLedgerRows() for the full citation.
 *
 * DATABASE VERIFICATION: this automation project has no SQL/DB connectivity
 * helper anywhere (confirmed — no mssql/SqlConnection usage exists in
 * utils/**). "Verify using: Database" is therefore substituted with direct
 * verification against the Stock Report / Stock Ledger endpoints, which are
 * themselves this application's only server-side read path over the same
 * data (`ProductRepository.StockReportList` -> stored procedure
 * `dbo.sp_StockReport`) — not a DB query, but the same authoritative source
 * a DB query would read, reached the same way a real user/report consumer
 * does. Adding a new, unproven DB layer here would be new architecture, not
 * reuse of the existing one.
 *
 * NETWORK/JS-ERROR VERIFICATION: `utils/network-diagnostics.ts` (new, this
 * flow) wraps Playwright's own `page.on('pageerror'/'console'/
 * 'requestfailed'/'response')` — no existing helper of this kind existed to
 * duplicate. Hard-asserts on uncaught JS exceptions and same-origin
 * network-level failures/5xx responses; deliberately does not hard-fail on
 * third-party console noise (already-documented CDN latency elsewhere in
 * this project is exactly this class of non-defect noise).
 *
 * TEST DATA STRATEGY: Product/Supplier are always created fresh via
 * `uniqueCode()`, the same pattern purchase-lifecycle.spec.ts and every
 * existing prerequisite fixture in this project already use. Purchase Price
 * is set on the Product (required — Purchase's save handler rejects a
 * UnitPrice <= 0 line item, same finding already documented in
 * purchase-lifecycle.spec.ts) alongside Opening Stock.
 */
test.describe('E2E Inventory / Stock Lifecycle', () => {
  test('Login, Product + Opening Stock, Stock Increase, Purchase, Stock Ledger, and Stock Report reconcile end-to-end', async ({
    dashboardPage,
    branchSelectPage,
    productPage,
    productPrerequisites,
    supplierPage,
    supplierPrerequisites,
    purchasePage,
    stockReportPage,
    page,
  }) => {
    // Same empirical reasoning as purchase-lifecycle.spec.ts's own
    // test.setTimeout: a comparable number of sequential steps (1 saved
    // transaction + its own Post, 3 separate new-tab Print/report
    // round-trips) is expected to exceed the global 60s default.
    test.setTimeout(120_000);
    assertAdminCredentialsReady();

    // 1. Login
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
    const appBaseUrl = page.url();
    const diagnostics = captureNetworkDiagnostics(page);

    // 2. Product + Opening Stock (one real step — see class doc comment §1).
    const { productGroupName, uomName } = await productPrerequisites();
    const productName = uniqueCode('PRODUCT');
    const openingStock = 50;
    const purchasePrice = 300;
    await productPage.createProduct({ name: productName, productGroupName, uomName, purchasePrice, openingStock });
    const productCode = await productPage.getCode();
    expect(productCode).not.toHaveLength(0);
    await expect(page.locator(productFormSelectors.name)).toHaveValue(productName);
    // #ProductStock itself is confirmed Create-only (absent on Edit — see
    // class doc comment §1), so there is no field to read back here; Opening
    // Stock is verified against the Stock Report instead, immediately below.

    // 3. Stock Increase Verification, Part A — the Opening Stock baseline,
    // before any transaction. This Product has zero prior history, so this
    // proves Opening Stock alone raised stock from 0 -> openingStock.
    await stockReportPage.goto();
    await stockReportPage.selectProduct(productName);
    await stockReportPage.enableSummaryMode();
    const baselineTab = await stockReportPage.printAndCapture();
    const baselineRow = await stockReportPage.getProductRow(baselineTab, productName);
    const baselineValues = await stockReportPage.getStockValues(baselineRow);
    expect(baselineValues.openingStock).toBeCloseTo(openingStock, 2);
    expect(baselineValues.currentStock).toBeCloseTo(openingStock, 2);
    expect(baselineValues.inQty).toBeCloseTo(0, 2);
    expect(baselineValues.outQty).toBeCloseTo(0, 2);

    // 4-6. Stock Transfer / Stock Adjustment / Warehouse Transfer — all
    // three proven absent with no substitute (see class doc comment §2-4).
    // No code runs here; there is no reachable UI for any of them.

    // 7. Purchase — the only real, available stock-increasing transaction
    // beyond the Opening Stock baseline (confirmed transaction types: see
    // class doc comment §3). Blank/manual flow (not From-Purchase-Order —
    // that chain is already the subject of purchase-lifecycle.spec.ts).
    const { supplierGroupName } = await supplierPrerequisites();
    const supplierName = uniqueCode('SUPPLIER');
    await supplierPage.createSupplier({
      name: supplierName,
      supplierGroupName,
      address: `Automation Address ${uniqueCode('ADDR')}`,
    });
    const purchaseQuantity = 20;
    const beNumber = String(Date.now());
    const purchaseCode = await purchasePage.createPurchase({
      supplierName,
      beNumber,
      productName,
      quantity: purchaseQuantity,
    });
    expect(purchaseCode).not.toHaveLength(0);
    // Required for this Purchase to be counted anywhere downstream —
    // confirmed rule (purchase-lifecycle.spec.ts): reports/ledgers join on
    // `WHERE PUR.IsPost = 1`.
    await purchasePage.post();

    // 8. Stock Increase Verification, Part B — after the Purchase.
    await stockReportPage.goto();
    await stockReportPage.selectProduct(productName);
    await stockReportPage.enableSummaryMode();
    const postPurchaseTab = await stockReportPage.printAndCapture();
    const postPurchaseRow = await stockReportPage.getProductRow(postPurchaseTab, productName);
    const postPurchaseValues = await stockReportPage.getStockValues(postPurchaseRow);
    expect(postPurchaseValues.currentStock).toBeCloseTo(openingStock + purchaseQuantity, 2);
    expect(postPurchaseValues.inQty).toBeCloseTo(purchaseQuantity, 2);
    expect(postPurchaseValues.outQty).toBeCloseTo(0, 2);

    // 9. Stock Ledger Verification (Details mode — see class doc comment §5).
    await stockReportPage.goto();
    await stockReportPage.selectProduct(productName);
    await stockReportPage.enableDetailsMode();
    const ledgerTab = await stockReportPage.printAndCapture();
    const ledgerRowsForPurchase = await stockReportPage.getLedgerRowsByRefCode(ledgerTab, purchaseCode);
    // No duplicate stock movement: exactly one ledger line for this Purchase.
    await expect(ledgerRowsForPurchase).toHaveCount(1);
    const ledgerValues = await stockReportPage.getLedgerRowValues(ledgerRowsForPurchase.first());
    expect(ledgerValues.transactionType).toContain('Purchase');
    expect(ledgerValues.refCode).toBe(purchaseCode);
    expect(ledgerValues.opening).toBeCloseTo(openingStock, 2);
    expect(ledgerValues.inQty).toBeCloseTo(purchaseQuantity, 2);
    expect(ledgerValues.outQty).toBeCloseTo(0, 2);
    expect(ledgerValues.closingStock).toBeCloseTo(openingStock + purchaseQuantity, 2);

    // 10. Stock Report Verification — final reconciliation: the
    // independently-rendered Summary report (step 8) and Details/Ledger
    // report (step 9) must agree on the same closing quantity.
    expect(postPurchaseValues.currentStock).toBeCloseTo(ledgerValues.closingStock, 2);

    // Network / JS-error verification (see class doc comment).
    diagnostics.stop();
    expect(diagnostics.pageErrors, `Uncaught JS exceptions: ${diagnostics.pageErrors.join('; ')}`).toEqual([]);
    const failedSameOrigin = diagnostics.failedRequests.filter(
      (r) => sameOrigin(appBaseUrl, r.url) && isRealNetworkFailure(r.failure)
    );
    expect(failedSameOrigin, `Failed same-origin requests: ${JSON.stringify(failedSameOrigin)}`).toEqual([]);
    const serverErrorResponses = diagnostics.responses.filter((r) => sameOrigin(appBaseUrl, r.url) && r.status >= 500);
    expect(serverErrorResponses, `Same-origin 5xx responses: ${JSON.stringify(serverErrorResponses)}`).toEqual([]);
  });
});
