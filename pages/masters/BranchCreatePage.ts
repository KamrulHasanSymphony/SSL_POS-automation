import { Page } from '@playwright/test';
import { BasePage } from '../common/BasePage';
import { branchCreateRoute, branchProfileFormSelectors } from '../../utils/constants';

export interface BranchCreateData {
  distributorCode: string;
  name: string;
  telephoneNo: string;
}

/**
 * Areas/DMS/Controllers/BranchCreateController.cs +
 * Views/BranchProfile/BranchCreate.cshtml, confirmed at STEP 10.3C. Final
 * step of the onboarding chain, reached via
 * `/DMS/BranchCreate/BranchCreate?companyId=&userId=` (only reachable in
 * practice via CompanyCreate's post-success redirect). Same field shape
 * and confirmed duplicate `#Name` defect (HiddenFor + real TextBoxFor) as
 * BranchProfile (STEP 9.2B) — reuses `branchProfileFormSelectors`,
 * `.last()` for Name.
 *
 * CONFIRMED: `save()` calls `CommonService.validateDropdown` against
 * `#ParentId`/`#EnumTypeId`/`#AreaId`, none of which exist in this view's
 * DOM — `validateDropdown`'s `$(selector).val()?.trim()` returns
 * `undefined` for a nonexistent selector without throwing, so these
 * checks trivially pass; no special handling needed here.
 *
 * On save success, unconditionally redirects (800ms delay) to
 * `/Login/Index` — `createBranch()` waits for that navigation as the
 * definitive completion signal for the entire onboarding chain.
 */
export class BranchCreatePage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async gotoCreate(companyId: string, userId: string): Promise<void> {
    await this.page.goto(branchCreateRoute(companyId, userId));
  }

  async fillRequired(data: BranchCreateData): Promise<void> {
    await this.page.locator(branchProfileFormSelectors.distributorCode).fill(data.distributorCode);
    await this.page.locator(branchProfileFormSelectors.name).last().fill(data.name);
    await this.page.locator(branchProfileFormSelectors.telephoneNo).fill(data.telephoneNo);
  }

  async createBranch(companyId: string, userId: string, data: BranchCreateData): Promise<void> {
    await this.gotoCreate(companyId, userId);
    await this.fillRequired(data);
    await this.clickSave();
    await this.page.waitForURL(/\/Login\/Index/i, { timeout: 15000 });
  }
}
