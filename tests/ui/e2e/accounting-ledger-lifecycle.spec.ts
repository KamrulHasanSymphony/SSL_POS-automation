import { test, expect } from '../../../fixtures/accounting-ledger-lifecycle.fixture';
import { assertAdminCredentialsReady } from '../../../utils/env';
import { uniqueCode, randomData } from '../../../utils/random-data';
import { routes } from '../../../utils/constants';

/**
 * Cross-module E2E Accounting/Ledger lifecycle: Supplier -> Customer ->
 * Product -> Purchase -> Purchase Post -> Supplier Ledger ("accounting
 * impact") -> Sale -> Sale Post -> Customer Sale & Collection Report
 * ("accounting impact") -> Collection -> Customer outstanding decrease ->
 * Bank Transaction Statement ("Cash/Bank impact") -> Logout. Not part of
 * the approved coverage baseline (config/coverage-baseline.ts).
 *
 * PHASE 1 INVESTIGATION FINDINGS this spec is built on (confirmed
 * exhaustively from source, not discovered by trial-and-error — see the
 * full investigation report returned separately):
 *
 * - **NO true double-entry accounting system exists anywhere in this
 *   application.** Confirmed absent by exhaustive source search: Chart of
 *   Accounts, Journal Entry, General Ledger, Trial Balance, Balance Sheet,
 *   Profit & Loss — zero matches across both projects and every `.sql`
 *   script. The one candidate with the right NAME — `CustomerJournal` — is
 *   dead code: its Repository/Controller `.cs` files don't exist on disk
 *   (only dangling `<Compile Remove>` entries in the `.csproj` files), its
 *   Service file is itself excluded from compilation, and its surviving
 *   front-end JS is a literal copy-paste of the unrelated
 *   `CustomerController.js`. It never ran and never worked — same
 *   "excluded-from-build, confirmed dead" shape as the Day End
 *   investigation's own `DayEndService.cs` finding.
 * - **Posting a Purchase, Sale, or Collection writes NO accounting entry
 *   anywhere.** Read `PurchaseRepository.cs`'s/`SaleRepository.cs`'s own
 *   `MultiplePost` methods and `CollectionRepository.cs`'s `Insert`/
 *   `InsertDetails` in full: every write statement targets only that
 *   module's own header/detail table. Posting is literally
 *   `UPDATE <Table> SET IsPost = 1, PostedBy = ..., PostedOn = GETDATE()` —
 *   a status-flag flip. No `AccountId`/`Debit`/`Credit` column is ever
 *   written by any of these three modules — there is no "accounting hook"
 *   to trace from transaction to ledger, because no ledger exists for it
 *   to write to.
 * - **"Supplier Ledger"/"Customer Ledger" (this project's own UI/menu
 *   naming) are transaction-list reports, not real ledgers** — already
 *   established and reused unchanged from `financial-lifecycle.spec.ts`:
 *   `SupplierPurchasePaymentReportList`/`CustomerSaleCollectionReportList`
 *   simply sum GrandTotal vs Payment/Collection amounts per party, with no
 *   Debit/Credit/AccountId concept. Used here as this flow's own
 *   "accounting impact"/"customer ledger impact" validation anyway, since
 *   they are the real, closest, already-proven functional analogs — not a
 *   fabricated substitute.
 * - **The ONE genuinely accounting-adjacent, testable computation found**
 *   is the Bank Transaction Statement (`ReportsRepository.cs`'s
 *   `BankTransactionReportList()`, "Statement" mode — see
 *   `BankTransactionStatementPage.ts`'s own doc comment for the full
 *   citation): a real opening-balance-as-of-date SUM plus an in-order-
 *   walked running balance across `SaleCreditCards`/`Collections`/
 *   `Payments`/`Deposits`/`Withdrawals` — genuinely more "accounting-shaped"
 *   than the Supplier/Customer reports (which have no running-balance
 *   concept at all), though still a recomputed-on-read aggregate, not a
 *   persisted ledger table. This flow validates it against Sale's own
 *   at-sale bank payment (the one mechanism already available in this
 *   automation project that deterministically routes money into a specific,
 *   freshly-created BankAccount) rather than extending `CollectionPage.ts`
 *   to support bank-account selection (`BankAccountId` is confirmed NOT
 *   `[Required]` on Collection, and no such selection method exists there
 *   yet) — a deliberate scope decision, not an oversight, to avoid
 *   destabilizing an unrelated, already-proven page object for a single
 *   flow's own reporting convenience.
 * - **"Total Debit == Total Credit" (the task's own requested Trial Balance
 *   check) is confirmed NOT APPLICABLE** — there is no double-entry
 *   Debit/Credit concept anywhere in this application to check. Not
 *   faked, not silently skipped — documented explicitly here and in this
 *   flow's own final report as an Application Gap.
 */
test.describe('E2E Accounting/Ledger Lifecycle', () => {
  test('Supplier, Customer, Product, Purchase, Sale, Collection, and available financial reports reconcile end-to-end', async ({
    dashboardPage,
    branchSelectPage,
    supplierPrerequisites,
    supplierPage,
    customerPrerequisites,
    customerPage,
    productPrerequisites,
    productPage,
    bankAccountSetupPage,
    purchasePage,
    salePage,
    collectionPage,
    supplierLedgerPage,
    customerSaleCollectionReportPage,
    bankTransactionStatementPage,
    page,
  }) => {
    // Same empirical reasoning as every other lifecycle spec's own
    // test.setTimeout: 3 saved transaction modules each requiring their own
    // Post/Save, plus 3 report round-trips, exceeds the global 60s default.
    test.setTimeout(210_000);
    assertAdminCredentialsReady();

    // 1. Login — see every other lifecycle spec's own identical step-1
    // comment for the full source+network-trace-backed root cause.
    await dashboardPage.changeBranch();
    await branchSelectPage.resolveIfPresent();
    await dashboardPage.expectLoaded();

    // 2. Supplier.
    const { supplierGroupName } = await supplierPrerequisites();
    const supplierName = uniqueCode('SUPPLIER');
    await supplierPage.createSupplier({
      name: supplierName,
      supplierGroupName,
      address: `Automation Address ${uniqueCode('ADDR')}`,
    });
    await supplierPage.openEditFor(supplierName);
    const supplierIdMatch = /\/Edit\/(\d+)/i.exec(page.url());
    expect(supplierIdMatch).not.toBeNull();
    const supplierId = supplierIdMatch![1];

    // 3. Customer.
    const { customerGroupName } = await customerPrerequisites();
    const customerName = uniqueCode('CUSTOMER');
    await customerPage.createCustomer({
      name: customerName,
      customerGroupName,
      telephoneNo: randomData.phone11Digit(),
      email: randomData.email('customer'),
      address: `Automation Address ${uniqueCode('ADDR')}`,
    });
    const customerIdMatch = /\/Edit\/(\d+)/i.exec(page.url());
    expect(customerIdMatch).not.toBeNull();
    const customerId = customerIdMatch![1];

    // 4. Product — no VAT/SD configured (out of this flow's own scope,
    // already covered by vat-lifecycle.spec.ts), so Amount reconciles with
    // Quantity x Rate exactly.
    const { productGroupName, uomName } = await productPrerequisites();
    const productName = uniqueCode('PRODUCT');
    const purchasePrice = 100;
    const salePrice = 150;
    await productPage.createProduct({ name: productName, productGroupName, uomName, purchasePrice, salePrice });

    // Bank Account — Sale's mandatory payment prerequisite AND this flow's
    // own "Cash/Bank impact" validation target (see class doc comment).
    const { accountName: bankAccountName } = await bankAccountSetupPage.setupBankAccount();

    // ============================================================
    // PURCHASE — quantity 100, rate 100. Expected Purchase Amount 10000.
    // ============================================================
    const purchaseQuantity = 100;
    const purchaseCode = await purchasePage.createPurchase({
      supplierName,
      beNumber: String(Date.now()),
      productName,
      quantity: purchaseQuantity,
    });
    expect(purchaseCode).not.toHaveLength(0);
    const purchaseRow = purchasePage.lineItems.rows().first();
    const purchaseLineTotalCell = await purchasePage.lineItems.lineTotalCell(purchaseRow);
    const purchaseAmount = parseFloat(((await purchaseLineTotalCell.textContent()) ?? '0').replace(/[^0-9.-]/g, ''));
    expect(purchaseAmount).toBeCloseTo(purchaseQuantity * purchasePrice, 2);
    expect(purchaseAmount).toBeCloseTo(10_000, 2);

    // Purchase Post.
    await purchasePage.post();

    // Validate accounting impact — Supplier Ledger (this project's real,
    // closest functional analog; see class doc comment). No Purchase
    // Payment is made in this flow, so the full Purchase Amount is
    // Outstanding (Supplier payable).
    await supplierLedgerPage.goto();
    await supplierLedgerPage.selectSupplierDirectly(supplierId, supplierName);
    await supplierLedgerPage.enableSummaryMode();
    const supplierLedgerTab = await supplierLedgerPage.printAndCapture();
    const supplierLedgerRow = await supplierLedgerPage.getSupplierRow(supplierLedgerTab, supplierName);
    const supplierLedgerValues = await supplierLedgerPage.getLedgerValues(supplierLedgerRow);
    expect(supplierLedgerValues.totalPurchaseAmount).toBeCloseTo(purchaseAmount, 2);
    expect(supplierLedgerValues.totalPurchaseAmount).toBeCloseTo(10_000, 2);
    expect(supplierLedgerValues.outstandingAmount).toBeCloseTo(
      supplierLedgerValues.totalPurchaseAmount - supplierLedgerValues.totalPaymentAmount,
      2
    );
    expect(supplierLedgerValues.outstandingAmount).toBeCloseTo(10_000, 2);

    // ============================================================
    // SALE — quantity 50, rate 150. Expected Sale Amount 7500. A nominal
    // `1`-unit at-sale payment (same confirmed-necessary reasoning as
    // sale-return-lifecycle.spec.ts's own class doc comment: Sale's
    // mandatory-payment gate requires a real, positive CardTotal) —
    // deliberately leaves a real Due for the Collection step below, and
    // is this flow's own "Cash/Bank impact" transaction (routed into the
    // BankAccount validated via Bank Transaction Statement further down).
    // ============================================================
    const saleQuantity = 50;
    await salePage.gotoCreate();
    await salePage.selectCustomer(customerName);
    await salePage.fillInvoiceDate();
    await salePage.lineItems.addLineItem(productName, saleQuantity);
    const finalPayable = await salePage.getFinalPayable();
    expect(finalPayable).toBeCloseTo(saleQuantity * salePrice, 2);
    expect(finalPayable).toBeCloseTo(7_500, 2);
    const atSalePayment = 1;
    await salePage.addPayment(bankAccountName, atSalePayment);
    await salePage.clickSave();
    const saleCode = await salePage.waitForSaveSuccess();
    expect(saleCode).not.toHaveLength(0);

    // Sale Post.
    await salePage.post();

    // Validate accounting impact — Customer Sale & Collection Report (this
    // project's real, closest functional analog).
    await customerSaleCollectionReportPage.goto();
    await customerSaleCollectionReportPage.selectCustomerDirectly(customerId, customerName);
    await customerSaleCollectionReportPage.enableSummaryMode();
    const saleReportTab = await customerSaleCollectionReportPage.printAndCapture();
    const saleReportRow = await customerSaleCollectionReportPage.getCustomerRow(saleReportTab, customerName);
    const saleReportValues = await customerSaleCollectionReportPage.getReportValues(saleReportRow);
    expect(saleReportValues.totalSaleAmount).toBeCloseTo(finalPayable, 2);
    expect(saleReportValues.totalSaleAmount).toBeCloseTo(7_500, 2);

    // ============================================================
    // COLLECTION — collects 5000 against the Sale's real Due
    // (finalPayable - atSalePayment = 7499).
    // ============================================================
    await collectionPage.gotoCreate();
    await collectionPage.selectCustomer(customerName);
    await collectionPage.fillTransactionDate();
    const dueRowBefore = await collectionPage.invoices.addRow();
    await collectionPage.invoices.selectInvoiceForRow(dueRowBefore, saleCode);
    const dueBefore = await collectionPage.invoices.getDueAmount(dueRowBefore);
    expect(dueBefore).toBeCloseTo(finalPayable - atSalePayment, 2);
    expect(dueBefore).toBeCloseTo(7_499, 2);

    const collectionAmount = 5_000;
    await collectionPage.invoices.setAmount(dueRowBefore, collectionAmount);
    await collectionPage.clickSave();
    await collectionPage.toastr.expectSuccess();
    const collectionCode = await collectionPage.getCode();
    expect(collectionCode).not.toHaveLength(0);

    // Validate: Customer outstanding DECREASE — a fresh, unsaved
    // Collection/Create screen, same customer + Sale Code, using the
    // invoice-picker's own TRUE due calculation.
    await collectionPage.gotoCreate();
    await collectionPage.selectCustomer(customerName);
    await collectionPage.fillTransactionDate();
    const dueRowAfter = await collectionPage.invoices.addRow();
    await collectionPage.invoices.selectInvoiceForRow(dueRowAfter, saleCode);
    const dueAfter = await collectionPage.invoices.getDueAmount(dueRowAfter);
    expect(dueAfter).toBeCloseTo(dueBefore - collectionAmount, 2);
    expect(dueAfter).toBeCloseTo(2_499, 2);
    expect(dueAfter).toBeLessThan(dueBefore);

    // Validate: Customer Sale & Collection Report reflects the Collection.
    // Per this project's own already-confirmed finding (sale-return-lifecycle.spec.ts's
    // class doc comment): Total Collection Amount here legitimately
    // includes BOTH the at-sale SaleCreditCards payment AND the real
    // Collection (atSalePayment + collectionAmount), not the Collection
    // alone.
    await customerSaleCollectionReportPage.goto();
    await customerSaleCollectionReportPage.selectCustomerDirectly(customerId, customerName);
    await customerSaleCollectionReportPage.enableSummaryMode();
    const saleReportAfterCollectionTab = await customerSaleCollectionReportPage.printAndCapture();
    const saleReportAfterCollectionRow = await customerSaleCollectionReportPage.getCustomerRow(
      saleReportAfterCollectionTab,
      customerName
    );
    const saleReportAfterCollectionValues = await customerSaleCollectionReportPage.getReportValues(saleReportAfterCollectionRow);
    expect(saleReportAfterCollectionValues.totalCollectionAmount).toBeCloseTo(atSalePayment + collectionAmount, 2);
    expect(saleReportAfterCollectionValues.totalCollectionAmount).toBeCloseTo(5_001, 2);

    // ============================================================
    // CASH/BANK IMPACT — Bank Transaction Statement (see class doc
    // comment: the one genuinely accounting-adjacent, running-balance
    // computation this application has). Validates the Sale's own at-sale
    // payment (1) as a real "In" transaction against the BankAccount it
    // was routed to, with a correct running/closing balance.
    // ============================================================
    await bankTransactionStatementPage.goto();
    await bankTransactionStatementPage.selectBankAccount(bankAccountName);
    await bankTransactionStatementPage.selectStatementMode();
    const statementTab = await bankTransactionStatementPage.printAndCapture();

    const saleTransactionRow = await bankTransactionStatementPage.getTransactionRow(statementTab, saleCode);
    const saleTransactionValues = await bankTransactionStatementPage.getTransactionRowValues(saleTransactionRow);
    expect(saleTransactionValues.deposit).toBeCloseTo(atSalePayment, 2);
    expect(saleTransactionValues.withdrawal).toBeCloseTo(0, 2);
    // This freshly-created BankAccount's only transaction is this one
    // at-sale payment, so its running balance after this row, and the
    // statement's own Closing Balance, both equal that same amount.
    expect(saleTransactionValues.balance).toBeCloseTo(atSalePayment, 2);

    const closingBalanceRow = await bankTransactionStatementPage.getClosingBalanceRow(statementTab);
    const closingBalance = await bankTransactionStatementPage.getClosingBalance(closingBalanceRow);
    expect(closingBalance).toBeCloseTo(atSalePayment, 2);

    // ============================================================
    // TRIAL BALANCE ("Total Debit == Total Credit") — CONFIRMED NOT
    // APPLICABLE (class doc comment): no double-entry Debit/Credit concept
    // exists anywhere in this application. Not faked, not silently
    // skipped — this flow's own final report documents it explicitly as
    // an Application Gap instead of asserting against behavior the
    // application does not implement.
    // ============================================================

    // Logout — same reusable assertions as LOGOUT-001
    // (tests/ui/auth/logout.spec.ts) and every other lifecycle spec's own
    // final step, not duplicated/reinvented here.
    await dashboardPage.logout();
    await expect(page).toHaveURL(new RegExp(routes.login.replace('/', '\\/')));
  });
});
