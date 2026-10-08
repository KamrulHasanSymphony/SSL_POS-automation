import { test, expect } from '../../../fixtures/masters2.fixture';
import { assertAdminCredentialsReady } from '../../../utils/env';
import { uniqueCode } from '../../../utils/random-data';
import { tags } from '../../../config/tags';

/**
 * STEP 9 Phase A module: BusinessType (PROP-BIZTYPE-001..005), approved
 * exactly as documented in STEP 9.1/9.2A. Runs under the "authenticated"
 * project. Flat lookup master, no dependencies.
 *
 * Delete is explicitly OUT OF SCOPE: the Delete button is confirmed
 * commented out of BusinessType/Index.cshtml.
 */
test.describe('BusinessType — PROP-BIZTYPE', () => {
  test(`PROP-BIZTYPE-001 List/grid loads and displays records ${tags.regression} ${tags.p1}`, async ({
    businessTypePage,
  }) => {
    assertAdminCredentialsReady();

    const name = uniqueCode('BIZTYPE');
    const code = await businessTypePage.createBusinessType(name);

    await businessTypePage.goto();
    await businessTypePage.grid.search(code);
    await businessTypePage.grid.waitForLoad();
    expect(await businessTypePage.grid.rowCount()).toBeGreaterThanOrEqual(1);
    await expect(await businessTypePage.grid.findRowByText(code)).toBeVisible();
  });

  test(`PROP-BIZTYPE-002 Create with required Name succeeds ${tags.regression} ${tags.p0}`, async ({
    businessTypePage,
  }) => {
    assertAdminCredentialsReady();

    const name = uniqueCode('BIZTYPE');
    const code = await businessTypePage.createBusinessType(name);

    await businessTypePage.goto();
    await businessTypePage.grid.search(code);
    await expect(await businessTypePage.grid.findRowByText(code)).toBeVisible();
  });

  test(`PROP-BIZTYPE-003 Create with empty Name rejected ${tags.regression} ${tags.negative} ${tags.p1}`, async ({
    businessTypePage,
    page,
  }) => {
    assertAdminCredentialsReady();

    await businessTypePage.gotoCreate();
    // Name deliberately left empty.
    await businessTypePage.clickSave();

    await businessTypePage.expectNameRequiredValidation();
    await expect(page).toHaveURL(/\/DMS\/BusinessType\/Create/i);
  });

  test(`PROP-BIZTYPE-004 Edit and verify persistence ${tags.regression} ${tags.p1}`, async ({
    businessTypePage,
  }) => {
    assertAdminCredentialsReady();

    const originalName = uniqueCode('BIZTYPE');
    const code = await businessTypePage.createBusinessType(originalName);

    await businessTypePage.openEditFor(code);
    const updatedName = uniqueCode('BIZTYPE');
    await businessTypePage.updateName(updatedName);

    await businessTypePage.goto();
    await businessTypePage.grid.search(updatedName);
    await expect(await businessTypePage.grid.findRowByText(updatedName)).toBeVisible();
  });

  test(`PROP-BIZTYPE-005 Grid search filters by Code/Name/Status ${tags.regression} ${tags.p2}`, async ({
    businessTypePage,
  }) => {
    assertAdminCredentialsReady();

    const name = uniqueCode('BIZTYPE');
    const code = await businessTypePage.createBusinessType(name);

    await businessTypePage.goto();
    await businessTypePage.grid.search(code);
    await businessTypePage.grid.waitForLoad();

    expect(await businessTypePage.grid.rowCount()).toBe(1);
    await expect(await businessTypePage.grid.findRowByText(code)).toBeVisible();
  });
});
