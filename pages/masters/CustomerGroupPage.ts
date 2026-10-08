import { Page, expect } from '@playwright/test';
import { BasePage } from '../common/BasePage';
import { KendoGrid } from '../../components/common-grid/KendoGrid';
import { routes, gridContainerSelectors, customerGroupFormSelectors, customerGroupValidationMessages } from '../../utils/constants';

/**
 * Areas/DMS/Controllers/CustomerGroupController.cs +
 * Views/CustomerGroup/Create.cshtml, confirmed at STEP 10.3A. Flat lookup
 * master, no dependencies. Genuinely distinct from `Customer` itself
 * (separate controller/route). Delete is confirmed NOT SUPPORTED: action
 * exists, button commented out — no delete method here.
 */
export class CustomerGroupPage extends BasePage {
  readonly grid: KendoGrid;

  constructor(page: Page) {
    super(page);
    this.grid = new KendoGrid(page, gridContainerSelectors.default);
  }

  async goto(): Promise<void> {
    await this.page.goto(routes.dms('CustomerGroup', 'Index'));
    await this.grid.waitForLoad();
  }

  async gotoCreate(): Promise<void> {
    await this.page.goto(routes.dms('CustomerGroup', 'Create'));
  }

  async fillName(name: string): Promise<void> {
    await this.page.locator(customerGroupFormSelectors.name).fill(name);
  }

  async createCustomerGroup(name: string): Promise<string> {
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
    await this.page.waitForURL(/\/DMS\/CustomerGroup\/Edit/i);
  }

  async updateName(newName: string): Promise<void> {
    await this.fillName(newName);
    await this.clickUpdate();
    await this.toastr.expectSuccess();
  }

  async expectNameRequiredValidation(): Promise<void> {
    await expect(this.page.locator(customerGroupFormSelectors.nameValidationMessage)).toHaveText(
      customerGroupValidationMessages.nameRequired
    );
  }
}
