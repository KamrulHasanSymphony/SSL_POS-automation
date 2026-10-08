import { Page } from '@playwright/test';
import { BasePage } from '../common/BasePage';
import { KendoGrid } from '../../components/common-grid/KendoGrid';
import { KendoMultiColumnComboBox } from '../../components/kendo/KendoMultiColumnComboBox';
import { routes, gridContainerSelectors, bankAccountFormSelectors } from '../../utils/constants';

export interface BankAccountCreateData {
  accountNo: string;
  accountName: string;
  bankName: string;
  branchName: string;
}

/**
 * Areas/DMS/Controllers/BankAccountController.cs +
 * Views/BankAccount/Create.cshtml, confirmed at STEP 7. CONFIRMED: unlike
 * every other module in this app, BankAccount has NO `#Code` field —
 * `AccountName` (generated unique per test) is used as the identifier for
 * grid search/edit lookup instead of BasePage.getCode(). Delete is
 * confirmed NOT SUPPORTED: the controller action exists but has a real bug
 * (the selected row IDs are never assigned before the delete call), and the
 * button is also commented out — no delete method here.
 */
export class BankAccountPage extends BasePage {
  readonly grid: KendoGrid;
  private readonly bankCombo: KendoMultiColumnComboBox;

  constructor(page: Page) {
    super(page);
    this.grid = new KendoGrid(page, gridContainerSelectors.default);
    this.bankCombo = new KendoMultiColumnComboBox(page, bankAccountFormSelectors.bankAccount.bankId);
  }

  async goto(): Promise<void> {
    await this.page.goto(routes.dms('BankAccount', 'Index'));
    await this.grid.waitForLoad();
  }

  async gotoCreate(): Promise<void> {
    await this.page.goto(routes.dms('BankAccount', 'Create'));
  }

  async selectBank(uniqueBankName: string): Promise<void> {
    await this.bankCombo.typeAndSelectFirst(uniqueBankName);
  }

  async createBankAccount(data: BankAccountCreateData): Promise<string> {
    await this.gotoCreate();
    await this.page.locator(bankAccountFormSelectors.bankAccount.accountNo).fill(data.accountNo);
    await this.page.locator(bankAccountFormSelectors.bankAccount.accountName).fill(data.accountName);
    await this.selectBank(data.bankName);
    await this.page.locator(bankAccountFormSelectors.bankAccount.branchName).fill(data.branchName);
    await this.clickSave();
    await this.toastr.expectSuccess();
    return data.accountName;
  }
}
