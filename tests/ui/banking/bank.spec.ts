import { test, expect } from '../../../fixtures/banking.fixture';
import { assertAdminCredentialsReady } from '../../../utils/env';
import { uniqueCode, randomData } from '../../../utils/random-data';
import { tags } from '../../../config/tags';

/**
 * STEP 7 module: Bank — BankInformation + BankAccount (PROP-BANK-001..007),
 * approved as the authoritative STEP 7 scope (see the STEP 7.1/7.2 chat
 * record; the original STEP 2 matrix could not be recovered). Runs under
 * the "authenticated" project.
 *
 * Delete is explicitly OUT OF SCOPE for both sub-modules: BankInformation
 * has no controller action at all; BankAccount's Delete action exists but
 * has a real bug (selected row IDs are never assigned), and both buttons
 * are commented out of their respective Index.cshtml.
 *
 * No Post/Draft test — neither module has a working Post workflow.
 */
test.describe('Bank — PROP-BANK', () => {
  test(`PROP-BANK-001 BankInformation list/grid loads and displays records ${tags.regression} ${tags.smoke} ${tags.p0}`, async ({
    bankInformationPage,
  }) => {
    assertAdminCredentialsReady();

    const name = uniqueCode('BANK');
    const code = await bankInformationPage.createBankInformation({ name, telephoneNo: randomData.phone11Digit() });

    await bankInformationPage.goto();
    await bankInformationPage.grid.search(code);
    await bankInformationPage.grid.waitForLoad();
    expect(await bankInformationPage.grid.rowCount()).toBeGreaterThanOrEqual(1);
    await expect(await bankInformationPage.grid.findRowByText(code)).toBeVisible();
  });

  test(`PROP-BANK-002 Create BankInformation with required fields succeeds ${tags.regression} ${tags.smoke} ${tags.p0}`, async ({
    bankInformationPage,
  }) => {
    assertAdminCredentialsReady();

    const name = uniqueCode('BANK');
    const code = await bankInformationPage.createBankInformation({ name, telephoneNo: randomData.phone11Digit() });

    await bankInformationPage.goto();
    await bankInformationPage.grid.search(code);
    await expect(await bankInformationPage.grid.findRowByText(code)).toBeVisible();
  });

  test(`PROP-BANK-003 Empty BankInformation Name rejected ${tags.regression} ${tags.negative} ${tags.p1}`, async ({
    bankInformationPage,
    page,
  }) => {
    assertAdminCredentialsReady();

    await bankInformationPage.gotoCreate();
    await bankInformationPage.fillTelephone(randomData.phone11Digit());
    // Name deliberately left empty.
    await bankInformationPage.clickSave();

    await bankInformationPage.expectNameRequiredValidation();
    await expect(page).toHaveURL(/\/DMS\/BankInformation\/Create/i);
  });

  test(`PROP-BANK-004 Empty BankInformation Telephone No. rejected ${tags.regression} ${tags.negative} ${tags.p1}`, async ({
    bankInformationPage,
    page,
  }) => {
    assertAdminCredentialsReady();

    await bankInformationPage.gotoCreate();
    await bankInformationPage.fillName(uniqueCode('BANK'));
    // Telephone No. deliberately left empty.
    await bankInformationPage.clickSave();

    await bankInformationPage.expectTelephoneRequiredValidation();
    await expect(page).toHaveURL(/\/DMS\/BankInformation\/Create/i);
  });

  test(`PROP-BANK-005 Edit BankInformation and verify persistence ${tags.regression} ${tags.p0}`, async ({
    bankInformationPage,
  }) => {
    assertAdminCredentialsReady();

    const originalName = uniqueCode('BANK');
    const code = await bankInformationPage.createBankInformation({
      name: originalName,
      telephoneNo: randomData.phone11Digit(),
    });

    await bankInformationPage.openEditFor(code);
    const updatedName = uniqueCode('BANK');
    await bankInformationPage.updateName(updatedName);

    await bankInformationPage.goto();
    await bankInformationPage.grid.search(updatedName);
    await expect(await bankInformationPage.grid.findRowByText(updatedName)).toBeVisible();
  });

  test(`PROP-BANK-006 Create BankAccount with required fields and verify grid retrieval ${tags.regression} ${tags.smoke} ${tags.p0}`, async ({
    bankAccountPage,
    bankInformationPrerequisite,
  }) => {
    assertAdminCredentialsReady();

    const { bankName } = await bankInformationPrerequisite();
    const accountName = await bankAccountPage.createBankAccount({
      // FULL-REGRESSION-RUN FIX (confirmed automation defect): #AccountNo is
      // `<input type="number">` — `uniqueCode('ACC')` (letters + underscores)
      // fails outright ("Cannot type text into input[type=number]"). Same
      // digits-only fix already proven in
      // pages/common/BankAccountSetupPage.ts's own setupBankAccount() for
      // this exact field.
      accountNo: uniqueCode('ACC').replace(/\D/g, ''),
      accountName: uniqueCode('BANKACC'),
      bankName,
      branchName: 'Automation Branch',
    });

    await bankAccountPage.goto();
    await bankAccountPage.grid.search(accountName);
    await bankAccountPage.grid.waitForLoad();
    expect(await bankAccountPage.grid.rowCount()).toBeGreaterThanOrEqual(1);
    await expect(await bankAccountPage.grid.findRowByText(accountName)).toBeVisible();
  });

  test(`PROP-BANK-007 BankInformation/BankAccount grid search filters by Code/Name ${tags.regression} ${tags.p2}`, async ({
    bankInformationPage,
    bankAccountPage,
    bankInformationPrerequisite,
  }) => {
    assertAdminCredentialsReady();

    const bankInfoName = uniqueCode('BANK');
    const bankInfoCode = await bankInformationPage.createBankInformation({
      name: bankInfoName,
      telephoneNo: randomData.phone11Digit(),
    });
    await bankInformationPage.goto();
    await bankInformationPage.grid.search(bankInfoCode);
    expect(await bankInformationPage.grid.rowCount()).toBeGreaterThanOrEqual(1);
    await expect(await bankInformationPage.grid.findRowByText(bankInfoCode)).toBeVisible();

    const { bankName } = await bankInformationPrerequisite();
    const accountName = await bankAccountPage.createBankAccount({
      // FULL-REGRESSION-RUN FIX (confirmed automation defect): #AccountNo is
      // `<input type="number">` — `uniqueCode('ACC')` (letters + underscores)
      // fails outright ("Cannot type text into input[type=number]"). Same
      // digits-only fix already proven in
      // pages/common/BankAccountSetupPage.ts's own setupBankAccount() for
      // this exact field.
      accountNo: uniqueCode('ACC').replace(/\D/g, ''),
      accountName: uniqueCode('BANKACC'),
      bankName,
      branchName: 'Automation Branch',
    });
    await bankAccountPage.goto();
    await bankAccountPage.grid.search(accountName);
    expect(await bankAccountPage.grid.rowCount()).toBeGreaterThanOrEqual(1);
    await expect(await bankAccountPage.grid.findRowByText(accountName)).toBeVisible();
  });
});
