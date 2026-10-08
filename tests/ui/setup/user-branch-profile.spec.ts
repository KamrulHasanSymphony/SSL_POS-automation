import { test, expect } from '../../../fixtures/masters7.fixture';
import { assertAdminCredentialsReady } from '../../../utils/env';
import { uniqueCode } from '../../../utils/random-data';
import { tags } from '../../../config/tags';

/**
 * STEP 10 Phase C module: UserBranchProfile (PROP-USERBRANCH-001..003),
 * approved exactly as documented in STEP 10.2/10.3C. See
 * pages/setup/UserBranchProfilePage.ts for the full source trail: the
 * real Create mechanism is the `.btnBranch` modal on
 * `/SetUp/UserBranchProfile/Index/{userId}`, not the dead standalone
 * Create page. Depends on an existing User (STEP 10.3B UserProfile).
 * No negative scenario was approved (no [Required] fields on this
 * screen) — "Edit" here means adding another branch assignment and
 * verifying it persists, since this screen has no traditional
 * single-record edit form.
 */
test.describe('UserBranchProfile — PROP-USERBRANCH', () => {
  test(`PROP-USERBRANCH-001 List/grid loads and displays records ${tags.regression} ${tags.p2}`, async ({
    userBranchProfilePage,
    userProfilePage,
  }) => {
    assertAdminCredentialsReady();

    const userName = uniqueCode('USERBRANCH');
    const userId = await userProfilePage.createUserProfile({
      userName,
      fullName: `Automation UserBranch ${userName}`,
      password: 'Automation@123',
      email: `${userName.toLowerCase()}@example.com`,
      phoneNumber: '01700000000',
    });

    await userBranchProfilePage.assignFirstBranch(userId);

    await userBranchProfilePage.goto(userId);
    expect(await userBranchProfilePage.grid.rowCount()).toBeGreaterThanOrEqual(1);
  });

  test(`PROP-USERBRANCH-002 Create assigns a branch to a user succeeds ${tags.regression} ${tags.p1}`, async ({
    userBranchProfilePage,
    userProfilePage,
  }) => {
    assertAdminCredentialsReady();

    const userName = uniqueCode('USERBRANCH');
    const userId = await userProfilePage.createUserProfile({
      userName,
      fullName: `Automation UserBranch ${userName}`,
      password: 'Automation@123',
      email: `${userName.toLowerCase()}@example.com`,
      phoneNumber: '01700000000',
    });

    await userBranchProfilePage.assignFirstBranch(userId);
  });

  test(`PROP-USERBRANCH-003 Edit and verify persistence ${tags.regression} ${tags.p2}`, async ({
    userBranchProfilePage,
    userProfilePage,
  }) => {
    assertAdminCredentialsReady();

    const userName = uniqueCode('USERBRANCH');
    const userId = await userProfilePage.createUserProfile({
      userName,
      fullName: `Automation UserBranch ${userName}`,
      password: 'Automation@123',
      email: `${userName.toLowerCase()}@example.com`,
      phoneNumber: '01700000000',
    });

    await userBranchProfilePage.assignFirstBranch(userId);
    const rowCountAfterFirst = await userBranchProfilePage.grid.rowCount();

    // Re-open the modal and assign again — confirms the first assignment persisted (the grid still shows it) and a second save succeeds.
    await userBranchProfilePage.assignFirstBranch(userId);
    await userBranchProfilePage.goto(userId);
    expect(await userBranchProfilePage.grid.rowCount()).toBeGreaterThanOrEqual(rowCountAfterFirst);
  });
});
