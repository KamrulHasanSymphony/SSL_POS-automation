import { test, expect } from '../../../fixtures/masters4.fixture';
import { assertAdminCredentialsReady } from '../../../utils/env';
import { tags } from '../../../config/tags';

/**
 * STEP 9 Phase C module: MasterSupplierItem (PROP-MSUPPITEM-001..005),
 * approved exactly as documented in STEP 9.1/9.2C. Runs under the
 * "authenticated" project. Requires 1 real MasterSupplier and 1 real
 * MasterItem (in its own fresh MasterItemGroup) — see
 * masters4.fixture.ts's masterSupplierItemPrerequisites, which chains the
 * existing MasterSupplier(Group) and MasterItem(Group) prerequisites
 * rather than guessing any reference ID.
 *
 * Confirmed: this VM has no `Code` property — `MasterSupplierName` (the
 * grid's own confirmed search field) is the per-test unique identifier
 * instead. Item-picking is a plain Kendo grid with an inline "Add" button,
 * not a popup — see pages/masters/MasterSupplierItemPage.ts.
 *
 * Delete is explicitly OUT OF SCOPE: button commented out on Index. The
 * confirmed broken NextPrevious/bulk-delete defects noted in STEP 9.1 are
 * NOT converted into @known-defect tests here per this phase's explicit
 * instruction — none of the approved scenarios below touch them.
 */
test.describe('MasterSupplierItem — PROP-MSUPPITEM', () => {
  test(`PROP-MSUPPITEM-001 List/grid loads ${tags.regression} ${tags.p1}`, async ({
    masterSupplierItemPage,
    masterSupplierItemPrerequisites,
  }) => {
    assertAdminCredentialsReady();

    const { supplierName, masterItemGroupName } = await masterSupplierItemPrerequisites();
    await masterSupplierItemPage.createMasterSupplierItem({ supplierName, masterItemGroupName });

    await masterSupplierItemPage.goto();
    await masterSupplierItemPage.grid.search(supplierName);
    await masterSupplierItemPage.grid.waitForLoad();
    expect(await masterSupplierItemPage.grid.rowCount()).toBeGreaterThanOrEqual(1);
    await expect(await masterSupplierItemPage.grid.findRowByText(supplierName)).toBeVisible();
  });

  test(`PROP-MSUPPITEM-002 Create with Supplier + at least one picked item ${tags.regression} ${tags.p0}`, async ({
    masterSupplierItemPage,
    masterSupplierItemPrerequisites,
  }) => {
    assertAdminCredentialsReady();

    const { supplierName, masterItemGroupName } = await masterSupplierItemPrerequisites();
    await masterSupplierItemPage.createMasterSupplierItem({ supplierName, masterItemGroupName });

    await masterSupplierItemPage.goto();
    await masterSupplierItemPage.grid.search(supplierName);
    await expect(await masterSupplierItemPage.grid.findRowByText(supplierName)).toBeVisible();
  });

  test(`PROP-MSUPPITEM-003 Create without Supplier rejected ${tags.regression} ${tags.negative} ${tags.p1}`, async ({
    masterSupplierItemPage,
    masterSupplierItemPrerequisites,
    page,
  }) => {
    assertAdminCredentialsReady();

    const { masterItemGroupName } = await masterSupplierItemPrerequisites();
    await masterSupplierItemPage.gotoCreate();
    // Supplier deliberately left unselected; a real item is still picked so
    // the ONLY failure surfaced is the Supplier-required check, not a
    // secondary "add at least one detail" complaint.
    await masterSupplierItemPage.selectMasterItemGroup(masterItemGroupName);
    await masterSupplierItemPage.addFirstAvailableItem();
    await masterSupplierItemPage.clickSave();

    await masterSupplierItemPage.expectSupplierRequiredIndicated();
    await expect(page).toHaveURL(/\/DMS\/MasterSupplierItem\/Create/i);
  });

  test(`PROP-MSUPPITEM-004 Edit and verify persistence ${tags.regression} ${tags.p1}`, async ({
    masterSupplierItemPage,
    masterSupplierItemPrerequisites,
  }) => {
    assertAdminCredentialsReady();

    const { supplierName, masterItemGroupName, itemName } = await masterSupplierItemPrerequisites();
    await masterSupplierItemPage.createMasterSupplierItem({ supplierName, masterItemGroupName });

    await masterSupplierItemPage.openEditFor(supplierName);
    await masterSupplierItemPage.expectAddedItemVisible(itemName);
  });

  test(`PROP-MSUPPITEM-005 Grid search filters ${tags.regression} ${tags.p2}`, async ({
    masterSupplierItemPage,
    masterSupplierItemPrerequisites,
  }) => {
    assertAdminCredentialsReady();

    const { supplierName, masterItemGroupName } = await masterSupplierItemPrerequisites();
    await masterSupplierItemPage.createMasterSupplierItem({ supplierName, masterItemGroupName });

    await masterSupplierItemPage.goto();
    await masterSupplierItemPage.grid.search(supplierName);
    await masterSupplierItemPage.grid.waitForLoad();

    expect(await masterSupplierItemPage.grid.rowCount()).toBe(1);
    await expect(await masterSupplierItemPage.grid.findRowByText(supplierName)).toBeVisible();
  });
});
