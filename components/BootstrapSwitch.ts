import { Page } from '@playwright/test';

/**
 * bootstrap-switch toggles used for all IsActive-style boolean fields instead
 * of plain checkboxes (confirmed STEP 1 §G). The underlying <input type="checkbox">
 * remains in the DOM (bootstrap-switch wraps it visually) — click the wrapper
 * span, not the now-hidden original input, since the library moves the
 * original off-screen.
 *
 * Known app-specific risk (confirmed STEP 1 §C): on Product/Create the switch's
 * id="IsActive" but name="my-checkbox" (mismatched); on TableSection/Create id
 * and name both correctly match "IsActive". Always locate by the confirmed
 * field id passed in, never assume name matches id.
 *
 * LIVE DOM VERIFICATION RULE (see README.md): the wrapper class and
 * bootstrap-switch-container click target are library-standard defaults, not
 * re-confirmed against this app's live DOM — verify before first real use.
 */
export class BootstrapSwitch {
  constructor(private readonly page: Page, private readonly fieldId: string) {}

  private wrapper() {
    // bootstrap-switch's default rendered wrapper class — library-standard,
    // scoped to the original input's id via :has() so it survives id/name mismatches.
    return this.page.locator(`.bootstrap-switch:has(#${this.fieldId})`);
  }

  async isOn(): Promise<boolean> {
    const input = this.page.locator(`#${this.fieldId}`);
    return input.isChecked();
  }

  async setOn(on: boolean): Promise<void> {
    const currentlyOn = await this.isOn();
    if (currentlyOn !== on) {
      await this.wrapper().locator('.bootstrap-switch-container').click();
    }
  }
}
