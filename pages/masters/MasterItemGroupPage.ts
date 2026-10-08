import { Page, expect } from '@playwright/test';
import { BasePage } from '../common/BasePage';
import { KendoGrid } from '../../components/common-grid/KendoGrid';
import { routes, gridContainerSelectors, masterItemGroupFormSelectors, masterItemGroupValidationMessages } from '../../utils/constants';

/**
 * Areas/DMS/Controllers/MasterItemGroupController.cs +
 * Views/MasterItemGroup/Create.cshtml, confirmed at STEP 9.2A. Flat lookup
 * master, no dependencies — confirmed the "clean" module of the Master
 * catalog family (no material defects found). Delete is confirmed NOT
 * SUPPORTED: action exists, button commented out — no delete method here.
 */
export class MasterItemGroupPage extends BasePage {
  readonly grid: KendoGrid;

  constructor(page: Page) {
    super(page);
    this.grid = new KendoGrid(page, gridContainerSelectors.default);
  }

  async goto(): Promise<void> {
    await this.page.goto(routes.dms('MasterItemGroup', 'Index'));
    await this.grid.waitForLoad();
  }

  async gotoCreate(): Promise<void> {
    await this.page.goto(routes.dms('MasterItemGroup', 'Create'));
  }

  async fillName(name: string): Promise<void> {
    await this.page.locator(masterItemGroupFormSelectors.name).fill(name);
  }

  async createMasterItemGroup(name: string): Promise<string> {
    await this.gotoCreate();
    await this.fillName(name);
    await this.clickSave();
    await this.toastr.expectSuccess();
    return this.getCode();
  }

  async openEditFor(code: string): Promise<void> {
    await this.goto();
    await this.grid.search(code);
    await this.grid.clickRowAction(code, /edit/i);
    await this.page.waitForURL(/\/DMS\/MasterItemGroup\/Edit/i);
  }

  async updateName(newName: string): Promise<void> {
    await this.fillName(newName);
    await this.clickUpdate();
    await this.toastr.expectSuccess();
  }

  async expectNameRequiredValidation(): Promise<void> {
    await expect(this.page.locator(masterItemGroupFormSelectors.nameValidationMessage)).toHaveText(
      masterItemGroupValidationMessages.nameRequired
    );
  }
}
