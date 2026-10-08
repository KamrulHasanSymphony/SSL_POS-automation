import { test as saleReturnLifecycleFixtureTest, SaleReturnLifecycleFixtures } from './sale-return-lifecycle.fixture';
import { BranchProfilePage } from '../pages/masters/BranchProfilePage';
import { UserProfilePage } from '../pages/setup/UserProfilePage';
import { UserBranchProfilePage } from '../pages/setup/UserBranchProfilePage';
import { SupplierLedgerPage } from '../pages/reports/SupplierLedgerPage';

/**
 * Multi-branch-lifecycle fixture — merges the two parallel fixture lineages
 * this flow needs, both rooted at masters.fixture.ts but never previously
 * combined: `sale-return-lifecycle.fixture.ts`'s transaction/report chain
 * (purchasePage/salePage/collectionPage/stockReportPage/
 * customerSaleCollectionReportPage/bankAccountSetupPage/...) and
 * masters3/masters6/masters7.fixture.ts's SetUp-module chain
 * (branchProfilePage/userProfilePage/userBranchProfilePage), plus
 * supplierLedgerPage (purchase-lifecycle.fixture.ts's own addition, not
 * otherwise on the sale-return-lifecycle chain). Rather than trying to
 * extend one existing fixture file from the other (TypeScript/Playwright
 * fixture chains are linear — the two lineages diverge after
 * masters.fixture.ts and can't be merged that way), this file extends
 * `sale-return-lifecycle.fixture.ts` and adds the four missing page objects
 * directly, each a trivial one-line instantiation identical to its existing
 * declaration on the other chain — no behavior duplication, just composing
 * what already exists. Not part of the approved coverage baseline
 * (config/coverage-baseline.ts).
 */
export interface MultiBranchLifecycleFixtures extends SaleReturnLifecycleFixtures {
  branchProfilePage: BranchProfilePage;
  userProfilePage: UserProfilePage;
  userBranchProfilePage: UserBranchProfilePage;
  supplierLedgerPage: SupplierLedgerPage;
}

export const test = saleReturnLifecycleFixtureTest.extend<MultiBranchLifecycleFixtures>({
  branchProfilePage: async ({ page }, use) => {
    await use(new BranchProfilePage(page));
  },
  userProfilePage: async ({ page }, use) => {
    await use(new UserProfilePage(page));
  },
  userBranchProfilePage: async ({ page }, use) => {
    await use(new UserBranchProfilePage(page));
  },
  supplierLedgerPage: async ({ page }, use) => {
    await use(new SupplierLedgerPage(page));
  },
});

export { expect } from '@playwright/test';
