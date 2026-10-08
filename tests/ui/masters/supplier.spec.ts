import { test, expect } from '../../../fixtures/masters.fixture';
import { assertAdminCredentialsReady } from '../../../utils/env';
import { uniqueCode } from '../../../utils/random-data';
import { tags } from '../../../config/tags';

/**
 * STEP 5 module: Supplier (PROP-SUPP-001..007) — PROPOSED SOURCE-VERIFIED
 * COVERAGE, approved as the authoritative STEP 5 scope. Runs under the
 * "authenticated" project.
 *
 * Prerequisite (Supplier Group) is created via API only (masters.fixture's
 * supplierPrerequisites) — the Supplier module itself is always exercised
 * through the real UI, per the API Setup Rule. MasterSupplier is confirmed
 * NOT referenced anywhere in the Supplier Create/Edit form and is therefore
 * out of scope (STEP 5 approved decision §4) — no MasterSupplier
 * prerequisite is created here.
 *
 * Delete is explicitly OUT OF SCOPE (STEP 5 approved decision §3): the
 * Delete button is confirmed commented out of Supplier/Index.cshtml.
 */
test.describe('Supplier — PROP-SUPP', () => {
  test(`PROP-SUPP-001 Supplier list/grid loads and displays records ${tags.regression} ${tags.smoke} ${tags.p0}`, async ({
    supplierPage,
    supplierPrerequisites,
  }) => {
    assertAdminCredentialsReady();

    const { supplierGroupName } = await supplierPrerequisites();
    const name = uniqueCode('SUPPLIER');
    await supplierPage.createSupplier({
      name,
      supplierGroupName,
      address: `Automation Address ${uniqueCode('ADDR')}`,
    });

    await supplierPage.goto();
    await supplierPage.grid.search(name);
    await supplierPage.grid.waitForLoad();
    expect(await supplierPage.grid.rowCount()).toBeGreaterThanOrEqual(1);
    await expect(await supplierPage.grid.findRowByText(name)).toBeVisible();
  });

  test(`PROP-SUPP-002 Create Supplier with required fields succeeds ${tags.regression} ${tags.smoke} ${tags.p0}`, async ({
    supplierPage,
    supplierPrerequisites,
  }) => {
    assertAdminCredentialsReady();

    const { supplierGroupName } = await supplierPrerequisites();
    const name = uniqueCode('SUPPLIER');
    await supplierPage.createSupplier({
      name,
      supplierGroupName,
      address: `Automation Address ${uniqueCode('ADDR')}`,
    });

    // Verify actual persistence, not just the toast.
    await supplierPage.goto();
    await supplierPage.grid.search(name);
    await expect(await supplierPage.grid.findRowByText(name)).toBeVisible();
  });

  test(`PROP-SUPP-003 Create Supplier with empty Name is rejected ${tags.regression} ${tags.negative} ${tags.p1}`, async ({
    supplierPage,
    supplierPrerequisites,
    page,
  }) => {
    assertAdminCredentialsReady();

    const { supplierGroupName } = await supplierPrerequisites();
    await supplierPage.gotoCreate();
    await supplierPage.selectSupplierGroup(supplierGroupName);
    await supplierPage.fillAddress(`Automation Address ${uniqueCode('ADDR')}`);
    // Name deliberately left empty.
    await supplierPage.clickSave();

    await supplierPage.expectNameRequiredValidation();
    await expect(page).toHaveURL(/\/DMS\/Supplier\/Create/i);
  });

  test(`PROP-SUPP-004 Create Supplier without Supplier Group is rejected ${tags.regression} ${tags.negative} ${tags.p1}`, async ({
    supplierPage,
    page,
  }) => {
    assertAdminCredentialsReady();

    await supplierPage.gotoCreate();
    await supplierPage.fillName(uniqueCode('SUPPLIER'));
    await supplierPage.fillAddress(`Automation Address ${uniqueCode('ADDR')}`);
    // Supplier Group deliberately left unselected.
    await supplierPage.clickSave();

    await supplierPage.expectSupplierGroupRequiredIndicated();
    await expect(page).toHaveURL(/\/DMS\/Supplier\/Create/i);
  });

  test(`PROP-SUPP-005 Create Supplier with empty Address is rejected ${tags.regression} ${tags.negative} ${tags.p1}`, async ({
    supplierPage,
    supplierPrerequisites,
    page,
  }) => {
    assertAdminCredentialsReady();

    const { supplierGroupName } = await supplierPrerequisites();
    await supplierPage.gotoCreate();
    await supplierPage.fillName(uniqueCode('SUPPLIER'));
    await supplierPage.selectSupplierGroup(supplierGroupName);
    // Address deliberately left empty.
    await supplierPage.clickSave();

    await supplierPage.expectAddressRequiredValidation();
    await expect(page).toHaveURL(/\/DMS\/Supplier\/Create/i);
  });

  test(`PROP-SUPP-006 Edit Supplier Name and verify persistence ${tags.regression} ${tags.p0}`, async ({
    supplierPage,
    supplierPrerequisites,
  }) => {
    assertAdminCredentialsReady();

    const { supplierGroupName } = await supplierPrerequisites();
    const originalName = uniqueCode('SUPPLIER');
    await supplierPage.createSupplier({
      name: originalName,
      supplierGroupName,
      address: `Automation Address ${uniqueCode('ADDR')}`,
    });

    await supplierPage.openEditFor(originalName);
    const updatedName = uniqueCode('SUPPLIER');
    await supplierPage.updateName(updatedName);

    await supplierPage.goto();
    await supplierPage.grid.search(updatedName);
    await expect(await supplierPage.grid.findRowByText(updatedName)).toBeVisible();
  });

  test(`PROP-SUPP-007 Supplier grid search filters by Code/Name/City ${tags.regression} ${tags.p2}`, async ({
    supplierPage,
    supplierPrerequisites,
  }) => {
    assertAdminCredentialsReady();

    const { supplierGroupName } = await supplierPrerequisites();
    const name = uniqueCode('SUPPLIER');
    await supplierPage.createSupplier({
      name,
      supplierGroupName,
      address: `Automation Address ${uniqueCode('ADDR')}`,
    });

    await supplierPage.goto();
    await supplierPage.grid.search(name);
    await supplierPage.grid.waitForLoad();

    expect(await supplierPage.grid.rowCount()).toBe(1);
    await expect(await supplierPage.grid.findRowByText(name)).toBeVisible();
  });
});
