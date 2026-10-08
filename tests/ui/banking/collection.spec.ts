import { test, expect } from '../../../fixtures/banking.fixture';
import { assertAdminCredentialsReady } from '../../../utils/env';
import { tags } from '../../../config/tags';

/**
 * STEP 7 module: Collection (PROP-COL-001..006), approved STEP 7 scope.
 * Runs under the "authenticated" project.
 *
 * Delete is explicitly OUT OF SCOPE: action exists, zero UI trigger — no
 * `.btnDelete` anywhere, not even commented out. No Post/Draft test:
 * confirmed no working Post workflow for this module.
 *
 * Prerequisite chain (§7.1/7.2): Product -> Customer -> Bank/BankAccount ->
 * Sale (with a deliberately partial payment so a Due balance remains) ->
 * Collection against that Sale. See banking.fixture.ts's
 * `saleWithDuePrerequisite` doc comment for the one flagged assumption in
 * this chain (Sale's exact partial-payment rule was not independently
 * confirmed).
 */
test.describe('Collection — PROP-COL', () => {
  test(`PROP-COL-001 Collection list/grid loads and displays records ${tags.regression} ${tags.smoke} ${tags.p0}`, async ({
    collectionPage,
    saleWithDuePrerequisite,
  }) => {
    assertAdminCredentialsReady();

    const { customerName, saleCode } = await saleWithDuePrerequisite();
    const code = await collectionPage.createCollection(customerName, saleCode);

    await collectionPage.goto();
    await collectionPage.grid.search(code);
    await collectionPage.grid.waitForLoad();
    expect(await collectionPage.grid.rowCount()).toBeGreaterThanOrEqual(1);
    await expect(await collectionPage.grid.findRowByText(code)).toBeVisible();
  });

  test(`PROP-COL-002 Create Collection against existing Sale with amount <= Due Amount succeeds ${tags.regression} ${tags.smoke} ${tags.p0}`, async ({
    collectionPage,
    saleWithDuePrerequisite,
  }) => {
    assertAdminCredentialsReady();

    const { customerName, saleCode } = await saleWithDuePrerequisite();
    const code = await collectionPage.createCollection(customerName, saleCode);

    await collectionPage.goto();
    await collectionPage.grid.search(code);
    await expect(await collectionPage.grid.findRowByText(code)).toBeVisible();
  });

  test(`PROP-COL-003 Collection without Customer rejected ${tags.regression} ${tags.negative} ${tags.p1}`, async ({
    collectionPage,
    page,
  }) => {
    assertAdminCredentialsReady();

    await collectionPage.gotoCreate();
    await collectionPage.fillTransactionDate();
    // Customer deliberately left unselected — no line item needed to
    // exercise this specific validation path.
    await collectionPage.clickSave();

    await collectionPage.expectCustomerRequiredIndicated();
    await expect(page).toHaveURL(/\/DMS\/Collection\/Create/i);
  });

  test(`PROP-COL-004 Collection amount exceeding Due Amount rejected client-side ${tags.regression} ${tags.negative} ${tags.p1}`, async ({
    collectionPage,
    saleWithDuePrerequisite,
  }) => {
    assertAdminCredentialsReady();

    const { customerName, saleCode } = await saleWithDuePrerequisite();
    await collectionPage.gotoCreate();
    await collectionPage.selectCustomer(customerName);
    await collectionPage.fillTransactionDate();

    const row = await collectionPage.invoices.addRow();
    await collectionPage.invoices.selectInvoiceForRow(row, saleCode);
    await collectionPage.expectAmountExceedsDueRejected(row);
  });

  test(`PROP-COL-005 Edit Collection and verify persistence ${tags.regression} ${tags.p0}`, async ({
    collectionPage,
    saleWithDuePrerequisite,
  }) => {
    assertAdminCredentialsReady();

    const { customerName, saleCode } = await saleWithDuePrerequisite();
    const code = await collectionPage.createCollection(customerName, saleCode);

    await collectionPage.openEditFor(code);
    const updatedComments = `Updated ${Date.now()}`;
    await collectionPage.updateComments(updatedComments);

    await collectionPage.openEditFor(code);
    expect(await collectionPage.getComments()).toBe(updatedComments);
  });

  test(`PROP-COL-006 Collection grid search filters by Code/Customer ${tags.regression} ${tags.p2}`, async ({
    collectionPage,
    saleWithDuePrerequisite,
  }) => {
    assertAdminCredentialsReady();

    const { customerName, saleCode } = await saleWithDuePrerequisite();
    const code = await collectionPage.createCollection(customerName, saleCode);

    await collectionPage.goto();
    await collectionPage.grid.search(customerName);
    await collectionPage.grid.waitForLoad();

    expect(await collectionPage.grid.rowCount()).toBeGreaterThanOrEqual(1);
    await expect(await collectionPage.grid.findRowByText(code)).toBeVisible();
  });
});
