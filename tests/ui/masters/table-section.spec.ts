import { test, expect } from '../../../fixtures/masters2.fixture';
import { assertAdminCredentialsReady } from '../../../utils/env';
import { uniqueCode } from '../../../utils/random-data';
import { tags } from '../../../config/tags';

/**
 * STEP 9 Phase A module: TableSection (PROP-TSEC-001..005), approved
 * exactly as documented in STEP 9.1/9.2A. Runs under the "authenticated"
 * project. Flat lookup master, no dependencies, no `#Code` field.
 *
 * Delete is explicitly OUT OF SCOPE: confirmed NO server action exists at
 * all (stronger absence than the usual "button commented out" pattern).
 * No exact-text negative assertion — confirmed zero `[Required]`
 * DataAnnotations exist on this VM; only a generic indicator-visible check
 * is used.
 */
test.describe('TableSection — PROP-TSEC', () => {
  test(`PROP-TSEC-001 List/grid loads and displays records ${tags.regression} ${tags.p1}`, async ({
    tableSectionPage,
  }) => {
    assertAdminCredentialsReady();

    const name = uniqueCode('TSEC');
    await tableSectionPage.createTableSection(name);

    await tableSectionPage.goto();
    await tableSectionPage.grid.search(name);
    await tableSectionPage.grid.waitForLoad();
    expect(await tableSectionPage.grid.rowCount()).toBeGreaterThanOrEqual(1);
    await expect(await tableSectionPage.grid.findRowByText(name)).toBeVisible();
  });

  test(`PROP-TSEC-002 Create with SectionName succeeds ${tags.regression} ${tags.p0}`, async ({
    tableSectionPage,
  }) => {
    assertAdminCredentialsReady();

    const name = uniqueCode('TSEC');
    await tableSectionPage.createTableSection(name);

    await tableSectionPage.goto();
    await tableSectionPage.grid.search(name);
    await expect(await tableSectionPage.grid.findRowByText(name)).toBeVisible();
  });

  test(`PROP-TSEC-003 Create with empty SectionName rejected ${tags.regression} ${tags.negative} ${tags.p1}`, async ({
    tableSectionPage,
    page,
  }) => {
    assertAdminCredentialsReady();

    await tableSectionPage.gotoCreate();
    // SectionName deliberately left empty.
    await tableSectionPage.clickSave();

    await tableSectionPage.expectSectionNameRequiredIndicated();
    await expect(page).toHaveURL(/\/DMS\/TableSection\/Create/i);
  });

  test(`PROP-TSEC-004 Edit and verify persistence ${tags.regression} ${tags.p1}`, async ({
    tableSectionPage,
  }) => {
    assertAdminCredentialsReady();

    const originalName = uniqueCode('TSEC');
    await tableSectionPage.createTableSection(originalName);

    await tableSectionPage.openEditFor(originalName);
    const updatedName = uniqueCode('TSEC');
    await tableSectionPage.updateSectionName(updatedName);

    await tableSectionPage.goto();
    await tableSectionPage.grid.search(updatedName);
    await expect(await tableSectionPage.grid.findRowByText(updatedName)).toBeVisible();
  });

  test(`PROP-TSEC-005 Grid search filters by SectionName/Description ${tags.regression} ${tags.p2}`, async ({
    tableSectionPage,
  }) => {
    assertAdminCredentialsReady();

    const name = uniqueCode('TSEC');
    await tableSectionPage.createTableSection(name);

    await tableSectionPage.goto();
    await tableSectionPage.grid.search(name);
    await tableSectionPage.grid.waitForLoad();

    expect(await tableSectionPage.grid.rowCount()).toBe(1);
    await expect(await tableSectionPage.grid.findRowByText(name)).toBeVisible();
  });
});
