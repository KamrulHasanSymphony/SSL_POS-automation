import { Page } from '@playwright/test';
import { BasePage } from '../common/BasePage';
import { KendoGrid } from '../../components/common-grid/KendoGrid';
import { routes, gridContainerSelectors, incomeExpenseCategoryModalSelectors, incomeExpenseCategoryMessages } from '../../utils/constants';

export type IncomeExpenseCategoryType = 'Income' | 'Expense';

/**
 * Areas/DMS/Controllers/IncomeExpenseCategoryController.cs +
 * Views/IncomeExpenseCategory/Index.cshtml, confirmed at STEP 9.2A.
 * UNLIKE every other module in this project so far, this is a
 * single-page grid + Bootstrap modal (`#categoryModal`) — there is no
 * separate Create.cshtml, and the SAME modal is reused for both Create
 * and Edit. `Type` is a plain `<select>` (value "1"=Income, "2"=Expense),
 * not a Kendo combo. CONFIRMED: no inline validation spans exist for
 * Name/Type at all — the only visible signal on an empty submission is a
 * Toastr error with exact JS-literal text (not a VM ErrorMessage, since
 * neither field has a custom one).
 *
 * CONFIRMED id/class overlap risk: the page's `#btnNew` toolbar button
 * ALSO carries the shared `.btnsave.sslSave` classes BasePage.clickSave()
 * targets — using that shared method here would be ambiguous (2 matches:
 * `#btnNew` and the modal's `#btnSave`). This page object deliberately
 * uses the id-scoped `#btnSave` selector instead of BasePage.clickSave().
 * Delete is confirmed NOT SUPPORTED: action exists, `id="btnDelete"`
 * button is commented out in Index.cshtml.
 */
export class IncomeExpenseCategoryPage extends BasePage {
  readonly grid: KendoGrid;

  constructor(page: Page) {
    super(page);
    this.grid = new KendoGrid(page, gridContainerSelectors.default);
  }

  async goto(): Promise<void> {
    await this.page.goto(routes.dms('IncomeExpenseCategory', 'Index'));
    await this.grid.waitForLoad();
  }

  async openCreateModal(): Promise<void> {
    await this.goto();
    await this.page.locator(incomeExpenseCategoryModalSelectors.newButton).click();
    await this.page.locator(incomeExpenseCategoryModalSelectors.modal).waitFor({ state: 'visible' });
  }

  async fillName(name: string): Promise<void> {
    await this.page.locator(incomeExpenseCategoryModalSelectors.name).fill(name);
  }

  async selectType(type: IncomeExpenseCategoryType): Promise<void> {
    const value = type === 'Income' ? '1' : '2';
    await this.page.locator(incomeExpenseCategoryModalSelectors.type).selectOption(value);
  }

  /** Clicks the modal-scoped #btnSave — not BasePage.clickSave(), see class doc comment. */
  async clickModalSave(): Promise<void> {
    await this.page.locator(incomeExpenseCategoryModalSelectors.saveButton).click();
    await this.confirmDialog.acceptIfPresent();
    await this.overlay.waitForIdle();
  }

  async createCategory(name: string, type: IncomeExpenseCategoryType): Promise<void> {
    await this.openCreateModal();
    await this.fillName(name);
    await this.selectType(type);
    await this.clickModalSave();
    await this.toastr.expectSuccess();
  }

  async openEditFor(name: string): Promise<void> {
    await this.goto();
    await this.grid.search(name);
    const row = await this.grid.findRowByText(name);
    await row.locator('.editRow').click();
    await this.page.locator(incomeExpenseCategoryModalSelectors.modal).waitFor({ state: 'visible' });
  }

  async updateName(newName: string): Promise<void> {
    await this.fillName(newName);
    await this.clickModalSave();
    await this.toastr.expectSuccess();
  }

  async expectNameRequiredError(): Promise<void> {
    await this.toastr.expectError(incomeExpenseCategoryMessages.nameRequired);
  }

  async expectTypeRequiredError(): Promise<void> {
    await this.toastr.expectError(incomeExpenseCategoryMessages.typeRequired);
  }
}
