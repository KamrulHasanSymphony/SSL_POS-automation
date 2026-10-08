import { test, expect } from '../../../fixtures/masters7.fixture';
import { assertAdminCredentialsReady } from '../../../utils/env';
import { uniqueCode } from '../../../utils/random-data';
import { tags } from '../../../config/tags';

/**
 * STEP 10 Phase C module: SignUp (PROP-SIGNUP-001..003), approved exactly
 * as documented in STEP 10.2/10.3C. See pages/setup/SignUpPage.ts for the
 * full source trail: public pre-login screen, no `[Authorize]` by design;
 * PhoneNumber has no rendered validation message span on this specific
 * screen (confirmed), so its negative case asserts the jQuery Validate
 * error-class marker instead of an exact message string; Email DOES have
 * a message span, asserted exactly.
 */
test.describe('SignUp — PROP-SIGNUP', () => {
  test(`PROP-SIGNUP-001 Create succeeds ${tags.regression} ${tags.p0}`, async ({ signUpPage }) => {
    assertAdminCredentialsReady();

    const userName = uniqueCode('SIGNUP');
    const userId = await signUpPage.createSignUp({
      userName,
      fullName: `Automation SignUp ${userName}`,
      email: `${userName.toLowerCase()}@example.com`,
      password: 'Automation@123',
      phoneNumber: '01700000000',
    });

    expect(userId).toBeTruthy();
  });

  test(`PROP-SIGNUP-002 Create with invalid Phone Number rejected ${tags.regression} ${tags.negative} ${tags.p1}`, async ({
    signUpPage,
    page,
  }) => {
    assertAdminCredentialsReady();

    const userName = uniqueCode('SIGNUP');
    await signUpPage.gotoCreate();
    await signUpPage.fillRequired({
      userName,
      fullName: `Automation SignUp ${userName}`,
      email: `${userName.toLowerCase()}@example.com`,
      password: 'Automation@123',
      phoneNumber: '123',
    });
    await signUpPage.clickSave();

    await signUpPage.expectPhoneNumberMarkedInvalid();
    await expect(page).toHaveURL(/\/Login\/SignUp|\/SetUp\/SignUp\/SignUpCreate/i);
  });

  test(`PROP-SIGNUP-003 Create with invalid Email rejected ${tags.regression} ${tags.negative} ${tags.p1}`, async ({
    signUpPage,
    page,
  }) => {
    assertAdminCredentialsReady();

    const userName = uniqueCode('SIGNUP');
    await signUpPage.gotoCreate();
    await signUpPage.fillRequired({
      userName,
      fullName: `Automation SignUp ${userName}`,
      email: 'not-an-email',
      password: 'Automation@123',
      phoneNumber: '01700000000',
    });
    await signUpPage.clickSave();

    await signUpPage.expectEmailInvalidValidation();
    await expect(page).toHaveURL(/\/Login\/SignUp|\/SetUp\/SignUp\/SignUpCreate/i);
  });
});
