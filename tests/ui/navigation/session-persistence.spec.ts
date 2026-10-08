import { test, expect } from '../../../fixtures/auth.fixture';
import { routes } from '../../../utils/constants';
import { tags } from '../../../config/tags';

/**
 * STEP 2 module: Session Management — SESS-001 only (SESS-002/003 assert
 * the opposite/unauthenticated case and live in
 * tests/ui/security/unauthenticated-access.spec.ts under the
 * "unauthenticated" project).
 *
 * This test genuinely requires a pre-authenticated state (STEP 4 §4 routing
 * rule), so it is placed outside tests/ui/auth/** and tests/ui/security/**,
 * which routes it to the "authenticated" Playwright project — reusing
 * storage/auth.json via the `setup` → `authenticated` dependency instead of
 * performing its own login.
 */

test.describe('Session persistence — SESS', () => {
  test(`SESS-001 an authenticated session persists across normal navigation ${tags.regression} ${tags.p0}`, async ({
    dashboardPage,
    page,
  }) => {
    await page.goto(routes.dashboard);
    await dashboardPage.expectLoaded();

    // Navigate to a second, [Authorize]-protected page — a re-login prompt
    // here would mean the session did not actually persist.
    await page.goto(routes.confirmedProtectedPage);
    await expect(page).not.toHaveURL(new RegExp(routes.login.replace('/', '\\/')));
    await expect(page.locator('#GridDataList')).toBeVisible();

    // And back to the dashboard, still without a re-login prompt.
    await page.goto(routes.dashboard);
    await dashboardPage.expectLoaded();
  });
});
