import { test, expect } from '../../../fixtures/banking.fixture';
import { assertAdminCredentialsReady } from '../../../utils/env';
import { tags } from '../../../config/tags';

/**
 * STEP 7 module: Deposit (PROP-DEP-001..006), approved STEP 7 scope.
 * Runs under the "authenticated" project.
 *
 * Delete is explicitly OUT OF SCOPE: action exists, button commented out.
 * No Post/Draft test: confirmed no working Post workflow (dead code) for
 * this module.
 */
test.describe('Deposit — PROP-DEP', () => {
  test(`PROP-DEP-001 Deposit list/grid loads and displays records ${tags.regression} ${tags.smoke} ${tags.p0}`, async ({
    depositPage,
    twoBankAccountsPrerequisite,
  }) => {
    assertAdminCredentialsReady();

    const { fromAccountName, toAccountName } = await twoBankAccountsPrerequisite();
    const code = await depositPage.createDeposit({ fromBankAccountName: fromAccountName, toBankAccountName: toAccountName, amount: 500 });

    await depositPage.goto();
    await depositPage.grid.search(code);
    await depositPage.grid.waitForLoad();
    expect(await depositPage.grid.rowCount()).toBeGreaterThanOrEqual(1);
    await expect(await depositPage.grid.findRowByText(code)).toBeVisible();
  });

  test(`PROP-DEP-002 Create Deposit with required fields succeeds ${tags.regression} ${tags.smoke} ${tags.p0}`, async ({
    depositPage,
    twoBankAccountsPrerequisite,
  }) => {
    assertAdminCredentialsReady();

    const { fromAccountName, toAccountName } = await twoBankAccountsPrerequisite();
    const code = await depositPage.createDeposit({ fromBankAccountName: fromAccountName, toBankAccountName: toAccountName, amount: 250 });

    await depositPage.goto();
    await depositPage.grid.search(code);
    await expect(await depositPage.grid.findRowByText(code)).toBeVisible();
  });

  test(`PROP-DEP-003 Deposit without From Bank Account rejected ${tags.regression} ${tags.negative} ${tags.p1}`, async ({
    depositPage,
    twoBankAccountsPrerequisite,
    page,
  }) => {
    assertAdminCredentialsReady();

    const { toAccountName } = await twoBankAccountsPrerequisite();
    await depositPage.gotoCreate();
    await depositPage.selectToBankAccount(toAccountName);
    await depositPage.fillDates();
    await depositPage.fillAmount(100);
    // From Bank Account deliberately left unselected.
    await depositPage.clickSave();

    await depositPage.expectFromBankAccountRequiredIndicated();
    await expect(page).toHaveURL(/\/DMS\/Deposit\/Create/i);
  });

  test(`PROP-DEP-004 Deposit without Transaction Date rejected ${tags.regression} ${tags.negative} ${tags.p1}`, async ({
    depositPage,
    twoBankAccountsPrerequisite,
    page,
  }) => {
    assertAdminCredentialsReady();

    const { fromAccountName, toAccountName } = await twoBankAccountsPrerequisite();
    await depositPage.gotoCreate();
    await depositPage.selectFromBankAccount(fromAccountName);
    await depositPage.selectToBankAccount(toAccountName);
    await depositPage.fillAmount(100);
    // Transaction Date (and Cheque Date) deliberately left empty.
    await depositPage.clickSave();

    await depositPage.expectTransactionDateRequiredValidation();
    await expect(page).toHaveURL(/\/DMS\/Deposit\/Create/i);
  });

  test(`PROP-DEP-005 Edit Deposit and verify persistence ${tags.regression} ${tags.p0}`, async ({
    depositPage,
    twoBankAccountsPrerequisite,
  }) => {
    assertAdminCredentialsReady();

    const { fromAccountName, toAccountName } = await twoBankAccountsPrerequisite();
    const code = await depositPage.createDeposit({ fromBankAccountName: fromAccountName, toBankAccountName: toAccountName, amount: 300 });

    await depositPage.openEditFor(code);
    await depositPage.updateAmount(777);

    await depositPage.goto();
    await depositPage.grid.search(code);
    const row = await depositPage.grid.findRowByText(code);
    await expect(row).toContainText('777');
  });

  test(`PROP-DEP-006 Deposit grid search filters by Code/Account ${tags.regression} ${tags.p2}`, async ({
    depositPage,
    twoBankAccountsPrerequisite,
  }) => {
    assertAdminCredentialsReady();

    const { fromAccountName, toAccountName } = await twoBankAccountsPrerequisite();
    const code = await depositPage.createDeposit({ fromBankAccountName: fromAccountName, toBankAccountName: toAccountName, amount: 150 });

    await depositPage.goto();
    await depositPage.grid.search(code);
    await depositPage.grid.waitForLoad();

    expect(await depositPage.grid.rowCount()).toBe(1);
    await expect(await depositPage.grid.findRowByText(code)).toBeVisible();
  });
});
