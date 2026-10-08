import { Page } from '@playwright/test';
import { BasePage } from '../common/BasePage';
import { routes, settingsSelectors } from '../../utils/constants';

/**
 * Areas/SetUp/Controllers/SettingsController.cs +
 * Views/Settings/{Index,_Setting}.cshtml, confirmed at STEP 10.3C.
 * Confirmed singleton (no Create/Delete). Each setting row is its own
 * plain HTML `<form>` (full page POST + redirect, not AJAX). CONFIRMED
 * RISK: every row's `SettingValue` input renders the same
 * `id="SettingValue"` (no id-uniquification in the `@Html.Partial`
 * foreach loop) — a bare `#SettingValue` selector would be ambiguous, so
 * all interaction here is scoped to the row containing "DMSApiUrl", the
 * one setting `SettingsController.Index()` confirms is always
 * present (unconditionally inserted on every load).
 */
const TARGET_GROUP = 'DMSApiUrl';

export class SettingsPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async goto(): Promise<void> {
    await this.page.goto(routes.setup('Settings', 'Index'));
  }

  private targetRow() {
    return this.page.locator(settingsSelectors.settingRowByGroup(TARGET_GROUP));
  }

  async getSettingValue(): Promise<string> {
    return (await this.targetRow().locator('input.required[name="SettingValue"]').inputValue()) ?? '';
  }

  async updateSettingValue(value: string): Promise<void> {
    await this.goto();
    const row = this.targetRow();
    await row.locator('input.required[name="SettingValue"]').fill(value);
    await row.getByRole('button', { name: 'Update' }).click();
    await this.page.waitForLoadState('load');
  }

  async expectUpdateNotification(): Promise<void> {
    await this.toastr.expectSuccess();
  }
}
