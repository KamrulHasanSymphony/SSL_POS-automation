import { test, expect } from '../../fixtures/base.fixture';
import { assertAdminCredentialsReady } from '../../utils/env';
import { uniqueCode, randomData } from '../../utils/random-data';
import { apiMessages } from '../../utils/constants';
import {
  createCustomerGroup,
  createSupplierGroup,
  createCustomerApi,
  createSupplierApi,
  createBankInformationApi,
  createBankAccountApi,
  readProp,
} from '../../utils/test-data-setup';
import { tags } from '../../config/tags';

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * STEP 8 module: Independent API-level checks — server-side "amount cannot
 * exceed Due Amount" enforcement (PROP-API-008, 009), approved in
 * STEP 8.1/8.2. STEP 7 confirmed this rule is enforced client-side only in
 * the UI (`"Collection cannot exceed Due Amount"` / `"Payment cannot
 * exceed Due Amount"` toastr messages, trivially bypassable). This pass
 * confirmed directly from source (CollectionService.cs:77-78,
 * PaymentService.cs:161-162) that the SAME rule is independently enforced
 * server-side too — genuinely distinct coverage a UI-only test can never
 * prove, since a browser can't submit a payload the client JS itself
 * refuses to send.
 *
 * CONFIRMED FROM SOURCE (not assumed): the `DueAmount` compared against is
 * taken verbatim from the client-submitted detail line — no DB lookup of
 * the referenced Sale/Purchase happens before the comparison. This means a
 * deliberately nonexistent SaleId/PurchaseId (999999) is safe to use here —
 * traced precisely, the rejection fires before any FK-dependent code path
 * runs. Real Customer/Supplier/BankAccount ids are still used for the
 * header fields, since whether THOSE carry a DB-level FK constraint could
 * not be confirmed from source (no schema/migration files exist in this
 * repo) — using real, just-created records removes that unconfirmed risk
 * entirely rather than guessing a header FK is safe to fake too.
 *
 * Confirmed: on rejection, the entire Insert transaction rolls back
 * (nothing persisted) — no Collection/Payment cleanup is needed; only the
 * prerequisite Customer/Supplier/BankAccount/Group records are registered.
 */
test.describe('Independent API checks — Due Amount server-side enforcement', () => {
  test(`PROP-API-008 Collection Insert with CollectionAmount > DueAmount is rejected server-side ${tags.regression} ${tags.negative} ${tags.p1}`, async ({
    apiClient,
    cleanup,
  }) => {
    assertAdminCredentialsReady();
    const companyId = apiClient.getCompanyId();
    expect(companyId, 'apiClient must be authenticated to obtain a CompanyId').not.toBeNull();

    const customerGroup = await createCustomerGroup(apiClient, { name: uniqueCode('CUSTGROUP'), companyId: companyId! });
    cleanup.register(customerGroup);
    const customer = await createCustomerApi(apiClient, {
      name: uniqueCode('CUSTOMER'),
      telephoneNo: randomData.phone11Digit(),
      companyId: companyId!,
      branchId: companyId!,
      customerGroupId: Number(customerGroup.id),
    });
    cleanup.register(customer);

    const bank = await createBankInformationApi(apiClient, { name: uniqueCode('BANKAPI'), companyId: companyId! });
    cleanup.register(bank);
    const bankAccount = await createBankAccountApi(apiClient, {
      accountNo: uniqueCode('ACCAPI'),
      accountName: uniqueCode('BANKACCAPI'),
      bankId: Number(bank.id),
      branchName: 'Automation Branch',
      companyId: companyId!,
    });
    cleanup.register(bankAccount);

    const response = await apiClient.post('/api/Collection/Insert', {
      CustomerId: Number(customer.id),
      BankAccountId: Number(bankAccount.id),
      BranchId: companyId,
      CompanyId: companyId,
      CreatedBy: 'automation',
      TransactionDate: today(),
      ChequeDate: today(),
      IsCash: true,
      TotalCollectAmount: 1000,
      collectionDetailList: [
        {
          SaleId: 999999,
          CustomerId: Number(customer.id),
          SaleAmount: 100,
          DueAmount: 100,
          CollectionAmount: 500,
        },
      ],
    });
    const body = await response.json();

    expect(readProp(body, 'Status')).toBe('Fail');
    expect(readProp(body, 'Message')).toBe(apiMessages.collectionExceedsDue);
  });

  test(`PROP-API-009 Payment Insert with PaymentAmount > DueAmount is rejected server-side ${tags.regression} ${tags.negative} ${tags.p1}`, async ({
    apiClient,
    cleanup,
  }) => {
    assertAdminCredentialsReady();
    const companyId = apiClient.getCompanyId();
    expect(companyId, 'apiClient must be authenticated to obtain a CompanyId').not.toBeNull();

    const supplierGroup = await createSupplierGroup(apiClient, { name: uniqueCode('SUPPGROUP'), companyId: companyId! });
    cleanup.register(supplierGroup);
    const supplier = await createSupplierApi(apiClient, {
      name: uniqueCode('SUPPLIER'),
      companyId: companyId!,
      branchId: companyId!,
      supplierGroupId: Number(supplierGroup.id),
    });
    cleanup.register(supplier);

    const bank = await createBankInformationApi(apiClient, { name: uniqueCode('BANKAPI'), companyId: companyId! });
    cleanup.register(bank);
    const bankAccount = await createBankAccountApi(apiClient, {
      accountNo: uniqueCode('ACCAPI'),
      accountName: uniqueCode('BANKACCAPI'),
      bankId: Number(bank.id),
      branchName: 'Automation Branch',
      companyId: companyId!,
    });
    cleanup.register(bankAccount);

    const response = await apiClient.post('/api/Payment/Insert', {
      SupplierId: Number(supplier.id),
      BankAccountId: Number(bankAccount.id),
      BranchId: companyId,
      CompanyId: companyId,
      CreatedBy: 'automation',
      CreatedFrom: 'API',
      TransactionDate: today(),
      IsCash: true,
      TotalPaymentAmount: 1000,
      paymentDetailList: [
        {
          PurchaseId: 999999,
          SupplierId: Number(supplier.id),
          PurchaseAmount: 100,
          DueAmount: 100,
          PaymentAmount: 500,
        },
      ],
    });
    const body = await response.json();

    expect(readProp(body, 'Status')).toBe('Fail');
    expect(readProp(body, 'Message')).toBe(apiMessages.paymentExceedsDue);
  });
});
