import { Page, expect } from '@playwright/test';
import { BasePage } from '../common/BasePage';
import { KendoGrid } from '../../components/common-grid/KendoGrid';
import { KendoMultiColumnComboBox } from '../../components/kendo/KendoMultiColumnComboBox';
import { routes, gridContainerSelectors, masterSupplierFormSelectors, masterSupplierValidationMessages } from '../../utils/constants';

export interface MasterSupplierCreateData {
  name: string;
  /** Unique Name of an already-created MasterSupplierGroup (STEP 9.2A prerequisite). */
  masterSupplierGroupName: string;
  address: string;
}

/**
 * Areas/DMS/Controllers/MasterSupplierController.cs +
 * Views/MasterSupplier/Create.cshtml, confirmed at STEP 9.2A. Requires an
 * existing MasterSupplierGroup. Confirmed structurally separate from the
 * already-covered Supplier module (STEP 5) — its own parallel catalog.
 * CONFIRMED: `MasterSupplierGroupId`'s required-field span (`#titleError1`)
 * has NO id collision on this page (unlike the Purchase/Collection
 * `#titleError1`/`#titleError2` reuse pattern found elsewhere). Delete is
 * confirmed NOT SUPPORTED: action exists, button commented out.
 */
export class MasterSupplierPage extends BasePage {
  readonly grid: KendoGrid;
  private readonly groupCombo: KendoMultiColumnComboBox;

  constructor(page: Page) {
    super(page);
    this.grid = new KendoGrid(page, gridContainerSelectors.default);
    this.groupCombo = new KendoMultiColumnComboBox(page, masterSupplierFormSelectors.masterSupplierGroupId);
  }

  async goto(): Promise<void> {
    await this.page.goto(routes.dms('MasterSupplier', 'Index'));
    await this.grid.waitForLoad();
  }

  async gotoCreate(): Promise<void> {
    await this.page.goto(routes.dms('MasterSupplier', 'Create'));
  }

  async fillName(name: string): Promise<void> {
    await this.page.locator(masterSupplierFormSelectors.name).fill(name);
  }

  async selectMasterSupplierGroup(uniqueGroupName: string): Promise<void> {
    await this.groupCombo.typeAndSelectFirst(uniqueGroupName);
  }

  async fillAddress(address: string): Promise<void> {
    await this.page.locator(masterSupplierFormSelectors.address).fill(address);
  }

  async createMasterSupplier(data: MasterSupplierCreateData): Promise<string> {
    await this.gotoCreate();
    await this.fillName(data.name);
    await this.selectMasterSupplierGroup(data.masterSupplierGroupName);
    await this.fillAddress(data.address);
    await this.clickSave();
    await this.toastr.expectSuccess();
    return this.getCode();
  }

  async openEditFor(code: string): Promise<void> {
    await this.goto();
    await this.grid.search(code);
    await this.grid.clickRowAction(code, /edit/i);
    await this.page.waitForURL(/\/DMS\/MasterSupplier\/Edit/i);
  }

  async updateName(newName: string): Promise<void> {
    await this.fillName(newName);
    await this.clickUpdate();
    await this.toastr.expectSuccess();
  }

  async expectNameRequiredValidation(): Promise<void> {
    await expect(this.page.locator(masterSupplierFormSelectors.nameValidationMessage)).toHaveText(
      masterSupplierValidationMessages.nameRequired
    );
  }

  async expectAddressRequiredValidation(): Promise<void> {
    await expect(this.page.locator(masterSupplierFormSelectors.addressValidationMessage)).toHaveText(
      masterSupplierValidationMessages.addressRequired
    );
  }
}
