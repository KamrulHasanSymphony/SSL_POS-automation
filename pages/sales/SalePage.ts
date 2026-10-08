import { Locator, Page } from '@playwright/test';
import { BasePage } from '../common/BasePage';
import { KendoGrid } from '../../components/common-grid/KendoGrid';
import { KendoLineItemGrid } from '../../components/common-grid/KendoLineItemGrid';
import { KendoMultiColumnComboBox } from '../../components/kendo/KendoMultiColumnComboBox';
import { KendoDatePicker } from '../../components/kendo/KendoDatePicker';
import { routes, saleFormSelectors, gridContainerSelectors, transactionGridContainers } from '../../utils/constants';

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export interface SaleCreateData {
  customerName: string;
  productName: string;
  quantity: number;
  bankAccountName: string;
  /** Optional override — by default the full computed FinalPayable is read
   * back from the form and paid (confirmed rule: payment must exactly cover
   * FinalPayable, neither more nor less, before Save is allowed to proceed). */
  paymentAmount?: number;
}

/**
 * Areas/DMS/Controllers/SaleController.cs + Views/Sale/Create.cshtml,
 * confirmed at STEP 6. Unlike the other five transaction modules, Sale
 * carries a MANDATORY payment step (`#cardDetails` grid, confirmed:
 * "Please complete the payment before submitting the sale.") and uses grid
 * container id `#saleDetails` (not `#saleOrderDetails`) and unit-price field
 * `UnitRate` (not `UnitPrice`).
 *
 * LIVE DOM VERIFICATION GAP (flagged, not silently guessed): the exact
 * in-grid editing mechanics of `#cardDetails` (its toolbar "Add" mechanism,
 * and how the CreditCardId cell editor — a Kendo combo bound per-row rather
 * than a fixed-id page widget like the header SupplierId/CustomerId combos —
 * actually renders) were NOT individually confirmed at STEP 6; only the
 * field names (CreditCardId/CardTotal/Remarks) and the grid's existence/
 * mandatoriness were. `addPayment()` below applies this app's otherwise
 * confirmed general Kendo-incell-edit convention (same "Add" toolbar +
 * click-cell-to-edit pattern used identically across 6 other grids in this
 * codebase) as the best available inference — verify against the live app
 * before trusting it, and correct here (not per-test) if it differs. Delete
 * is confirmed to have NO controller action at all for Sale — no delete
 * method here.
 */
export class SalePage extends BasePage {
  readonly grid: KendoGrid;
  readonly lineItems: KendoLineItemGrid;
  private readonly customerCombo: KendoMultiColumnComboBox;
  private readonly invoiceDate: KendoDatePicker;

  constructor(page: Page) {
    super(page);
    this.grid = new KendoGrid(page, gridContainerSelectors.default);
    // CUSTOMER-COLLECTION-LIFECYCLE E2E FINDING (STEP KENDO-GRID-INVESTIGATION):
    // confirmed live (outerHTML capture of #saleDetails's first <td>
    // immediately after Add: `<td class="" role="gridcell">1</td>` — the "Sl
    // No" column's serial number, never a button) that this grid renders the
    // same "Sl No" column before "Product Name" already fixed on
    // PurchasePage.ts/PurchaseOrderPage.ts/SaleOrderPage.ts but never applied
    // here — productCellIndex must be 1, not the default 0. Without this,
    // selectProductForRow() waits on a cell that can never contain the
    // product-search button, a deterministic (not flaky) timeout.
    this.lineItems = new KendoLineItemGrid(page, transactionGridContainers.sale, 'UnitRate', 1);
    this.customerCombo = new KendoMultiColumnComboBox(page, saleFormSelectors.customerId);
    this.invoiceDate = new KendoDatePicker(page, 'InvoiceDateTime');
  }

  async goto(): Promise<void> {
    await this.page.goto(routes.dms('Sale', 'Index'));
    await this.grid.waitForLoad();
  }

  async gotoCreate(): Promise<void> {
    await this.page.goto(routes.dms('Sale', 'Create'));
  }

  async selectCustomer(uniqueCustomerName: string): Promise<void> {
    await this.customerCombo.typeAndSelectFirst(uniqueCustomerName);
  }

  /**
   * PERFORMANCE-STABILIZATION-LIFECYCLE addition — thin pass-through to
   * `KendoMultiColumnComboBox.typeAndSelectFirstTimed()` (itself additive,
   * see its own doc comment / PurchasePage.selectSupplierTimed()'s mirror
   * of this same pattern): `customerCombo` is private, so this exposes the
   * sub-phase-timed variant the same way `selectCustomer()` above already
   * exposes the untimed one. `selectCustomer()` itself is unchanged.
   */
  async selectCustomerTimed(uniqueCustomerName: string): Promise<{ fillMs: number; renderMs: number; selectMs: number; totalMs: number }> {
    return this.customerCombo.typeAndSelectFirstTimed(uniqueCustomerName);
  }

  async fillInvoiceDate(isoDate: string = today()): Promise<void> {
    await this.invoiceDate.setDate(isoDate);
  }

  /**
   * See class doc comment. CUSTOMER-COLLECTION-LIFECYCLE E2E FINDING (STEP
   * SALE-PAYMENT-GRID-INVESTIGATION): confirmed live (ARIA snapshot +
   * screenshot captured at the exact `bankInput.fill()` timeout) that
   * `#cardDetails` is a Kendo Grid rendered by the same widget/version as
   * `#saleDetails`/`#saleOrderDetails`, and exhibits the identical footer
   * structure already found and fixed for `KendoLineItemGrid.rows()` (STEP
   * 19/20): its aggregate totals row ("0.00", no inputs at all) renders in
   * its own `<table><tbody><tr>` appended after the real data row's table.
   * The previous unscoped `table tbody tr` matched both and `.last()`
   * resolved to that footer row, so `row.locator('input').first()` waited
   * on an `<input>` that could never exist in that row — a deterministic
   * timeout, not flakiness. Scoped to `.k-grid-content` below, same
   * convention already proven for the line-item grids.
   *
   * The same evidence also confirms this grid's column layout — SL(0) /
   * Payment Type(1, the CreditCardId combo — already confirmed
   * auto-activated in edit mode immediately after Add, same "Add already
   * opens the first editable cell" convention as STEP 17) / Payment
   * Total(2, plain text "0" until clicked into edit) / Reference No.(3) —
   * i.e. the same SL-column-shifts-everything-by-one pattern already
   * confirmed for the line-item grids' `productCellIndex`. The amount
   * cell's activation click previously targeted `td.nth(1)` — the
   * already-open Payment Type/CreditCardId cell, not Payment Total —
   * which would have closed that cell's edit session (STEP 17's confirmed
   * click-while-editing behavior) without ever creating the Payment Total
   * editor. Corrected to `td.nth(2)`.
   */
  async addPayment(bankAccountName: string, amount: number): Promise<void> {
    const paymentContainer = this.page.locator(saleFormSelectors.paymentGrid);
    await paymentContainer.getByRole('button', { name: 'Add' }).click();
    const row: Locator = paymentContainer.locator('.k-grid-content table tbody tr').last();
    await row.locator('td').first().click();
    const bankInput = row.locator('input').first();
    await bankInput.fill(bankAccountName);
    await this.page.getByRole('option').first().click().catch(() => undefined);
    await row.locator('td').nth(2).click();
    const amountInput = row.locator('input').nth(1);
    await amountInput.fill(String(amount));
    await amountInput.press('Tab');
  }

  /**
   * Reads the computed "final payable" total after line items are entered.
   * Element id `#FinalPayable` is inferred from the confirmed
   * `updateSaleSummary()` field list (SubTotal/SD/VAT/RoundUp/FinalPayable/
   * Payment/Dues) — the id itself was NOT independently confirmed against a
   * live render (part of the same #cardDetails-adjacent gap noted in the
   * class doc comment). Falls back to 0 if unreadable, in which case
   * callers should supply an explicit `paymentAmount` override instead.
   */
  async getFinalPayable(): Promise<number> {
    const el = this.page.locator('#FinalPayable');
    const raw = (await el.inputValue().catch(() => null)) ?? (await el.textContent().catch(() => null)) ?? '0';
    const parsed = parseFloat(raw.replace(/[^0-9.-]/g, ''));
    return Number.isFinite(parsed) ? parsed : 0;
  }

  /**
   * CUSTOMER-COLLECTION-LIFECYCLE E2E FINDING (STEP SALE-SAVE-VERIFICATION-
   * INVESTIGATION): confirmed live (network trace: zero `/DMS/Sale/CreateEdit`
   * POST calls; captured toast text: "Your payment is more than your total
   * bill. Please correct it."; `#Code` still empty; URL still
   * `/DMS/Sale/Create`) that `this.toastr.expectSuccess()` — called with no
   * expected-text argument, so it accepts ANY visible toast — was a false
   * positive here: SaleController.js's `.btnsave` click handler blocks the
   * actual save (`ShowNotification(3, "Your payment is more than your total
   * bill...")`, no `save()` call at all) whenever the entered payment
   * exceeds `#FinalPayable`, and the generic toast check can't tell that
   * error apart from a real success. `this.getCode()` afterward then reads
   * an `#Code` that was never populated, silently handing callers an empty
   * string.
   *
   * Also confirmed directly from source (SaleController.js's `saveDone()`)
   * that a REAL successful save does `window.location.href =
   * "/DMS/Sale/Edit/" + id` — a full navigation — which corrects the
   * customer-collection-lifecycle fixture's own prior (unconfirmed, now
   * disproven) assumption that "Sale's Save does not itself land on
   * /DMS/Sale/Edit". Waiting for that navigation is a strictly stronger,
   * failure-distinguishing signal than the toast: it only ever resolves on
   * a genuine save, and throws a clear, immediate, correctly-located error
   * otherwise instead of silently proceeding — see `waitForSaveSuccess()`.
   */
  async createSale(data: SaleCreateData): Promise<string> {
    await this.gotoCreate();
    await this.selectCustomer(data.customerName);
    await this.fillInvoiceDate();
    await this.lineItems.addLineItem(data.productName, data.quantity);
    const amount = data.paymentAmount ?? (await this.getFinalPayable());
    await this.addPayment(data.bankAccountName, amount);
    await this.clickSave();
    return this.waitForSaveSuccess();
  }

  /**
   * See `createSale()`'s doc comment for the live evidence this is built
   * on. Public (not inlined into `createSale()`) so callers that build the
   * Save step manually — e.g. a deliberate partial payment, where a caller
   * needs to fill/save outside `createSale()`'s own full-FinalPayable
   * default — get the same real, failure-distinguishing verification
   * instead of re-implementing (or omitting) it themselves.
   */
  async waitForSaveSuccess(): Promise<string> {
    await this.page.waitForURL(/\/DMS\/Sale\/Edit/i, { timeout: 15000 });
    return this.waitForCode();
  }

  /**
   * SALES-ORDER-CONVERSION-LIFECYCLE E2E FINDING (first live exercise of
   * this method — the "From Sale Order" conversion path had no page-object
   * coverage at all before this): confirmed from source
   * (SaleController.cs's `FromSaleOrder()`/`GetFromSaleOrder()` actions,
   * `FromSaleOrderController.js`) that this is the real, only mechanism
   * connecting a Sale Order to a Sale — a `#GridDataList` Kendo Grid
   * (`selectable: "multiple row"`, same shared container/component this
   * page's own `this.grid` already targets — see `gridContainerSelectors.default`)
   * of existing Sale Orders, chosen via the page-level `#btnSelect` button,
   * which POSTs the selected id(s) to `/DMS/Sale/GetFromSaleOrder` and
   * renders the same `Create` view pre-populated (header + line items) from
   * the selected Sale Order — the identical shape already proven for
   * `PurchasePage.createFromPurchaseOrder()`, reused here rather than
   * guessed fresh.
   *
   * Confirmed directly from `SaleController.js`: (1) row Add/Delete on
   * `#saleDetails` are unconditionally blocked whenever `#IsManualSale` is
   * not `"True"` ("You cannot add new item here."/"Row delete is not
   * allowed here.") — `GetFromSaleOrder` sets `IsManualSale = false`, so no
   * `addLineItem()`/edit call is made here, only a fresh payment;
   * (2) the mandatory-payment check (`cardDetails.length === 0` ->
   * "Please complete the payment before submitting the sale.") is
   * UNCONDITIONAL — it does not depend on `IsManualSale` at all, so a
   * payment is still required here exactly as `createSale()`'s own blank
   * path requires; (3) `GetFromSaleOrder` sets `purchase.Operation = "add"`,
   * so a genuine save still fires `saveDone()`'s `Operation == "add"`
   * branch — the exact same `window.location.href = "/DMS/Sale/Edit/" + id`
   * redirect `waitForSaveSuccess()` above already waits for, reused
   * unchanged rather than duplicated.
   */
  async gotoFromSaleOrder(): Promise<void> {
    await this.page.goto(routes.dms('Sale', 'FromSaleOrder'));
  }

  async createFromSaleOrder(
    saleOrderCode: string,
    bankAccountName: string,
    paymentAmount?: number
  ): Promise<string> {
    await this.gotoFromSaleOrder();
    await this.grid.waitForLoad();
    const row = await this.grid.findRowAcrossPages(saleOrderCode);
    await row.click();
    await this.page.locator('#btnSelect').click();
    await this.page.waitForURL(/\/DMS\/Sale\/(Create|GetFromSaleOrder)/i);
    await this.overlay.waitForIdle();

    const amount = paymentAmount ?? (await this.getFinalPayable());
    await this.addPayment(bankAccountName, amount);
    await this.clickSave();
    return this.waitForSaveSuccess();
  }

  /**
   * CUSTOMER-COLLECTION-LIFECYCLE E2E FINDING (STEP SALE-GRID-ROW-ACTION-
   * INVESTIGATION): confirmed live (ARIA snapshot captured at the exact
   * `clickRowAction()` timeout, cross-checked against
   * SaleController.js's `#GridDataList` Action column template) that the
   * Edit action is an icon-only link with NO accessible name at all —
   * `<a href="/DMS/Sale/Edit/{id}" class="btn btn-primary btn-sm mr-2
   * edit"><i class="fas fa-pencil-alt"></i></a>`, no `title`/`aria-label`/
   * text (unlike its sibling "Report" link, which does carry
   * `title="Report"`). `KendoGrid.clickRowAction()`'s
   * `getByRole(..., { name: /edit/i })` can therefore never match it — a
   * deterministic timeout, not flakiness. This is the exact same defect
   * already found and worked around (via `a.edit` directly) on ~10 other
   * grids in this codebase (MasterItemPage/CustomerGroupPage/
   * ProductGroupPage/SupplierGroupPage/CompanyProfilePage/RoleMenuPage/
   * RolePage/IncomePage/ExpensePage/CustomerAdvancePage), just never
   * previously applied here. Same fix, same convention.
   */
  async openEditFor(code: string): Promise<void> {
    await this.goto();
    await this.grid.search(code);
    const row = await this.grid.findRowByText(code);
    await row.locator('a.edit').click();
    await this.page.waitForURL(/\/DMS\/Sale\/Edit/i);
  }

  async post(): Promise<void> {
    await this.clickPost();
  }

  async expectCustomerRequiredIndicated(): Promise<void> {
    await this.expectRequiredIndicatorVisible(saleFormSelectors.customerDropdownError);
  }

  /** Confirmed distinct Sale business rule: save is blocked until payment covers FinalPayable. */
  async expectPaymentRequiredNotification(): Promise<void> {
    await this.toastr.expectError('Please complete the payment before submitting the sale.');
  }
}
