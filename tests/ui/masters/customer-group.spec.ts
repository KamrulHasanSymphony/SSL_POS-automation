import { test, expect } from '../../../fixtures/masters5.fixture';
import { assertAdminCredentialsReady } from '../../../utils/env';
import { uniqueCode } from '../../../utils/random-data';
import { tags } from '../../../config/tags';

/**
 * STEP 10 Phase A module: CustomerGroup (PROP-CUSTGRP-001..005), approved
 * exactly as documented in STEP 10.2/10.3A. Runs under the "authenticated"
 * project. Flat lookup master, no dependencies. Genuinely distinct from
 * `Customer` itself (separate controller/route, confirmed at STEP 10.2).
 *
 * Delete is explicitly OUT OF SCOPE: action exists, button commented out.
 */
test.describe('CustomerGroup — PROP-CUSTGRP', () => {
  test(`PROP-CUSTGRP-001 List/grid loads and displays records ${tags.regression} ${tags.p1}`, async ({ customerGroupPage }) => {
    assertAdminCredentialsReady();

    const name = uniqueCode('CUSTGRP');
    const code = await customerGroupPage.createCustomerGroup(name);

    await customerGroupPage.goto();
    await customerGroupPage.grid.search(code);
    await customerGroupPage.grid.waitForLoad();
    expect(await customerGroupPage.grid.rowCount()).toBeGreaterThanOrEqual(1);
    await expect(await customerGroupPage.grid.findRowByText(code)).toBeVisible();
  });

  test(`PROP-CUSTGRP-002 Create with required Name succeeds ${tags.regression} ${tags.p0}`, async ({ customerGroupPage }) => {
    assertAdminCredentialsReady();

    const name = uniqueCode('CUSTGRP');
    const code = await customerGroupPage.createCustomerGroup(name);

    await customerGroupPage.goto();
    await customerGroupPage.grid.search(code);
    await expect(await customerGroupPage.grid.findRowByText(code)).toBeVisible();
  });

  test(`PROP-CUSTGRP-003 Create with empty Name rejected ${tags.regression} ${tags.negative} ${tags.p1}`, async ({
    customerGroupPage,
    page,
  }) => {
    assertAdminCredentialsReady();

    await customerGroupPage.gotoCreate();
    // Name deliberately left empty.
    await customerGroupPage.clickSave();

    await customerGroupPage.expectNameRequiredValidation();
    await expect(page).toHaveURL(/\/DMS\/CustomerGroup\/Create/i);
  });

  test(`PROP-CUSTGRP-004 Edit and verify persistence ${tags.regression} ${tags.p1}`, async ({ customerGroupPage }) => {
    assertAdminCredentialsReady();

    const originalName = uniqueCode('CUSTGRP');
    const code = await customerGroupPage.createCustomerGroup(originalName);

    await customerGroupPage.openEditFor(code);
    const updatedName = uniqueCode('CUSTGRP');
    await customerGroupPage.updateName(updatedName);

    await customerGroupPage.goto();
    await customerGroupPage.grid.search(updatedName);
    await expect(await customerGroupPage.grid.findRowByText(updatedName)).toBeVisible();
  });

  test(`PROP-CUSTGRP-005 Grid search filters ${tags.regression} ${tags.p2}`, async ({ customerGroupPage }) => {
    assertAdminCredentialsReady();

    const name = uniqueCode('CUSTGRP');
    const code = await customerGroupPage.createCustomerGroup(name);

    await customerGroupPage.goto();
    await customerGroupPage.grid.search(code);
    await customerGroupPage.grid.waitForLoad();

    expect(await customerGroupPage.grid.rowCount()).toBe(1);
    await expect(await customerGroupPage.grid.findRowByText(code)).toBeVisible();
  });
});
