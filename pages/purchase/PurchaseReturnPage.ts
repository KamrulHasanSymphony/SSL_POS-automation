import { Page, expect } from '@playwright/test';
import { BasePage } from '../common/BasePage';
import { KendoGrid } from '../../components/common-grid/KendoGrid';
import { KendoLineItemGrid } from '../../components/common-grid/KendoLineItemGrid';
import { KendoMultiColumnComboBox } from '../../components/kendo/KendoMultiColumnComboBox';
import { KendoDatePicker } from '../../components/kendo/KendoDatePicker';
import {
  routes,
  purchaseReturnFormSelectors,
  gridContainerSelectors,
  transactionGridContainers,
} from '../../utils/constants';

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export interface PurchaseReturnCreateData {
  supplierName: string;
  beNumber: string;
  productName: string;
  quantity: number;
}

/**
 * Areas/DMS/Controllers/PurchaseReturnController.cs +
 * Views/PurchaseReturn/Create.cshtml, confirmed at STEP 6. Two confirmed,
 * independently valid creation paths: blank (`Create()`, no reference) and
 * "From Purchase" (`FromPurchase()`/`GetFromPurchase()`, a full Kendo Grid
 * of existing Purchases with a radio-button Select column). Delete is
 * confirmed unreachable via the UI — stricter than most modules, no
 * `.btnDelete` markup exists anywhere, not even commented out — no delete
 * method here. Return-quantity-vs-purchased-quantity validation was
 * confirmed NOT to exist anywhere in the UI layer, so no such assertion is
 * made by this page object (see STEP 6.1 proposal §P for why that scenario
 * was deliberately not proposed).
 *
 * PURCHASE-RETURN-LIFECYCLE E2E CORRECTION (first live exercise of
 * `createFromPurchase()`): the line above previously claimed "no
 * return-detail pre-population guarantee" — disproven live. `GetFromPurchase`
 * DOES pre-populate `#saleOrderDetails` with one row per source Purchase
 * line item (correct ProductId/ProductName/UnitPrice carried over), with
 * `Quantity` defaulted to `0` — the user is expected to edit that quantity
 * to the amount being returned, not add a new row. `createFromPurchase()`
 * below edits the existing pre-populated row via `setQuantity()`
 * accordingly; see its own doc comment for the full live evidence
 * (`PurchaseReturnController.js`'s `.btnsave` handler rejects any row with
 * `Quantity <= 0` before the confirm dialog even appears).
 */
export class PurchaseReturnPage extends BasePage {
  readonly grid: KendoGrid;
  readonly lineItems: KendoLineItemGrid;
  private readonly supplierCombo: KendoMultiColumnComboBox;
  private readonly invoiceDate: KendoDatePicker;
  private readonly purchaseDate: KendoDatePicker;

  constructor(page: Page) {
    super(page);
    this.grid = new KendoGrid(page, gridContainerSelectors.default);
    // PURCHASE-RETURN-LIFECYCLE E2E FINDING (first live exercise of
    // lineItems.addLineItem() on this page): confirmed live — same
    // "Sl No" column before "Product Name" shape already fixed on
    // PurchasePage.ts/PurchaseOrderPage.ts/SaleOrderPage.ts (all sharing
    // this identical `#saleOrderDetails` grid) but never applied here,
    // since this exact code path had never been exercised until now.
    // productCellIndex must be 1, not the default 0.
    this.lineItems = new KendoLineItemGrid(page, transactionGridContainers.shared, 'UnitPrice', 1);
    this.supplierCombo = new KendoMultiColumnComboBox(page, purchaseReturnFormSelectors.supplierId);
    this.invoiceDate = new KendoDatePicker(page, 'InvoiceDateTime');
    this.purchaseDate = new KendoDatePicker(page, 'PurchaseDate');
  }

  async goto(): Promise<void> {
    await this.page.goto(routes.dms('PurchaseReturn', 'Index'));
    await this.grid.waitForLoad();
  }

  async gotoCreate(): Promise<void> {
    await this.page.goto(routes.dms('PurchaseReturn', 'Create'));
  }

  async selectSupplier(uniqueSupplierName: string): Promise<void> {
    await this.supplierCombo.typeAndSelectFirst(uniqueSupplierName);
  }

  async fillBeNumber(beNumber: string): Promise<void> {
    await this.page.locator(purchaseReturnFormSelectors.beNumber).fill(beNumber);
  }

  async fillDates(isoDate: string = today()): Promise<void> {
    await this.invoiceDate.setDate(isoDate);
    await this.purchaseDate.setDate(isoDate);
  }

  /**
   * Blank/manual creation path — no Purchase reference.
   *
   * FULL-REGRESSION-RUN FIX (confirmed automation defect): previously used
   * `clickSave()` + `toastr.expectSuccess()` + `getCode()` — confirmed live
   * (first real exercise of this specific path against a live UI) to fail
   * with a `Toastr.expectSuccess()` timeout, the exact same "toast races
   * navigation" race this file's own `createFromPurchase()` below already
   * documents and fixes via `waitForSaveSuccess()` for the OTHER creation
   * path, just never applied here. Same fix, same convention.
   */
  async createPurchaseReturn(data: PurchaseReturnCreateData): Promise<string> {
    await this.gotoCreate();
    await this.selectSupplier(data.supplierName);
    await this.fillBeNumber(data.beNumber);
    await this.fillDates();
    await this.lineItems.addLineItem(data.productName, data.quantity);
    await this.clickSave();
    return this.waitForSaveSuccess();
  }

  /**
   * "From Purchase" creation path — confirmed mechanism (PurchaseReturnController.cs
   * FromPurchase()/GetFromPurchase(), FromPurchaseController.js): a full Kendo
   * Grid of existing Purchases with a radio-button "Select" column, chosen via
   * the page-level #btnSelect button, which POSTs the selection and lands on
   * the same Create view pre-populated from the selected Purchase.
   */
  async gotoFromPurchase(): Promise<void> {
    await this.page.goto(routes.dms('PurchaseReturn', 'FromPurchase'));
  }

  async createFromPurchase(purchaseCode: string, productName: string, quantity: number): Promise<string> {
    await this.gotoFromPurchase();
    // PURCHASE-RETURN-LIFECYCLE E2E FINDING: confirmed live that the row
    // can pass `waitFor({state:'visible'})` and still be clicked mid an
    // early, not-yet-settled Kendo grid render/rebind cycle — a click that
    // registers `checked=true` in that instant can be silently lost once
    // Kendo's own subsequent rebind pass replaces the row's DOM nodes,
    // leaving `#btnSelect`'s own `$("#GridDataList .row-radio:checked")`
    // check empty ("Please select a row!") despite the click having
    // "succeeded" moments earlier. `this.grid.waitForLoad()` (same
    // `#GridDataList` container, already proven for this exact settle-race
    // elsewhere — e.g. PurchaseOrderPage.selectPurchaseOrderForConversion())
    // waits for the grid's own load/idle signal before any interaction.
    await this.grid.waitForLoad();
    // PURCHASE-RETURN-LIFECYCLE E2E FINDING (first live exercise of this
    // exact interaction — resolves the class doc comment's own flagged LIVE
    // DOM VERIFICATION GAP): confirmed from source
    // (FromPurchaseController.js: `$('#btnSelect').on('click', ...)` reads
    // `$("#GridDataList .row-radio:checked")` — scoped to `#GridDataList`
    // specifically, confirmed as this page's real, single grid container,
    // `Views/PurchaseReturn/FromPurchase.cshtml:39`) that the unscoped `tr`
    // lookup previously here could resolve to a row outside that grid
    // entirely, leaving the app's own selection check unable to find a
    // checked radio inside `#GridDataList` even after a click — confirmed
    // live: `#btnSelect` showed "Please select a row!" despite the radio's
    // own `checked` DOM property already being `true`. Scoped here to match
    // exactly what the click handler itself queries.
    const row = this.page.locator('#GridDataList tr', { hasText: purchaseCode }).first();
    await row.waitFor({ state: 'visible', timeout: 15000 });
    // Confirmed live that `.check()` fails with "Clicking the checkbox did
    // not change its state" even though the radio is a real, enabled,
    // non-disabled native `<input type="radio">` (confirmed via
    // `isDisabled()` — false) — Playwright's own actionability retries kept
    // getting intercepted by this grid's `.loadingoverlay` mid-click. A
    // direct, forced click on the radio itself (bypassing Playwright's own
    // pre-click stability wait, already independently confirmed
    // unnecessary here since the element is a real, enabled, non-covered
    // control) reliably flips its checked state where `.check()` did not,
    // and correctly fires the `change` event `FromPurchaseController.js`'s
    // own delegated handler (`$("#GridDataList").on("change", ".row-radio", ...)`)
    // listens for.
    await row.locator('.row-radio').click({ force: true });
    await this.page.locator('#btnSelect').click();
    await this.page.waitForURL(/\/DMS\/PurchaseReturn\/(Create|GetFromPurchase)/i);

    // PURCHASE-RETURN-LIFECYCLE E2E FINDING: confirmed live — without this
    // wait, Save silently fails validation (`PurchaseReturnController.js`'s
    // `save()`: `if (parseInt(model.SupplierId) == 0 ...) { ShowNotification(3,
    // "Supplier Required."); return; }`) even though the Supplier is
    // visibly pre-filled, because the Kendo MultiColumnComboBox widget
    // needs its own further dataSource/render cycle to finish before its
    // underlying `#SupplierId` hidden value actually reflects the
    // server-bound selection — the exact same confirmed timing gap
    // PurchasePage.selectPurchaseOrderForConversion() already guards
    // against for its own, structurally identical "From X" pre-populated
    // page. `toastr.expectSuccess()`'s generic check then silently accepted
    // that "Supplier Required." toast as success, handing back `#Code`
    // still showing the SOURCE Purchase's own code (pre-filled for
    // display, confirmed live) rather than a genuine new Return code.
    await expect(this.page.locator(`#${purchaseReturnFormSelectors.supplierId}`)).not.toHaveValue('', {
      timeout: 15000,
    });
    await this.overlay.waitForIdle();

    // PURCHASE-RETURN-LIFECYCLE E2E FINDING: Header (Supplier/dates) AND
    // the line item(s) are both pre-filled from the source Purchase — see
    // class doc comment's own correction. Confirmed live (grid dataItems
    // dump): `#saleOrderDetails` already contains one row per source
    // Purchase line item with the correct Product/UnitPrice carried over
    // and `Quantity` defaulted to `0`. Calling `addLineItem()` here (the
    // original implementation) added a SECOND, duplicate row instead,
    // leaving the pre-populated row's `Quantity` at `0` — which
    // `PurchaseReturnController.js`'s `.btnsave` handler rejects
    // ("Quantity must be greater than zero.") before the confirm dialog
    // ever appears, well before the actual `/DMS/PurchaseReturn/CreateEdit`
    // POST could fire. Edits the existing pre-populated row's quantity
    // instead of adding a new one.
    await this.fillBeNumber(`${purchaseCode}_RET`);
    const returnRow = this.lineItems.rows().filter({ hasText: productName }).first();
    await this.lineItems.setQuantity(returnRow, quantity);
    await this.clickSave();
    return this.waitForSaveSuccess();
  }

  /**
   * See `createFromPurchase()`'s own doc comment for the live evidence this
   * is built on — mirrors SalePage.waitForSaveSuccess()/
   * SaleOrderPage.waitForSaveSuccess() exactly: confirmed from source
   * (`PurchaseReturnController.js`'s `saveDone()`) that a genuine successful
   * save does `window.location.href = "/DMS/PurchaseReturn/Edit/" + id` — a
   * full navigation — which correctly distinguishes a real save from a
   * silently-blocked one, unlike the generic no-argument toast check.
   */
  async waitForSaveSuccess(): Promise<string> {
    await this.page.waitForURL(/\/DMS\/PurchaseReturn\/Edit/i, { timeout: 15000 });
    return this.waitForCode();
  }

  async openEditFor(code: string): Promise<void> {
    await this.goto();
    await this.grid.search(code);
    await this.grid.clickRowAction(code, /edit/i);
    await this.page.waitForURL(/\/DMS\/PurchaseReturn\/Edit/i);
  }

  async post(): Promise<void> {
    await this.clickPost();
  }
}
