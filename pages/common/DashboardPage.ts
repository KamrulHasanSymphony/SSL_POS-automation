import { Page, expect } from '@playwright/test';
import { routes, logoutSelectors } from '../../utils/constants';
import { LoadingOverlay } from '../../components/LoadingOverlay';

/**
 * Common/Home/Index — the post-login dashboard. Re-confirmed at STEP 4
 * directly against Areas/Common/Views/Home/Index.cshtml: the KPI card grid
 * container carries class "dash-wrap", with e.g. `#kpiSaleTotal` as one of
 * its widget placeholders. Widget content itself is DB-driven per-user; this
 * page object intentionally avoids asserting specific widget data, only that
 * the dashboard shell (not an error page or the login page) loaded.
 */
export class DashboardPage {
  private readonly overlay: LoadingOverlay;

  constructor(private readonly page: Page) {
    this.overlay = new LoadingOverlay(page);
  }

  async expectLoaded(): Promise<void> {
    await expect(this.page).toHaveURL(new RegExp(routes.dashboard.split('?')[0].replace(/\//g, '\\/')));
    // STEP 14: `.dash-wrap` itself is a valid, stable indicator — it is
    // server-rendered unconditionally in Areas/Common/Views/Home/Index.cshtml
    // (line ~245), not toggled by any AJAX call. The failure was pure
    // sequencing/timing: DashController.js's `init(count)` (same view,
    // confirmed by source) fires an async GET to
    // /Common/Home/LoadBranchProfiles whenever the session has no
    // CurrentBranch yet (count === 0, e.g. straight after login), and for a
    // single-branch account can follow up with a second `window.location.href`
    // navigation once that resolves — a `.dash-wrap` check issued too early
    // can race a document the browser is about to navigate away from.
    //
    // Traced directly against the live app (STEP 14 diagnostic, 4 samples):
    // the URL settles at ~0.6-0.8s post-submit, but `.dash-wrap` and the
    // AJAX-triggered `.loadingoverlay` only appear together at ~1.8-2.0s
    // (once `$(document).ready()` fires and `loadBranchProfiles()` starts) —
    // there is a real, source-confirmed gap between "URL matches" and
    // "dashboard content exists" that a 10s Playwright default should
    // comfortably cover, EXCEPT this project's LoadingOverlay.waitForIdle()
    // uses a fixed 1s grace window to catch the overlay's *first* appearance
    // (tuned for near-instant user-triggered saves) — too short for this
    // page's ~1.8-2s AJAX-start delay, so it can race-miss the overlay
    // entirely and return a false "nothing to wait for". Given that
    // mismatch, gating this check on the overlay is unreliable here; relying
    // directly on `.dash-wrap`'s own auto-retrying visibility check (which
    // tolerates an intervening same-tab navigation on its own) is the
    // simpler, more robust signal. Timeout widened from the 10s default to
    // comfortably clear the observed ~2s cascade with margin for slower/
    // loaded conditions, per this project's own ACTION_TIMEOUT_MS precedent.
    await expect(this.page.locator('.dash-wrap')).toBeVisible({ timeout: 20_000 });
    await this.overlay.waitForIdle();
  }

  async changeBranch(): Promise<void> {
    await this.page.goto(routes.changeBranch);
  }

  /** Navigates directly by confirmed URL rather than via the DB-driven sidebar (STEP 1 §E). */
  async gotoModule(area: 'DMS' | 'SetUp' | 'Common', controller: string, action = 'Index'): Promise<void> {
    await this.page.goto(`/${area}/${controller}/${action}`);
    await this.overlay.waitForIdle();
  }

  /**
   * Clicks the real "Logout" link (Views/Shared/_rightNav.cshtml,
   * <a title="User Logout" href="/Login/LogOff">) rather than navigating
   * directly to the route, so the test exercises the actual UI trigger.
   *
   * STEP 14: the link lives inside a dropdown (`#Rnav.rnav`) that is
   * `visibility: hidden` until `.rnavmain` (the user-avatar container) is
   * clicked, per the view's own inline script — see
   * utils/constants.ts's `logoutSelectors` doc comment for the exact source
   * evidence. Opening it first matches the real user flow; no force-click.
   */
  async logout(): Promise<void> {
    await this.page.locator(logoutSelectors.menuTrigger).click();
    await expect(this.page.locator(logoutSelectors.menu)).toHaveClass(/\bactive\b/);
    await this.page.locator(logoutSelectors.link).click();
  }
}
