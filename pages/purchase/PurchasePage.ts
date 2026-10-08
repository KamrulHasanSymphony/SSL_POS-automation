import { Page, expect } from '@playwright/test';
import { BasePage } from '../common/BasePage';
import { KendoGrid } from '../../components/common-grid/KendoGrid';
import { KendoLineItemGrid } from '../../components/common-grid/KendoLineItemGrid';
import { KendoMultiColumnComboBox } from '../../components/kendo/KendoMultiColumnComboBox';
import { KendoDatePicker } from '../../components/kendo/KendoDatePicker';
import {
  routes,
  purchaseFormSelectors,
  gridContainerSelectors,
  transactionGridContainers,
} from '../../utils/constants';

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export interface PurchaseCreateData {
  supplierName: string;
  beNumber: string;
  productName: string;
  quantity: number;
}

/**
 * Areas/DMS/Controllers/PurchaseController.cs + Views/Purchase/Create.cshtml,
 * confirmed at STEP 6. Single #frmEntry form, Draft->Posted workflow via the
 * inherited BasePage.clickPost()/isAlreadyPosted(). Delete is confirmed NOT
 * reachable via the UI (server action exists, zero UI wiring) — no delete
 * method here, per the approved STEP 6 scope.
 */
export class PurchasePage extends BasePage {
  readonly grid: KendoGrid;
  readonly lineItems: KendoLineItemGrid;
  private readonly supplierCombo: KendoMultiColumnComboBox;
  private readonly invoiceDate: KendoDatePicker;
  private readonly purchaseDate: KendoDatePicker;

  constructor(page: Page) {
    super(page);
    this.grid = new KendoGrid(page, gridContainerSelectors.default);
    // INVENTORY-LIFECYCLE E2E FINDING: confirmed live (accessibility snapshot
    // of #saleOrderDetails's header row during createPurchase()'s
    // blank/manual flow — the first live exercise of this addLineItem()
    // path in this project) that this grid renders an "Sl No" column before
    // "Product Name", the same STEP 12/PurchaseOrder finding already fixed
    // on PurchaseOrderPage.ts but never applied here, since this page
    // object's own addLineItem() path had never been exercised until now
    // (createFromPurchaseOrder() never calls it — those line items are
    // pre-populated server-side). productCellIndex must be 1.
    this.lineItems = new KendoLineItemGrid(page, transactionGridContainers.shared, 'UnitPrice', 1);
    this.supplierCombo = new KendoMultiColumnComboBox(page, purchaseFormSelectors.supplierId);
    this.invoiceDate = new KendoDatePicker(page, 'InvoiceDateTime');
    this.purchaseDate = new KendoDatePicker(page, 'PurchaseDate');
  }

  async goto(): Promise<void> {
    await this.page.goto(routes.dms('Purchase', 'Index'));
    await this.grid.waitForLoad();
  }

  async gotoCreate(): Promise<void> {
    await this.page.goto(routes.dms('Purchase', 'Create'));
  }

  async selectSupplier(uniqueSupplierName: string): Promise<void> {
    await this.supplierCombo.typeAndSelectFirst(uniqueSupplierName);
  }

  /**
   * PERFORMANCE-STABILIZATION-LIFECYCLE addition — thin pass-through to
   * `KendoMultiColumnComboBox.typeAndSelectFirstTimed()` (itself additive,
   * see its own doc comment): `supplierCombo` is private, so this exposes
   * the sub-phase-timed variant the same way `selectSupplier()` above
   * already exposes the untimed one. `selectSupplier()` itself is
   * unchanged and unaffected.
   */
  async selectSupplierTimed(uniqueSupplierName: string): Promise<{ fillMs: number; renderMs: number; selectMs: number; totalMs: number }> {
    return this.supplierCombo.typeAndSelectFirstTimed(uniqueSupplierName);
  }

  /**
   * DATA-INTEGRITY-LIFECYCLE addition — true if `name` resolves to a real,
   * selectable option in the Supplier combo; false if nothing matches
   * (see `KendoComboBox.hasMatchingOption()`'s own doc comment for why
   * this is the real structural proof that an invalid/nonexistent
   * SupplierId can never be submitted through this screen).
   */
  async hasSelectableSupplier(name: string): Promise<boolean> {
    return this.supplierCombo.hasMatchingOption(name);
  }

  async fillBeNumber(beNumber: string): Promise<void> {
    await this.page.locator(purchaseFormSelectors.beNumber).fill(beNumber);
  }

  /** Both dates default to today, satisfying the confirmed cross-field rule PurchaseDate >= InvoiceDateTime. */
  async fillDates(isoDate: string = today()): Promise<void> {
    await this.invoiceDate.setDate(isoDate);
    await this.purchaseDate.setDate(isoDate);
  }

  /**
   * Returns the server-generated Code, the reliable identifier for later
   * search/edit lookups.
   *
   * INVENTORY-LIFECYCLE E2E FINDING: confirmed live (network trace — a
   * `POST /DMS/Purchase/CreateEdit` 200 response immediately followed, within
   * ~240ms, by subsequent asset requests already carrying
   * `Referer: /DMS/Purchase/Edit/{id}`) that this blank/manual-flow Save
   * performs a real client-side redirect to `/DMS/Purchase/Edit/{id}` — the
   * same toast-racing-a-navigation pattern already proven for
   * Supplier/Product, and DIFFERENT from this same module's
   * createFromPurchaseOrder() path (confirmed in-place update, no
   * navigation at all). This is the first live exercise of this specific
   * save path in the project; `toastr.expectSuccess()` was never actually
   * exercised against it before now. Uses the same fix already applied to
   * Supplier/Product instead of the toast.
   */
  async createPurchase(data: PurchaseCreateData): Promise<string> {
    await this.gotoCreate();
    await this.selectSupplier(data.supplierName);
    await this.fillBeNumber(data.beNumber);
    await this.fillDates();
    await this.lineItems.addLineItem(data.productName, data.quantity);
    await this.clickSave();
    await this.page.waitForURL(/\/DMS\/Purchase\/Edit/i);
    return this.getCode();
  }

  /**
   * "From Purchase Order" creation path — CONFIRMED mechanism
   * (PurchaseController.cs's FromPurchaseOrder()/GetFromPurchaseOrder(),
   * Areas/DMS/js/Controllers/FromPurchaseOrderController.js): a Kendo Grid
   * of existing Purchase Orders (`#GridDataList`, Kendo's native
   * `selectable: "multiple row"` with a first-column checkbox), a
   * client-side "same supplier" guard across multi-selected rows, then the
   * page-level `#btnSelect` button POSTs the selected id(s) to
   * `/DMS/Purchase/GetFromPurchaseOrder`, which lands on this same Create
   * view pre-populated (header + line items) from the selected Purchase
   * Order — `SelectData()`'s selection is read via Kendo's own
   * `grid.select()` API, whose standard multi-row-select interaction is a
   * plain row click (not a distinct checkbox-cell target) — confirmed from
   * the Kendo `selectable: "multiple row"` config, not independently
   * re-confirmed against a live render; verify on first real use and
   * correct here, not per-test, per this project's Live DOM Verification
   * Rule (same flagged-gap pattern PurchaseReturnPage.createFromPurchase()
   * already documents for its own, structurally different radio-select
   * picker).
   *
   * NOTE: there is no separate Goods Receive/GRN module anywhere in this
   * application (confirmed by exhaustive source search) — this "From
   * Purchase Order" picker is the real, only mechanism connecting a
   * Purchase Order to a Purchase.
   */
  async gotoFromPurchaseOrder(): Promise<void> {
    await this.page.goto(routes.dms('Purchase', 'FromPurchaseOrder'));
  }

  /**
   * Selects the given Purchase Order by its (unique) Code and converts it
   * into a pre-populated Purchase Create screen — stops short of Save so
   * callers can verify the carried-over header/line items first (e.g. the
   * Purchase-lifecycle E2E flow's "Verify Items loaded correctly" step).
   * `createFromPurchaseOrder()` below is the all-in-one convenience wrapper
   * for callers that don't need that intermediate inspection — both share
   * this one implementation rather than duplicating the row-select mechanic.
   *
   * PURCHASE-LIFECYCLE E2E LIVE RUNTIME FINDING: this picker's grid (also
   * `#GridDataList`, the same container `this.grid` already targets) has no
   * toolbar search box (confirmed live — only column filter icons and a
   * pager, same shape STEP 21/22 already confirmed for the product popup),
   * so a target row can be on any page, not just the first — uses
   * `this.grid.findRowAcrossPages()` rather than a single-page row lookup.
   *
   * SECOND LIVE RUNTIME FINDING: confirmed live (network trace — zero POST
   * requests to /DMS/Purchase/CreateEdit ever fire on Save) that this
   * blocks Save. Root cause traced precisely via source
   * (`Areas/Common/js/Services/CommonService.js`'s `validateDropdown()`,
   * invoked as `CommonService.validateDropdown("#SupplierId", "#titleError1",
   * "Supplier is required")` in this exact From-Purchase-Order save
   * handler): it synchronously reads `$("#SupplierId").val()` — the Kendo
   * combo's underlying hidden value, not its visible display text — and
   * blocks (with no toast, no confirm dialog, matching exactly what was
   * observed) if that's empty at the moment Save is clicked. The Kendo
   * MultiColumnComboBox widget needs its own dataSource (a further AJAX
   * call) to finish loading before it confirms/reflects the server-bound
   * Supplier selection in that hidden value — a pure timing gap, not a
   * stale-state problem. (An earlier fix attempt re-selected the Supplier
   * through the UI to force a re-validation; confirmed live that this had
   * an unintended side effect — it raced with and could wipe the
   * just-filled BE Number — so this only waits, it does not interact.)
   */
  async selectPurchaseOrderForConversion(purchaseOrderCode: string): Promise<void> {
    await this.gotoFromPurchaseOrder();
    await this.grid.waitForLoad();
    const row = await this.grid.findRowAcrossPages(purchaseOrderCode);
    await row.click();
    await this.page.locator('#btnSelect').click();
    await this.page.waitForURL(/\/DMS\/Purchase\/(Create|GetFromPurchaseOrder)/i);
    await expect(this.page.locator('#PurchaseOrderCode')).not.toHaveValue('', { timeout: 15000 });
    await expect(this.page.locator('#SupplierId')).not.toHaveValue('', { timeout: 15000 });
    // Confirmed live: BE Number, filled by a caller right after this method
    // returns, can still end up wiped — consistent with the Supplier combo's
    // own widget initialization continuing (further AJAX/render cycles)
    // after its value first appears, rather than settling atomically with
    // it. Wait for that to fully settle before returning control.
    await this.overlay.waitForIdle();
  }

  /**
   * Selects the given Purchase Order by its (unique) Code, converts it into
   * a Purchase, and saves. Header and line items are pre-populated from the
   * source Purchase Order by the server (confirmed —
   * PurchaseController.GetFromPurchaseOrder rehydrates the full
   * PurchaseVM/line-item list); only BE Number has no PurchaseOrder
   * equivalent field (confirmed — PurchaseOrderPage.ts's own doc comment)
   * and is therefore always filled fresh here, mirroring
   * PurchaseReturnPage.createFromPurchase()'s identical BE-Number handling.
   *
   * THIRD LIVE RUNTIME FINDING: same in-place-update race already confirmed
   * for PurchaseOrder/Supplier (see BasePage.waitForCode()'s doc comment) —
   * `#Code` can populate after the success toast resolves, not before —
   * polls for it instead of reading it immediately.
   */
  async createFromPurchaseOrder(purchaseOrderCode: string, beNumber: string): Promise<string> {
    await this.selectPurchaseOrderForConversion(purchaseOrderCode);
    await this.fillBeNumber(beNumber);
    await this.clickSave();
    return this.waitForCode();
  }

  /**
   * AUDIT-TRAIL-LIFECYCLE E2E FINDING (first live exercise of this method
   * with fresh data — every prior lifecycle spec only ever relied on
   * `createPurchase()`'s own direct landing on `/DMS/Purchase/Edit`, never
   * needing to re-navigate back via search+row-action): confirmed live
   * that `KendoGrid.clickRowAction()`'s role-based
   * `getByRole('button'/'link', { name: /edit/i })` never matches — same
   * already-confirmed "icon-only Edit link with no accessible name at all"
   * defect already found and fixed on ~10 other grids in this codebase
   * (MasterItemPage/CustomerGroupPage/ProductGroupPage/SupplierGroupPage/
   * CompanyProfilePage/RoleMenuPage/RolePage/IncomePage/ExpensePage/
   * CustomerAdvancePage/SalePage — see e.g. `SalePage.openEditFor()`'s own
   * identical doc comment), just never previously applied here since this
   * exact code path had never been exercised. Same fix, same convention:
   * click the `.edit` class directly instead of `clickRowAction()`.
   */
  async openEditFor(code: string): Promise<void> {
    await this.goto();
    await this.grid.search(code);
    const row = await this.grid.findRowByText(code);
    await row.locator('a.edit').click();
    await this.page.waitForURL(/\/DMS\/Purchase\/Edit/i);
  }

  async updateBeNumber(newBeNumber: string): Promise<void> {
    await this.fillBeNumber(newBeNumber);
    await this.clickUpdate();
    await this.toastr.expectSuccess();
  }

  async post(): Promise<void> {
    await this.clickPost();
  }

  async expectSupplierRequiredIndicated(): Promise<void> {
    await this.expectRequiredIndicatorVisible(purchaseFormSelectors.supplierDropdownError);
  }

  async expectBeNumberRequiredIndicated(): Promise<void> {
    await this.expectRequiredIndicatorVisible(purchaseFormSelectors.beNumberError);
  }

  /**
   * Confirmed (PurchaseController.js) that Purchase's Quantity cell editor
   * fires a live Toastr error for a negative value, unlike Sale/SaleOrder.
   */
  async expectNegativeQuantityRejected(row: import('@playwright/test').Locator): Promise<void> {
    await this.lineItems.setQuantity(row, -1);
    await this.toastr.expectError('Negative quantity is not allowed.');
  }
}
