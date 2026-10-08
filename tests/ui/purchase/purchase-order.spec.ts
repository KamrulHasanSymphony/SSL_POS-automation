import { test, expect } from '../../../fixtures/transactions.fixture';
import { assertAdminCredentialsReady } from '../../../utils/env';
import { tags } from '../../../config/tags';

/**
 * STEP 6 module: PurchaseOrder (PROP-PO-001..007) — PROPOSED SOURCE-VERIFIED
 * COVERAGE, approved as the authoritative STEP 6 scope. Runs under the
 * "authenticated" project.
 *
 * Delete is explicitly OUT OF SCOPE: confirmed NO controller action exists
 * at all for PurchaseOrder (stronger absence than Purchase's orphaned action).
 */
test.describe('PurchaseOrder — PROP-PO', () => {
  test(`PROP-PO-001 PurchaseOrder list/grid loads and displays records ${tags.regression} ${tags.smoke} ${tags.p0}`, async ({
    purchaseOrderPage,
    purchasePartyPrerequisites,
  }) => {
    assertAdminCredentialsReady();

    const { supplierName, productName } = await purchasePartyPrerequisites();
    const code = await purchaseOrderPage.createPurchaseOrder({ supplierName, productName, quantity: 5 });

    await purchaseOrderPage.goto();
    await purchaseOrderPage.grid.search(code);
    await purchaseOrderPage.grid.waitForLoad();
    expect(await purchaseOrderPage.grid.rowCount()).toBeGreaterThanOrEqual(1);
    await expect(await purchaseOrderPage.grid.findRowByText(code)).toBeVisible();
  });

  test(`PROP-PO-002 Create PurchaseOrder with required header fields + line item succeeds ${tags.regression} ${tags.smoke} ${tags.p0}`, async ({
    purchaseOrderPage,
    purchasePartyPrerequisites,
  }) => {
    assertAdminCredentialsReady();

    const { supplierName, productName } = await purchasePartyPrerequisites();
    const code = await purchaseOrderPage.createPurchaseOrder({ supplierName, productName, quantity: 3 });

    await purchaseOrderPage.goto();
    await purchaseOrderPage.grid.search(code);
    await expect(await purchaseOrderPage.grid.findRowByText(code)).toBeVisible();
  });

  test(`PROP-PO-003 Create PurchaseOrder without Supplier is rejected ${tags.regression} ${tags.negative} ${tags.p1}`, async ({
    purchaseOrderPage,
    page,
  }) => {
    assertAdminCredentialsReady();

    await purchaseOrderPage.gotoCreate();
    await purchaseOrderPage.fillDates();
    // Supplier deliberately left unselected.
    await purchaseOrderPage.clickSave();

    await purchaseOrderPage.expectSupplierRequiredIndicated();
    await expect(page).toHaveURL(/\/DMS\/PurchaseOrder\/Create/i);
  });

  test(`PROP-PO-004 Create PurchaseOrder without Order Date is rejected ${tags.regression} ${tags.negative} ${tags.p1}`, async ({
    purchaseOrderPage,
    purchasePartyPrerequisites,
    page,
  }) => {
    assertAdminCredentialsReady();

    const { supplierName } = await purchasePartyPrerequisites();
    await purchaseOrderPage.gotoCreate();
    await purchaseOrderPage.selectSupplier(supplierName);
    // Order Date deliberately left empty (Delivery Date also left empty —
    // filling only Delivery without Order would still leave Order invalid).
    await purchaseOrderPage.clickSave();

    await purchaseOrderPage.expectOrderDateRequiredValidation();
    await expect(page).toHaveURL(/\/DMS\/PurchaseOrder\/Create/i);
  });

  test(`PROP-PO-005 Edit saved unposted PurchaseOrder and verify persistence ${tags.regression} ${tags.p0}`, async ({
    purchaseOrderPage,
    purchasePartyPrerequisites,
  }) => {
    assertAdminCredentialsReady();

    const { supplierName, productName } = await purchasePartyPrerequisites();
    const code = await purchaseOrderPage.createPurchaseOrder({ supplierName, productName, quantity: 2 });

    await purchaseOrderPage.openEditFor(code);
    // PurchaseOrder has no BE-Number-equivalent free-text field — persistence
    // is verified by re-selecting a different Supplier and confirming the
    // grid's SupplierName column reflects it after a fresh navigation.
    const { supplierName: newSupplierName } = await purchasePartyPrerequisites();
    await purchaseOrderPage.selectSupplier(newSupplierName);
    await purchaseOrderPage.clickUpdate();
    await purchaseOrderPage.toastr.expectSuccess();

    await purchaseOrderPage.goto();
    await purchaseOrderPage.grid.search(code);
    const row = await purchaseOrderPage.grid.findRowByText(code);
    await expect(row).toContainText(newSupplierName);
  });

  test(`PROP-PO-006 Posting PurchaseOrder transitions Draft to Posted and locks the form ${tags.regression} ${tags.p0}`, async ({
    purchaseOrderPage,
    purchasePartyPrerequisites,
  }) => {
    assertAdminCredentialsReady();

    const { supplierName, productName } = await purchasePartyPrerequisites();
    const code = await purchaseOrderPage.createPurchaseOrder({ supplierName, productName, quantity: 4 });

    await purchaseOrderPage.openEditFor(code);
    expect(await purchaseOrderPage.isAlreadyPosted()).toBe(false);

    await purchaseOrderPage.post();

    expect(await purchaseOrderPage.isAlreadyPosted()).toBe(true);
  });

  test(`PROP-PO-007 PurchaseOrder grid search filters by Code/Supplier ${tags.regression} ${tags.p2}`, async ({
    purchaseOrderPage,
    purchasePartyPrerequisites,
  }) => {
    assertAdminCredentialsReady();

    const { supplierName, productName } = await purchasePartyPrerequisites();
    const code = await purchaseOrderPage.createPurchaseOrder({ supplierName, productName, quantity: 1 });

    await purchaseOrderPage.goto();
    await purchaseOrderPage.grid.search(code);
    await purchaseOrderPage.grid.waitForLoad();

    expect(await purchaseOrderPage.grid.rowCount()).toBe(1);
    await expect(await purchaseOrderPage.grid.findRowByText(code)).toBeVisible();
  });
});
