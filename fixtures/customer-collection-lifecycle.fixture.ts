import { test as e2eFixtureTest, E2EFixtures } from './e2e.fixture';
import { CustomerSaleCollectionReportPage } from '../pages/reports/CustomerSaleCollectionReportPage';
import { uniqueCode, randomData } from '../utils/random-data';

/**
 * Customer-collection-lifecycle fixture — extends e2e.fixture.ts with
 * exactly one page-object addition, customerSaleCollectionReportPage, plus
 * one prerequisite, saleWithDuePrerequisitePosted, for the cross-module E2E
 * customer-collection-lifecycle flow (Login -> Customer -> Product -> Sale
 * -> Sale Post -> Collection -> Due reduction -> Customer Sale & Collection
 * Report). Mirrors the exact same one-file-per-extension pattern
 * financial-lifecycle.fixture.ts already uses on top of e2e.fixture.ts:
 * e2e.fixture.ts itself is untouched, so every existing test importing it
 * (or anything upstream of it) is unaffected by this addition.
 *
 * WHY A NEW PREREQUISITE RATHER THAN REUSING banking.fixture.ts's OWN
 * saleWithDuePrerequisite: that fixture (a) never posts the Sale it creates
 * (STEP C-CUSTOMER-COLLECTION-LIFECYCLE investigation finding: `Sales.IsPost`
 * stays 0), which this report's `GetCustomerSaleCollectionReportList` query
 * requires (`WHERE IsPost = 1` on both its Sales and SaleCreditCards legs —
 * ReportsRepository.cs) for the Sale's own GrandTotal/at-sale-payment rows
 * to be counted at all, and (b) never captures customerId, which
 * CustomerSaleCollectionReportPage.selectCustomerDirectly() needs (same
 * broken-popup reason PurchasePage/SupplierLedgerPage already document for
 * supplierId). Rather than changing the shared saleWithDuePrerequisite
 * (used by tests/ui/banking/collection.spec.ts's own suite, which doesn't
 * need either of these) and risking those already-passing tests, this is a
 * new, dedicated fixture — same minimal-blast-radius reasoning already
 * applied when purchaseWithDuePrerequisite was fixed to Post its Purchase
 * in-place rather than introducing a parallel fixture, except here the
 * existing fixture is intentionally left alone since other tests depend on
 * its current (unposted) behavior.
 */
export interface CustomerCollectionLifecycleFixtures extends E2EFixtures {
  customerSaleCollectionReportPage: CustomerSaleCollectionReportPage;
  saleWithDuePrerequisitePosted: () => Promise<{ customerName: string; customerId: string; saleCode: string }>;
}

export const test = e2eFixtureTest.extend<CustomerCollectionLifecycleFixtures>({
  customerSaleCollectionReportPage: async ({ page }, use) => {
    await use(new CustomerSaleCollectionReportPage(page));
  },

  saleWithDuePrerequisitePosted: async (
    { customerPrerequisites, customerPage, productPrerequisites, productPage, bankAccountSetupPage, salePage, page },
    use
  ) => {
    await use(async () => {
      const { customerGroupName } = await customerPrerequisites();
      const customerName = uniqueCode('CUSTOMER');
      await customerPage.createCustomer({
        name: customerName,
        customerGroupName,
        telephoneNo: randomData.phone11Digit(),
        email: randomData.email('customer'),
        address: `Automation Address ${uniqueCode('ADDR')}`,
      });
      // Captured immediately off the post-create Edit URL — same confirmed-
      // reliable mechanism purchaseWithDuePrerequisite already uses for
      // supplierId (CustomerPage.createCustomer()'s own class doc comment
      // confirms this same window.location.href redirect to Edit).
      const customerIdMatch = /\/Edit\/(\d+)/i.exec(page.url());
      if (!customerIdMatch) {
        throw new Error(`Expected to land on /DMS/Customer/Edit/{id} after createCustomer(), got: ${page.url()}`);
      }
      const customerId = customerIdMatch[1];

      const { productGroupName, uomName } = await productPrerequisites();
      const productName = uniqueCode('PRODUCT');
      // salePrice: 500 — same as sales-lifecycle.spec.ts's own step 3 comment
      // (ProductPage.ts's ProductCreateData.salePrice doc comment): without
      // it, ProductVM.SalePrice is left at its default 0, so the Sale line
      // item added below picks up a zero UnitRate, driving Final Payable to
      // 0 and blocking Save's payment validation.
      await productPage.createProduct({ name: productName, productGroupName, uomName, salePrice: 500 });

      const { accountName: bankAccountName } = await bankAccountSetupPage.setupBankAccount();

      // Sale carries a mandatory payment step (SalePage.ts's own class doc
      // comment) — a deliberate partial payment (never the full Final
      // Payable), so a real, non-zero Due remains for Collection to apply
      // against, same reasoning sales-lifecycle.spec.ts's own step 7 comment
      // already documents.
      await salePage.gotoCreate();
      await salePage.selectCustomer(customerName);
      await salePage.fillInvoiceDate();
      await salePage.lineItems.addLineItem(productName, 2);
      const finalPayable = await salePage.getFinalPayable();
      const paymentAmount = Math.floor(finalPayable / 2);
      await salePage.addPayment(bankAccountName, paymentAmount);
      await salePage.clickSave();
      // CUSTOMER-COLLECTION-LIFECYCLE E2E FINDING (STEP SALE-SAVE-
      // VERIFICATION-INVESTIGATION): previously `toastr.expectSuccess()` +
      // `getCode()` — confirmed live (network trace: zero
      // `/DMS/Sale/CreateEdit` POSTs; toast text was actually "Your payment
      // is more than your total bill. Please correct it.") that the
      // no-argument toast check can't tell that client-side-blocked error
      // apart from a real success, silently handing `getCode()` an empty
      // `#Code`. `waitForSaveSuccess()` (see SalePage.ts's own doc comment)
      // waits for the real save-success signal instead — confirmed from
      // SaleController.js's `saveDone()` that, contrary to what this
      // comment previously assumed, Sale's Save DOES navigate to
      // `/DMS/Sale/Edit/{id}` on success, same as Purchase.
      const saleCode = await salePage.waitForSaveSuccess();

      // Post the Sale — required for GetCustomerSaleCollectionReportList to
      // count it at all (WHERE IsPost = 1 on both its Sales and
      // SaleCreditCards legs, ReportsRepository.cs). Mirrors sale.spec.ts's
      // own PROP-SALE-006, the proven-working openEditFor()-then-post()
      // sequence for this specific module.
      await salePage.openEditFor(saleCode);
      await salePage.post();

      return { customerName, customerId, saleCode };
    });
  },
});

export { expect } from '@playwright/test';
