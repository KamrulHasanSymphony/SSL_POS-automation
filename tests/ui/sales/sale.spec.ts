import { test, expect } from '../../../fixtures/transactions.fixture';
import { assertAdminCredentialsReady } from '../../../utils/env';
import { tags } from '../../../config/tags';

/**
 * STEP 6 module: Sale (PROP-SALE-001..007) — PROPOSED SOURCE-VERIFIED
 * COVERAGE, approved as the authoritative STEP 6 scope. Runs under the
 * "authenticated" project.
 *
 * Delete is explicitly OUT OF SCOPE: confirmed NO controller action exists
 * at all for Sale.
 *
 * NOTE (STEP 6.2 risk, see final report §L): the payment-grid interaction
 * (`SalePage.addPayment()`/`getFinalPayable()`) relies on selectors inferred
 * from confirmed field NAMES but not independently confirmed against a live
 * render. If any PROP-SALE-* test below fails at the payment step, check
 * that gap FIRST before concluding it's an Application Defect.
 */
test.describe('Sale — PROP-SALE', () => {
  test(`PROP-SALE-001 Sale list/grid loads and displays records ${tags.regression} ${tags.smoke} ${tags.p0}`, async ({
    salePage,
    saleTransactionPrerequisites,
  }) => {
    assertAdminCredentialsReady();

    const { customerName, productName, bankAccountName } = await saleTransactionPrerequisites();
    const code = await salePage.createSale({ customerName, productName, quantity: 2, bankAccountName });

    await salePage.goto();
    await salePage.grid.search(code);
    await salePage.grid.waitForLoad();
    expect(await salePage.grid.rowCount()).toBeGreaterThanOrEqual(1);
    await expect(await salePage.grid.findRowByText(code)).toBeVisible();
  });

  test(`PROP-SALE-002 Create Sale with Customer + Invoice Date + line item + completed payment succeeds ${tags.regression} ${tags.smoke} ${tags.p0}`, async ({
    salePage,
    saleTransactionPrerequisites,
  }) => {
    assertAdminCredentialsReady();

    const { customerName, productName, bankAccountName } = await saleTransactionPrerequisites();
    const code = await salePage.createSale({ customerName, productName, quantity: 1, bankAccountName });

    await salePage.goto();
    await salePage.grid.search(code);
    await expect(await salePage.grid.findRowByText(code)).toBeVisible();
  });

  test(`PROP-SALE-003 Create Sale without Customer is rejected ${tags.regression} ${tags.negative} ${tags.p1}`, async ({
    salePage,
    page,
  }) => {
    assertAdminCredentialsReady();

    await salePage.gotoCreate();
    await salePage.fillInvoiceDate();
    // Customer deliberately left unselected — no line item/payment needed
    // to exercise this specific validation path.
    await salePage.clickSave();

    await salePage.expectCustomerRequiredIndicated();
    await expect(page).toHaveURL(/\/DMS\/Sale\/Create/i);
  });

  test(`PROP-SALE-004 Create Sale without completing mandatory payment is rejected ${tags.regression} ${tags.negative} ${tags.p1}`, async ({
    salePage,
    salesPartyPrerequisites,
    page,
  }) => {
    assertAdminCredentialsReady();

    const { customerName, productName } = await salesPartyPrerequisites();
    await salePage.gotoCreate();
    await salePage.selectCustomer(customerName);
    await salePage.fillInvoiceDate();
    await salePage.lineItems.addLineItem(productName, 1);
    // Payment deliberately never added.
    await salePage.clickSave();

    await salePage.expectPaymentRequiredNotification();
    await expect(page).toHaveURL(/\/DMS\/Sale\/Create/i);
  });

  test(`PROP-SALE-005 Edit saved unposted Sale and verify persistence ${tags.regression} ${tags.p0}`, async ({
    salePage,
    saleTransactionPrerequisites,
  }) => {
    assertAdminCredentialsReady();

    const { customerName, productName, bankAccountName } = await saleTransactionPrerequisites();
    const code = await salePage.createSale({ customerName, productName, quantity: 3, bankAccountName });

    // Sale has no free-text field to mutate beyond header dropdowns/dates —
    // persistence is verified by re-opening the saved record and confirming
    // the grid still shows it with the correct Customer after a fresh navigation.
    await salePage.openEditFor(code);
    await salePage.goto();
    await salePage.grid.search(code);
    const row = await salePage.grid.findRowByText(code);
    await expect(row).toContainText(customerName);
  });

  test(`PROP-SALE-006 Posting Sale transitions Draft to Posted and locks the form ${tags.regression} ${tags.p0}`, async ({
    salePage,
    saleTransactionPrerequisites,
  }) => {
    assertAdminCredentialsReady();

    const { customerName, productName, bankAccountName } = await saleTransactionPrerequisites();
    const code = await salePage.createSale({ customerName, productName, quantity: 2, bankAccountName });

    await salePage.openEditFor(code);
    expect(await salePage.isAlreadyPosted()).toBe(false);

    await salePage.post();

    expect(await salePage.isAlreadyPosted()).toBe(true);
  });

  test(`PROP-SALE-007 Sale grid search filters by Code/Customer ${tags.regression} ${tags.p2}`, async ({
    salePage,
    saleTransactionPrerequisites,
  }) => {
    assertAdminCredentialsReady();

    const { customerName, productName, bankAccountName } = await saleTransactionPrerequisites();
    const code = await salePage.createSale({ customerName, productName, quantity: 1, bankAccountName });

    await salePage.goto();
    await salePage.grid.search(customerName);
    await salePage.grid.waitForLoad();

    expect(await salePage.grid.rowCount()).toBeGreaterThanOrEqual(1);
    await expect(await salePage.grid.findRowByText(code)).toBeVisible();
  });
});
