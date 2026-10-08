import { Page } from '@playwright/test';

/**
 * SweetAlert2 / bootbox confirmation dialogs, used for Delete/Post confirmations
 * (confirmed in STEP 1 §G, e.g. CampaignController.js's Confirmation() pattern —
 * that specific module is orphaned, but the same shared confirm pattern is used
 * elsewhere for Delete/Post actions across live modules).
 *
 * SweetAlert2's default rendered classes (.swal2-confirm/.swal2-cancel) and
 * bootbox's default classes (.bootbox .btn-primary/.btn-default) are library-
 * standard, not app-invented — but which library backs any given confirmation
 * was not re-confirmed per-module against live DOM. This helper tries both.
 *
 * LIVE DOM VERIFICATION RULE (see README.md): before using this component in
 * the first real automation test for a given module, verify which library
 * (SweetAlert2 vs bootbox) actually renders that module's confirmation and
 * adjust the selectors here — not with a one-off workaround in the test.
 */
export class ConfirmDialog {
  constructor(private readonly page: Page) {}

  private confirmButton() {
    return this.page.locator(
      '.swal2-confirm, .bootbox .btn-primary, [role="dialog"] button:has-text("OK"), [role="dialog"] button:has-text("Yes")'
    ).first();
  }

  private cancelButton() {
    return this.page.locator(
      '.swal2-cancel, .bootbox .btn-default, [role="dialog"] button:has-text("Cancel"), [role="dialog"] button:has-text("No")'
    ).first();
  }

  async accept(): Promise<void> {
    await this.confirmButton().waitFor({ state: 'visible' });
    await this.confirmButton().click();
  }

  /**
   * STEP 5 addition: several Product/Customer/Supplier Save-button click
   * handlers only show this Bootbox confirmation AFTER their own client-side
   * validation (`form.valid()` + CommonValidationHelper.CheckValidation)
   * already passes — confirmed directly from source (e.g.
   * CustomerController.js: `if (!mvcValid || !customValid) { return false; }`
   * runs before `Confirmation(...)` is ever called). For negative-path tests
   * that intentionally leave a required field empty, whether this dialog
   * appears at all depends on which validation layer catches that specific
   * field (native unobtrusive vs. a Kendo-combo-specific check inside the
   * post-confirm handler) — not fully confirmed against a live render for
   * every field. Tolerates both orders: accepts the dialog if it appears
   * within `timeoutMs`, no-ops (returns false) if it never does, so callers
   * don't have to guess which path a given field takes.
   */
  async acceptIfPresent(timeoutMs = 3000): Promise<boolean> {
    const shown = await this.confirmButton()
      .waitFor({ state: 'visible', timeout: timeoutMs })
      .then(() => true)
      .catch(() => false);
    if (shown) {
      await this.confirmButton().click();
    }
    return shown;
  }

  async cancel(): Promise<void> {
    await this.cancelButton().waitFor({ state: 'visible' });
    await this.cancelButton().click();
  }
}
