import { test, expect } from '../../../fixtures/auth.fixture';
import { env, assertAdminCredentialsReady } from '../../../utils/env';
import { routes } from '../../../utils/constants';
import { tags } from '../../../config/tags';

/**
 * STEP 2 module: Logout (LOGOUT-001, LOGOUT-002).
 * Runs under the "unauthenticated" project — each test performs its own
 * fresh login first, since logout itself is part of what's under test.
 */

test.describe('Logout — LOGOUT', () => {
  test(`LOGOUT-001 logout via the real UI link clears the session ${tags.smoke} ${tags.sanity} ${tags.p0}`, async ({
    performLogin,
    dashboardPage,
    loginPage,
    page,
  }) => {
    assertAdminCredentialsReady();

    await performLogin(env.adminUsername, env.adminPassword);
    await dashboardPage.expectLoaded();

    await dashboardPage.logout();

    await expect(page).toHaveURL(new RegExp(routes.login.replace('/', '\\/')));
    await loginPage.expectStillOnLoginPage();
  });

  test(`LOGOUT-002 browser back button after logout does not resurrect authenticated content ${tags.regression} ${tags.security} ${tags.p1}`, async ({
    performLogin,
    dashboardPage,
    page,
  }) => {
    assertAdminCredentialsReady();

    await performLogin(env.adminUsername, env.adminPassword);
    await dashboardPage.expectLoaded();

    await dashboardPage.logout();
    await expect(page).toHaveURL(new RegExp(routes.login.replace('/', '\\/')));

    // Secure expectation under test: navigating back must NOT visibly
    // resurrect authenticated dashboard content (whether via a fresh
    // server round-trip or a browser bfcache restore). Record the actual
    // observed behavior rather than assuming a specific HTTP caching
    // mechanism — no Cache-Control header assumptions are made here.
    await page.goBack();

    const dashboardContentVisible = await page
      .locator('.dash-wrap')
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    // PASS (secure): dashboard content is not visibly resurrected — either
    // the browser re-requested and was redirected to login, or the bfcache
    // entry was not used. FAIL (insecure, report as a defect — do not weaken
    // this assertion to match observed behavior): dashboard content is
    // visible again after back navigation post-logout.
    expect(dashboardContentVisible).toBe(false);
  });
});
