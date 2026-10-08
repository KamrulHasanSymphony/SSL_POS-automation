import { test as transactionsFixtureTest, TransactionFixtures } from './transactions.fixture';
import { StockReportPage } from '../pages/reports/StockReportPage';
import { SupplierLedgerPage } from '../pages/reports/SupplierLedgerPage';

/**
 * Purchase-lifecycle fixture — extends transactions.fixture.ts with exactly
 * two additions, stockReportPage and supplierLedgerPage, for the
 * cross-module E2E purchase-lifecycle flow (Login -> Supplier -> Product ->
 * Purchase Order -> Purchase (via From Purchase Order) -> Stock -> Supplier
 * Ledger). Mirrors the exact same one-file-per-extension pattern
 * e2e.fixture.ts already uses on top of banking.fixture.ts:
 * transactions.fixture.ts itself is untouched, so every existing test
 * importing it (or anything upstream of it) is unaffected by this addition.
 * Not part of the approved coverage baseline (config/coverage-baseline.ts).
 */
export interface PurchaseLifecycleFixtures extends TransactionFixtures {
  stockReportPage: StockReportPage;
  supplierLedgerPage: SupplierLedgerPage;
}

export const test = transactionsFixtureTest.extend<PurchaseLifecycleFixtures>({
  stockReportPage: async ({ page }, use) => {
    await use(new StockReportPage(page));
  },
  supplierLedgerPage: async ({ page }, use) => {
    await use(new SupplierLedgerPage(page));
  },
});

export { expect } from '@playwright/test';
