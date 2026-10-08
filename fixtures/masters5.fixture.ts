import { test as masters4FixtureTest, Masters4Fixtures } from './masters4.fixture';
import { CustomerGroupPage } from '../pages/masters/CustomerGroupPage';
import { SupplierGroupPage } from '../pages/masters/SupplierGroupPage';
import { ProductGroupPage } from '../pages/masters/ProductGroupPage';
import { UOMPage } from '../pages/masters/UOMPage';
import { CompanyProfilePage } from '../pages/setup/CompanyProfilePage';
import { RolePage } from '../pages/setup/RolePage';

/**
 * STEP 10 Phase A — page objects for CustomerGroup, SupplierGroup,
 * ProductGroup, UOM, CompanyProfile, Role. Extends masters4.fixture.ts
 * rather than modifying it, per STEP 10.3A scope (STEP 4-10.2 fixtures
 * must not change). All six are independent, no new prerequisite helpers
 * required.
 */
export interface Masters5Fixtures extends Masters4Fixtures {
  customerGroupPage: CustomerGroupPage;
  supplierGroupPage: SupplierGroupPage;
  productGroupPage: ProductGroupPage;
  uomPage: UOMPage;
  companyProfilePage: CompanyProfilePage;
  rolePage: RolePage;
}

export const test = masters4FixtureTest.extend<Masters5Fixtures>({
  customerGroupPage: async ({ page }, use) => {
    await use(new CustomerGroupPage(page));
  },
  supplierGroupPage: async ({ page }, use) => {
    await use(new SupplierGroupPage(page));
  },
  productGroupPage: async ({ page }, use) => {
    await use(new ProductGroupPage(page));
  },
  uomPage: async ({ page }, use) => {
    await use(new UOMPage(page));
  },
  companyProfilePage: async ({ page }, use) => {
    await use(new CompanyProfilePage(page));
  },
  rolePage: async ({ page }, use) => {
    await use(new RolePage(page));
  },
});

export { expect } from '@playwright/test';
