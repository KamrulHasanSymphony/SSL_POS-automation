import { test, expect } from '../../../fixtures/masters5.fixture';
import { assertAdminCredentialsReady } from '../../../utils/env';
import { uniqueCode } from '../../../utils/random-data';
import { tags } from '../../../config/tags';
import { CompanyProfileCreateData } from '../../../pages/setup/CompanyProfilePage';

/**
 * STEP 10 Phase A module: CompanyProfile (PROP-COMPPROF-001..005), approved
 * exactly as documented in STEP 10.2/10.3A. Runs under the "authenticated"
 * project. See pages/setup/CompanyProfilePage.ts for the full source
 * trail: FYearStart/FYearEnd are plain text inputs (Kendo datepicker init
 * confirmed commented out), confirm-before-validate ordering matches UOM,
 * and Delete is a confirmed server-side no-op — explicitly OUT OF SCOPE.
 */
function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function validCompanyProfileData(prefix: string): CompanyProfileCreateData {
  const fYearStart = new Date();
  const fYearEnd = new Date(fYearStart);
  fYearEnd.setFullYear(fYearEnd.getFullYear() + 1);
  fYearEnd.setDate(fYearEnd.getDate() - 1);

  return {
    companyName: uniqueCode(prefix),
    companyLegalName: `Automation Legal Name ${uniqueCode('LEGAL')}`,
    telephoneNo: '01700000000',
    email: `${uniqueCode(prefix).toLowerCase()}@example.com`,
    fYearStart: toIsoDate(fYearStart),
    fYearEnd: toIsoDate(fYearEnd),
  };
}

test.describe('CompanyProfile — PROP-COMPPROF', () => {
  test(`PROP-COMPPROF-001 List/grid loads and displays records ${tags.regression} ${tags.p1}`, async ({ companyProfilePage }) => {
    assertAdminCredentialsReady();

    const data = validCompanyProfileData('COMPPROF');
    const code = await companyProfilePage.createCompanyProfile(data);

    await companyProfilePage.goto();
    await companyProfilePage.grid.search(code);
    await companyProfilePage.grid.waitForLoad();
    expect(await companyProfilePage.grid.rowCount()).toBeGreaterThanOrEqual(1);
    await expect(await companyProfilePage.grid.findRowByText(code)).toBeVisible();
  });

  test(`PROP-COMPPROF-002 Create with required fields succeeds ${tags.regression} ${tags.p0}`, async ({ companyProfilePage }) => {
    assertAdminCredentialsReady();

    const data = validCompanyProfileData('COMPPROF');
    const code = await companyProfilePage.createCompanyProfile(data);

    await companyProfilePage.goto();
    await companyProfilePage.grid.search(code);
    await expect(await companyProfilePage.grid.findRowByText(code)).toBeVisible();
  });

  test(`PROP-COMPPROF-003 Create with empty Company Name rejected ${tags.regression} ${tags.negative} ${tags.p1}`, async ({
    companyProfilePage,
    page,
  }) => {
    assertAdminCredentialsReady();

    const data = validCompanyProfileData('COMPPROF');
    await companyProfilePage.gotoCreate();
    // Company Name deliberately left empty; every other required field is
    // filled so only the Company Name validation is exercised.
    await page.locator('#CompanyLegalName').fill(data.companyLegalName);
    await page.locator('#TelephoneNo').fill(data.telephoneNo);
    await page.locator('#Email').fill(data.email);
    await page.locator('#FYearStart').fill(data.fYearStart);
    await page.locator('#FYearEnd').fill(data.fYearEnd);
    await companyProfilePage.clickSave();

    await companyProfilePage.expectCompanyNameRequiredValidation();
    await expect(page).toHaveURL(/\/SetUp\/CompanyProfile\/Create/i);
  });

  test(`PROP-COMPPROF-004 Edit and verify persistence ${tags.regression} ${tags.p1}`, async ({ companyProfilePage }) => {
    assertAdminCredentialsReady();

    const data = validCompanyProfileData('COMPPROF');
    const code = await companyProfilePage.createCompanyProfile(data);

    await companyProfilePage.openEditFor(code);
    const updatedName = uniqueCode('COMPPROF');
    await companyProfilePage.updateCompanyName(updatedName);

    await companyProfilePage.goto();
    await companyProfilePage.grid.search(updatedName);
    await expect(await companyProfilePage.grid.findRowByText(updatedName)).toBeVisible();
  });

  test(`PROP-COMPPROF-005 Grid search filters ${tags.regression} ${tags.p2}`, async ({ companyProfilePage }) => {
    assertAdminCredentialsReady();

    const data = validCompanyProfileData('COMPPROF');
    const code = await companyProfilePage.createCompanyProfile(data);

    await companyProfilePage.goto();
    await companyProfilePage.grid.search(code);
    await companyProfilePage.grid.waitForLoad();

    expect(await companyProfilePage.grid.rowCount()).toBe(1);
    await expect(await companyProfilePage.grid.findRowByText(code)).toBeVisible();
  });
});
