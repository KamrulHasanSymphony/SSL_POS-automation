import { Page, expect } from '@playwright/test';
import { BasePage } from '../common/BasePage';
import { KendoGrid } from '../../components/common-grid/KendoGrid';
import { routes, areaFormSelectors, areaValidationMessages } from '../../utils/constants';

/**
 * Areas/DMS/Controllers/AreasController.cs + Views/Areas/{Create,Index}.cshtml
 * + AreaVM.cs, confirmed at STEP 9.2B.
 *
 * CONFIRMED BLOCKER — STOP CONDITION (reported, not worked around):
 * Country/Division/District/Thana are Kendo MultiColumnComboBoxes reading
 * from `/Common/Common/GetAreaLocationList` (AreasController.js), which does
 * not exist in `CommonController.cs` on either tier — a confirmed 404 on
 * every cascade regardless of environment. `EnumTypeId`'s only creation path
 * is API-only (`api/EnumType/Insert`), out of scope for this UI-only phase.
 * No safe, non-guessed way exists to populate these `save()`-required
 * fields (`CommonService.validateDropdown` checks all four plus EnumType).
 * Create, and everything depending on a successfully-created Area
 * (Edit/Delete/Search), are intentionally NOT implemented here — see the
 * STEP 9.2B report. Only List (no create needed) and the empty-Name
 * negative case (never touches the broken combos — `$("#Areas_Form").validate().form()`
 * for Name runs independently of `validateDropdown()`) are implemented.
 *
 * Same duplicate-`#Name` defect as BranchProfile (`HiddenFor` + real
 * `TextBoxFor`, both `id="Name"`) — `.last()` for the same reason.
 */
export class AreaPage extends BasePage {
  readonly grid: KendoGrid;

  constructor(page: Page) {
    super(page);
    this.grid = new KendoGrid(page, '#AreasGrid');
  }

  async goto(): Promise<void> {
    await this.page.goto(routes.dms('Areas', 'Index'));
    await this.grid.waitForLoad();
  }

  async gotoCreate(): Promise<void> {
    await this.page.goto(routes.dms('Areas', 'Create'));
  }

  async fillName(name: string): Promise<void> {
    await this.page.locator(areaFormSelectors.name).last().fill(name);
  }

  async expectNameRequiredValidation(): Promise<void> {
    await expect(this.page.locator(areaFormSelectors.nameValidationMessage)).toHaveText(areaValidationMessages.nameRequired);
  }
}
