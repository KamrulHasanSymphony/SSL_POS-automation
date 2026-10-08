import { Page } from '@playwright/test';
import { BasePage } from '../common/BasePage';
import { routes, masterItemProductSelectors, productPickerMessages } from '../../utils/constants';

/**
 * Areas/DMS/Controllers/MasterItemProductController.cs +
 * Views/MasterItemProduct/Create.cshtml, confirmed at STEP 10.3B.
 * Create-only "convert Master Item -> Product" flow, reached via the
 * confirmed-live "From Master Item" button on `Product/Index.cshtml`.
 *
 * CONFIRMED: `#departments` is NOT filtered by group (the combo/filter
 * code is commented out) — it auto-loads ALL existing MasterItems,
 * paginated, with no search box. `findAndAddItem()` pages through the
 * grid looking for the target item's Name rather than assuming a
 * position or filtering — see masterItemProductSelectors' doc comment
 * (utils/constants.ts) for the full source trail, including the
 * confirmed exact "Add at least one detail." client message and why the
 * success toastr is asserted only for non-empty text, not an exact string.
 */
export class MasterItemProductPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async gotoCreate(): Promise<void> {
    await this.page.goto(routes.dms('MasterItemProduct', 'Create'));
  }

  private container() {
    return this.page.locator(masterItemProductSelectors.departmentsGrid);
  }

  /** Pages through the unfiltered `#departments` grid looking for the given item's Name, clicking its "Add" button once found. */
  async findAndAddItem(itemName: string, maxPages = 30): Promise<void> {
    for (let i = 0; i < maxPages; i += 1) {
      const row = this.container().locator('table tbody tr').filter({ hasText: itemName });
      if ((await row.count()) > 0) {
        await row.first().locator('.addToDetails').click();
        return;
      }
      const nextButton = this.container().locator('.k-pager-nav[title="Go to the next page"], .k-i-arrow-e').first();
      const enabled = await nextButton.isEnabled().catch(() => false);
      if (!enabled) break;
      await nextButton.click();
      await this.overlay.waitForIdle();
    }
    throw new Error(`MasterItemProduct: item "${itemName}" not found in #departments after paging through up to ${maxPages} pages.`);
  }

  async createFromMasterItem(itemName: string): Promise<void> {
    await this.gotoCreate();
    await this.findAndAddItem(itemName);
    await this.clickSave();
    await this.toastr.expectSuccess();
  }

  async clickSaveWithoutDetail(): Promise<void> {
    await this.gotoCreate();
    await this.clickSave();
  }

  async expectAtLeastOneDetailRequired(): Promise<void> {
    await this.toastr.expectError(productPickerMessages.atLeastOneDetailRequired);
  }
}
