import { test as bankingFixtureTest, BankingFixtures } from './banking.fixture';
import { ReportPage } from '../pages/reports/ReportPage';

/**
 * E2E fixture — extends banking.fixture.ts with exactly one addition,
 * reportPage, for the cross-module E2E sales-lifecycle flow (Login ->
 * Customer -> Product -> SaleOrder -> Sale -> Collection -> Due -> Report ->
 * Logout — see the E2E design record). Mirrors the same one-file-per-
 * extension pattern already used by masters.fixture.ts -> transactions.
 * fixture.ts -> banking.fixture.ts: banking.fixture.ts itself is untouched,
 * so every existing test importing it (or anything upstream of it) is
 * unaffected by this addition. NOT part of the approved 267-test coverage
 * baseline (config/coverage-baseline.ts).
 */
export interface E2EFixtures extends BankingFixtures {
  reportPage: ReportPage;
}

export const test = bankingFixtureTest.extend<E2EFixtures>({
  reportPage: async ({ page }, use) => {
    await use(new ReportPage(page));
  },
});

export { expect } from '@playwright/test';
