import { test, expect } from '../../../fixtures/masters5.fixture';
import { assertAdminCredentialsReady } from '../../../utils/env';
import { uniqueCode } from '../../../utils/random-data';
import { tags } from '../../../config/tags';

/**
 * STEP 10 Phase A module: UOM (PROP-UOM-001..005), approved exactly as
 * documented in STEP 10.2/10.3A. Runs under the "authenticated" project.
 * Flat lookup master, no dependencies — exercises UOM's own UI screen,
 * distinct from the API-only `createUom()` prerequisite helper used
 * elsewhere as a fixture.
 *
 * CONFIRMED UI BEHAVIOR: `.btnsave` opens the "Are you sure?" Confirmation
 * dialog BEFORE any validation runs (`UOMController.js:12-24`) —
 * `form.valid()` only executes inside `save()`, called after the dialog is
 * confirmed (`UOMController.js:514-523`). This is the opposite order from
 * every other STEP 10.3A module. No special test code is needed for this:
 * `UOMPage.clickSave()` (inherited from BasePage) already calls
 * `confirmDialog.acceptIfPresent()` unconditionally after the click, which
 * correctly accepts the dialog whichever order it appears in — so
 * PROP-UOM-003 below uses the exact same `clickSave()` call as every other
 * negative test in this project; the underlying app sequence is
 * confirm-then-validate, but the Playwright interaction sequence is
 * unchanged.
 *
 * Delete has no button at all on Index.cshtml (stricter than the usual
 * commented-out pattern) — explicitly OUT OF SCOPE either way.
 */
test.describe('UOM — PROP-UOM', () => {
  test(`PROP-UOM-001 List/grid loads and displays records ${tags.regression} ${tags.p1}`, async ({ uomPage }) => {
    assertAdminCredentialsReady();

    const name = uniqueCode('UOM');
    const code = await uomPage.createUom(name);

    await uomPage.goto();
    await uomPage.grid.search(code);
    await uomPage.grid.waitForLoad();
    expect(await uomPage.grid.rowCount()).toBeGreaterThanOrEqual(1);
    await expect(await uomPage.grid.findRowByText(code)).toBeVisible();
  });

  test(`PROP-UOM-002 Create with required Name succeeds ${tags.regression} ${tags.p0}`, async ({ uomPage }) => {
    assertAdminCredentialsReady();

    const name = uniqueCode('UOM');
    const code = await uomPage.createUom(name);

    await uomPage.goto();
    await uomPage.grid.search(code);
    await expect(await uomPage.grid.findRowByText(code)).toBeVisible();
  });

  test(`PROP-UOM-003 Create with empty Name rejected ${tags.regression} ${tags.negative} ${tags.p1}`, async ({ uomPage, page }) => {
    assertAdminCredentialsReady();

    await uomPage.gotoCreate();
    // Name deliberately left empty. clickSave() opens the Confirmation
    // dialog first (confirmed app behavior), accepts it, and only then does
    // the app's own client validation run and block the save — the
    // resulting page state (validation message shown, still on Create) is
    // identical to every other module's negative test.
    await uomPage.clickSave();

    await uomPage.expectNameRequiredValidation();
    await expect(page).toHaveURL(/\/DMS\/UOM\/Create/i);
  });

  test(`PROP-UOM-004 Edit and verify persistence ${tags.regression} ${tags.p1}`, async ({ uomPage }) => {
    assertAdminCredentialsReady();

    const originalName = uniqueCode('UOM');
    const code = await uomPage.createUom(originalName);

    await uomPage.openEditFor(code);
    const updatedName = uniqueCode('UOM');
    await uomPage.updateName(updatedName);

    await uomPage.goto();
    await uomPage.grid.search(updatedName);
    await expect(await uomPage.grid.findRowByText(updatedName)).toBeVisible();
  });

  test(`PROP-UOM-005 Grid search filters ${tags.regression} ${tags.p2}`, async ({ uomPage }) => {
    assertAdminCredentialsReady();

    const name = uniqueCode('UOM');
    const code = await uomPage.createUom(name);

    await uomPage.goto();
    await uomPage.grid.search(code);
    await uomPage.grid.waitForLoad();

    expect(await uomPage.grid.rowCount()).toBe(1);
    await expect(await uomPage.grid.findRowByText(code)).toBeVisible();
  });
});
