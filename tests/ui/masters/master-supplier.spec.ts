import { test, expect } from '../../../fixtures/masters2.fixture';
import { assertAdminCredentialsReady } from '../../../utils/env';
import { uniqueCode } from '../../../utils/random-data';
import { tags } from '../../../config/tags';

/**
 * STEP 9 Phase A module: MasterSupplier (PROP-MSUPP-001..006), approved
 * exactly as documented in STEP 9.1/9.2A. Runs under the "authenticated"
 * project. Requires 1 real MasterSupplierGroup (confirmed FK,
 * `MasterSupplierGroupId`). Confirmed structurally separate from the
 * already-covered Supplier module (STEP 5).
 *
 * Delete is explicitly OUT OF SCOPE: action exists, button commented out.
 */
test.describe('MasterSupplier — PROP-MSUPP', () => {
  test(`PROP-MSUPP-001 List/grid loads and displays records ${tags.regression} ${tags.p1}`, async ({
    masterSupplierPage,
    masterSupplierGroupPrerequisite,
  }) => {
    assertAdminCredentialsReady();

    const { groupName } = await masterSupplierGroupPrerequisite();
    const name = uniqueCode('MSUPP');
    const code = await masterSupplierPage.createMasterSupplier({
      name,
      masterSupplierGroupName: groupName,
      address: `Automation Address ${uniqueCode('ADDR')}`,
    });

    await masterSupplierPage.goto();
    await masterSupplierPage.grid.search(code);
    await masterSupplierPage.grid.waitForLoad();
    expect(await masterSupplierPage.grid.rowCount()).toBeGreaterThanOrEqual(1);
    await expect(await masterSupplierPage.grid.findRowByText(code)).toBeVisible();
  });

  test(`PROP-MSUPP-002 Create with required fields succeeds ${tags.regression} ${tags.p0}`, async ({
    masterSupplierPage,
    masterSupplierGroupPrerequisite,
  }) => {
    assertAdminCredentialsReady();

    const { groupName } = await masterSupplierGroupPrerequisite();
    const name = uniqueCode('MSUPP');
    const code = await masterSupplierPage.createMasterSupplier({
      name,
      masterSupplierGroupName: groupName,
      address: `Automation Address ${uniqueCode('ADDR')}`,
    });

    await masterSupplierPage.goto();
    await masterSupplierPage.grid.search(code);
    await expect(await masterSupplierPage.grid.findRowByText(code)).toBeVisible();
  });

  test(`PROP-MSUPP-003 Create with empty Name rejected ${tags.regression} ${tags.negative} ${tags.p1}`, async ({
    masterSupplierPage,
    masterSupplierGroupPrerequisite,
    page,
  }) => {
    assertAdminCredentialsReady();

    const { groupName } = await masterSupplierGroupPrerequisite();
    await masterSupplierPage.gotoCreate();
    await masterSupplierPage.selectMasterSupplierGroup(groupName);
    await masterSupplierPage.fillAddress(`Automation Address ${uniqueCode('ADDR')}`);
    // Name deliberately left empty.
    await masterSupplierPage.clickSave();

    await masterSupplierPage.expectNameRequiredValidation();
    await expect(page).toHaveURL(/\/DMS\/MasterSupplier\/Create/i);
  });

  test(`PROP-MSUPP-004 Create with empty Address rejected ${tags.regression} ${tags.negative} ${tags.p1}`, async ({
    masterSupplierPage,
    masterSupplierGroupPrerequisite,
    page,
  }) => {
    assertAdminCredentialsReady();

    const { groupName } = await masterSupplierGroupPrerequisite();
    await masterSupplierPage.gotoCreate();
    await masterSupplierPage.fillName(uniqueCode('MSUPP'));
    await masterSupplierPage.selectMasterSupplierGroup(groupName);
    // Address deliberately left empty.
    await masterSupplierPage.clickSave();

    await masterSupplierPage.expectAddressRequiredValidation();
    await expect(page).toHaveURL(/\/DMS\/MasterSupplier\/Create/i);
  });

  test(`PROP-MSUPP-005 Edit and verify persistence ${tags.regression} ${tags.p1}`, async ({
    masterSupplierPage,
    masterSupplierGroupPrerequisite,
  }) => {
    assertAdminCredentialsReady();

    const { groupName } = await masterSupplierGroupPrerequisite();
    const originalName = uniqueCode('MSUPP');
    const code = await masterSupplierPage.createMasterSupplier({
      name: originalName,
      masterSupplierGroupName: groupName,
      address: `Automation Address ${uniqueCode('ADDR')}`,
    });

    await masterSupplierPage.openEditFor(code);
    const updatedName = uniqueCode('MSUPP');
    await masterSupplierPage.updateName(updatedName);

    await masterSupplierPage.goto();
    await masterSupplierPage.grid.search(updatedName);
    await expect(await masterSupplierPage.grid.findRowByText(updatedName)).toBeVisible();
  });

  test(`PROP-MSUPP-006 Grid search filters ${tags.regression} ${tags.p2}`, async ({
    masterSupplierPage,
    masterSupplierGroupPrerequisite,
  }) => {
    assertAdminCredentialsReady();

    const { groupName } = await masterSupplierGroupPrerequisite();
    const name = uniqueCode('MSUPP');
    const code = await masterSupplierPage.createMasterSupplier({
      name,
      masterSupplierGroupName: groupName,
      address: `Automation Address ${uniqueCode('ADDR')}`,
    });

    await masterSupplierPage.goto();
    await masterSupplierPage.grid.search(code);
    await masterSupplierPage.grid.waitForLoad();

    expect(await masterSupplierPage.grid.rowCount()).toBe(1);
    await expect(await masterSupplierPage.grid.findRowByText(code)).toBeVisible();
  });
});
