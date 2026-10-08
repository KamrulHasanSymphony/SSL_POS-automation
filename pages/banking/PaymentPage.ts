import { Locator, Page } from '@playwright/test';
import { BasePage } from '../common/BasePage';
import { KendoGrid } from '../../components/common-grid/KendoGrid';
import { KendoInvoicePickerGrid } from '../../components/common-grid/KendoInvoicePickerGrid';
import { KendoMultiColumnComboBox } from '../../components/kendo/KendoMultiColumnComboBox';
import { KendoDatePicker } from '../../components/kendo/KendoDatePicker';
import { routes, paymentFormSelectors, gridContainerSelectors } from '../../utils/constants';

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Areas/DMS/Controllers/PaymentController.cs + Views/Payment/Create.cshtml,
 * confirmed at STEP 7. Mirrors Collection: header + multi-line Kendo grid
 * applying an amount against one or more existing Purchase invoices.
 * Confirmed NO working Post/Draft workflow. Delete is confirmed NOT
 * SUPPORTED: action exists, zero UI trigger — no delete method here.
 */
export class PaymentPage extends BasePage {
  readonly grid: KendoGrid;
  readonly invoices: KendoInvoicePickerGrid;
  private readonly supplierCombo: KendoMultiColumnComboBox;
  private readonly transactionDate: KendoDatePicker;

  constructor(page: Page) {
    super(page);
    this.grid = new KendoGrid(page, gridContainerSelectors.default);
    this.invoices = new KendoInvoicePickerGrid(page, paymentFormSelectors.detailsGrid, 'PaymentAmount');
    this.supplierCombo = new KendoMultiColumnComboBox(page, paymentFormSelectors.supplierId);
    this.transactionDate = new KendoDatePicker(page, 'TransactionDate');
  }

  async goto(): Promise<void> {
    await this.page.goto(routes.dms('Payment', 'Index'));
    await this.grid.waitForLoad();
  }

  async gotoCreate(): Promise<void> {
    await this.page.goto(routes.dms('Payment', 'Create'));
  }

  async selectSupplier(uniqueSupplierName: string): Promise<void> {
    await this.supplierCombo.typeAndSelectFirst(uniqueSupplierName);
  }

  async fillTransactionDate(isoDate: string = today()): Promise<void> {
    await this.transactionDate.setDate(isoDate);
  }

  /** Creates a Payment applying (by default, the full confirmed Due Amount) against an existing Purchase's Code. */
  async createPayment(supplierName: string, purchaseCode: string, amount?: number): Promise<string> {
    await this.gotoCreate();
    await this.selectSupplier(supplierName);
    await this.fillTransactionDate();
    await this.invoices.addInvoiceLine(purchaseCode, amount);
    await this.clickSave();
    await this.toastr.expectSuccess();
    return this.getCode();
  }

  async openEditFor(code: string): Promise<void> {
    await this.goto();
    await this.grid.search(code);
    await this.grid.clickRowAction(code, /edit/i);
    await this.page.waitForURL(/\/DMS\/Payment\/Edit/i);
  }

  /** PaymentVM.Comments — StringLength(50), not tied to the picked invoice, safe to mutate for a persistence check. */
  async updateComments(comments: string): Promise<void> {
    await this.page.locator('#Comments').fill(comments);
    await this.clickUpdate();
    await this.toastr.expectSuccess();
  }

  async getComments(): Promise<string> {
    return (await this.page.locator('#Comments').inputValue()) ?? '';
  }

  async expectSupplierRequiredIndicated(): Promise<void> {
    await this.expectRequiredIndicatorVisible(paymentFormSelectors.supplierDropdownError);
  }

  /** Confirmed exact client-side notification for a row amount greater than that row's Due Amount. */
  async expectAmountExceedsDueRejected(row: Locator): Promise<void> {
    const due = await this.invoices.getDueAmount(row);
    await this.invoices.setAmount(row, due + 1_000_000);
    await this.toastr.expectError('Payment cannot exceed Due Amount');
  }
}
