import { test, expect } from '../../../fixtures/masters2.fixture';
import { assertAdminCredentialsReady } from '../../../utils/env';
import { uniqueCode } from '../../../utils/random-data';
import { tags } from '../../../config/tags';

/**
 * STEP 9 Phase A module: PaymentType (PROP-PAYTYPE-001..006), approved
 * exactly as documented in STEP 9.1/9.2A. Runs under the "authenticated"
 * project. Flat lookup master, no dependencies, no `#Code` field
 * (confirmed absent) — `Name` is the identifier used for search/edit/delete.
 *
 * Delete IS in scope here — confirmed one of only two modules found so far
 * (with Areas) whose grid Delete button is genuinely live (not commented out).
 */
test.describe('PaymentType — PROP-PAYTYPE', () => {
  test(`PROP-PAYTYPE-001 List/grid loads and displays records ${tags.regression} ${tags.p1}`, async ({
    paymentTypePage,
  }) => {
    assertAdminCredentialsReady();

    const name = uniqueCode('PAYTYPE');
    await paymentTypePage.createPaymentType(name);

    await paymentTypePage.goto();
    await paymentTypePage.grid.search(name);
    await paymentTypePage.grid.waitForLoad();
    expect(await paymentTypePage.grid.rowCount()).toBeGreaterThanOrEqual(1);
    await expect(await paymentTypePage.grid.findRowByText(name)).toBeVisible();
  });

  test(`PROP-PAYTYPE-002 Create with required Name succeeds ${tags.regression} ${tags.p0}`, async ({
    paymentTypePage,
  }) => {
    assertAdminCredentialsReady();

    const name = uniqueCode('PAYTYPE');
    await paymentTypePage.createPaymentType(name);

    await paymentTypePage.goto();
    await paymentTypePage.grid.search(name);
    await expect(await paymentTypePage.grid.findRowByText(name)).toBeVisible();
  });

  test(`PROP-PAYTYPE-003 Create with empty Name rejected ${tags.regression} ${tags.negative} ${tags.p1}`, async ({
    paymentTypePage,
    page,
  }) => {
    assertAdminCredentialsReady();

    await paymentTypePage.gotoCreate();
    // Name deliberately left empty.
    await paymentTypePage.clickSave();

    await paymentTypePage.expectNameRequiredValidation();
    await expect(page).toHaveURL(/\/DMS\/PaymentType\/Create/i);
  });

  test(`PROP-PAYTYPE-004 Edit and verify persistence ${tags.regression} ${tags.p1}`, async ({
    paymentTypePage,
  }) => {
    assertAdminCredentialsReady();

    const originalName = uniqueCode('PAYTYPE');
    await paymentTypePage.createPaymentType(originalName);

    await paymentTypePage.openEditFor(originalName);
    const updatedName = uniqueCode('PAYTYPE');
    await paymentTypePage.updateName(updatedName);

    await paymentTypePage.goto();
    await paymentTypePage.grid.search(updatedName);
    await expect(await paymentTypePage.grid.findRowByText(updatedName)).toBeVisible();
  });

  test(`PROP-PAYTYPE-005 Delete a created record succeeds ${tags.regression} ${tags.p2}`, async ({
    paymentTypePage,
  }) => {
    assertAdminCredentialsReady();

    const name = uniqueCode('PAYTYPE');
    await paymentTypePage.createPaymentType(name);

    await paymentTypePage.deleteByName(name);

    await paymentTypePage.goto();
    await paymentTypePage.grid.search(name);
    await paymentTypePage.grid.waitForLoad();
    expect(await paymentTypePage.grid.rowCount()).toBe(0);
  });

  test(`PROP-PAYTYPE-006 Grid search filters by Name/Status ${tags.regression} ${tags.p2}`, async ({
    paymentTypePage,
  }) => {
    assertAdminCredentialsReady();

    const name = uniqueCode('PAYTYPE');
    await paymentTypePage.createPaymentType(name);

    await paymentTypePage.goto();
    await paymentTypePage.grid.search(name);
    await paymentTypePage.grid.waitForLoad();

    expect(await paymentTypePage.grid.rowCount()).toBe(1);
    await expect(await paymentTypePage.grid.findRowByText(name)).toBeVisible();
  });
});
