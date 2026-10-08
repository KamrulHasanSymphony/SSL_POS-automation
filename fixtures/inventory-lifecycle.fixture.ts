import { test as transactionsFixtureTest, TransactionFixtures } from './transactions.fixture';
import { StockReportPage } from '../pages/reports/StockReportPage';

/**
 * Inventory/Stock-lifecycle fixture — extends transactions.fixture.ts with
 * exactly one addition, stockReportPage, for the cross-module E2E
 * inventory-lifecycle flow (Login -> Product + Opening Stock -> Stock
 * Increase Verification -> Purchase -> Stock Ledger -> Stock Report).
 * Mirrors purchase-lifecycle.fixture.ts's identical one-file-per-extension
 * pattern rather than importing that file directly — this flow has no
 * dependency on SupplierLedgerPage, so it is not pulled in.
 * transactions.fixture.ts itself is untouched, so every existing test
 * importing it (or anything upstream of it) is unaffected by this addition.
 * Not part of the approved coverage baseline (config/coverage-baseline.ts).
 */
export interface InventoryLifecycleFixtures extends TransactionFixtures {
  stockReportPage: StockReportPage;
}

export const test = transactionsFixtureTest.extend<InventoryLifecycleFixtures>({
  stockReportPage: async ({ page }, use) => {
    await use(new StockReportPage(page));
  },
});

export { expect } from '@playwright/test';
