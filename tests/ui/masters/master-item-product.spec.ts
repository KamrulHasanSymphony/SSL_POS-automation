import { test } from '../../../fixtures/masters6.fixture';
import { assertAdminCredentialsReady } from '../../../utils/env';
import { uniqueCode } from '../../../utils/random-data';
import { tags } from '../../../config/tags';

/**
 * STEP 10 Phase B module: MasterItemProduct (PROP-MITEMPROD-001..002),
 * approved exactly as documented in STEP 10.2/10.3B. Runs under the
 * "authenticated" project. Create-only "convert Master Item -> Product"
 * flow, reached via the confirmed-live "From Master Item" button on
 * `Product/Index.cshtml`. See pages/masters/MasterItemProductPage.ts for
 * the full source trail: `#departments` is unfiltered (shows ALL existing
 * MasterItems, paginated, no search box) — `findAndAddItem()` pages
 * through it looking for the freshly-created item by name.
 */
test.describe('MasterItemProduct — PROP-MITEMPROD', () => {
  test(`PROP-MITEMPROD-001 Create from Master Item succeeds ${tags.regression} ${tags.p0}`, async ({
    masterItemProductPage,
    masterItemPage,
    masterItemPrerequisites,
  }) => {
    assertAdminCredentialsReady();

    const { masterItemGroupName, uomName } = await masterItemPrerequisites();
    const itemName = uniqueCode('MITEMPROD');
    await masterItemPage.createMasterItem({ name: itemName, masterItemGroupName, uomName });

    await masterItemProductPage.createFromMasterItem(itemName);
  });

  test(`PROP-MITEMPROD-002 Create without a picked item rejected ${tags.regression} ${tags.negative} ${tags.p1}`, async ({
    masterItemProductPage,
  }) => {
    assertAdminCredentialsReady();

    await masterItemProductPage.clickSaveWithoutDetail();
    await masterItemProductPage.expectAtLeastOneDetailRequired();
  });
});
