import { test as setup } from '@playwright/test';
import * as path from 'path';
import { LoginPage } from '../pages/auth/LoginPage';
import { BranchSelectPage } from '../pages/common/BranchSelectPage';
import { DashboardPage } from '../pages/common/DashboardPage';
import { env, assertEnvReady } from '../utils/env';

/**
 * Runs once (as the "setup" project, see playwright.config.ts) to establish
 * an authenticated session and persist it to storage/auth.json. Every test
 * in the "authenticated" project reuses that storageState instead of logging
 * in individually — standard Playwright authenticated-project pattern.
 *
 * Tests that specifically exercise the login/logout/unauthorized-access flow
 * (AUTH, SEC, SESS module tests) must NOT depend on this — they belong in the
 * "unauthenticated" project (tests/ui/auth/**, tests/ui/security/**), which
 * starts with no pre-loaded storageState and performs any login it needs
 * itself, inline, via pages/auth/LoginPage.ts.
 *
 * TEST COUNT PROTECTION: this "authenticate" test is infrastructure, not one
 * of the STEP 2-approved 267 business test cases (see
 * config/coverage-baseline.ts). It has no @smoke/@sanity/@regression/@security
 * tag and is therefore not matched by any of those grep-based npm scripts —
 * but because the "authenticated" project declares `dependencies: ['setup']`,
 * Playwright will still always run it as a prerequisite whenever an
 * "authenticated"-project test runs, regardless of --grep filters. That is
 * intended (those tests need a real session), but any custom pass/fail
 * reporting built on top of this suite must filter out project === 'setup'
 * before counting results against the 267 baseline. The "framework" and
 * "unauthenticated" projects never trigger this dependency at all.
 */
const authFile = path.resolve(__dirname, '..', 'storage', 'auth.json');

setup('authenticate', async ({ page }) => {
  assertEnvReady('baseUrl', 'adminUsername', 'adminPassword');

  const loginPage = new LoginPage(page);
  const branchSelectPage = new BranchSelectPage(page);
  const dashboardPage = new DashboardPage(page);

  await loginPage.login(env.adminUsername, env.adminPassword);

  // Conditional branch-selection step (confirmed STEP 1 §D) — resolve if present.
  await branchSelectPage.resolveIfPresent();

  await dashboardPage.expectLoaded();

  await page.context().storageState({ path: authFile });
});
