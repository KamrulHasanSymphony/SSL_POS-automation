import { Page, expect } from '@playwright/test';
import { BasePage } from '../common/BasePage';
import { KendoGrid } from '../../components/common-grid/KendoGrid';
import { KendoMultiColumnComboBox } from '../../components/kendo/KendoMultiColumnComboBox';
import {
  routes,
  customerFormSelectors,
  customerValidationMessages,
  gridContainerSelectors,
} from '../../utils/constants';

export interface CustomerCreateData {
  name: string;
  /** Unique Name of an API-created, active Customer Group (STEP 5 §5 prerequisite). */
  customerGroupName: string;
  telephoneNo: string;
  email: string;
  address: string;
}

/**
 * Areas/DMS/Controllers/CustomerController.cs + Views/Customer/Create.cshtml,
 * re-confirmed directly from source at STEP 5 implementation time. Single
 * #frmEntry form shared by Create/Edit. CustomerGroupId is a plain <input>
 * progressively enhanced into a Kendo MultiColumnComboBox client-side. On a
 * successful Create, the app navigates directly to
 * `/DMS/Customer/Edit/{id}` (confirmed: `CustomerController.js`
 * `window.location.href = "/DMS/Customer/Edit/" + id`) — openEditFor() below
 * falls back to the grid only if that direct navigation doesn't happen.
 * Delete is confirmed NOT reachable via the UI (the controller action itself
 * is commented out, and the button is commented out) — no delete method is
 * provided here, per the approved STEP 5 scope.
 */
export class CustomerPage extends BasePage {
  readonly grid: KendoGrid;
  private readonly customerGroupCombo: KendoMultiColumnComboBox;

  constructor(page: Page) {
    super(page);
    this.grid = new KendoGrid(page, gridContainerSelectors.default);
    this.customerGroupCombo = new KendoMultiColumnComboBox(page, customerFormSelectors.customerGroupId);
  }

  async goto(): Promise<void> {
    await this.page.goto(routes.dms('Customer', 'Index'));
    await this.grid.waitForLoad();
  }

  async gotoCreate(): Promise<void> {
    await this.page.goto(routes.dms('Customer', 'Create'));
  }

  async fillName(name: string): Promise<void> {
    await this.page.locator(customerFormSelectors.name).fill(name);
  }

  async selectCustomerGroup(uniqueGroupName: string): Promise<void> {
    await this.customerGroupCombo.typeAndSelectFirst(uniqueGroupName);
  }

  async fillTelephone(telephoneNo: string): Promise<void> {
    await this.page.locator(customerFormSelectors.telephoneNo).fill(telephoneNo);
  }

  async fillEmail(email: string): Promise<void> {
    await this.page.locator(customerFormSelectors.email).fill(email);
  }

  async fillAddress(address: string): Promise<void> {
    await this.page.locator(customerFormSelectors.address).fill(address);
  }

  /** Fills every field required by CustomerVM's server-side annotations plus the JS-enforced Address check. */
  async fillRequired(data: CustomerCreateData): Promise<void> {
    await this.fillName(data.name);
    await this.selectCustomerGroup(data.customerGroupName);
    await this.fillTelephone(data.telephoneNo);
    await this.fillEmail(data.email);
    await this.fillAddress(data.address);
  }

  async createCustomer(data: CustomerCreateData): Promise<void> {
    await this.gotoCreate();
    await this.fillRequired(data);
    await this.clickSave();
    // STEP 9 LIVE EXECUTION FINDING: the success toast races the class doc
    // comment's own confirmed `window.location.href` redirect to Edit — real
    // trace evidence showed the toast-visibility check starting only after
    // the redirect had already completed, so it timed out finding nothing on
    // a document that no longer existed, even though Create had genuinely
    // succeeded (confirmed by the Edit page's own populated Code/fields).
    // The redirect itself — already the confirmed signal openEditFor() below
    // relies on — is the reliable success signal here, not the toast.
    await this.page.waitForURL(/\/DMS\/Customer\/Edit/i);
  }

  async openEditFor(uniqueName: string): Promise<void> {
    const alreadyOnEdit = /\/DMS\/Customer\/Edit/i.test(this.page.url());
    if (alreadyOnEdit) return;
    await this.goto();
    await this.grid.search(uniqueName);
    await this.grid.clickRowAction(uniqueName, /edit/i);
    await this.page.waitForURL(/\/DMS\/Customer\/Edit/i);
  }

  async updateNameAndAddress(newName: string, newAddress: string): Promise<void> {
    await this.fillName(newName);
    await this.fillAddress(newAddress);
    await this.clickUpdate();
    await this.toastr.expectSuccess();
  }

  async expectCustomerGroupRequiredIndicated(): Promise<void> {
    await this.expectRequiredIndicatorVisible(customerFormSelectors.customerGroupDropdownError);
  }

  async expectTelephoneRequiredValidation(): Promise<void> {
    await expect(this.page.locator(customerFormSelectors.telephoneValidationMessage)).toHaveText(
      customerValidationMessages.telephoneRequired
    );
  }

  async expectInvalidEmailValidation(): Promise<void> {
    await expect(this.page.locator(customerFormSelectors.emailValidationMessage)).toHaveText(
      customerValidationMessages.invalidEmailFormat
    );
  }
}
