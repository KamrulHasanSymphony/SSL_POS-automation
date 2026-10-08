import { test as mastersFixtureTest, MastersFixtures } from './masters.fixture';
import { PurchasePage } from '../pages/purchase/PurchasePage';
import { PurchaseOrderPage } from '../pages/purchase/PurchaseOrderPage';
import { PurchaseReturnPage } from '../pages/purchase/PurchaseReturnPage';
import { SalePage } from '../pages/sales/SalePage';
import { SaleOrderPage } from '../pages/sales/SaleOrderPage';
import { SaleReturnPage } from '../pages/sales/SaleReturnPage';
import { BankAccountSetupPage } from '../pages/common/BankAccountSetupPage';
import { uniqueCode, randomData } from '../utils/random-data';

/**
 * STEP 6 — Purchase/Sale transaction page objects plus the multi-step
 * prerequisite chains they need (API Setup Rule: Product/Customer/Supplier
 * are never the module under test here, so they're created through STEP 5's
 * own already-UI-verified page objects rather than an unconfirmed API
 * payload — see PurchasePage.ts / SalePage.ts doc comments for why).
 */
export interface TransactionFixtures extends MastersFixtures {
  purchasePage: PurchasePage;
  purchaseOrderPage: PurchaseOrderPage;
  purchaseReturnPage: PurchaseReturnPage;
  salePage: SalePage;
  saleOrderPage: SaleOrderPage;
  saleReturnPage: SaleReturnPage;
  bankAccountSetupPage: BankAccountSetupPage;
  /** Active Supplier + Product, created via STEP 5's UI page objects — Purchase/PurchaseOrder/PurchaseReturn prerequisite. */
  purchasePartyPrerequisites: () => Promise<{ supplierName: string; productName: string }>;
  /** Active Customer + Product, created via STEP 5's UI page objects — SaleOrder prerequisite (no payment). */
  salesPartyPrerequisites: () => Promise<{ customerName: string; productName: string }>;
  /** salesPartyPrerequisites() + an active BankAccount — Sale prerequisite (payment is mandatory). */
  saleTransactionPrerequisites: () => Promise<{ customerName: string; productName: string; bankAccountName: string }>;
}

export const test = mastersFixtureTest.extend<TransactionFixtures>({
  purchasePage: async ({ page }, use) => {
    await use(new PurchasePage(page));
  },
  purchaseOrderPage: async ({ page }, use) => {
    await use(new PurchaseOrderPage(page));
  },
  purchaseReturnPage: async ({ page }, use) => {
    await use(new PurchaseReturnPage(page));
  },
  salePage: async ({ page }, use) => {
    await use(new SalePage(page));
  },
  saleOrderPage: async ({ page }, use) => {
    await use(new SaleOrderPage(page));
  },
  saleReturnPage: async ({ page }, use) => {
    await use(new SaleReturnPage(page));
  },
  bankAccountSetupPage: async ({ page }, use) => {
    await use(new BankAccountSetupPage(page));
  },

  purchasePartyPrerequisites: async ({ productPrerequisites, productPage, supplierPrerequisites, supplierPage }, use) => {
    await use(async () => {
      const { productGroupName, uomName } = await productPrerequisites();
      const productName = uniqueCode('PRODUCT');
      await productPage.createProduct({ name: productName, productGroupName, uomName });

      const { supplierGroupName } = await supplierPrerequisites();
      const supplierName = uniqueCode('SUPPLIER');
      await supplierPage.createSupplier({
        name: supplierName,
        supplierGroupName,
        address: `Automation Address ${uniqueCode('ADDR')}`,
      });

      return { supplierName, productName };
    });
  },

  salesPartyPrerequisites: async ({ productPrerequisites, productPage, customerPrerequisites, customerPage }, use) => {
    await use(async () => {
      const { productGroupName, uomName } = await productPrerequisites();
      const productName = uniqueCode('PRODUCT');
      await productPage.createProduct({ name: productName, productGroupName, uomName });

      const { customerGroupName } = await customerPrerequisites();
      const customerName = uniqueCode('CUSTOMER');
      await customerPage.createCustomer({
        name: customerName,
        customerGroupName,
        telephoneNo: randomData.phone11Digit(),
        email: randomData.email('customer'),
        address: `Automation Address ${uniqueCode('ADDR')}`,
      });

      return { customerName, productName };
    });
  },

  saleTransactionPrerequisites: async ({ salesPartyPrerequisites, bankAccountSetupPage }, use) => {
    await use(async () => {
      const { customerName, productName } = await salesPartyPrerequisites();
      const { accountName } = await bankAccountSetupPage.setupBankAccount();
      return { customerName, productName, bankAccountName: accountName };
    });
  },
});

export { expect } from '@playwright/test';
