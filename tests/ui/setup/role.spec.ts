import { test, expect } from '../../../fixtures/masters5.fixture';
import { assertAdminCredentialsReady } from '../../../utils/env';
import { uniqueCode } from '../../../utils/random-data';
import { tags } from '../../../config/tags';

/**
 * STEP 10 Phase A module: Role (PROP-ROLE-001..005), approved exactly as
 * documented in STEP 10.2/10.3A. Runs under the "authenticated" project.
 * See pages/setup/RolePage.ts for the full source trail: `.btnRoleSave`
 * save-button class (not the generic `.btnsave`), no `Code` property (Name
 * is the unique identifier), `#RoleIndexDataList` grid container.
 *
 * Delete is explicitly OUT OF SCOPE: no Delete action exists on
 * MenuAuthorizationController at all for Role.
 */
test.describe('Role — PROP-ROLE', () => {
  test(`PROP-ROLE-001 List/grid loads and displays records ${tags.regression} ${tags.p1}`, async ({ rolePage }) => {
    assertAdminCredentialsReady();

    const name = uniqueCode('ROLE');
    await rolePage.createRole(name);

    await rolePage.goto();
    await rolePage.grid.search(name);
    await rolePage.grid.waitForLoad();
    expect(await rolePage.grid.rowCount()).toBeGreaterThanOrEqual(1);
    await expect(await rolePage.grid.findRowByText(name)).toBeVisible();
  });

  test(`PROP-ROLE-002 Create with required Name succeeds ${tags.regression} ${tags.p0}`, async ({ rolePage }) => {
    assertAdminCredentialsReady();

    const name = uniqueCode('ROLE');
    await rolePage.createRole(name);

    await rolePage.goto();
    await rolePage.grid.search(name);
    await expect(await rolePage.grid.findRowByText(name)).toBeVisible();
  });

  test(`PROP-ROLE-003 Create with empty Name rejected ${tags.regression} ${tags.negative} ${tags.p1}`, async ({ rolePage, page }) => {
    assertAdminCredentialsReady();

    await rolePage.gotoCreate();
    // Name deliberately left empty.
    await rolePage.clickRoleSave();

    await rolePage.expectNameRequiredValidation();
    await expect(page).toHaveURL(/\/SetUp\/MenuAuthorization\/RoleCreate/i);
  });

  test(`PROP-ROLE-004 Edit and verify persistence ${tags.regression} ${tags.p1}`, async ({ rolePage }) => {
    assertAdminCredentialsReady();

    const originalName = uniqueCode('ROLE');
    await rolePage.createRole(originalName);

    await rolePage.openEditFor(originalName);
    const updatedName = uniqueCode('ROLE');
    await rolePage.updateName(updatedName);

    await rolePage.goto();
    await rolePage.grid.search(updatedName);
    await expect(await rolePage.grid.findRowByText(updatedName)).toBeVisible();
  });

  test(`PROP-ROLE-005 Grid search filters ${tags.regression} ${tags.p2}`, async ({ rolePage }) => {
    assertAdminCredentialsReady();

    const name = uniqueCode('ROLE');
    await rolePage.createRole(name);

    await rolePage.goto();
    await rolePage.grid.search(name);
    await rolePage.grid.waitForLoad();

    expect(await rolePage.grid.rowCount()).toBe(1);
    await expect(await rolePage.grid.findRowByText(name)).toBeVisible();
  });
});
