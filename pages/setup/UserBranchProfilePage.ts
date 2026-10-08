import { Page } from '@playwright/test';
import { BasePage } from '../common/BasePage';
import { KendoGrid } from '../../components/common-grid/KendoGrid';
import { userBranchProfileSelectors } from '../../utils/constants';

/**
 * Areas/SetUp/Controllers/UserBranchProfileController.cs +
 * Views/UserBranchProfile/Index.cshtml +
 * Areas/Common/Views/Common/_branchLoading.cshtml, confirmed at STEP
 * 10.3C. CONFIRMED CORRECTION: the standalone `/SetUp/UserBranchProfile/Create`
 * page is dead (its `Create()` action never receives/sets a UserId) — the
 * real Create mechanism is the `.btnBranch` button on
 * `/SetUp/UserBranchProfile/Index/{userId}`, which opens a modal
 * (`#partialModal`) containing a select2 multi-select
 * (`#multiBranchId`, real branch data from the confirmed-working
 * `/Common/Common/GetBranchList`) and its own save button posting to
 * `/SetUp/UserBranchProfile/CreateEdit`. No fields here are `[Required]`
 * — only List/Create/Edit were approved (no negative scenario). No Delete
 * action exists anywhere.
 */
export class UserBranchProfilePage extends BasePage {
  readonly grid: KendoGrid;

  constructor(page: Page) {
    super(page);
    this.grid = new KendoGrid(page, '#GridDataList');
  }

  async goto(userId: string): Promise<void> {
    await this.page.goto(`/SetUp/UserBranchProfile/Index/${userId}`);
    await this.grid.waitForLoad();
  }

  async openBranchModal(): Promise<void> {
    await this.page.locator(userBranchProfileSelectors.openModalButton).click();
    await this.page.locator('#partialModal').waitFor({ state: 'visible' });
    // #multiBranchId is populated asynchronously from /Common/Common/GetBranchList.
    await this.page
      .locator(`${userBranchProfileSelectors.branchMultiSelect} option`)
      .nth(1)
      .waitFor({ state: 'attached', timeout: 10000 });
  }

  /** Selects the first real branch option (index 0 is the "--Select--" placeholder) — this project must not hard-code a specific branch name. */
  async selectFirstBranch(): Promise<void> {
    await this.page.locator(userBranchProfileSelectors.branchMultiSelect).selectOption({ index: 1 });
  }

  /**
   * MULTI-BRANCH-LIFECYCLE E2E addition: `#multiBranchId` is a plain native
   * `<select multiple>` (confirmed by `selectFirstBranch()`'s own use of
   * Playwright's `selectOption()`, not a Kendo-specific click sequence),
   * needed here since a real branch-isolation test must assign two
   * SPECIFIC, just-created branches by name, not just "whichever is first".
   *
   * MULTI-BRANCH-LIFECYCLE E2E FINDING: confirmed live (ARIA snapshot of
   * `#multiBranchId`'s own option list) that each option's rendered text is
   * `{DistributorCode}~{Name}` (e.g. `"BP-00001~Head/Central Office"`), not
   * the Name alone — `selectOption({ label: branchName })`'s exact-match
   * requirement never matches a Name-only string. Selects by option VALUE
   * instead (confirmed from source, `CommonRepository.cs`'s
   * `ParentBranchProfileList()`: `Id` is the bound value, `Code~Name` is
   * only ever the display text) — resolves the value from whichever
   * option's text CONTAINS the given branch name, so this stays correct
   * regardless of the `Code~Name` display format.
   */
  async selectBranchByName(branchName: string): Promise<void> {
    const select = this.page.locator(userBranchProfileSelectors.branchMultiSelect);
    const option = select.locator('option', { hasText: branchName }).first();
    await option.waitFor({ state: 'attached', timeout: 10000 });
    const value = await option.getAttribute('value');
    if (!value) {
      throw new Error(`selectBranchByName: option matching "${branchName}" has no value attribute.`);
    }
    await select.selectOption({ value });
  }

  async saveBranchAssignment(): Promise<void> {
    await this.page.locator(userBranchProfileSelectors.modalSaveButton).first().click();
    await this.toastr.expectSuccess();
  }

  async assignFirstBranch(userId: string): Promise<void> {
    await this.goto(userId);
    await this.openBranchModal();
    await this.selectFirstBranch();
    await this.saveBranchAssignment();
    await this.page.waitForLoadState('load');
  }

  /**
   * See `selectBranchByName()`'s own doc comment. Mirrors `assignFirstBranch()`
   * exactly, for a specific named branch. Confirmed live (PROP-USERBRANCH-003)
   * that repeat calls for the same user ADD to, rather than replace, the
   * existing assignment set — callers needing multiple branches on one user
   * call this once per branch.
   */
  async assignBranch(userId: string, branchName: string): Promise<void> {
    await this.goto(userId);
    await this.openBranchModal();
    await this.selectBranchByName(branchName);
    await this.saveBranchAssignment();
    await this.page.waitForLoadState('load');
  }
}
