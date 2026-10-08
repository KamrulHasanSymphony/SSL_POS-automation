import { test, expect } from '../../../fixtures/masters7.fixture';
import { assertAdminCredentialsReady } from '../../../utils/env';
import { uniqueCode } from '../../../utils/random-data';
import { tags } from '../../../config/tags';

/**
 * STEP 10 Phase C module: Registration (PROP-REG-001..002), approved
 * exactly as documented in STEP 10.2/10.3C. See pages/setup/RegistrationPage.ts
 * for the full source trail: public pre-login screen, reachable via
 * Login/Index.cshtml's "Create Account" link. Negative scenario targets
 * CompanyName (has a confirmed, rendered validation message span) rather
 * than PhoneNumber (confirmed no span on this screen, same gap as SignUp).
 */
test.describe('Registration — PROP-REG', () => {
  test(`PROP-REG-001 Create succeeds ${tags.regression} ${tags.p2}`, async ({ registrationPage }) => {
    assertAdminCredentialsReady();

    const suffix = uniqueCode('REG');
    await registrationPage.createRegistration({
      fullName: `Automation Registration ${suffix}`,
      emailAsLoginId: `${suffix.toLowerCase()}@example.com`,
      phoneNumber: '01700000000',
      password: 'Automation@123',
      companyName: `Automation Company ${suffix}`,
      companyAddress: `Automation Address ${uniqueCode('ADDR')}`,
    });
  });

  test(`PROP-REG-002 Create with empty required field rejected ${tags.regression} ${tags.negative} ${tags.p2}`, async ({
    registrationPage,
    page,
  }) => {
    assertAdminCredentialsReady();

    const suffix = uniqueCode('REG');
    await registrationPage.gotoCreate();
    await registrationPage.fillRequired({
      fullName: `Automation Registration ${suffix}`,
      emailAsLoginId: `${suffix.toLowerCase()}@example.com`,
      phoneNumber: '01700000000',
      password: 'Automation@123',
      companyName: '',
      companyAddress: `Automation Address ${uniqueCode('ADDR')}`,
    });
    await registrationPage.clickSave();

    await registrationPage.expectCompanyNameRequiredValidation();
    await expect(page).toHaveURL(/\/SetUp\/Registration\/RegistrationCreate/i);
  });
});
