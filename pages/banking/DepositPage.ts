import { Page, expect } from '@playwright/test';
import { BasePage } from '../common/BasePage';
import { KendoGrid } from '../../components/common-grid/KendoGrid';
import { KendoMultiColumnComboBox } from '../../components/kendo/KendoMultiColumnComboBox';
import { KendoDatePicker } from '../../components/kendo/KendoDatePicker';
import { routes, depositFormSelectors, depositValidationMessages, gridContainerSelectors } from '../../utils/constants';

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export interface DepositCreateData {
  fromBankAccountName: string;
  toBankAccountName: string;
  amount: number;
}

/**
 * Areas/DMS/Controllers/DepositController.cs + Views/Deposit/Create.cshtml,
 * confirmed at STEP 7. Flat single-record form — NO embedded line-item
 * grid, NO working Post/Draft workflow (confirmed dead code; not exercised
 * here per the approved scope). Delete is confirmed NOT SUPPORTED: action
 * exists, button commented out — no delete method here.
 */
export class DepositPage extends BasePage {
  readonly grid: KendoGrid;
  private readonly fromCombo: KendoMultiColumnComboBox;
  private readonly toCombo: KendoMultiColumnComboBox;
  private readonly transactionDate: KendoDatePicker;
  private readonly chequeDate: KendoDatePicker;

  constructor(page: Page) {
    super(page);
    this.grid = new KendoGrid(page, gridContainerSelectors.default);
    this.fromCombo = new KendoMultiColumnComboBox(page, depositFormSelectors.fromBankAccountId);
    this.toCombo = new KendoMultiColumnComboBox(page, depositFormSelectors.toBankAccountId);
    this.transactionDate = new KendoDatePicker(page, 'TransactionDate');
    this.chequeDate = new KendoDatePicker(page, 'ChequeDate');
  }

  async goto(): Promise<void> {
    await this.page.goto(routes.dms('Deposit', 'Index'));
    await this.grid.waitForLoad();
  }

  async gotoCreate(): Promise<void> {
    await this.page.goto(routes.dms('Deposit', 'Create'));
  }

  async selectFromBankAccount(uniqueName: string): Promise<void> {
    await this.fromCombo.typeAndSelectFirst(uniqueName);
  }

  async selectToBankAccount(uniqueName: string): Promise<void> {
    await this.toCombo.typeAndSelectFirst(uniqueName);
  }

  async fillDates(isoDate: string = today()): Promise<void> {
    await this.transactionDate.setDate(isoDate);
    await this.chequeDate.setDate(isoDate);
  }

  async fillAmount(amount: number): Promise<void> {
    await this.page.locator(depositFormSelectors.totalAmount).fill(String(amount));
  }

  async createDeposit(data: DepositCreateData): Promise<string> {
    await this.gotoCreate();
    await this.selectFromBankAccount(data.fromBankAccountName);
    await this.selectToBankAccount(data.toBankAccountName);
    await this.fillDates();
    await this.fillAmount(data.amount);
    await this.clickSave();
    await this.toastr.expectSuccess();
    return this.getCode();
  }

  async openEditFor(code: string): Promise<void> {
    await this.goto();
    await this.grid.search(code);
    await this.grid.clickRowAction(code, /edit/i);
    await this.page.waitForURL(/\/DMS\/Deposit\/Edit/i);
  }

  async updateAmount(newAmount: number): Promise<void> {
    await this.fillAmount(newAmount);
    await this.clickUpdate();
    await this.toastr.expectSuccess();
  }

  async expectFromBankAccountRequiredIndicated(): Promise<void> {
    await this.expectRequiredIndicatorVisible(depositFormSelectors.bankAccountErrorFrom);
  }

  async expectTransactionDateRequiredValidation(): Promise<void> {
    await expect(this.page.locator(depositFormSelectors.transactionDateValidationMessage)).toHaveText(
      depositValidationMessages.transactionDateRequired
    );
  }
}
