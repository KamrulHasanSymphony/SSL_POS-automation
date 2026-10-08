import { Page, expect } from '@playwright/test';
import { BasePage } from '../common/BasePage';
import { KendoGrid } from '../../components/common-grid/KendoGrid';
import { KendoMultiColumnComboBox } from '../../components/kendo/KendoMultiColumnComboBox';
import {
  routes,
  gridContainerSelectors,
  masterSupplierItemFormSelectors,
  masterSupplierItemMessages,
} from '../../utils/constants';

export interface MasterSupplierItemCreateData {
  /** Unique Name of an existing, active MasterSupplier (reused STEP 9.2A prerequisite chain). */
  supplierName: string;
  /** Unique Name of an existing, active MasterItemGroup containing at least one MasterItem (reused STEP 9.2A/9.2C prerequisites). */
  masterItemGroupName: string;
}

/**
 * Areas/DMS/Controllers/MasterSupplierItemController.cs +
 * Views/MasterSupplierItem/Create.cshtml + MasterSupplierItemController.js,
 * confirmed at STEP 9.2C. See masterSupplierItemFormSelectors' doc comment
 * (utils/constants.ts) for the full source trail: item-picking is a plain
 * Kendo grid (`#departments`) with an inline "Add" button per row — no
 * popup/window; `MasterSupplierItemVM` has no `Code` property (only `Id`),
 * so `MasterSupplierName` (the grid's own confirmed search field) is used
 * as the per-test unique identifier instead. `saveDone()` shows a
 * hard-coded "Save Successfully" toastr regardless of the server's own
 * message. Delete is confirmed NOT SUPPORTED: button commented out on
 * Index.
 */
export class MasterSupplierItemPage extends BasePage {
  readonly grid: KendoGrid;
  private readonly supplierCombo: KendoMultiColumnComboBox;
  private readonly masterItemGroupCombo: KendoMultiColumnComboBox;

  constructor(page: Page) {
    super(page);
    this.grid = new KendoGrid(page, gridContainerSelectors.default);
    this.supplierCombo = new KendoMultiColumnComboBox(page, masterSupplierItemFormSelectors.masterSupplierId);
    this.masterItemGroupCombo = new KendoMultiColumnComboBox(page, masterSupplierItemFormSelectors.masterItemGroupId);
  }

  async goto(): Promise<void> {
    await this.page.goto(routes.dms('MasterSupplierItem', 'Index'));
    await this.grid.waitForLoad();
  }

  async gotoCreate(): Promise<void> {
    await this.page.goto(routes.dms('MasterSupplierItem', 'Create'));
  }

  async selectSupplier(supplierName: string): Promise<void> {
    await this.supplierCombo.typeAndSelectFirst(supplierName);
  }

  /** Selecting the group loads `#departments` (filtered items list) — waits for its "Add" affordance to confirm the load completed. */
  async selectMasterItemGroup(groupName: string): Promise<void> {
    await this.masterItemGroupCombo.typeAndSelectFirst(groupName);
    await this.page.locator(`${masterSupplierItemFormSelectors.departmentsGrid} .addToDetails`).first().waitFor({
      state: 'visible',
      timeout: 10000,
    });
  }

  /** Clicks the inline "Add" button of the (only) item row in the currently-loaded, group-filtered `#departments` grid. */
  async addFirstAvailableItem(): Promise<void> {
    await this.page.locator(`${masterSupplierItemFormSelectors.departmentsGrid} .addToDetails`).first().click();
  }

  async createMasterSupplierItem(data: MasterSupplierItemCreateData): Promise<string> {
    await this.gotoCreate();
    await this.selectSupplier(data.supplierName);
    await this.selectMasterItemGroup(data.masterItemGroupName);
    await this.addFirstAvailableItem();
    await this.clickSave();
    await this.toastr.expectSuccess(masterSupplierItemMessages.saveSuccess);
    return this.page.locator('#Id').inputValue();
  }

  /** Grid's Edit link carries `title="Edit Credit Limit"` — KendoGrid.clickRowAction()'s role-based matching applies normally here. */
  async openEditFor(supplierName: string): Promise<void> {
    await this.goto();
    await this.grid.search(supplierName);
    await this.grid.clickRowAction(supplierName, /edit/i);
    await this.page.waitForURL(/\/DMS\/MasterSupplierItem\/Edit/i);
  }

  async expectAddedItemVisible(itemName: string): Promise<void> {
    await expect(
      this.page.locator(masterSupplierItemFormSelectors.addedItemGrid).locator('table tbody tr').filter({ hasText: itemName })
    ).toHaveCount(1);
  }

  async expectSupplierRequiredIndicated(): Promise<void> {
    await this.expectRequiredIndicatorVisible(masterSupplierItemFormSelectors.masterSupplierDropdownError);
  }
}
