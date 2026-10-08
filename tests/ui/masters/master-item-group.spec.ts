import { test, expect } from '../../../fixtures/masters2.fixture';
import { assertAdminCredentialsReady } from '../../../utils/env';
import { uniqueCode } from '../../../utils/random-data';
import { tags } from '../../../config/tags';

/**
 * STEP 9 Phase A module: MasterItemGroup (PROP-MITEMGRP-001..005),
 * approved exactly as documented in STEP 9.1/9.2A. Runs under the
 * "authenticated" project. Flat lookup master, no dependencies.
 *
 * Delete is explicitly OUT OF SCOPE: action exists, button commented out.
 */
test.describe('MasterItemGroup — PROP-MITEMGRP', () => {
  test(`PROP-MITEMGRP-001 List/grid loads and displays records ${tags.regression} ${tags.p1}`, async ({
    masterItemGroupPage,
  }) => {
    assertAdminCredentialsReady();

    const name = uniqueCode('MITEMGRP');
    const code = await masterItemGroupPage.createMasterItemGroup(name);

    await masterItemGroupPage.goto();
    await masterItemGroupPage.grid.search(code);
    await masterItemGroupPage.grid.waitForLoad();
    expect(await masterItemGroupPage.grid.rowCount()).toBeGreaterThanOrEqual(1);
    await expect(await masterItemGroupPage.grid.findRowByText(code)).toBeVisible();
  });

  test(`PROP-MITEMGRP-002 Create with required Name succeeds ${tags.regression} ${tags.p0}`, async ({
    masterItemGroupPage,
  }) => {
    assertAdminCredentialsReady();

    const name = uniqueCode('MITEMGRP');
    const code = await masterItemGroupPage.createMasterItemGroup(name);

    await masterItemGroupPage.goto();
    await masterItemGroupPage.grid.search(code);
    await expect(await masterItemGroupPage.grid.findRowByText(code)).toBeVisible();
  });

  test(`PROP-MITEMGRP-003 Create with empty Name rejected ${tags.regression} ${tags.negative} ${tags.p1}`, async ({
    masterItemGroupPage,
    page,
  }) => {
    assertAdminCredentialsReady();

    await masterItemGroupPage.gotoCreate();
    // Name deliberately left empty.
    await masterItemGroupPage.clickSave();

    await masterItemGroupPage.expectNameRequiredValidation();
    await expect(page).toHaveURL(/\/DMS\/MasterItemGroup\/Create/i);
  });

  test(`PROP-MITEMGRP-004 Edit and verify persistence ${tags.regression} ${tags.p1}`, async ({
    masterItemGroupPage,
  }) => {
    assertAdminCredentialsReady();

    const originalName = uniqueCode('MITEMGRP');
    const code = await masterItemGroupPage.createMasterItemGroup(originalName);

    await masterItemGroupPage.openEditFor(code);
    const updatedName = uniqueCode('MITEMGRP');
    await masterItemGroupPage.updateName(updatedName);

    await masterItemGroupPage.goto();
    await masterItemGroupPage.grid.search(updatedName);
    await expect(await masterItemGroupPage.grid.findRowByText(updatedName)).toBeVisible();
  });

  test(`PROP-MITEMGRP-005 Grid search filters ${tags.regression} ${tags.p2}`, async ({
    masterItemGroupPage,
  }) => {
    assertAdminCredentialsReady();

    const name = uniqueCode('MITEMGRP');
    const code = await masterItemGroupPage.createMasterItemGroup(name);

    await masterItemGroupPage.goto();
    await masterItemGroupPage.grid.search(code);
    await masterItemGroupPage.grid.waitForLoad();

    expect(await masterItemGroupPage.grid.rowCount()).toBe(1);
    await expect(await masterItemGroupPage.grid.findRowByText(code)).toBeVisible();
  });
});
