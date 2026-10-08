import { defineConfig, devices } from '@playwright/test';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '.env') });

const isCI = !!process.env.CI;
const baseURL = process.env.BASE_URL || undefined;

/**
 * NOTE on artifact folders: the requested top-level `screenshots/`, `videos/`,
 * `traces/` folders are created and kept for the project's documented
 * structure, but Playwright itself does not support routing each artifact
 * type to a separate top-level directory — screenshots/videos/traces for a
 * given test are always written together under `outputDir` (per-test
 * subfolder), and the HTML report links to them from there. `outputDir`
 * below points at `test-results/` (Playwright's own convention) with the
 * HTML report published to `reports/html`. Flagged explicitly here and in
 * the README rather than silently deviating from the requested layout.
 */

/**
 * STEP 3.1 project architecture. Four execution contexts, each scoped by an
 * explicit testMatch/testIgnore pattern so a given test file is picked up by
 * exactly one project — never zero, never more than one:
 *
 *   framework       — @framework-only scaffold/infra validation. No auth
 *                      dependency, runs without any .env values at all.
 *                      Matched by filename convention: tests/**\/_*.spec.ts
 *
 *   unauthenticated — login, invalid-login, required-field-validation,
 *                      anonymous-access, and unauthenticated security tests
 *                      (tests/ui/auth/**, tests/ui/security/**). Starts every
 *                      test with NO pre-loaded storageState — this does not
 *                      mean the test never logs in, only that it never starts
 *                      already-authenticated. A test that needs to verify
 *                      behavior for a specific (possibly restricted) account
 *                      still performs that login itself, inline, via
 *                      pages/auth/LoginPage.ts — see README "Project
 *                      Architecture" for the SEC-005/ROLE-007 example.
 *
 *   setup           — fixtures/auth.setup.ts. Standalone real-login smoke
 *                      check (ADMIN_USERNAME/ADMIN_PASSWORD, persists
 *                      storage/auth.json) — kept as a cheap, isolated
 *                      diagnostic (`npx playwright test --project=setup`).
 *                      No project depends on it (see STEP 15A/15C below).
 *                      Requires real BASE_URL/ADMIN_USERNAME/ADMIN_PASSWORD;
 *                      fails fast and clearly if they are missing (see
 *                      utils/env.ts's assertEnvReady).
 *
 *   authenticated   — every other business test (tests/ui/masters,
 *                      tests/ui/purchase, tests/ui/sales, tests/ui/banking,
 *                      tests/ui/reports, tests/ui/navigation, tests/api).
 *                      STEP 15A/15C: no longer depends on `setup` and no
 *                      longer reuses one static storage/auth.json file for
 *                      every worker — fixtures/auth.fixture.ts's
 *                      worker-scoped `workerAuthState` fixture now performs
 *                      one real login per Playwright worker instead (see
 *                      that file's header comment for the full root-cause
 *                      chain: Web.config's InProc session locking serialized
 *                      concurrent requests that all shared one session).
 *                      STEP 15D/15E: those per-worker logins are now also
 *                      gated through a small cross-worker semaphore
 *                      (utils/auth-semaphore.ts) so only
 *                      AUTH_LOGIN_CONCURRENCY of them ever fire at once
 *                      instead of every worker logging in simultaneously —
 *                      no change to this project's config, purely inside
 *                      the fixture.
 *
 * Dependency graph:
 *   framework        -> (none)
 *   unauthenticated  -> (none)
 *   setup            -> (none)
 *   authenticated    -> (none) — self-authenticates per worker, see above
 */
const frameworkOnlyPattern = /(^|[\\/])_[^\\/]+\.spec\.ts$/;
const unauthenticatedFolderPattern = /tests[\\/]ui[\\/](auth|security)[\\/]/;

/**
 * STEP 20 — Allure reporting.
 *
 * Reporting-only addition: no test logic, locators, assertions, or the API
 * client are touched. The `html` and `list` reporters below are unchanged;
 * `allure-playwright` is added as a third, independent reporter writing raw
 * results to `allure-results/` (kept separate from the existing
 * `reports/html` output — see the outputDir note above for why artifact
 * folders are already split this way in this project).
 *
 * `allure-results/` is the raw per-test JSON + attachments Allure writes
 * during the run; it is what `allure generate`/`allure serve` read from.
 * `allure-report/` (the rendered static site) only exists after running one
 * of the `report:allure:*` scripts below — it is not produced by `playwright
 * test` itself, same as how `reports/html` is produced by the `html`
 * reporter but only opened via a separate `report` script.
 */
const environmentInfo: Record<string, string> = {
  Project: 'ShampanPOS Automation',
  'Test Framework': 'Playwright',
  Environment: baseURL ?? 'Not set',
  Browser: 'Chromium (Desktop Chrome)',
  OS: `${process.platform} (${process.arch})`,
  'Node.js Version': process.version,
};

export default defineConfig({
  testDir: './tests',
  outputDir: './test-results',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: isCI ? 2 : undefined,
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  reporter: [
    ['html', { outputFolder: 'reports/html', open: 'never' }],
    ['list'],
    ['allure-playwright', { resultsDir: 'allure-results', detail: true, suiteTitle: true, environmentInfo }],
  ],
  use: {
    baseURL,
    headless: (process.env.HEADLESS ?? 'true').toLowerCase() !== 'false',
    actionTimeout: Number(process.env.ACTION_TIMEOUT_MS ?? 15_000),
    navigationTimeout: Number(process.env.NAVIGATION_TIMEOUT_MS ?? 30_000),
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'on-first-retry',
    ignoreHTTPSErrors: true,
  },
  projects: [
    {
      name: 'framework',
      use: { ...devices['Desktop Chrome'] },
      // Matches by filename convention only (leading underscore), independent
      // of physical folder, so this never accidentally grows to include
      // future business test files.
      testMatch: frameworkOnlyPattern,
      testIgnore: unauthenticatedFolderPattern, // belt-and-suspenders; see "no overlap" validation
    },
    {
      name: 'unauthenticated',
      use: {
        ...devices['Desktop Chrome'],
        storageState: undefined, // explicit: never starts with a pre-loaded session
      },
      testMatch: unauthenticatedFolderPattern,
      testIgnore: frameworkOnlyPattern,
    },
    {
      name: 'setup',
      // Overrides the top-level testDir: auth.setup.ts intentionally lives under
      // fixtures/ (not tests/), since it is reusable infrastructure, not a test
      // case in the STEP 2 coverage plan. Without this override, the global
      // testDir: './tests' would make Playwright never scan fixtures/ at all,
      // regardless of testMatch — confirmed by a failed discovery run in STEP 3.
      testDir: '.',
      testMatch: /fixtures[\\/]auth\.setup\.ts$/,
    },
    {
      name: 'authenticated',
      // STEP 15A/15C: storageState is no longer a static file path here —
      // fixtures/auth.fixture.ts's `storageState` fixture override supplies
      // a per-worker session instead (see its header comment). No
      // `dependencies: ['setup']` either: each worker now authenticates
      // itself lazily on first use, so there is nothing left to depend on.
      use: { ...devices['Desktop Chrome'] },
      testIgnore: [frameworkOnlyPattern, unauthenticatedFolderPattern, /fixtures[\\/].*\.setup\.ts$/],
    },
  ],
});
