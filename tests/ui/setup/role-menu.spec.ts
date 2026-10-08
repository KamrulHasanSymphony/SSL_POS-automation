import { test, expect } from '../../../fixtures/masters6.fixture';
import { assertAdminCredentialsReady } from '../../../utils/env';
import { tags } from '../../../config/tags';

/**
 * STEP 10 Phase B module: RoleMenu (PROP-ROLEMENU-001..004), approved
 * exactly as documented in STEP 10.2/10.3B. Runs under the "authenticated"
 * project. See pages/setup/RoleMenuPage.ts for the full source trail:
 * the real functional entry point is `RoleMenuEdit/{roleId}?roleName=`,
 * not the generic `Create()` action; validation is purely
 * "at least one checkbox checked", exercised via the `.chkAll` header
 * checkbox rather than a hard-coded specific menu name.
 */
test.describe('RoleMenu — PROP-ROLEMENU', () => {
  test(`PROP-ROLEMENU-001 List/grid loads and displays records ${tags.regression} ${tags.p1}`, async ({
    roleMenuPage,
    roleWithIdPrerequisite,
  }) => {
    assertAdminCredentialsReady();

    const { roleId, roleName } = await roleWithIdPrerequisite();
    await roleMenuPage.assignAllMenus(roleId, roleName);

    await roleMenuPage.goto();
    await roleMenuPage.grid.search(roleName);
    await roleMenuPage.grid.waitForLoad();
    expect(await roleMenuPage.grid.rowCount()).toBeGreaterThanOrEqual(1);
    await expect(await roleMenuPage.grid.findRowByText(roleName)).toBeVisible();
  });

  test(`PROP-ROLEMENU-002 Create assigns menu access to a Role succeeds ${tags.regression} ${tags.p0}`, async ({
    roleMenuPage,
    roleWithIdPrerequisite,
  }) => {
    assertAdminCredentialsReady();

    const { roleId, roleName } = await roleWithIdPrerequisite();
    await roleMenuPage.assignAllMenus(roleId, roleName);
  });

  test(`PROP-ROLEMENU-003 Submit with no checkbox selected rejected ${tags.regression} ${tags.negative} ${tags.p1}`, async ({
    roleMenuPage,
    roleWithIdPrerequisite,
  }) => {
    assertAdminCredentialsReady();

    const { roleId, roleName } = await roleWithIdPrerequisite();
    await roleMenuPage.gotoEditFor(roleId, roleName);
    // No checkbox selected.
    await roleMenuPage.clickRoleMenuSave();

    await roleMenuPage.expectNoCheckboxSelectedWarning();
  });

  test(`PROP-ROLEMENU-004 Edit and verify persistence ${tags.regression} ${tags.p1}`, async ({
    roleMenuPage,
    roleWithIdPrerequisite,
  }) => {
    assertAdminCredentialsReady();

    const { roleId, roleName } = await roleWithIdPrerequisite();
    await roleMenuPage.assignAllMenus(roleId, roleName);

    await roleMenuPage.gotoEditFor(roleId, roleName);
    await roleMenuPage.expectMenusChecked();
  });
});
