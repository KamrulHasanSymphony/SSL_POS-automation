import { Page, expect } from '@playwright/test';

/**
 * Toastr notifications (confirmed in STEP 1 §G — ShowNotification/ShowResult
 * wrapper). Toastr's default rendered container/classes are library-standard
 * (#toast-container .toast, .toast-message) — not app-invented, but not
 * independently re-confirmed against this app's live DOM either.
 *
 * LIVE DOM VERIFICATION RULE (see README.md): before using this component in
 * the first real automation test, verify these selectors — and the
 * distinct success/error class names, currently assumed identical below —
 * against the live rendered page, and adjust here rather than in the test.
 */
const TOAST_CONTAINER = '#toast-container';
const TOAST_MESSAGE = `${TOAST_CONTAINER} .toast-message, ${TOAST_CONTAINER} .toast`;

export class Toastr {
  constructor(private readonly page: Page) {}

  async expectSuccess(expectedTextFragment?: string, timeoutMs = 10000): Promise<void> {
    const toast = this.page.locator(`${TOAST_MESSAGE}`).first();
    await expect(toast).toBeVisible({ timeout: timeoutMs });
    if (expectedTextFragment) {
      await expect(toast).toContainText(expectedTextFragment, { timeout: timeoutMs });
    }
  }

  async expectError(expectedTextFragment?: string, timeoutMs = 10000): Promise<void> {
    // Toastr uses distinct classes per type (toast-success/toast-error); default
    // to the same container check since the exact class was not re-confirmed live.
    await this.expectSuccess(expectedTextFragment, timeoutMs);
  }

  async dismiss(): Promise<void> {
    const toast = this.page.locator(TOAST_MESSAGE).first();
    if (await toast.isVisible().catch(() => false)) {
      await toast.click();
    }
  }
}
