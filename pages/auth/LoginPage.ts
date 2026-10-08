import { Page, expect } from '@playwright/test';
import { loginSelectors, routes } from '../../utils/constants';

/**
 * Views/Login/Index.cshtml (root LoginController). Fields/routes/validation
 * messages re-confirmed directly from source at STEP 4 implementation time —
 * see utils/constants.ts for what changed versus the original STEP 1 notes.
 */
export class LoginPage {
  constructor(private readonly page: Page) {}

  async goto(): Promise<void> {
    // STEP 13: routes.login is now an assertion-matching pattern (see
    // utils/constants.ts), not a literal path — routes.loginEntry is the
    // actual navigable URL.
    await this.page.goto(routes.loginEntry);
  }

  async fillUsername(username: string): Promise<void> {
    await this.page.locator(loginSelectors.username).fill(username);
  }

  async fillPassword(password: string): Promise<void> {
    await this.page.locator(loginSelectors.password).fill(password);
  }

  async submit(): Promise<void> {
    await this.page.locator(loginSelectors.submitButton).click();
  }

  /**
   * Performs a full login attempt. Does not assert outcome — callers decide
   * whether they're testing success or failure. Never logs the password
   * value itself (fill() does not print it; callers must not console.log
   * the `password` argument either).
   */
  async login(username: string, password: string): Promise<void> {
    await this.goto();
    await this.fillUsername(username);
    await this.fillPassword(password);
    await this.submit();
  }

  async togglePasswordVisibility(): Promise<void> {
    await this.page.locator(loginSelectors.passwordToggle).click();
  }

  async passwordInputType(): Promise<string | null> {
    return this.page.locator(loginSelectors.password).getAttribute('type');
  }

  /** Top flash-message alert (TempData["ErrorMessage"], e.g. bad credentials). */
  async getErrorMessage(): Promise<string> {
    return (await this.page.locator(loginSelectors.errorAlert).textContent())?.trim() ?? '';
  }

  /** Inline client-side validation span for the UserName field. */
  async getUsernameValidationMessage(): Promise<string> {
    return (
      (await this.page.locator(loginSelectors.usernameValidationMessage).textContent())?.trim() ?? ''
    );
  }

  /** Inline client-side validation span for the Password field. */
  async getPasswordValidationMessage(): Promise<string> {
    return (
      (await this.page.locator(loginSelectors.passwordValidationMessage).textContent())?.trim() ?? ''
    );
  }

  /**
   * Asserts the page is still (or again) on the login screen — used by
   * negative-path tests instead of asserting a specific error string, since
   * the error message rendering mechanism (flash-redirect vs inline client
   * validation) differs between bad-credentials and empty-field failures.
   */
  async expectStillOnLoginPage(): Promise<void> {
    await expect(this.page).toHaveURL(new RegExp(routes.login.replace('/', '\\/')));
  }
}
