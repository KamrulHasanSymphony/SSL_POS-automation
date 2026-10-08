import { Locator, Page } from '@playwright/test';
import { BasePage } from '../common/BasePage';
import { BootstrapSwitch } from '../../components/BootstrapSwitch';
import { routes, purchaseReportSelectors } from '../../utils/constants';

/**
 * "Purchase Report" — see `purchaseReportSelectors`'s own doc comment
 * (utils/constants.ts) for the full source citation. Added for the
 * VAT-lifecycle E2E flow: the one report in this application confirmed to
 * surface real VAT/SD columns. Structurally near-identical to
 * `StockReportPage.ts` (same product-popup mechanism, same
 * `.report-box table` convention) — implemented as its own page object
 * rather than folded into `StockReportPage.ts` since it lives on a
 * different controller/route (`PurchaseController.PurchaseIndex`, not
 * `ProductController.StockIndex`) despite the coincidentally-identical
 * popup DOM ids.
 */
export class PurchaseReportPage extends BasePage {
  private readonly isSummarySwitch: BootstrapSwitch;

  constructor(page: Page) {
    super(page);
    this.isSummarySwitch = new BootstrapSwitch(page, purchaseReportSelectors.isSummaryToggle);
  }

  async goto(): Promise<void> {
    await this.page.goto(routes.dms('Purchase', 'PurchaseIndex'));
  }

  /**
   * Opens the Product picker popup, double-clicks the row matching the
   * given (unique) product name.
   *
   * VAT-LIFECYCLE-PHASE-2 E2E FINDING: confirmed live that a naive
   * single-page row match (the approach `StockReportPage.selectProduct()`
   * uses, initially copied here too) times out — this shared environment's
   * Product catalog has grown large enough (same confirmed
   * "SALE-PRODUCT-PICKER-INVESTIGATION" finding already documented on
   * `KendoLineItemGrid.ts`) that a freshly-created product is not
   * guaranteed to land on the popup's first page. Unlike the line-item
   * grid's own popup, THIS popup (confirmed from source,
   * `Views/Purchase/PurchaseIndex.cshtml`) exposes dedicated, always-visible
   * filter inputs — `#FilterProductName`/`#FilterProductCode` — wired to a
   * live `input`-event Kendo grid filter (`applyProductGroupFilter()`), not
   * a pagination scan or a column-header filter icon. Typing the product
   * name directly into `#FilterProductName` is therefore both simpler and
   * more reliable than replicating `KendoLineItemGrid`'s own page-by-page
   * fallback here.
   */
  async selectProduct(productName: string): Promise<void> {
    await this.page.locator(purchaseReportSelectors.productSearchButton).click();
    const popup = this.page.locator(purchaseReportSelectors.productWindow);
    await popup.waitFor({ state: 'visible', timeout: 10000 });

    await this.page.locator('#FilterProductName').fill(productName);
    const grid = this.page.locator(purchaseReportSelectors.productGrid);
    const row = grid.locator('.k-grid-content table tbody tr, table tbody tr', { hasText: productName }).first();
    await row.waitFor({ state: 'visible', timeout: 10000 });
    await row.dblclick();
    await popup.waitFor({ state: 'hidden', timeout: 10000 }).catch(() => undefined);
    await this.overlay.waitForIdle();
  }

  /**
   * Details mode (Summary OFF, this report's own default) — the mode this
   * flow needs to read a per-transaction row rather than an aggregated one.
   */
  async enableDetailsMode(): Promise<void> {
    await this.isSummarySwitch.setOn(false);
  }

  /** Clicks Print and captures the new tab it opens, mirroring StockReportPage.printAndCapture(). */
  async printAndCapture(): Promise<Page> {
    const [reportTab] = await Promise.all([
      this.page.context().waitForEvent('page'),
      this.page.getByRole('button', { name: purchaseReportSelectors.printButtonName }).click(),
    ]);
    await reportTab.waitForLoadState();
    return reportTab;
  }

  /** Locates the Purchase Report's Details-mode row(s) matching the given (unique) Purchase Code, in the captured report tab. */
  async getRowsByPurchaseCode(reportTab: Page, purchaseCode: string): Promise<Locator> {
    const table = reportTab.locator(purchaseReportSelectors.reportTable).last();
    await table.waitFor({ state: 'visible', timeout: 10000 });
    return table.locator('tbody tr', { hasText: purchaseCode });
  }

  /**
   * Reads Quantity / Sub Total / VAT / Total off a Details-mode row by
   * column position.
   *
   * VAT-LIFECYCLE-PHASE-2 E2E FINDING: this report's actual rendered
   * template ("Product Wise Details Report", confirmed live via a captured
   * screenshot when a Product filter is applied) differs from
   * `PurchaseListReport.cshtml`'s own column layout documented on
   * `purchaseReportSelectors` — the live report has only 8 columns:
   * Product, Purchase Order Code (actually the Purchase's own Code, despite
   * the label), Invoice Date, Purchase Date, Quantity, Sub Total, VAT,
   * Total — with NO separate Unit Price/SD/VAT Rate columns at all (VAT
   * Amount is shown directly as "VAT"). Confirmed live values (Quantity
   * 100, Sub Total 10,000.00, VAT 1,575.00, Total 12,075.00) matched this
   * flow's own calculated figures exactly, confirming both the column
   * mapping below and the underlying VAT/SD formula. Only VAT Amount,
   * Sub Total, Quantity, and Line Total are readable from this report —
   * SD is not represented as a report column at all here (a real
   * application gap, not an automation gap — see this spec's own class
   * doc comment).
   */
  async getRowValues(row: Locator): Promise<{
    quantity: number;
    subTotal: number;
    vatAmount: number;
    lineTotal: number;
  }> {
    const cells = row.locator('td');
    const parse = async (index: number): Promise<number> => {
      const text = (await cells.nth(index).textContent().catch(() => '')) ?? '0';
      const parsed = parseFloat(text.replace(/[^0-9.-]/g, ''));
      return Number.isFinite(parsed) ? parsed : 0;
    };
    return {
      quantity: await parse(4),
      subTotal: await parse(5),
      vatAmount: await parse(6),
      lineTotal: await parse(7),
    };
  }
}
