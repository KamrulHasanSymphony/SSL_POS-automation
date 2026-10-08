import { test, expect } from '../../../fixtures/purchase-lifecycle.fixture';
import { assertAdminCredentialsReady } from '../../../utils/env';
import { uniqueCode, randomData } from '../../../utils/random-data';
import { routes } from '../../../utils/constants';
import { CustomerSaleCollectionReportPage } from '../../../pages/reports/CustomerSaleCollectionReportPage';
import { PurchaseReportPage } from '../../../pages/reports/PurchaseReportPage';
import { PerformanceRecorder } from '../../../helpers/PerformanceRecorder';

/**
 * STEP PERFORMANCE-LOAD-LIFECYCLE-INVESTIGATION-AND-VALIDATION
 *
 * Cross-module E2E performance lifecycle: Login -> Use Existing Large
 * Dataset -> Product/Customer/Supplier Search Performance -> Purchase Entry
 * -> Purchase Save/Post -> Sale Entry -> Sale Save/Post -> Report Loading
 * (Stock, Supplier Ledger, Customer Sale, Purchase) -> Logout. This spec
 * MEASURES and DOCUMENTS real, already-implemented workflows — per this
 * task's own rules, it changes no SQL, no index, no API, no business logic,
 * and inserts no fabricated bulk data. Not part of the approved coverage
 * baseline (config/coverage-baseline.ts).
 *
 * PHASE 1 INVESTIGATION FINDINGS (confirmed from this project's own prior,
 * independently-run lifecycle specs — real, live-confirmed evidence
 * already on record, not re-derived from assumption; every item below cites
 * the exact file/comment it came from):
 *
 * 1. DATA VOLUME — this shared, continuously-reused test environment
 *    already carries real, organically-grown ERP-scale data (NOT fabricated
 *    for this spec, per the "do not fake large data" rule):
 *    - Customer table: confirmed live at 200+ rows and rising
 *      (`components/kendo/KendoComboBox.ts`'s own
 *      "SALE-RETURN-LIFECYCLE E2E FINDING" — a freshly-typed unique Customer
 *      name resolved to a `data-offset-index` in the 200s).
 *    - BankInformation table: confirmed live at 180+ rows and rising
 *      (same file, "BANKACCOUNT-COMBO-INVESTIGATION E2E FINDING").
 *    - Product catalog: confirmed live at 140+ rows and rising
 *      (`components/common-grid/KendoLineItemGrid.ts`'s own
 *      "SALE-PRODUCT-PICKER-INVESTIGATION E2E FINDING").
 *    This spec reuses that real, already-large dataset for its search-
 *    performance measurements (Steps 3-5) rather than seeding synthetic
 *    volume; it additionally creates exactly one fresh Supplier/Customer/
 *    Product record each (same minimal pattern every other lifecycle spec
 *    in this project already uses) purely to have a deterministic,
 *    known-name search target inside that real, large table.
 *
 * 2. CONFIRMED, PRE-EXISTING PERFORMANCE DEFECTS (this spec's own live runs
 *    reconfirm these, they are not first discovered here):
 *    - Customer (`#CustomerId`) and Bank (`#BankId`) Kendo combos declare
 *      `filter: "contains"` but perform NO real server- or client-side
 *      filtering at all — every keystroke still renders the FULL,
 *      ever-growing table as unfiltered options, requiring a scroll-through
 *      of a virtualized list hundreds of rows deep
 *      (`KendoComboBox.typeAndSelectFirst()`'s own doc comment). This
 *      degrades directly with data growth — it will only get slower over
 *      time, never self-corrects.
 *    - The Sale/Purchase product-line-item picker (`KendoLineItemGrid`) and
 *      the Stock/Purchase report's own product pickers ALL list every
 *      product unfiltered, paged 10/page — a freshly created product can
 *      land 15+ pages deep, and this was the CONFIRMED root cause of a real
 *      test timeout in `sales-lifecycle.spec.ts` before a per-column filter
 *      fast-path was added. `PurchaseReportPage`'s own picker instead uses a
 *      dedicated, always-live `#FilterProductName` input — genuinely fast
 *      regardless of catalog size — confirmed faster by design, not just by
 *      luck.
 *    - `CollectionPage.selectCustomer()` and
 *      `BankAccountSetupPage`'s own Bank selection were both confirmed to
 *      need their default action timeout bumped to 60000ms specifically
 *      because of the above — but `SalePage.selectCustomer()` (used by this
 *      spec's own Sale flow) and `PurchasePage.selectSupplier()` currently
 *      use NO such override (Playwright's default action timeout). This
 *      spec's own Customer/Supplier Search Performance measurements
 *      (Steps 4-5) are the first live check of whether that gap is
 *      currently safe or already a real risk — see Bottleneck Findings in
 *      the final report for the outcome.
 *
 * 3. NO SEPARATE "PAGE LOAD" METRIC EXISTS TO MEASURE INDEPENDENTLY of
 *    navigation — `gotoCreate()` calls `page.goto()` (full navigation) with
 *    no separate "data ready" signal beyond the form itself rendering; this
 *    spec measures `goto -> form ready` as the page's own load time,
 *    consistent with how `DashboardPage.expectLoaded()`'s own doc comment
 *    already treats "URL settled" vs. "content ready" as two different
 *    instants for this same application.
 *
 * PERFORMANCE THRESHOLDS (per this task's own benchmark table) are recorded
 * as DATA on every measurement (PASS/FAIL), never used to hard-fail the
 * test outright (`expect.soft()` only, per the task's own "do not fail
 * tests only based on assumptions — first capture actual baseline" rule) —
 * a slow-but-working step is documented, not treated as a crash. Genuine
 * functional failures (a real thrown error/timeout) are NOT swallowed and
 * still fail this test normally, with Playwright's own trace/screenshot/
 * video evidence attached exactly as any other spec in this project.
 */

const THRESHOLD_LOGIN_MS = 5_000;
const THRESHOLD_DROPDOWN_MS = 5_000;
const THRESHOLD_GRID_MS = 5_000;
const THRESHOLD_SAVE_MS = 10_000;
const THRESHOLD_POST_MS = 10_000;
const THRESHOLD_REPORT_MS = 15_000;

test.describe('E2E Performance / Load Lifecycle', () => {
  test('Login, search, transaction, and report performance are measured and documented end-to-end', async (
    {
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
      stockReportPage,
      supplierLedgerPage,
      logger,
      page,
    },
    testInfo
  ) => {
    // Generous ceiling, not a performance assertion itself: this spec makes
    // MORE round trips than any other lifecycle spec in this project (2 full
    // transactions + 4 reports, each independently timed) — sized the same
    // empirical way every other lifecycle spec's own test.setTimeout is.
    test.setTimeout(300_000);
    assertAdminCredentialsReady();
    const perf = new PerformanceRecorder(logger);

    // Two page objects this spec needs beyond purchase-lifecycle.fixture's
    // own set — instantiated directly against the same `page`, same
    // established pattern as tests/ui/e2e/multi-branch-lifecycle.spec.ts's
    // own `new XPage(...)` calls, rather than adding a new fixture file
    // (out of this task's allowed file-scope: pages/components/tests/
    // helpers only).
    const customerSaleCollectionReportPage = new CustomerSaleCollectionReportPage(page);
    const purchaseReportPage = new PurchaseReportPage(page);
    // NOTE: Collection is not part of this task's own Lifecycle Flow/Test
    // Scenario sections (Login -> ... -> Purchase -> Sale -> Report ->
    // Logout only) — not measured here, matching the task's explicit scope
    // rather than adding unrequested coverage.

    // ============================================================
    // 1. LOGIN — same real mechanism every other lifecycle spec in this
    // project uses (dashboardPage.changeBranch() -> resolveIfPresent() ->
    // expectLoaded()), timed as one operation.
    // ============================================================
    await perf.measure('Login (branch resolve + dashboard load)', 'Login', THRESHOLD_LOGIN_MS, async () => {
      await dashboardPage.changeBranch();
      await branchSelectPage.resolveIfPresent();
      await dashboardPage.expectLoaded();
    });

    // ============================================================
    // 2. USE EXISTING LARGE DATASET — see class doc comment finding 1. One
    // fresh, uniquely-named Supplier/Customer/Product each — real UI
    // creation, not fabricated bulk data — gives this spec a deterministic
    // search target inside the real, already-large Customer/Product tables.
    // ============================================================
    const { supplierGroupName } = await supplierPrerequisites();
    const supplierName = uniqueCode('SUPPLIER');
    await supplierPage.createSupplier({
      name: supplierName,
      supplierGroupName,
      address: `Automation Address ${uniqueCode('ADDR')}`,
    });
    const supplierIdMatch = /\/Edit\/(\d+)/i.exec(page.url());
    expect(supplierIdMatch).not.toBeNull();
    const supplierId = supplierIdMatch![1];

    const { customerGroupName } = await customerPrerequisites();
    const customerName = uniqueCode('CUSTOMER');
    await customerPage.createCustomer({
      name: customerName,
      customerGroupName,
      telephoneNo: randomData.phone11Digit(),
      email: randomData.email('customer'),
      address: `Automation Address ${uniqueCode('ADDR')}`,
    });
    const customerIdMatch = /\/Edit\/(\d+)/i.exec(page.url());
    expect(customerIdMatch).not.toBeNull();
    const customerId = customerIdMatch![1];

    const { productGroupName, uomName } = await productPrerequisites();
    const productName = uniqueCode('PRODUCT');
    await productPage.createProduct({ name: productName, productGroupName, uomName, purchasePrice: 100, salePrice: 150 });

    const { accountName: bankAccountName } = await bankAccountSetupPage.setupBankAccount();

    // ============================================================
    // 3-6. PURCHASE ENTRY — page load, Supplier Search, Product Search,
    // Save, Post. Each phase timed independently rather than as one
    // aggregate, per the task's own "Test Scenario" breakdown.
    // ============================================================
    await perf.measure('Purchase Create page load', 'Grid Load', THRESHOLD_GRID_MS, () => purchasePage.gotoCreate());

    await perf.measure('Supplier Search Performance (Purchase)', 'Dropdown Load', THRESHOLD_DROPDOWN_MS, () =>
      purchasePage.selectSupplier(supplierName)
    );

    await purchasePage.fillBeNumber(String(Date.now()));
    await purchasePage.fillDates();

    const purchaseRow = await purchasePage.lineItems.addRow();
    await perf.measure('Product Search Performance (Purchase line item)', 'Grid Load', THRESHOLD_GRID_MS, () =>
      purchasePage.lineItems.selectProductForRow(purchaseRow, productName)
    );
    await purchasePage.lineItems.setQuantity(purchaseRow, 10);

    const purchaseCode = await perf.measure('Purchase Save Time', 'Transaction Save', THRESHOLD_SAVE_MS, async () => {
      await purchasePage.clickSave();
      await page.waitForURL(/\/DMS\/Purchase\/Edit/i);
      return purchasePage.getCode();
    });
    expect(purchaseCode).not.toHaveLength(0);

    await perf.measure('Purchase Post Time', 'Transaction Post', THRESHOLD_POST_MS, () => purchasePage.post());

    // ============================================================
    // 7-10. SALE ENTRY — page load, Customer Search, Product Search, Save,
    // Post. Mirrors the Purchase phases above.
    // ============================================================
    await perf.measure('Sale Create page load', 'Grid Load', THRESHOLD_GRID_MS, () => salePage.gotoCreate());

    await perf.measure('Customer Search Performance (Sale)', 'Dropdown Load', THRESHOLD_DROPDOWN_MS, () =>
      salePage.selectCustomer(customerName)
    );
    await salePage.fillInvoiceDate();

    const saleRow = await salePage.lineItems.addRow();
    await perf.measure('Product Search Performance (Sale line item)', 'Grid Load', THRESHOLD_GRID_MS, () =>
      salePage.lineItems.selectProductForRow(saleRow, productName)
    );
    await salePage.lineItems.setQuantity(saleRow, 5);

    const finalPayable = await salePage.getFinalPayable();
    const atSalePayment = Math.floor(finalPayable / 2) || 1;
    await perf.measure('Payment entry (Sale)', 'Grid Load', null, () => salePage.addPayment(bankAccountName, atSalePayment));

    const saleCode = await perf.measure('Sale Save Time', 'Transaction Save', THRESHOLD_SAVE_MS, async () => {
      await salePage.clickSave();
      return salePage.waitForSaveSuccess();
    });
    expect(saleCode).not.toHaveLength(0);

    await perf.measure('Sale Post Time', 'Transaction Post', THRESHOLD_POST_MS, () => salePage.post());

    // ============================================================
    // 11. REPORT LOADING PERFORMANCE — Stock Report, Supplier Ledger,
    // Customer Sale Report, Purchase Report. Each report is independently
    // try/caught (unlike the transactional steps above): one report being
    // broken/slow beyond recovery must not prevent measuring the other
    // three — the task's own "Report APIs" investigation area treats these
    // as 4 separate, independent surfaces, not one combined step.
    // ============================================================
    const reportChecks: Array<() => Promise<void>> = [
      async () => {
        await perf.measure('Stock Report — open + filter + load', 'Report Load', THRESHOLD_REPORT_MS, async () => {
          await stockReportPage.goto();
          await stockReportPage.selectProduct(productName);
          await stockReportPage.enableSummaryMode();
          const tab = await stockReportPage.printAndCapture();
          await stockReportPage.getProductRow(tab, productName);
        });
      },
      async () => {
        await perf.measure('Supplier Ledger — open + filter + load', 'Report Load', THRESHOLD_REPORT_MS, async () => {
          await supplierLedgerPage.goto();
          await supplierLedgerPage.selectSupplierDirectly(supplierId, supplierName);
          await supplierLedgerPage.enableSummaryMode();
          const tab = await supplierLedgerPage.printAndCapture();
          await supplierLedgerPage.getSupplierRow(tab, supplierName);
        });
      },
      async () => {
        await perf.measure('Customer Sale Report — open + filter + load', 'Report Load', THRESHOLD_REPORT_MS, async () => {
          await customerSaleCollectionReportPage.goto();
          await customerSaleCollectionReportPage.selectCustomerDirectly(customerId, customerName);
          await customerSaleCollectionReportPage.enableSummaryMode();
          const tab = await customerSaleCollectionReportPage.printAndCapture();
          await customerSaleCollectionReportPage.getCustomerRow(tab, customerName);
        });
      },
      async () => {
        await perf.measure('Purchase Report — open + filter + load', 'Report Load', THRESHOLD_REPORT_MS, async () => {
          await purchaseReportPage.goto();
          await purchaseReportPage.selectProduct(productName);
          await purchaseReportPage.enableDetailsMode();
          const tab = await purchaseReportPage.printAndCapture();
          await purchaseReportPage.getRowsByPurchaseCode(tab, purchaseCode);
        });
      },
    ];
    const reportErrors: string[] = [];
    for (const check of reportChecks) {
      try {
        await check();
      } catch (error) {
        reportErrors.push(error instanceof Error ? error.message : String(error));
      }
    }

    // ============================================================
    // 12. LOGOUT.
    // ============================================================
    await perf.measure('Logout', 'Logout', null, () => dashboardPage.logout());
    await expect(page).toHaveURL(new RegExp(routes.login.replace('/', '\\/')));

    // ============================================================
    // EVIDENCE — attaches the full Operation/Start/End/Duration/Result
    // table (this task's own required format) to the Playwright/Allure
    // report, and logs it, so the baseline is visible without re-running.
    // ============================================================
    const evidenceText = perf.toReportText();
    logger.info(`\n${evidenceText}`);
    await testInfo.attach('performance-evidence.txt', { body: evidenceText, contentType: 'text/plain' });
    if (reportErrors.length > 0) {
      await testInfo.attach('performance-report-errors.txt', { body: reportErrors.join('\n\n'), contentType: 'text/plain' });
    }

    // Threshold checks — DATA, not a hard gate (see class doc comment):
    // expect.soft() records every breach without aborting subsequent
    // assertions or hiding any other measurement's own evidence.
    for (const record of perf.getRecords()) {
      if (record.thresholdMs === null) continue;
      expect.soft(record.durationMs, `${record.operation} should complete within ${record.thresholdMs}ms`).toBeLessThanOrEqual(
        record.thresholdMs
      );
    }
    // A report failing outright (not merely slow) is surfaced as a hard,
    // named assertion — distinct from a threshold breach, and distinct from
    // the transactional steps above (which fail the test directly, by
    // design, if they throw).
    expect(reportErrors, `${reportErrors.length} of 4 reports failed to load: ${reportErrors.join(' | ')}`).toHaveLength(0);
  });
});
