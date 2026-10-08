import { test, expect } from '../../../fixtures/masters6.fixture';
import { assertAdminCredentialsReady } from '../../../utils/env';
import { uniqueCode } from '../../../utils/random-data';
import { tags } from '../../../config/tags';

/**
 * STEP 10 Phase B module: MasterSupplierProduct (PROP-MSUPPPROD-001..003),
 * approved exactly as documented in STEP 10.2/10.3B. Runs under the
 * "authenticated" project (PROP-MSUPPPROD-003 uses the dedicated
 * `unauthenticatedPage` fixture for its one-off unauthenticated check,
 * per this project's established pattern — see fixtures/auth.fixture.ts).
 * Create-only "convert Master Supplier -> Supplier" flow, reached via the
 * confirmed-live "From Master Supplier" button on `Supplier/Index.cshtml`.
 *
 * CONFIRMED SECURITY GAP (verbatim, not tagged @known-defect without
 * separate approval per explicit instruction):
 * `MasterSupplierProductController.cs` — `public class
 * MasterSupplierProductController : Controller` — carries NO
 * `[Authorize]`/`[RouteArea]` attribute at all, unlike every sibling
 * controller including its own `MasterItemProductController` counterpart.
 */
test.describe('MasterSupplierProduct — PROP-MSUPPPROD', () => {
  test(`PROP-MSUPPPROD-001 Create from Master Supplier succeeds ${tags.regression} ${tags.p0}`, async ({
    masterSupplierProductPage,
    masterSupplierPage,
    masterSupplierGroupPrerequisite,
  }) => {
    assertAdminCredentialsReady();

    const { groupName } = await masterSupplierGroupPrerequisite();
    const supplierName = uniqueCode('MSUPPPROD');
    await masterSupplierPage.createMasterSupplier({
      name: supplierName,
      masterSupplierGroupName: groupName,
      address: `Automation Address ${uniqueCode('ADDR')}`,
    });

    await masterSupplierProductPage.createFromMasterSupplier(supplierName);
  });

  test(`PROP-MSUPPPROD-002 Create without a picked item rejected ${tags.regression} ${tags.negative} ${tags.p1}`, async ({
    masterSupplierProductPage,
  }) => {
    assertAdminCredentialsReady();

    await masterSupplierProductPage.clickSaveWithoutDetail();
    await masterSupplierProductPage.expectAtLeastOneDetailRequired();
  });

  test(`PROP-MSUPPPROD-003 Unauthenticated access reaches Create (confirmed missing [Authorize]) ${tags.regression} ${tags.security} ${tags.p1}`, async ({
    unauthenticatedPage,
  }) => {
    const response = await unauthenticatedPage.goto('/DMS/MasterSupplierProduct/Create');

    // SECURITY FINDING (confirmed by source, not assumed): no [Authorize]
    // attribute exists on this controller, so a session-less request is
    // NOT redirected to /Login/Index like every other DMS screen. Asserting
    // the CONFIRMED actual behavior, not the expected-secure one.
    expect(response?.status()).toBeLessThan(400);
    await expect(unauthenticatedPage).not.toHaveURL(/\/Login\/Index/i);
    await expect(unauthenticatedPage.locator('#departments')).toBeVisible();
  });
});
