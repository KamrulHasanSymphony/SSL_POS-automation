import { test, expect } from '../../../fixtures/auth.fixture';
import { env, assertAdminCredentialsReady } from '../../../utils/env';
import { branchSelectSelectors } from '../../../utils/constants';
import { tags } from '../../../config/tags';

/**
 * STEP 2 module: Conditional Branch Selection (BRSEL-001..004).
 * Runs under the "unauthenticated" project — each test performs its own
 * fresh login (branch selection immediately follows login, per
 * pages/common/BranchSelectPage.ts).
 *
 * Per STEP 4 instructions: whichever of the single-branch/multi-branch paths
 * the real ADMIN_USERNAME account does not exhibit is dynamically skipped
 * with an explicit reason, rather than faked — see each test.
 */

test.describe('Conditional Branch Selection — BRSEL', () => {
  test(`BRSEL-001 single-branch account is auto-assigned with no picker shown ${tags.smoke} ${tags.p0}`, async ({
    loginPage,
    branchSelectPage,
    dashboardPage,
  }) => {
    assertAdminCredentialsReady();

    await loginPage.login(env.adminUsername, env.adminPassword);
    const outcome = await branchSelectPage.resolveIfPresent();

    test.skip(
      outcome === 'selected',
      'ADMIN_USERNAME account has more than one branch — the single-branch auto-assign path does not apply to this account. Environment/test-data dependent, see STEP 4 report.'
    );

    await dashboardPage.expectLoaded();
  });

  test(`BRSEL-002 multi-branch account is shown the branch picker modal ${tags.regression} ${tags.p0}`, async ({
    loginPage,
    branchSelectPage,
    page,
  }) => {
    assertAdminCredentialsReady();

    await loginPage.login(env.adminUsername, env.adminPassword);
    const shown = await page
      .locator(branchSelectSelectors.modal)
      .waitFor({ state: 'visible', timeout: 8000 })
      .then(() => true)
      .catch(() => false);

    test.skip(
      !shown,
      'ADMIN_USERNAME account has only one active branch — auto-assigned silently, no picker modal to observe. Environment/test-data dependent, see STEP 4 report.'
    );

    await expect(page.locator(`${branchSelectSelectors.modal} ${branchSelectSelectors.modalTitle}`)).toContainText(
      'Select Branch'
    );
    await expect(page.locator(branchSelectSelectors.table)).toBeVisible();
    expect((await branchSelectPage.listBranchNames()).length).toBeGreaterThan(0);
  });

  test(`BRSEL-003 selecting a branch from the picker proceeds to the dashboard ${tags.regression} ${tags.p0}`, async ({
    loginPage,
    branchSelectPage,
    dashboardPage,
    page,
  }) => {
    assertAdminCredentialsReady();

    await loginPage.login(env.adminUsername, env.adminPassword);
    const shown = await page
      .locator(branchSelectSelectors.modal)
      .waitFor({ state: 'visible', timeout: 8000 })
      .then(() => true)
      .catch(() => false);

    test.skip(
      !shown,
      'ADMIN_USERNAME account has only one active branch — nothing to explicitly select. Environment/test-data dependent, see STEP 4 report.'
    );

    await branchSelectPage.selectBranch();
    await dashboardPage.expectLoaded();
  });

  test(`BRSEL-004 "Change Branch" always re-triggers branch resolution and returns to the dashboard ${tags.regression} ${tags.p1}`, async ({
    performLogin,
    dashboardPage,
    branchSelectPage,
  }) => {
    assertAdminCredentialsReady();

    await performLogin(env.adminUsername, env.adminPassword);
    await dashboardPage.expectLoaded();

    // Confirmed by source (HomeController.Index): branchChange=true always
    // returns an empty branchProfiles list, forcing DashController to call
    // LoadBranchProfiles again regardless of how many branches the account has.
    await dashboardPage.changeBranch();
    await branchSelectPage.resolveIfPresent();
    await dashboardPage.expectLoaded();
  });
});
