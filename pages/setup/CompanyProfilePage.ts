import { Page, expect } from '@playwright/test';
import { BasePage } from '../common/BasePage';
import { KendoGrid } from '../../components/common-grid/KendoGrid';
import { routes, gridContainerSelectors, companyProfileFormSelectors, companyProfileValidationMessages } from '../../utils/constants';

export interface CompanyProfileCreateData {
  companyName: string;
  companyLegalName: string;
  telephoneNo: string;
  email: string;
  /** yyyy-MM-dd */
  fYearStart: string;
  /** yyyy-MM-dd */
  fYearEnd: string;
}

/**
 * Areas/SetUp/Controllers/CompanyProfileController.cs +
 * Views/CompanyProfile/Create.cshtml, confirmed at STEP 10.3A.
 *
 * CONFIRMED CORRECTION to an earlier finding: `FYearStart`/`FYearEnd` are
 * PLAIN, unenhanced text inputs — `CompanyProfileController.js`'s
 * `kendoDatePicker` init calls are commented out (lines 12-16), and no
 * other script anywhere initializes the `.btnrequisitiondate` class as any
 * widget. Fill with plain `.fill()` in `yyyy-MM-dd` format — do NOT use
 * `KendoDatePicker`.
 *
 * CONFIRMED: `.btnsave` goes straight to the Confirmation dialog before any
 * validation (same ordering as UOM) — `BasePage.clickSave()` already
 * handles this via `confirmDialog.acceptIfPresent()`, no special-casing
 * needed.
 *
 * CONFIRMED: server-side `Delete` never binds `IDs` (`param.IDs = vm.IDs`
 * is commented out) — a functional no-op — and the button is also
 * commented out on Index. No delete method here, per explicit instruction.
 */
export class CompanyProfilePage extends BasePage {
  readonly grid: KendoGrid;

  constructor(page: Page) {
    super(page);
    this.grid = new KendoGrid(page, gridContainerSelectors.default);
  }

  async goto(): Promise<void> {
    await this.page.goto(routes.setup('CompanyProfile', 'Index'));
    await this.grid.waitForLoad();
  }

  async gotoCreate(): Promise<void> {
    await this.page.goto(routes.setup('CompanyProfile', 'Create'));
  }

  async fillCompanyName(name: string): Promise<void> {
    await this.page.locator(companyProfileFormSelectors.companyName).fill(name);
  }

  async fillRequired(data: CompanyProfileCreateData): Promise<void> {
    await this.fillCompanyName(data.companyName);
    await this.page.locator(companyProfileFormSelectors.companyLegalName).fill(data.companyLegalName);
    await this.page.locator(companyProfileFormSelectors.telephoneNo).fill(data.telephoneNo);
    await this.page.locator(companyProfileFormSelectors.email).fill(data.email);
    await this.page.locator(companyProfileFormSelectors.fYearStart).fill(data.fYearStart);
    await this.page.locator(companyProfileFormSelectors.fYearEnd).fill(data.fYearEnd);
  }

  async createCompanyProfile(data: CompanyProfileCreateData): Promise<string> {
    await this.gotoCreate();
    await this.fillRequired(data);
    await this.clickSave();
    await this.toastr.expectSuccess();
    return this.getCode();
  }

  /** Grid's Edit action is an icon-only link with no accessible name — clicks the `.edit` class directly instead of KendoGrid.clickRowAction(). */
  async openEditFor(code: string): Promise<void> {
    await this.goto();
    await this.grid.search(code);
    const row = await this.grid.findRowByText(code);
    await row.locator('a.edit').click();
    await this.page.waitForURL(/\/SetUp\/CompanyProfile\/Edit/i);
  }

  async updateCompanyName(newName: string): Promise<void> {
    await this.fillCompanyName(newName);
    await this.clickUpdate();
    await this.toastr.expectSuccess();
  }

  async expectCompanyNameRequiredValidation(): Promise<void> {
    await expect(this.page.locator(companyProfileFormSelectors.companyNameValidationMessage)).toHaveText(
      companyProfileValidationMessages.companyNameRequired
    );
  }
}
