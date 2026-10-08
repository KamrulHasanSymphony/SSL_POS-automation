import { Locator, Page, expect } from '@playwright/test';
import { BasePage } from '../common/BasePage';
import { KendoGrid } from '../../components/common-grid/KendoGrid';
import { routes, roleMenuSelectors, roleMenuMessages } from '../../utils/constants';

/**
 * Areas/SetUp/Controllers/MenuAuthorizationController.cs (RoleMenu/
 * RoleMenuIndex/RoleMenuEdit/RoleMenuCreateEdit actions) +
 * Views/MenuAuthorization/{RoleMenu,RoleMenuCreateEdit}.cshtml, confirmed
 * at STEP 10.3B. The List grid (`#RoleMenuIndexDataList`) actually lists
 * Roles (reuses the same `RoleIndex` repo call as the Role screen itself)
 * as the entry point into each role's menu checklist — confirmed via its
 * own Edit-link template:
 * `/SetUp/MenuAuthorization/RoleMenuEdit/${Id}?roleName=${Name}`. This is
 * the REAL functional entry point for "creating"/editing a role's menu
 * assignment — the generic `Create()` action renders an empty checklist
 * with nothing to check, so it is not used here.
 *
 * `RoleMenuVM` has no `[Required]` attributes — validation is purely
 * "at least one checkbox checked". The header `.chkAll` checkbox is used
 * to select every menu row in one click, since specific menu names are
 * seed data this project must not hard-code.
 */
export class RoleMenuPage extends BasePage {
  readonly grid: KendoGrid;

  constructor(page: Page) {
    super(page);
    this.grid = new KendoGrid(page, '#RoleMenuIndexDataList');
  }

  async goto(): Promise<void> {
    await this.page.goto(routes.setup('MenuAuthorization', 'RoleMenu'));
    await this.grid.waitForLoad();
  }

  async gotoEditFor(roleId: string, roleName: string): Promise<void> {
    await this.page.goto(`/SetUp/MenuAuthorization/RoleMenuEdit/${roleId}?roleName=${encodeURIComponent(roleName)}`);
  }

  async selectAllMenus(): Promise<void> {
    await this.page.locator(roleMenuSelectors.selectAllCheckbox).click();
  }

  /**
   * USER-PERMISSION-ROLE-LIFECYCLE E2E FINDING: confirmed live that
   * `tr.tablerow`'s own row-level `{ hasText: menuName }` (a SUBSTRING
   * match, not exact) is unsafe — this checklist includes report-type
   * sub-menu rows whose own names legitimately contain other top-level
   * menu group names as a substring (e.g. an "All Report" sub-item
   * mentioning "Purchase" in its own title), which can sort earlier in the
   * table than the actual top-level "Purchase" group row Playwright's
   * `.first()` was intended to reach — silently checking the WRONG row.
   * Confirmed from source (`RoleMenuCreateEdit.cshtml`): each menu name is
   * the row's OWN 4th `<td>` (no `hidden` attribute, unlike the 2nd/3rd
   * `ParentId`/`MenuId` cells) — matching that cell's TRIMMED TEXT for an
   * EXACT equality, not a row-wide substring, is the only reliable way to
   * target one specific menu.
   */
  private async findMenuRow(menuName: string): Promise<Locator> {
    const rows = this.page.locator('tr.tablerow');
    await rows.first().waitFor({ state: 'visible', timeout: 10000 });
    const count = await rows.count();
    for (let i = 0; i < count; i += 1) {
      const cellText = (await rows.nth(i).locator('td').nth(3).textContent().catch(() => null))?.trim();
      if (cellText === menuName) {
        return rows.nth(i);
      }
    }
    throw new Error(`RoleMenuPage: no menu row with exact name "${menuName}" found among ${count} rows.`);
  }

  /**
   * Checks only the specific named menu row(s), leaving every other menu
   * unchecked (unlike `selectAllMenus()`'s all-or-nothing `.chkAll`) — see
   * `findMenuRow()`'s own doc comment for why exact-name matching is
   * required. CONFIRMED ASYMMETRY (do not rely on cascade):
   * `MenuAuthorizationController.js`'s own auto-check only cascades
   * child-checked -> parent-checked, never the reverse — checking a
   * top-level menu name here does NOT automatically check its own
   * sub-menu rows, so callers needing a whole parent+children group
   * accessible must pass every row name they need explicitly.
   */
  async selectMenusByName(menuNames: string[]): Promise<void> {
    for (const menuName of menuNames) {
      const row = await this.findMenuRow(menuName);
      const checkbox = row.locator('input.mainCheckbox');
      if (!(await checkbox.isChecked())) {
        await checkbox.click();
      }
    }
  }

  /** Reads whether the given (exact) menu name's own row is currently checked — the read-back counterpart to `selectMenusByName()`, for verifying persistence precisely (this specific menu checked, that one not) rather than only `expectMenusChecked()`'s ">0 checked" bulk signal. */
  async isMenuChecked(menuName: string): Promise<boolean> {
    const row = await this.findMenuRow(menuName);
    return row.locator('input.mainCheckbox').isChecked();
  }

  async clickRoleMenuSave(): Promise<void> {
    await this.page.locator(roleMenuSelectors.saveButton).first().click();
    await this.confirmDialog.acceptIfPresent();
    await this.overlay.waitForIdle();
  }

  async assignAllMenus(roleId: string, roleName: string): Promise<void> {
    await this.gotoEditFor(roleId, roleName);
    await this.selectAllMenus();
    await this.clickRoleMenuSave();
    await this.toastr.expectSuccess();
  }

  /** Grid's Edit action is an icon-only link with no accessible name — clicks the `.edit` class directly instead of KendoGrid.clickRowAction(). */
  async openEditFor(roleName: string): Promise<void> {
    await this.goto();
    await this.grid.search(roleName);
    const row = await this.grid.findRowByText(roleName);
    await row.locator('a.edit').click();
  }

  async expectNoCheckboxSelectedWarning(): Promise<void> {
    await this.toastr.expectError(roleMenuMessages.noCheckboxSelected);
  }

  /** Confirms the checklist reflects previously-saved (persisted) checked state after a fresh navigation. */
  async expectMenusChecked(): Promise<void> {
    const checked = this.page.locator('#MenuAccessBody input.mainCheckbox:checked');
    expect(await checked.count()).toBeGreaterThan(0);
  }
}
