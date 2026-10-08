import { Page, expect } from '@playwright/test';
import { BasePage } from '../common/BasePage';
import { KendoGrid } from '../../components/common-grid/KendoGrid';
import { routes, roleFormSelectors, roleValidationMessages } from '../../utils/constants';

/**
 * Areas/SetUp/Controllers/MenuAuthorizationController.cs (Role/RoleCreate/
 * RoleCreateEdit/RoleEdit actions) + Views/MenuAuthorization/{Role,RoleCreateEdit}.cshtml
 * + UserRoleVM (ShampanPOS.Models/UserMenuAccess.cs), confirmed at STEP 10.3A.
 *
 * CONFIRMED DIFFERENT save-button class: `.btnRoleSave.sslSave`/`.sslUpdate`,
 * NOT the generic `.btnsave` every other module uses — BasePage.clickSave()/
 * clickUpdate() would not find these, so this page overrides both,
 * mirroring IncomeExpenseCategoryPage's precedent for the same kind of
 * selector divergence. Validation runs before the Confirmation dialog here
 * (`MenuAuthorizationController.js:753-761`), the standard ordering.
 *
 * CONFIRMED: `UserRoleVM` has NO `Code` property at all (like FiscalYear/
 * MasterSupplierItem) — `Name` (the grid's own confirmed search field) is
 * the per-test identifier instead. Grid container is `#RoleIndexDataList`,
 * not the default `#GridDataList`. No Delete action exists on the
 * controller at all — no delete method here.
 */
export class RolePage extends BasePage {
  readonly grid: KendoGrid;

  constructor(page: Page) {
    super(page);
    this.grid = new KendoGrid(page, '#RoleIndexDataList');
  }

  async goto(): Promise<void> {
    await this.page.goto(routes.setup('MenuAuthorization', 'Role'));
    await this.grid.waitForLoad();
  }

  async gotoCreate(): Promise<void> {
    await this.page.goto(routes.setup('MenuAuthorization', 'RoleCreate'));
  }

  async fillName(name: string): Promise<void> {
    await this.page.locator(roleFormSelectors.name).fill(name);
  }

  async clickRoleSave(): Promise<void> {
    await this.page.locator(roleFormSelectors.saveButton).click();
    await this.confirmDialog.acceptIfPresent();
    await this.overlay.waitForIdle();
  }

  async clickRoleUpdate(): Promise<void> {
    await this.page.locator(roleFormSelectors.updateButton).click();
    await this.confirmDialog.acceptIfPresent();
    await this.overlay.waitForIdle();
  }

  /**
   * USER-PERMISSION-ROLE-LIFECYCLE E2E FINDING: confirmed live (reproducible
   * across consecutive runs) that `/SetUp/MenuAuthorization/RoleCreate`'s
   * own initial page load leaves `.loadingoverlay` visible for longer than
   * `fillName()`/`clickRoleSave()` (called immediately after `gotoCreate()`,
   * with no wait in between) allows for — the overlay was still covering
   * `.btnRoleSave.sslSave` 15s later, well past `clickRoleSave()`'s own
   * default action timeout. Waits for the overlay to clear right after
   * navigation, before any interaction, rather than racing it — this is
   * the first live exercise of `createRole()` needing to work reliably
   * under this shared environment's current (long-session-accumulated)
   * load.
   */
  async createRole(name: string): Promise<void> {
    await this.gotoCreate();
    await this.overlay.waitForIdle();
    await this.fillName(name);
    await this.clickRoleSave();
    await this.toastr.expectSuccess();
  }

  /** Grid's Edit action is an icon-only link with no accessible name — clicks the `.edit` class directly instead of KendoGrid.clickRowAction(). */
  async openEditFor(name: string): Promise<void> {
    await this.goto();
    await this.grid.search(name);
    const row = await this.grid.findRowByText(name);
    await row.locator('a.edit').click();
    await this.page.waitForURL(/\/SetUp\/MenuAuthorization\/RoleEdit/i);
  }

  async updateName(newName: string): Promise<void> {
    await this.fillName(newName);
    await this.clickRoleUpdate();
    await this.toastr.expectSuccess();
  }

  async expectNameRequiredValidation(): Promise<void> {
    await expect(this.page.locator(roleFormSelectors.nameValidationMessage)).toHaveText(roleValidationMessages.nameRequired);
  }
}
