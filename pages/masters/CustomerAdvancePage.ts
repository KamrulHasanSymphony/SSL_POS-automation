import { Page, expect } from '@playwright/test';
import { BasePage } from '../common/BasePage';
import { KendoGrid } from '../../components/common-grid/KendoGrid';
import { KendoMultiColumnComboBox } from '../../components/kendo/KendoMultiColumnComboBox';
import { customerAdvanceFormSelectors, customerAdvanceValidationMessages } from '../../utils/constants';

/**
 * Areas/DMS/Controllers/CustomerAdvanceController.cs +
 * Views/CustomerAdvance/{Create,Index}.cshtml, confirmed at STEP 10.3B.
 * Standalone screen (NOT an embedded Customer tab — see
 * customerAdvanceFormSelectors' doc comment), reached with a real
 * Customer's numeric database Id, not its Code/Name. `Post` is confirmed
 * to call a broken endpoint — not implemented here.
 */
export class CustomerAdvancePage extends BasePage {
  readonly grid: KendoGrid;
  private readonly paymentEnumTypeCombo: KendoMultiColumnComboBox;

  constructor(page: Page) {
    super(page);
    this.grid = new KendoGrid(page, '#GridDataList');
    this.paymentEnumTypeCombo = new KendoMultiColumnComboBox(page, customerAdvanceFormSelectors.paymentEnumTypeId);
  }

  async goto(customerId: string, customerName: string): Promise<void> {
    await this.page.goto(`/DMS/CustomerAdvance/Index?id=${customerId}&Name=${encodeURIComponent(customerName)}`);
    await this.grid.waitForLoad();
  }

  async gotoCreate(customerId: string): Promise<void> {
    await this.page.goto(`/DMS/CustomerAdvance/Create?CustomerId=${customerId}`);
  }

  async fillAdvanceAmount(amount: number): Promise<void> {
    await this.page.locator(customerAdvanceFormSelectors.advanceAmount).fill(String(amount));
  }

  /**
   * Opens the (working, autoBind) Payment Type combo and selects the first
   * available option — this project must not hard-code a specific enum
   * value name, and any real seeded PaymentType value satisfies the
   * client-side "Payment Enum Type is Required." check equally.
   */
  async selectFirstPaymentType(): Promise<void> {
    await this.paymentEnumTypeCombo.open();
    await this.page.getByRole('option').first().click({ timeout: 10000 });
  }

  async createCustomerAdvance(customerId: string, advanceAmount: number): Promise<void> {
    await this.gotoCreate(customerId);
    await this.fillAdvanceAmount(advanceAmount);
    await this.selectFirstPaymentType();
    await this.clickSave();
    await this.toastr.expectSuccess();
  }

  /** Grid's Edit action is an icon-only link with no accessible name — clicks the `.edit` class directly instead of KendoGrid.clickRowAction(). */
  async openEditFor(customerId: string, customerName: string): Promise<void> {
    await this.goto(customerId, customerName);
    const row = await this.grid.findRowByText(customerName);
    await row.locator('a.edit').click();
    await this.page.waitForURL(/\/DMS\/CustomerAdvance\/Edit/i);
  }

  async updateDocumentNo(documentNo: string): Promise<void> {
    await this.page.locator('#DocumentNo').fill(documentNo);
    await this.clickUpdate();
    await this.toastr.expectSuccess();
  }

  async expectAdvanceAmountInvalidValidation(): Promise<void> {
    await expect(this.page.locator(customerAdvanceFormSelectors.advanceAmountValidationMessage)).toHaveText(
      customerAdvanceValidationMessages.advanceAmountInvalid
    );
  }
}
