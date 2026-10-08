import { Locator, Page, expect } from '@playwright/test';
import { KendoGrid } from './KendoGrid';
import { LoadingOverlay } from '../LoadingOverlay';

/**
 * Shared line-item editor used by all six transaction modules (Purchase,
 * PurchaseOrder, PurchaseReturn, Sale, SaleOrder, SaleReturn) — confirmed
 * identical mechanism across all six at STEP 6 source verification:
 * a Kendo Grid with `editable: { mode: "incell" }`, a toolbar "Add" button
 * that inserts a blank row, a custom `itemSelectorEditor` on the product
 * column that opens a Kendo Window (`#saleDetailsWindow`) containing its own
 * Kendo Grid (`#saleDetailsGrid`) of selectable products, and a Quantity
 * numeric-textbox editor.
 *
 * CONFIRMED CROSS-MODULE DIFFERENCES (do not assume uniformity beyond these):
 * - Grid container id: `#saleDetails` for Sale only; `#saleOrderDetails` for
 *   Purchase, PurchaseOrder, PurchaseReturn, SaleOrder, SaleReturn.
 * - Unit-price column field name: `UnitPrice` for Purchase/PurchaseOrder/
 *   PurchaseReturn; `UnitRate` for Sale/SaleOrder/SaleReturn.
 * - Only Purchase/PurchaseOrder/PurchaseReturn's Quantity cell editor fires a
 *   live Toastr notification for a negative/zero value entered directly in
 *   the grid; Sale silently clamps, SaleOrder has no such handler, and
 *   SaleReturn's equivalent code exists but is commented out. All six do
 *   enforce "Quantity must be greater than zero." at pre-submit validation
 *   time regardless — that is the one universal, reliable assertion point.
 *
 * LIVE DOM VERIFICATION RULE (see README.md): the popup window/grid ids and
 * the `itemSelectorEditor` trigger location were confirmed from source
 * (file:line citations in the STEP 6 chat record) but not against a live
 * render — verify on first real use and correct here, not per-test.
 *
 * STEP 12 LIVE EXECUTION FINDING (SaleOrder only so far — do not assume this
 * extends to the other five modules without their own live evidence): the
 * `itemSelectorEditor` trigger is NOT the row's first `<td>`. Confirmed live
 * (screenshot + accessibility snapshot) that SaleOrder's `#saleOrderDetails`
 * grid renders an "Sl No" column before "Product Name" — clicking the first
 * cell hits the inert Sl No cell, not the product-picker trigger. `
 * productCellIndex` (new, optional, defaults to 0 — i.e. `.first()`,
 * unchanged for every existing caller) lets a page object opt into the
 * correct index once its own live DOM confirms it, without guessing it for
 * the other modules that have not yet been exercised live.
 *
 * STEP 13/14 LIVE EXECUTION FINDING (confirmed directly from
 * SaleOrderController.js source): the product cell's `itemSelectorEditor`
 * renders `<div class="input-group">` with a readonly `<input>` and a
 * `<button class="btn btn-outline-secondary"><i class="fa fa-search">` —
 * that search button, not the cell itself, is what opens
 * `#saleDetailsWindow` (its own handler calls `OpenProductPopup()`).
 *
 * STEP 17 LIVE RUNTIME FINDING (superseding the STEP 13/14 "click cell,
 * then click the button" sequence — proven via live `grid.bind('edit'/
 * 'cellClose', ...)` instrumentation, not source alone): with this grid's
 * `editable: { mode: "incell", createAt: "bottom" }`, clicking the toolbar
 * "Add" button already inserts the new row IN edit mode on the product
 * cell — the search button above already exists immediately after
 * `addRow()`, before any product-cell click. Confirmed live: a subsequent
 * click on that same cell does not open a new edit session (no `edit`
 * event fires) — it CLOSES the one Kendo already opened (`cellClose`
 * fires), removing the very search button being waited for. The correct
 * sequence is therefore to locate and click that already-rendered search
 * button directly, with no cell click at all.
 *
 * STEP 19/20 LIVE RUNTIME FINDING: `rows()`'s old selector
 * (`.k-grid-content table tbody tr, table tbody tr`) had an unscoped second
 * alternative that also matched the grid's own footer summary row
 * (`<tr class="k-footer-template">`, rendered in a separate `.k-grid-footer`
 * table outside `.k-grid-content`). Confirmed live (row-by-row `data-uid`/
 * `outerHTML` inspection): with a footer row present, `rows().last()`
 * resolved to that footer row instead of the newly-added data row, so every
 * row-scoped lookup afterward (including the search button above) was
 * querying inside a `<tr>` that can never contain it. Scoped strictly to
 * `.k-grid-content` below so only real data rows are ever matched.
 */
export class KendoLineItemGrid {
  private readonly overlay: LoadingOverlay;
  private readonly popupGrid: KendoGrid;

  constructor(
    private readonly page: Page,
    private readonly containerSelector: string,
    private readonly unitPriceField: 'UnitPrice' | 'UnitRate' = 'UnitPrice',
    private readonly productCellIndex: number = 0
  ) {
    this.overlay = new LoadingOverlay(page);
    this.popupGrid = new KendoGrid(page, '#saleDetailsGrid');
  }

  private container(): Locator {
    return this.page.locator(this.containerSelector);
  }

  /**
   * Public since STEP (Purchase-lifecycle E2E): the "From Purchase Order"
   * conversion pre-populates rows server-side (never via `addRow()`), so
   * callers verifying those rows (e.g. "Items loaded correctly") need a way
   * to read them that isn't tied to just having added one — `.first()`/
   * `.nth()`/`.count()` on the returned Locator collection covers that
   * without adding a redundant indexing method here.
   */
  rows(): Locator {
    return this.container().locator('.k-grid-content table tbody tr');
  }

  async rowCount(): Promise<number> {
    return this.rows().count();
  }

  /** Clicks the grid toolbar's "Add" button, inserting a blank editable row. */
  async addRow(): Promise<Locator> {
    const before = await this.rowCount();
    await this.container().getByRole('button', { name: 'Add' }).click();
    await expect
      .poll(async () => this.rowCount(), { timeout: 10000 })
      .toBeGreaterThan(before);
    return this.rows().last();
  }

  /**
   * Opens the product-search popup for the given row, matches the (unique)
   * product name against the popup's currently visible rows, and
   * double-clicks the matching row to apply the selection back — confirmed
   * mechanism (STEP 17, see class doc comment): the product cell is already
   * in edit mode (with its search button already rendered) as soon as the
   * row is added, so this clicks that search button directly rather than
   * the cell itself.
   *
   * STEP 22 LIVE RUNTIME FINDING: `#saleDetailsGrid` has no toolbar search —
   * no `.k-grid-search`, `input[type="search"]`, or `.k-grid-toolbar` exist
   * on this popup, only per-column filter icons, pagination, and data rows.
   * `KendoGrid.search()` (which fills a toolbar search input) is therefore
   * inapplicable here. Instead, match the product name directly against the
   * popup's currently visible rows.
   *
   * STEP 24/25 LIVE RUNTIME FINDING: the popup lists ALL products (one
   * unfiltered `GetProductModal` call, confirmed live), paged 10 rows/page
   * via Kendo's standard pager — a newly created product can therefore land
   * on any page, not just the first. Confirmed live markup: the "Go to the
   * next page" pager link (`.k-pager-nav[title="Go to the next page"]`)
   * carries an extra `k-state-disabled` class once the last page is
   * reached — that presence/absence is the only page-count signal used
   * below, so no page total is ever hardcoded.
   *
   * SALE-PRODUCT-PICKER-INVESTIGATION E2E FINDING: this unfiltered-list
   * assumption ages badly — confirmed live that this shared environment's
   * Product catalog has grown to 140+ (and rising) unfiltered rows, so a
   * freshly-created product can land 15+ pages in, each page requiring a
   * full click + `waitForLoad()` round trip; that cumulative cost is what
   * was actually timing out `sales-lifecycle.spec.ts`, not a locator bug —
   * the pagination scan itself always found the right row eventually, just
   * too slowly. Confirmed live that this popup's grid — same shared
   * `#saleDetailsGrid`/`#saleDetailsWindow` component across all six
   * transaction modules, per this class's own doc comment — DOES expose a
   * working per-column Kendo filter menu (`th[data-field="ProductName"]`'s
   * `.k-grid-filter` icon → text input → "Filter" button), even though no
   * toolbar search box exists (STEP 22). Filtering by the unique product
   * name directly is O(1) instead of O(pages) and gets more reliable, not
   * less, as the catalog keeps growing. Tried first; if this specific
   * module's popup doesn't expose that field/icon (not yet confirmed live
   * for Purchase/PurchaseOrder/PurchaseReturn/SaleOrder/SaleReturn), this
   * silently falls back to the original, still-correct page-by-page scan
   * unchanged below — no behavior change for any caller this filter path
   * doesn't apply to.
   */
  async selectProductForRow(row: Locator, productName: string): Promise<void> {
    const cell = row.locator('td').nth(this.productCellIndex);
    const searchButton = cell.locator('button.btn-outline-secondary');
    await searchButton.waitFor({ state: 'visible', timeout: 10000 });
    await searchButton.click();
    const window = this.page.locator('#saleDetailsWindow');
    await window.waitFor({ state: 'visible', timeout: 10000 });
    await this.popupGrid.waitForLoad();

    const popupRows = this.page.locator('#saleDetailsGrid .k-grid-content tbody tr');
    const filtered = await this.filterPopupByProductName(productName);
    let matchedRow: Locator | undefined;

    if (filtered) {
      const candidate = popupRows.filter({ hasText: productName }).first();
      if (await candidate.isVisible().catch(() => false)) {
        matchedRow = candidate;
      }
    }

    if (!matchedRow) {
      const nextPageLink = this.page.locator('#saleDetailsGrid .k-pager-nav[title="Go to the next page"]');
      let pagesScanned = 0;
      while (!matchedRow) {
        pagesScanned++;
        const visibleRowCount = await popupRows.count();
        for (let i = 0; i < visibleRowCount; i++) {
          const candidate = popupRows.nth(i);
          const cellTexts = await candidate.locator('td').allTextContents();
          if (cellTexts.some((text) => text.trim() === productName)) {
            matchedRow = candidate;
            break;
          }
        }
        if (matchedRow) break;

        const nextPageClass = (await nextPageLink.getAttribute('class')) ?? '';
        if (nextPageClass.includes('k-state-disabled')) break;
        await nextPageLink.click();
        await this.popupGrid.waitForLoad();
      }

      if (!matchedRow) {
        throw new Error(
          `selectProductForRow: product "${productName}" not found after scanning ${pagesScanned} page(s).`
        );
      }
    }

    await matchedRow.dblclick();
    await window.waitFor({ state: 'hidden', timeout: 10000 }).catch(() => undefined);
    await this.overlay.waitForIdle();
  }

  /**
   * Fast path for selectProductForRow() — see its own doc comment for the
   * live evidence this is built on. Returns false (no-op, safe to ignore)
   * if this popup instance doesn't expose the expected filter affordance,
   * so callers always have the original pagination scan as a correctness
   * fallback.
   */
  private async filterPopupByProductName(productName: string): Promise<boolean> {
    const nameHeader = this.page.locator('#saleDetailsGrid .k-grid-header th[data-field="ProductName"]');
    const filterIcon = nameHeader.locator('a.k-grid-filter, .k-grid-filter').first();
    if ((await filterIcon.count()) === 0) {
      return false;
    }
    await filterIcon.click();
    const filterInput = this.page
      .locator('.k-filter-menu input[type="text"], .k-animation-container input[type="text"]')
      .first();
    const inputVisible = await filterInput
      .waitFor({ state: 'visible', timeout: 5000 })
      .then(() => true)
      .catch(() => false);
    if (!inputVisible) {
      return false;
    }
    await filterInput.fill(productName);
    const filterButton = this.page
      .locator('.k-filter-menu button:has-text("Filter"), .k-animation-container button:has-text("Filter")')
      .first();
    await filterButton.click();
    await this.popupGrid.waitForLoad();
    return true;
  }

  /**
   * Sets the Quantity cell for the given row via its Kendo numeric editor.
   *
   * STEP 26 LIVE RUNTIME FINDING: confirmed live (trace DOM snapshot +
   * SaleOrderController.js source) that this grid's `<td>` cells never carry
   * a `data-field` attribute in view mode — only `<th>` headers do — and no
   * `input[name="Quantity"]` exists until the cell is actually clicked into
   * edit mode (the Quantity column's `editor` callback only creates that
   * `<input>` once Kendo invokes it on click). `td[data-field="Quantity"],
   * td:has(input[name="Quantity"])` therefore never matched anything,
   * timing out before any click occurred. Kendo does stamp a `data-index`
   * on each `<th>` (confirmed live) reflecting its column's true `<td>`
   * position in the row — read that from the header rather than guessing an
   * offset, so this stays correct even where other modules interleave
   * hidden columns between Product Name and Quantity.
   */
  async setQuantity(row: Locator, quantity: number): Promise<void> {
    const cell = await this.quantityCell(row);
    await cell.click();
    // CUSTOMER-COLLECTION-LIFECYCLE E2E FINDING (STEP KENDO-QUANTITY-
    // INVESTIGATION): confirmed live (outerHTML capture of #saleDetails's
    // Quantity cell once in edit mode) that this grid's Kendo NumericTextBox
    // widget renders its real, bindable input as
    // `data-bind="value:Quantity" data-role="numerictextbox"` — no
    // `name="Quantity"` attribute at all, unlike Purchase's equivalent cell
    // (where `input[name="Quantity"]` already works, confirmed by
    // purchase-lifecycle.spec.ts/purchase.spec.ts's own passing runs). Column
    // index/edit-mode activation were confirmed correct (columnIndex('Quantity')
    // resolves to the right cell; the widget is already fully rendered on
    // click, no timing gap) — this was purely the wrong attribute to search
    // for. Scoped to the already-correctly-resolved cell (not the whole row,
    // avoiding any cross-column ambiguity) and matches either attribute so
    // Purchase's already-working path is unaffected.
    const input = cell.locator('input[name="Quantity"], input[data-role="numerictextbox"]').first();
    await input.fill(String(quantity));
    await input.press('Tab');
  }

  /**
   * Resolves a column's true `<td>` position from its `<th data-field>`'s
   * `data-index` (see setQuantity()'s doc comment for the STEP 26 evidence
   * this is built on) — the one shared lookup every by-field cell accessor
   * below uses, so none of them repeat the `td[data-field="..."]` assumption
   * already proven false for this app's `<td>` elements.
   */
  private async columnIndex(fieldName: string): Promise<number> {
    const header = this.container().locator(`.k-grid-header th[data-field="${fieldName}"]`).first();
    return Number(await header.getAttribute('data-index'));
  }

  /** Quantity cell for the given row, exposed for read-back verification without duplicating setQuantity()'s lookup in a caller. */
  async quantityCell(row: Locator): Promise<Locator> {
    return row.locator('td').nth(await this.columnIndex('Quantity'));
  }

  /**
   * Unit price/rate cell for the given row — confirmed always read-only,
   * populated from the selected product.
   *
   * PURCHASE-LIFECYCLE E2E LIVE RUNTIME FINDING: this previously used the
   * same `td[data-field="..."]` selector STEP 26 already proved never
   * matches any `<td>` in this app (only `<th>` headers carry `data-field`)
   * — confirmed live again here (15s timeout, zero `data-field` occurrences
   * anywhere in the row). Now uses the same `data-index`-from-header lookup
   * as quantityCell()/setQuantity().
   */
  async unitPriceCell(row: Locator): Promise<Locator> {
    return row.locator('td').nth(await this.columnIndex(this.unitPriceField));
  }

  /** Line Total ("Total" column) cell for the given row — confirmed field name from source (FromPurchaseOrderController.js's detail grid: `{ field: "LineTotal", title: "Total" }`); same `data-index` lookup as unitPriceCell(), not the unattributed `<td>` assumption. */
  async lineTotalCell(row: Locator): Promise<Locator> {
    return row.locator('td').nth(await this.columnIndex('LineTotal'));
  }

  /**
   * VAT-LIFECYCLE-PHASE-2 addition — SD Rate / SD Amount / VAT Rate / VAT
   * Amount cells for the given row. Same `data-index`-from-header lookup as
   * every other by-field accessor above — never a hardcoded column
   * position — confirmed exact field names from source (PurchaseController.js/
   * SaleController.js's own Kendo column defs: `{ field: "SD", title: "SD Rate" }`,
   * `{ field: "SDAmount", title: "SD Amount" }`, `{ field: "VATRate", title: "VAT Rate" }`,
   * `{ field: "VATAmount", title: "VAT Amount" }` — identical field names
   * across Purchase/PurchaseOrder/PurchaseReturn/Sale/SaleOrder/SaleReturn,
   * this class's own confirmed-uniform grid). Read-only accessors — SD/VAT
   * are populated from the selected Product's own configured rate (see
   * ProductPage.ts's `fillVatRate()`/`fillSdRate()`) or, independently,
   * are manually editable grid cells in the live app; no setter is added
   * here since every caller so far only needs to read back the resulting
   * calculated values, not drive them from this class.
   */
  async sdRateCell(row: Locator): Promise<Locator> {
    return row.locator('td').nth(await this.columnIndex('SD'));
  }

  async sdAmountCell(row: Locator): Promise<Locator> {
    return row.locator('td').nth(await this.columnIndex('SDAmount'));
  }

  async vatRateCell(row: Locator): Promise<Locator> {
    return row.locator('td').nth(await this.columnIndex('VATRate'));
  }

  async vatAmountCell(row: Locator): Promise<Locator> {
    return row.locator('td').nth(await this.columnIndex('VATAmount'));
  }

  /** Parses a cell's displayed text into a number (strips currency/thousands formatting) — shared by every by-field accessor's callers so VAT/SD validation doesn't repeat this parsing inline. */
  static async cellValue(cell: Locator): Promise<number> {
    const text = (await cell.textContent().catch(() => '')) ?? '0';
    const parsed = parseFloat(text.replace(/[^0-9.-]/g, ''));
    return Number.isFinite(parsed) ? parsed : 0;
  }

  async addLineItem(productName: string, quantity: number): Promise<Locator> {
    const row = await this.addRow();
    await this.selectProductForRow(row, productName);
    await this.setQuantity(row, quantity);
    return row;
  }
}
