import { Page, expect } from '@playwright/test';
import { BasePage } from '../common/BasePage';
import { KendoGrid } from '../../components/common-grid/KendoGrid';
import { KendoLineItemGrid } from '../../components/common-grid/KendoLineItemGrid';
import { KendoMultiColumnComboBox } from '../../components/kendo/KendoMultiColumnComboBox';
import { KendoDatePicker } from '../../components/kendo/KendoDatePicker';
import {
  routes,
  purchaseOrderFormSelectors,
  purchaseOrderValidationMessages,
  gridContainerSelectors,
  transactionGridContainers,
} from '../../utils/constants';

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export interface PurchaseOrderCreateData {
  supplierName: string;
  productName: string;
  quantity: number;
}

/**
 * Areas/DMS/Controllers/PurchaseOrderController.cs +
 * Views/PurchaseOrder/Create.cshtml, confirmed at STEP 6. No BE-Number
 * equivalent field exists on this module (unlike Purchase/PurchaseReturn).
 * Delete: confirmed NO controller action exists at all (stronger absence
 * than Purchase's orphaned action) — no delete method here.
 *
 * PURCHASE-LIFECYCLE E2E LIVE RUNTIME FINDING: confirmed live (accessibility
 * snapshot of `#saleOrderDetails`'s header row) that this grid renders an
 * "Sl No" column before "Product Name" — the same STEP 12 finding
 * previously confirmed only for SaleOrder ("do not assume this extends to
 * the other five modules without their own live evidence" — now confirmed
 * live for PurchaseOrder too). `productCellIndex` must be 1, matching
 * SaleOrderPage.ts's own constructor.
 */
export class PurchaseOrderPage extends BasePage {
  readonly grid: KendoGrid;
  readonly lineItems: KendoLineItemGrid;
  private readonly supplierCombo: KendoMultiColumnComboBox;
  private readonly orderDate: KendoDatePicker;
  private readonly deliveryDate: KendoDatePicker;

  constructor(page: Page) {
    super(page);
    this.grid = new KendoGrid(page, gridContainerSelectors.default);
    this.lineItems = new KendoLineItemGrid(page, transactionGridContainers.shared, 'UnitPrice', 1);
    this.supplierCombo = new KendoMultiColumnComboBox(page, purchaseOrderFormSelectors.supplierId);
    this.orderDate = new KendoDatePicker(page, 'OrderDate');
    this.deliveryDate = new KendoDatePicker(page, 'DeliveryDateTime');
  }

  async goto(): Promise<void> {
    await this.page.goto(routes.dms('PurchaseOrder', 'Index'));
    await this.grid.waitForLoad();
  }

  async gotoCreate(): Promise<void> {
    await this.page.goto(routes.dms('PurchaseOrder', 'Create'));
  }

  async selectSupplier(uniqueSupplierName: string): Promise<void> {
    await this.supplierCombo.typeAndSelectFirst(uniqueSupplierName);
  }

  /** Both default to today, satisfying the confirmed cross-field rule DeliveryDateTime >= OrderDate. */
  async fillDates(isoDate: string = today()): Promise<void> {
    await this.orderDate.setDate(isoDate);
    await this.deliveryDate.setDate(isoDate);
  }

  /**
   * PURCHASE-LIFECYCLE E2E LIVE RUNTIME FINDING: confirmed live (accessibility
   * snapshot right after Save — heading unchanged, Save button already
   * relabeled "Update", `#Code` already populated, no navigation/URL change
   * at all) that this module's post-save transition is an in-place update,
   * not a redirect — the same race BasePage.waitForCode()'s doc comment
   * documents. Uses that instead of the toast.
   */
  async createPurchaseOrder(data: PurchaseOrderCreateData): Promise<string> {
    await this.gotoCreate();
    await this.selectSupplier(data.supplierName);
    await this.fillDates();
    await this.lineItems.addLineItem(data.productName, data.quantity);
    await this.clickSave();
    return this.waitForCode();
  }

  async openEditFor(code: string): Promise<void> {
    await this.goto();
    await this.grid.search(code);
    await this.grid.clickRowAction(code, /edit/i);
    await this.page.waitForURL(/\/DMS\/PurchaseOrder\/Edit/i);
  }

  async post(): Promise<void> {
    await this.clickPost();
  }

  async expectSupplierRequiredIndicated(): Promise<void> {
    await this.expectRequiredIndicatorVisible(purchaseOrderFormSelectors.supplierDropdownError);
  }

  async expectOrderDateRequiredValidation(): Promise<void> {
    await expect(this.page.locator(purchaseOrderFormSelectors.orderDateValidationMessage)).toHaveText(
      purchaseOrderValidationMessages.orderDateRequired
    );
  }
}
