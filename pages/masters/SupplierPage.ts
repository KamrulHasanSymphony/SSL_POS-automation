import { Page, expect } from '@playwright/test';
import { BasePage } from '../common/BasePage';
import { KendoGrid } from '../../components/common-grid/KendoGrid';
import { KendoMultiColumnComboBox } from '../../components/kendo/KendoMultiColumnComboBox';
import { randomData } from '../../utils/random-data';
import {
  routes,
  supplierFormSelectors,
  supplierValidationMessages,
  gridContainerSelectors,
} from '../../utils/constants';

/**
 * PURCHASE-LIFECYCLE E2E LIVE RUNTIME FINDING: Supplier/Create.cshtml's
 * `#TelephoneNo` field carries `class="required"` and IS enforced by
 * client-side jQuery Unobtrusive Validation — confirmed live (accessibility
 * snapshot at the point of failure showed "This field is required." next to
 * the Telephone No. spinbutton, and Save's confirm dialog/AJAX submission
 * never fired, exactly matching BasePage.clickSave()'s own documented
 * behavior for a validation-blocked submit). Not previously modeled in
 * `supplierFormSelectors`/`SupplierCreateData`/this file. Its exact value is
 * inconsequential to every existing/E2E assertion (no test reads Telephone
 * No. back), so — mirroring ProductPage.ts's identical `fillBarcode()`
 * precedent for its own client-side-required-but-inconsequential field — it
 * is generated internally and filled unconditionally rather than added as a
 * new SupplierCreateData field: no caller-facing change, no existing caller
 * affected.
 */
const telephoneNoSelector = '#TelephoneNo';

export interface SupplierCreateData {
  name: string;
  /** Unique Name of an API-created, active Supplier Group (STEP 5 §5 prerequisite). */
  supplierGroupName: string;
  address: string;
}

/**
 * Areas/DMS/Controllers/SupplierController.cs + Views/Supplier/Create.cshtml,
 * re-confirmed directly from source at STEP 5 implementation time. Single
 * #frmEntry form shared by Create/Edit. SupplierGroupId is a plain <input>
 * progressively enhanced into a Kendo MultiColumnComboBox client-side.
 * MasterSupplier is confirmed NOT referenced anywhere in this form and is
 * therefore out of scope (STEP 5 approved decision §4) — this page object
 * has no MasterSupplier dependency. Delete is confirmed NOT reachable via
 * the UI (button commented out in Index.cshtml) — no delete method is
 * provided here, per the approved STEP 5 scope.
 */
export class SupplierPage extends BasePage {
  readonly grid: KendoGrid;
  private readonly supplierGroupCombo: KendoMultiColumnComboBox;

  constructor(page: Page) {
    super(page);
    this.grid = new KendoGrid(page, gridContainerSelectors.default);
    this.supplierGroupCombo = new KendoMultiColumnComboBox(page, supplierFormSelectors.supplierGroupId);
  }

  async goto(): Promise<void> {
    await this.page.goto(routes.dms('Supplier', 'Index'));
    await this.grid.waitForLoad();
  }

  async gotoCreate(): Promise<void> {
    await this.page.goto(routes.dms('Supplier', 'Create'));
  }

  async fillName(name: string): Promise<void> {
    await this.page.locator(supplierFormSelectors.name).fill(name);
  }

  async selectSupplierGroup(uniqueGroupName: string): Promise<void> {
    await this.supplierGroupCombo.typeAndSelectFirst(uniqueGroupName);
  }

  async fillAddress(address: string): Promise<void> {
    await this.page.locator(supplierFormSelectors.address).fill(address);
  }

  /** See telephoneNoSelector's doc comment above — unconditional, client-side-required, value inconsequential to any assertion. */
  private async fillTelephoneNo(): Promise<void> {
    await this.page.locator(telephoneNoSelector).fill(randomData.phone11Digit());
  }

  /** Fills every field required by SupplierVM's server-side annotations (Name, Supplier Group, Address) plus the client-side-required Telephone No. */
  async fillRequired(data: SupplierCreateData): Promise<void> {
    await this.fillName(data.name);
    await this.selectSupplierGroup(data.supplierGroupName);
    await this.fillAddress(data.address);
    await this.fillTelephoneNo();
  }

  /**
   * PURCHASE-LIFECYCLE E2E LIVE RUNTIME FINDING: confirmed live (trace
   * network log — GET /DMS/Supplier/Edit/{id} fires within the same window
   * as the save) that Supplier's post-save navigation behaves exactly like
   * Product's/Customer's — a redirect to /DMS/Supplier/Edit/{id} that races
   * and can destroy the success toast before it's observed. Reuses the same
   * proven signal openEditFor() already relies on, instead of the toast —
   * identical fix ProductPage.createProduct()'s own doc comment already
   * documents for its structurally identical race.
   */
  async createSupplier(data: SupplierCreateData): Promise<void> {
    await this.gotoCreate();
    await this.fillRequired(data);
    await this.clickSave();
    await this.page.waitForURL(/\/DMS\/Supplier\/Edit/i);
  }

  async openEditFor(uniqueName: string): Promise<void> {
    const alreadyOnEdit = /\/DMS\/Supplier\/Edit/i.test(this.page.url());
    if (alreadyOnEdit) return;
    await this.goto();
    await this.grid.search(uniqueName);
    await this.grid.clickRowAction(uniqueName, /edit/i);
    await this.page.waitForURL(/\/DMS\/Supplier\/Edit/i);
  }

  async updateName(newName: string): Promise<void> {
    await this.fillName(newName);
    await this.clickUpdate();
    await this.toastr.expectSuccess();
  }

  async expectNameRequiredValidation(): Promise<void> {
    await expect(this.page.locator(supplierFormSelectors.nameValidationMessage)).toHaveText(
      supplierValidationMessages.nameRequired
    );
  }

  async expectSupplierGroupRequiredIndicated(): Promise<void> {
    await this.expectRequiredIndicatorVisible(supplierFormSelectors.supplierGroupDropdownError);
  }

  async expectAddressRequiredValidation(): Promise<void> {
    await expect(this.page.locator(supplierFormSelectors.addressValidationMessage)).toHaveText(
      supplierValidationMessages.addressRequired
    );
  }
}
