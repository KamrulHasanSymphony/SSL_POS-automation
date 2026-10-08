import { test as customerCollectionLifecycleFixtureTest, CustomerCollectionLifecycleFixtures } from './customer-collection-lifecycle.fixture';
import { StockReportPage } from '../pages/reports/StockReportPage';

/**
 * Sale-return-lifecycle fixture — extends customer-collection-lifecycle.fixture.ts
 * with exactly one addition, stockReportPage, for the cross-module E2E
 * sale-return-lifecycle flow (Login -> Customer -> Product -> Sale -> Sale
 * Post -> Stock decrease -> Sale Return (from Sale) -> Sale Return Post ->
 * Stock increase -> Customer Sale & Collection Report). Mirrors the exact
 * same one-file-per-extension pattern purchase-lifecycle.fixture.ts already
 * uses on top of transactions.fixture.ts (adding stockReportPage +
 * supplierLedgerPage there): customer-collection-lifecycle.fixture.ts itself
 * is untouched, so every existing test importing it (or anything upstream of
 * it) is unaffected by this addition.
 *
 * customer-collection-lifecycle.fixture.ts already exposes every other page
 * object this flow needs (salePage, saleReturnPage — both from
 * transactions.fixture.ts further upstream — collectionPage from
 * banking.fixture.ts, customerSaleCollectionReportPage — its own addition)
 * — stockReportPage (from StockIndex/ProductController, see
 * StockReportPage.ts's own class doc comment) is the one missing piece,
 * needed here for the Stock Decrease/Increase verification steps.
 */
export interface SaleReturnLifecycleFixtures extends CustomerCollectionLifecycleFixtures {
  stockReportPage: StockReportPage;
}

export const test = customerCollectionLifecycleFixtureTest.extend<SaleReturnLifecycleFixtures>({
  stockReportPage: async ({ page }, use) => {
    await use(new StockReportPage(page));
  },
});

export { expect } from '@playwright/test';
