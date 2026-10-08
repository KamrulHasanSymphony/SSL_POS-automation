import { Page, expect } from '@playwright/test';
import { BasePage } from '../common/BasePage';
import { KendoGrid } from '../../components/common-grid/KendoGrid';
import { KendoLineItemGrid } from '../../components/common-grid/KendoLineItemGrid';
import { KendoMultiColumnComboBox } from '../../components/kendo/KendoMultiColumnComboBox';
import { KendoDatePicker } from '../../components/kendo/KendoDatePicker';
import {
  routes,
  saleOrderFormSelectors,
  saleOrderValidationMessages,
  gridContainerSelectors,
  transactionGridContainers,
} from '../../utils/constants';

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export interface SaleOrderCreateData {
  customerName: string;
  productName: string;
  quantity: number;
}

/**
 * Areas/DMS/Controllers/SaleOrderController.cs +
 * Views/SaleOrder/Create.cshtml, confirmed at STEP 6.
 *
 * ⚠️ CONFIRMED HIGH-RISK APPLICATION DEFECT (do not work around): source
 * shows `SaleOrderController.js`'s save() posts to `/POS/SaleOrder/CreateEdit`
 * — no `Areas/POS` exists anywhere in this codebase, so the real route is
 * `/DMS/SaleOrder/CreateEdit`. If this is genuinely broken in the deployed
 * app, createSaleOrder() below will legitimately fail (e.g. toastr.expectSuccess()
 * timing out, or a 404 surfacing some other way) — that is real, confirmed
 * evidence of an Application Defect, and must be reported as such. Do NOT
 * change this page object to call a different URL directly to make the test
 * pass; the test must exercise the real UI exactly as a user would.
 *
 * Delete is confirmed to exist server-side with zero UI wiring — no delete
 * method here.
 */
export class SaleOrderPage extends BasePage {
  readonly grid: KendoGrid;
  readonly lineItems: KendoLineItemGrid;
  private readonly customerCombo: KendoMultiColumnComboBox;
  private readonly orderDate: KendoDatePicker;
  private readonly deliveryDate: KendoDatePicker;

  constructor(page: Page) {
    super(page);
    this.grid = new KendoGrid(page, gridContainerSelectors.default);
    // STEP 12 LIVE EXECUTION FINDING: confirmed live — this grid's Product
    // Name column is the SECOND cell (index 1), not the first; "Sl No"
    // occupies index 0. See KendoLineItemGrid.ts's own doc comment for the
    // full evidence — not assumed to apply to the other five modules.
    this.lineItems = new KendoLineItemGrid(page, transactionGridContainers.shared, 'UnitRate', 1);
    this.customerCombo = new KendoMultiColumnComboBox(page, saleOrderFormSelectors.customerId);
    this.orderDate = new KendoDatePicker(page, 'OrderDate');
    this.deliveryDate = new KendoDatePicker(page, 'DeliveryDate');
  }

  async goto(): Promise<void> {
    await this.page.goto(routes.dms('SaleOrder', 'Index'));
    await this.grid.waitForLoad();
  }

  async gotoCreate(): Promise<void> {
    await this.page.goto(routes.dms('SaleOrder', 'Create'));
  }

  async selectCustomer(uniqueCustomerName: string): Promise<void> {
    await this.customerCombo.typeAndSelectFirst(uniqueCustomerName);
  }

  async fillDates(isoDate: string = today()): Promise<void> {
    await this.orderDate.setDate(isoDate);
    await this.deliveryDate.setDate(isoDate);
  }

  /**
   * SALEORDER-SAVE-VERIFICATION-FIX E2E FINDING: confirmed live (network
   * trace) that the class doc comment's own flagged risk is real —
   * `SaleOrderController.js`'s `save()` posts to `/POS/SaleOrder/CreateEdit`,
   * which 404s ("The resource cannot be found.") since no `/POS` Area
   * exists anywhere in this codebase (confirmed: only Common/DMS/SetUp).
   * The previous `toastr.expectSuccess()` — called with no expected-text
   * argument, so it accepts ANY visible toast — was a false positive here:
   * the actually-displayed toast is the generic AJAX-failure text "Query
   * Exception!" (SaleOrderController.js's `saveFail()`), not a real
   * success, and `getCode()` afterward then read an `#Code` that was never
   * populated, silently handing callers an empty string two steps before
   * the real failure surfaced. Also confirmed directly from source
   * (`saveDone()`) that a REAL successful save does
   * `window.location.href = "/DMS/SaleOrder/Edit/" + id` — a full
   * navigation, identical to Sale's own confirmed pattern — so
   * `waitForSaveSuccess()` below waits for that instead: a
   * failure-distinguishing signal that either resolves on a genuine save,
   * or throws a clear, immediately-diagnosable timeout right here instead
   * of proceeding with an empty code. Per this class's own doc comment,
   * this deliberately does NOT change the client-side POST URL to work
   * around the defect — a `/POS/SaleOrder/CreateEdit` 404 is a confirmed,
   * real Application Defect and must keep surfacing as one.
   */
  async waitForSaveSuccess(): Promise<string> {
    await this.page.waitForURL(/\/DMS\/SaleOrder\/Edit/i, { timeout: 15000 });
    return this.waitForCode();
  }

  async createSaleOrder(data: SaleOrderCreateData): Promise<string> {
    await this.gotoCreate();
    await this.selectCustomer(data.customerName);
    await this.fillDates();
    await this.lineItems.addLineItem(data.productName, data.quantity);
    await this.clickSave();
    return this.waitForSaveSuccess();
  }

  async openEditFor(code: string): Promise<void> {
    await this.goto();
    await this.grid.search(code);
    await this.grid.clickRowAction(code, /edit/i);
    await this.page.waitForURL(/\/DMS\/SaleOrder\/Edit/i);
  }

  async post(): Promise<void> {
    await this.clickPost();
  }

  async expectCustomerRequiredIndicated(): Promise<void> {
    await this.expectRequiredIndicatorVisible(saleOrderFormSelectors.customerDropdownError);
  }

  async expectOrderDateRequiredValidation(): Promise<void> {
    await expect(this.page.locator(saleOrderFormSelectors.orderDateValidationMessage)).toHaveText(
      saleOrderValidationMessages.orderDateRequired
    );
  }
}
