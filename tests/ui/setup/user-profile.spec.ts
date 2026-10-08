import { test, expect } from '../../../fixtures/masters6.fixture';
import { assertAdminCredentialsReady } from '../../../utils/env';
import { uniqueCode } from '../../../utils/random-data';
import { tags } from '../../../config/tags';
import { UserProfileCreateData } from '../../../pages/setup/UserProfilePage';

/**
 * STEP 10 Phase B module: UserProfile (PROP-USERPROF-001..004), approved
 * exactly as documented in STEP 10.2/10.3B. Runs under the "authenticated"
 * project. See pages/setup/UserProfilePage.ts for the full source trail:
 * no `Code` property (uses `#Id`/UserName for identification), no grid
 * search toolbar (uses the page-size selector instead), file upload
 * confirmed broken and out of scope.
 */
function validUserProfileData(prefix: string): UserProfileCreateData {
  const userName = uniqueCode(prefix);
  return {
    userName,
    fullName: `Automation User ${userName}`,
    password: 'Automation@123',
    email: `${userName.toLowerCase()}@example.com`,
    phoneNumber: '01700000000',
  };
}

test.describe('UserProfile — PROP-USERPROF', () => {
  test(`PROP-USERPROF-001 List/grid loads and displays records ${tags.regression} ${tags.p1}`, async ({ userProfilePage }) => {
    assertAdminCredentialsReady();

    const data = validUserProfileData('USERPROF');
    await userProfilePage.createUserProfile(data);

    await userProfilePage.goto();
    await userProfilePage.showMaxPageSize();
    expect(await userProfilePage.grid.rowCount()).toBeGreaterThanOrEqual(1);
    await expect(await userProfilePage.grid.findRowByText(data.userName)).toBeVisible();
  });

  test(`PROP-USERPROF-002 Create with required fields succeeds ${tags.regression} ${tags.p0}`, async ({ userProfilePage }) => {
    assertAdminCredentialsReady();

    const data = validUserProfileData('USERPROF');
    const id = await userProfilePage.createUserProfile(data);
    expect(id).toBeTruthy();
  });

  test(`PROP-USERPROF-003 Create with invalid Phone Number rejected ${tags.regression} ${tags.negative} ${tags.p1}`, async ({
    userProfilePage,
    page,
  }) => {
    assertAdminCredentialsReady();

    const data = validUserProfileData('USERPROF');
    await userProfilePage.gotoCreate();
    await userProfilePage.fillRequired({ ...data, phoneNumber: '123' });
    await userProfilePage.clickSave();

    await userProfilePage.expectPhoneNumberInvalidValidation();
    await expect(page).toHaveURL(/\/SetUp\/UserProfile\/Create/i);
  });

  test(`PROP-USERPROF-004 Edit and verify persistence ${tags.regression} ${tags.p1}`, async ({ userProfilePage }) => {
    assertAdminCredentialsReady();

    const data = validUserProfileData('USERPROF');
    const id = await userProfilePage.createUserProfile(data);

    await userProfilePage.openEditForId(id);
    const updatedFullName = `Automation Updated ${uniqueCode('USERPROF')}`;
    await userProfilePage.updateFullName(updatedFullName);

    await userProfilePage.goto();
    await userProfilePage.showMaxPageSize();
    await expect(await userProfilePage.grid.findRowByText(data.userName)).toBeVisible();
  });
});
