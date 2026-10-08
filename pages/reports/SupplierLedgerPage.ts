import { Locator, Page } from '@playwright/test';
import { BasePage } from '../common/BasePage';
import { BootstrapSwitch } from '../../components/BootstrapSwitch';
import { KendoGrid } from '../../components/common-grid/KendoGrid';
import { routes, supplierLedgerSelectors } from '../../utils/constants';

/**
 * "Supplier Ledger" substitute for the Purchase-lifecycle E2E flow.
 *
 * CONFIRMED (exhaustive search of the ShampanPOSUI source — every
 * `Areas/DMS/Controllers/*.cs`, every `.cshtml`, every `Areas/DMS/js/
 * Controllers/*.js` — for "ledger"/"Ledger"): no dedicated Supplier Ledger
 * module exists anywhere in this application. `SupplierController.cs`'s
 * complete action list (Index, Create, CreateEdit, Edit, NextPrevious,
 * Delete, GetGridData, getReport, SupplierIndex, supplierReport) has no
 * ledger-shaped action. This class does NOT invent one.
 *
 * The nearest real, functional analog — confirmed directly from source —
 * is Areas/DMS/Controllers/PurchaseController.cs's
 * SupplierPurchasePaymentReportIndex()/SupplierPurchasePaymentReportList()
 * actions (route: /DMS/Purchase/SupplierPurchasePaymentReportIndex) +
 * Areas/DMS/Views/Purchase/SupplierPurchasePaymentReportIndex.cshtml +
 * Areas/DMS/Views/Purchase/Reports/SupplierPurchasePaymentSummary.cshtml: a
 * per-Supplier Purchase-vs-Payment report. Structurally identical shape to
 * StockReportPage.ts / ReportPage.ts: a one-off Kendo popup picker
 * (`#supplierWindow`/`#supplierGrid`, reading `/Common/Common/GetSupplierModal`,
 * dblclick-to-select — its own container ids, not the shared
 * KendoGrid/gridContainerSelectors convention), a bootstrap-switch Summary
 * toggle, a Print button with no id/unique class that opens the report in a
 * brand-new browser tab (`window.open(url, "_blank")`), and a plain
 * server-rendered `<table>` with no `data-field` attributes.
 *
 * CONFIRMED Summary-mode columns (one row per Supplier, from
 * Reports/SupplierPurchasePaymentSummary.cshtml): Supplier Name (Code),
 * Total Purchase Amount, Total Payment Amount, Outstanding Amount.
 * `TotalPurchaseAmount` is this flow's "Correct Amount" verification field;
 * `OutstandingAmount` (= Purchase − Payment) is its "Correct Balance" field.
 * See utils/constants.ts's `supplierLedgerSelectors` doc comment for the
 * full source citation.
 *
 * LIVE DOM VERIFICATION GAP (flagged, not silently assumed, per this
 * project's Live DOM Verification Rule): the popup's open/search timing and
 * the new-tab `window.open()` behavior under Playwright automation were
 * confirmed from source only, not yet against a live render — verify on
 * first real use and correct here, not per-test.
 */
export class SupplierLedgerPage extends BasePage {
  private readonly isSummarySwitch: BootstrapSwitch;
  private readonly supplierPickerGrid: KendoGrid;

  constructor(page: Page) {
    super(page);
    this.isSummarySwitch = new BootstrapSwitch(page, supplierLedgerSelectors.isSummaryToggle);
    this.supplierPickerGrid = new KendoGrid(page, supplierLedgerSelectors.supplierGrid);
  }

  async goto(): Promise<void> {
    await this.page.goto(routes.dms('Purchase', 'SupplierPurchasePaymentReportIndex'));
  }

  /**
   * Opens the Supplier picker popup and double-clicks the row matching the
   * given (unique) supplier name — same shape as StockReportPage.selectProduct().
   *
   * PURCHASE-LIFECYCLE E2E LIVE RUNTIME FINDING: this popup grid (also
   * `pageable: true`, no toolbar search — confirmed from source) has the
   * same paging gap already proven twice elsewhere in this flow (the
   * product-selection popup, STEP 21/22; the "From Purchase Order" picker) —
   * a target row can be on any page, not just the first, so this uses
   * `KendoGrid.findRowAcrossPages()` rather than a single-page lookup.
   */
  async selectSupplier(supplierName: string): Promise<void> {
    await this.page.locator(supplierLedgerSelectors.supplierSearchButton).click();
    const popup = this.page.locator(supplierLedgerSelectors.supplierWindow);
    await popup.waitFor({ state: 'visible', timeout: 10000 });
    await this.supplierPickerGrid.waitForLoad();

    const row = await this.supplierPickerGrid.findRowAcrossPages(supplierName);
    await row.dblclick();
    await popup.waitFor({ state: 'hidden', timeout: 10000 }).catch(() => undefined);
    await this.overlay.waitForIdle();
  }

  /**
   * PURCHASE-LIFECYCLE E2E LIVE RUNTIME FINDING: this picker's popup grid is
   * backed by `Common/Common/GetSupplierModal`, confirmed live to return an
   * unrelated, small, all-`IsActive:false` set of suppliers (3 records,
   * none matching a just-created active Supplier) — the same call made with
   * no query parameters at all (confirmed from source —
   * `SupplierPurchasePaymentReportIndex.cshtml`'s `OpenSupplierPopup()`
   * passes no `data` to the AJAX call), so no supplier created through this
   * flow can ever be selected via the popup, regardless of pagination. This
   * is an application-side data-scoping issue in that one endpoint, not
   * something fixable from the automation side.
   *
   * `PrintSupplierPurchasePaymentReport()` (confirmed from the same source
   * file) only ever reads `#SupplierId`/`#SupplierName`'s current values
   * when building the report URL — the picker is just the UI convenience
   * that normally populates them, not a requirement of the report endpoint
   * itself. This sets those two fields directly, exercising the exact same
   * real, working report mechanism without depending on the popup's broken
   * dataset.
   */
  async selectSupplierDirectly(supplierId: string, supplierName: string): Promise<void> {
    // Passed as (element, value) with the element typed `any` — this file's
    // tsconfig has no DOM lib available for a proper HTMLInputElement cast,
    // same reasoning already applied elsewhere in this project's fixtures.
    await this.page
      .locator(supplierLedgerSelectors.supplierIdInput)
      .evaluate((el: any, value: string) => {
        el.value = value;
      }, supplierId);
    await this.page.locator(supplierLedgerSelectors.supplierNameInput).fill(supplierName);
  }

  /** Toggles the Summary report mode on — the Purchase-lifecycle flow reads the one-row-per-supplier Summary view, not the per-transaction Details view. */
  async enableSummaryMode(): Promise<void> {
    await this.isSummarySwitch.setOn(true);
  }

  /** Clicks Print (accessible-name target, see class doc comment) and captures the new tab it opens, mirroring ReportPage.printAndCapture()/StockReportPage.printAndCapture(). */
  async printAndCapture(): Promise<Page> {
    const [reportTab] = await Promise.all([
      this.page.context().waitForEvent('page'),
      this.page.getByRole('button', { name: supplierLedgerSelectors.printButtonName }).click(),
    ]);
    await reportTab.waitForLoadState();
    return reportTab;
  }

  /** Locates the Supplier Purchase & Payment Summary report's row for the given (unique) supplier name, in the captured report tab. */
  async getSupplierRow(reportTab: Page, supplierName: string): Promise<Locator> {
    const row = reportTab
      .locator(supplierLedgerSelectors.reportTable)
      .last()
      .locator('tbody tr', { hasText: supplierName })
      .first();
    await row.waitFor({ state: 'visible', timeout: 10000 });
    return row;
  }

  /**
   * Reads Total Purchase Amount / Total Payment Amount / Outstanding Amount
   * off the row by column position — confirmed from source
   * (Reports/SupplierPurchasePaymentSummary.cshtml): Supplier Name, Total
   * Purchase Amount, Total Payment Amount, Outstanding Amount, in that exact
   * order, plain `<td>` cells with no `data-field` attribute.
   */
  async getLedgerValues(
    row: Locator
  ): Promise<{ totalPurchaseAmount: number; totalPaymentAmount: number; outstandingAmount: number }> {
    const cells = row.locator('td');
    const parse = async (index: number): Promise<number> => {
      const text = (await cells.nth(index).textContent().catch(() => '')) ?? '0';
      const parsed = parseFloat(text.replace(/[^0-9.-]/g, ''));
      return Number.isFinite(parsed) ? parsed : 0;
    };
    return {
      totalPurchaseAmount: await parse(1),
      totalPaymentAmount: await parse(2),
      outstandingAmount: await parse(3),
    };
  }
}
