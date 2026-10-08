import { Page, expect } from '@playwright/test';
import { BasePage } from '../common/BasePage';
import { registrationFormSelectors, registrationValidationMessages } from '../../utils/constants';

export interface RegistrationCreateData {
  fullName: string;
  emailAsLoginId: string;
  phoneNumber: string;
  password: string;
  companyName: string;
  companyAddress: string;
}

/**
 * Areas/SetUp/Controllers/RegistrationController.cs +
 * Views/Registration/RegistrationCreate.cshtml, confirmed at STEP 10.3C.
 * Public pre-login screen (no `[Authorize]`), reachable via
 * `Login/Index.cshtml`'s "Create Account" link. Binds to `UserProfileVM`
 * server-side despite the view being typed to `RegistrationVM` — matching
 * field names bind correctly regardless. Standard validate-before-confirm
 * ordering, standard `.btnsave.sslSave` button.
 */
export class RegistrationPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async gotoCreate(): Promise<void> {
    await this.page.goto('/SetUp/Registration/RegistrationCreate');
  }

  async fillRequired(data: RegistrationCreateData): Promise<void> {
    await this.page.locator(registrationFormSelectors.fullName).fill(data.fullName);
    await this.page.locator(registrationFormSelectors.emailAsLoginId).fill(data.emailAsLoginId);
    await this.page.locator(registrationFormSelectors.phoneNumber).fill(data.phoneNumber);
    await this.page.locator(registrationFormSelectors.password).fill(data.password);
    await this.page.locator(registrationFormSelectors.confirmPassword).fill(data.password);
    await this.page.locator(registrationFormSelectors.companyName).fill(data.companyName);
    await this.page.locator(registrationFormSelectors.companyAddress).fill(data.companyAddress);
  }

  async createRegistration(data: RegistrationCreateData): Promise<void> {
    await this.gotoCreate();
    await this.fillRequired(data);
    await this.clickSave();
    await this.toastr.expectSuccess();
  }

  async expectCompanyNameRequiredValidation(): Promise<void> {
    await expect(this.page.locator(registrationFormSelectors.companyNameValidationMessage)).toHaveText(
      registrationValidationMessages.companyNameRequired
    );
  }
}
