import { test as e2eFixtureTest, E2EFixtures } from './e2e.fixture';
import { SupplierLedgerPage } from '../pages/reports/SupplierLedgerPage';

/**
 * Financial-lifecycle fixture — extends e2e.fixture.ts with exactly one
 * addition, supplierLedgerPage, for the cross-module E2E financial-lifecycle
 * flow (Login -> Supplier -> Product -> Purchase (with Due) -> Payment ->
 * Due reduction -> Supplier Ledger). Mirrors the exact same
 * one-file-per-extension pattern purchase-lifecycle.fixture.ts already uses
 * on top of transactions.fixture.ts, and e2e.fixture.ts already uses on top
 * of banking.fixture.ts: e2e.fixture.ts itself is untouched, so every
 * existing test importing it (or anything upstream of it) is unaffected by
 * this addition.
 *
 * WHY THIS FIXTURE EXISTS RATHER THAN REUSING purchase-lifecycle.fixture.ts
 * OR e2e.fixture.ts DIRECTLY: purchase-lifecycle.fixture.ts extends
 * transactions.fixture.ts (no paymentPage — that lives one layer up, in
 * banking.fixture.ts) and e2e.fixture.ts extends banking.fixture.ts (has
 * paymentPage, but no supplierLedgerPage). This flow needs both paymentPage
 * (already exposed by e2e.fixture.ts's own banking.fixture.ts base) and
 * supplierLedgerPage (not yet exposed anywhere above banking.fixture.ts) at
 * once — hence extending e2e.fixture.ts and adding just the one missing
 * piece, reusing the exact same SupplierLedgerPage class
 * purchase-lifecycle.fixture.ts already uses, not a new implementation.
 */
export interface FinancialLifecycleFixtures extends E2EFixtures {
  supplierLedgerPage: SupplierLedgerPage;
}

export const test = e2eFixtureTest.extend<FinancialLifecycleFixtures>({
  supplierLedgerPage: async ({ page }, use) => {
    await use(new SupplierLedgerPage(page));
  },
});

export { expect } from '@playwright/test';
