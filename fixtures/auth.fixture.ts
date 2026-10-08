import { Page, BrowserContext } from '@playwright/test';
import { test as baseFixtureTest, BaseFixtures } from './base.fixture';
import { LoginPage } from '../pages/auth/LoginPage';
import { BranchSelectPage } from '../pages/common/BranchSelectPage';
import { DashboardPage } from '../pages/common/DashboardPage';
import { env, assertAdminCredentialsReady } from '../utils/env';
import { acquireAuthSlot } from '../utils/auth-semaphore';

/**
 * STEP 15A/15C: one real authenticated session per Playwright WORKER, not
 * one session shared by every worker (the prior `storage/auth.json`
 * approach) and not a fresh login per test. Root cause this fixes (see
 * STEP 14/15A reports): ShampanPOSUI's `Web.config` sets
 * `sessionState mode="InProc"`, which serializes concurrent requests that
 * share one ASP.NET session ID. Every worker previously loaded the exact
 * same `storage/auth.json` cookie, so parallel workers piled up behind one
 * server-side session lock. Giving each worker its own independently
 * logged-in session removes that contention entirely, since InProc's lock
 * is per-session, not per-account.
 *
 * STEP 15D/15E: STEP 15A/15C bounded *contention* per session but left login
 * *concurrency* unbounded — every worker's first "authenticated" test can
 * still land at once and fire its real login simultaneously (a login
 * storm). `acquireAuthSlot()` (utils/auth-semaphore.ts) wraps the actual
 * login below in a small cross-process semaphore so at most
 * AUTH_LOGIN_CONCURRENCY logins are ever in flight together; the rest queue
 * and proceed as slots free up. Nothing else about this fixture changes —
 * same one-login-per-worker behavior, same resulting session.
 */
type AuthStorageState = Awaited<ReturnType<BrowserContext['storageState']>>;

export interface AuthFixtures extends BaseFixtures {
  /** Login page object, bound to the current test's page */
  loginPage: LoginPage;
  branchSelectPage: BranchSelectPage;
  dashboardPage: DashboardPage;
  /**
   * A page in a brand-new, storage-free browser context — guaranteed
   * unauthenticated regardless of which Playwright project (and its default
   * storageState) the test runs under.
   *
   * Tests physically located under tests/ui/auth/** or tests/ui/security/**
   * already run under the "unauthenticated" Playwright project (see
   * playwright.config.ts), which itself starts with no pre-loaded
   * storageState — so for those files the default `page` fixture is already
   * unauthenticated and this fixture is redundant. Reach for
   * `unauthenticatedPage` instead when a test in the "authenticated" project
   * needs a one-off unauthenticated check without leaving its main flow, or
   * as an explicit belt-and-suspenders guarantee that doesn't depend on
   * which project happens to run the file.
   */
  unauthenticatedPage: Page;
  /**
   * Composes LoginPage + BranchSelectPage into the one full real login flow
   * (submit credentials, resolve the conditional branch-selection modal if
   * it appears, land on the dashboard) so individual spec files describe
   * test intent/assertions rather than re-typing the same multi-step
   * interaction. Does not itself assert the outcome — callers (e.g.
   * AUTH-001) still assert dashboard-loaded / session-established
   * explicitly, since that assertion IS the test.
   */
  performLogin: (username: string, password: string) => Promise<void>;
}

interface AuthWorkerFixtures {
  /**
   * Worker-scoped: resolved at most ONCE per worker, lazily, the first time
   * any test in that worker needs it — never re-run per test. `undefined`
   * for every project except "authenticated" (checked via
   * `workerInfo.project.name`), so this is a complete no-op for
   * "framework"/"unauthenticated"/"setup" even though some of their spec
   * files also import this fixture module.
   */
  workerAuthState: AuthStorageState | undefined;
}

export const test = baseFixtureTest.extend<AuthFixtures, AuthWorkerFixtures>({
  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },

  branchSelectPage: async ({ page }, use) => {
    await use(new BranchSelectPage(page));
  },

  dashboardPage: async ({ page }, use) => {
    await use(new DashboardPage(page));
  },

  unauthenticatedPage: async ({ browser }, use) => {
    const context = await browser.newContext({ storageState: undefined });
    const page = await context.newPage();
    await use(page);
    await context.close();
  },

  performLogin: async ({ loginPage, branchSelectPage }, use) => {
    await use(async (username: string, password: string) => {
      await loginPage.login(username, password);
      await branchSelectPage.resolveIfPresent();
    });
  },

  // STEP 15A/15C Phase 1 — worker-scoped authentication. Depends only on the
  // worker-scoped `browser` fixture (a test-scoped fixture like `page`
  // cannot be used here), exactly mirroring fixtures/auth.setup.ts's own
  // real login flow: submit credentials, resolve the conditional
  // branch-selection modal if present, wait for the dashboard to actually
  // load, then capture the resulting session.
  workerAuthState: [
    async ({ browser }, use, workerInfo) => {
      if (workerInfo.project.name !== 'authenticated') {
        await use(undefined);
        return;
      }

      assertAdminCredentialsReady();

      // browser.newContext() is a raw Playwright API call — unlike the
      // built-in `context`/`page` fixtures, it does NOT automatically pick
      // up the project's `use` options (baseURL, ignoreHTTPSErrors, etc.),
      // so they must be passed explicitly or LoginPage's relative
      // page.goto() calls fail immediately with "Cannot navigate to invalid
      // URL". Read from workerInfo.project.use so this always matches
      // whatever playwright.config.ts actually has configured, rather than
      // duplicating those values here.
      const context = await browser.newContext({
        baseURL: workerInfo.project.use.baseURL,
        ignoreHTTPSErrors: workerInfo.project.use.ignoreHTTPSErrors,
      });
      const page = await context.newPage();
      const loginPage = new LoginPage(page);
      const branchSelectPage = new BranchSelectPage(page);
      const dashboardPage = new DashboardPage(page);

      // STEP 15D/15E: gate the actual login round-trip through the
      // cross-worker semaphore so only AUTH_LOGIN_CONCURRENCY workers are
      // ever mid-login at once — everything else about this flow (and the
      // resulting session) is unchanged from STEP 15A/15C.
      const releaseAuthSlot = await acquireAuthSlot();
      try {
        await loginPage.login(env.adminUsername, env.adminPassword);
        await branchSelectPage.resolveIfPresent();
        await dashboardPage.expectLoaded();
      } finally {
        releaseAuthSlot();
      }

      const state = await context.storageState();
      await context.close();

      await use(state);
    },
    { scope: 'worker' },
  ],

  // STEP 15A/15C Phase 2 — overrides Playwright's built-in `storageState`
  // fixture. "authenticated" project: this worker's own session (above).
  // Every other project: exactly whatever that project's own
  // `use.storageState` already specifies in playwright.config.ts — e.g.
  // "unauthenticated" keeps starting with no session at all, completely
  // unchanged.
  storageState: async ({ workerAuthState }, use, testInfo) => {
    if (testInfo.project.name === 'authenticated') {
      await use(workerAuthState);
      return;
    }
    await use(testInfo.project.use.storageState);
  },
});

export { expect } from '@playwright/test';
