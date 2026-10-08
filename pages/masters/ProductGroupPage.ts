import { Page, expect } from '@playwright/test';
import { BasePage } from '../common/BasePage';
import { KendoGrid } from '../../components/common-grid/KendoGrid';
import { routes, gridContainerSelectors, productGroupFormSelectors, productGroupValidationMessages } from '../../utils/constants';

/**
 * Areas/DMS/Controllers/ProductGroupController.cs +
 * Views/ProductGroup/Create.cshtml, confirmed at STEP 10.3A. Flat lookup
 * master, no dependencies. CONFIRMED genuinely distinct from
 * `MasterItemGroupController` (already covered, STEP 9.2A) — separate
 * controller/VM/repo, not an alias. Delete is confirmed NOT SUPPORTED:
 * action exists, button commented out — no delete method here.
 */
export class ProductGroupPage extends BasePage {
  readonly grid: KendoGrid;

  constructor(page: Page) {
    super(page);
    this.grid = new KendoGrid(page, gridContainerSelectors.default);
  }

  async goto(): Promise<void> {
    await this.page.goto(routes.dms('ProductGroup', 'Index'));
    await this.grid.waitForLoad();
  }

  async gotoCreate(): Promise<void> {
    await this.page.goto(routes.dms('ProductGroup', 'Create'));
  }

  async fillName(name: string): Promise<void> {
    await this.page.locator(productGroupFormSelectors.name).fill(name);
  }

  async createProductGroup(name: string): Promise<string> {
    await this.gotoCreate();
    await this.fillName(name);
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
    await this.page.waitForURL(/\/DMS\/ProductGroup\/Edit/i);
  }

  async updateName(newName: string): Promise<void> {
    await this.fillName(newName);
    await this.clickUpdate();
    await this.toastr.expectSuccess();
  }

  async expectNameRequiredValidation(): Promise<void> {
    await expect(this.page.locator(productGroupFormSelectors.nameValidationMessage)).toHaveText(
      productGroupValidationMessages.nameRequired
    );
  }
}
