import { Page } from '@playwright/test';
import { KendoComboBox } from './KendoComboBox';

/**
 * Kendo MultiColumnComboBox — confirmed used for UserProfile's RoleId field
 * (STEP 1 §C, source: /SetUp/MenuAuthorization/GetRoleData). Behaviorally
 * identical to KendoComboBox from an interaction standpoint (type-ahead +
 * single selection); the extra columns are a rendering detail, not an
 * interaction difference, so this simply extends the base combo helper
 * rather than duplicating its logic. Split out as its own class per the
 * STEP 3 folder structure and in case row-level column assertions are
 * needed later (e.g. asserting a specific column's value in the popup list).
 *
 * LIVE DOM VERIFICATION RULE (see README.md): inherits KendoComboBox's
 * unconfirmed-selector caveat — verify against the live rendered page before
 * first real use, and adjust the base class rather than working around it here.
 */
export class KendoMultiColumnComboBox extends KendoComboBox {
  constructor(page: Page, fieldId: string) {
    super(page, fieldId);
  }

  async selectByRowText(rowText: string): Promise<void> {
    await this.selectByText(rowText);
  }
}
