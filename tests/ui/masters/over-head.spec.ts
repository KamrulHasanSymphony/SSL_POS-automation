import { test, expect } from '../../../fixtures/masters2.fixture';
import { assertAdminCredentialsReady } from '../../../utils/env';
import { uniqueCode } from '../../../utils/random-data';
import { tags } from '../../../config/tags';

/**
 * STEP 9 Phase A module: OverHead (PROP-OH-001..005), approved exactly as
 * documented in STEP 9.1/9.2A. Runs under the "authenticated" project.
 * Flat lookup master, no dependencies.
 *
 * Delete is explicitly OUT OF SCOPE: confirmed NO server action exists at
 * all (the button is also commented out).
 */
test.describe('OverHead — PROP-OH', () => {
  test(`PROP-OH-001 List/grid loads and displays records ${tags.regression} ${tags.p1}`, async ({
    overHeadPage,
  }) => {
    assertAdminCredentialsReady();

    const name = uniqueCode('OVERHEAD');
    const code = await overHeadPage.createOverHead(name);

    await overHeadPage.goto();
    await overHeadPage.grid.search(code);
    await overHeadPage.grid.waitForLoad();
    expect(await overHeadPage.grid.rowCount()).toBeGreaterThanOrEqual(1);
    await expect(await overHeadPage.grid.findRowByText(code)).toBeVisible();
  });

  test(`PROP-OH-002 Create with required OverHead name succeeds ${tags.regression} ${tags.p0}`, async ({
    overHeadPage,
  }) => {
    assertAdminCredentialsReady();

    const name = uniqueCode('OVERHEAD');
    const code = await overHeadPage.createOverHead(name);

    await overHeadPage.goto();
    await overHeadPage.grid.search(code);
    await expect(await overHeadPage.grid.findRowByText(code)).toBeVisible();
  });

  test(`PROP-OH-003 Create with empty OverHead name rejected ${tags.regression} ${tags.negative} ${tags.p1}`, async ({
    overHeadPage,
    page,
  }) => {
    assertAdminCredentialsReady();

    await overHeadPage.gotoCreate();
    // OverHead name deliberately left empty.
    await overHeadPage.clickSave();

    await overHeadPage.expectOverHeadRequiredValidation();
    await expect(page).toHaveURL(/\/DMS\/OverHead\/Create/i);
  });

  test(`PROP-OH-004 Edit and verify persistence ${tags.regression} ${tags.p1}`, async ({
    overHeadPage,
  }) => {
    assertAdminCredentialsReady();

    const originalName = uniqueCode('OVERHEAD');
    const code = await overHeadPage.createOverHead(originalName);

    await overHeadPage.openEditFor(code);
    const updatedName = uniqueCode('OVERHEAD');
    await overHeadPage.updateOverHead(updatedName);

    await overHeadPage.goto();
    await overHeadPage.grid.search(updatedName);
    await expect(await overHeadPage.grid.findRowByText(updatedName)).toBeVisible();
  });

  test(`PROP-OH-005 Grid search filters by Code/OverHead/Comments ${tags.regression} ${tags.p2}`, async ({
    overHeadPage,
  }) => {
    assertAdminCredentialsReady();

    const name = uniqueCode('OVERHEAD');
    const code = await overHeadPage.createOverHead(name);

    await overHeadPage.goto();
    await overHeadPage.grid.search(code);
    await overHeadPage.grid.waitForLoad();

    expect(await overHeadPage.grid.rowCount()).toBe(1);
    await expect(await overHeadPage.grid.findRowByText(code)).toBeVisible();
  });
});
