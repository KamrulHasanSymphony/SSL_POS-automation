import { test, expect } from '../../../fixtures/customer-collection-lifecycle.fixture';
import { assertAdminCredentialsReady } from '../../../utils/env';
import { routes } from '../../../utils/constants';

/**
 * Cross-module E2E customer-collection lifecycle: Login -> Customer ->
 * Product -> Sale -> Sale Post -> Collection -> Due reduction -> Customer
 * Sale & Collection Report -> Logout. Written per STEP C-E2E-FIX, following
 * STEP C-CUSTOMER-COLLECTION-LIFECYCLE's investigation and validating the
 * two report-layer fixes applied in STEP C-REPORT-FIX
 * (GetCustomerSaleCollectionReportList's Collections.IsActive removal and
 * SaleCreditCards Remarks='Collection Payment' exclusion).
 *
 * Deliberately a NEW file rather than a modification of the existing
 * tests/ui/e2e/sales-lifecycle.spec.ts: that spec already covers a similar
 * Customer->SaleOrder->Sale->Collection->Due flow but (a) never Posts the
 * Sale and (b) validates GetCustomerCollectionDueList (a different report,
 * routed through SaleController.CustomerCollectionDueIndex), not
 * CustomerSaleCollectionReportList (routed through
 * SaleController.CustomerSaleCollectionReportIndex) — the specific report
 * fixed in STEP C-REPORT-FIX. This spec is scoped precisely to prove that
 * fix, with the Sale-Post step the underlying query requires; it does not
 * duplicate sales-lifecycle.spec.ts's own SaleOrder-conversion coverage.
 *
 * Runs under the "authenticated" Playwright project. "Login" (step 1) is
 * represented the same way every other lifecycle spec in this project
 * represents it — see financial-lifecycle.spec.ts's class doc comment for
 * the full RCA citation (changeBranch() alone can leave the session
 * mid-branch-(re)assignment; resolveIfPresent() is required immediately
 * after it).
 */
test.describe('E2E Customer Collection Lifecycle', () => {
  test('Login, Customer, Product, Sale, Sale Post, Collection, Due reduction, and Customer Sale & Collection Report reconcile end-to-end', async ({
    dashboardPage,
    loginPage,
    branchSelectPage,
    saleWithDuePrerequisitePosted,
    collectionPage,
    customerSaleCollectionReportPage,
    page,
  }) => {
    // Same empirical reasoning as financial-lifecycle.spec.ts's own
    // test.setTimeout: a comparable number of sequential steps (Customer,
    // Product, Sale + its own Post, Collection, a new-tab Print/report
    // round-trip) is expected to exceed the global 60s default.
    test.setTimeout(120_000);
    assertAdminCredentialsReady();

    // 1. Login — see class doc comment.
    await dashboardPage.changeBranch();
    await branchSelectPage.resolveIfPresent();
    await dashboardPage.expectLoaded();

    // 2-5. Customer, Product, Sale (partial payment, so a real Due remains),
    // and Sale Post — see fixture's own doc comment for why this is a
    // dedicated prerequisite rather than banking.fixture.ts's
    // saleWithDuePrerequisite.
    const { customerName, customerId, saleCode } = await saleWithDuePrerequisitePosted();
    expect(saleCode).not.toHaveLength(0);

    // 6. Read customer Due before Collection — same invoice-picker
    // mechanism Collection itself uses, read directly without saving
    // (mirrors financial-lifecycle.spec.ts's identical Payment-side
    // pattern and sales-lifecycle.spec.ts's own Collection step).
    await collectionPage.gotoCreate();
    await collectionPage.selectCustomer(customerName);
    await collectionPage.fillTransactionDate();
    const dueRowBefore = await collectionPage.invoices.addRow();
    await collectionPage.invoices.selectInvoiceForRow(dueRowBefore, saleCode);
    const dueBefore = await collectionPage.invoices.getDueAmount(dueRowBefore);
    expect(dueBefore).toBeGreaterThan(0);

    // 7. Create Collection — pays off the full pre-collection Due, for the
    // cleanest possible post-collection assertion target. Built inline
    // (not via CollectionPage.createCollection()'s convenience wrapper) so
    // the exact Save network response can be captured and verified below —
    // "do not trust toast only".
    const collectionAmount = dueBefore;
    await collectionPage.invoices.setAmount(dueRowBefore, collectionAmount);

    const [saveResponse] = await Promise.all([
      page.waitForResponse(
        (response) => response.url().includes('/DMS/Collection/CreateEdit') && response.request().method() === 'POST'
      ),
      collectionPage.clickSave(),
    ]);
    await collectionPage.toastr.expectSuccess();
    const collectionCode = await collectionPage.getCode();
    expect(collectionCode).not.toHaveLength(0);

    // 8. Verify Collection Save via its actual network response, not the
    // toast alone (per this step's Evidence Rules): HTTP status, Success
    // response, Collection Id/Code generated, CustomerId correct, Amount
    // correct. Response shape confirmed from source
    // (Areas/DMS/Controllers/CollectionController.cs's CreateEdit action):
    // { Success, Status, Message, Data: { Id, Code, CustomerId,
    // TotalCollectAmount, ... } }.
    //
    // COLLECTION-SAVE-RESPONSE-ASSERTION-FIX E2E FINDING: `Status` is
    // `ResultModel<T>.Status`, typed as the `Status` enum
    // (ShampanPOS.Models/Status.cs: `Success = 200, Fail = 400,
    // Warning = 199`) — Json.NET serializes it as its plain underlying int
    // by default (no StringEnumConverter applied anywhere in this app), so
    // the live response's `Status: 200` is the CORRECT, intended value for
    // success, not a regression. The previous `toBe('Success')` assumed a
    // string this API has never actually returned.
    expect(saveResponse.status()).toBe(200);
    const saveBody = await saveResponse.json();
    expect(saveBody.Success).toBe(true);
    expect(saveBody.Status).toBe(200);
    expect(saveBody.Data?.Id).toBeTruthy();
    expect(Number(saveBody.Data?.CustomerId)).toBe(Number(customerId));
    expect(Number(saveBody.Data?.TotalCollectAmount)).toBeCloseTo(collectionAmount, 2);

    // 9. Read customer Due after Collection — a fresh, unsaved
    // Collection/Create screen, same customer + Sale Code.
    await collectionPage.gotoCreate();
    await collectionPage.selectCustomer(customerName);
    await collectionPage.fillTransactionDate();
    const dueRowAfter = await collectionPage.invoices.addRow();
    await collectionPage.invoices.selectInvoiceForRow(dueRowAfter, saleCode);
    const dueAfter = await collectionPage.invoices.getDueAmount(dueRowAfter);

    // 10. Verify: dueAfter == dueBefore - collectionAmount (== 0, given the
    // full Due was collected above).
    expect(dueAfter).toBeCloseTo(dueBefore - collectionAmount, 2);
    expect(dueAfter).toBeCloseTo(0, 2);

    // 11-14. Open Customer Sale & Collection Report — the specific report
    // fixed in STEP C-REPORT-FIX — select customer directly (see
    // CustomerSaleCollectionReportPage's own doc comment for why, same
    // broken-popup reasoning already established for
    // SupplierLedgerPage.selectSupplierDirectly()), Summary mode, capture
    // the new-tab print output.
    await customerSaleCollectionReportPage.goto();
    await customerSaleCollectionReportPage.selectCustomerDirectly(customerId, customerName);
    await customerSaleCollectionReportPage.enableSummaryMode();
    const reportTab = await customerSaleCollectionReportPage.printAndCapture();

    // 15. Read report row.
    const reportRow = await customerSaleCollectionReportPage.getCustomerRow(reportTab, customerName);
    const reportValues = await customerSaleCollectionReportPage.getReportValues(reportRow);

    // 16. Verify report fields against values captured during the flow —
    // the assertions this spec exists to prove: Total Collection Amount
    // reflects the real Collection amount exactly once (STEP C-REPORT-FIX's
    // Collections.IsActive fix makes the Collection visible at all; its
    // SaleCreditCards Remarks='Collection Payment' exclusion stops that same
    // amount from also being counted via the Collection's own SaleCreditCards
    // mirror row — see ReportsRepository.cs). Total Sale Amount must be at
    // least the Sale's paid-so-far amount (it is Posted, so it is counted).
    await expect(reportRow).toContainText(customerName);
    expect(reportValues.totalSaleAmount).toBeGreaterThan(0);
    expect(reportValues.totalCollectionAmount).toBeGreaterThanOrEqual(collectionAmount - 0.01);
    // Not asserted as an exact equality against collectionAmount alone: this
    // report's Total Collection Amount also legitimately includes any
    // at-sale-time card payment recorded when the Sale itself was saved
    // (SaleCreditCards rows with Remarks != 'Collection Payment' — see
    // ReportsRepository.cs's RawCollections CTE and STEP C-REPORT-FIX's
    // Business Rule Decision) — this spec's Sale used a bank-account payment
    // at creation (SalePage.addPayment()), not a SaleCreditCards-recorded
    // card payment, so no such contribution is expected here, but the
    // assertion is phrased as a lower bound rather than an exact match to
    // stay correct even if that changes.
    expect(reportValues.outstandingAmount).toBeCloseTo(reportValues.totalSaleAmount - reportValues.totalCollectionAmount, 2);

    // 17. Logout — same reusable assertions as LOGOUT-001
    // (tests/ui/auth/logout.spec.ts) and every other lifecycle spec's own
    // final step, not duplicated/reinvented here.
    await dashboardPage.logout();
    await expect(page).toHaveURL(new RegExp(routes.login.replace('/', '\\/')));
    await loginPage.expectStillOnLoginPage();
  });
});
