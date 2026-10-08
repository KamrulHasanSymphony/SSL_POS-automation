import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from '../common/BasePage';
import { KendoGrid } from '../../components/common-grid/KendoGrid';
import { KendoDatePicker } from '../../components/kendo/KendoDatePicker';
import { routes, gridContainerSelectors, expenseFormSelectors, expenseValidationMessages } from '../../utils/constants';

export interface ExpenseCreateData {
  /** Unique Name of an existing, active Expense-type IncomeExpenseCategory (STEP 9.2A prerequisite, reused). */
  categoryName: string;
  amount: number;
}

/**
 * Areas/DMS/Controllers/ExpenseController.cs + Views/Expense/Create.cshtml +
 * ExpenseController.js, confirmed at STEP 9.2C to be a near-exact
 * structural mirror of Income (see IncomePage.ts / expenseFormSelectors'
 * doc comment for the full shared source trail — Post workflow, form
 * locking, detail-grid picker mechanism). Only difference relevant to this
 * phase: no Cash/Bank fields, and container id `#expenseDetails` instead of
 * `#incomeDetails`. Delete is confirmed NOT SUPPORTED here either.
 */
export class ExpensePage extends BasePage {
  readonly grid: KendoGrid;
  private readonly transactionDate: KendoDatePicker;

  constructor(page: Page) {
    super(page);
    this.grid = new KendoGrid(page, gridContainerSelectors.default);
    this.transactionDate = new KendoDatePicker(page, 'TransactionDate');
  }

  async goto(): Promise<void> {
    await this.page.goto(routes.dms('Expense', 'Index'));
    await this.page.locator('#Branchs').waitFor({ state: 'attached' });
    await expect.poll(async () => (await this.page.locator('#Branchs').inputValue()) !== '', { timeout: 15000 }).toBe(true);
    await this.page.locator('#indexSearch').click();
    await this.grid.waitForLoad();
  }

  async gotoCreate(): Promise<void> {
    await this.page.goto(routes.dms('Expense', 'Create'));
  }

  async clearTransactionDate(): Promise<void> {
    await this.transactionDate.setDate('');
  }

  private async pickCategoryForRow(row: Locator, categoryName: string): Promise<void> {
    const categoryCell = row.locator('td').nth(1);
    await categoryCell.click();
    await categoryCell.locator('button').click();

    const modal = this.page.locator(expenseFormSelectors.categoryModal);
    await modal.waitFor({ state: 'visible' });
    const table = this.page.locator(expenseFormSelectors.categoryTable);
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

  async addDetailLine(categoryName: string, amount: number): Promise<void> {
    const container = this.page.locator(expenseFormSelectors.detailsContainer);
    const rowsBefore = await container.locator('table tbody tr').count();
    await container.getByRole('button', { name: 'Add' }).click();
    await expect.poll(() => container.locator('table tbody tr').count()).toBeGreaterThan(rowsBefore);
    const row = container.locator('table tbody tr').last();
    await this.pickCategoryForRow(row, categoryName);
    await this.setAmountForRow(row, amount);
  }

  async createExpense(data: ExpenseCreateData): Promise<string> {
    await this.gotoCreate();
    await this.addDetailLine(data.categoryName, data.amount);
    await this.clickSave();
    await this.toastr.expectSuccess();
    await this.page.waitForURL(/\/DMS\/Expense\/Edit/i);
    return this.getCode();
  }

  async openEditFor(code: string): Promise<void> {
    await this.goto();
    await this.grid.search(code);
    const row = await this.grid.findRowByText(code);
    await row.locator('a.edit').click();
    await this.page.waitForURL(/\/DMS\/Expense\/Edit/i);
  }

  async updateComments(comments: string): Promise<void> {
    await this.page.locator(expenseFormSelectors.comments).fill(comments);
    await this.clickUpdate();
    await this.toastr.expectSuccess();
  }

  async getComments(): Promise<string> {
    return (await this.page.locator(expenseFormSelectors.comments).inputValue()) ?? '';
  }

  async post(): Promise<void> {
    await this.clickPost();
  }

  async expectTransactionDateRequiredValidation(): Promise<void> {
    await expect(this.page.locator(expenseFormSelectors.transactionDateValidationMessage)).toHaveText(
      expenseValidationMessages.transactionDateRequired
    );
  }
}
