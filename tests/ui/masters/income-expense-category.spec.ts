import { test, expect } from '../../../fixtures/masters2.fixture';
import { assertAdminCredentialsReady } from '../../../utils/env';
import { uniqueCode } from '../../../utils/random-data';
import { tags } from '../../../config/tags';

/**
 * STEP 9 Phase A module: IncomeExpenseCategory (PROP-IEC-001..006),
 * approved exactly as documented in STEP 9.1/9.2A. Runs under the
 * "authenticated" project. Single-page grid + Bootstrap modal (confirmed
 * — see IncomeExpenseCategoryPage.ts), reused for both Create and Edit.
 *
 * Delete is explicitly OUT OF SCOPE: action exists, `id="btnDelete"`
 * button is commented out of Index.cshtml.
 */
test.describe('IncomeExpenseCategory — PROP-IEC', () => {
  test(`PROP-IEC-001 List/grid loads and displays records ${tags.regression} ${tags.p1}`, async ({
    incomeExpenseCategoryPage,
  }) => {
    assertAdminCredentialsReady();

    const name = uniqueCode('IEC');
    await incomeExpenseCategoryPage.createCategory(name, 'Income');

    await incomeExpenseCategoryPage.goto();
    await incomeExpenseCategoryPage.grid.search(name);
    await incomeExpenseCategoryPage.grid.waitForLoad();
    expect(await incomeExpenseCategoryPage.grid.rowCount()).toBeGreaterThanOrEqual(1);
    await expect(await incomeExpenseCategoryPage.grid.findRowByText(name)).toBeVisible();
  });

  test(`PROP-IEC-002 Create with Name + Type succeeds ${tags.regression} ${tags.p0}`, async ({
    incomeExpenseCategoryPage,
  }) => {
    assertAdminCredentialsReady();

    const name = uniqueCode('IEC');
    await incomeExpenseCategoryPage.createCategory(name, 'Expense');

    await incomeExpenseCategoryPage.goto();
    await incomeExpenseCategoryPage.grid.search(name);
    await expect(await incomeExpenseCategoryPage.grid.findRowByText(name)).toBeVisible();
  });

  test(`PROP-IEC-003 Create with empty Name rejected ${tags.regression} ${tags.negative} ${tags.p1}`, async ({
    incomeExpenseCategoryPage,
  }) => {
    assertAdminCredentialsReady();

    await incomeExpenseCategoryPage.openCreateModal();
    await incomeExpenseCategoryPage.selectType('Income');
    // Name deliberately left empty.
    await incomeExpenseCategoryPage.clickModalSave();

    await incomeExpenseCategoryPage.expectNameRequiredError();
  });

  test(`PROP-IEC-004 Create with empty Type rejected ${tags.regression} ${tags.negative} ${tags.p1}`, async ({
    incomeExpenseCategoryPage,
  }) => {
    assertAdminCredentialsReady();

    await incomeExpenseCategoryPage.openCreateModal();
    await incomeExpenseCategoryPage.fillName(uniqueCode('IEC'));
    // Type deliberately left unselected.
    await incomeExpenseCategoryPage.clickModalSave();

    await incomeExpenseCategoryPage.expectTypeRequiredError();
  });

  test(`PROP-IEC-005 Edit (modal) and verify persistence ${tags.regression} ${tags.p1}`, async ({
    incomeExpenseCategoryPage,
  }) => {
    assertAdminCredentialsReady();

    const originalName = uniqueCode('IEC');
    await incomeExpenseCategoryPage.createCategory(originalName, 'Income');

    await incomeExpenseCategoryPage.openEditFor(originalName);
    const updatedName = uniqueCode('IEC');
    await incomeExpenseCategoryPage.updateName(updatedName);

    await incomeExpenseCategoryPage.goto();
    await incomeExpenseCategoryPage.grid.search(updatedName);
    await expect(await incomeExpenseCategoryPage.grid.findRowByText(updatedName)).toBeVisible();
  });

  test(`PROP-IEC-006 Grid search filters ${tags.regression} ${tags.p2}`, async ({
    incomeExpenseCategoryPage,
  }) => {
    assertAdminCredentialsReady();

    const name = uniqueCode('IEC');
    await incomeExpenseCategoryPage.createCategory(name, 'Expense');

    await incomeExpenseCategoryPage.goto();
    await incomeExpenseCategoryPage.grid.search(name);
    await incomeExpenseCategoryPage.grid.waitForLoad();

    expect(await incomeExpenseCategoryPage.grid.rowCount()).toBe(1);
    await expect(await incomeExpenseCategoryPage.grid.findRowByText(name)).toBeVisible();
  });
});
