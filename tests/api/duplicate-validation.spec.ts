import { test, expect } from '../../fixtures/base.fixture';
import { assertAdminCredentialsReady } from '../../utils/env';
import { uniqueCode, randomData } from '../../utils/random-data';
import { apiMessages } from '../../utils/constants';
import {
  createProductGroup,
  createSupplierGroup,
  createCustomerGroup,
  createProductApi,
  createSupplierApi,
  createCustomerApi,
  createBankInformationApi,
  createBankAccountApi,
  readProp,
} from '../../utils/test-data-setup';
import { tags } from '../../config/tags';

/**
 * STEP 8 module: Independent API-level checks — server-side duplicate
 * rejection (PROP-API-004, 005, 006, 007), approved in STEP 8.1/8.2.
 * Confirmed directly from ShampanPOS_Api source (ProductService.cs/
 * CustomerService.cs/SupplierService.cs/BankAccountService.cs): a second
 * Insert whose duplicate-checked field matches an existing row is rejected
 * with the exact string "Data Already Exist!" — genuinely independent of
 * the 111 UI tests, since STEP 5/7 confirmed no such pre-submit check is
 * reachable from the UI at all for any of these four modules.
 *
 * PROP-API-005 CORRECTION (approved): the originally-approved wording
 * ("Customer duplicate Name rejected") was source-verification-disproven —
 * CustomerService.cs's actual check is on TelephoneNo (scoped to
 * IsActive='1'), not Name. Same-Name-different-phone Customer Inserts
 * succeed; only a same-TelephoneNo Insert is rejected. Corrected per your
 * explicit approval to "Customer Insert with duplicate TelephoneNo is
 * rejected" — same ID, priority, and tags as originally approved.
 */
test.describe('Independent API checks — server-side duplicate rejection', () => {
  test(`PROP-API-004 Product Insert with duplicate Name is rejected ${tags.regression} ${tags.negative} ${tags.p2}`, async ({
    apiClient,
    cleanup,
  }) => {
    assertAdminCredentialsReady();
    const companyId = apiClient.getCompanyId();
    expect(companyId, 'apiClient must be authenticated to obtain a CompanyId').not.toBeNull();

    const group = await createProductGroup(apiClient, { name: uniqueCode('PRODGROUP'), companyId: companyId! });
    cleanup.register(group);

    const name = uniqueCode('PRODUCT');
    const first = await createProductApi(apiClient, {
      name,
      companyId: companyId!,
      branchId: companyId!,
      productGroupId: Number(group.id),
      uomId: 1,
    });
    cleanup.register(first);

    const dupeResponse = await apiClient.post('/api/Product/Insert', {
      Name: name,
      CompanyId: companyId,
      BranchId: companyId,
      ProductGroupId: Number(group.id),
      UOMId: 1,
      CreatedBy: 'automation',
    });
    const dupeBody = await dupeResponse.json();

    expect(readProp(dupeBody, 'Status')).toBe('Fail');
    expect(readProp(dupeBody, 'Message')).toBe(apiMessages.duplicateDataExists);
  });

  test(`PROP-API-005 Customer Insert with duplicate TelephoneNo is rejected ${tags.regression} ${tags.negative} ${tags.p2}`, async ({
    apiClient,
    cleanup,
  }) => {
    assertAdminCredentialsReady();
    const companyId = apiClient.getCompanyId();
    expect(companyId, 'apiClient must be authenticated to obtain a CompanyId').not.toBeNull();

    const group = await createCustomerGroup(apiClient, { name: uniqueCode('CUSTGROUP'), companyId: companyId! });
    cleanup.register(group);

    const telephoneNo = randomData.phone11Digit();
    const first = await createCustomerApi(apiClient, {
      name: uniqueCode('CUSTOMER'),
      telephoneNo,
      companyId: companyId!,
      branchId: companyId!,
      customerGroupId: Number(group.id),
    });
    cleanup.register(first);

    // Deliberately a DIFFERENT Name, SAME TelephoneNo — confirmed exact
    // field the server checks (CustomerService.cs:39-50), scoped to
    // IsActive='1'. A same-Name-different-phone request would NOT be
    // rejected (source-confirmed), so that is not what this test sends.
    const dupeResponse = await apiClient.post('/api/Customer/Insert', {
      Name: uniqueCode('CUSTOMER2'),
      TelephoneNo: telephoneNo,
      CompanyId: companyId,
      BranchId: companyId,
      CustomerGroupId: Number(group.id),
      CreatedBy: 'automation',
    });
    const dupeBody = await dupeResponse.json();

    expect(readProp(dupeBody, 'Status')).toBe('Fail');
    expect(readProp(dupeBody, 'Message')).toBe(apiMessages.duplicateDataExists);
  });

  test(`PROP-API-006 Supplier Insert with duplicate Name is rejected ${tags.regression} ${tags.negative} ${tags.p2}`, async ({
    apiClient,
    cleanup,
  }) => {
    assertAdminCredentialsReady();
    const companyId = apiClient.getCompanyId();
    expect(companyId, 'apiClient must be authenticated to obtain a CompanyId').not.toBeNull();

    const group = await createSupplierGroup(apiClient, { name: uniqueCode('SUPPGROUP'), companyId: companyId! });
    cleanup.register(group);

    const name = uniqueCode('SUPPLIER');
    const first = await createSupplierApi(apiClient, {
      name,
      companyId: companyId!,
      branchId: companyId!,
      supplierGroupId: Number(group.id),
    });
    cleanup.register(first);

    const dupeResponse = await apiClient.post('/api/Supplier/Insert', {
      Name: name,
      CompanyId: companyId,
      BranchId: companyId,
      SupplierGroupId: Number(group.id),
      CreatedBy: 'automation',
    });
    const dupeBody = await dupeResponse.json();

    expect(readProp(dupeBody, 'Status')).toBe('Fail');
    expect(readProp(dupeBody, 'Message')).toBe(apiMessages.duplicateDataExists);
  });

  test(`PROP-API-007 BankAccount Insert with duplicate AccountNo is rejected ${tags.regression} ${tags.negative} ${tags.p2}`, async ({
    apiClient,
    cleanup,
  }) => {
    assertAdminCredentialsReady();
    const companyId = apiClient.getCompanyId();
    expect(companyId, 'apiClient must be authenticated to obtain a CompanyId').not.toBeNull();

    const bank = await createBankInformationApi(apiClient, { name: uniqueCode('BANKAPI'), companyId: companyId! });
    cleanup.register(bank);

    const accountNo = uniqueCode('ACCAPI');
    const first = await createBankAccountApi(apiClient, {
      accountNo,
      accountName: uniqueCode('BANKACCAPI'),
      bankId: Number(bank.id),
      branchName: 'Automation Branch',
      companyId: companyId!,
    });
    cleanup.register(first);

    const dupeResponse = await apiClient.post('/api/BankAccount/Insert', {
      AccountNo: accountNo,
      AccountName: uniqueCode('BANKACCAPI2'),
      BankId: Number(bank.id),
      BranchName: 'Automation Branch',
      CompanyId: companyId,
      CreatedBy: 'automation',
    });
    const dupeBody = await dupeResponse.json();

    expect(readProp(dupeBody, 'Status')).toBe('Fail');
    expect(readProp(dupeBody, 'Message')).toBe(apiMessages.duplicateDataExists);
  });
});
