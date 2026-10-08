import { test, expect } from '../../../fixtures/transactions.fixture';
import { assertAdminCredentialsReady } from '../../../utils/env';
import { uniqueCode } from '../../../utils/random-data';
import { tags } from '../../../config/tags';

/**
 * STEP 6 module: PurchaseReturn (PROP-PRET-001..005) — PROPOSED
 * SOURCE-VERIFIED COVERAGE, approved as the authoritative STEP 6 scope.
 * Runs under the "authenticated" project.
 *
 * Delete is explicitly OUT OF SCOPE: confirmed no `.btnDelete` markup exists
 * anywhere in PurchaseReturn/Index.cshtml, not even commented out — stricter
 * absence than every other module checked so far.
 *
 * No required-field negative test is included for this module (see STEP 6.1
 * proposal §G) — PurchaseReturnVM's exact [Required] set was not confirmed
 * with the same rigor as Purchase's own VM during source verification.
 */
test.describe('PurchaseReturn — PROP-PRET', () => {
  test(`PROP-PRET-001 PurchaseReturn list/grid loads and displays records ${tags.regression} ${tags.smoke} ${tags.p0}`, async ({
    purchaseReturnPage,
    purchasePartyPrerequisites,
  }) => {
    assertAdminCredentialsReady();

    const { supplierName, productName } = await purchasePartyPrerequisites();
    const code = await purchaseReturnPage.createPurchaseReturn({
      supplierName,
      beNumber: uniqueCode('PRET'),
      productName,
      quantity: 2,
    });

    await purchaseReturnPage.goto();
    await purchaseReturnPage.grid.search(code);
    await purchaseReturnPage.grid.waitForLoad();
    expect(await purchaseReturnPage.grid.rowCount()).toBeGreaterThanOrEqual(1);
    await expect(await purchaseReturnPage.grid.findRowByText(code)).toBeVisible();
  });

  test(`PROP-PRET-002 Create PurchaseReturn through blank/manual flow with line item succeeds ${tags.regression} ${tags.smoke} ${tags.p0}`, async ({
    purchaseReturnPage,
    purchasePartyPrerequisites,
  }) => {
    assertAdminCredentialsReady();

    const { supplierName, productName } = await purchasePartyPrerequisites();
    const code = await purchaseReturnPage.createPurchaseReturn({
      supplierName,
      beNumber: uniqueCode('PRET'),
      productName,
      quantity: 1,
    });

    await purchaseReturnPage.goto();
    await purchaseReturnPage.grid.search(code);
    await expect(await purchaseReturnPage.grid.findRowByText(code)).toBeVisible();
  });

  test(`PROP-PRET-003 Create PurchaseReturn through From Purchase picker flow succeeds ${tags.regression} ${tags.p1}`, async ({
    purchasePage,
    purchaseReturnPage,
    purchasePartyPrerequisites,
  }) => {
    assertAdminCredentialsReady();

    const { supplierName, productName } = await purchasePartyPrerequisites();
    // FULL-REGRESSION-RUN FIX (confirmed automation defect): PurchasePage's
    // own `#BENumber` is confirmed live as `<input type="number">` —
    // `uniqueCode('PUR')` (letters + underscores) fails outright with
    // "Cannot type text into input[type=number]", unlike this file's own
    // `beNumber: uniqueCode('PRET')` calls elsewhere (PurchaseReturn's OWN
    // BE Number field, confirmed live to accept non-numeric text fine — a
    // different field, not the same bug). `String(Date.now())` matches the
    // same purely-numeric fix already proven in `purchase.spec.ts`/
    // `purchase-lifecycle.spec.ts`/`banking.fixture.ts` for this exact field.
    const purchaseCode = await purchasePage.createPurchase({
      supplierName,
      beNumber: String(Date.now()),
      productName,
      quantity: 5,
    });

    const returnCode = await purchaseReturnPage.createFromPurchase(purchaseCode, productName, 1);

    await purchaseReturnPage.goto();
    await purchaseReturnPage.grid.search(returnCode);
    await expect(await purchaseReturnPage.grid.findRowByText(returnCode)).toBeVisible();
  });

  test(`PROP-PRET-004 Posting PurchaseReturn transitions Draft to Posted and locks the form ${tags.regression} ${tags.p0}`, async ({
    purchaseReturnPage,
    purchasePartyPrerequisites,
  }) => {
    assertAdminCredentialsReady();

    const { supplierName, productName } = await purchasePartyPrerequisites();
    const code = await purchaseReturnPage.createPurchaseReturn({
      supplierName,
      beNumber: uniqueCode('PRET'),
      productName,
      quantity: 3,
    });

    await purchaseReturnPage.openEditFor(code);
    expect(await purchaseReturnPage.isAlreadyPosted()).toBe(false);

    await purchaseReturnPage.post();

    expect(await purchaseReturnPage.isAlreadyPosted()).toBe(true);
  });

  test(`PROP-PRET-005 PurchaseReturn grid search filters by Code/Supplier/BE Number ${tags.regression} ${tags.p2}`, async ({
    purchaseReturnPage,
    purchasePartyPrerequisites,
  }) => {
    assertAdminCredentialsReady();

    const { supplierName, productName } = await purchasePartyPrerequisites();
    const beNumber = uniqueCode('PRET');
    const code = await purchaseReturnPage.createPurchaseReturn({ supplierName, beNumber, productName, quantity: 1 });

    await purchaseReturnPage.goto();
    await purchaseReturnPage.grid.search(beNumber);
    await purchaseReturnPage.grid.waitForLoad();

    expect(await purchaseReturnPage.grid.rowCount()).toBeGreaterThanOrEqual(1);
    await expect(await purchaseReturnPage.grid.findRowByText(code)).toBeVisible();
  });
});
