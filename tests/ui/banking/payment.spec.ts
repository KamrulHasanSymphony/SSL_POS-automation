import { test, expect } from '../../../fixtures/banking.fixture';
import { assertAdminCredentialsReady } from '../../../utils/env';
import { tags } from '../../../config/tags';

/**
 * STEP 7 module: Payment (PROP-PAY-001..006), approved STEP 7 scope.
 * Mirrors Collection. Runs under the "authenticated" project.
 *
 * Delete is explicitly OUT OF SCOPE: action exists, zero UI trigger. No
 * Post/Draft test: confirmed no working Post workflow.
 *
 * Prerequisite chain: Product -> Supplier -> Purchase (PaidAmount left
 * unset, so the confirmed-optional field defaults to 0 and the full
 * GrandTotal remains Due — a lower-risk chain than Collection's, since
 * Purchase has no confirmed mandatory-payment rule the way Sale does) ->
 * Payment against that Purchase.
 */
test.describe('Payment — PROP-PAY', () => {
  test(`PROP-PAY-001 Payment list/grid loads and displays records ${tags.regression} ${tags.smoke} ${tags.p0}`, async ({
    paymentPage,
    purchaseWithDuePrerequisite,
  }) => {
    assertAdminCredentialsReady();

    const { supplierName, purchaseCode } = await purchaseWithDuePrerequisite();
    const code = await paymentPage.createPayment(supplierName, purchaseCode);

    await paymentPage.goto();
    await paymentPage.grid.search(code);
    await paymentPage.grid.waitForLoad();
    expect(await paymentPage.grid.rowCount()).toBeGreaterThanOrEqual(1);
    await expect(await paymentPage.grid.findRowByText(code)).toBeVisible();
  });

  test(`PROP-PAY-002 Create Payment against existing Purchase with amount <= Due Amount succeeds ${tags.regression} ${tags.smoke} ${tags.p0}`, async ({
    paymentPage,
    purchaseWithDuePrerequisite,
  }) => {
    assertAdminCredentialsReady();

    const { supplierName, purchaseCode } = await purchaseWithDuePrerequisite();
    const code = await paymentPage.createPayment(supplierName, purchaseCode);

    await paymentPage.goto();
    await paymentPage.grid.search(code);
    await expect(await paymentPage.grid.findRowByText(code)).toBeVisible();
  });

  test(`PROP-PAY-003 Payment without Supplier rejected ${tags.regression} ${tags.negative} ${tags.p1}`, async ({
    paymentPage,
    page,
  }) => {
    assertAdminCredentialsReady();

    await paymentPage.gotoCreate();
    await paymentPage.fillTransactionDate();
    // Supplier deliberately left unselected.
    await paymentPage.clickSave();

    await paymentPage.expectSupplierRequiredIndicated();
    await expect(page).toHaveURL(/\/DMS\/Payment\/Create/i);
  });

  test(`PROP-PAY-004 Payment amount exceeding Due Amount rejected client-side ${tags.regression} ${tags.negative} ${tags.p1}`, async ({
    paymentPage,
    purchaseWithDuePrerequisite,
  }) => {
    assertAdminCredentialsReady();

    const { supplierName, purchaseCode } = await purchaseWithDuePrerequisite();
    await paymentPage.gotoCreate();
    await paymentPage.selectSupplier(supplierName);
    await paymentPage.fillTransactionDate();

    const row = await paymentPage.invoices.addRow();
    await paymentPage.invoices.selectInvoiceForRow(row, purchaseCode);
    await paymentPage.expectAmountExceedsDueRejected(row);
  });

  test(`PROP-PAY-005 Edit Payment and verify persistence ${tags.regression} ${tags.p0}`, async ({
    paymentPage,
    purchaseWithDuePrerequisite,
  }) => {
    assertAdminCredentialsReady();

    const { supplierName, purchaseCode } = await purchaseWithDuePrerequisite();
    const code = await paymentPage.createPayment(supplierName, purchaseCode);

    await paymentPage.openEditFor(code);
    const updatedComments = `Updated ${Date.now()}`;
    await paymentPage.updateComments(updatedComments);

    await paymentPage.openEditFor(code);
    expect(await paymentPage.getComments()).toBe(updatedComments);
  });

  test(`PROP-PAY-006 Payment grid search filters by Code/Supplier ${tags.regression} ${tags.p2}`, async ({
    paymentPage,
    purchaseWithDuePrerequisite,
  }) => {
    assertAdminCredentialsReady();

    const { supplierName, purchaseCode } = await purchaseWithDuePrerequisite();
    const code = await paymentPage.createPayment(supplierName, purchaseCode);

    await paymentPage.goto();
    await paymentPage.grid.search(supplierName);
    await paymentPage.grid.waitForLoad();

    expect(await paymentPage.grid.rowCount()).toBeGreaterThanOrEqual(1);
    await expect(await paymentPage.grid.findRowByText(code)).toBeVisible();
  });
});
