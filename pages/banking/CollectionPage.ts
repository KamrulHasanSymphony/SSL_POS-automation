import { Locator, Page } from '@playwright/test';
import { BasePage } from '../common/BasePage';
import { KendoGrid } from '../../components/common-grid/KendoGrid';
import { KendoInvoicePickerGrid } from '../../components/common-grid/KendoInvoicePickerGrid';
import { KendoMultiColumnComboBox } from '../../components/kendo/KendoMultiColumnComboBox';
import { KendoDatePicker } from '../../components/kendo/KendoDatePicker';
import { routes, collectionFormSelectors, gridContainerSelectors } from '../../utils/constants';

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Areas/DMS/Controllers/CollectionController.cs +
 * Views/Collection/Create.cshtml, confirmed at STEP 7. Header + multi-line
 * Kendo grid applying an amount against one or more existing Sale
 * invoices. Confirmed NO working Post/Draft workflow (dead code — not
 * exercised here). Delete is confirmed NOT SUPPORTED: action exists, zero
 * UI trigger (no `.btnDelete` at all, not even commented) — no delete
 * method here.
 */
export class CollectionPage extends BasePage {
  readonly grid: KendoGrid;
  readonly invoices: KendoInvoicePickerGrid;
  private readonly customerCombo: KendoMultiColumnComboBox;
  private readonly transactionDate: KendoDatePicker;
  private readonly chequeDate: KendoDatePicker;

  constructor(page: Page) {
    super(page);
    this.grid = new KendoGrid(page, gridContainerSelectors.default);
    this.invoices = new KendoInvoicePickerGrid(page, collectionFormSelectors.detailsGrid, 'CollectionAmount');
    this.customerCombo = new KendoMultiColumnComboBox(page, collectionFormSelectors.customerId);
    this.transactionDate = new KendoDatePicker(page, 'TransactionDate');
    this.chequeDate = new KendoDatePicker(page, 'ChequeDate');
  }

  async goto(): Promise<void> {
    await this.page.goto(routes.dms('Collection', 'Index'));
    await this.grid.waitForLoad();
  }

  async gotoCreate(): Promise<void> {
    await this.page.goto(routes.dms('Collection', 'Create'));
  }

  /**
   * SALE-RETURN-LIFECYCLE E2E FINDING: confirmed live (repeated runs) that
   * CollectionPage's CustomerId combo shares BankId's own confirmed
   * "renders its full, ever-growing table unfiltered" defect (see
   * KendoComboBox.typeAndSelectFirst()'s own doc comment) — a freshly-typed,
   * unique Customer name still resolves 200+ rows deep into this shared
   * environment's Customer table, which keeps growing with every automated
   * run. Same mitigation already applied at BankAccountSetupPage.setupBankAccount()'s
   * own call site: an explicit, longer timeout, rather than the unset
   * default.
   *
   * ACCOUNTING-LEDGER-LIFECYCLE E2E FINDING: confirmed live, same day, that
   * this table has since grown past what 30000ms comfortably covers too
   * (same moving-target growth already documented for BankId — see
   * BankAccountSetupPage.ts's own identical finding) — bumped for the same
   * reason.
   */
  async selectCustomer(uniqueCustomerName: string): Promise<void> {
    await this.customerCombo.typeAndSelectFirst(uniqueCustomerName, 60000);
  }

  async fillTransactionDate(isoDate: string = today()): Promise<void> {
    await this.transactionDate.setDate(isoDate);
  }

  /**
   * COLLECTION-SAVE-INVESTIGATION E2E FINDING: confirmed live (client-side
   * validation-error DOM capture right after a blocked Save click) that
   * `CollectionVM.ChequeDate` carries an UNCONDITIONAL
   * `[Required(ErrorMessage = "Cheque Date is required.")]` — confirmed
   * from source, ShampanPOS.Models/CollectionVM.cs — regardless of the
   * form's Cash/Bank switch state (unlike `BankAccountId`, whose own
   * `[Required]` is commented out). `.btnsave`'s own click handler
   * (CollectionController.js) runs `form.valid()` before ever calling
   * `save()`/firing the `/DMS/Collection/CreateEdit` POST — with
   * `#ChequeDate` left empty, that check fails and the click handler
   * `return false`s silently, which is exactly what was surfacing as a
   * `page.waitForResponse()` timeout (no POST is ever sent). Mirrors the
   * same "unconditionally-required, easy-to-default, no caller opts out"
   * precedent already used for `ProductPage.fillBarcode()` — filled here,
   * inside `clickSave()`'s override below, rather than pushed onto every
   * caller.
   */
  private async fillChequeDate(isoDate: string = today()): Promise<void> {
    await this.chequeDate.setDate(isoDate);
  }

  /**
   * Overrides BasePage.clickSave() to fill the unconditionally-required
   * ChequeDate field first — see fillChequeDate()'s own doc comment. Every
   * existing caller of clickSave() on this page gets the same fix
   * automatically; no caller-facing change.
   */
  async clickSave(): Promise<void> {
    await this.fillChequeDate();
    await super.clickSave();
  }

  /** Creates a Collection applying (by default, the full confirmed Due Amount) against an existing Sale's Code. */
  async createCollection(customerName: string, saleCode: string, amount?: number): Promise<string> {
    await this.gotoCreate();
    await this.selectCustomer(customerName);
    await this.fillTransactionDate();
    await this.invoices.addInvoiceLine(saleCode, amount);
    await this.clickSave();
    await this.toastr.expectSuccess();
    return this.getCode();
  }

  async openEditFor(code: string): Promise<void> {
    await this.goto();
    await this.grid.search(code);
    await this.grid.clickRowAction(code, /edit/i);
    await this.page.waitForURL(/\/DMS\/Collection\/Edit/i);
  }

  /** CollectionVM.Comments — StringLength(250), not tied to the picked invoice, safe to mutate for a persistence check. */
  async updateComments(comments: string): Promise<void> {
    await this.page.locator('#Comments').fill(comments);
    await this.clickUpdate();
    await this.toastr.expectSuccess();
  }

  async getComments(): Promise<string> {
    return (await this.page.locator('#Comments').inputValue()) ?? '';
  }

  async expectCustomerRequiredIndicated(): Promise<void> {
    await this.expectRequiredIndicatorVisible(collectionFormSelectors.customerDropdownError);
  }

  /** Confirmed exact client-side notification for a row amount greater than that row's Due Amount. */
  async expectAmountExceedsDueRejected(row: Locator): Promise<void> {
    const due = await this.invoices.getDueAmount(row);
    await this.invoices.setAmount(row, due + 1_000_000);
    await this.toastr.expectError('Collection cannot exceed Due Amount');
  }
}
