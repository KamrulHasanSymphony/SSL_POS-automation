import { test, expect } from '../../../fixtures/financial-lifecycle.fixture';
import { assertAdminCredentialsReady } from '../../../utils/env';
import { routes } from '../../../utils/constants';

/**
 * Cross-module E2E financial/accounting lifecycle (payable side): Login ->
 * Supplier -> Product -> Purchase (Due created) -> Payment (Due reduced) ->
 * Due verification -> Supplier Ledger -> Logout.
 *
 * WHY THIS SPEC EXISTS, AND WHAT IT DOES NOT DUPLICATE: this project already
 * has two other cross-module lifecycle specs covering the two real financial
 * transaction flows this application implements —
 * tests/ui/e2e/sales-lifecycle.spec.ts (receivable side: Customer -> Sale ->
 * Collection -> Due -> Customer Collection Due Report) and
 * tests/ui/e2e/purchase-lifecycle.spec.ts (Supplier -> Purchase Order ->
 * Purchase -> Stock -> Supplier Ledger). Neither of those two exercises a
 * real Payment transaction: sales-lifecycle.spec.ts's Payment-equivalent is
 * Collection (receivable side only), and purchase-lifecycle.spec.ts's own
 * header comment explicitly states "no Payment was made in this flow, so
 * the full Purchase Amount remains Outstanding" — i.e. it only proves the
 * Ledger reflects an unpaid Purchase, never a paid one. This spec is the one
 * genuinely new, non-duplicative addition: it proves Payment (payable-side
 * "Payment Receive" analog) actually reduces a real Purchase's Due amount
 * and that the reduction is correctly reflected in the Supplier Ledger
 * report (Total Payment Amount / Outstanding Amount) — the one proven gap
 * identified during the Financial/Accounting Lifecycle investigation (see
 * that investigation's report for full evidence). Every Page Object,
 * fixture, and prerequisite chain used below already exists and is already
 * proven elsewhere in this project (purchaseWithDuePrerequisite in
 * banking.fixture.ts; PaymentPage/SupplierLedgerPage; the
 * due-before/due-after double-fetch pattern already established by
 * sales-lifecycle.spec.ts's own Collection step) — nothing here is new
 * Page Object code, only a new composition of existing, proven pieces.
 *
 * EVIDENCE THIS FLOW IS REAL (not invented): "Payment Entry" is a real,
 * fully-implemented module (Areas/DMS/Controllers/PaymentController.cs +
 * Views/Payment/Create.cshtml — see PaymentPage.ts's own doc comment) that
 * applies an amount against an existing Purchase's Due, symmetric to
 * Collection against a Sale's Due. "Supplier Ledger" is not a real, distinct
 * module (see SupplierLedgerPage.ts's doc comment for the full source
 * citation) — its nearest real, functional analog, the Supplier Purchase &
 * Payment report, is reused here unchanged, not reinvented.
 *
 * TEST DATA STRATEGY: identical to sales-lifecycle.spec.ts/
 * purchase-lifecycle.spec.ts — every master-data entity is created fresh
 * every run via purchaseWithDuePrerequisite() (itself built from
 * purchasePartyPrerequisites()'s uniqueCode()-based Supplier/Product
 * creation), the same "always create, never conditionally reuse" pattern
 * every existing prerequisite fixture in this project already uses.
 *
 * LOGIN STEP FIX (financial-lifecycle investigation RCA, live-run confirmed
 * and now applied identically to sales-lifecycle.spec.ts and
 * purchase-lifecycle.spec.ts): changeBranch() alone re-enters the app's
 * branch-(re)assignment flow without waiting for it to complete —
 * BranchSelectPage.ts's own STEP 34 finding documents that the `.ASPXAUTH`
 * cookie is granted only by the subsequent `POST /Common/Home/AssignBranch`
 * response, not by the login POST itself. Without resolveIfPresent() here, a
 * later DMS-area navigation can race that reassignment and get redirected to
 * Login (confirmed via network trace: a DMS create-page GET -> 302 ->
 * `/Login/Index?ReturnUrl=...`). This spec calls resolveIfPresent()
 * immediately after changeBranch(), exactly like performLogin() already does
 * after a fresh login.
 */
test.describe('E2E Financial Lifecycle (Payable Side)', () => {
  test('Login, Supplier, Product, Purchase (Due), Payment, Due reduction, and Supplier Ledger reconcile end-to-end', async ({
    dashboardPage,
    loginPage,
    branchSelectPage,
    purchaseWithDuePrerequisite,
    paymentPage,
    supplierLedgerPage,
    page,
  }) => {
    // CONFIRMED (live run, same finding tests/ui/e2e/purchase-lifecycle.spec.ts's
    // own header comment already documents): this flow's sequential steps —
    // a saved Purchase, a saved Payment, and a new-tab Print/report
    // round-trip for the Supplier Ledger — exceed playwright.config.ts's
    // global 60s default `timeout` end-to-end on this environment.
    test.setTimeout(120_000);
    assertAdminCredentialsReady();

    // 1. Login — see class doc comment "LOGIN STEP FIX" above.
    await dashboardPage.changeBranch();
    await branchSelectPage.resolveIfPresent();
    await dashboardPage.expectLoaded();

    // 2-4. Supplier, Product, Purchase (with the full GrandTotal left Due) —
    // reuses banking.fixture.ts's own full prerequisite chain rather than
    // re-implementing Supplier/Product/Purchase creation here. supplierId
    // (needed for the Supplier Ledger step below, which — per
    // SupplierLedgerPage.ts's doc comment, confirmed live in
    // purchase-lifecycle.spec.ts — cannot reliably find a just-created
    // Supplier through its own picker popup, so the report is driven
    // directly via #SupplierId/#SupplierName instead) is captured by the
    // fixture itself at the one point it's reliably available — see
    // purchaseWithDuePrerequisite's own doc comment in banking.fixture.ts.
    const { supplierName, supplierId, purchaseCode } = await purchaseWithDuePrerequisite();
    expect(purchaseCode).not.toHaveLength(0);

    // 5. Read Supplier Due before Payment — same invoice-picker mechanism
    // Payment itself uses, read directly without saving (mirrors
    // sales-lifecycle.spec.ts's identical Collection-side pattern).
    await paymentPage.gotoCreate();
    await paymentPage.selectSupplier(supplierName);
    await paymentPage.fillTransactionDate();
    const dueRowBefore = await paymentPage.invoices.addRow();
    await paymentPage.invoices.selectInvoiceForRow(dueRowBefore, purchaseCode);
    const dueBefore = await paymentPage.invoices.getDueAmount(dueRowBefore);
    expect(dueBefore).toBeGreaterThan(0);

    // 6. Create Payment — pays off the full pre-payment Due, for the
    // cleanest possible post-payment assertion target (same reasoning
    // sales-lifecycle.spec.ts's own Collection step already documents).
    const paymentAmount = dueBefore;
    await paymentPage.invoices.setAmount(dueRowBefore, paymentAmount);
    await paymentPage.clickSave();
    await paymentPage.toastr.expectSuccess();
    const paymentCode = await paymentPage.getCode();
    expect(paymentCode).not.toHaveLength(0);

    // 7. Read Supplier Due after Payment — a fresh, unsaved
    // Payment/Create screen, same supplier + Purchase Code.
    await paymentPage.gotoCreate();
    await paymentPage.selectSupplier(supplierName);
    await paymentPage.fillTransactionDate();
    const dueRowAfter = await paymentPage.invoices.addRow();
    await paymentPage.invoices.selectInvoiceForRow(dueRowAfter, purchaseCode);
    const dueAfter = await paymentPage.invoices.getDueAmount(dueRowAfter);

    // 8. Verify: dueAfter == dueBefore - paymentAmount (== 0, given the
    // full Due was paid above).
    expect(dueAfter).toBeCloseTo(dueBefore - paymentAmount, 2);
    expect(dueAfter).toBeCloseTo(0, 2);

    // 9-11. Open Supplier Ledger (real analog: Supplier Purchase & Payment
    // report — see class doc comment). Uses selectSupplierDirectly(), not
    // the picker popup — same confirmed-necessary deviation
    // purchase-lifecycle.spec.ts already documents and relies on.
    await supplierLedgerPage.goto();
    await supplierLedgerPage.selectSupplierDirectly(supplierId, supplierName);
    await supplierLedgerPage.enableSummaryMode();
    const ledgerTab = await supplierLedgerPage.printAndCapture();
    const ledgerRow = await supplierLedgerPage.getSupplierRow(ledgerTab, supplierName);
    const ledgerValues = await supplierLedgerPage.getLedgerValues(ledgerRow);

    // 12. Verify report fields against values captured during the flow —
    // the new assertions this spec exists to prove: Payment Entry Exists
    // (non-zero Total Payment Amount) and it reconciles exactly with the
    // real Payment amount and the resulting Due, closing the one gap
    // purchase-lifecycle.spec.ts's own header comment flags (no Payment
    // exercised there).
    await expect(ledgerRow).toContainText(supplierName);
    expect(ledgerValues.totalPurchaseAmount).toBeCloseTo(dueBefore, 2);
    expect(ledgerValues.totalPaymentAmount).toBeCloseTo(paymentAmount, 2);
    expect(ledgerValues.outstandingAmount).toBeCloseTo(dueAfter, 2);
    expect(ledgerValues.outstandingAmount).toBeCloseTo(0, 2);

    // 13. Logout — same reusable assertions as LOGOUT-001
    // (tests/ui/auth/logout.spec.ts) and sales-lifecycle.spec.ts's own final
    // step, not duplicated/reinvented here.
    await dashboardPage.logout();
    await expect(page).toHaveURL(new RegExp(routes.login.replace('/', '\\/')));
    await loginPage.expectStillOnLoginPage();
  });
});
