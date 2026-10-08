import { test, expect } from '../../../fixtures/masters2.fixture';
import { assertAdminCredentialsReady } from '../../../utils/env';
import { uniqueCode } from '../../../utils/random-data';
import { tags } from '../../../config/tags';

/**
 * STEP 9 Phase A module: TableInfo (PROP-TINFO-001..005), approved exactly
 * as documented in STEP 9.1/9.2A. Runs under the "authenticated" project.
 * Requires 1 real TableSection (confirmed FK, `SectionId`).
 *
 * Delete is explicitly OUT OF SCOPE: confirmed NO server action exists at
 * all. No exact-text negative assertion — confirmed zero `[Required]`
 * DataAnnotations exist on this VM.
 */
test.describe('TableInfo — PROP-TINFO', () => {
  test(`PROP-TINFO-001 List/grid loads and displays records ${tags.regression} ${tags.p1}`, async ({
    tableInfoPage,
    tableSectionPrerequisite,
  }) => {
    assertAdminCredentialsReady();

    const { sectionName } = await tableSectionPrerequisite();
    const tableNumber = uniqueCode('TINFO');
    const code = await tableInfoPage.createTableInfo({ tableNumber, sectionName });

    await tableInfoPage.goto();
    await tableInfoPage.grid.search(code);
    await tableInfoPage.grid.waitForLoad();
    expect(await tableInfoPage.grid.rowCount()).toBeGreaterThanOrEqual(1);
    await expect(await tableInfoPage.grid.findRowByText(code)).toBeVisible();
  });

  test(`PROP-TINFO-002 Create with TableNumber + Section succeeds ${tags.regression} ${tags.p0}`, async ({
    tableInfoPage,
    tableSectionPrerequisite,
  }) => {
    assertAdminCredentialsReady();

    const { sectionName } = await tableSectionPrerequisite();
    const tableNumber = uniqueCode('TINFO');
    const code = await tableInfoPage.createTableInfo({ tableNumber, sectionName });

    await tableInfoPage.goto();
    await tableInfoPage.grid.search(code);
    await expect(await tableInfoPage.grid.findRowByText(code)).toBeVisible();
  });

  test(`PROP-TINFO-003 Create with empty TableNumber rejected ${tags.regression} ${tags.negative} ${tags.p1}`, async ({
    tableInfoPage,
    tableSectionPrerequisite,
    page,
  }) => {
    assertAdminCredentialsReady();

    const { sectionName } = await tableSectionPrerequisite();
    await tableInfoPage.gotoCreate();
    await tableInfoPage.selectSection(sectionName);
    // TableNumber deliberately left empty.
    await tableInfoPage.clickSave();

    await tableInfoPage.expectTableNumberRequiredIndicated();
    await expect(page).toHaveURL(/\/DMS\/TableInfo\/Create/i);
  });

  test(`PROP-TINFO-004 Edit and verify persistence ${tags.regression} ${tags.p1}`, async ({
    tableInfoPage,
    tableSectionPrerequisite,
  }) => {
    assertAdminCredentialsReady();

    const { sectionName } = await tableSectionPrerequisite();
    const originalTableNumber = uniqueCode('TINFO');
    const code = await tableInfoPage.createTableInfo({ tableNumber: originalTableNumber, sectionName });

    await tableInfoPage.openEditFor(code);
    const updatedTableNumber = uniqueCode('TINFO');
    await tableInfoPage.updateTableNumber(updatedTableNumber);

    await tableInfoPage.goto();
    await tableInfoPage.grid.search(code);
    const row = await tableInfoPage.grid.findRowByText(code);
    await expect(row).toContainText(updatedTableNumber);
  });

  test(`PROP-TINFO-005 Grid search filters by TableNumber/SectionName ${tags.regression} ${tags.p2}`, async ({
    tableInfoPage,
    tableSectionPrerequisite,
  }) => {
    assertAdminCredentialsReady();

    const { sectionName } = await tableSectionPrerequisite();
    const tableNumber = uniqueCode('TINFO');
    const code = await tableInfoPage.createTableInfo({ tableNumber, sectionName });

    await tableInfoPage.goto();
    await tableInfoPage.grid.search(code);
    await tableInfoPage.grid.waitForLoad();

    expect(await tableInfoPage.grid.rowCount()).toBe(1);
    await expect(await tableInfoPage.grid.findRowByText(code)).toBeVisible();
  });
});
