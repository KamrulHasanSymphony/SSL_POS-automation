import { test as masters2FixtureTest, Masters2Fixtures } from './masters2.fixture';
import { BranchProfilePage } from '../pages/masters/BranchProfilePage';
import { FiscalYearPage } from '../pages/masters/FiscalYearPage';
import { AreaPage } from '../pages/masters/AreaPage';

/**
 * STEP 9 Phase B — page objects for BranchProfile, FiscalYear, Areas.
 * Extends masters2.fixture.ts rather than modifying it, per STEP 9.2B scope
 * (STEP 4-8 and STEP 9.2A fixtures must not change).
 */
export interface Masters3Fixtures extends Masters2Fixtures {
  branchProfilePage: BranchProfilePage;
  fiscalYearPage: FiscalYearPage;
  areaPage: AreaPage;
}

export const test = masters2FixtureTest.extend<Masters3Fixtures>({
  branchProfilePage: async ({ page }, use) => {
    await use(new BranchProfilePage(page));
  },
  fiscalYearPage: async ({ page }, use) => {
    await use(new FiscalYearPage(page));
  },
  areaPage: async ({ page }, use) => {
    await use(new AreaPage(page));
  },
});

export { expect } from '@playwright/test';
