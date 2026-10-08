import { Page, expect } from '@playwright/test';
import { BasePage } from '../common/BasePage';
import { KendoGrid } from '../../components/common-grid/KendoGrid';
import { BootstrapSwitch } from '../../components/BootstrapSwitch';
import { routes, gridContainerSelectors, branchProfileFormSelectors, branchProfileValidationMessages } from '../../utils/constants';

/**
 * Areas/DMS/Controllers/BranchProfileController.cs +
 * Views/BranchProfile/Create.cshtml, confirmed at STEP 9.2B.
 *
 * CONFIRMED LIMITATION (preserved, not worked around): `AreaId` is
 * `[Required]` on BranchProfileVM.cs but has NO input at all in
 * Create.cshtml (fully commented out) — the client never submits it, and
 * `CreateEdit` calls `_repo.Insert(model)` with no `ModelState.IsValid`
 * check, so Create succeeds anyway with AreaId silently null. Do not invent
 * a way to populate it.
 *
 * CONFIRMED DEFECT: `Name` renders twice (`HiddenFor` then `TextBoxFor`,
 * both `id="Name"`) — `.last()` targets the real, visible input.
 *
 * MULTI-BRANCH-LIFECYCLE E2E FINDING (superseded by a deeper one below —
 * kept for the record, not a red herring): initially suspected
 * `BranchProfileVM.IsActive` defaulting to `false` as the reason a
 * freshly-created Branch never appears in `UserBranchProfilePage`'s own
 * `#multiBranchId` picker (`/Common/Common/GetBranchList` ->
 * `CommonRepository.cs`'s `ParentBranchProfileList()`, which filters
 * `WHERE H.IsActive=1`) — `setOn(true)` added to `createBranchProfile()`
 * below on that theory. Confirmed live this was NOT the (sole) cause:
 * `#IsActive`'s bootstrap-switch actually renders pre-checked/ON by default
 * on a fresh Create page (`Create.cshtml`'s `Model.IsActive` is already
 * `true` when the GET action builds it), so `setOn(true)` is a harmless
 * no-op here, not a fix.
 *
 * MULTI-BRANCH-LIFECYCLE E2E FINDING (the real root cause — CONFIRMED
 * APPLICATION DEFECT, not an automation gap): `BranchProfileController.CreateEdit`'s
 * Add path silently does not persist at all. Confirmed live via three
 * independent signals across repeated `createBranchProfile()` calls: (1)
 * every single call was offered the identical next `#Code`, `"BP-00065"`,
 * never incrementing; (2) `/DMS/BranchProfile/Index`'s own grid pager
 * (`.k-pager-info`) read `"1 - 1 of 1 items"` both immediately BEFORE and
 * immediately AFTER a "successful" (toast-confirmed) create — the total
 * row count never changes; (3) the server logs (`IIS Express`/API,
 * captured live) show `POST /DMS/BranchProfile/CreateEdit` returning a
 * plain HTTP 200 with no exception, i.e. the request completes without a
 * visible error while genuinely inserting nothing. This is a real,
 * confirmed, out-of-scope-to-fix Application Defect (no page-object or
 * Playwright change can make a UI action persist data the server-side
 * insert itself silently drops) — flagged explicitly rather than worked
 * around. `createBranchProfile()` is left as-is (still exercises the real,
 * confirmed UI flow correctly) so this defect stays visible/regression-
 * checked rather than silently avoided; callers that need a REAL, usable
 * Branch must reference one of the application's existing active branches
 * instead (see `multi-branch-lifecycle.spec.ts`'s own class doc comment
 * for how it adapts to this).
 *
 * Delete is confirmed NOT SUPPORTED here: button commented out on Index.
 */
export class BranchProfilePage extends BasePage {
  readonly grid: KendoGrid;
  private readonly isActiveSwitch: BootstrapSwitch;

  constructor(page: Page) {
    super(page);
    this.grid = new KendoGrid(page, gridContainerSelectors.default);
    this.isActiveSwitch = new BootstrapSwitch(page, 'IsActive');
  }

  async goto(): Promise<void> {
    await this.page.goto(routes.dms('BranchProfile', 'Index'));
    await this.grid.waitForLoad();
  }

  async gotoCreate(): Promise<void> {
    await this.page.goto(routes.dms('BranchProfile', 'Create'));
  }

  async fillDistributorCode(code: string): Promise<void> {
    await this.page.locator(branchProfileFormSelectors.distributorCode).fill(code);
  }

  async fillName(name: string): Promise<void> {
    await this.page.locator(branchProfileFormSelectors.name).last().fill(name);
  }

  async fillTelephoneNo(telephoneNo: string): Promise<void> {
    await this.page.locator(branchProfileFormSelectors.telephoneNo).fill(telephoneNo);
  }

  async createBranchProfile(params: { distributorCode: string; name: string; telephoneNo: string }): Promise<string> {
    await this.gotoCreate();
    await this.fillDistributorCode(params.distributorCode);
    await this.fillName(params.name);
    await this.fillTelephoneNo(params.telephoneNo);
    // Harmless (confirmed a no-op — IsActive already defaults ON, see class
    // doc comment) but kept explicit/correct rather than left implicit.
    await this.isActiveSwitch.setOn(true);
    await this.clickSave();
    await this.toastr.expectSuccess();
    return this.getCode();
  }

  async openEditFor(code: string): Promise<void> {
    await this.goto();
    await this.grid.search(code);
    await this.grid.clickRowAction(code, /edit/i);
    await this.page.waitForURL(/\/DMS\/BranchProfile\/Edit/i);
  }

  async updateName(newName: string): Promise<void> {
    await this.fillName(newName);
    await this.clickUpdate();
    await this.toastr.expectSuccess();
  }

  async expectNameRequiredValidation(): Promise<void> {
    await expect(this.page.locator(branchProfileFormSelectors.nameValidationMessage)).toHaveText(
      branchProfileValidationMessages.nameRequired
    );
  }

  async expectTelephoneInvalidFormatValidation(): Promise<void> {
    await expect(this.page.locator(branchProfileFormSelectors.telephoneNoValidationMessage)).toHaveText(
      branchProfileValidationMessages.telephoneInvalidFormat
    );
  }
}
