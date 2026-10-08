import { Page } from '@playwright/test';
import { BasePage } from '../common/BasePage';
import { KendoGrid } from '../../components/common-grid/KendoGrid';
import { KendoMultiColumnComboBox } from '../../components/kendo/KendoMultiColumnComboBox';
import { routes, gridContainerSelectors, supplierProductFormSelectors } from '../../utils/constants';

export interface SupplierProductCreateData {
  supplierName: string;
  productGroupName: string;
}

/**
 * Areas/DMS/Controllers/SupplierProductController.cs +
 * Views/SupplierProduct/{Create,Index}.cshtml, confirmed at STEP 10.3B.
 * Standalone screen (NOT an embedded Supplier tab — see
 * supplierProductFormSelectors' doc comment). Structurally identical to
 * the already-implemented MasterSupplierItem (STEP 9.2C): item-picking is
 * a plain Kendo grid with an inline "Add" button, no popup. No `Code`
 * property on the VM — `SupplierName` is the identifying/search key.
 */
export class SupplierProductPage extends BasePage {
  readonly grid: KendoGrid;
  private readonly supplierCombo: KendoMultiColumnComboBox;
  private readonly productGroupCombo: KendoMultiColumnComboBox;

  constructor(page: Page) {
    super(page);
    this.grid = new KendoGrid(page, gridContainerSelectors.default);
    this.supplierCombo = new KendoMultiColumnComboBox(page, supplierProductFormSelectors.supplierId);
    this.productGroupCombo = new KendoMultiColumnComboBox(page, supplierProductFormSelectors.productGroupId);
  }

  async goto(): Promise<void> {
    await this.page.goto(routes.dms('SupplierProduct', 'Index'));
    await this.grid.waitForLoad();
  }

  async gotoCreate(): Promise<void> {
    await this.page.goto(routes.dms('SupplierProduct', 'Create'));
  }

  async selectSupplier(supplierName: string): Promise<void> {
    await this.supplierCombo.typeAndSelectFirst(supplierName);
  }

  /** Selecting the group loads `#departments` (filtered items list) — waits for its "Add" affordance to confirm the load completed. */
  async selectProductGroup(groupName: string): Promise<void> {
    await this.productGroupCombo.typeAndSelectFirst(groupName);
    await this.page.locator(`${supplierProductFormSelectors.departmentsGrid} .addToDetails`).first().waitFor({
      state: 'visible',
      timeout: 10000,
    });
  }

  async addFirstAvailableItem(): Promise<void> {
    await this.page.locator(`${supplierProductFormSelectors.departmentsGrid} .addToDetails`).first().click();
  }

  async createSupplierProduct(data: SupplierProductCreateData): Promise<void> {
    await this.gotoCreate();
    await this.selectSupplier(data.supplierName);
    await this.selectProductGroup(data.productGroupName);
    await this.addFirstAvailableItem();
    await this.clickSave();
    await this.toastr.expectSuccess();
  }

  /** Grid's Edit link carries `title="Edit Credit Limit"` — KendoGrid.clickRowAction()'s role-based matching applies normally here. */
  async openEditFor(supplierName: string): Promise<void> {
    await this.goto();
    await this.grid.search(supplierName);
    await this.grid.clickRowAction(supplierName, /edit/i);
    await this.page.waitForURL(/\/DMS\/SupplierProduct\/Edit/i);
  }

  async expectSupplierRequiredIndicated(): Promise<void> {
    await this.expectRequiredIndicatorVisible(supplierProductFormSelectors.supplierDropdownError);
  }
}
