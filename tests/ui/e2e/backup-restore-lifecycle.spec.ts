import { test, expect } from '../../../fixtures/banking.fixture';
import { assertAdminCredentialsReady } from '../../../utils/env';
import { uniqueCode, randomData } from '../../../utils/random-data';
import { routes } from '../../../utils/constants';
import { BackupPage } from '../../../pages/setup/BackupPage';

/**
 * STEP BACKUP-RESTORE-LIFECYCLE-INVESTIGATION-AND-IMPLEMENTATION
 *
 * Cross-module E2E Backup/Restore lifecycle: Login -> Create Master Data
 * (Customer, Product) -> Create Transactions (Purchase, Sale, Collection) ->
 * Capture Existing Data -> Execute Backup -> Validate Backup File -> Restore
 * Backup -> Verify Data Integrity -> Logout. Not part of the approved
 * coverage baseline (config/coverage-baseline.ts).
 *
 * INVESTIGATION FINDINGS (confirmed exhaustively from source before this
 * spec's first run, not discovered by trial-and-error — exhaustive
 * per-file citation list on `pages/setup/BackupPage.ts`'s own class doc
 * comment; summarized here):
 * - NO Backup, Restore, Export, or Recovery feature exists ANYWHERE in this
 *   application: zero controller/action across all 54 controllers, zero
 *   view, zero `BackupService`/`IBackupService`/`RestoreService` class,
 *   zero menu row in the real menu seed script (`DB Master/Schema & Data/
 *   Menu Schema and Data.sql`, which drives `#partialViewContainer` per
 *   `Views/Shared/_Layout.cshtml:465`), zero `web.config` backup-path
 *   configuration (this is a legacy ASP.NET MVC app; there is no
 *   `appsettings*.json` at all). No `.bak`/`.zip` upload-and-restore
 *   endpoint exists either — the 6 controllers using
 *   `HttpPostedFileBase` (Product/UserProfile/Customer/Supplier/
 *   MasterSupplier/MasterItem) are all plain image/profile-photo uploads.
 * - The only "Database"-adjacent admin action anywhere,
 *   `SettingsController.DbUpdate()`, is a schema/data-migration trigger
 *   (`_repo.DbUpdate(model)`, applies pending SQL scripts against the live
 *   DB) — not a backup or restore of business data; it produces no file
 *   and consumes none.
 * - The only "Export" hits anywhere (`ProductController.cs`/
 *   `PurchaseController.cs`) are entirely commented-out Excel-export
 *   stubs — dead code, not a working feature either way.
 * - This is confirmed a genuine APPLICATION GAP, not an automation
 *   limitation or a missing permission — there is no menu entry, route, or
 *   endpoint for any role to reach. Steps 5-6 below reconfirm this live,
 *   against the real, currently-authenticated admin session's own rendered
 *   sidebar menu and the one real admin config screen (Settings), rather
 *   than relying on the static source read alone.
 *
 * RESULT: BLOCKED, per this task's own decision rule ("If: No backup
 * feature exists -> BLOCKED"). Steps 1-4 (Login, Master Data, Transactions,
 * Capture Existing Data) and the final Logout are still executed in full,
 * for real, against the live application — this genuinely proves the
 * business-data side of the lifecycle end-to-end and gives Steps 5-6 real,
 * freshly created data to have attempted a Backup against, rather than
 * skipping straight to a bare "feature missing" assertion. "Validate Backup
 * File" and "Restore Backup" are NOT attempted beyond Step 7's own
 * before/after self-consistency re-check (see its own comment) — there is
 * no backup file to validate and no restore mechanism to exercise, and this
 * spec does not fabricate either one to force a PASS.
 *
 * "CUSTOMER COUNT = X" ETC. SCOPING NOTE: the task's own Data Integrity
 * Validation template describes whole-table counts. `KendoGrid.rowCount()`
 * (this project's only confirmed grid-count primitive) counts the CURRENT
 * PAGE's rendered rows only, not a grid-wide total — no total-record-count
 * UI affordance (e.g. a Kendo pager-info label) has been independently
 * confirmed to exist on these grids, and this project's own Live DOM
 * Verification Rule (README.md) is to verify such a selector against the
 * live app before relying on it, not to guess one into an assertion. Given
 * that, the "count" verified per record type below is the row count for
 * THIS spec's own uniquely-generated record, found via the same
 * `grid.search(uniqueValue)` mechanism every other page object in this
 * project already uses for its own `openEditFor()` — i.e. "this exact
 * record is present exactly once", captured before Step 5 and re-checked
 * identically after Step 6, rather than an unconfirmed whole-table figure.
 */
test.describe('E2E Backup / Restore Lifecycle', () => {
  test('Login, Master Data, Transactions, Backup availability check, and Data Integrity reconcile end-to-end', async ({
    dashboardPage,
    branchSelectPage,
    loginPage,
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
    page,
  }) => {
    // Same empirical reasoning as every other lifecycle spec's own
    // test.setTimeout: Supplier/Customer/Product, a posted Purchase, a
    // posted Sale, a Collection, two full data snapshots (5 grid
    // round-trips each), and a menu/Settings check comfortably exceeds the
    // global 60s default.
    test.setTimeout(180_000);
    assertAdminCredentialsReady();

    // ============================================================
    // 1. LOGIN — see every other lifecycle spec's own identical step-1
    // comment for the full source+network-trace-backed root cause.
    // ============================================================
    await dashboardPage.changeBranch();
    await branchSelectPage.resolveIfPresent();
    await dashboardPage.expectLoaded();

    // ============================================================
    // 2. CREATE MASTER DATA — Customer, Product (+ Supplier, Purchase's own
    // required master-data party — same minimal-prerequisite convention
    // every other lifecycle spec in this project already uses).
    // ============================================================
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

    // ============================================================
    // 3. CREATE TRANSACTIONS — Purchase (posted), Sale (posted, partial
    // at-sale payment so a real Due remains), Collection (against that Due).
    // ============================================================
    const purchaseCode = await purchasePage.createPurchase({
      supplierName,
      beNumber: String(Date.now()),
      productName,
      quantity: 10,
    });
    expect(purchaseCode).not.toHaveLength(0);
    await purchasePage.post();

    await salePage.gotoCreate();
    await salePage.selectCustomer(customerName);
    await salePage.fillInvoiceDate();
    await salePage.lineItems.addLineItem(productName, 5);
    const finalPayable = await salePage.getFinalPayable();
    // Deliberate partial payment — same "leave a real Due for Collection"
    // reasoning banking.fixture.ts's own saleWithDuePrerequisite doc
    // comment already documents. `|| 1` guards the (unexpected) case of a
    // FinalPayable under 2, which would otherwise floor to 0 and be
    // rejected as "must complete the payment".
    const atSalePayment = Math.floor(finalPayable / 2) || 1;
    await salePage.addPayment(bankAccountName, atSalePayment);
    await salePage.clickSave();
    const saleCode = await salePage.waitForSaveSuccess();
    expect(saleCode).not.toHaveLength(0);
    // Post — required for the Sale to be counted as real business activity
    // by the rest of the application (same rule every other lifecycle spec
    // in this project documents for its own Purchase/Sale Post step).
    // createSale's own waitForSaveSuccess() already lands on
    // /DMS/Sale/Edit/{id} for this exact record, so post() is called
    // directly rather than re-navigating via openEditFor().
    await salePage.post();

    await collectionPage.gotoCreate();
    await collectionPage.selectCustomer(customerName);
    await collectionPage.fillTransactionDate();
    const dueRow = await collectionPage.invoices.addRow();
    await collectionPage.invoices.selectInvoiceForRow(dueRow, saleCode);
    const dueBeforeCollection = await collectionPage.invoices.getDueAmount(dueRow);
    expect(dueBeforeCollection).toBeGreaterThan(0);
    // Pays off the full pre-Collection Due, for the cleanest possible
    // Data Integrity re-check target later.
    await collectionPage.invoices.setAmount(dueRow, dueBeforeCollection);
    await collectionPage.clickSave();
    await collectionPage.toastr.expectSuccess();
    const collectionCode = await collectionPage.getCode();
    expect(collectionCode).not.toHaveLength(0);

    /**
     * Re-confirms each of the 5 records created above is independently
     * findable via its own module's real grid search (not merely trusted
     * from its own create-time success signal) — see this file's own class
     * doc comment ("CUSTOMER COUNT = X" scoping note) for why this searched
     * row count, not a whole-table total, is what this spec verifies.
     */
    async function captureSnapshot() {
      await customerPage.goto();
      await customerPage.grid.search(customerName);
      const customerCount = await customerPage.grid.rowCount();

      await productPage.goto();
      await productPage.grid.search(productName);
      const productCount = await productPage.grid.rowCount();

      await purchasePage.goto();
      await purchasePage.grid.search(purchaseCode);
      const purchaseCount = await purchasePage.grid.rowCount();

      await salePage.goto();
      await salePage.grid.search(saleCode);
      const saleCount = await salePage.grid.rowCount();

      await collectionPage.goto();
      await collectionPage.grid.search(collectionCode);
      const collectionCount = await collectionPage.grid.rowCount();

      return { customerCount, productCount, purchaseCount, saleCount, collectionCount };
    }

    // ============================================================
    // 4. CAPTURE EXISTING DATA — the real, pre-"backup" baseline. Customer
    // exists, Product exists, Purchase exists, Sale exists, Collection
    // exists — each exactly once.
    // ============================================================
    const beforeSnapshot = await captureSnapshot();
    expect(beforeSnapshot.customerCount).toBe(1);
    expect(beforeSnapshot.productCount).toBe(1);
    expect(beforeSnapshot.purchaseCount).toBe(1);
    expect(beforeSnapshot.saleCount).toBe(1);
    expect(beforeSnapshot.collectionCount).toBe(1);

    // ============================================================
    // 5. EXECUTE BACKUP — attempted against the real, live sidebar menu for
    // this authenticated admin session (`#partialViewContainer`, the ONLY
    // menu surface in this application — see BackupPage.ts's own doc
    // comment). CONFIRMED: no menu entry exists to trigger a Backup action
    // at all — nothing to click, so nothing is clicked.
    // ============================================================
    const backupPage = new BackupPage(page);
    const sidebarMenuHasBackupEntry = await backupPage.hasBackupOrRestoreMenuEntry();
    expect(sidebarMenuHasBackupEntry).toBe(false);

    // ============================================================
    // 6. VALIDATE BACKUP FILE — no backup was ever triggered (Step 5), so
    // there is no file to validate (no "backup completed" signal, no file
    // size to check). The one other plausible real UI surface for such a
    // control, Settings (Areas/SetUp/Controllers/SettingsController.cs —
    // the sole confirmed, real, DB-driven admin config screen in this
    // application), is checked too, for completeness rather than assuming.
    // ============================================================
    await backupPage.gotoSettings();
    const settingsHasBackupControl = await backupPage.hasBackupOrRestoreControlOnSettingsPage();
    expect(settingsHasBackupControl).toBe(false);

    // ============================================================
    // RESTORE BACKUP — NOT ATTEMPTED. Per this task's own rules ("Do NOT
    // create fake backup files", "Do NOT bypass application flow"), and
    // since Steps 5-6 above confirm no backup mechanism exists anywhere to
    // produce a file from, there is nothing to restore and no safe way to
    // exercise this step without fabricating the very capability under
    // test.
    //
    // 7. VERIFY DATA INTEGRITY — re-runs the exact same Step 4 snapshot.
    // Since no backup/restore ever executed, Before == After is expected
    // TRIVIALLY here — this proves the investigation itself (navigating
    // through Settings, re-reading the sidebar menu, re-searching every
    // grid) had no side effect on the data captured in Step 4; it does NOT
    // prove a restore round-trip preserves data, since no such round-trip
    // exists in this application to test.
    // ============================================================
    const afterSnapshot = await captureSnapshot();
    expect(afterSnapshot).toEqual(beforeSnapshot);

    // ============================================================
    // 8. LOGOUT — same reusable assertions as LOGOUT-001
    // (tests/ui/auth/logout.spec.ts) and every other lifecycle spec's own
    // final step, not duplicated/reinvented here.
    // ============================================================
    await dashboardPage.logout();
    await expect(page).toHaveURL(new RegExp(routes.login.replace('/', '\\/')));
    await loginPage.expectStillOnLoginPage();
  });
});
