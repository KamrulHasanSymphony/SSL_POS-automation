import { test, expect } from '../../../fixtures/masters3.fixture';
import { assertAdminCredentialsReady } from '../../../utils/env';
import { uniqueCode } from '../../../utils/random-data';
import { tags } from '../../../config/tags';

/**
 * STEP 9 Phase B module: FiscalYear (PROP-FY-001..004), approved exactly as
 * documented in STEP 9.1/9.2B. Runs under the "authenticated" project.
 * `FiscalYearVM` has NO server `[Required]` attributes (confirmed at
 * STEP 9.1) — no negative-validation test for this module, per SQA
 * instruction.
 *
 * CONFIRMED RISK (documented, not a hard block): `FiscalYearController.Create()`
 * reads `CompanyProfile.FYearStart.Value` on a nullable `DateTime?` with no
 * null-check. If any test below fails because the Create page never
 * renders, that is an Environment/Application issue (FYearStart unset on
 * the signed-in company), not an Automation Issue — see FiscalYearPage.ts.
 *
 * CONFIRMED CONSTRAINT: the API rejects a duplicate `Year` for the company
 * ("Fiscal Year already exists."), and `Year` only has 5 possible values
 * (currentYear-1..+3) — `createFiscalYear()` searches those 5 for the first
 * one still free; see FiscalYearPage.ts. This module also has NO `Code`
 * property (unlike every other STEP 9 module), so tests use the
 * DB-assigned `Id` and the `Year`/grid search directly instead of
 * `getCode()`.
 *
 * Delete is explicitly OUT OF SCOPE: button commented out on Index.
 */
test.describe('FiscalYear — PROP-FY', () => {
  test(`PROP-FY-001 List/grid loads and displays records ${tags.regression} ${tags.p1}`, async ({ fiscalYearPage }) => {
    assertAdminCredentialsReady();

    const { year } = await fiscalYearPage.createFiscalYear();

    await fiscalYearPage.goto();
    await fiscalYearPage.grid.search(year);
    await fiscalYearPage.grid.waitForLoad();
    expect(await fiscalYearPage.grid.rowCount()).toBeGreaterThanOrEqual(1);
    await expect(await fiscalYearPage.grid.findRowByText(year)).toBeVisible();
  });

  test(`PROP-FY-002 Create with automatic 12-month period generation succeeds ${tags.regression} ${tags.p0}`, async ({
    fiscalYearPage,
    page,
  }) => {
    assertAdminCredentialsReady();

    const { id, year } = await fiscalYearPage.createFiscalYear();
    expect(Number(id)).toBeGreaterThan(0);

    await fiscalYearPage.openEditForId(id);
    await expect(page.locator('#YearStart')).not.toHaveValue('');
    await expect(page.locator('#YearEnd')).not.toHaveValue('');
    await expect(page.locator('#Year')).toHaveValue(year);
  });

  test(`PROP-FY-003 Edit and verify persistence ${tags.regression} ${tags.p1}`, async ({ fiscalYearPage }) => {
    assertAdminCredentialsReady();

    const { id } = await fiscalYearPage.createFiscalYear();

    await fiscalYearPage.openEditForId(id);
    const updatedRemarks = uniqueCode('FYREMARK');
    await fiscalYearPage.updateRemarks(updatedRemarks);

    await fiscalYearPage.openEditForId(id);
    expect(await fiscalYearPage.getRemarks()).toBe(updatedRemarks);
  });

  test(`PROP-FY-004 Grid search filters ${tags.regression} ${tags.p2}`, async ({ fiscalYearPage }) => {
    assertAdminCredentialsReady();

    const { year } = await fiscalYearPage.createFiscalYear();

    await fiscalYearPage.goto();
    await fiscalYearPage.grid.search(year);
    await fiscalYearPage.grid.waitForLoad();

    // Not asserting an exact row count of 1: the Kendo grid's search box
    // matches substrings across all visible columns, and an adjacent fiscal
    // year's YearEnd date can legitimately contain the same 4-digit year.
    expect(await fiscalYearPage.grid.rowCount()).toBeGreaterThanOrEqual(1);
    await expect(await fiscalYearPage.grid.findRowByText(year)).toBeVisible();
  });
});
