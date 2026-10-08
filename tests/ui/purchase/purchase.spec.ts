import { test, expect } from '../../../fixtures/transactions.fixture';
import { assertAdminCredentialsReady } from '../../../utils/env';
import { tags } from '../../../config/tags';

/**
 * STEP 6 module: Purchase (PROP-PUR-001..008) — PROPOSED SOURCE-VERIFIED
 * COVERAGE, approved as the authoritative STEP 6 scope (see the STEP 6.1
 * chat record; the original STEP 2 matrix for this module could not be
 * recovered). Runs under the "authenticated" project.
 *
 * Delete is explicitly OUT OF SCOPE (STEP 6 approved decision): the Delete
 * controller action exists but has zero UI wiring — no button anywhere in
 * Purchase/Index.cshtml, not even commented out.
 *
 * FULL-REGRESSION-RUN FIX (confirmed automation defect, not an application
 * issue — see tests/ui/e2e/purchase-lifecycle.spec.ts's own doc comment,
 * which already predicted this exact incompatibility before it was ever
 * live-exercised): every `beNumber`/`fillBeNumber(...)` call in this file
 * previously used `uniqueCode('PUR')` (letters + underscores) — `#BENumber`
 * is confirmed live as `<input type="number">`, and Playwright's `.fill()`
 * refuses to type non-numeric text into one at all ("Cannot type text into
 * input[type=number]"), failing every test in this file outright the first
 * time it was actually run against a live UI. Replaced with `String(Date.now())`,
 * the same purely-numeric, still-effectively-unique value
 * `purchase-lifecycle.spec.ts`/`banking.fixture.ts` already use for this
 * exact field.
 */
function uniqueBeNumber(): string {
  return String(Date.now());
}

test.describe('Purchase — PROP-PUR', () => {
  test(`PROP-PUR-001 Purchase list/grid loads and displays records ${tags.regression} ${tags.smoke} ${tags.p0}`, async ({
    purchasePage,
    purchasePartyPrerequisites,
  }) => {
    assertAdminCredentialsReady();

    const { supplierName, productName } = await purchasePartyPrerequisites();
    const code = await purchasePage.createPurchase({
      supplierName,
      beNumber: uniqueBeNumber(),
      productName,
      quantity: 5,
    });

    await purchasePage.goto();
    await purchasePage.grid.search(code);
    await purchasePage.grid.waitForLoad();
    expect(await purchasePage.grid.rowCount()).toBeGreaterThanOrEqual(1);
    await expect(await purchasePage.grid.findRowByText(code)).toBeVisible();
  });

  test(`PROP-PUR-002 Create Purchase with required header fields + one line item succeeds ${tags.regression} ${tags.smoke} ${tags.p0}`, async ({
    purchasePage,
    purchasePartyPrerequisites,
  }) => {
    assertAdminCredentialsReady();

    const { supplierName, productName } = await purchasePartyPrerequisites();
    const beNumber = uniqueBeNumber();
    const code = await purchasePage.createPurchase({ supplierName, beNumber, productName, quantity: 3 });

    // Verify actual persistence, not just the toast.
    await purchasePage.goto();
    await purchasePage.grid.search(code);
    await expect(await purchasePage.grid.findRowByText(code)).toBeVisible();
  });

  test(`PROP-PUR-003 Create Purchase without Supplier is rejected ${tags.regression} ${tags.negative} ${tags.p1}`, async ({
    purchasePage,
    page,
  }) => {
    assertAdminCredentialsReady();

    await purchasePage.gotoCreate();
    await purchasePage.fillBeNumber(uniqueBeNumber());
    await purchasePage.fillDates();
    // Supplier deliberately left unselected — no line item needed to
    // exercise this specific validation path.
    await purchasePage.clickSave();

    await purchasePage.expectSupplierRequiredIndicated();
    await expect(page).toHaveURL(/\/DMS\/Purchase\/Create/i);
  });

  test(`PROP-PUR-004 Create Purchase without BE Number/Challan No. is rejected ${tags.regression} ${tags.negative} ${tags.p1}`, async ({
    purchasePage,
    purchasePartyPrerequisites,
    page,
  }) => {
    assertAdminCredentialsReady();

    const { supplierName } = await purchasePartyPrerequisites();
    await purchasePage.gotoCreate();
    await purchasePage.selectSupplier(supplierName);
    await purchasePage.fillDates();
    // BE Number deliberately left empty.
    await purchasePage.clickSave();

    await purchasePage.expectBeNumberRequiredIndicated();
    await expect(page).toHaveURL(/\/DMS\/Purchase\/Create/i);
  });

  test(`PROP-PUR-005 Adding a line item with negative Quantity is rejected client-side ${tags.regression} ${tags.negative} ${tags.p1}`, async ({
    purchasePage,
    purchasePartyPrerequisites,
  }) => {
    assertAdminCredentialsReady();

    const { supplierName, productName } = await purchasePartyPrerequisites();
    await purchasePage.gotoCreate();
    await purchasePage.selectSupplier(supplierName);
    await purchasePage.fillBeNumber(uniqueBeNumber());
    await purchasePage.fillDates();

    const row = await purchasePage.lineItems.addRow();
    await purchasePage.lineItems.selectProductForRow(row, productName);
    await purchasePage.expectNegativeQuantityRejected(row);
  });

  test(`PROP-PUR-006 Edit saved unposted Purchase and verify persistence ${tags.regression} ${tags.p0}`, async ({
    purchasePage,
    purchasePartyPrerequisites,
  }) => {
    assertAdminCredentialsReady();

    const { supplierName, productName } = await purchasePartyPrerequisites();
    const code = await purchasePage.createPurchase({
      supplierName,
      beNumber: uniqueBeNumber(),
      productName,
      quantity: 2,
    });

    await purchasePage.openEditFor(code);
    const updatedBeNumber = uniqueBeNumber();
    await purchasePage.updateBeNumber(updatedBeNumber);

    // Re-open the grid (fresh navigation) and confirm the NEW BE Number persisted.
    await purchasePage.goto();
    await purchasePage.grid.search(updatedBeNumber);
    await expect(await purchasePage.grid.findRowByText(updatedBeNumber)).toBeVisible();
  });

  test(`PROP-PUR-007 Posting Purchase transitions Draft to Posted and locks the form ${tags.regression} ${tags.p0}`, async ({
    purchasePage,
    purchasePartyPrerequisites,
  }) => {
    assertAdminCredentialsReady();

    const { supplierName, productName } = await purchasePartyPrerequisites();
    const code = await purchasePage.createPurchase({
      supplierName,
      beNumber: uniqueBeNumber(),
      productName,
      quantity: 4,
    });

    await purchasePage.openEditFor(code);
    expect(await purchasePage.isAlreadyPosted()).toBe(false);

    await purchasePage.post();

    expect(await purchasePage.isAlreadyPosted()).toBe(true);
  });

  test(`PROP-PUR-008 Purchase grid search filters by Code/Supplier/BE Number ${tags.regression} ${tags.p2}`, async ({
    purchasePage,
    purchasePartyPrerequisites,
  }) => {
    assertAdminCredentialsReady();

    const { supplierName, productName } = await purchasePartyPrerequisites();
    const beNumber = uniqueBeNumber();
    const code = await purchasePage.createPurchase({ supplierName, beNumber, productName, quantity: 1 });

    await purchasePage.goto();
    await purchasePage.grid.search(beNumber);
    await purchasePage.grid.waitForLoad();

    expect(await purchasePage.grid.rowCount()).toBeGreaterThanOrEqual(1);
    await expect(await purchasePage.grid.findRowByText(code)).toBeVisible();
  });
});
