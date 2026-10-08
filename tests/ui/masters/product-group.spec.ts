import { test, expect } from '../../../fixtures/masters5.fixture';
import { assertAdminCredentialsReady } from '../../../utils/env';
import { uniqueCode } from '../../../utils/random-data';
import { tags } from '../../../config/tags';

/**
 * STEP 10 Phase A module: ProductGroup (PROP-PRODGRP-001..005), approved
 * exactly as documented in STEP 10.2/10.3A. Runs under the "authenticated"
 * project. Flat lookup master, no dependencies. Genuinely distinct from
 * `MasterItemGroupController` (already covered, STEP 9.2A) — separate
 * controller/VM/repo, confirmed at STEP 10.2.
 *
 * Delete is explicitly OUT OF SCOPE: action exists, button commented out.
 */
test.describe('ProductGroup — PROP-PRODGRP', () => {
  test(`PROP-PRODGRP-001 List/grid loads and displays records ${tags.regression} ${tags.p1}`, async ({ productGroupPage }) => {
    assertAdminCredentialsReady();

    const name = uniqueCode('PRODGRP');
    const code = await productGroupPage.createProductGroup(name);

    await productGroupPage.goto();
    await productGroupPage.grid.search(code);
    await productGroupPage.grid.waitForLoad();
    expect(await productGroupPage.grid.rowCount()).toBeGreaterThanOrEqual(1);
    await expect(await productGroupPage.grid.findRowByText(code)).toBeVisible();
  });

  test(`PROP-PRODGRP-002 Create with required Name succeeds ${tags.regression} ${tags.p0}`, async ({ productGroupPage }) => {
    assertAdminCredentialsReady();

    const name = uniqueCode('PRODGRP');
    const code = await productGroupPage.createProductGroup(name);

    await productGroupPage.goto();
    await productGroupPage.grid.search(code);
    await expect(await productGroupPage.grid.findRowByText(code)).toBeVisible();
  });

  test(`PROP-PRODGRP-003 Create with empty Name rejected ${tags.regression} ${tags.negative} ${tags.p1}`, async ({
    productGroupPage,
    page,
  }) => {
    assertAdminCredentialsReady();

    await productGroupPage.gotoCreate();
    // Name deliberately left empty.
    await productGroupPage.clickSave();

    await productGroupPage.expectNameRequiredValidation();
    await expect(page).toHaveURL(/\/DMS\/ProductGroup\/Create/i);
  });

  test(`PROP-PRODGRP-004 Edit and verify persistence ${tags.regression} ${tags.p1}`, async ({ productGroupPage }) => {
    assertAdminCredentialsReady();

    const originalName = uniqueCode('PRODGRP');
    const code = await productGroupPage.createProductGroup(originalName);

    await productGroupPage.openEditFor(code);
    const updatedName = uniqueCode('PRODGRP');
    await productGroupPage.updateName(updatedName);

    await productGroupPage.goto();
    await productGroupPage.grid.search(updatedName);
    await expect(await productGroupPage.grid.findRowByText(updatedName)).toBeVisible();
  });

  test(`PROP-PRODGRP-005 Grid search filters ${tags.regression} ${tags.p2}`, async ({ productGroupPage }) => {
    assertAdminCredentialsReady();

    const name = uniqueCode('PRODGRP');
    const code = await productGroupPage.createProductGroup(name);

    await productGroupPage.goto();
    await productGroupPage.grid.search(code);
    await productGroupPage.grid.waitForLoad();

    expect(await productGroupPage.grid.rowCount()).toBe(1);
    await expect(await productGroupPage.grid.findRowByText(code)).toBeVisible();
  });
});
