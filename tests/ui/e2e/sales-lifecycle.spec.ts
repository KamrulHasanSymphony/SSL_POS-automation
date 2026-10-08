import { test, expect } from '../../../fixtures/e2e.fixture';
import { assertAdminCredentialsReady } from '../../../utils/env';
import { uniqueCode, randomData } from '../../../utils/random-data';
import { routes } from '../../../utils/constants';

/**
 * Cross-module E2E sales lifecycle: Login -> Customer -> Product -> Sale
 * Order -> Sale (Invoice) -> Collection -> Due verification -> Customer
 * Collection Due Report -> Logout. See the E2E design record (STEP 1-5) for
 * the full architecture/coverage-mapping this spec implements. NOT part of
 * the approved 267-test coverage baseline (config/coverage-baseline.ts) —
 * a tag/classification decision for a later step, deliberately left out of
 * this test's title here.
 *
 * Runs under the "authenticated" Playwright project (this file matches
 * neither the framework-only nor unauthenticated testMatch patterns in
 * playwright.config.ts). Two deliberate implementation notes, flagged
 * rather than silently decided:
 *
 * 1. "Login" (scenario step 1) is represented by confirming the project's
 *    own pre-established per-worker session actually lands on the
 *    dashboard (`dashboardPage.changeBranch()` + `expectLoaded()` — STEP 8
 *    LIVE EXECUTION CORRECTION: `gotoModule('Common','Home')` navigates to
 *    `/Common/Home/Index` with no querystring, which the live
 *    HomeController.Index(bool branchChange) throws a 500 on — confirmed
 *    server stack trace, ArgumentException on the non-nullable
 *    `branchChange` parameter. `changeBranch()` hits the same action with
 *    the required `branchChange=true` param already supplied), NOT a fresh
 *    in-test credential submission via
 *    LoginPage. Every existing "authenticated"-project test in this
 *    codebase already relies on that same pre-authenticated session
 *    (fixtures/auth.fixture.ts's workerAuthState) without re-logging in —
 *    submitting the login form a second time while already holding a valid
 *    session cookie is untested behavior in this app (whether the Login
 *    page even renders normally for an already-authenticated request was
 *    never confirmed), so this spec does not attempt it. BranchSelectPage
 *    is therefore also not used here: workerAuthState's own login already
 *    resolved branch selection once, per-worker.
 *
 * 2. `bankAccountSetupPage` (BankAccountSetupPage) is used for Sale's
 *    mandatory payment step even though it was not named in this task's
 *    enumerated component list — it is already fully implemented and
 *    already exposed by this exact fixture chain (transactions.fixture.ts,
 *    which banking.fixture.ts/e2e.fixture.ts both extend), and Sale cannot
 *    be saved at all without at least one BankAccount for the session's
 *    company (confirmed, see SalePage.ts / BankAccountSetupPage.ts). Left
 *    out of this test would make the scenario technically impossible to
 *    implement, not just incomplete.
 */
test.describe('E2E Sales Lifecycle', () => {
  test('Login, Customer, Product, Sale Order, Sale, Collection, Due, and Report reconcile end-to-end', async ({
    dashboardPage,
    loginPage,
    branchSelectPage,
    customerPage,
    customerPrerequisites,
    productPage,
    productPrerequisites,
    bankAccountSetupPage,
    saleOrderPage,
    salePage,
    collectionPage,
    reportPage,
    page,
  }) => {
    // CUSTOMER-COLLECTION-DUE-REPORT-DUE-RECONCILIATION-INVESTIGATION E2E
    // FINDING: confirmed live (three consecutive runs, each failing with
    // only "Test timeout of 60000ms exceeded" and no specific locator
    // timeout) that this flow's real, legitimate duration — now including
    // SaleOrder creation, Sale Post, and the Report round-trip added across
    // this investigation chain — exceeds playwright.config.ts's global 60s
    // default. Every sibling lifecycle spec (purchase-lifecycle.spec.ts,
    // financial-lifecycle.spec.ts, customer-collection-lifecycle.spec.ts)
    // already overrides this to 120s for the identical reason; this spec
    // had simply never been brought in line with them.
    test.setTimeout(120_000);
    assertAdminCredentialsReady();

    // 1. Login — see class doc comment note 1: confirms the fixture's own
    // pre-authenticated per-worker session actually lands on the dashboard.
    //
    // RCA (financial-lifecycle investigation, live run): changeBranch() alone
    // re-enters the app's branch-(re)assignment flow (confirmed source,
    // HomeController.cs's Index(branchChange=true) path returns an
    // intentionally-empty branch list) without waiting for it to finish.
    // BranchSelectPage.ts's own STEP 34 finding documents that the
    // `.ASPXAUTH` cookie is granted only by the subsequent
    // `POST /Common/Home/AssignBranch` response, not by the login POST
    // itself — so without resolveIfPresent() here, a later DMS-area
    // navigation can race that reassignment and get redirected to Login
    // (confirmed via network trace: `GET /DMS/Customer/Create` -> 302 ->
    // `/Login/Index?ReturnUrl=...`). resolveIfPresent() is the exact method
    // performLogin() already uses for this same purpose after a fresh login.
    await dashboardPage.changeBranch();
    await branchSelectPage.resolveIfPresent();
    await dashboardPage.expectLoaded();

    // 2. Create Customer.
    const { customerGroupName } = await customerPrerequisites();
    const customerName = uniqueCode('CUSTOMER');
    await customerPage.createCustomer({
      name: customerName,
      customerGroupName,
      telephoneNo: randomData.phone11Digit(),
      email: randomData.email('customer'),
      address: `Automation Address ${uniqueCode('ADDR')}`,
    });
    // CUSTOMER-COLLECTION-DUE-REPORT-PICKER-INVESTIGATION E2E FINDING:
    // captured here (from the post-create Edit URL redirect — same
    // confirmed-reliable mechanism customer-collection-lifecycle.fixture.ts
    // already uses for this exact purpose) so the Report step below can use
    // ReportPage.selectCustomerDirectly() instead of its confirmed-broken
    // popup picker.
    const customerIdMatch = /\/Edit\/(\d+)/i.exec(page.url());
    expect(customerIdMatch).not.toBeNull();
    const customerId = customerIdMatch![1];

    // 3. Create Product (with Sale Price — see ProductPage.ts's
    // ProductCreateData.salePrice, added for exactly this flow).
    const { productGroupName, uomName } = await productPrerequisites();
    const productName = uniqueCode('PRODUCT');
    const salePrice = 500;
    await productPage.createProduct({ name: productName, productGroupName, uomName, salePrice });

    // Bank Account — Sale's mandatory payment prerequisite (see class doc
    // comment note 2).
    const { accountName: bankAccountName } = await bankAccountSetupPage.setupBankAccount();

    // 4. Create Sale Order.
    const orderQuantity = 1;
    const saleOrderCode = await saleOrderPage.createSaleOrder({
      customerName,
      productName,
      quantity: orderQuantity,
    });
    expect(saleOrderCode).not.toHaveLength(0);

    // 5. Create Sale — header + line item only; payment is completed below
    // once Final Payable is known (steps 6-8), via SalePage's own lower-
    // level methods rather than createSale()'s all-or-nothing default.
    const saleQuantity = 2;
    await salePage.gotoCreate();
    await salePage.selectCustomer(customerName);
    await salePage.fillInvoiceDate();
    await salePage.lineItems.addLineItem(productName, saleQuantity);

    // 6. Read Final Payable.
    const finalPayable = await salePage.getFinalPayable();

    // 7. Determine payment amount dynamically — a deliberate partial
    // payment (never the full Final Payable), so a real, non-zero Due
    // remains for the Collection/Due steps below.
    const paymentAmount = Math.floor(finalPayable / 2);

    // 8. Save Sale.
    //
    // SALE-SAVE-ASSERTION-ALIGNMENT-FIX E2E FINDING: previously
    // `toastr.expectSuccess()` + `getCode()` — the same false-positive-prone
    // generic-toast pattern already confirmed live (STEP SALE-SAVE-
    // VERIFICATION-INVESTIGATION) to silently accept an ERROR toast as
    // success, handing `getCode()` an `#Code` that was never populated.
    // `SalePage.waitForSaveSuccess()` already exists (built on that exact
    // finding — waits for the real `/DMS/Sale/Edit` navigation, then polls
    // `#Code`) and is already used by `SalePage.createSale()`; this spec's
    // own inline Save flow (built manually, not via `createSale()`, so it
    // can determine `paymentAmount` from `finalPayable` first) had simply
    // never been aligned to call it too.
    await salePage.addPayment(bankAccountName, paymentAmount);
    await salePage.clickSave();
    const saleCode = await salePage.waitForSaveSuccess();

    // CUSTOMER-COLLECTION-DUE-REPORT-ROW-VALIDATION-INVESTIGATION E2E
    // FINDING: Post the Sale — required for the Customer Collection Due
    // Report to find it at all. Confirmed live (full call-chain trace:
    // SaleController.cs -> ReportsService.GetCustomerCollectionDueList()
    // -> ReportsRepository.cs) that its query LEFT JOINs Sales with
    // `S.IsPost = 1` as part of the join condition, then separately
    // appends `AND S.BranchId = @BranchId` as a plain WHERE-level
    // condition (ReportsService.cs, via the shared `ApplyConditions()`
    // helper) — when no posted Sale exists, `S.BranchId` is NULL from the
    // LEFT JOIN, and `NULL = @BranchId` silently filters the customer row
    // out entirely (the report's own view renders "No data found" whenever
    // its model list is empty — Reports/CustomerCollectionDueReport.cshtml),
    // effectively making the LEFT JOIN behave like an INNER JOIN. This is
    // exactly the same "must be Posted" business rule already proven for
    // every other report in this project's E2E flows (e.g.
    // customer-collection-lifecycle.fixture.ts's own Sale Post, Supplier
    // Ledger's `WHERE PUR.IsPost = 1`) — this spec had simply never posted
    // its own Sale before reaching the Report step.
    await salePage.openEditFor(saleCode);
    await salePage.post();

    // 9. Read customer Due before collection — same invoice-picker
    // mechanism Collection itself uses, read directly without saving.
    await collectionPage.gotoCreate();
    await collectionPage.selectCustomer(customerName);
    await collectionPage.fillTransactionDate();
    const dueRowBefore = await collectionPage.invoices.addRow();
    await collectionPage.invoices.selectInvoiceForRow(dueRowBefore, saleCode);
    const dueBefore = await collectionPage.invoices.getDueAmount(dueRowBefore);

    // 10. Create Collection — pays off the full pre-collection Due, for the
    // cleanest possible post-collection assertion target.
    const collectionAmount = dueBefore;
    await collectionPage.invoices.setAmount(dueRowBefore, collectionAmount);
    await collectionPage.clickSave();
    await collectionPage.toastr.expectSuccess();
    const collectionCode = await collectionPage.getCode();
    expect(collectionCode).not.toHaveLength(0);

    // 11. Read customer Due after collection — a fresh, unsaved
    // Collection/Create screen, same customer + Sale Code.
    await collectionPage.gotoCreate();
    await collectionPage.selectCustomer(customerName);
    await collectionPage.fillTransactionDate();
    const dueRowAfter = await collectionPage.invoices.addRow();
    await collectionPage.invoices.selectInvoiceForRow(dueRowAfter, saleCode);
    const dueAfter = await collectionPage.invoices.getDueAmount(dueRowAfter);

    // 12. Verify: dueAfter == dueBefore - collectionAmount (new assertion).
    expect(dueAfter).toBeCloseTo(dueBefore - collectionAmount, 2);

    // 13-15. Open Customer Collection Due Report, select customer, open
    // report popup (new browser tab, captured via printAndCapture()).
    await reportPage.goto();
    await reportPage.selectCustomerDirectly(customerId, customerName);
    const reportTab = await reportPage.printAndCapture();

    // 16. Read report row.
    const reportRow = await reportPage.getCustomerRow(reportTab, customerName);
    const reportValues = await reportPage.getRowValues(reportRow);

    // 17. Verify report fields against values captured during the flow
    // (new assertions — Customer Name, Total Sale, Total Collection, Due).
    //
    // CUSTOMER-COLLECTION-DUE-REPORT-DUE-RECONCILIATION-INVESTIGATION E2E
    // FINDING: `dueAmount` was previously compared against `dueAfter` (the
    // Collection invoice-picker's own read of the Sale's TRUE remaining
    // due, which nets GrandTotal against BOTH this Sale's own at-sale
    // payment AND the later Collection) — confirmed live (raw report cell
    // capture + full call-chain trace, ReportsService.cs/
    // ReportsRepository.cs's `GetCustomerCollectionDueList`) that this
    // report's own DueAmount is `SUM(S.GrandTotal) - SUM(COL.
    // TotalCollectAmount)`, where `COL` is strictly the `Collections`
    // table — it deliberately never nets the Sale's own at-sale
    // `SaleCreditCards` payment (`paymentAmount` above) at all. That is a
    // real, different (not wrong) definition from `dueAfter` — this report
    // answers "how much is still owed against Collections specifically",
    // not "what is the customer's true outstanding balance" — so with a
    // partial at-sale payment (as this flow always makes, deliberately —
    // see `paymentAmount`'s own comment), its DueAmount correctly settles
    // at `paymentAmount`, not `0`, even once the Collection has paid off
    // the rest. Comparing against `finalPayable - collectionAmount`
    // (== TotalSaleAmount - TotalCollectionAmount, using the same
    // transaction-time-captured values the two assertions above already
    // use) matches this report's own confirmed, correct calculation.
    await expect(reportRow).toContainText(customerName);
    expect(reportValues.totalSaleAmount).toBeCloseTo(finalPayable, 2);
    expect(reportValues.totalCollectionAmount).toBeCloseTo(collectionAmount, 2);
    expect(reportValues.dueAmount).toBeCloseTo(finalPayable - collectionAmount, 2);

    // 18. Logout — same reusable assertions as LOGOUT-001
    // (tests/ui/auth/logout.spec.ts), not duplicated/reinvented here.
    await dashboardPage.logout();
    await expect(page).toHaveURL(new RegExp(routes.login.replace('/', '\\/')));
    await loginPage.expectStillOnLoginPage();
  });
});
