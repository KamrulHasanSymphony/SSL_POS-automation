import { Locator, Page, expect } from '@playwright/test';
import { KendoGrid } from './KendoGrid';
import { LoadingOverlay } from '../LoadingOverlay';

/**
 * Shared invoice-application line-item editor used by Collection (against
 * existing Sales) and Payment (against existing Purchases) — confirmed
 * identical mechanism at STEP 7 source verification, structurally similar
 * to (but NOT the same component as) KendoLineItemGrid: both use a
 * toolbar "Add" button + incell editing, but here the row's identifying
 * cell must first be clicked into edit mode before a magnifier-icon button
 * appears (`SelectorEditor`) — clicking the row cell directly does not by
 * itself open the popup the way KendoLineItemGrid's product cell does.
 *
 * CONFIRMED CROSS-MODULE DIFFERENCES:
 * - Collection: grid `#CollectionDetailsGrid`, amount field `CollectionAmount`.
 * - Payment: grid `#PaymentDetailsGrid`, amount field `PaymentAmount`.
 * - Both share the exact same popup window id `#poWindow` and inner grid id
 *   `#windowGrid` (confirmed identical markup/ids in both Create.cshtml).
 *
 * LIVE DOM VERIFICATION RULE (see README.md): confirmed from source
 * (file:line citations in the STEP 7 chat record), not against a live
 * render — verify on first real use and correct here, not per-test.
 */
export class KendoInvoicePickerGrid {
  private readonly overlay: LoadingOverlay;
  private readonly popupGrid: KendoGrid;

  constructor(
    private readonly page: Page,
    private readonly containerSelector: string,
    private readonly amountField: 'CollectionAmount' | 'PaymentAmount'
  ) {
    this.overlay = new LoadingOverlay(page);
    this.popupGrid = new KendoGrid(page, '#windowGrid');
  }

  private container(): Locator {
    return this.page.locator(this.containerSelector);
  }

  private rows(): Locator {
    return this.container().locator('.k-grid-content table tbody tr, table tbody tr');
  }

  async rowCount(): Promise<number> {
    return this.rows().count();
  }

  async addRow(): Promise<Locator> {
    const before = await this.rowCount();
    await this.container().getByRole('button', { name: 'Add' }).click();
    await expect.poll(async () => this.rowCount(), { timeout: 10000 }).toBeGreaterThan(before);
    return this.rows().last();
  }

  /**
   * Opens the invoice-search popup for the given row (click the cell to
   * activate its SelectorEditor, then click the magnifier button that
   * appears — confirmed two-step interaction, unlike KendoLineItemGrid's
   * single click), searches by the invoice's (unique) Code, and
   * double-clicks the matching row to apply the selection back.
   *
   * FINANCIAL-LIFECYCLE E2E LIVE RUNTIME FINDING (root cause, confirmed via
   * console/DOM diagnostic against the live app, on Payment's
   * #PaymentDetailsGrid — the first live exercise of this exact interaction
   * for Payment specifically): the identifying, SelectorEditor-backed column
   * ("PurchaseId" for Payment, "SaleId" for Collection — confirmed identical
   * layout in both PaymentController.js's and CollectionController.js's own
   * `columns:` array) is NOT the row's first `<td>` — column 0 is the
   * non-editable "SL" row-number column (`editable: false`, confirmed same
   * in both files), and the identifying column is column 1. Clicking column
   * 0 selects a cell with no editor at all, so no magnifier button ever
   * renders — not a timing/race issue (a bounded retry against the same
   * wrong cell reproduced the exact same empty result 3/3 times). This
   * affects Collection identically (same column order), not just Payment —
   * a shared-component fix, not a Payment-specific one.
   */
  async selectInvoiceForRow(row: Locator, invoiceCode: string): Promise<void> {
    const identifyingCell = row.locator('td').nth(1);
    await identifyingCell.click();
    await identifyingCell.locator('button').first().click();

    const window = this.page.locator('#poWindow');
    await window.waitFor({ state: 'visible', timeout: 10000 });
    await this.popupGrid.waitForLoad();
    await this.popupGrid.search(invoiceCode);
    const match = await this.popupGrid.findRowByText(invoiceCode);
    await match.dblclick();
    await window.waitFor({ state: 'hidden', timeout: 10000 }).catch(() => undefined);
    await this.overlay.waitForIdle();
  }

  /**
   * Reads the row's Due Amount cell, set on invoice selection.
   *
   * FINANCIAL-LIFECYCLE E2E LIVE RUNTIME FINDING (confirmed via a live DOM
   * dump of #PaymentDetailsGrid's rendered row — `row.locator('td').evaluateAll(...)`
   * against a real selected invoice line, the first live exercise of this
   * exact read): this grid's Kendo incell-edit renderer emits NO `data-field`
   * attribute on any `<td>` at all (only `role="gridcell"` plus a
   * `k-dirty-cell` class on edited cells) — `td[data-field="DueAmount"]`
   * matches zero elements, so `.textContent()` silently fails (caught below)
   * and this always returned 0, regardless of the row's real Due. Confirmed
   * column order instead, from the same live dump (matches the grid's own
   * visible header row: "SL / Purchase Code / Purchase Amount / Paid / Due /
   * Payment Amount / Due After"): index 0 SL (non-editable) / 1 identifying
   * code / 2 gross amount / 3 Paid / 4 Due / 5 Payment|Collection Amount
   * (editable) / 6 Due After / 7 delete button — identical layout for
   * Collection and Payment (same shared markup, see this class's own header
   * comment). Selecting by confirmed position instead of the non-existent
   * attribute.
   */
  async getDueAmount(row: Locator): Promise<number> {
    const cell = row.locator('td').nth(4);
    const text = (await cell.textContent().catch(() => '')) ?? '0';
    const parsed = parseFloat(text.replace(/[^0-9.-]/g, ''));
    return Number.isFinite(parsed) ? parsed : 0;
  }

  /**
   * Same confirmed-column-position finding as getDueAmount() above — the
   * editable Payment|Collection Amount cell is index 5; `td[data-field]` is
   * never rendered by this grid (live-confirmed). Tries the attribute
   * selector first regardless — defensive only, in case a future Kendo
   * config/version does emit it for this field — falling back to the
   * confirmed position when (as currently) it does not, so `amountField`
   * stays meaningful rather than dead.
   */
  async setAmount(row: Locator, amount: number): Promise<void> {
    const byAttribute = row.locator(`td[data-field="${this.amountField}"]`);
    const cell = (await byAttribute.count()) > 0 ? byAttribute.first() : row.locator('td').nth(5);
    await cell.click();
    const input = row.locator('input').last();
    await input.fill(String(amount));
    await input.press('Tab');
  }

  /** Full flow: add a row, pick the invoice, set an amount no greater than the confirmed Due Amount. */
  async addInvoiceLine(invoiceCode: string, amount?: number): Promise<Locator> {
    const row = await this.addRow();
    await this.selectInvoiceForRow(row, invoiceCode);
    const due = await this.getDueAmount(row);
    const applied = amount ?? due;
    await this.setAmount(row, applied);
    return row;
  }
}
