import { Locator, Page } from '@playwright/test';
import { BasePage } from '../common/BasePage';
import { BootstrapSwitch } from '../../components/BootstrapSwitch';
import { routes, customerSaleCollectionReportSelectors } from '../../utils/constants';

/**
 * "Customer Sale & Collection Report" — Areas/DMS/Controllers/SaleController.cs's
 * CustomerSaleCollectionReportIndex()/CustomerSaleCollectionReportList()
 * actions (route: /DMS/Sale/CustomerSaleCollectionReportIndex) — the
 * Customer-side analog of SupplierLedgerPage.ts, confirmed structurally
 * identical: `#CustomerId`/`#CustomerName` fields read directly by
 * PrintCustomerSaleCollectionReport() when building the report's new-tab
 * URL, an `#IsSummary` bootstrap-switch, and a plain server-rendered
 * `.report-box table` with no `data-field` attributes. Backed by
 * ReportsRepository.GetCustomerSaleCollectionReportList (STEP C-REPORT-FIX:
 * `Collections.IsActive` filter removed, `SaleCreditCards` rows with
 * `Remarks='Collection Payment'` excluded to avoid double-counting a
 * Collection alongside its own SaleCreditCards mirror row).
 *
 * CONFIRMED Summary-mode columns (one row per Customer, from
 * Reports/CustomerSaleCollectionSummary.cshtml): Customer Name (Code), Total
 * Sale Amount, Total Collection Amount, Outstanding Amount.
 *
 * selectCustomerDirectly() bypasses the `#btnCustomerSearch` popup
 * (backed by `/Common/Common/GetCustomerModal`) the same way
 * SupplierLedgerPage.selectSupplierDirectly() bypasses its Supplier
 * equivalent — that popup is confirmed elsewhere in this project to return
 * an unrelated, small, inactive dataset that cannot resolve a just-created
 * record; PrintCustomerSaleCollectionReport() only ever reads
 * `#CustomerId`/`#CustomerName`'s current values when building the report
 * URL, so setting them directly exercises the exact same real, working
 * report mechanism without depending on the popup.
 */
export class CustomerSaleCollectionReportPage extends BasePage {
  private readonly isSummarySwitch: BootstrapSwitch;

  constructor(page: Page) {
    super(page);
    this.isSummarySwitch = new BootstrapSwitch(page, customerSaleCollectionReportSelectors.isSummaryToggle);
  }

  async goto(): Promise<void> {
    await this.page.goto(routes.dms('Sale', 'CustomerSaleCollectionReportIndex'));
  }

  async selectCustomerDirectly(customerId: string, customerName: string): Promise<void> {
    // Passed as (element, value) with the element typed `any` — this
    // project's tsconfig has no DOM lib available for a proper
    // HTMLInputElement cast, same reasoning already applied in
    // SupplierLedgerPage.selectSupplierDirectly().
    await this.page
      .locator(customerSaleCollectionReportSelectors.customerIdInput)
      .evaluate((el: any, value: string) => {
        el.value = value;
      }, customerId);
    await this.page.locator(customerSaleCollectionReportSelectors.customerNameInput).fill(customerName);
  }

  /** Toggles the Summary report mode on — one row per customer, not the per-transaction Details view. */
  async enableSummaryMode(): Promise<void> {
    await this.isSummarySwitch.setOn(true);
  }

  /** Clicks Print and captures the new tab it opens, mirroring SupplierLedgerPage.printAndCapture(). */
  async printAndCapture(): Promise<Page> {
    const [reportTab] = await Promise.all([
      this.page.context().waitForEvent('page'),
      this.page.getByRole('button', { name: customerSaleCollectionReportSelectors.printButtonName }).click(),
    ]);
    await reportTab.waitForLoadState();
    return reportTab;
  }

  /** Locates the Customer Sale & Collection Summary report's row for the given (unique) customer name, in the captured report tab. */
  async getCustomerRow(reportTab: Page, customerName: string): Promise<Locator> {
    const row = reportTab
      .locator(customerSaleCollectionReportSelectors.reportTable)
      .last()
      .locator('tbody tr', { hasText: customerName })
      .first();
    await row.waitFor({ state: 'visible', timeout: 10000 });
    return row;
  }

  /**
   * Reads Total Sale Amount / Total Collection Amount / Outstanding Amount
   * off the row by column position — confirmed from source
   * (Reports/CustomerSaleCollectionSummary.cshtml): Customer Name, Total
   * Sale Amount, Total Collection Amount, Outstanding Amount, in that exact
   * order, plain `<td>` cells with no `data-field` attribute (same shape as
   * SupplierLedgerPage.getLedgerValues()).
   */
  async getReportValues(
    row: Locator
  ): Promise<{ totalSaleAmount: number; totalCollectionAmount: number; outstandingAmount: number }> {
    const cells = row.locator('td');
    const parse = async (index: number): Promise<number> => {
      const text = (await cells.nth(index).textContent().catch(() => '')) ?? '0';
      const parsed = parseFloat(text.replace(/[^0-9.-]/g, ''));
      return Number.isFinite(parsed) ? parsed : 0;
    };
    return {
      totalSaleAmount: await parse(1),
      totalCollectionAmount: await parse(2),
      outstandingAmount: await parse(3),
    };
  }
}
