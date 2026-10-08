import { test as multiBranchLifecycleFixtureTest, MultiBranchLifecycleFixtures } from './multi-branch-lifecycle.fixture';
import { BankTransactionStatementPage } from '../pages/reports/BankTransactionStatementPage';

/**
 * Accounting-ledger-lifecycle fixture — extends multi-branch-lifecycle.fixture.ts
 * with exactly one addition, bankTransactionStatementPage, for the
 * cross-module E2E accounting/ledger lifecycle flow (Supplier/Customer/
 * Product -> Purchase -> Purchase Post -> Supplier Ledger -> Sale -> Sale
 * Post -> Customer Sale & Collection Report -> Collection -> Customer
 * outstanding decrease -> Bank Transaction Statement). Chosen as the base
 * (rather than a shallower fixture) purely because it already carries every
 * other page object this flow needs — supplierPage/customerPage/productPage
 * +prerequisites, bankAccountSetupPage, purchasePage, salePage,
 * collectionPage, supplierLedgerPage, customerSaleCollectionReportPage —
 * with no other extension point closer to the root providing that exact
 * combination. Mirrors the same one-file-per-extension pattern every other
 * lifecycle fixture in this project already uses — multi-branch-lifecycle.fixture.ts
 * itself is untouched, so every existing test importing it (or anything
 * upstream of it) is unaffected by this addition. Not part of the approved
 * coverage baseline (config/coverage-baseline.ts).
 */
export interface AccountingLedgerLifecycleFixtures extends MultiBranchLifecycleFixtures {
  bankTransactionStatementPage: BankTransactionStatementPage;
}

export const test = multiBranchLifecycleFixtureTest.extend<AccountingLedgerLifecycleFixtures>({
  bankTransactionStatementPage: async ({ page }, use) => {
    await use(new BankTransactionStatementPage(page));
  },
});

export { expect } from '@playwright/test';
