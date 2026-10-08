import { Page } from '@playwright/test';
import { BasePage } from '../common/BasePage';
import { KendoGrid } from '../../components/common-grid/KendoGrid';
import { KendoLineItemGrid } from '../../components/common-grid/KendoLineItemGrid';
import { KendoMultiColumnComboBox } from '../../components/kendo/KendoMultiColumnComboBox';
import { KendoDatePicker } from '../../components/kendo/KendoDatePicker';
import {
  routes,
  saleReturnFormSelectors,
  gridContainerSelectors,
  transactionGridContainers,
} from '../../utils/constants';

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export interface SaleReturnCreateData {
  customerName: string;
  productName: string;
  quantity: number;
}

/**
 * Areas/DMS/Controllers/SaleReturnController.cs +
 * Views/SaleReturn/Create.cshtml, confirmed at STEP 6. Two confirmed,
 * independently valid creation paths: blank (`Create()`, no reference) and
 * "From Sale" (`FromSale()`/`GetFromSale()`). Delete: confirmed NO
 * controller action exists at all — this is the corrected finding for
 * SRET-006 (its existing `config/tags.ts` description was found to be
 * inaccurate; per instruction, NOT modified here, only reported). No
 * delete method is provided here, per the approved STEP 6 scope.
 * Return-quantity-vs-sold-quantity validation is confirmed NOT to exist in
 * the UI layer (and structurally can't server-side either — SaleId/
 * SaleDetailId are commented out on SaleReturnDetailVM) — no such
 * assertion is made here, per STEP 6.1 proposal §P.
 */
export class SaleReturnPage extends BasePage {
  readonly grid: KendoGrid;
  readonly lineItems: KendoLineItemGrid;
  private readonly customerCombo: KendoMultiColumnComboBox;
  private readonly invoiceDate: KendoDatePicker;

  constructor(page: Page) {
    super(page);
    this.grid = new KendoGrid(page, gridContainerSelectors.default);
    this.lineItems = new KendoLineItemGrid(page, transactionGridContainers.shared, 'UnitRate');
    this.customerCombo = new KendoMultiColumnComboBox(page, saleReturnFormSelectors.customerId);
    this.invoiceDate = new KendoDatePicker(page, 'InvoiceDateTime');
  }

  async goto(): Promise<void> {
    await this.page.goto(routes.dms('SaleReturn', 'Index'));
    await this.grid.waitForLoad();
  }

  async gotoCreate(): Promise<void> {
    await this.page.goto(routes.dms('SaleReturn', 'Create'));
  }

  async selectCustomer(uniqueCustomerName: string): Promise<void> {
    await this.customerCombo.typeAndSelectFirst(uniqueCustomerName);
  }

  async fillInvoiceDate(isoDate: string = today()): Promise<void> {
    await this.invoiceDate.setDate(isoDate);
  }

  /** Blank/manual creation path — no Sale reference. */
  async createSaleReturn(data: SaleReturnCreateData): Promise<string> {
    await this.gotoCreate();
    await this.selectCustomer(data.customerName);
    await this.fillInvoiceDate();
    await this.lineItems.addLineItem(data.productName, data.quantity);
    await this.clickSave();
    await this.toastr.expectSuccess();
    return this.getCode();
  }

  /**
   * "From Sale" creation path — confirmed mechanism (SaleReturnController.cs
   * FromSale()/GetFromSale(), FromSaleController.js): a radio-select grid of
   * existing Sales, chosen via a page-level Select button (same pattern
   * confirmed for PurchaseReturn's FromPurchase flow).
   */
  async gotoFromSale(): Promise<void> {
    await this.page.goto(routes.dms('SaleReturn', 'FromSale'));
  }

  /**
   * SALE-RETURN-LIFECYCLE E2E FINDING (first live exercise of this method):
   * confirmed live (ARIA snapshot captured at the exact `toastr.expectSuccess()`
   * timeout this replaced — see the removed call's own history) that
   * `GetFromSale` pre-populates `#saleOrderDetails` with one row per source
   * Sale line item — correct ProductId/ProductName/UnitRate carried over —
   * with `Quantity` defaulted to the SOURCE SALE'S OWN FULL QUANTITY (not
   * `0`, unlike `PurchaseReturnController.js`'s confirmed `GetFromPurchase`
   * equivalent — a genuinely different default, not assumed to match).
   * `addLineItem()` (the previous implementation) therefore added a SECOND,
   * duplicate row for the same product instead of editing the pre-populated
   * one — confirmed live: the saved Return's own footer Total row read
   * "120.00 / 12,000.00" (100 pre-populated + 20 newly added), silently
   * returning 100 units MORE than the caller actually asked to return.
   * Edits the existing pre-populated row's quantity instead of adding a new
   * one — same fix, same evidence shape, as
   * `PurchaseReturnPage.createFromPurchase()`'s own identical correction.
   */
  async createFromSale(saleCode: string, productName: string, quantity: number): Promise<string> {
    await this.gotoFromSale();
    // FromSale.cshtml's own grid container id was not independently
    // confirmed at STEP 6 — locating by visible text avoids depending on an
    // unverified container id (same approach as PurchaseReturnPage.createFromPurchase).
    const row = this.page.locator('tr', { hasText: saleCode }).first();
    await row.waitFor({ state: 'visible', timeout: 15000 });
    await row.locator('.row-radio').check();
    await this.page.locator('#btnSelect').click();
    await this.page.waitForURL(/\/DMS\/SaleReturn\/(Create|GetFromSale)/i);

    const returnRow = this.lineItems.rows().filter({ hasText: productName }).first();
    await this.lineItems.setQuantity(returnRow, quantity);
    await this.clickSave();
    return this.waitForSaveSuccess();
  }

  /**
   * See `createFromSale()`'s own doc comment for the live evidence this is
   * built on — mirrors SalePage.waitForSaveSuccess()/
   * PurchaseReturnPage.waitForSaveSuccess() exactly: confirmed live (ARIA
   * snapshot captured mid-failure: `#Code` already populated,
   * "Update"/"Post" buttons already rendered, i.e. the save had already
   * genuinely succeeded and navigated to Edit) that a real successful save
   * does navigate to `/DMS/SaleReturn/Edit/{id}` — the generic
   * no-argument toast check raced that navigation and lost, exactly the
   * same confirmed false-negative shape already fixed for
   * Sale/SaleOrder/PurchaseReturn's own equivalents.
   */
  async waitForSaveSuccess(): Promise<string> {
    await this.page.waitForURL(/\/DMS\/SaleReturn\/Edit/i, { timeout: 15000 });
    return this.waitForCode();
  }

  async openEditFor(code: string): Promise<void> {
    await this.goto();
    await this.grid.search(code);
    await this.grid.clickRowAction(code, /edit/i);
    await this.page.waitForURL(/\/DMS\/SaleReturn\/Edit/i);
  }

  async post(): Promise<void> {
    await this.clickPost();
  }
}
