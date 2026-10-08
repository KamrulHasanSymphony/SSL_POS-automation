import { Page, expect } from '@playwright/test';
import { BasePage } from '../common/BasePage';
import { KendoGrid } from '../../components/common-grid/KendoGrid';
import { KendoMultiColumnComboBox } from '../../components/kendo/KendoMultiColumnComboBox';
import { uniqueCode } from '../../utils/random-data';
import {
  routes,
  productFormSelectors,
  productValidationMessages,
  gridContainerSelectors,
} from '../../utils/constants';

export interface ProductCreateData {
  name: string;
  /** Unique Name of an API-created, active Product Group (STEP 5 §5 prerequisite). */
  productGroupName: string;
  /** Unique Name of an API-created, active UOM (STEP 5 §5 prerequisite). */
  uomName: string;
  /**
   * Optional — ProductVM.SalePrice, confirmed [Range(0, double.MaxValue)]
   * with no [Required], a plain (non-Kendo) numeric textbox on
   * Product/Create.cshtml. Added for the cross-module E2E sales-lifecycle
   * flow, where a Sale line item needs a real, non-zero UnitRate. Every
   * existing caller that omits this is unaffected — see fillRequired().
   */
  salePrice?: number;
  /**
   * Optional — ProductVM.PurchasePrice, same shape as salePrice above
   * (plain non-Kendo numeric textbox, `@Html.TextBoxFor(model =>
   * model.PurchasePrice, ...)` on Product/Create.cshtml). Added for the
   * Purchase-lifecycle E2E flow: confirmed live that Purchase's own save
   * handler rejects a line item with `UnitPrice <= 0` ("Unit Price must be
   * greater than 0" toastr) — a Product with no Purchase Price produces
   * exactly that 0 rate once carried into a Purchase Order/Purchase line
   * item. Every existing caller that omits this is unaffected — see
   * fillRequired().
   */
  purchasePrice?: number;
  /**
   * Optional — ProductVM.ProductStock, confirmed the sole "Opening Stock /
   * Initial Stock Entry" mechanism in this application (Inventory-lifecycle
   * E2E investigation): a plain numeric textbox on Product/Create.cshtml,
   * rendered ONLY when `Operation != "update"` (i.e. Create only — there is
   * no Edit-time equivalent). Confirmed write-once from
   * ProductRepository.cs: the INSERT statement binds `@ProductStock`, but
   * the UPDATE statement has no ProductStock parameter at all — this value
   * can never be changed once the Product is created. A dedicated
   * "ProductsOpeningStocks" import module exists in source but is fully
   * dead code (excluded from every .csproj's compilation, its own service
   * references a repository class with no source file) — not used here, see
   * ProductPage.ts's own class doc comment for the full citation. Every
   * existing caller that omits this is unaffected — see fillRequired().
   */
  openingStock?: number;
  /**
   * VAT-LIFECYCLE-PHASE-2 addition — ProductVM.VATRate, confirmed
   * [Range(0, double.MaxValue)] with no [Required], a plain (non-Kendo)
   * numeric textbox rendered on BOTH Create and Edit (unlike openingStock
   * above, which is Create-only). This is the per-product DEFAULT VAT rate
   * — see productFormSelectors.vatRate's own doc comment (utils/constants.ts)
   * for the confirmed auto-populate-into-line-item mechanism. Every
   * existing caller that omits this is unaffected — see fillRequired().
   */
  vatRate?: number;
  /** Optional — ProductVM.SDRate, same shape as vatRate above. See productFormSelectors.sdRate's own doc comment. */
  sdRate?: number;
}

/**
 * ProductVM.SalePrice's id, confirmed directly from Product/Create.cshtml
 * (`@Html.TextBoxFor(model => model.SalePrice, ...)` → id="SalePrice"; NOT
 * progressively enhanced into a Kendo widget, unlike ProductGroupId/UOMId).
 * Kept local to this file rather than added to utils/constants.ts's
 * productFormSelectors, per this implementation step's file scope — should
 * be migrated there in a future, properly-scoped step for consistency with
 * every other selector in this project.
 */
const salePriceSelector = '#SalePrice';

/** ProductVM.PurchasePrice's id — see purchasePrice's doc comment above. Same file-scope reasoning as salePriceSelector. */
const purchasePriceSelector = '#PurchasePrice';

/**
 * ProductVM.ProductStock's id, confirmed directly from Product/Create.cshtml
 * (`@Html.TextBoxFor(model => model.ProductStock, ...)` inside the
 * `Operation != "update"` guard — Create-only). Same file-scope reasoning as
 * salePriceSelector/purchasePriceSelector above; see openingStock's doc
 * comment on ProductCreateData for the full Inventory-lifecycle finding.
 */
const openingStockSelector = '#ProductStock';

/**
 * STEP 10 LIVE EXECUTION FINDING: ProductVM.BarCode's id, confirmed directly
 * from Product/Create.cshtml (`@Html.TextBoxFor(model => model.BarCode, ...)`
 * → id="BarCode"). Carries `class="required"` and is checked client-side by
 * ProductController.js's `CommonValidationHelper.CheckValidation("#frmEntry")`
 * — confirmed live: attempting Save without it blocks before the confirm
 * dialog ever appears (no server-side [Required] exists on BarCode itself,
 * this is purely a client-side gate). Kept local to this file for the same
 * file-scope reason as salePriceSelector above.
 */
const barcodeSelector = '#BarCode';

/**
 * Areas/DMS/Controllers/ProductController.cs + Views/Product/Create.cshtml,
 * re-confirmed directly from source at STEP 5 implementation time. Single
 * #frmEntry form shared by Create/Edit (Operation "add"/"update").
 * ProductGroupId/UOMId are plain <input> elements progressively enhanced
 * into a Kendo MultiColumnComboBox client-side. Delete is confirmed
 * NOT reachable via the UI (button commented out in Index.cshtml) — no
 * delete method is provided here, per the approved STEP 5 scope.
 */
export class ProductPage extends BasePage {
  readonly grid: KendoGrid;
  private readonly productGroupCombo: KendoMultiColumnComboBox;
  private readonly uomCombo: KendoMultiColumnComboBox;

  constructor(page: Page) {
    super(page);
    this.grid = new KendoGrid(page, gridContainerSelectors.default);
    this.productGroupCombo = new KendoMultiColumnComboBox(page, productFormSelectors.productGroupId);
    this.uomCombo = new KendoMultiColumnComboBox(page, productFormSelectors.uomId);
  }

  async goto(): Promise<void> {
    await this.page.goto(routes.dms('Product', 'Index'));
    await this.grid.waitForLoad();
  }

  async gotoCreate(): Promise<void> {
    await this.page.goto(routes.dms('Product', 'Create'));
  }

  async fillName(name: string): Promise<void> {
    await this.page.locator(productFormSelectors.name).fill(name);
  }

  async selectProductGroup(uniqueGroupName: string): Promise<void> {
    await this.productGroupCombo.typeAndSelectFirst(uniqueGroupName);
  }

  async selectUom(uniqueUomName: string): Promise<void> {
    await this.uomCombo.typeAndSelectFirst(uniqueUomName);
  }

  /**
   * Optional — SalePrice is a plain, non-Kendo numeric textbox (confirmed
   * ProductVM.SalePrice: [Range(0, double.MaxValue)], no [Required]), so
   * this mirrors the existing simple textbox helpers (e.g. CustomerPage's
   * fillTelephone()/fillEmail()) rather than the Kendo-combo pattern used
   * by selectProductGroup()/selectUom() above.
   */
  private async fillSalePrice(salePrice: number): Promise<void> {
    await this.page.locator(salePriceSelector).fill(String(salePrice));
  }

  /** Optional — mirrors fillSalePrice() exactly; see ProductCreateData.purchasePrice's doc comment. */
  private async fillPurchasePrice(purchasePrice: number): Promise<void> {
    await this.page.locator(purchasePriceSelector).fill(String(purchasePrice));
  }

  /** Optional — mirrors fillSalePrice()/fillPurchasePrice() exactly; see ProductCreateData.openingStock's doc comment. Create-only (the field itself does not render on Edit), so this is only ever called from fillRequired() -> createProduct()'s own gotoCreate() path. */
  private async fillOpeningStock(openingStock: number): Promise<void> {
    await this.page.locator(openingStockSelector).fill(String(openingStock));
  }

  /** VAT-LIFECYCLE-PHASE-2 addition — mirrors fillSalePrice()/fillPurchasePrice() exactly; see ProductCreateData.vatRate's own doc comment. Unlike openingStock, renders on both Create AND Edit. */
  async fillVatRate(vatRate: number): Promise<void> {
    await this.page.locator(productFormSelectors.vatRate).fill(String(vatRate));
  }

  /** Optional — mirrors fillVatRate() exactly; see ProductCreateData.sdRate's own doc comment. */
  async fillSdRate(sdRate: number): Promise<void> {
    await this.page.locator(productFormSelectors.sdRate).fill(String(sdRate));
  }

  /**
   * STEP 10 addition — see barcodeSelector's doc comment. Unconditional
   * (unlike fillSalePrice): confirmed live that Save is blocked without it,
   * so every createProduct() call needs it, not just callers that opt in.
   * The value itself is inconsequential to every existing/E2E assertion
   * (no test reads Barcode back), so it is generated internally rather than
   * added as a new ProductCreateData field — no caller-facing change.
   */
  private async fillBarcode(barcode: string): Promise<void> {
    await this.page.locator(barcodeSelector).fill(barcode);
  }

  /**
   * Fills every field required by ProductVM's server-side annotations
   * (Name, Product Group, UOM) plus the client-side-required Barcode (STEP
   * 10), plus Sale Price / Purchase Price when supplied. Both are optional
   * (see ProductCreateData) — omitting either leaves this method's behavior
   * identical to before either existed.
   */
  async fillRequired(data: ProductCreateData): Promise<void> {
    await this.fillName(data.name);
    await this.selectProductGroup(data.productGroupName);
    await this.selectUom(data.uomName);
    await this.fillBarcode(uniqueCode('BARCODE'));
    if (data.salePrice !== undefined) {
      await this.fillSalePrice(data.salePrice);
    }
    if (data.purchasePrice !== undefined) {
      await this.fillPurchasePrice(data.purchasePrice);
    }
    if (data.openingStock !== undefined) {
      await this.fillOpeningStock(data.openingStock);
    }
    if (data.vatRate !== undefined) {
      await this.fillVatRate(data.vatRate);
    }
    if (data.sdRate !== undefined) {
      await this.fillSdRate(data.sdRate);
    }
  }

  /**
   * Full UI create flow: fills required fields and saves.
   *
   * STEP 10 LIVE EXECUTION FINDING: confirmed live (trace evidence) that
   * Product's post-save navigation behaves exactly like Customer's
   * (previously unconfirmed here, per this comment's own prior text) — a
   * `window.location.href`-style redirect to `/DMS/Product/Edit/{id}` that
   * races and destroys the success toast before it can be observed. Reuses
   * the exact same proven signal openEditFor() below already relies on,
   * instead of the toast.
   */
  async createProduct(data: ProductCreateData): Promise<void> {
    await this.gotoCreate();
    await this.fillRequired(data);
    await this.clickSave();
    await this.page.waitForURL(/\/DMS\/Product\/Edit/i);
  }

  /** Opens the Edit form for a previously created Product via the grid's own search + row action, independent of any assumption about post-save navigation. */
  async openEditFor(uniqueName: string): Promise<void> {
    await this.goto();
    await this.grid.search(uniqueName);
    await this.grid.clickRowAction(uniqueName, /edit/i);
    await this.page.waitForURL(/\/DMS\/Product\/Edit/i);
  }

  async updateName(newName: string): Promise<void> {
    await this.fillName(newName);
    await this.clickUpdate();
    await this.toastr.expectSuccess();
  }

  isProductStockFieldPresent(): Promise<boolean> {
    return this.page.locator(productFormSelectors.productStock).isVisible().catch(() => false);
  }

  async expectNameRequiredValidation(): Promise<void> {
    await expect(this.page.locator(productFormSelectors.nameValidationMessage)).toHaveText(
      productValidationMessages.nameRequired
    );
  }

  async expectProductGroupRequiredIndicated(): Promise<void> {
    await this.expectRequiredIndicatorVisible(productFormSelectors.productGroupDropdownError);
  }

  async expectUomRequiredIndicated(): Promise<void> {
    await this.expectRequiredIndicatorVisible(productFormSelectors.uomDropdownError);
  }
}
