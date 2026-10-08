import { Page, expect } from '@playwright/test';
import { BasePage } from '../common/BasePage';
import { KendoGrid } from '../../components/common-grid/KendoGrid';
import { routes, gridContainerSelectors, bankAccountFormSelectors, bankInformationValidationMessages } from '../../utils/constants';

/**
 * Areas/DMS/Controllers/BankInformationController.cs +
 * Views/BankInformation/Create.cshtml, confirmed at STEP 7. Delete is
 * confirmed NOT SUPPORTED: no controller action exists at all (the JS/repo
 * wiring targets a route that was never implemented), and the button is
 * also commented out — no delete method here, per the approved STEP 7
 * scope.
 */
export class BankInformationPage extends BasePage {
  readonly grid: KendoGrid;

  constructor(page: Page) {
    super(page);
    this.grid = new KendoGrid(page, gridContainerSelectors.default);
  }

  async goto(): Promise<void> {
    await this.page.goto(routes.dms('BankInformation', 'Index'));
    await this.grid.waitForLoad();
  }

  async gotoCreate(): Promise<void> {
    await this.page.goto(routes.dms('BankInformation', 'Create'));
  }

  async fillName(name: string): Promise<void> {
    await this.page.locator(bankAccountFormSelectors.bankInformation.name).fill(name);
  }

  async fillTelephone(telephoneNo: string): Promise<void> {
    await this.page.locator(bankAccountFormSelectors.bankInformation.telephoneNo).fill(telephoneNo);
  }

  async createBankInformation(data: { name: string; telephoneNo: string }): Promise<string> {
    await this.gotoCreate();
    await this.fillName(data.name);
    await this.fillTelephone(data.telephoneNo);
    await this.clickSave();
    await this.toastr.expectSuccess();
    return this.getCode();
  }

  async openEditFor(code: string): Promise<void> {
    await this.goto();
    await this.grid.search(code);
    await this.grid.clickRowAction(code, /edit/i);
    await this.page.waitForURL(/\/DMS\/BankInformation\/Edit/i);
  }

  async updateName(newName: string): Promise<void> {
    await this.fillName(newName);
    await this.clickUpdate();
    await this.toastr.expectSuccess();
  }

  async expectNameRequiredValidation(): Promise<void> {
    await expect(this.page.locator(bankAccountFormSelectors.bankInformation.nameValidationMessage)).toHaveText(
      bankInformationValidationMessages.nameRequired
    );
  }

  async expectTelephoneRequiredValidation(): Promise<void> {
    await expect(this.page.locator(bankAccountFormSelectors.bankInformation.telephoneValidationMessage)).toHaveText(
      bankInformationValidationMessages.telephoneRequired
    );
  }
}
