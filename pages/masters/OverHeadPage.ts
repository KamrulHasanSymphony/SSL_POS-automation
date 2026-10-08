import { Page, expect } from '@playwright/test';
import { BasePage } from '../common/BasePage';
import { KendoGrid } from '../../components/common-grid/KendoGrid';
import { routes, gridContainerSelectors, overHeadFormSelectors, overHeadValidationMessages } from '../../utils/constants';

/**
 * Areas/DMS/Controllers/OverHeadController.cs + Views/OverHead/Create.cshtml,
 * confirmed at STEP 9.2A. Flat lookup master, no dependencies. Unlike most
 * modules in this app, `CreateEdit` DOES check `ModelState.IsValid`, so the
 * confirmed exact required-field message is genuinely server-enforced.
 * Delete is confirmed NOT SUPPORTED: no server action exists at all (the
 * button is also commented out) — no delete method here.
 */
export class OverHeadPage extends BasePage {
  readonly grid: KendoGrid;

  constructor(page: Page) {
    super(page);
    this.grid = new KendoGrid(page, gridContainerSelectors.default);
  }

  async goto(): Promise<void> {
    await this.page.goto(routes.dms('OverHead', 'Index'));
    await this.grid.waitForLoad();
  }

  async gotoCreate(): Promise<void> {
    await this.page.goto(routes.dms('OverHead', 'Create'));
  }

  async fillOverHead(name: string): Promise<void> {
    await this.page.locator(overHeadFormSelectors.overHead).fill(name);
  }

  async createOverHead(name: string): Promise<string> {
    await this.gotoCreate();
    await this.fillOverHead(name);
    await this.clickSave();
    await this.toastr.expectSuccess();
    return this.getCode();
  }

  async openEditFor(code: string): Promise<void> {
    await this.goto();
    await this.grid.search(code);
    await this.grid.clickRowAction(code, /edit/i);
    await this.page.waitForURL(/\/DMS\/OverHead\/Edit/i);
  }

  async updateOverHead(newName: string): Promise<void> {
    await this.fillOverHead(newName);
    await this.clickUpdate();
    await this.toastr.expectSuccess();
  }

  async expectOverHeadRequiredValidation(): Promise<void> {
    await expect(this.page.locator(overHeadFormSelectors.overHeadValidationMessage)).toHaveText(
      overHeadValidationMessages.overHeadRequired
    );
  }
}
