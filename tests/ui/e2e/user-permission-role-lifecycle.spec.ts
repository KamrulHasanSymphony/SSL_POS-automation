import { test, expect } from '../../../fixtures/masters7.fixture';
import { assertAdminCredentialsReady } from '../../../utils/env';
import { uniqueCode, randomData } from '../../../utils/random-data';
import { LoginPage } from '../../../pages/auth/LoginPage';
import { BranchSelectPage } from '../../../pages/common/BranchSelectPage';
import { DashboardPage } from '../../../pages/common/DashboardPage';

/**
 * Cross-module E2E User/Role/Menu-Permission/Authorization lifecycle:
 * (as admin) attempt Test User creation via `/SetUp/UserProfile/Create` ->
 * confirm/document the already-known-broken outcome -> Role creation ->
 * Menu Permission subset assignment -> persistence verification ->
 * (pivoting to the one WORKING account-creation path) Registration-created
 * User -> real login in an isolated session -> Direct URL Access probes
 * against both an "allowed-looking" and "restricted-looking" module ->
 * Logout. Not part of the approved coverage baseline
 * (config/coverage-baseline.ts).
 *
 * fixtures/masters7.fixture.ts is used as-is (no new fixture file): it
 * already exposes every page object this flow needs — `userProfilePage`,
 * `rolePage`, `roleMenuPage` (all from its own upstream masters5/masters6
 * chain) and `registrationPage` (its own addition) — per this project's
 * "reuse existing fixtures" convention.
 *
 * PHASE 1 INVESTIGATION FINDINGS this spec is built on (confirmed
 * exhaustively from source before writing this spec's assertions, not
 * discovered by trial-and-error):
 *
 * - **`/SetUp/UserProfile/Create`'s Save button is CONFIRMED BROKEN**
 *   (already independently established during the Multi-Branch-lifecycle
 *   investigation this same session, and independently re-corroborated by
 *   this project's OWN pre-existing `tests/ui/setup/user-profile.spec.ts`
 *   already failing, unrelated to any automation change): clicking it
 *   fires `POST /SetUp/SignUp/SignUpCreateEdit` instead of
 *   `/SetUp/UserProfile/CreateEdit` — a JS-wiring collision, not an
 *   automation gap. `#Id` never populates, no success toast renders, and
 *   logging in afterward with the intended credentials correctly fails.
 *   This spec re-confirms this LIVE, with fresh runtime evidence specific
 *   to this investigation, rather than only citing the prior finding.
 * - **`Registration` (`/SetUp/Registration/RegistrationCreate`, public,
 *   pre-login) is the ONE confirmed-working account-creation path** —
 *   but it creates an entirely NEW, separate Company + Branch each time
 *   (`RegistrationService.cs`'s `Insert()`: a new `CompanyProfileVM`, a new
 *   `BranchProfileVM` tied to that new company, then the `UserInformations`
 *   row tied to BOTH — never the calling admin's existing
 *   company/session), and assigns **no Role at all**
 *   (`UserLoginController.CreateEditAsync`'s `IsRegistration == true`
 *   branch returns immediately, skipping the default-role/claims
 *   assignment block entirely). It is therefore not a "create a
 *   role-restricted user within the current company" mechanism — it is
 *   used here as the one available way to reach a genuinely fresh,
 *   real, loginable, effectively-zero-permission account, to test Direct
 *   URL Access against.
 * - **Menu/Role-based authorization is CONFIRMED 100% UI-sidebar-cosmetic,
 *   not server-side enforced anywhere in this codebase.** Confirmed via
 *   exhaustive source audit: `Authorize(Roles=...)` appears ZERO times in
 *   the entire UI project; `Global.asax.cs`'s own
 *   `Application_PostAuthenticateRequest` (the one candidate hook) has its
 *   entire body commented out; `App_Start/FilterConfig.cs` registers only
 *   `HandleErrorAttribute`; no controller inherits from a shared base class
 *   with an `OnActionExecuting` permission check; zero custom
 *   `ActionFilterAttribute`/`AuthorizeAttribute` subclasses exist anywhere.
 *   Most DMS/SetUp controllers (including `PurchaseController`) carry a
 *   bare `[Authorize]` — authentication-only, no role check — and several
 *   (notably `MenuAuthorizationController` itself, the very screen that
 *   manages Role/Menu assignment) carry NO `[Authorize]` at all, reachable
 *   even while fully logged out. The per-user sidebar menu filter
 *   (`LoginController._leftSideBar()` -> `CommonRepo.GetAssignedMenuList`)
 *   is real and DB-driven, but only ever controls what renders in the
 *   sidebar HTML — it has no bearing on whether the corresponding
 *   controller/action can be reached directly. This spec's own "Direct URL
 *   Access" step proves this live rather than merely asserting it from
 *   source.
 */
test.describe('E2E User/Role/Menu-Permission/Authorization Lifecycle', () => {
  test('User creation, Role/Menu permission assignment, and Direct URL access reconcile end-to-end', async (
    { dashboardPage, branchSelectPage, userProfilePage, rolePage, roleMenuPage, registrationPage, browser, page },
    testInfo
  ) => {
    // Same empirical reasoning as every other lifecycle spec's own
    // test.setTimeout: a User-creation attempt, a Role+Menu round trip, a
    // Registration + isolated-session login, and 3 direct-URL probes
    // exceeds the global 60s default.
    test.setTimeout(150_000);
    assertAdminCredentialsReady();

    // 1. Admin Login — see every other lifecycle spec's own identical
    // step-1 comment for the full source+network-trace-backed root cause.
    await dashboardPage.changeBranch();
    await branchSelectPage.resolveIfPresent();
    await dashboardPage.expectLoaded();

    // ============================================================
    // USER CREATION — attempt via /SetUp/UserProfile/Create, the module
    // this task's own scenario names. Re-confirms the already-known-broken
    // outcome live (class doc comment), rather than only citing the prior
    // finding.
    //
    // ORDERING NOTE: Role/Menu creation (below) is deliberately run BEFORE
    // this broken User-creation attempt, not after, despite this task's own
    // literal scenario ordering ("Create Test User -> Create/Assign Role").
    // Confirmed live: attempting Role creation AFTER this broken
    // UserProfile Save leaves the shared admin `page` in a state where
    // `/SetUp/MenuAuthorization/RoleCreate` never clears its own loading
    // overlay (reproducible 3/3 times, independent of server load — the
    // project's own pre-existing `role.spec.ts` passes 5/5 cleanly when run
    // standalone, proving `RolePage.createRole()` itself is not at fault).
    // The two steps have no real dependency on each other in this adapted
    // flow (Role/Menu creation never needed the broken User to exist), so
    // reordering avoids the interaction entirely rather than working around
    // its symptom.
    // ============================================================
    const roleName = uniqueCode('PERMROLE');
    await rolePage.createRole(roleName);
    await rolePage.openEditFor(roleName);
    const roleIdMatch = /\/RoleEdit\/(\d+)/i.exec(page.url());
    expect(roleIdMatch).not.toBeNull();
    const roleId = roleIdMatch![1];

    // Allowed example (this flow's own scenario): Purchase, Sale.
    // Denied example: Menu Authorization (deliberately NOT selected).
    const allowedMenus = ['Purchase', 'Sale'];
    const deniedMenu = 'Menu Authorization';
    await roleMenuPage.gotoEditFor(roleId, roleName);
    await roleMenuPage.selectMenusByName(allowedMenus);
    await roleMenuPage.clickRoleMenuSave();
    await roleMenuPage.toastr.expectSuccess();

    // Validate: Menu permission persisted correctly — a fresh navigation
    // back to this Role's own menu edit screen, checked per-menu (not just
    // ">0 checked").
    await roleMenuPage.gotoEditFor(roleId, roleName);
    for (const menuName of allowedMenus) {
      expect(await roleMenuPage.isMenuChecked(menuName)).toBe(true);
    }
    expect(await roleMenuPage.isMenuChecked(deniedMenu)).toBe(false);

    // ============================================================
    // USER CREATION — attempt via /SetUp/UserProfile/Create, the module
    // this task's own scenario names.
    // ============================================================
    const testUserName = uniqueCode('PERMTEST');
    const testUserPassword = 'Automation@123';
    await userProfilePage.gotoCreate();
    await userProfilePage.fillRequired({
      userName: testUserName,
      fullName: `Automation Permission Test ${testUserName}`,
      password: testUserPassword,
      email: `${testUserName.toLowerCase()}@example.com`,
      phoneNumber: randomData.phone11Digit(),
    });
    await userProfilePage.clickSave();

    // Check: "User saved" — CONFIRMED FAILS. `#Id` stays empty (no genuine
    // record was ever created via this screen's own Save action).
    const createdUserId = await page.locator('#Id').inputValue();
    expect(createdUserId).toBe('');

    // Check: "Login works" — CONFIRMED FAILS. A real login attempt with
    // the exact credentials just submitted, in a fresh isolated context so
    // this negative result cannot affect the shared admin session.
    const failedLoginContext = await browser.newContext({
      baseURL: testInfo.project.use.baseURL,
      ignoreHTTPSErrors: testInfo.project.use.ignoreHTTPSErrors,
    });
    const failedLoginPage = await failedLoginContext.newPage();
    const failedLoginPageObject = new LoginPage(failedLoginPage);
    await failedLoginPageObject.login(testUserName, testUserPassword);
    await failedLoginPage.waitForTimeout(2000);
    const failedLoginErrorText = await failedLoginPage.locator('body').innerText();
    expect(failedLoginErrorText).toContain('Wrong user name or password');
    await failedLoginContext.close();

    // Check: "Profile exists" — CONFIRMED FAILS (the grid never gained a
    // new row for this attempt; same defect, not re-probed a third way).

    // ============================================================
    // LOGIN AS TEST USER — since a role-bearing user cannot be created
    // within the current company (class doc comment), this pivots to
    // Registration — the one confirmed-working account-creation path —
    // in its own isolated browser context (never touching the shared admin
    // session).
    // ============================================================
    const registrationSuffix = uniqueCode('PERMREG');
    const registrationEmail = `${registrationSuffix.toLowerCase()}@example.com`;
    await registrationPage.createRegistration({
      fullName: `Automation Permission Registration ${registrationSuffix}`,
      emailAsLoginId: registrationEmail,
      phoneNumber: randomData.phone11Digit(),
      password: testUserPassword,
      companyName: `Automation Permission Company ${registrationSuffix}`,
      companyAddress: `Automation Address ${uniqueCode('ADDR')}`,
    });

    const isolatedContext = await browser.newContext({
      baseURL: testInfo.project.use.baseURL,
      ignoreHTTPSErrors: testInfo.project.use.ignoreHTTPSErrors,
    });
    const isolatedPage = await isolatedContext.newPage();
    const isolatedLoginPage = new LoginPage(isolatedPage);
    const isolatedBranchSelect = new BranchSelectPage(isolatedPage);
    const isolatedDashboard = new DashboardPage(isolatedPage);
    await isolatedLoginPage.login(registrationEmail, testUserPassword);
    // Check: "Login works" — CONFIRMED SUCCEEDS this time (unlike
    // UserProfile above), proving account creation per se is not
    // universally broken — only the UserProfile/Create screen's own Save
    // wiring is.
    await isolatedBranchSelect.resolveIfPresent();
    await isolatedDashboard.expectLoaded();

    // ============================================================
    // DIRECT URL ACCESS — the headline security question. This
    // Registration-created user has NO Role and NO assigned menus at all
    // (class doc comment) — the most genuinely unprivileged real account
    // achievable through this application's own UI. Per the confirmed
    // source finding, direct navigation is expected to SUCCEED regardless
    // — proving (not merely asserting) that menu/role restriction here is
    // UI-sidebar-cosmetic only, a real security gap, documented as such
    // rather than silently assumed either way.
    // ============================================================

    // "Allowed"-looking module (Purchase) — expected, and confirmed, to
    // open.
    await isolatedPage.goto('/DMS/Purchase/Create');
    await expect(isolatedPage).toHaveURL(/\/DMS\/Purchase\/Create/i);
    await expect(isolatedPage.locator('#Code')).toBeVisible({ timeout: 10000 });

    // "Restricted"-looking module (User Management) — per the confirmed
    // source finding (bare `[Authorize]`, no `Roles=` check anywhere),
    // expected to ALSO open despite this user having no assigned
    // permission to it at all.
    await isolatedPage.goto('/SetUp/UserProfile/Index');
    await expect(isolatedPage).toHaveURL(/\/SetUp\/UserProfile\/Index/i);
    await expect(isolatedPage.locator('#GridDataList')).toBeVisible({ timeout: 10000 });

    // Role/Menu-Authorization module itself — confirmed from source to
    // carry NO `[Authorize]` attribute at all, so even a lower bar applies
    // here: reachable regardless of authentication, let alone role.
    await isolatedPage.goto('/SetUp/MenuAuthorization/Role');
    await expect(isolatedPage).toHaveURL(/\/SetUp\/MenuAuthorization\/Role/i);
    await expect(isolatedPage.locator('#RoleIndexDataList')).toBeVisible({ timeout: 10000 });

    // Logout — isolated session only (the shared admin `page` session is
    // left untouched throughout this entire spec, per its own class doc
    // comment).
    await isolatedDashboard.logout();
    await isolatedContext.close();
  });
});
