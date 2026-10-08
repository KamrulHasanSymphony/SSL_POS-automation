import { Locator, Page } from '@playwright/test';
import { BasePage } from '../common/BasePage';
import { BootstrapSwitch } from '../../components/BootstrapSwitch';
import { routes, stockReportSelectors } from '../../utils/constants';

/**
 * Areas/DMS/Controllers/ProductController.cs's StockIndex()/ReportList()
 * actions + Areas/DMS/Views/Product/StockIndex.cshtml + Areas/DMS/Views/
 * Product/Reports/StockSummaryReport.cshtml — confirmed directly from source
 * for the Purchase-lifecycle E2E flow (Login -> Supplier -> Product ->
 * Purchase Order -> Purchase -> Stock -> Supplier Ledger). Not part of the
 * approved coverage baseline (config/coverage-baseline.ts).
 *
 * NO DEDICATED "Stock" CONTROLLER EXISTS — this page lives on
 * ProductController, confirmed by exhaustive search of the application
 * source. Structurally identical in shape to ReportPage.ts (Customer
 * Collection Due): a one-off Kendo popup picker with its own container ids
 * (not the shared KendoGrid/gridContainerSelectors convention), a
 * bootstrap-switch Summary toggle, a Print button with no id/unique class
 * that opens the report in a brand-new browser tab
 * (`window.open(url, "_blank")`), and a plain server-rendered `<table>` with
 * no `data-field` attributes — read by column position, not by KendoGrid.
 * See utils/constants.ts's `stockReportSelectors` doc comment for the full
 * source citation.
 *
 * LIVE DOM VERIFICATION GAP (flagged, not silently assumed, per this
 * project's Live DOM Verification Rule): the popup's open/search timing and
 * the new-tab `window.open()` behavior under Playwright automation were
 * confirmed from source only, not yet against a live render — verify on
 * first real use and correct here, not per-test, exactly as ReportPage.ts's
 * own header comment already documents for its structurally identical
 * pattern.
 */
export class StockReportPage extends BasePage {
  private readonly isSummarySwitch: BootstrapSwitch;

  constructor(page: Page) {
    super(page);
    this.isSummarySwitch = new BootstrapSwitch(page, stockReportSelectors.isSummaryToggle);
  }

  async goto(): Promise<void> {
    await this.page.goto(routes.dms('Product', 'StockIndex'));
  }

  /**
   * Opens the Product picker popup, double-clicks the row matching the
   * given (unique) product name — same "click -> popup window -> dblclick
   * row" shape already confirmed elsewhere in this project
   * (KendoLineItemGrid/KendoInvoicePickerGrid/ReportPage.selectCustomer()),
   * implemented directly here since this popup uses its own, differently-id'd
   * grid rather than the shared line-item component.
   */
  async selectProduct(productName: string): Promise<void> {
    await this.page.locator(stockReportSelectors.productSearchButton).click();
    const popup = this.page.locator(stockReportSelectors.productWindow);
    await popup.waitFor({ state: 'visible', timeout: 10000 });

    const grid = this.page.locator(stockReportSelectors.productGrid);
    const row = grid.locator('.k-grid-content table tbody tr, table tbody tr', { hasText: productName }).first();
    await row.waitFor({ state: 'visible', timeout: 10000 });
    await row.dblclick();
    await popup.waitFor({ state: 'hidden', timeout: 10000 }).catch(() => undefined);
    await this.overlay.waitForIdle();
  }

  /**
   * MULTI-BRANCH-LIFECYCLE E2E addition: a real branch-isolation check needs
   * to confirm whether a Product created under a DIFFERENT branch's session
   * is even listed in this popup at all while positioned in another branch
   * — unlike `selectSupplierDirectly()`/`selectCustomerDirectly()` on the
   * other report pages, this popup has no direct-set bypass (no hidden
   * `#ProductId` input pattern confirmed here), so existence must be
   * checked through the real picker UI. Mirrors `selectProduct()`'s own
   * popup-open/row-match mechanism, but only checks presence and always
   * closes the popup afterwards (via Escape — no dedicated close button
   * selector is confirmed on this Kendo Window) rather than selecting,
   * since a non-existent product cannot be double-clicked into.
   */
  async isProductListed(productName: string): Promise<boolean> {
    await this.page.locator(stockReportSelectors.productSearchButton).click();
    const popup = this.page.locator(stockReportSelectors.productWindow);
    await popup.waitFor({ state: 'visible', timeout: 10000 });

    const grid = this.page.locator(stockReportSelectors.productGrid);
    const row = grid.locator('.k-grid-content table tbody tr, table tbody tr', { hasText: productName }).first();
    const found = await row.isVisible().catch(() => false);

    await this.page.keyboard.press('Escape');
    await popup.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => undefined);
    await this.overlay.waitForIdle();
    return found;
  }

  /** Toggles the Summary report mode on — the Purchase-lifecycle flow reads the one-row-per-product Summary view, not the per-transaction Details view. */
  async enableSummaryMode(): Promise<void> {
    await this.isSummarySwitch.setOn(true);
  }

  /**
   * INVENTORY-LIFECYCLE E2E FINDING: confirmed source (exhaustive search of
   * every Areas/**\/Controllers/*.cs, Areas/**\/Views/**, Areas/**\/js/
   * Controllers/*.js, and the DB-seeded navigation menu) — no dedicated
   * "Stock Ledger" module exists anywhere in this application. The real,
   * functional analog is THIS SAME Stock Report screen with the Summary
   * toggle switched OFF: `ProductController.ReportList()`'s `isSummary`
   * flag selects between `Reports/StockSummaryReport` (one row per
   * product) and `Reports/StockDetailsReport` (one row per transaction,
   * with a running SL/Type/Ref.No/Date/Opening/In/Out/Closing-Stock
   * ledger, grouped per product) — confirmed directly from
   * Reports/StockDetailsReport.cshtml. This IS a real, genuine per-product
   * stock ledger; it is simply not a separate module/route from the Stock
   * Report already modeled above.
   */
  async enableDetailsMode(): Promise<void> {
    await this.isSummarySwitch.setOn(false);
  }

  /**
   * Locates the Stock Details (Ledger) report's transaction rows for the
   * given (unique) product — confirmed from source
   * (Reports/StockDetailsReport.cshtml, the single active/uncompiled
   * `@model` block starting at line 179; the earlier commented-out block is
   * dead markup, not used): one `<table>` per product group rendered inside
   * `.report-box`, header order SL, Type, Ref. No, Date, Opening, In Qty,
   * Out Qty, Closing Stock — same order getLedgerRowValues() below reads by
   * position. `selectProduct()` (called before this, same as the Summary
   * flow) always scopes the report to exactly one product, so exactly one
   * group table renders and `.last()` reliably resolves to it — the same
   * single-table convention already proven for getProductRow() above and
   * SupplierLedgerPage.getSupplierRow(). Excludes the trailing `.total-row`
   * summary row — callers only ever want real transaction rows here.
   */
  async getLedgerRows(reportTab: Page): Promise<Locator> {
    const table = reportTab.locator(stockReportSelectors.reportTable).last();
    await table.waitFor({ state: 'visible', timeout: 10000 });
    return table.locator('tbody tr:not(.total-row)');
  }

  /**
   * Finds the one ledger row whose Ref. No (column index 2, confirmed from
   * source) matches the given transaction code (e.g. a Purchase Code) — the
   * "Ledger contains transaction" / "Correct transaction number generated"
   * verification point. Also useful for a "no duplicate stock movement"
   * check: a caller can independently assert this filtered set resolves to
   * exactly one row.
   */
  async getLedgerRowsByRefCode(reportTab: Page, refCode: string): Promise<Locator> {
    const rows = await this.getLedgerRows(reportTab);
    return rows.filter({ hasText: refCode });
  }

  /**
   * Reads Type / Ref. No / Opening (PreviousStock) / In Qty / Out Qty /
   * Closing Stock (StockInHand) off a ledger row by column position —
   * confirmed from source (Reports/StockDetailsReport.cshtml's active
   * block): SL, Type, Ref. No, Date, Opening, In Qty, Out Qty, Closing
   * Stock, in that exact order, plain `<td>` cells with no `data-field`
   * attribute (same shape as getStockValues()/SupplierLedgerPage's report
   * tables).
   */
  async getLedgerRowValues(
    row: Locator
  ): Promise<{ transactionType: string; refCode: string; opening: number; inQty: number; outQty: number; closingStock: number }> {
    const cells = row.locator('td');
    const parse = async (index: number): Promise<number> => {
      const text = (await cells.nth(index).textContent().catch(() => '')) ?? '0';
      const parsed = parseFloat(text.replace(/[^0-9.-]/g, ''));
      return Number.isFinite(parsed) ? parsed : 0;
    };
    return {
      transactionType: ((await cells.nth(1).textContent().catch(() => '')) ?? '').trim(),
      refCode: ((await cells.nth(2).textContent().catch(() => '')) ?? '').trim(),
      opening: await parse(4),
      inQty: await parse(5),
      outQty: await parse(6),
      closingStock: await parse(7),
    };
  }

  /**
   * Clicks Print — targeted by accessible name (confirmed no `id`/unique
   * class exists on this button, see class doc comment) — while capturing
   * the new tab it opens via `window.open()`, returning that tab's own Page
   * so callers can read the report rendered inside it. Mirrors
   * ReportPage.printAndCapture() exactly.
   */
  async printAndCapture(): Promise<Page> {
    const [reportTab] = await Promise.all([
      this.page.context().waitForEvent('page'),
      this.page.getByRole('button', { name: stockReportSelectors.printButtonName }).click(),
    ]);
    await reportTab.waitForLoadState();
    return reportTab;
  }

  /** Locates the Stock Summary report table's row for the given (unique) product name, in the captured report tab. */
  async getProductRow(reportTab: Page, productName: string): Promise<Locator> {
    const row = reportTab.locator(stockReportSelectors.reportTable).last().locator('tbody tr', { hasText: productName }).first();
    await row.waitFor({ state: 'visible', timeout: 10000 });
    return row;
  }

  /**
   * Reads Opening Stock / In Qty / Out Qty / Closing Stock (current stock,
   * bound to `StockVM.StockInHand`) off the row by column position —
   * confirmed from source (Reports/StockSummaryReport.cshtml): SL, Code,
   * Product Name, Opening Stock, In Qty, Out Qty, Closing Stock, in that
   * exact order, plain `<td>` cells with no `data-field` attribute.
   */
  async getStockValues(
    row: Locator
  ): Promise<{ openingStock: number; inQty: number; outQty: number; currentStock: number }> {
    const cells = row.locator('td');
    const parse = async (index: number): Promise<number> => {
      const text = (await cells.nth(index).textContent().catch(() => '')) ?? '0';
      const parsed = parseFloat(text.replace(/[^0-9.-]/g, ''));
      return Number.isFinite(parsed) ? parsed : 0;
    };
    return {
      openingStock: await parse(3),
      inQty: await parse(4),
      outQty: await parse(5),
      currentStock: await parse(6),
    };
  }
}
