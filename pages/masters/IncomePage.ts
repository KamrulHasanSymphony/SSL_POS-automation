import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from '../common/BasePage';
import { KendoGrid } from '../../components/common-grid/KendoGrid';
import { KendoDatePicker } from '../../components/kendo/KendoDatePicker';
import { routes, gridContainerSelectors, incomeFormSelectors, incomeValidationMessages } from '../../utils/constants';

export interface IncomeCreateData {
  /** Unique Name of an existing, active Income-type IncomeExpenseCategory (STEP 9.2A prerequisite, reused). */
  categoryName: string;
  amount: number;
}

/**
 * Areas/DMS/Controllers/IncomeController.cs + Views/Income/Create.cshtml +
 * IncomeController.js, confirmed at STEP 9.2C. See incomeFormSelectors'
 * doc comment (utils/constants.ts) for the full source trail: real,
 * working Post workflow (distinct from the dead Collection/Payment/Deposit/
 * Withdrawal Post buttons); form-locking only observable after a reload;
 * detail-line Category picker is a Bootstrap modal + DataTables, not the
 * Kendo-Window-based KendoLineItemGrid. Delete is confirmed NOT SUPPORTED:
 * no Delete UI action wired on Index (button commented out pattern absent
 * entirely — grid has no delete affordance).
 */
export class IncomePage extends BasePage {
  readonly grid: KendoGrid;
  private readonly transactionDate: KendoDatePicker;

  constructor(page: Page) {
    super(page);
    this.grid = new KendoGrid(page, gridContainerSelectors.default);
    this.transactionDate = new KendoDatePicker(page, 'TransactionDate');
  }

  async goto(): Promise<void> {
    await this.page.goto(routes.dms('Income', 'Index'));
    await this.page.locator('#Branchs').waitFor({ state: 'attached' });
    await expect.poll(async () => (await this.page.locator('#Branchs').inputValue()) !== '', { timeout: 15000 }).toBe(true);
    await this.page.locator('#indexSearch').click();
    await this.grid.waitForLoad();
  }

  async gotoCreate(): Promise<void> {
    await this.page.goto(routes.dms('Income', 'Create'));
  }

  async clearTransactionDate(): Promise<void> {
    await this.transactionDate.setDate('');
  }

  /** Opens the Bootstrap category-picker modal for the given detail row and double-clicks the matching category. */
  private async pickCategoryForRow(row: Locator, categoryName: string): Promise<void> {
    const categoryCell = row.locator('td').nth(1);
    await categoryCell.click();
    await categoryCell.locator('button').click();

    const modal = this.page.locator(incomeFormSelectors.categoryModal);
    await modal.waitFor({ state: 'visible' });
    const table = this.page.locator(incomeFormSelectors.categoryTable);
    const matchRow = table.locator('tbody tr').filter({ hasText: categoryName }).first();
    await matchRow.waitFor({ state: 'visible', timeout: 10000 });
    await matchRow.dblclick();
    await modal.waitFor({ state: 'hidden' });
  }

  private async setAmountForRow(row: Locator, amount: number): Promise<void> {
    const amountCell = row.locator('td').nth(3);
    await amountCell.click();
    const input = row.locator('input[name="Amount"]');
    await input.fill(String(amount));
    await input.press('Tab');
  }

  /** Adds one Category+Amount detail line via the Kendo incell grid's "Add" toolbar button. */
  async addDetailLine(categoryName: string, amount: number): Promise<void> {
    const container = this.page.locator(incomeFormSelectors.detailsContainer);
    const rowsBefore = await container.locator('table tbody tr').count();
    await container.getByRole('button', { name: 'Add' }).click();
    await expect.poll(() => container.locator('table tbody tr').count()).toBeGreaterThan(rowsBefore);
    const row = container.locator('table tbody tr').last();
    await this.pickCategoryForRow(row, categoryName);
    await this.setAmountForRow(row, amount);
  }

  async createIncome(data: IncomeCreateData): Promise<string> {
    await this.gotoCreate();
    await this.addDetailLine(data.categoryName, data.amount);
    await this.clickSave();
    await this.toastr.expectSuccess();
    await this.page.waitForURL(/\/DMS\/Income\/Edit/i);
    return this.getCode();
  }

  /** Grid's Edit action is an icon-only link with no accessible name — clicks the `.edit` class directly instead of KendoGrid.clickRowAction(). */
  async openEditFor(code: string): Promise<void> {
    await this.goto();
    await this.grid.search(code);
    const row = await this.grid.findRowByText(code);
    await row.locator('a.edit').click();
    await this.page.waitForURL(/\/DMS\/Income\/Edit/i);
  }

  async updateComments(comments: string): Promise<void> {
    await this.page.locator(incomeFormSelectors.comments).fill(comments);
    await this.clickUpdate();
    await this.toastr.expectSuccess();
  }

  async getComments(): Promise<string> {
    return (await this.page.locator(incomeFormSelectors.comments).inputValue()) ?? '';
  }

  async post(): Promise<void> {
    await this.clickPost();
  }

  async expectTransactionDateRequiredValidation(): Promise<void> {
    await expect(this.page.locator(incomeFormSelectors.transactionDateValidationMessage)).toHaveText(
      incomeValidationMessages.transactionDateRequired
    );
  }
}
