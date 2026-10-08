import { test, expect } from '../../../fixtures/masters5.fixture';
import { assertAdminCredentialsReady } from '../../../utils/env';
import { uniqueCode } from '../../../utils/random-data';
import { tags } from '../../../config/tags';

/**
 * STEP 10 Phase A module: SupplierGroup (PROP-SUPPGRP-001..005), approved
 * exactly as documented in STEP 10.2/10.3A. Runs under the "authenticated"
 * project. Flat lookup master, no dependencies. Genuinely distinct from
 * `MasterSupplierGroupController` (already covered, STEP 9.2A) — separate
 * controller/VM/repo, confirmed at STEP 10.2.
 *
 * Delete is explicitly OUT OF SCOPE: action exists, button commented out.
 */
test.describe('SupplierGroup — PROP-SUPPGRP', () => {
  test(`PROP-SUPPGRP-001 List/grid loads and displays records ${tags.regression} ${tags.p1}`, async ({ supplierGroupPage }) => {
    assertAdminCredentialsReady();

    const name = uniqueCode('SUPPGRP');
    const code = await supplierGroupPage.createSupplierGroup(name);

    await supplierGroupPage.goto();
    await supplierGroupPage.grid.search(code);
    await supplierGroupPage.grid.waitForLoad();
    expect(await supplierGroupPage.grid.rowCount()).toBeGreaterThanOrEqual(1);
    await expect(await supplierGroupPage.grid.findRowByText(code)).toBeVisible();
  });

  test(`PROP-SUPPGRP-002 Create with required Name succeeds ${tags.regression} ${tags.p0}`, async ({ supplierGroupPage }) => {
    assertAdminCredentialsReady();

    const name = uniqueCode('SUPPGRP');
    const code = await supplierGroupPage.createSupplierGroup(name);

    await supplierGroupPage.goto();
    await supplierGroupPage.grid.search(code);
    await expect(await supplierGroupPage.grid.findRowByText(code)).toBeVisible();
  });

  test(`PROP-SUPPGRP-003 Create with empty Name rejected ${tags.regression} ${tags.negative} ${tags.p1}`, async ({
    supplierGroupPage,
    page,
  }) => {
    assertAdminCredentialsReady();

    await supplierGroupPage.gotoCreate();
    // Name deliberately left empty.
    await supplierGroupPage.clickSave();

    await supplierGroupPage.expectNameRequiredValidation();
    await expect(page).toHaveURL(/\/DMS\/SupplierGroup\/Create/i);
  });

  test(`PROP-SUPPGRP-004 Edit and verify persistence ${tags.regression} ${tags.p1}`, async ({ supplierGroupPage }) => {
    assertAdminCredentialsReady();

    const originalName = uniqueCode('SUPPGRP');
    const code = await supplierGroupPage.createSupplierGroup(originalName);

    await supplierGroupPage.openEditFor(code);
    const updatedName = uniqueCode('SUPPGRP');
    await supplierGroupPage.updateName(updatedName);

    await supplierGroupPage.goto();
    await supplierGroupPage.grid.search(updatedName);
    await expect(await supplierGroupPage.grid.findRowByText(updatedName)).toBeVisible();
  });

  test(`PROP-SUPPGRP-005 Grid search filters ${tags.regression} ${tags.p2}`, async ({ supplierGroupPage }) => {
    assertAdminCredentialsReady();

    const name = uniqueCode('SUPPGRP');
    const code = await supplierGroupPage.createSupplierGroup(name);

    await supplierGroupPage.goto();
    await supplierGroupPage.grid.search(code);
    await supplierGroupPage.grid.waitForLoad();

    expect(await supplierGroupPage.grid.rowCount()).toBe(1);
    await expect(await supplierGroupPage.grid.findRowByText(code)).toBeVisible();
  });
});
