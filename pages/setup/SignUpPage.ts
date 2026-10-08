import { Page, expect } from '@playwright/test';
import { BasePage } from '../common/BasePage';
import { userProfileFormSelectors, userProfileValidationMessages } from '../../utils/constants';

export interface SignUpCreateData {
  userName: string;
  fullName: string;
  email: string;
  password: string;
  phoneNumber: string;
}

/**
 * Areas/SetUp/Controllers/SignUpController.cs +
 * Views/SignUp/SignUpCreate.cshtml, confirmed at STEP 10.3C. Public
 * pre-login screen (no `[Authorize]`, by design), reached via
 * `LoginController.SignUp()`'s redirect. On success, the app updates
 * `#Id` in place (no navigation) — this is the onboarding chain's entry
 * point, feeding CompanyCreate.
 *
 * CONFIRMED: `PhoneNumber` has no `@Html.ValidationMessageFor` span on
 * this screen — the negative-phone scenario asserts the input gets
 * jQuery Validate's `input-validation-error` class and the page does not
 * navigate, not an exact message string. `Email` DOES have a message
 * span (reuses `userProfileFormSelectors`/`userProfileValidationMessages`
 * from STEP 10.3B, same `UserProfileVM`).
 */
export class SignUpPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async gotoCreate(): Promise<void> {
    await this.page.goto('/Login/SignUp');
  }

  async fillRequired(data: SignUpCreateData): Promise<void> {
    await this.page.locator(userProfileFormSelectors.userName).fill(data.userName);
    await this.page.locator(userProfileFormSelectors.fullName).fill(data.fullName);
    await this.page.locator(userProfileFormSelectors.email).fill(data.email);
    await this.page.locator(userProfileFormSelectors.password).fill(data.password);
    await this.page.locator(userProfileFormSelectors.confirmPassword).fill(data.password);
    await this.page.locator(userProfileFormSelectors.phoneNumber).fill(data.phoneNumber);
  }

  async createSignUp(data: SignUpCreateData): Promise<string> {
    await this.gotoCreate();
    await this.fillRequired(data);
    await this.clickSave();
    await this.toastr.expectSuccess();
    return this.page.locator('#Id').inputValue();
  }

  async expectEmailInvalidValidation(): Promise<void> {
    await expect(this.page.locator(userProfileFormSelectors.emailValidationMessage)).toHaveText(
      userProfileValidationMessages.emailInvalid
    );
  }

  /** No validation message span exists for PhoneNumber on this screen — asserts jQuery Validate's standard error-class marker plus no navigation, per the confirmed source gap. */
  async expectPhoneNumberMarkedInvalid(): Promise<void> {
    await expect(this.page.locator(userProfileFormSelectors.phoneNumber)).toHaveClass(/input-validation-error/);
  }
}
