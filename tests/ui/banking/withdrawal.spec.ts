import { test, expect } from '../../../fixtures/banking.fixture';
import { assertAdminCredentialsReady } from '../../../utils/env';
import { tags } from '../../../config/tags';

/**
 * STEP 7 module: Withdrawal (PROP-WD-001..006), approved STEP 7 scope.
 * Mirrors Deposit. Runs under the "authenticated" project.
 *
 * Delete is explicitly OUT OF SCOPE: action exists, button commented out.
 * No Post/Draft test: confirmed no working Post workflow (dead code).
 */
test.describe('Withdrawal — PROP-WD', () => {
  test(`PROP-WD-001 Withdrawal list/grid loads and displays records ${tags.regression} ${tags.smoke} ${tags.p0}`, async ({
    withdrawalPage,
    twoBankAccountsPrerequisite,
  }) => {
    assertAdminCredentialsReady();

    const { fromAccountName, toAccountName } = await twoBankAccountsPrerequisite();
    const code = await withdrawalPage.createWithdrawal({
      fromBankAccountName: fromAccountName,
      toBankAccountName: toAccountName,
      amount: 500,
    });

    await withdrawalPage.goto();
    await withdrawalPage.grid.search(code);
    await withdrawalPage.grid.waitForLoad();
    expect(await withdrawalPage.grid.rowCount()).toBeGreaterThanOrEqual(1);
    await expect(await withdrawalPage.grid.findRowByText(code)).toBeVisible();
  });

  test(`PROP-WD-002 Create Withdrawal with required fields succeeds ${tags.regression} ${tags.smoke} ${tags.p0}`, async ({
    withdrawalPage,
    twoBankAccountsPrerequisite,
  }) => {
    assertAdminCredentialsReady();

    const { fromAccountName, toAccountName } = await twoBankAccountsPrerequisite();
    const code = await withdrawalPage.createWithdrawal({
      fromBankAccountName: fromAccountName,
      toBankAccountName: toAccountName,
      amount: 250,
    });

    await withdrawalPage.goto();
    await withdrawalPage.grid.search(code);
    await expect(await withdrawalPage.grid.findRowByText(code)).toBeVisible();
  });

  test(`PROP-WD-003 Withdrawal without From Bank Account rejected ${tags.regression} ${tags.negative} ${tags.p1}`, async ({
    withdrawalPage,
    twoBankAccountsPrerequisite,
    page,
  }) => {
    assertAdminCredentialsReady();

    const { toAccountName } = await twoBankAccountsPrerequisite();
    await withdrawalPage.gotoCreate();
    await withdrawalPage.selectToBankAccount(toAccountName);
    await withdrawalPage.fillDates();
    await withdrawalPage.fillAmount(100);
    // From Bank Account deliberately left unselected.
    await withdrawalPage.clickSave();

    await withdrawalPage.expectFromBankAccountRequiredIndicated();
    await expect(page).toHaveURL(/\/DMS\/Withdrawal\/Create/i);
  });

  test(`PROP-WD-004 Withdrawal without Transaction Date rejected ${tags.regression} ${tags.negative} ${tags.p1}`, async ({
    withdrawalPage,
    twoBankAccountsPrerequisite,
    page,
  }) => {
    assertAdminCredentialsReady();

    const { fromAccountName, toAccountName } = await twoBankAccountsPrerequisite();
    await withdrawalPage.gotoCreate();
    await withdrawalPage.selectFromBankAccount(fromAccountName);
    await withdrawalPage.selectToBankAccount(toAccountName);
    await withdrawalPage.fillAmount(100);
    // Transaction Date (and Cheque Date) deliberately left empty.
    await withdrawalPage.clickSave();

    await withdrawalPage.expectTransactionDateRequiredValidation();
    await expect(page).toHaveURL(/\/DMS\/Withdrawal\/Create/i);
  });

  test(`PROP-WD-005 Edit Withdrawal and verify persistence ${tags.regression} ${tags.p0}`, async ({
    withdrawalPage,
    twoBankAccountsPrerequisite,
  }) => {
    assertAdminCredentialsReady();

    const { fromAccountName, toAccountName } = await twoBankAccountsPrerequisite();
    const code = await withdrawalPage.createWithdrawal({
      fromBankAccountName: fromAccountName,
      toBankAccountName: toAccountName,
      amount: 300,
    });

    await withdrawalPage.openEditFor(code);
    await withdrawalPage.updateAmount(888);

    await withdrawalPage.goto();
    await withdrawalPage.grid.search(code);
    const row = await withdrawalPage.grid.findRowByText(code);
    await expect(row).toContainText('888');
  });

  test(`PROP-WD-006 Withdrawal grid search filters by Code/Account ${tags.regression} ${tags.p2}`, async ({
    withdrawalPage,
    twoBankAccountsPrerequisite,
  }) => {
    assertAdminCredentialsReady();

    const { fromAccountName, toAccountName } = await twoBankAccountsPrerequisite();
    const code = await withdrawalPage.createWithdrawal({
      fromBankAccountName: fromAccountName,
      toBankAccountName: toAccountName,
      amount: 150,
    });

    await withdrawalPage.goto();
    await withdrawalPage.grid.search(code);
    await withdrawalPage.grid.waitForLoad();

    expect(await withdrawalPage.grid.rowCount()).toBe(1);
    await expect(await withdrawalPage.grid.findRowByText(code)).toBeVisible();
  });
});
