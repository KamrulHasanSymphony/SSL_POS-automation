import { test, expect } from '../../../fixtures/masters4.fixture';
import { assertAdminCredentialsReady } from '../../../utils/env';
import { uniqueCode } from '../../../utils/random-data';
import { tags } from '../../../config/tags';

/**
 * STEP 9 Phase C module: MasterItem (PROP-MITEM-001..005), approved exactly
 * as documented in STEP 9.1/9.2C. Runs under the "authenticated" project.
 * Requires 1 real MasterItemGroup (STEP 9.2A UI flow) and 1 real UOM
 * (STEP 5 API helper) — see masters4.fixture.ts's masterItemPrerequisites.
 * Confirmed structurally identical to Product (STEP 5): MasterItemGroupId/
 * UOMId are working Kendo MultiColumnComboBoxes (NOT broken like Areas').
 *
 * Delete is explicitly OUT OF SCOPE: button commented out on Index. The
 * confirmed broken NextPrevious/bulk-delete defects noted in STEP 9.1 are
 * NOT converted into @known-defect tests here per this phase's explicit
 * instruction — none of the approved scenarios below touch them.
 */
test.describe('MasterItem — PROP-MITEM', () => {
  test(`PROP-MITEM-001 List/grid loads ${tags.regression} ${tags.p1}`, async ({ masterItemPage, masterItemPrerequisites }) => {
    assertAdminCredentialsReady();

    const { masterItemGroupName, uomName } = await masterItemPrerequisites();
    const name = uniqueCode('MITEM');
    const code = await masterItemPage.createMasterItem({ name, masterItemGroupName, uomName });

    await masterItemPage.goto();
    await masterItemPage.grid.search(code);
    await masterItemPage.grid.waitForLoad();
    expect(await masterItemPage.grid.rowCount()).toBeGreaterThanOrEqual(1);
    await expect(await masterItemPage.grid.findRowByText(code)).toBeVisible();
  });

  test(`PROP-MITEM-002 Create with required fields succeeds ${tags.regression} ${tags.p0}`, async ({
    masterItemPage,
    masterItemPrerequisites,
  }) => {
    assertAdminCredentialsReady();

    const { masterItemGroupName, uomName } = await masterItemPrerequisites();
    const name = uniqueCode('MITEM');
    const code = await masterItemPage.createMasterItem({ name, masterItemGroupName, uomName });

    await masterItemPage.goto();
    await masterItemPage.grid.search(code);
    await expect(await masterItemPage.grid.findRowByText(code)).toBeVisible();
  });

  test(`PROP-MITEM-003 Create with empty Name rejected ${tags.regression} ${tags.negative} ${tags.p1}`, async ({
    masterItemPage,
    page,
  }) => {
    assertAdminCredentialsReady();

    await masterItemPage.gotoCreate();
    // Name deliberately left empty; MasterItemGroupId/UOMId deliberately left
    // untouched too — validator.form() covers Name independently of the
    // separate validateDropdown() checks for the two combos (same confirmed
    // pattern as Areas/MasterSupplierGroup).
    await masterItemPage.clickSave();

    await masterItemPage.expectNameRequiredValidation();
    await expect(page).toHaveURL(/\/DMS\/MasterItem\/Create/i);
  });

  test(`PROP-MITEM-004 Edit and verify persistence ${tags.regression} ${tags.p1}`, async ({
    masterItemPage,
    masterItemPrerequisites,
  }) => {
    assertAdminCredentialsReady();

    const { masterItemGroupName, uomName } = await masterItemPrerequisites();
    const originalName = uniqueCode('MITEM');
    const code = await masterItemPage.createMasterItem({ name: originalName, masterItemGroupName, uomName });

    await masterItemPage.openEditFor(code);
    const updatedName = uniqueCode('MITEM');
    await masterItemPage.updateName(updatedName);

    await masterItemPage.goto();
    await masterItemPage.grid.search(updatedName);
    await expect(await masterItemPage.grid.findRowByText(updatedName)).toBeVisible();
  });

  test(`PROP-MITEM-005 Grid search filters ${tags.regression} ${tags.p2}`, async ({
    masterItemPage,
    masterItemPrerequisites,
  }) => {
    assertAdminCredentialsReady();

    const { masterItemGroupName, uomName } = await masterItemPrerequisites();
    const name = uniqueCode('MITEM');
    const code = await masterItemPage.createMasterItem({ name, masterItemGroupName, uomName });

    await masterItemPage.goto();
    await masterItemPage.grid.search(code);
    await masterItemPage.grid.waitForLoad();

    expect(await masterItemPage.grid.rowCount()).toBe(1);
    await expect(await masterItemPage.grid.findRowByText(code)).toBeVisible();
  });
});
