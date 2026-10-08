import { test as authFixtureTest, AuthFixtures } from './auth.fixture';
import { ProductPage } from '../pages/masters/ProductPage';
import { CustomerPage } from '../pages/masters/CustomerPage';
import { SupplierPage } from '../pages/masters/SupplierPage';
import { createProductGroup, createUom, createCustomerGroup, createSupplierGroup } from '../utils/test-data-setup';
import { uniqueCode } from '../utils/random-data';
import { ApiClient } from '../utils/api-helper';

/**
 * STEP 5 — Product/Customer/Supplier master-data page objects plus their
 * API-created prerequisite helpers (API Setup Rule: prerequisite data only,
 * never a replacement for the UI workflow under test — see
 * utils/api-helper.ts / README "Test Data Strategy").
 *
 * Prerequisite creation requires the authenticated ApiClient's CompanyId
 * (captured from the SignIn response, see api-helper.ts), so records land in
 * the SAME company the authenticated UI session (storage/auth.json) uses —
 * a mismatched/guessed CompanyId would create a Product Group/UOM/Customer
 * Group/Supplier Group invisible to the UI's own session-scoped dropdown.
 */
export interface MastersFixtures extends AuthFixtures {
  productPage: ProductPage;
  customerPage: CustomerPage;
  supplierPage: SupplierPage;
  /** Creates one active Product Group and one active UOM via API — PROP-PROD-002/003/004/005/006/008 prerequisite. */
  productPrerequisites: () => Promise<{ productGroupName: string; uomName: string }>;
  /** Creates one active Customer Group via API — PROP-CUST-002/003/004/005/006 prerequisite. */
  customerPrerequisites: () => Promise<{ customerGroupName: string }>;
  /** Creates one active Supplier Group via API — PROP-SUPP-002/003/004/005/006 prerequisite. */
  supplierPrerequisites: () => Promise<{ supplierGroupName: string }>;
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

export const test = authFixtureTest.extend<MastersFixtures>({
  productPage: async ({ page }, use) => {
    await use(new ProductPage(page));
  },

  customerPage: async ({ page }, use) => {
    await use(new CustomerPage(page));
  },

  supplierPage: async ({ page }, use) => {
    await use(new SupplierPage(page));
  },

  productPrerequisites: async ({ apiClient }, use) => {
    await use(async () => {
      const companyId = requireCompanyId(apiClient);
      const productGroupName = uniqueCode('PRODGROUP');
      const uomName = uniqueCode('UOM');
      await createProductGroup(apiClient, { name: productGroupName, companyId });
      await createUom(apiClient, { name: uomName, companyId });
      return { productGroupName, uomName };
    });
  },

  customerPrerequisites: async ({ apiClient }, use) => {
    await use(async () => {
      const companyId = requireCompanyId(apiClient);
      const customerGroupName = uniqueCode('CUSTGROUP');
      await createCustomerGroup(apiClient, { name: customerGroupName, companyId });
      return { customerGroupName };
    });
  },

  supplierPrerequisites: async ({ apiClient }, use) => {
    await use(async () => {
      const companyId = requireCompanyId(apiClient);
      const supplierGroupName = uniqueCode('SUPPGROUP');
      await createSupplierGroup(apiClient, { name: supplierGroupName, companyId });
      return { supplierGroupName };
    });
  },
});

export { expect } from '@playwright/test';
