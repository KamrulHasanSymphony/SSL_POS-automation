import { Page, expect } from '@playwright/test';
import { BasePage } from '../common/BasePage';
import { KendoGrid } from '../../components/common-grid/KendoGrid';
import { routes, gridContainerSelectors, paymentTypeFormSelectors, paymentTypeValidationMessages } from '../../utils/constants';

/**
 * Areas/DMS/Controllers/PaymentTypeController.cs +
 * Views/PaymentType/Create.cshtml, confirmed at STEP 9.2A. Flat lookup
 * master, no dependencies. CONFIRMED: unlike ~20+ other modules in this
 * app, PaymentType has NO `#Code` field at all — `Name` (generated unique
 * per test) is used as the identifier for search/edit/delete lookup.
 * CONFIRMED: this is one of only two modules found so far (with Areas)
 * whose grid Delete button is genuinely LIVE (not commented out), with an
 * explicit Kendo checkbox-selection column.
 */
export class PaymentTypePage extends BasePage {
  readonly grid: KendoGrid;

  constructor(page: Page) {
    super(page);
    this.grid = new KendoGrid(page, gridContainerSelectors.default);
  }

  async goto(): Promise<void> {
    await this.page.goto(routes.dms('PaymentType', 'Index'));
    await this.grid.waitForLoad();
  }

  async gotoCreate(): Promise<void> {
    await this.page.goto(routes.dms('PaymentType', 'Create'));
  }

  async fillName(name: string): Promise<void> {
    await this.page.locator(paymentTypeFormSelectors.name).fill(name);
  }

  async createPaymentType(name: string): Promise<void> {
    await this.gotoCreate();
    await this.fillName(name);
    await this.clickSave();
    await this.toastr.expectSuccess();
  }

  async openEditFor(name: string): Promise<void> {
    await this.goto();
    await this.grid.search(name);
    await this.grid.clickRowAction(name, /edit/i);
    await this.page.waitForURL(/\/DMS\/PaymentType\/Edit/i);
  }

  async updateName(newName: string): Promise<void> {
    await this.fillName(newName);
    await this.clickUpdate();
    await this.toastr.expectSuccess();
  }

  /** Confirmed live Delete: select the row's checkbox, click the grid toolbar's .btnDelete, accept the confirm dialog. */
  async deleteByName(name: string): Promise<void> {
    await this.goto();
    await this.grid.search(name);
    const row = await this.grid.findRowByText(name);
    await row.locator('input[type="checkbox"]').first().check();
    await this.page.locator('.btnDelete').click();
    await this.confirmDialog.accept();
    await this.toastr.expectSuccess();
  }

  async expectNameRequiredValidation(): Promise<void> {
    await expect(this.page.locator(paymentTypeFormSelectors.nameValidationMessage)).toHaveText(
      paymentTypeValidationMessages.nameRequired
    );
  }
}
