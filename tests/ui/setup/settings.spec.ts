import { test, expect } from '../../../fixtures/masters7.fixture';
import { assertAdminCredentialsReady } from '../../../utils/env';
import { uniqueCode } from '../../../utils/random-data';
import { tags } from '../../../config/tags';

/**
 * STEP 10 Phase C module: Settings (PROP-SETTINGS-001..002), approved
 * exactly as documented in STEP 10.2/10.3C. See pages/setup/SettingsPage.ts
 * for the full source trail: confirmed singleton (no Create/Delete), each
 * row is its own plain HTML form (full page POST, not AJAX); interaction
 * is scoped to the "DMSApiUrl" row, the one setting confirmed always
 * present.
 */
test.describe('Settings — PROP-SETTINGS', () => {
  test(`PROP-SETTINGS-001 Edit succeeds ${tags.regression} ${tags.p2}`, async ({ settingsPage }) => {
    assertAdminCredentialsReady();

    const newValue = uniqueCode('SETTINGVAL');
    await settingsPage.updateSettingValue(newValue);

    await settingsPage.expectUpdateNotification();
  });

  test(`PROP-SETTINGS-002 Edit persists ${tags.regression} ${tags.p2}`, async ({ settingsPage }) => {
    assertAdminCredentialsReady();

    const newValue = uniqueCode('SETTINGVAL');
    await settingsPage.updateSettingValue(newValue);

    await settingsPage.goto();
    expect(await settingsPage.getSettingValue()).toBe(newValue);
  });
});
