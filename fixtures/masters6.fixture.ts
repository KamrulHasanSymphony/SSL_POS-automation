import { test as masters5FixtureTest, Masters5Fixtures } from './masters5.fixture';
import { CustomerAdvancePage } from '../pages/masters/CustomerAdvancePage';
import { SupplierProductPage } from '../pages/masters/SupplierProductPage';
import { MasterItemProductPage } from '../pages/masters/MasterItemProductPage';
import { MasterSupplierProductPage } from '../pages/masters/MasterSupplierProductPage';
import { RoleMenuPage } from '../pages/setup/RoleMenuPage';
import { UserProfilePage } from '../pages/setup/UserProfilePage';
import { uniqueCode } from '../utils/random-data';

/**
 * STEP 10 Phase B — page objects for CustomerAdvance, SupplierProduct,
 * MasterItemProduct, MasterSupplierProduct, RoleMenu, UserProfile, plus
 * their prerequisite chains. Extends masters5.fixture.ts rather than
 * modifying it, per STEP 10.3B scope (STEP 4-10.3A fixtures must not
 * change).
 */
export interface Masters6Fixtures extends Masters5Fixtures {
  customerAdvancePage: CustomerAdvancePage;
  supplierProductPage: SupplierProductPage;
  masterItemProductPage: MasterItemProductPage;
  masterSupplierProductPage: MasterSupplierProductPage;
  roleMenuPage: RoleMenuPage;
  userProfilePage: UserProfilePage;
  /** Creates a Customer via the existing STEP 5 UI flow and captures its numeric database Id — CustomerAdvance's prerequisite (Create takes an int Id, not a Name/Code). */
  customerWithIdPrerequisite: () => Promise<{ customerId: string; customerName: string }>;
  /** Creates a Product (with its own fresh ProductGroup) via the existing STEP 5 UI flow — SupplierProduct's prerequisite. */
  productForSupplierProductPrerequisite: () => Promise<{ productGroupName: string; productName: string }>;
  /** Creates a Role via the existing STEP 10.3A UI flow and captures its numeric database Id — RoleMenu's prerequisite. */
  roleWithIdPrerequisite: () => Promise<{ roleId: string; roleName: string }>;
}

export const test = masters5FixtureTest.extend<Masters6Fixtures>({
  customerAdvancePage: async ({ page }, use) => {
    await use(new CustomerAdvancePage(page));
  },
  supplierProductPage: async ({ page }, use) => {
    await use(new SupplierProductPage(page));
  },
  masterItemProductPage: async ({ page }, use) => {
    await use(new MasterItemProductPage(page));
  },
  masterSupplierProductPage: async ({ page }, use) => {
    await use(new MasterSupplierProductPage(page));
  },
  roleMenuPage: async ({ page }, use) => {
    await use(new RoleMenuPage(page));
  },
  userProfilePage: async ({ page }, use) => {
    await use(new UserProfilePage(page));
  },

  customerWithIdPrerequisite: async ({ customerPage, customerPrerequisites, page }, use) => {
    await use(async () => {
      const { customerGroupName } = await customerPrerequisites();
      const customerName = uniqueCode('CUSTADVCUST');
      await customerPage.createCustomer({
        name: customerName,
        customerGroupName,
        telephoneNo: '01700000000',
        email: `${customerName.toLowerCase()}@example.com`,
        address: `Automation Address ${uniqueCode('ADDR')}`,
      });
      // createCustomer() navigates directly to /DMS/Customer/Edit/{id} on success.
      const customerId = await page.locator('#Id').inputValue();
      return { customerId, customerName };
    });
  },

  productForSupplierProductPrerequisite: async ({ productPage, productPrerequisites }, use) => {
    await use(async () => {
      const { productGroupName, uomName } = await productPrerequisites();
      const productName = uniqueCode('SUPPPRODITEM');
      await productPage.createProduct({ name: productName, productGroupName, uomName });
      return { productGroupName, productName };
    });
  },

  roleWithIdPrerequisite: async ({ rolePage, page }, use) => {
    await use(async () => {
      const roleName = uniqueCode('ROLEMENU');
      await rolePage.createRole(roleName);
      // createRole() updates #Id in place (no navigation) on success.
      const roleId = await page.locator('#Id').inputValue();
      return { roleId, roleName };
    });
  },
});

export { expect } from '@playwright/test';
