import { test, expect } from '../../../fixtures/auth.fixture';
import { env, assertBaseUrlReady, assertAdminCredentialsReady } from '../../../utils/env';
import { routes } from '../../../utils/constants';
import { tags } from '../../../config/tags';

/**
 * STEP 2 modules: Unauthorized Access / Security (SEC-001 only — SEC-002..006
 * and ROLE-007 are out of STEP 4's scope, see the STEP 4 report) and Session
 * Management (SESS-002, SESS-003). Runs under the "unauthenticated" project.
 *
 * Target page: /DMS/TableSection/Index — re-confirmed at STEP 4 directly from
 * Areas/DMS/Controllers/TableSectionController.cs: class-level [Authorize],
 * [RouteArea("DMS")], Index() takes no parameters.
 *
 * Secure expected behavior (STEP 1 §D / Startup.cs OWIN cookie config,
 * LoginPath = "/Login/Index"): an unauthenticated request to any
 * [Authorize]-protected action redirects to the login page. These tests
 * assert exactly that — PASS means the redirect happened, FAIL means
 * protected content was reachable without authentication.
 */

test.describe('Unauthenticated protected-page access — SEC / SESS', () => {
  test(`SEC-001 anonymous direct URL to a confirmed [Authorize]-protected page redirects to login ${tags.smoke} ${tags.negative} ${tags.security} ${tags.p0}`, async ({
    page,
  }) => {
    assertBaseUrlReady();

    await page.goto(routes.confirmedProtectedPage);

    await expect(page).toHaveURL(new RegExp(routes.login.replace('/', '\\/')));
    // Protected page's own content must not be present.
    await expect(page.locator('#GridDataList')).toHaveCount(0);
  });

  test(`SESS-002 unauthenticated user cannot reach a protected DMS module by direct URL ${tags.regression} ${tags.negative} ${tags.security} ${tags.p0}`, async ({
    page,
  }) => {
    assertBaseUrlReady();

    await page.goto(routes.confirmedProtectedPage);

    await expect(page).toHaveURL(new RegExp(routes.login.replace('/', '\\/')));
  });

  test(`SESS-003 protected page is inaccessible immediately after logout ${tags.regression} ${tags.negative} ${tags.security} ${tags.p0}`, async ({
    performLogin,
    dashboardPage,
    page,
  }) => {
    assertAdminCredentialsReady();

    await performLogin(env.adminUsername, env.adminPassword);
    await dashboardPage.expectLoaded();

    await dashboardPage.logout();
    await expect(page).toHaveURL(new RegExp(routes.login.replace('/', '\\/')));

    await page.goto(routes.confirmedProtectedPage);

    await expect(page).toHaveURL(new RegExp(routes.login.replace('/', '\\/')));
    await expect(page.locator('#GridDataList')).toHaveCount(0);
  });
});
