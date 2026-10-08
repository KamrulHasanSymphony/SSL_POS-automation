import { Locator, Page } from '@playwright/test';
import { BasePage } from '../common/BasePage';
import { routes, customerCollectionDueSelectors } from '../../utils/constants';

/**
 * Areas/DMS/Controllers/SaleController.cs's CustomerCollectionDueIndex()/
 * CustomerCollectionDueList() actions + Areas/DMS/Views/Sale/
 * CustomerCollectionDueIndex.cshtml + Areas/DMS/Views/Sale/Reports/
 * CustomerCollectionDueReport.cshtml — confirmed directly from source for
 * the cross-module E2E sales-lifecycle flow (Login -> Customer -> Product ->
 * SaleOrder -> Sale -> Collection -> Due -> Report -> Logout). NOT part of
 * the approved 267-test coverage baseline (config/coverage-baseline.ts).
 *
 * Structurally unlike every other module's page object in this project —
 * flagged explicitly rather than silently reused:
 *  - The entry screen's Customer picker is a ONE-OFF Kendo popup grid
 *    (#customerWindow/#customerGrid, its own container ids) — NOT the shared
 *    KendoGrid/gridContainerSelectors.default convention every other module
 *    uses, so KendoGrid is deliberately not instantiated here.
 *  - The report itself is a plain, server-rendered HTML `<table>` with no
 *    `data-field` attributes at all (confirmed from
 *    Reports/CustomerCollectionDueReport.cshtml) — read by column position,
 *    not by KendoGrid.
 *  - CONFIRMED: clicking Print (`PrintCustomerCollectionDue()` in
 *    CustomerCollectionDueIndex.cshtml) calls `window.open(url, "_blank")`,
 *    opening the report in a brand-new browser tab — printAndCapture() below
 *    captures that via Playwright's own popup-page pattern, which no other
 *    page object in this project has needed until now.
 *
 * LIVE DOM VERIFICATION GAP (flagged, not silently assumed — see the E2E
 * design record's Blocker 1 report): the popup Kendo grid's open/search
 * timing and the exact behavior of `window.open()` under Playwright
 * automation were confirmed from source only, not yet against a live
 * render — verify on first real use and correct here, not per-test, per
 * this project's Live DOM Verification Rule.
 */
export class ReportPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async goto(): Promise<void> {
    await this.page.goto(routes.dms('Sale', 'CustomerCollectionDueIndex'));
  }

  /**
   * Opens the Customer picker popup, searches by the given (unique) Customer
   * name, and double-clicks the matching row to apply the selection back —
   * the same "click -> popup window -> search -> dblclick row" shape already
   * confirmed elsewhere in this project (KendoInvoicePickerGrid/
   * KendoLineItemGrid), but this screen's popup uses its own, differently-id'd
   * grid (#customerGrid, not the shared #windowGrid/#saleDetailsGrid), so it
   * is implemented directly here rather than by reusing either of those
   * classes. Row locator mirrors the same `.k-grid-content table tbody tr,
   * table tbody tr` fallback those components already use for a real Kendo
   * grid's rendered rows — not a new guess, the same structural assumption
   * already relied on identically in three other places in this codebase.
   */
  async selectCustomer(customerName: string): Promise<void> {
    await this.page.locator(customerCollectionDueSelectors.customerSearchButton).click();
    const popup = this.page.locator(customerCollectionDueSelectors.customerWindow);
    await popup.waitFor({ state: 'visible', timeout: 10000 });

    const grid = this.page.locator(customerCollectionDueSelectors.customerGrid);
    const row = grid.locator('.k-grid-content table tbody tr, table tbody tr', { hasText: customerName }).first();
    await row.waitFor({ state: 'visible', timeout: 10000 });
    await row.dblclick();
    await popup.waitFor({ state: 'hidden', timeout: 10000 }).catch(() => undefined);
    await this.overlay.waitForIdle();
  }

  /**
   * CUSTOMER-COLLECTION-DUE-REPORT-PICKER-INVESTIGATION E2E FINDING:
   * confirmed live (raw `GetCustomerModal` response capture) that
   * `#btnCustomerSearch`'s popup (`selectCustomer()` above) is backed by a
   * small, unrelated, effectively-static dataset — exactly 3 records,
   * never including a just-created customer regardless of how many
   * customers actually exist — the identical confirmed-broken-popup defect
   * already documented and bypassed for `SupplierLedgerPage.
   * selectSupplierDirectly()` and `CustomerSaleCollectionReportPage.
   * selectCustomerDirectly()`. Confirmed from source
   * (Views/Sale/CustomerCollectionDueIndex.cshtml's `PrintCustomerCollectionDue()`)
   * that the report itself only ever reads `#CustomerId`/`#CustomerName`'s
   * current values when building the report URL — exactly the same
   * mechanism those two proven methods already rely on — so setting them
   * directly exercises the real, working report path without depending on
   * the popup at all. Mirrors their exact (customerId, customerName)
   * signature and implementation for consistency.
   */
  async selectCustomerDirectly(customerId: string, customerName: string): Promise<void> {
    await this.page
      .locator(customerCollectionDueSelectors.customerIdInput)
      .evaluate((el: any, value: string) => {
        el.value = value;
      }, customerId);
    await this.page.locator(customerCollectionDueSelectors.customerNameInput).fill(customerName);
  }

  /**
   * Clicks Print — the button carries no `id`/unique class (confirmed from
   * source; see class doc comment), so it is targeted by its accessible
   * name instead — while capturing the new tab it opens via
   * `window.open()`, returning that tab's own Page so callers can read the
   * report rendered inside it.
   */
  async printAndCapture(): Promise<Page> {
    const [reportPage] = await Promise.all([
      this.page.context().waitForEvent('page'),
      this.page.getByRole('button', { name: customerCollectionDueSelectors.printButtonName }).click(),
    ]);
    await reportPage.waitForLoadState();
    return reportPage;
  }

  /** Locates the report table's row for the given (unique) Customer name, in the captured report tab. */
  async getCustomerRow(reportPage: Page, customerName: string): Promise<Locator> {
    const row = reportPage
      .locator(customerCollectionDueSelectors.reportTable)
      .locator('tbody tr', { hasText: customerName })
      .first();
    await row.waitFor({ state: 'visible', timeout: 10000 });
    return row;
  }

  /**
   * Reads Total Sale / Total Collection / Due Amount off the row by column
   * position — confirmed from source (Reports/CustomerCollectionDueReport.cshtml):
   * SL, Customer Code, Customer Name, Total Sale, Total Collection, Due
   * Amount, in that exact order, plain `<td>` cells with no `data-field`
   * attribute to key off instead.
   */
  async getRowValues(row: Locator): Promise<{ totalSaleAmount: number; totalCollectionAmount: number; dueAmount: number }> {
    const cells = row.locator('td');
    const parse = async (index: number): Promise<number> => {
      const text = (await cells.nth(index).textContent().catch(() => '')) ?? '0';
      const parsed = parseFloat(text.replace(/[^0-9.-]/g, ''));
      return Number.isFinite(parsed) ? parsed : 0;
    };
    return {
      totalSaleAmount: await parse(3),
      totalCollectionAmount: await parse(4),
      dueAmount: await parse(5),
    };
  }
}
