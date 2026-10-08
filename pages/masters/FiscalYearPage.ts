import { Page, expect } from '@playwright/test';
import { BasePage } from '../common/BasePage';
import { KendoGrid } from '../../components/common-grid/KendoGrid';
import { routes, fiscalYearFormSelectors } from '../../utils/constants';

/**
 * Areas/DMS/Controllers/FiscalYearController.cs +
 * Views/FiscalYear/{Create,CreateEdit}.cshtml, confirmed at STEP 9.2B.
 * `FiscalYearVM` has NO server `[Required]` attributes (confirmed at
 * STEP 9.1) — no negative-validation test for this module. It also has NO
 * `Code` property at all (unlike every other STEP 9 module) — `getCode()`
 * does not apply here; the DB-assigned `Id` (populated into `#Id` by
 * `saveDone()` in FiscalYearsController.js) is this module's only reliable
 * per-record identifier, so `openEditForId()` navigates directly by Id
 * instead of a grid search + row click.
 *
 * CONFIRMED RISK (documented, not a hard block per SQA instruction): the
 * `Create()` action reads `CompanyProfile.FYearStart.Value` on a nullable
 * `DateTime?` with no null-check. If the signed-in company's FYearStart is
 * unset, this throws before the Create view ever renders — an
 * environment/test-data precondition source cannot confirm either way; if
 * `gotoCreate()`/`createFiscalYear()` fails here, classify as an
 * Environment/Application issue, not an Automation Issue.
 *
 * CONFIRMED CONSTRAINT: `FiscalYearService.Insert` (API tier) rejects a
 * duplicate `Year` for the company with "Fiscal Year already exists." —
 * confirmed via `FiscalYearRepository.DuplicateFiscal()`. `Year` is a
 * `<select>` populated client-side (`generateYearList()`: currentYear-1 ..
 * currentYear+3, only 5 options, none random) — unlike every other STEP 9
 * module, there is no way to generate an arbitrarily-unique Year per test
 * run. `createFiscalYear()` tries each of the 5 candidates in order and
 * uses the first one the API accepts, so repeated suite runs stay correct;
 * it throws a clear error (not a silent guess) only if all 5 are already
 * taken for this company.
 */
export class FiscalYearPage extends BasePage {
  readonly grid: KendoGrid;

  constructor(page: Page) {
    super(page);
    this.grid = new KendoGrid(page, '#FiscalYearsGrid');
  }

  async goto(): Promise<void> {
    await this.page.goto(routes.dms('FiscalYear', 'Index'));
    await this.grid.waitForLoad();
  }

  async gotoCreate(): Promise<void> {
    await this.page.goto(routes.dms('FiscalYear', 'Create'));
  }

  private candidateYears(): string[] {
    const currentYear = new Date().getFullYear();
    return [-1, 0, 1, 2, 3].map((offset) => (currentYear + offset).toString());
  }

  async createFiscalYear(): Promise<{ id: string; year: string }> {
    for (const year of this.candidateYears()) {
      await this.gotoCreate();
      await this.page.locator(`${fiscalYearFormSelectors.year} option[value="${year}"]`).waitFor({ state: 'attached' });
      await this.page.locator(fiscalYearFormSelectors.year).selectOption(year);
      await this.page.locator(fiscalYearFormSelectors.generateDetailsButton).click();
      await expect(this.page.locator(fiscalYearFormSelectors.detailsContainer)).toBeVisible();
      await this.clickSave();

      const toast = this.page.locator('#toast-container .toast-message, #toast-container .toast').first();
      await expect(toast).toBeVisible({ timeout: 10000 });
      const message = (await toast.textContent().catch(() => '')) ?? '';
      if (!/already exists/i.test(message)) {
        const id = await this.page.locator('#Id').inputValue();
        return { id, year };
      }
    }
    throw new Error(
      'FiscalYear: all 5 creatable Year options (currentYear-1..+3) already exist for this company — cannot create a fresh record without reusing/guessing data.'
    );
  }

  async openEditForId(id: string): Promise<void> {
    await this.page.goto(routes.dms('FiscalYear', `Edit/${id}`));
    await this.page.waitForURL(/\/DMS\/FiscalYear\/Edit/i);
  }

  async fillRemarks(remarks: string): Promise<void> {
    await this.page.locator('#Remarks').fill(remarks);
  }

  async getRemarks(): Promise<string> {
    return (await this.page.locator('#Remarks').inputValue()) ?? '';
  }

  async updateRemarks(remarks: string): Promise<void> {
    await this.fillRemarks(remarks);
    await this.clickUpdate();
    await this.toastr.expectSuccess();
  }
}
