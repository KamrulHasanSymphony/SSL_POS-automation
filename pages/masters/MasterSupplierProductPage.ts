import { Page } from '@playwright/test';
import { BasePage } from '../common/BasePage';
import { routes, masterSupplierProductSelectors, productPickerMessages } from '../../utils/constants';

/**
 * Areas/DMS/Controllers/MasterSupplierProductController.cs +
 * Views/MasterSupplierProduct/Create.cshtml, confirmed at STEP 10.3B.
 * Create-only "convert Master Supplier -> Supplier" flow, reached via the
 * confirmed-live "From Master Supplier" button on `Supplier/Index.cshtml`.
 *
 * CONFIRMED SECURITY GAP (verbatim): `MasterSupplierProductController`
 * carries no `[Authorize]`/`[RouteArea]` attribute at all, unlike every
 * sibling controller including its own `MasterItemProductController`
 * counterpart — see masterSupplierProductSelectors' doc comment
 * (utils/constants.ts). `expectReachableWithoutAuth()` asserts this
 * specific, confirmed gap.
 *
 * Same unfiltered/paginated `#departments` grid and "Add at least one
 * detail." message as MasterItemProduct — see MasterItemProductPage.ts for
 * the shared reasoning.
 */
export class MasterSupplierProductPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async gotoCreate(): Promise<void> {
    await this.page.goto(routes.dms('MasterSupplierProduct', 'Create'));
  }

  private container() {
    return this.page.locator(masterSupplierProductSelectors.departmentsGrid);
  }

  /** Pages through the unfiltered `#departments` grid looking for the given supplier's Name, clicking its "Add" button once found. */
  async findAndAddItem(supplierName: string, maxPages = 30): Promise<void> {
    for (let i = 0; i < maxPages; i += 1) {
      const row = this.container().locator('table tbody tr').filter({ hasText: supplierName });
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
    throw new Error(`MasterSupplierProduct: item "${supplierName}" not found in #departments after paging through up to ${maxPages} pages.`);
  }

  async createFromMasterSupplier(supplierName: string): Promise<void> {
    await this.gotoCreate();
    await this.findAndAddItem(supplierName);
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
