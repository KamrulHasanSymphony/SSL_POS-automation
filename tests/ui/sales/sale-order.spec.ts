import { test, expect } from '../../../fixtures/transactions.fixture';
import { assertAdminCredentialsReady } from '../../../utils/env';
import { tags } from '../../../config/tags';

/**
 * STEP 6 module: SaleOrder (PROP-SO-001..007) — PROPOSED SOURCE-VERIFIED
 * COVERAGE, approved as the authoritative STEP 6 scope. Runs under the
 * "authenticated" project.
 *
 * ⚠️ CONFIRMED HIGH-RISK APPLICATION DEFECT (STEP 6.1 §M.1, preserved here
 * deliberately — see SaleOrderPage.ts): `SaleOrderController.js`'s save()
 * posts to `/POS/SaleOrder/CreateEdit`, a route that does not exist anywhere
 * in this codebase. PROP-SO-002/PROP-SO-005 exercise the real UI exactly as
 * a user would; if they fail because of this, that is a genuine Application
 * Defect, not an Automation Issue — do not "fix" this page object to point
 * at a different URL to force a pass.
 *
 * Delete is explicitly OUT OF SCOPE: the Delete controller action exists but
 * has zero UI wiring.
 */
test.describe('SaleOrder — PROP-SO', () => {
  test(`PROP-SO-001 SaleOrder list/grid loads and displays records ${tags.regression} ${tags.smoke} ${tags.p0}`, async ({
    saleOrderPage,
    salesPartyPrerequisites,
  }) => {
    assertAdminCredentialsReady();

    const { customerName, productName } = await salesPartyPrerequisites();
    const code = await saleOrderPage.createSaleOrder({ customerName, productName, quantity: 2 });

    await saleOrderPage.goto();
    await saleOrderPage.grid.search(code);
    await saleOrderPage.grid.waitForLoad();
    expect(await saleOrderPage.grid.rowCount()).toBeGreaterThanOrEqual(1);
    await expect(await saleOrderPage.grid.findRowByText(code)).toBeVisible();
  });

  test(`PROP-SO-002 Create SaleOrder with required header fields + line item ${tags.regression} ${tags.smoke} ${tags.p0}`, async ({
    saleOrderPage,
    salesPartyPrerequisites,
  }) => {
    assertAdminCredentialsReady();

    const { customerName, productName } = await salesPartyPrerequisites();
    const code = await saleOrderPage.createSaleOrder({ customerName, productName, quantity: 1 });

    await saleOrderPage.goto();
    await saleOrderPage.grid.search(code);
    await expect(await saleOrderPage.grid.findRowByText(code)).toBeVisible();
  });

  test(`PROP-SO-003 Create SaleOrder without Customer is rejected ${tags.regression} ${tags.negative} ${tags.p1}`, async ({
    saleOrderPage,
    page,
  }) => {
    assertAdminCredentialsReady();

    await saleOrderPage.gotoCreate();
    await saleOrderPage.fillDates();
    // Customer deliberately left unselected.
    await saleOrderPage.clickSave();

    await saleOrderPage.expectCustomerRequiredIndicated();
    await expect(page).toHaveURL(/\/DMS\/SaleOrder\/Create/i);
  });

  test(`PROP-SO-004 Create SaleOrder without Order Date is rejected ${tags.regression} ${tags.negative} ${tags.p1}`, async ({
    saleOrderPage,
    salesPartyPrerequisites,
    page,
  }) => {
    assertAdminCredentialsReady();

    const { customerName } = await salesPartyPrerequisites();
    await saleOrderPage.gotoCreate();
    await saleOrderPage.selectCustomer(customerName);
    // Order Date deliberately left empty.
    await saleOrderPage.clickSave();

    await saleOrderPage.expectOrderDateRequiredValidation();
    await expect(page).toHaveURL(/\/DMS\/SaleOrder\/Create/i);
  });

  test(`PROP-SO-005 Edit saved unposted SaleOrder and verify persistence ${tags.regression} ${tags.p0}`, async ({
    saleOrderPage,
    salesPartyPrerequisites,
  }) => {
    assertAdminCredentialsReady();

    const { customerName, productName } = await salesPartyPrerequisites();
    const code = await saleOrderPage.createSaleOrder({ customerName, productName, quantity: 2 });

    await saleOrderPage.openEditFor(code);
    const { customerName: newCustomerName } = await salesPartyPrerequisites();
    await saleOrderPage.selectCustomer(newCustomerName);
    await saleOrderPage.clickUpdate();
    await saleOrderPage.toastr.expectSuccess();

    await saleOrderPage.goto();
    await saleOrderPage.grid.search(code);
    const row = await saleOrderPage.grid.findRowByText(code);
    await expect(row).toContainText(newCustomerName);
  });

  test(`PROP-SO-006 Posting SaleOrder transitions Draft to Posted and locks the form ${tags.regression} ${tags.p0}`, async ({
    saleOrderPage,
    salesPartyPrerequisites,
  }) => {
    assertAdminCredentialsReady();

    const { customerName, productName } = await salesPartyPrerequisites();
    const code = await saleOrderPage.createSaleOrder({ customerName, productName, quantity: 3 });

    await saleOrderPage.openEditFor(code);
    expect(await saleOrderPage.isAlreadyPosted()).toBe(false);

    await saleOrderPage.post();

    expect(await saleOrderPage.isAlreadyPosted()).toBe(true);
  });

  test(`PROP-SO-007 SaleOrder grid search filters by Code/Customer ${tags.regression} ${tags.p2}`, async ({
    saleOrderPage,
    salesPartyPrerequisites,
  }) => {
    assertAdminCredentialsReady();

    const { customerName, productName } = await salesPartyPrerequisites();
    const code = await saleOrderPage.createSaleOrder({ customerName, productName, quantity: 1 });

    await saleOrderPage.goto();
    await saleOrderPage.grid.search(customerName);
    await saleOrderPage.grid.waitForLoad();

    expect(await saleOrderPage.grid.rowCount()).toBeGreaterThanOrEqual(1);
    await expect(await saleOrderPage.grid.findRowByText(code)).toBeVisible();
  });
});
