import { Page } from '@playwright/test';

/**
 * Kendo DatePicker / DateTimePicker — confirmed on PurchaseOrder's OrderDate
 * (class "kendoDate") and DeliveryDateTime (class "kendoDateTime"), and on
 * CompanyProfile's FYearStart/FYearEnd (STEP 1 §C). Distinct from the jQuery
 * daterangepicker used on Sale/PurchaseOrder list filters — see
 * components/date-picker/DateRangePicker.ts for that one. Do not assume
 * either implementation without checking the field's class per STEP 1 §C.
 *
 * LIVE DOM VERIFICATION RULE (see README.md): the calendar-popup DOM is
 * unconfirmed against a live render — before first real use, verify the
 * typed-input commit behavior asserted below still applies, and adjust here.
 */
export class KendoDatePicker {
  constructor(private readonly page: Page, private readonly fieldId: string) {}

  private input() {
    return this.page.locator(`#${this.fieldId}`);
  }

  /**
   * Kendo DatePicker's bound input generally accepts direct typed input in
   * the widget's configured format (confirmed format yyyy-MM-dd on
   * CompanyProfile). Prefer typing over calendar-popup clicking — far more
   * reliable across Kendo versions and avoids depending on unconfirmed
   * calendar-popup DOM.
   */
  async setDate(isoDate: string): Promise<void> {
    await this.input().fill(isoDate);
    await this.input().press('Tab'); // commit the value, matching manual-entry UX
  }

  async getDate(): Promise<string> {
    return (await this.input().inputValue()) ?? '';
  }
}
