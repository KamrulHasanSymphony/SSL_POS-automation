import { test as purchaseLifecycleFixtureTest, PurchaseLifecycleFixtures } from './purchase-lifecycle.fixture';
import { PurchaseReportPage } from '../pages/reports/PurchaseReportPage';

/**
 * VAT-lifecycle fixture — extends purchase-lifecycle.fixture.ts with
 * exactly one addition, purchaseReportPage, for the cross-module E2E
 * VAT/SD lifecycle flow (Login -> Supplier -> Customer -> Product (VAT/SD
 * rate) -> Purchase -> Purchase Post -> Input VAT -> Sale -> Sale Post ->
 * Output VAT -> Purchase Report VAT/SD reconciliation). Mirrors the exact
 * same one-file-per-extension pattern every other lifecycle fixture in
 * this project already uses: purchase-lifecycle.fixture.ts itself is
 * untouched, so every existing test importing it (or anything upstream of
 * it) is unaffected by this addition. Not part of the approved coverage
 * baseline (config/coverage-baseline.ts).
 */
export interface VatLifecycleFixtures extends PurchaseLifecycleFixtures {
  purchaseReportPage: PurchaseReportPage;
}

export const test = purchaseLifecycleFixtureTest.extend<VatLifecycleFixtures>({
  purchaseReportPage: async ({ page }, use) => {
    await use(new PurchaseReportPage(page));
  },
});

export { expect } from '@playwright/test';
