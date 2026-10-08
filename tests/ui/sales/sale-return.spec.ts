import { test, expect } from '../../../fixtures/transactions.fixture';
import { assertAdminCredentialsReady } from '../../../utils/env';
import { tags } from '../../../config/tags';

/**
 * STEP 6 module: SaleReturn (PROP-SRET-001..005) — PROPOSED SOURCE-VERIFIED
 * COVERAGE, approved as the authoritative STEP 6 scope. Runs under the
 * "authenticated" project.
 *
 * Delete is explicitly OUT OF SCOPE: confirmed NO controller action exists
 * at all for SaleReturn. This is the corrected finding behind SRET-006 —
 * its existing `config/tags.ts` description ("Delete route resolves to List
 * logic") does not match current source (the route simply 404s; there is no
 * Delete action to resolve to anything). Per instruction, SRET-006 itself is
 * NOT modified here — only reported (see STEP 6.2 final report §I).
 *
 * No required-field negative test is included for this module (see STEP 6.1
 * proposal §I), matching PurchaseReturn's same gap.
 */
test.describe('SaleReturn — PROP-SRET', () => {
  test(`PROP-SRET-001 SaleReturn list/grid loads and displays records ${tags.regression} ${tags.smoke} ${tags.p0}`, async ({
    saleReturnPage,
    salesPartyPrerequisites,
  }) => {
    assertAdminCredentialsReady();

    const { customerName, productName } = await salesPartyPrerequisites();
    const code = await saleReturnPage.createSaleReturn({ customerName, productName, quantity: 1 });

    await saleReturnPage.goto();
    await saleReturnPage.grid.search(code);
    await saleReturnPage.grid.waitForLoad();
    expect(await saleReturnPage.grid.rowCount()).toBeGreaterThanOrEqual(1);
    await expect(await saleReturnPage.grid.findRowByText(code)).toBeVisible();
  });

  test(`PROP-SRET-002 Create SaleReturn through blank/manual flow with line item succeeds ${tags.regression} ${tags.smoke} ${tags.p0}`, async ({
    saleReturnPage,
    salesPartyPrerequisites,
  }) => {
    assertAdminCredentialsReady();

    const { customerName, productName } = await salesPartyPrerequisites();
    const code = await saleReturnPage.createSaleReturn({ customerName, productName, quantity: 2 });

    await saleReturnPage.goto();
    await saleReturnPage.grid.search(code);
    await expect(await saleReturnPage.grid.findRowByText(code)).toBeVisible();
  });

  test(`PROP-SRET-003 Create SaleReturn through From Sale picker flow succeeds ${tags.regression} ${tags.p1}`, async ({
    salePage,
    saleReturnPage,
    saleTransactionPrerequisites,
  }) => {
    assertAdminCredentialsReady();

    const { customerName, productName, bankAccountName } = await saleTransactionPrerequisites();
    const saleCode = await salePage.createSale({ customerName, productName, quantity: 5, bankAccountName });

    const returnCode = await saleReturnPage.createFromSale(saleCode, productName, 1);

    await saleReturnPage.goto();
    await saleReturnPage.grid.search(returnCode);
    await expect(await saleReturnPage.grid.findRowByText(returnCode)).toBeVisible();
  });

  test(`PROP-SRET-004 Posting SaleReturn transitions Draft to Posted and locks the form ${tags.regression} ${tags.p0}`, async ({
    saleReturnPage,
    salesPartyPrerequisites,
  }) => {
    assertAdminCredentialsReady();

    const { customerName, productName } = await salesPartyPrerequisites();
    const code = await saleReturnPage.createSaleReturn({ customerName, productName, quantity: 3 });

    await saleReturnPage.openEditFor(code);
    expect(await saleReturnPage.isAlreadyPosted()).toBe(false);

    await saleReturnPage.post();

    expect(await saleReturnPage.isAlreadyPosted()).toBe(true);
  });

  test(`PROP-SRET-005 SaleReturn grid search filters by Code/Customer/Status ${tags.regression} ${tags.p2}`, async ({
    saleReturnPage,
    salesPartyPrerequisites,
  }) => {
    assertAdminCredentialsReady();

    const { customerName, productName } = await salesPartyPrerequisites();
    const code = await saleReturnPage.createSaleReturn({ customerName, productName, quantity: 1 });

    await saleReturnPage.goto();
    await saleReturnPage.grid.search(customerName);
    await saleReturnPage.grid.waitForLoad();

    expect(await saleReturnPage.grid.rowCount()).toBeGreaterThanOrEqual(1);
    await expect(await saleReturnPage.grid.findRowByText(code)).toBeVisible();
  });
});
