import { Page, expect } from '@playwright/test';
import { BasePage } from '../common/BasePage';
import { KendoGrid } from '../../components/common-grid/KendoGrid';
import { routes, gridContainerSelectors, businessTypeFormSelectors, businessTypeValidationMessages } from '../../utils/constants';

/**
 * Areas/DMS/Controllers/BusinessTypeController .cs (note space in filename)
 * + Views/BusinessType/Create.cshtml, confirmed at STEP 9.2A. Flat lookup
 * master, no dependencies. Delete is confirmed NOT SUPPORTED via UI: action
 * exists, `.btnDelete` commented out in Index.cshtml — no delete method here.
 */
export class BusinessTypePage extends BasePage {
  readonly grid: KendoGrid;

  constructor(page: Page) {
    super(page);
    this.grid = new KendoGrid(page, gridContainerSelectors.default);
  }

  async goto(): Promise<void> {
    await this.page.goto(routes.dms('BusinessType', 'Index'));
    await this.grid.waitForLoad();
  }

  async gotoCreate(): Promise<void> {
    await this.page.goto(routes.dms('BusinessType', 'Create'));
  }

  async fillName(name: string): Promise<void> {
    await this.page.locator(businessTypeFormSelectors.name).fill(name);
  }

  async createBusinessType(name: string): Promise<string> {
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
    await this.page.waitForURL(/\/DMS\/BusinessType\/Edit/i);
  }

  async updateName(newName: string): Promise<void> {
    await this.fillName(newName);
    await this.clickUpdate();
    await this.toastr.expectSuccess();
  }

  async expectNameRequiredValidation(): Promise<void> {
    await expect(this.page.locator(businessTypeFormSelectors.nameValidationMessage)).toHaveText(
      businessTypeValidationMessages.nameRequired
    );
  }
}
