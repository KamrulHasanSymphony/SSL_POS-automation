import { test, expect } from '../../../fixtures/masters4.fixture';
import { assertAdminCredentialsReady } from '../../../utils/env';
import { uniqueCode } from '../../../utils/random-data';
import { tags } from '../../../config/tags';

/**
 * STEP 9 Phase C module: Expense (PROP-EXP-001..006), approved exactly as
 * documented in STEP 9.1/9.2C. Confirmed structural mirror of Income — see
 * pages/masters/ExpensePage.ts / income.spec.ts for the shared source
 * trail (real working Post workflow, reload-required form locking). Delete
 * is confirmed NOT SUPPORTED here either.
 */
test.describe('Expense — PROP-EXP', () => {
  test(`PROP-EXP-001 List/grid loads ${tags.regression} ${tags.p1}`, async ({ expensePage, incomeExpenseCategoryPrerequisite }) => {
    assertAdminCredentialsReady();

    const { categoryName } = await incomeExpenseCategoryPrerequisite('Expense');
    const code = await expensePage.createExpense({ categoryName, amount: 500 });

    await expensePage.goto();
    await expensePage.grid.search(code);
    await expensePage.grid.waitForLoad();
    expect(await expensePage.grid.rowCount()).toBeGreaterThanOrEqual(1);
    await expect(await expensePage.grid.findRowByText(code)).toBeVisible();
  });

  test(`PROP-EXP-002 Create with header + detail line ${tags.regression} ${tags.p0}`, async ({
    expensePage,
    incomeExpenseCategoryPrerequisite,
  }) => {
    assertAdminCredentialsReady();

    const { categoryName } = await incomeExpenseCategoryPrerequisite('Expense');
    const code = await expensePage.createExpense({ categoryName, amount: 750 });

    await expensePage.goto();
    await expensePage.grid.search(code);
    await expect(await expensePage.grid.findRowByText(code)).toBeVisible();
  });

  test(`PROP-EXP-003 Create without Transaction Date rejected ${tags.regression} ${tags.negative} ${tags.p1}`, async ({
    expensePage,
    page,
  }) => {
    assertAdminCredentialsReady();

    await expensePage.gotoCreate();
    await expensePage.clearTransactionDate();
    await expensePage.clickSave();

    await expensePage.expectTransactionDateRequiredValidation();
    await expect(page).toHaveURL(/\/DMS\/Expense\/Create/i);
  });

  test(`PROP-EXP-004 Edit and verify persistence ${tags.regression} ${tags.p1}`, async ({
    expensePage,
    incomeExpenseCategoryPrerequisite,
  }) => {
    assertAdminCredentialsReady();

    const { categoryName } = await incomeExpenseCategoryPrerequisite('Expense');
    const code = await expensePage.createExpense({ categoryName, amount: 300 });

    const updatedComments = uniqueCode('EXPCMT');
    await expensePage.updateComments(updatedComments);

    await expensePage.openEditFor(code);
    expect(await expensePage.getComments()).toBe(updatedComments);
  });

  test(`PROP-EXP-005 Draft to Posted transition and form locking ${tags.regression} ${tags.p0}`, async ({
    expensePage,
    incomeExpenseCategoryPrerequisite,
    page,
  }) => {
    assertAdminCredentialsReady();

    const { categoryName } = await incomeExpenseCategoryPrerequisite('Expense');
    await expensePage.createExpense({ categoryName, amount: 400 });
    expect(await expensePage.isAlreadyPosted()).toBe(false);

    await expensePage.post();
    expect(await expensePage.isAlreadyPosted()).toBe(true);

    await page.reload();
    await expect(page.locator('#Comments')).not.toBeEditable();
  });

  test(`PROP-EXP-006 Grid search by Code/FiscalYear ${tags.regression} ${tags.p2}`, async ({
    expensePage,
    incomeExpenseCategoryPrerequisite,
  }) => {
    assertAdminCredentialsReady();

    const { categoryName } = await incomeExpenseCategoryPrerequisite('Expense');
    const code = await expensePage.createExpense({ categoryName, amount: 200 });

    await expensePage.goto();
    await expensePage.grid.search(code);
    await expensePage.grid.waitForLoad();

    expect(await expensePage.grid.rowCount()).toBe(1);
    await expect(await expensePage.grid.findRowByText(code)).toBeVisible();
  });
});
