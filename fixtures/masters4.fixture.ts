import { test as masters3FixtureTest, Masters3Fixtures } from './masters3.fixture';
import { IncomePage } from '../pages/masters/IncomePage';
import { ExpensePage } from '../pages/masters/ExpensePage';
import { MasterItemPage } from '../pages/masters/MasterItemPage';
import { MasterSupplierItemPage } from '../pages/masters/MasterSupplierItemPage';
import { IncomeExpenseCategoryType } from '../pages/masters/IncomeExpenseCategoryPage';
import { createUom } from '../utils/test-data-setup';
import { uniqueCode } from '../utils/random-data';
import { ApiClient } from '../utils/api-helper';

/**
 * STEP 9 Phase C — page objects for Income, Expense, MasterItem,
 * MasterSupplierItem, plus their prerequisite chains. Extends
 * masters3.fixture.ts rather than modifying it, per STEP 9.2C scope
 * (STEP 4-9.2B fixtures must not change).
 */
export interface Masters4Fixtures extends Masters3Fixtures {
  incomePage: IncomePage;
  expensePage: ExpensePage;
  masterItemPage: MasterItemPage;
  masterSupplierItemPage: MasterSupplierItemPage;
  /** Creates one active IncomeExpenseCategory of the given type via the STEP 9.2A UI flow — Income/Expense's category-picker prerequisite. */
  incomeExpenseCategoryPrerequisite: (type: IncomeExpenseCategoryType) => Promise<{ categoryName: string }>;
  /** Creates one active MasterItemGroup (STEP 9.2A UI flow) and one active UOM (STEP 5 API helper) — MasterItem's prerequisite. */
  masterItemPrerequisites: () => Promise<{ masterItemGroupName: string; uomName: string }>;
  /** Creates one active MasterSupplier and one MasterItem (in its own fresh MasterItemGroup) — MasterSupplierItem's prerequisite. */
  masterSupplierItemPrerequisites: () => Promise<{ supplierName: string; masterItemGroupName: string; itemName: string }>;
}

function requireCompanyId(apiClient: ApiClient): number {
  const companyId = apiClient.getCompanyId();
  if (companyId === null) {
    throw new Error(
      'Cannot create API prerequisite data — apiClient has no CompanyId. ' +
        'Call assertAdminCredentialsReady() at the start of the test so the apiClient fixture actually authenticates.'
    );
  }
  return companyId;
}

export const test = masters3FixtureTest.extend<Masters4Fixtures>({
  incomePage: async ({ page }, use) => {
    await use(new IncomePage(page));
  },
  expensePage: async ({ page }, use) => {
    await use(new ExpensePage(page));
  },
  masterItemPage: async ({ page }, use) => {
    await use(new MasterItemPage(page));
  },
  masterSupplierItemPage: async ({ page }, use) => {
    await use(new MasterSupplierItemPage(page));
  },

  incomeExpenseCategoryPrerequisite: async ({ incomeExpenseCategoryPage }, use) => {
    await use(async (type: IncomeExpenseCategoryType) => {
      const categoryName = uniqueCode(type === 'Income' ? 'INCCAT' : 'EXPCAT');
      await incomeExpenseCategoryPage.createCategory(categoryName, type);
      return { categoryName };
    });
  },

  masterItemPrerequisites: async ({ masterItemGroupPage, apiClient }, use) => {
    await use(async () => {
      const companyId = requireCompanyId(apiClient);
      const masterItemGroupName = uniqueCode('MITEMGRP');
      const uomName = uniqueCode('UOM');
      await masterItemGroupPage.createMasterItemGroup(masterItemGroupName);
      await createUom(apiClient, { name: uomName, companyId });
      return { masterItemGroupName, uomName };
    });
  },

  masterSupplierItemPrerequisites: async (
    { masterSupplierGroupPrerequisite, masterSupplierPage, masterItemGroupPage, masterItemPage, apiClient },
    use
  ) => {
    await use(async () => {
      const companyId = requireCompanyId(apiClient);

      const { groupName } = await masterSupplierGroupPrerequisite();
      const supplierName = uniqueCode('MSUPP');
      await masterSupplierPage.createMasterSupplier({
        name: supplierName,
        masterSupplierGroupName: groupName,
        address: `Automation Address ${uniqueCode('ADDR')}`,
      });

      const masterItemGroupName = uniqueCode('MITEMGRP');
      await masterItemGroupPage.createMasterItemGroup(masterItemGroupName);

      const uomName = uniqueCode('UOM');
      await createUom(apiClient, { name: uomName, companyId });

      const itemName = uniqueCode('MITEM');
      await masterItemPage.createMasterItem({ name: itemName, masterItemGroupName, uomName });

      return { supplierName, masterItemGroupName, itemName };
    });
  },
});

export { expect } from '@playwright/test';
