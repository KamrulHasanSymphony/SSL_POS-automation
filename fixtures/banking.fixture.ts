import { test as transactionsFixtureTest, TransactionFixtures } from './transactions.fixture';
import { BankInformationPage } from '../pages/banking/BankInformationPage';
import { BankAccountPage } from '../pages/banking/BankAccountPage';
import { DepositPage } from '../pages/banking/DepositPage';
import { WithdrawalPage } from '../pages/banking/WithdrawalPage';
import { CollectionPage } from '../pages/banking/CollectionPage';
import { PaymentPage } from '../pages/banking/PaymentPage';
import { uniqueCode, randomData } from '../utils/random-data';

/**
 * STEP 7 — Bank/Deposit/Withdrawal/Collection/Payment page objects plus
 * their prerequisite chains, all built from already-confirmed STEP 5/6 UI
 * page objects (API Setup Rule: no new API endpoint/payload was verified
 * for any of these 6 modules, so every prerequisite is UI-driven — see the
 * STEP 7.1 chat record's Phase 2).
 */
export interface BankingFixtures extends TransactionFixtures {
  bankInformationPage: BankInformationPage;
  bankAccountPage: BankAccountPage;
  depositPage: DepositPage;
  withdrawalPage: WithdrawalPage;
  collectionPage: CollectionPage;
  paymentPage: PaymentPage;
  /** One active BankInformation — BankAccount's own prerequisite. */
  bankInformationPrerequisite: () => Promise<{ bankName: string }>;
  /** Two active BankAccounts (From + To) — Deposit/Withdrawal's prerequisite. */
  twoBankAccountsPrerequisite: () => Promise<{ fromAccountName: string; toAccountName: string }>;
  /**
   * Product + Customer + Bank/BankAccount + a real, saved Sale with a
   * confirmed non-zero Due balance — Collection's full prerequisite chain.
   * LIVE-DOM/BUSINESS-RULE RISK (flagged, not silently assumed): Sale's
   * exact partial-payment rule was not confirmed at STEP 6/7 (only that
   * zero payment and over-payment are both rejected) — a deliberately small
   * `paymentAmount: 1` is used here on the assumption partial payment
   * between those two bounds is accepted, leaving a real Due balance for
   * Collection to apply against. If this assumption is wrong, Collection's
   * prerequisite setup itself would fail before the Collection module is
   * even reached — see STEP 7.2 report §L.
   */
  saleWithDuePrerequisite: () => Promise<{ customerName: string; saleCode: string }>;
  /**
   * Product + Supplier + a real, saved Purchase (PaidAmount left unset, so
   * the full GrandTotal remains Due) — Payment's full prerequisite chain.
   * supplierId is captured directly off the post-create Edit URL (confirmed
   * reliable, same navigation SupplierPage.createSupplier()'s own doc
   * comment documents) rather than left for a caller to rediscover later via
   * SupplierPage.openEditFor()'s grid-search fallback path — confirmed live
   * that path does not (yet) resolve this grid's icon-only Edit action via
   * an accessible name, a KendoGrid/SupplierList-level gap out of scope to
   * fix broadly here, and unlike purchase-lifecycle.spec.ts's own use of
   * openEditFor() (called immediately after createSupplier(), before
   * anything else navigates away, so it never actually exercises that
   * fallback), any caller reaching this point has necessarily already
   * navigated on to create the Purchase.
   */
  purchaseWithDuePrerequisite: () => Promise<{ supplierName: string; supplierId: string; purchaseCode: string }>;
}

export const test = transactionsFixtureTest.extend<BankingFixtures>({
  bankInformationPage: async ({ page }, use) => {
    await use(new BankInformationPage(page));
  },
  bankAccountPage: async ({ page }, use) => {
    await use(new BankAccountPage(page));
  },
  depositPage: async ({ page }, use) => {
    await use(new DepositPage(page));
  },
  withdrawalPage: async ({ page }, use) => {
    await use(new WithdrawalPage(page));
  },
  collectionPage: async ({ page }, use) => {
    await use(new CollectionPage(page));
  },
  paymentPage: async ({ page }, use) => {
    await use(new PaymentPage(page));
  },

  bankInformationPrerequisite: async ({ bankInformationPage }, use) => {
    await use(async () => {
      const bankName = uniqueCode('BANK');
      await bankInformationPage.createBankInformation({ name: bankName, telephoneNo: randomData.phone11Digit() });
      return { bankName };
    });
  },

  twoBankAccountsPrerequisite: async ({ bankAccountSetupPage }, use) => {
    await use(async () => {
      const from = await bankAccountSetupPage.setupBankAccount();
      const to = await bankAccountSetupPage.setupBankAccount();
      return { fromAccountName: from.accountName, toAccountName: to.accountName };
    });
  },

  saleWithDuePrerequisite: async ({ salesPartyPrerequisites, bankAccountSetupPage, salePage }, use) => {
    await use(async () => {
      const { customerName, productName } = await salesPartyPrerequisites();
      const { accountName } = await bankAccountSetupPage.setupBankAccount();
      const saleCode = await salePage.createSale({
        customerName,
        productName,
        quantity: 5,
        bankAccountName: accountName,
        paymentAmount: 1,
      });
      return { customerName, saleCode };
    });
  },

  purchaseWithDuePrerequisite: async (
    { productPrerequisites, productPage, supplierPrerequisites, supplierPage, purchasePage, page },
    use
  ) => {
    await use(async () => {
      // Deliberately NOT purchasePartyPrerequisites() here — that fixture
      // creates its Product via productPage.createProduct() with no
      // purchasePrice, confirmed live to leave the Purchase line item's Unit
      // Rate at 0 and the whole Save silently stuck (Purchase's save handler
      // rejects a line item with UnitPrice <= 0 — same rejection rule
      // tests/ui/e2e/purchase-lifecycle.spec.ts's own "3. Product" step
      // comment already documents and works around). purchasePrice is
      // supplied directly here instead, same fix applied at its source.
      const { productGroupName, uomName } = await productPrerequisites();
      const productName = uniqueCode('PRODUCT');
      await productPage.createProduct({ name: productName, productGroupName, uomName, purchasePrice: 300 });

      const { supplierGroupName } = await supplierPrerequisites();
      const supplierName = uniqueCode('SUPPLIER');
      await supplierPage.createSupplier({
        name: supplierName,
        supplierGroupName,
        address: `Automation Address ${uniqueCode('ADDR')}`,
      });
      // Captured immediately off the post-create Edit URL — see this
      // fixture's own interface doc comment above for why this is done here
      // rather than left for a caller to rediscover later.
      const supplierIdMatch = /\/Edit\/(\d+)/i.exec(page.url());
      if (!supplierIdMatch) {
        throw new Error(`Expected to land on /DMS/Supplier/Edit/{id} after createSupplier(), got: ${page.url()}`);
      }
      const supplierId = supplierIdMatch[1];

      // #BENumber is confirmed live as <input type="number"> (see
      // tests/ui/e2e/purchase-lifecycle.spec.ts's own "Save" step comment
      // for the original source citation of this exact incompatibility) —
      // Playwright refuses to .fill() a letter-containing value like
      // uniqueCode('PUR') into it, so a purely-numeric, still-effectively-
      // unique value is used here instead, matching that already-established
      // fix rather than reintroducing the bug it fixed.
      const purchaseCode = await purchasePage.createPurchase({
        supplierName,
        beNumber: String(Date.now()),
        productName,
        quantity: 5,
      });

      // Post the Purchase — required for it to be counted anywhere
      // downstream (confirmed rule, tests/ui/e2e/purchase-lifecycle.spec.ts's
      // own header comment: reports/ledgers join on `WHERE PUR.IsPost = 1`).
      // Without this, the Purchase this fixture hands back stays in Draft
      // (IsPost = 0) and is silently excluded from the Supplier Purchase &
      // Payment Report's Purchase side, even though its Due is still
      // readable through the Payment invoice picker.
      // createPurchase() above already lands on /DMS/Purchase/Edit/{id} for
      // this exact record (see its own doc comment), so post() is called
      // directly here rather than re-navigating via
      // openEditFor()'s goto()+grid.search()+clickRowAction() round trip —
      // confirmed live that clickRowAction()'s role-based edit-button match
      // is flaky against this grid, an unrelated pre-existing gap avoided
      // entirely by not needing that navigation in the first place.
      await purchasePage.post();

      return { supplierName, supplierId, purchaseCode };
    });
  },
});

export { expect } from '@playwright/test';
