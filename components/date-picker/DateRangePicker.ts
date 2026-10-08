import { Page } from '@playwright/test';

/**
 * jQuery daterangepicker (class="dateRange", singleDatePicker:true, format
 * YYYY-MM-DD) — confirmed on Sale/PurchaseOrder Create forms (STEP 1 §C).
 * A different library from Kendo's DatePicker (see ../kendo/KendoDatePicker.ts)
 * — do not use this helper for kendoDate/kendoDateTime fields and vice versa.
 *
 * LIVE DOM VERIFICATION RULE (see README.md): the popup calendar's own DOM
 * is unconfirmed against a live render — before first real use, verify the
 * typed-input commit behavior asserted below still applies, and adjust here.
 */
export class DateRangePicker {
  constructor(private readonly page: Page, private readonly fieldId: string) {}

  private input() {
    return this.page.locator(`#${this.fieldId}`);
  }

  /**
   * daterangepicker's bound input reflects typed changes once the field
   * loses focus / the picker is closed, matching manual-entry UX. Typing
   * directly avoids depending on the popup calendar's unconfirmed DOM.
   */
  async setDate(isoDate: string): Promise<void> {
    await this.input().fill(isoDate);
    await this.input().press('Escape'); // close the picker without navigating away
  }

  async getDate(): Promise<string> {
    return (await this.input().inputValue()) ?? '';
  }
}
