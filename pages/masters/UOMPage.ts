import { Page, expect } from '@playwright/test';
import { BasePage } from '../common/BasePage';
import { KendoGrid } from '../../components/common-grid/KendoGrid';
import { routes, gridContainerSelectors, uomFormSelectors, uomValidationMessages } from '../../utils/constants';

/**
 * Areas/DMS/Controllers/UOMController.cs + Views/UOM/Create.cshtml +
 * UOMController.js, confirmed at STEP 10.3A. Flat lookup master, no
 * dependencies (distinct from the API-only `createUom()` prerequisite
 * helper used elsewhere as a fixture — this exercises UOM's own UI screen).
 *
 * CONFIRMED: `.btnsave` goes straight to the Confirmation dialog with no
 * pre-check (`UOMController.js:12-24`); `form.valid()` only runs inside
 * `save()`, called after the user confirms (`UOMController.js:514-523`).
 * No special handling needed — `BasePage.clickSave()`'s
 * `confirmDialog.acceptIfPresent()` already accepts the dialog whenever it
 * appears, identically to every other module's negative-test flow.
 *
 * CONFIRMED: the grid's Action column renders TWO links sharing the same
 * `.edit` CSS class — the real Edit link AND a separate "Report Preview"
 * link (`UOMController.js:288-295`) — `.first()` targets the Edit link,
 * which renders first in the template.
 *
 * Delete has no button at all on Index.cshtml (stricter than the usual
 * commented-out pattern) — no delete method here regardless.
 */
export class UOMPage extends BasePage {
  readonly grid: KendoGrid;

  constructor(page: Page) {
    super(page);
    this.grid = new KendoGrid(page, gridContainerSelectors.default);
  }

  async goto(): Promise<void> {
    await this.page.goto(routes.dms('UOM', 'Index'));
    await this.grid.waitForLoad();
  }

  async gotoCreate(): Promise<void> {
    await this.page.goto(routes.dms('UOM', 'Create'));
  }

  async fillName(name: string): Promise<void> {
    await this.page.locator(uomFormSelectors.name).fill(name);
  }

  async createUom(name: string): Promise<string> {
    await this.gotoCreate();
    await this.fillName(name);
    await this.clickSave();
    await this.toastr.expectSuccess();
    return this.getCode();
  }

  async openEditFor(code: string): Promise<void> {
    await this.goto();
    await this.grid.search(code);
    const row = await this.grid.findRowByText(code);
    await row.locator('a.edit').first().click();
    await this.page.waitForURL(/\/DMS\/UOM\/Edit/i);
  }

  async updateName(newName: string): Promise<void> {
    await this.fillName(newName);
    await this.clickUpdate();
    await this.toastr.expectSuccess();
  }

  async expectNameRequiredValidation(): Promise<void> {
    await expect(this.page.locator(uomFormSelectors.nameValidationMessage)).toHaveText(uomValidationMessages.nameRequired);
  }
}
