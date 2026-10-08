import { test, expect } from '../../../fixtures/masters.fixture';
import { assertAdminCredentialsReady } from '../../../utils/env';
import { uniqueCode } from '../../../utils/random-data';
import { tags } from '../../../config/tags';

/**
 * STEP 5 module: Product (PROP-PROD-001..008) — PROPOSED SOURCE-VERIFIED
 * COVERAGE, approved as the authoritative STEP 5 scope (the original STEP 2
 * matrix for this module could not be recovered — see the STEP 5 chat
 * record). Runs under the "authenticated" project (tests/ui/masters/** is
 * not tests/ui/auth/** or tests/ui/security/**), reusing storage/auth.json
 * via the setup -> authenticated project dependency.
 *
 * Prerequisites (Product Group, UOM) are created via API only
 * (masters.fixture's productPrerequisites) — per the API Setup Rule, the
 * Product module itself is always exercised through the real UI.
 *
 * Delete is explicitly OUT OF SCOPE (STEP 5 approved decision §3): the
 * Delete button is confirmed commented out of Product/Index.cshtml, so
 * there is no UI entry point to test.
 */
test.describe('Product — PROP-PROD', () => {
  test(`PROP-PROD-001 Product list/grid loads and displays records ${tags.regression} ${tags.smoke} ${tags.p0}`, async ({
    productPage,
    productPrerequisites,
  }) => {
    assertAdminCredentialsReady();

    const { productGroupName, uomName } = await productPrerequisites();
    const name = uniqueCode('PRODUCT');
    await productPage.createProduct({ name, productGroupName, uomName });

    await productPage.goto();
    await productPage.grid.search(name);
    await productPage.grid.waitForLoad();
    expect(await productPage.grid.rowCount()).toBeGreaterThanOrEqual(1);
    await expect(await productPage.grid.findRowByText(name)).toBeVisible();
  });

  test(`PROP-PROD-002 Create Product with all required fields succeeds ${tags.regression} ${tags.smoke} ${tags.p0}`, async ({
    productPage,
    productPrerequisites,
  }) => {
    assertAdminCredentialsReady();

    const { productGroupName, uomName } = await productPrerequisites();
    const name = uniqueCode('PRODUCT');

    await productPage.createProduct({ name, productGroupName, uomName });

    // Verify actual persistence, not just the toast (STEP 5 §11 Create Test Rule).
    await productPage.goto();
    await productPage.grid.search(name);
    await expect(await productPage.grid.findRowByText(name)).toBeVisible();
  });

  test(`PROP-PROD-003 Create Product with empty Name is rejected ${tags.regression} ${tags.negative} ${tags.p1}`, async ({
    productPage,
    productPrerequisites,
    page,
  }) => {
    assertAdminCredentialsReady();

    const { productGroupName, uomName } = await productPrerequisites();
    await productPage.gotoCreate();
    await productPage.selectProductGroup(productGroupName);
    await productPage.selectUom(uomName);
    // Name deliberately left empty.
    await productPage.clickSave();

    await productPage.expectNameRequiredValidation();
    await expect(page).toHaveURL(/\/DMS\/Product\/Create/i);
  });

  test(`PROP-PROD-004 Create Product without Product Group is rejected ${tags.regression} ${tags.negative} ${tags.p1}`, async ({
    productPage,
    productPrerequisites,
    page,
  }) => {
    assertAdminCredentialsReady();

    const { uomName } = await productPrerequisites();
    await productPage.gotoCreate();
    await productPage.fillName(uniqueCode('PRODUCT'));
    await productPage.selectUom(uomName);
    // Product Group deliberately left unselected.
    await productPage.clickSave();

    await productPage.expectProductGroupRequiredIndicated();
    await expect(page).toHaveURL(/\/DMS\/Product\/Create/i);
  });

  test(`PROP-PROD-005 Create Product without UOM is rejected ${tags.regression} ${tags.negative} ${tags.p1}`, async ({
    productPage,
    productPrerequisites,
    page,
  }) => {
    assertAdminCredentialsReady();

    const { productGroupName } = await productPrerequisites();
    await productPage.gotoCreate();
    await productPage.fillName(uniqueCode('PRODUCT'));
    await productPage.selectProductGroup(productGroupName);
    // UOM deliberately left unselected.
    await productPage.clickSave();

    await productPage.expectUomRequiredIndicated();
    await expect(page).toHaveURL(/\/DMS\/Product\/Create/i);
  });

  test(`PROP-PROD-006 Edit Product Name and verify persistence ${tags.regression} ${tags.p0}`, async ({
    productPage,
    productPrerequisites,
  }) => {
    assertAdminCredentialsReady();

    const { productGroupName, uomName } = await productPrerequisites();
    const originalName = uniqueCode('PRODUCT');
    await productPage.createProduct({ name: originalName, productGroupName, uomName });

    await productPage.openEditFor(originalName);
    const updatedName = uniqueCode('PRODUCT');
    await productPage.updateName(updatedName);

    // Re-open the grid (fresh navigation) and confirm the NEW name persisted,
    // not just that the in-page form showed it after clicking Update.
    await productPage.goto();
    await productPage.grid.search(updatedName);
    await expect(await productPage.grid.findRowByText(updatedName)).toBeVisible();
  });

  test(`PROP-PROD-007 Product grid search filters by Code/Name ${tags.regression} ${tags.p2}`, async ({
    productPage,
    productPrerequisites,
  }) => {
    assertAdminCredentialsReady();

    const { productGroupName, uomName } = await productPrerequisites();
    const name = uniqueCode('PRODUCT');
    await productPage.createProduct({ name, productGroupName, uomName });

    await productPage.goto();
    await productPage.grid.search(name);
    await productPage.grid.waitForLoad();

    expect(await productPage.grid.rowCount()).toBe(1);
    await expect(await productPage.grid.findRowByText(name)).toBeVisible();
  });

  test(`PROP-PROD-008 ProductStock appears on Create but not Edit ${tags.regression} ${tags.p2}`, async ({
    productPage,
    productPrerequisites,
  }) => {
    assertAdminCredentialsReady();

    await productPage.gotoCreate();
    expect(await productPage.isProductStockFieldPresent()).toBe(true);

    const { productGroupName, uomName } = await productPrerequisites();
    const name = uniqueCode('PRODUCT');
    await productPage.createProduct({ name, productGroupName, uomName });

    await productPage.openEditFor(name);
    expect(await productPage.isProductStockFieldPresent()).toBe(false);
  });
});
