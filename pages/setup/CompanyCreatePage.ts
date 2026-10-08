import { Page } from '@playwright/test';
import { BasePage } from '../common/BasePage';
import { companyProfileFormSelectors } from '../../utils/constants';

export interface CompanyCreateData {
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
 * Areas/SetUp/Controllers/CompanyCreateController.cs +
 * Views/CompanyCreate/CompanyCreate.cshtml, confirmed at STEP 10.3C.
 * Reached via `/SetUp/CompanyCreate/Create?id={userId}` (a real SignUp-
 * created user's Id). Identical field shape to CompanyProfile (STEP
 * 10.3A) — reuses `companyProfileFormSelectors`. Same plain-text-input
 * FYearStart/FYearEnd (no Kendo datepicker) and confirm-before-validate
 * ordering as CompanyProfile.
 *
 * CONFIRMED: on save success, the app unconditionally redirects (after an
 * 800ms delay) to `/DMS/BranchCreate/BranchCreate?companyId=&userId=`
 * (`CompanyCreateController.js:484-489`) — `createCompany()` waits for
 * that navigation directly rather than asserting the toastr, since the
 * toast can be torn down by the redirect before a slow assertion catches
 * it.
 */
export class CompanyCreatePage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async gotoCreate(userId: string): Promise<void> {
    await this.page.goto(`/SetUp/CompanyCreate/Create?id=${encodeURIComponent(userId)}`);
  }

  async fillRequired(data: CompanyCreateData): Promise<void> {
    await this.page.locator(companyProfileFormSelectors.companyName).fill(data.companyName);
    await this.page.locator(companyProfileFormSelectors.companyLegalName).fill(data.companyLegalName);
    await this.page.locator(companyProfileFormSelectors.telephoneNo).fill(data.telephoneNo);
    await this.page.locator(companyProfileFormSelectors.email).fill(data.email);
    await this.page.locator(companyProfileFormSelectors.fYearStart).fill(data.fYearStart);
    await this.page.locator(companyProfileFormSelectors.fYearEnd).fill(data.fYearEnd);
  }

  /** Waits for the confirmed post-success redirect to BranchCreate instead of the (racy, about-to-be-torn-down) toastr. */
  async createCompany(userId: string, data: CompanyCreateData): Promise<{ companyId: string; userId: string }> {
    await this.gotoCreate(userId);
    await this.fillRequired(data);
    await this.clickSave();
    await this.page.waitForURL(/\/DMS\/BranchCreate\/BranchCreate\?companyId=/i, { timeout: 15000 });
    const url = new URL(this.page.url());
    const companyId = url.searchParams.get('companyId') ?? '';
    const resolvedUserId = url.searchParams.get('userId') ?? userId;
    return { companyId, userId: resolvedUserId };
  }
}
