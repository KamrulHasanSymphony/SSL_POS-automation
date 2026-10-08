import { test, expect } from '../../../fixtures/masters2.fixture';
import { assertAdminCredentialsReady } from '../../../utils/env';
import { uniqueCode } from '../../../utils/random-data';
import { tags } from '../../../config/tags';

/**
 * STEP 9 Phase A module: MasterSupplierGroup (PROP-MSUPPGRP-001..005),
 * approved exactly as documented in STEP 9.1/9.2A. Runs under the
 * "authenticated" project. Flat lookup master, no dependencies.
 *
 * ⚠️ CONFIRMED RISK carried into this suite (see MasterSupplierGroupPage.ts):
 * the "add" branch calls `Entity.SetDate()`, which resolves the host's MAC
 * address with no null-check. If PROP-MSUPPGRP-002 fails with an
 * unexpected server error, that must be classified as an Application
 * Defect, not an Automation Issue — do not work around it.
 *
 * Delete is explicitly OUT OF SCOPE: action exists, button commented out.
 */
test.describe('MasterSupplierGroup — PROP-MSUPPGRP', () => {
  test(`PROP-MSUPPGRP-001 List/grid loads and displays records ${tags.regression} ${tags.p1}`, async ({
    masterSupplierGroupPage,
  }) => {
    assertAdminCredentialsReady();

    const name = uniqueCode('MSUPPGRP');
    const code = await masterSupplierGroupPage.createMasterSupplierGroup(name);

    await masterSupplierGroupPage.goto();
    await masterSupplierGroupPage.grid.search(code);
    await masterSupplierGroupPage.grid.waitForLoad();
    expect(await masterSupplierGroupPage.grid.rowCount()).toBeGreaterThanOrEqual(1);
    await expect(await masterSupplierGroupPage.grid.findRowByText(code)).toBeVisible();
  });

  test(`PROP-MSUPPGRP-002 Create with required Name succeeds ${tags.regression} ${tags.p0}`, async ({
    masterSupplierGroupPage,
  }) => {
    assertAdminCredentialsReady();

    const name = uniqueCode('MSUPPGRP');
    const code = await masterSupplierGroupPage.createMasterSupplierGroup(name);

    await masterSupplierGroupPage.goto();
    await masterSupplierGroupPage.grid.search(code);
    await expect(await masterSupplierGroupPage.grid.findRowByText(code)).toBeVisible();
  });

  test(`PROP-MSUPPGRP-003 Create with empty Name rejected ${tags.regression} ${tags.negative} ${tags.p1}`, async ({
    masterSupplierGroupPage,
    page,
  }) => {
    assertAdminCredentialsReady();

    await masterSupplierGroupPage.gotoCreate();
    // Name deliberately left empty.
    await masterSupplierGroupPage.clickSave();

    await masterSupplierGroupPage.expectNameRequiredValidation();
    await expect(page).toHaveURL(/\/DMS\/MasterSupplierGroup\/Create/i);
  });

  test(`PROP-MSUPPGRP-004 Edit and verify persistence ${tags.regression} ${tags.p1}`, async ({
    masterSupplierGroupPage,
  }) => {
    assertAdminCredentialsReady();

    const originalName = uniqueCode('MSUPPGRP');
    const code = await masterSupplierGroupPage.createMasterSupplierGroup(originalName);

    await masterSupplierGroupPage.openEditFor(code);
    const updatedName = uniqueCode('MSUPPGRP');
    await masterSupplierGroupPage.updateName(updatedName);

    await masterSupplierGroupPage.goto();
    await masterSupplierGroupPage.grid.search(updatedName);
    await expect(await masterSupplierGroupPage.grid.findRowByText(updatedName)).toBeVisible();
  });

  test(`PROP-MSUPPGRP-005 Grid search filters ${tags.regression} ${tags.p2}`, async ({
    masterSupplierGroupPage,
  }) => {
    assertAdminCredentialsReady();

    const name = uniqueCode('MSUPPGRP');
    const code = await masterSupplierGroupPage.createMasterSupplierGroup(name);

    await masterSupplierGroupPage.goto();
    await masterSupplierGroupPage.grid.search(code);
    await masterSupplierGroupPage.grid.waitForLoad();

    expect(await masterSupplierGroupPage.grid.rowCount()).toBe(1);
    await expect(await masterSupplierGroupPage.grid.findRowByText(code)).toBeVisible();
  });
});
