import { Page } from '@playwright/test';
import { BasePage } from './BasePage';
import { KendoMultiColumnComboBox } from '../../components/kendo/KendoMultiColumnComboBox';
import { routes, bankAccountFormSelectors } from '../../utils/constants';
import { uniqueCode, randomData } from '../../utils/random-data';

/**
 * STEP 6 prerequisite-only helper (API Setup Rule) — creates a BankInformation
 * (Bank master) record then a BankAccount referencing it, via the real UI,
 * for Sale's mandatory payment step (Sale's `#cardDetails` grid's
 * CreditCardId dropdown is sourced from `/Common/Common/GetBankAccountList`,
 * confirmed CompanyId-scoped with no fallback — Sale creation is blocked
 * without at least one BankAccount for the authenticated session's company).
 *
 * Confirmed via source (STEP 6): `POST api/BankAccount/Insert` exists and is
 * `[Authorize]`-protected, but its API-side ViewModel carries NO [Required]
 * annotations (unlike the UI-side ViewModel), so the API's true mandatory-
 * field contract isn't independently confirmable — and no BankInformation
 * API insert endpoint was confirmed at all. Per the API Setup Rule ("do not
 * invent API endpoints/payloads"), this prerequisite is created through the
 * real UI instead, using the UI-side ViewModels' confirmed [Required] sets:
 * BankInformationVM.Name/TelephoneNo, BankAccountVM.AccountNo/AccountName/
 * BankId/BranchName (ShampanPOS.Models/BankInformationVM.cs,
 * ShampanPOS.Models/BankAccountVM.cs).
 */
export class BankAccountSetupPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async createBankInformation(name: string, telephoneNo: string): Promise<void> {
    await this.page.goto(routes.dms('BankInformation', 'Create'));
    await this.page.locator(bankAccountFormSelectors.bankInformation.name).fill(name);
    await this.page.locator(bankAccountFormSelectors.bankInformation.telephoneNo).fill(telephoneNo);
    await this.clickSave();
    await this.toastr.expectSuccess();
  }

  async createBankAccount(data: {
    accountNo: string;
    accountName: string;
    bankName: string;
    branchName: string;
  }): Promise<void> {
    await this.page.goto(routes.dms('BankAccount', 'Create'));
    await this.page.locator(bankAccountFormSelectors.bankAccount.accountNo).fill(data.accountNo);
    await this.page.locator(bankAccountFormSelectors.bankAccount.accountName).fill(data.accountName);
    const bankCombo = new KendoMultiColumnComboBox(this.page, bankAccountFormSelectors.bankAccount.bankId);
    // BANKACCOUNT-COMBO-INVESTIGATION E2E FINDING: BankId's combo renders
    // its FULL, ever-growing BankInformations table unfiltered (confirmed
    // live: `filter: "contains"` is declared but typing doesn't reduce the
    // rendered option count at all) — the just-created bank is always
    // present and selectable, just possibly slower to locate/click than
    // the default action timeout as this shared environment's table keeps
    // growing. See KendoComboBox.typeAndSelectFirst()'s own doc comment.
    //
    // ACCOUNTING-LEDGER-LIFECYCLE E2E FINDING: confirmed live (reproducible
    // across consecutive runs on the same day) that the table has now grown
    // past what 30000ms comfortably covers — bumped further for the same
    // reason the original 30000ms bump was made, not a new pattern. This is
    // a moving target inherent to this shared, ever-accumulating environment,
    // not a one-time fix.
    await bankCombo.typeAndSelectFirst(data.bankName, 60000);
    await this.page.locator(bankAccountFormSelectors.bankAccount.branchName).fill(data.branchName);
    await this.clickSave();
    await this.toastr.expectSuccess();
  }

  /** Full two-step prerequisite chain, returns the unique BankAccount name to select in Sale's payment grid. */
  async setupBankAccount(): Promise<{ accountName: string }> {
    const bankName = uniqueCode('BANK');
    const accountName = uniqueCode('BANKACC');
    await this.createBankInformation(bankName, randomData.phone11Digit());
    await this.createBankAccount({
      // STEP 11 LIVE EXECUTION FINDING: confirmed live — AccountNo is a real
      // type="number" input (with an oninput handler that strips non-digits
      // client-side too), so uniqueCode()'s alphanumeric output (e.g.
      // "AUTO_ACC_...") is rejected by Playwright's own fill() guard before
      // ever reaching the app. Stripping to digits-only preserves the same
      // timestamp-based uniqueness (see random-data.ts) in a form the field
      // actually accepts.
      accountNo: uniqueCode('ACC').replace(/\D/g, ''),
      accountName,
      bankName,
      branchName: 'Automation Branch',
    });
    return { accountName };
  }
}
