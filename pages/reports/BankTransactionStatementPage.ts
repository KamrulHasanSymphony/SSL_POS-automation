import { Locator, Page } from '@playwright/test';
import { BasePage } from '../common/BasePage';
import { routes } from '../../utils/constants';

/**
 * "Bank Transaction Report" (`Areas/DMS/Controllers/BankAccountController.cs`'s
 * `BankTransactionReportIndex()`/`BankTransactionReportList()` actions +
 * `Views/BankAccount/BankTransactionReportIndex.cshtml` +
 * `Views/BankAccount/Reports/BankTransactionStatement.cshtml`), "Statement"
 * mode specifically — added for the ACCOUNTING-LEDGER-LIFECYCLE E2E flow.
 *
 * Confirmed from source (ACCOUNTING-LEDGER-LIFECYCLE investigation, Phase 1)
 * to be the ONE genuinely accounting-adjacent, testable computation in this
 * application: `ReportsRepository.cs`'s `BankTransactionReportList()`
 * "Statement" branch computes a real running balance — an opening balance
 * (a scalar `SUM(CASE WHEN InOut='In' THEN Amount ELSE -Amount END)` over a
 * `UNION ALL` of `SaleCreditCards`/`Collections`/`Payments`/`Deposits`/
 * `Withdrawals` rows before the report's FromDate) followed by an
 * in-order-walked `RunningBalance` per transaction row — genuinely
 * different from every other report in this project (which only ever sum
 * GrandTotal-vs-Payment/Collection totals, with no opening/running-balance
 * concept at all). Confirmed NOT a persisted ledger table — recomputed on
 * every report call — but a real, non-trivial, testable arithmetic
 * computation, unlike the confirmed-absent Chart of Accounts/Journal
 * Entry/General Ledger/Trial Balance (see this spec's own class doc
 * comment).
 *
 * `#TransactionType` is a plain, un-enhanced native `<select>` — "Statement"
 * is one of its literal option values, confirmed from source
 * (`BankTransactionReportIndex.cshtml`). The Bank Account picker
 * (`#btnAccountSearch` -> `#bankAccountWindow`/`#bankAccountGrid`, dblclick
 * a row) is the same "click -> popup -> dblclick row" shape as every other
 * popup picker in this project (`ApplyBankAccountSelection(item)` sets the
 * real `#BankAccountId`/`#AccountName` fields consumed by
 * `PrintBankTransactionReport()`). No client-side "must select X before
 * printing" gate exists on this screen (confirmed from source — unlike
 * `PurchaseReportPage`'s own confirmed validation), so selecting only a
 * Bank Account (leaving TransactionType at its default) is sufficient.
 */
export class BankTransactionStatementPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async goto(): Promise<void> {
    await this.page.goto(routes.dms('BankAccount', 'BankTransactionReportIndex'));
  }

  /** Opens the Bank Account picker popup, double-clicks the row matching the given (unique) account name. */
  async selectBankAccount(accountName: string): Promise<void> {
    await this.page.locator('#btnAccountSearch').click();
    const popup = this.page.locator('#bankAccountWindow');
    await popup.waitFor({ state: 'visible', timeout: 10000 });

    const grid = this.page.locator('#bankAccountGrid');
    const row = grid.locator('.k-grid-content table tbody tr, table tbody tr', { hasText: accountName }).first();
    await row.waitFor({ state: 'visible', timeout: 10000 });
    await row.dblclick();
    await popup.waitFor({ state: 'hidden', timeout: 10000 }).catch(() => undefined);
    await this.overlay.waitForIdle();
  }

  /** Selects "Statement" mode — the running-balance report this flow validates, as opposed to the other Source filter values (Deposit/Withdrawal/Payment/Collection/OutstandingBalance/All). */
  async selectStatementMode(): Promise<void> {
    await this.page.locator('#TransactionType').selectOption({ value: 'Statement' });
  }

  /** Clicks Print and captures the new tab it opens, mirroring every other report page object's own printAndCapture(). */
  async printAndCapture(): Promise<Page> {
    const [reportTab] = await Promise.all([
      this.page.context().waitForEvent('page'),
      this.page.getByRole('button', { name: 'Print' }).click(),
    ]);
    await reportTab.waitForLoadState();
    return reportTab;
  }

  /**
   * Locates this Bank Account's own closing-balance row (the last data row
   * of its group) in the captured Statement report tab — confirmed from
   * source (`BankTransactionStatement.cshtml`): grouped per Bank Account,
   * an "Opening Balance" row, one row per transaction, then "Totals:",
   * "Total Withdrawal (Out):", "Total Deposit (In):", and finally
   * "Closing Balance:" rows, in that exact order.
   */
  async getClosingBalanceRow(reportTab: Page): Promise<Locator> {
    const row = reportTab.locator('tr', { hasText: 'Closing Balance' }).last();
    await row.waitFor({ state: 'visible', timeout: 10000 });
    return row;
  }

  /** Locates a data row (an actual transaction, not a header/subtotal row) matching the given (unique) transaction code, in the captured Statement report tab. */
  async getTransactionRow(reportTab: Page, transactionCode: string): Promise<Locator> {
    const row = reportTab.locator('tr', { hasText: transactionCode }).first();
    await row.waitFor({ state: 'visible', timeout: 10000 });
    return row;
  }

  /**
   * Reads Withdrawal / Deposit / Balance (running balance) off a data row
   * by column position — confirmed from source
   * (`BankTransactionStatement.cshtml`): Transaction Date, Transaction
   * Code, Source, Withdrawal, Deposit, Balance, in that exact order, plain
   * `<td>` cells with no `data-field` attribute.
   */
  async getTransactionRowValues(row: Locator): Promise<{ withdrawal: number; deposit: number; balance: number }> {
    const cells = row.locator('td');
    const parse = async (index: number): Promise<number> => {
      const text = (await cells.nth(index).textContent().catch(() => '')) ?? '0';
      const parsed = parseFloat(text.replace(/[^0-9.-]/g, ''));
      return Number.isFinite(parsed) ? parsed : 0;
    };
    return {
      withdrawal: await parse(3),
      deposit: await parse(4),
      balance: await parse(5),
    };
  }

  /** Reads the numeric Closing Balance off the "Closing Balance:" row — that row's own last `<td>`, confirmed from source (a `colspan="5"` label cell followed by one value cell). */
  async getClosingBalance(row: Locator): Promise<number> {
    const text = (await row.locator('td').last().textContent().catch(() => '')) ?? '0';
    const parsed = parseFloat(text.replace(/[^0-9.-]/g, ''));
    return Number.isFinite(parsed) ? parsed : 0;
  }
}
