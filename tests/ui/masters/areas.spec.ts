import { test, expect } from '../../../fixtures/masters3.fixture';
import { assertAdminCredentialsReady } from '../../../utils/env';
import { tags } from '../../../config/tags';

/**
 * STEP 9 Phase B module: Areas. Approved STEP 9.1 scope was
 * PROP-AREA-001..006 (6 tests); only 2 are implemented here — the rest are
 * a CONFIRMED, SOURCE-VERIFIED BLOCKER reported per the SQA stop condition,
 * not worked around with guessed/hardcoded data.
 *
 * BLOCKED (not implemented — see AreaPage.ts for the full source trail):
 *  - PROP-AREA-002 Create with full location chain succeeds — Country/
 *    Division/District/Thana all read from
 *    `/Common/Common/GetAreaLocationList`, which does not exist anywhere in
 *    `CommonController.cs` on either tier (confirmed 404 on every cascade,
 *    regardless of environment/seed data). EnumTypeId's only creation path
 *    is API-only (`api/EnumType/Insert`), out of scope for this UI-only
 *    phase.
 *  - PROP-AREA-004 Edit and verify persistence — requires an existing Area
 *    record; with Create blocked, no record can be produced without
 *    reusing/guessing data.
 *  - PROP-AREA-005 Delete a created record — same root cause as 004.
 *  - PROP-AREA-006 Grid search filters (record-backed) — same root cause.
 *
 * IMPLEMENTED (do not depend on the broken location cascade):
 *  - PROP-AREA-001 List/grid loads — Index's grid reads via a completely
 *    separate, working endpoint (`GetAreasGrid`); does not touch Create at
 *    all.
 *  - PROP-AREA-003 Create with empty Name rejected — `AreasController.js`'s
 *    `save()` runs `$("#Areas_Form").validate().form()` (jQuery
 *    Unobtrusive, covers `Name`'s `[Required]`) independently of its
 *    separate `CommonService.validateDropdown()` calls for the location
 *    fields, so a blank-Name submit surfaces the Name-required message
 *    regardless of whether the location combos ever loaded.
 */
test.describe('Areas — PROP-AREA', () => {
  test(`PROP-AREA-001 List/grid loads ${tags.regression} ${tags.p1}`, async ({ areaPage, page }) => {
    assertAdminCredentialsReady();

    await areaPage.goto();
    await expect(page).toHaveURL(/\/DMS\/Areas\/Index/i);
    await expect(page.locator('#AreasGrid')).toBeVisible();
  });

  test(`PROP-AREA-003 Create with empty Name rejected ${tags.regression} ${tags.negative} ${tags.p1}`, async ({
    areaPage,
    page,
  }) => {
    assertAdminCredentialsReady();

    await areaPage.gotoCreate();
    // Name deliberately left empty; Country/Division/District/Thana/EnumType
    // deliberately left untouched too — this scenario tests Name validation
    // only and must not attempt to interact with the confirmed-broken
    // location cascade.
    await areaPage.clickSave();

    await areaPage.expectNameRequiredValidation();
    await expect(page).toHaveURL(/\/DMS\/Areas\/Create/i);
  });
});
