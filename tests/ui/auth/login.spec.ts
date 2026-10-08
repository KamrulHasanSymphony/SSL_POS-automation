import { test, expect } from '../../../fixtures/auth.fixture';
import { env, assertEnvReady, assertBaseUrlReady, assertAdminCredentialsReady } from '../../../utils/env';
import { loginValidationMessages } from '../../../utils/constants';
import { tags } from '../../../config/tags';

/**
 * STEP 2 module: Authentication (AUTH-001..009).
 * Runs under the "unauthenticated" Playwright project — every test starts
 * with no pre-loaded session (see playwright.config.ts / README "Project
 * Architecture"). Approved coverage: FINAL APPROVED STEP 2 §C "1. Authentication".
 *
 * STEP 4.1: environment requirements are scoped per test to exactly what
 * each one needs — see utils/env.ts's assertBaseUrlReady()/
 * assertAdminCredentialsReady(). Only AUTH-001/009 (a real successful login)
 * need admin credentials; AUTH-003 needs only the admin *username* (see its
 * own comment); everything else needs just a reachable application.
 */

test.describe('Authentication — AUTH', () => {
  test(`AUTH-001 valid credentials login succeeds ${tags.smoke} ${tags.sanity} ${tags.p0}`, async ({
    loginPage,
    branchSelectPage,
    dashboardPage,
  }) => {
    assertAdminCredentialsReady();

    await loginPage.login(env.adminUsername, env.adminPassword);
    await branchSelectPage.resolveIfPresent();
    await dashboardPage.expectLoaded();
  });

  test(`AUTH-002 invalid username is rejected ${tags.regression} ${tags.negative} ${tags.p0}`, async ({
    loginPage,
  }) => {
    assertBaseUrlReady();

    // Locally generated — deliberately does not depend on any real account.
    await loginPage.login(`nonexistent_user_${Date.now()}`, 'WhateverPassword123');
    await loginPage.expectStillOnLoginPage();
    await expect
      .poll(() => loginPage.getErrorMessage(), { timeout: 10_000 })
      .toBe(loginValidationMessages.invalidCredentials);
  });

  test(`AUTH-003 invalid password is rejected ${tags.regression} ${tags.negative} ${tags.p0}`, async ({
    loginPage,
  }) => {
    // STEP 2's approved test data for AUTH-003 is specifically "valid user +
    // wrong password" (a distinct equivalence class from AUTH-002's fully
    // fake username) — so this one genuinely needs a real ADMIN_USERNAME,
    // deliberately NOT ADMIN_PASSWORD (the password itself is generated
    // locally). Not a violation of the BASE_URL-only default; a documented,
    // deliberate exception per STEP 4.1 §1C.
    assertEnvReady('baseUrl', 'adminUsername');

    await loginPage.login(env.adminUsername, `WrongPassword_${Date.now()}`);
    await loginPage.expectStillOnLoginPage();
    await expect
      .poll(() => loginPage.getErrorMessage(), { timeout: 10_000 })
      .toBe(loginValidationMessages.invalidCredentials);
  });

  test(`AUTH-004 empty username shows required validation ${tags.regression} ${tags.negative} ${tags.p0}`, async ({
    loginPage,
  }) => {
    assertBaseUrlReady();

    await loginPage.goto();
    await loginPage.fillUsername('');
    await loginPage.fillPassword('SomePassword123');
    await loginPage.submit();

    await loginPage.expectStillOnLoginPage();
    await expect
      .poll(() => loginPage.getUsernameValidationMessage(), { timeout: 10_000 })
      .toBe(loginValidationMessages.usernameRequired);
  });

  test(`AUTH-005 empty password shows required validation ${tags.regression} ${tags.negative} ${tags.p0}`, async ({
    loginPage,
  }) => {
    assertBaseUrlReady();

    // A locally generated, non-empty username isolates "password empty"
    // from "username empty" (AUTH-006) without depending on a real account.
    await loginPage.goto();
    await loginPage.fillUsername(`probe_user_${Date.now()}`);
    await loginPage.fillPassword('');
    await loginPage.submit();

    await loginPage.expectStillOnLoginPage();
    // Password carries both [Required] and [MinLength(6)] on the same field;
    // which exact message jQuery Unobtrusive Validation renders for a fully
    // empty value was not independently confirmed against a live render (see
    // utils/constants.ts loginValidationMessages doc comment) — assert the
    // span is populated rather than pinning one exact string, and flag the
    // observed text in the report for later confirmation.
    await expect
      .poll(() => loginPage.getPasswordValidationMessage(), { timeout: 10_000 })
      .not.toBe('');
  });

  test(`AUTH-006 both fields empty shows both required validations ${tags.regression} ${tags.negative} ${tags.p1}`, async ({
    loginPage,
  }) => {
    assertBaseUrlReady();

    await loginPage.goto();
    await loginPage.fillUsername('');
    await loginPage.fillPassword('');
    await loginPage.submit();

    await loginPage.expectStillOnLoginPage();
    await expect
      .poll(() => loginPage.getUsernameValidationMessage(), { timeout: 10_000 })
      .toBe(loginValidationMessages.usernameRequired);
    await expect
      .poll(() => loginPage.getPasswordValidationMessage(), { timeout: 10_000 })
      .not.toBe('');
  });

  test(`AUTH-007 password visibility toggle switches input type ${tags.regression} ${tags.p1}`, async ({
    loginPage,
  }) => {
    assertBaseUrlReady();

    await loginPage.goto();
    await loginPage.fillPassword('SomePassword123');
    expect(await loginPage.passwordInputType()).toBe('password');

    await loginPage.togglePasswordVisibility();
    expect(await loginPage.passwordInputType()).toBe('text');

    await loginPage.togglePasswordVisibility();
    expect(await loginPage.passwordInputType()).toBe('password');
  });

  test(`AUTH-008 remember-me checkbox has no functional effect (documented by-design absence) ${tags.regression} ${tags.p2}`, async ({
    loginPage,
    page,
  }) => {
    assertBaseUrlReady();
    await loginPage.goto();

    // Confirmed in Views/Login/Index.cshtml: <input type="checkbox"> Remember me
    // — no id, no name, not bound to the LoginResource model at all.
    const rememberMeCheckbox = page.getByText('Remember me').locator('..').locator('input[type="checkbox"]');
    await expect(rememberMeCheckbox).toBeVisible();
    // Confirmed by source: no id/name attribute at all, so it can't bind to
    // the LoginResource model — documents the by-design absence, not a bug.
    expect(await rememberMeCheckbox.getAttribute('id')).toBeNull();
    expect(await rememberMeCheckbox.getAttribute('name')).toBeNull();
  });

  test(`AUTH-009 successful login establishes a session cookie ${tags.smoke} ${tags.p0}`, async ({
    loginPage,
    branchSelectPage,
    page,
  }) => {
    assertAdminCredentialsReady();

    const cookiesBefore = await page.context().cookies();
    expect(cookiesBefore.length).toBe(0);

    await loginPage.login(env.adminUsername, env.adminPassword);
    await branchSelectPage.resolveIfPresent();

    const cookiesAfter = await page.context().cookies();
    expect(cookiesAfter.length).toBeGreaterThan(0);
  });
});
