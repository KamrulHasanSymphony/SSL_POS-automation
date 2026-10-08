import { Locator, Page, expect } from '@playwright/test';
import { LoadingOverlay } from '../LoadingOverlay';

/**
 * Wraps a Kendo UI Grid rendered into an empty container div (e.g.
 * <div id="GridDataList">), populated asynchronously via POST .../GetGridData
 * (confirmed STEP 1 §C/§G — this app uses Kendo Grid, NOT jQuery DataTables,
 * despite DataTables assets being loaded globally). There is no static
 * <table id> to target; row content only exists after the AJAX call resolves,
 * so every read/interaction here waits on the container instead of using
 * page.waitForTimeout().
 *
 * Kendo Grid's row/cell structure (.k-grid-content table tbody tr,
 * td[role="gridcell"]) follows Kendo's documented ARIA-influenced markup.
 * Not independently re-confirmed against this app's live DOM.
 *
 * LIVE DOM VERIFICATION RULE (see README.md): before using this component in
 * the first real automation test, verify these selectors against the live
 * rendered page and adjust here — not with a one-off workaround in the test.
 */
export class KendoGrid {
  private readonly overlay: LoadingOverlay;

  constructor(private readonly page: Page, private readonly containerSelector: string) {
    this.overlay = new LoadingOverlay(page);
  }

  private container(): Locator {
    return this.page.locator(this.containerSelector);
  }

  private rows(): Locator {
    return this.container().locator('.k-grid-content table tbody tr, table tbody tr');
  }

  /** Waits for the grid's data-loading AJAX call to complete and rows to be present. */
  async waitForLoad(timeoutMs = 20000): Promise<void> {
    await this.container().waitFor({ state: 'visible', timeout: timeoutMs });
    await this.overlay.waitForIdle(timeoutMs);
    // Either rows are present, or a confirmed "no records" indicator is shown —
    // both are valid end-states, so don't hard-fail waiting on rows alone.
    await Promise.race([
      this.rows().first().waitFor({ state: 'visible', timeout: timeoutMs }),
      this.container().getByText(/no records|no data/i).first().waitFor({ state: 'visible', timeout: timeoutMs }),
    ]).catch(() => {
      // Neither appeared within timeout — let callers' own assertions surface the failure
      // with full context, rather than swallowing it here.
    });
  }

  async rowCount(): Promise<number> {
    return this.rows().count();
  }

  async expectEmpty(): Promise<void> {
    expect(await this.rowCount()).toBe(0);
  }

  async findRowByText(text: string): Promise<Locator> {
    return this.rows().filter({ hasText: text }).first();
  }

  /**
   * PURCHASE-LIFECYCLE E2E LIVE RUNTIME FINDING: some Kendo grids in this
   * app (confirmed live: Purchase's "From Purchase Order" picker,
   * `#GridDataList`) have no toolbar search box at all — only per-column
   * filter icons and a standard pager, the same shape STEP 21/22 already
   * confirmed for the product-selection popup grid. `findRowByText()` above
   * only ever sees the current page's rows, so a target row beyond the
   * first page (e.g. any but the most-recently-paged-in record, once
   * enough records accumulate) is never found. Scans page by page using the
   * same pager-driven mechanism already proven in
   * KendoLineItemGrid.selectProductForRow() (the standard Kendo
   * `.k-pager-nav[title="Go to the next page"]` / `k-state-disabled`
   * signal — library-level markup, not app-specific, so the same check
   * applies to any Kendo-paged grid) rather than duplicating that scan
   * logic per caller.
   */
  async findRowAcrossPages(text: string, timeoutMs = 15000): Promise<Locator> {
    const nextPageLink = this.container().locator('.k-pager-nav[title="Go to the next page"]');
    let matchedRow: Locator | undefined;
    let pagesScanned = 0;

    while (!matchedRow) {
      pagesScanned++;
      const candidate = this.rows().filter({ hasText: text }).first();
      if (await candidate.isVisible().catch(() => false)) {
        matchedRow = candidate;
        break;
      }

      const nextPageClass = (await nextPageLink.getAttribute('class')) ?? '';
      if (nextPageClass.includes('k-state-disabled')) break;
      await nextPageLink.click();
      await this.waitForLoad(timeoutMs);
    }

    if (!matchedRow) {
      throw new Error(`findRowAcrossPages: no row containing "${text}" found after scanning ${pagesScanned} page(s).`);
    }
    return matchedRow;
  }

  async clickRowAction(rowText: string, actionText: string | RegExp): Promise<void> {
    const row = await this.findRowByText(rowText);
    await row.getByRole('button', { name: actionText }).or(row.getByRole('link', { name: actionText })).click();
  }

  /** Kendo Grid's built-in searchbox/filter row, if configured on this grid. */
  async search(term: string): Promise<void> {
    const searchInput = this.container().locator('.k-grid-search input, input[type="search"]').first();
    await searchInput.fill(term);
    await this.overlay.waitForIdle();
  }

  async sortByColumn(columnHeaderText: string): Promise<void> {
    await this.container().getByRole('columnheader', { name: columnHeaderText }).click();
    await this.overlay.waitForIdle();
  }

  async goToNextPage(): Promise<void> {
    await this.container().locator('.k-pager-nav[title="Go to the next page"], .k-i-arrow-e').first().click();
    await this.overlay.waitForIdle();
  }

  /**
   * PERFORMANCE-STABILIZATION-LIFECYCLE addition — reads Kendo's own
   * standard pager info text (e.g. "1 - 10 of 143 items"), the least
   * invasive way to observe this grid's current approximate total row
   * count (this task's own Phase 3: "record the current approximate
   * dataset size where it can be observed safely") without adding a
   * dedicated count query or otherwise touching any existing method here.
   * Returns null (never throws) if this grid instance doesn't render a
   * `.k-pager-info` element at all — some grids in this app have no pager
   * (confirmed elsewhere in this project), which is a normal, valid shape,
   * not a failure.
   */
  async getPagerInfoText(timeoutMs = 5000): Promise<string | null> {
    const pagerInfo = this.container().locator('.k-pager-info').first();
    const visible = await pagerInfo
      .waitFor({ state: 'visible', timeout: timeoutMs })
      .then(() => true)
      .catch(() => false);
    if (!visible) return null;
    return (await pagerInfo.textContent().catch(() => null))?.trim() ?? null;
  }
}
