import { test as bankingFixtureTest, BankingFixtures } from './banking.fixture';
import { BusinessTypePage } from '../pages/masters/BusinessTypePage';
import { PaymentTypePage } from '../pages/masters/PaymentTypePage';
import { TableSectionPage } from '../pages/masters/TableSectionPage';
import { TableInfoPage } from '../pages/masters/TableInfoPage';
import { IncomeExpenseCategoryPage } from '../pages/masters/IncomeExpenseCategoryPage';
import { OverHeadPage } from '../pages/masters/OverHeadPage';
import { MasterItemGroupPage } from '../pages/masters/MasterItemGroupPage';
import { MasterSupplierGroupPage } from '../pages/masters/MasterSupplierGroupPage';
import { MasterSupplierPage } from '../pages/masters/MasterSupplierPage';
import { uniqueCode } from '../utils/random-data';

/**
 * STEP 9 Phase A — page objects for BusinessType, PaymentType,
 * TableSection, TableInfo, IncomeExpenseCategory, OverHead,
 * MasterItemGroup, MasterSupplierGroup, MasterSupplier, plus the two
 * intra-family prerequisite chains (TableInfo needs TableSection,
 * MasterSupplier needs MasterSupplierGroup) — everything else in this
 * batch is a standalone flat master with no dependency.
 */
export interface Masters2Fixtures extends BankingFixtures {
  businessTypePage: BusinessTypePage;
  paymentTypePage: PaymentTypePage;
  tableSectionPage: TableSectionPage;
  tableInfoPage: TableInfoPage;
  incomeExpenseCategoryPage: IncomeExpenseCategoryPage;
  overHeadPage: OverHeadPage;
  masterItemGroupPage: MasterItemGroupPage;
  masterSupplierGroupPage: MasterSupplierGroupPage;
  masterSupplierPage: MasterSupplierPage;
  /** Creates a TableSection via the real UI — TableInfo's prerequisite. */
  tableSectionPrerequisite: () => Promise<{ sectionName: string }>;
  /** Creates a MasterSupplierGroup via the real UI — MasterSupplier's prerequisite. */
  masterSupplierGroupPrerequisite: () => Promise<{ groupName: string }>;
}

export const test = bankingFixtureTest.extend<Masters2Fixtures>({
  businessTypePage: async ({ page }, use) => {
    await use(new BusinessTypePage(page));
  },
  paymentTypePage: async ({ page }, use) => {
    await use(new PaymentTypePage(page));
  },
  tableSectionPage: async ({ page }, use) => {
    await use(new TableSectionPage(page));
  },
  tableInfoPage: async ({ page }, use) => {
    await use(new TableInfoPage(page));
  },
  incomeExpenseCategoryPage: async ({ page }, use) => {
    await use(new IncomeExpenseCategoryPage(page));
  },
  overHeadPage: async ({ page }, use) => {
    await use(new OverHeadPage(page));
  },
  masterItemGroupPage: async ({ page }, use) => {
    await use(new MasterItemGroupPage(page));
  },
  masterSupplierGroupPage: async ({ page }, use) => {
    await use(new MasterSupplierGroupPage(page));
  },
  masterSupplierPage: async ({ page }, use) => {
    await use(new MasterSupplierPage(page));
  },

  tableSectionPrerequisite: async ({ tableSectionPage }, use) => {
    await use(async () => {
      const sectionName = uniqueCode('TSEC');
      await tableSectionPage.createTableSection(sectionName);
      return { sectionName };
    });
  },

  masterSupplierGroupPrerequisite: async ({ masterSupplierGroupPage }, use) => {
    await use(async () => {
      const groupName = uniqueCode('MSUPPGRP');
      await masterSupplierGroupPage.createMasterSupplierGroup(groupName);
      return { groupName };
    });
  },
});

export { expect } from '@playwright/test';
