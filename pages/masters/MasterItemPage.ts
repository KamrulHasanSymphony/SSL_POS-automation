import { Page, expect } from '@playwright/test';
import { BasePage } from '../common/BasePage';
import { KendoGrid } from '../../components/common-grid/KendoGrid';
import { KendoMultiColumnComboBox } from '../../components/kendo/KendoMultiColumnComboBox';
import { routes, gridContainerSelectors, masterItemFormSelectors, masterItemValidationMessages } from '../../utils/constants';

export interface MasterItemCreateData {
  name: string;
  /** Unique Name of an existing, active MasterItemGroup (STEP 9.2A prerequisite, reused). */
  masterItemGroupName: string;
  /** Unique Name of an API-created, active UOM (STEP 5 prerequisite helper, reused). */
  uomName: string;
}

/**
 * Areas/DMS/Controllers/MasterItemController.cs + Views/MasterItem/Create.cshtml
 * + MasterItemController.js, confirmed at STEP 9.2C. Same shape as
 * Product (STEP 5): `MasterItemGroupId`/`UOMId` are plain `<input>`
 * elements progressively enhanced into Kendo MultiColumnComboBox, reading
 * confirmed-existing (not broken like Areas') endpoints. See
 * masterItemFormSelectors' doc comment (utils/constants.ts) for the full
 * source trail — including why openEditFor() clicks `a.edit` directly
 * instead of using KendoGrid.clickRowAction() (icon-only link, no
 * accessible name). Delete is confirmed NOT SUPPORTED: button commented
 * out on Index.
 */
export class MasterItemPage extends BasePage {
  readonly grid: KendoGrid;
  private readonly masterItemGroupCombo: KendoMultiColumnComboBox;
  private readonly uomCombo: KendoMultiColumnComboBox;

  constructor(page: Page) {
    super(page);
    this.grid = new KendoGrid(page, gridContainerSelectors.default);
    this.masterItemGroupCombo = new KendoMultiColumnComboBox(page, masterItemFormSelectors.masterItemGroupId);
    this.uomCombo = new KendoMultiColumnComboBox(page, masterItemFormSelectors.uomId);
  }

  async goto(): Promise<void> {
    await this.page.goto(routes.dms('MasterItem', 'Index'));
    await this.grid.waitForLoad();
  }

  async gotoCreate(): Promise<void> {
    await this.page.goto(routes.dms('MasterItem', 'Create'));
  }

  async fillName(name: string): Promise<void> {
    await this.page.locator(masterItemFormSelectors.name).fill(name);
  }

  async selectMasterItemGroup(uniqueGroupName: string): Promise<void> {
    await this.masterItemGroupCombo.typeAndSelectFirst(uniqueGroupName);
  }

  async selectUom(uniqueUomName: string): Promise<void> {
    await this.uomCombo.typeAndSelectFirst(uniqueUomName);
  }

  async fillRequired(data: MasterItemCreateData): Promise<void> {
    await this.fillName(data.name);
    await this.selectMasterItemGroup(data.masterItemGroupName);
    await this.selectUom(data.uomName);
  }

  async createMasterItem(data: MasterItemCreateData): Promise<string> {
    await this.gotoCreate();
    await this.fillRequired(data);
    await this.clickSave();
    await this.toastr.expectSuccess();
    return this.getCode();
  }

  /** Grid's Edit action is an icon-only link with no accessible name — clicks the `.edit` class directly instead of KendoGrid.clickRowAction(). */
  async openEditFor(code: string): Promise<void> {
    await this.goto();
    await this.grid.search(code);
    const row = await this.grid.findRowByText(code);
    await row.locator('a.edit').click();
    await this.page.waitForURL(/\/DMS\/MasterItem\/Edit/i);
  }

  async updateName(newName: string): Promise<void> {
    await this.fillName(newName);
    await this.clickUpdate();
    await this.toastr.expectSuccess();
  }

  async expectNameRequiredValidation(): Promise<void> {
    await expect(this.page.locator(masterItemFormSelectors.nameValidationMessage)).toHaveText(
      masterItemValidationMessages.nameRequired
    );
  }
}
