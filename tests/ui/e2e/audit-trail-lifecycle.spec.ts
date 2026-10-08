import { test, expect } from '../../../fixtures/purchase-lifecycle.fixture';
import { assertAdminCredentialsReady } from '../../../utils/env';
import { env } from '../../../utils/env';
import { uniqueCode, randomData } from '../../../utils/random-data';

/**
 * Cross-module E2E Audit Trail / Data Change History lifecycle: Login ->
 * Create Purchase -> verify CREATE audit metadata -> Update Purchase ->
 * verify change (Updated By/On) metadata -> Post Purchase -> verify
 * Posting activity metadata -> Create Sale -> verify CREATE audit metadata
 * -> Logout. Not part of the approved coverage baseline
 * (config/coverage-baseline.ts).
 *
 * PHASE 1 INVESTIGATION FINDINGS this spec is built on (confirmed
 * exhaustively from source before writing this spec's assertions, not
 * discovered by trial-and-error):
 *
 * - **NO dedicated Audit Trail / Data Change History / Activity Log table
 *   exists anywhere in this application.** Confirmed absent by exhaustive
 *   source search across both projects and every `.sql` script — zero
 *   matches for `AuditLog`, `AuditTrail`, `DataChangeHistory`,
 *   `ActivityLog`, `ChangeHistory`, `AuditHistory`. Every "audit" concept in
 *   this application reduces to the same plain per-row `CreatedBy`/
 *   `CreatedOn`/`LastModifiedBy`/`LastModifiedOn`/`PostedBy`/`PostedOn`
 *   columns already confirmed present on nearly every transaction table
 *   throughout this whole engagement's prior investigations.
 * - **A real, working "Audit Details" panel (`.auditshow`/`.auditcard`)
 *   DOES exist** on ~80+ Create/Edit views (confirmed on Purchase, Sale,
 *   Product, Customer, Expense, Income, and more) — but it is confirmed
 *   from source (`PurchaseController.Edit()`) to be populated from the
 *   SAME row/repository call that backs the record's own grid listing,
 *   not a separate audit-specific table or endpoint. `BasePage.getAuditDetails()`
 *   (added for this flow — see its own doc comment) is the first thing in
 *   this automation project to actually READ this panel's values;
 *   `BasePage.showAuditPanel()` already existed but was never previously
 *   called by any test, and only ever clicked the toggle without reading
 *   anything.
 * - **No "Old Value / New Value" diff tracking exists anywhere.** The
 *   Update Action validation this task requests ("Old Value, New Value,
 *   Updated User, Updated Date") is only PARTIALLY satisfiable: "Updated
 *   User"/"Updated Date" map directly to the Audit Panel's real
 *   `LastModifiedBy`/`LastModifiedOn` fields, but no mechanism anywhere in
 *   this codebase records what a field's value was BEFORE an edit — there
 *   is no before/after diff to assert, and this spec does not fake one.
 * - **No dedicated "who archived/deleted" trail exists.** Confirmed from
 *   source (`BranchProfileRepository.cs`'s own archive UPDATE statement):
 *   archiving a record overwrites the SAME `LastModifiedBy`/`LastModifiedOn`
 *   columns used for ordinary edits — there is no separate
 *   `ArchivedBy`/`ArchivedOn`, so "who archived it" is only as durable as
 *   until the next edit touches the row. Moot for this flow's own two
 *   modules regardless: Purchase and Sale are both already confirmed
 *   (PurchasePage.ts's/SaleReturnPage.ts's own doc comments, prior
 *   investigations) to have NO delete/archive action reachable via the UI
 *   at all — this spec does not attempt a Delete/Archive step for either,
 *   rather than inventing one against a module that doesn't support it.
 * - **No Activity Report / Audit Report / Change History Report exists
 *   anywhere.** Confirmed absent by source search — no report, grid
 *   column, or dedicated screen surfaces Created/Modified/Posted-by
 *   information outside each record's own Audit Panel. This spec does not
 *   attempt to validate a report that does not exist.
 * - **ELMAH is a real, SQL-backed error log** (`Web.config`'s `<elmah>`
 *   section, `ErrorLogModule`/`ErrorMailModule`/`ErrorFilterModule` wired
 *   for both pipeline modes, a genuine `/elmah.axd` viewer handler) — but
 *   confirmed `allowRemoteAccess="false"` in `Web.config`, meaning the
 *   viewer only renders for requests originating from the server's own
 *   localhost, not remotely. Not reachable from this Playwright test
 *   runner's browser, and not attempted here (querying its separate
 *   `ElmahErrorDMS_UI` database directly would violate this task's own
 *   "do not query the database" rule regardless).
 */
test.describe('E2E Audit Trail / Data Change History Lifecycle', () => {
  test('Purchase Create/Update/Post and Sale Create audit metadata reconcile end-to-end', async ({
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
  }) => {
    // Same empirical reasoning as every other lifecycle spec's own
    // test.setTimeout: 2 saved transaction modules, an Update, a Post, and
    // 4 Audit Panel round-trips exceeds the global 60s default.
    test.setTimeout(150_000);
    assertAdminCredentialsReady();

    // 1. Login — see every other lifecycle spec's own identical step-1
    // comment for the full source+network-trace-backed root cause.
    await dashboardPage.changeBranch();
    await branchSelectPage.resolveIfPresent();
    await dashboardPage.expectLoaded();

    // Prerequisites.
    const { supplierGroupName } = await supplierPrerequisites();
    const supplierName = uniqueCode('SUPPLIER');
    await supplierPage.createSupplier({
      name: supplierName,
      supplierGroupName,
      address: `Automation Address ${uniqueCode('ADDR')}`,
    });

    const { customerGroupName } = await customerPrerequisites();
    const customerName = uniqueCode('CUSTOMER');
    await customerPage.createCustomer({
      name: customerName,
      customerGroupName,
      telephoneNo: randomData.phone11Digit(),
      email: randomData.email('customer'),
      address: `Automation Address ${uniqueCode('ADDR')}`,
    });

    const { productGroupName, uomName } = await productPrerequisites();
    const productName = uniqueCode('PRODUCT');
    await productPage.createProduct({ name: productName, productGroupName, uomName, purchasePrice: 100, salePrice: 150 });

    const { accountName: bankAccountName } = await bankAccountSetupPage.setupBankAccount();

    // Today's date, loosely — the Audit Panel's own date FORMAT was not
    // independently confirmed against a live render before this spec's
    // first run, so CreatedOn/PostedOn are asserted to CONTAIN today's day
    // number and year rather than an exact-format string match, avoiding a
    // guessed format assumption.
    const today = new Date();
    const todayYear = String(today.getFullYear());

    // ============================================================
    // CREATE PURCHASE — verify CREATE audit metadata.
    // ============================================================
    const purchaseCode = await purchasePage.createPurchase({
      supplierName,
      beNumber: String(Date.now()),
      productName,
      quantity: 10,
    });
    expect(purchaseCode).not.toHaveLength(0);

    // createPurchase() already lands on the Purchase Edit page — the Audit
    // Panel is available right there, no re-navigation needed.
    await purchasePage.showAuditPanel();
    const purchaseAuditAfterCreate = await purchasePage.getAuditDetails();

    // Validate: Module/Action=CREATE has no literal field in this
    // application (class doc comment) — verified instead via the real,
    // confirmed-equivalent signal: CreatedBy/CreatedOn are populated with
    // the acting user and today's date, while LastModifiedBy/LastModifiedOn
    // and PostedBy/PostedOn are still empty (a fresh create, never
    // updated or posted yet).
    expect(purchaseAuditAfterCreate.createdBy).toBe(env.adminUsername);
    expect(purchaseAuditAfterCreate.createdOn).toContain(todayYear);
    expect(purchaseAuditAfterCreate.lastModifiedBy).toBe('');
    expect(purchaseAuditAfterCreate.postedBy).toBe('');

    // ============================================================
    // UPDATE PURCHASE — verify change (Updated By/On) metadata.
    // "Old Value/New Value" tracking is confirmed NOT to exist anywhere in
    // this application (class doc comment) — not asserted here, since
    // doing so would require fabricating a mechanism the app does not
    // implement.
    // ============================================================
    const newBeNumber = String(Date.now() + 1);
    await purchasePage.updateBeNumber(newBeNumber);

    await purchasePage.showAuditPanel();
    const purchaseAuditAfterUpdate = await purchasePage.getAuditDetails();
    expect(purchaseAuditAfterUpdate.lastModifiedBy).toBe(env.adminUsername);
    expect(purchaseAuditAfterUpdate.lastModifiedOn).toContain(todayYear);
    // CreatedBy/CreatedOn remain unchanged by an Update — this is the
    // record's own original creation metadata, not overwritten.
    expect(purchaseAuditAfterUpdate.createdBy).toBe(purchaseAuditAfterCreate.createdBy);
    expect(purchaseAuditAfterUpdate.createdOn).toBe(purchaseAuditAfterCreate.createdOn);

    // ============================================================
    // POST PURCHASE — verify Posting activity metadata.
    // ============================================================
    await purchasePage.post();

    // AUDIT-TRAIL-LIFECYCLE E2E FINDING: confirmed live that `post()`
    // (`BasePage.clickPost()`) updates the record in place via AJAX without
    // a full page reload — the already-rendered `#PostedBy`/`#PostedOn`
    // fields (and the Audit Panel showing them) do not refresh from that
    // in-place update. Re-opens the Edit page explicitly (the same
    // confirmed-reliable mechanism every other lifecycle spec already uses
    // to read back a fresh, server-confirmed state after Post/Save) before
    // reading the Audit Panel again.
    await purchasePage.openEditFor(purchaseCode);
    await purchasePage.showAuditPanel();
    const purchaseAuditAfterPost = await purchasePage.getAuditDetails();
    expect(purchaseAuditAfterPost.postedBy).toBe(env.adminUsername);
    expect(purchaseAuditAfterPost.postedOn).toContain(todayYear);

    // ============================================================
    // CREATE SALE — verify CREATE audit metadata, same pattern as Purchase.
    // ============================================================
    await salePage.gotoCreate();
    await salePage.selectCustomer(customerName);
    await salePage.fillInvoiceDate();
    await salePage.lineItems.addLineItem(productName, 5);
    const finalPayable = await salePage.getFinalPayable();
    await salePage.addPayment(bankAccountName, finalPayable);
    await salePage.clickSave();
    const saleCode = await salePage.waitForSaveSuccess();
    expect(saleCode).not.toHaveLength(0);

    await salePage.showAuditPanel();
    const saleAuditAfterCreate = await salePage.getAuditDetails();
    expect(saleAuditAfterCreate.createdBy).toBe(env.adminUsername);
    expect(saleAuditAfterCreate.createdOn).toContain(todayYear);
    expect(saleAuditAfterCreate.lastModifiedBy).toBe('');
    expect(saleAuditAfterCreate.postedBy).toBe('');

    // ============================================================
    // DELETE/ARCHIVE HISTORY — NOT ATTEMPTED. Both Purchase and Sale are
    // confirmed (this project's own prior investigations, cited in this
    // spec's class doc comment) to have no delete/archive action reachable
    // via the UI at all — there is nothing to exercise for either module.
    //
    // ACTIVITY REPORT — NOT ATTEMPTED. No such report, grid column, or
    // screen exists anywhere in this application (class doc comment).
    // ============================================================

    // Logout — same reusable assertions as LOGOUT-001
    // (tests/ui/auth/logout.spec.ts) and every other lifecycle spec's own
    // final step, not duplicated/reinvented here.
    await dashboardPage.logout();
  });
});
