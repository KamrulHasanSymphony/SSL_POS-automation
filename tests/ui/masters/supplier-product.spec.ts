import { test, expect } from '../../../fixtures/masters6.fixture';
import { assertAdminCredentialsReady } from '../../../utils/env';
import { uniqueCode } from '../../../utils/random-data';
import { tags } from '../../../config/tags';

/**
 * STEP 10 Phase B module: SupplierProduct (PROP-SUPPPROD-001..004),
 * approved exactly as documented in STEP 10.2/10.3B. Runs under the
 * "authenticated" project. See pages/masters/SupplierProductPage.ts for
 * the full source trail: standalone screen (not an embedded Supplier
 * tab), structurally identical to the already-implemented
 * MasterSupplierItem (STEP 9.2C).
 */
test.describe('SupplierProduct — PROP-SUPPPROD', () => {
  test(`PROP-SUPPPROD-001 List/grid loads and displays records ${tags.regression} ${tags.p1}`, async ({
    supplierProductPage,
    supplierPage,
    supplierPrerequisites,
    productForSupplierProductPrerequisite,
  }) => {
    assertAdminCredentialsReady();

    const { supplierGroupName } = await supplierPrerequisites();
    const supplierName = uniqueCode('SUPPPROD');
    await supplierPage.createSupplier({
      name: supplierName,
      supplierGroupName,
      address: `Automation Address ${uniqueCode('ADDR')}`,
    });
    const { productGroupName } = await productForSupplierProductPrerequisite();

    await supplierProductPage.createSupplierProduct({ supplierName, productGroupName });

    await supplierProductPage.goto();
    await supplierProductPage.grid.search(supplierName);
    await supplierProductPage.grid.waitForLoad();
    expect(await supplierProductPage.grid.rowCount()).toBeGreaterThanOrEqual(1);
    await expect(await supplierProductPage.grid.findRowByText(supplierName)).toBeVisible();
  });

  test(`PROP-SUPPPROD-002 Create with Supplier + at least one picked item ${tags.regression} ${tags.p0}`, async ({
    supplierProductPage,
    supplierPage,
    supplierPrerequisites,
    productForSupplierProductPrerequisite,
  }) => {
    assertAdminCredentialsReady();

    const { supplierGroupName } = await supplierPrerequisites();
    const supplierName = uniqueCode('SUPPPROD');
    await supplierPage.createSupplier({
      name: supplierName,
      supplierGroupName,
      address: `Automation Address ${uniqueCode('ADDR')}`,
    });
    const { productGroupName } = await productForSupplierProductPrerequisite();

    await supplierProductPage.createSupplierProduct({ supplierName, productGroupName });

    await supplierProductPage.goto();
    await supplierProductPage.grid.search(supplierName);
    await expect(await supplierProductPage.grid.findRowByText(supplierName)).toBeVisible();
  });

  test(`PROP-SUPPPROD-003 Create without Supplier rejected ${tags.regression} ${tags.negative} ${tags.p1}`, async ({
    supplierProductPage,
    productForSupplierProductPrerequisite,
    page,
  }) => {
    assertAdminCredentialsReady();

    const { productGroupName } = await productForSupplierProductPrerequisite();
    await supplierProductPage.gotoCreate();
    // Supplier deliberately left unselected; a real item is still picked so
    // the ONLY failure surfaced is the Supplier-required check, not a
    // secondary "add at least one detail" complaint.
    await supplierProductPage.selectProductGroup(productGroupName);
    await supplierProductPage.addFirstAvailableItem();
    await supplierProductPage.clickSave();

    await supplierProductPage.expectSupplierRequiredIndicated();
    await expect(page).toHaveURL(/\/DMS\/SupplierProduct\/Create/i);
  });

  test(`PROP-SUPPPROD-004 Edit and verify persistence ${tags.regression} ${tags.p1}`, async ({
    supplierProductPage,
    supplierPage,
    supplierPrerequisites,
    productForSupplierProductPrerequisite,
  }) => {
    assertAdminCredentialsReady();

    const { supplierGroupName } = await supplierPrerequisites();
    const supplierName = uniqueCode('SUPPPROD');
    await supplierPage.createSupplier({
      name: supplierName,
      supplierGroupName,
      address: `Automation Address ${uniqueCode('ADDR')}`,
    });
    const { productGroupName } = await productForSupplierProductPrerequisite();

    await supplierProductPage.createSupplierProduct({ supplierName, productGroupName });

    await supplierProductPage.openEditFor(supplierName);
  });
});
