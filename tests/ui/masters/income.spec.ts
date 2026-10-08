import { test, expect } from '../../../fixtures/masters4.fixture';
import { assertAdminCredentialsReady } from '../../../utils/env';
import { uniqueCode } from '../../../utils/random-data';
import { tags } from '../../../config/tags';

/**
 * STEP 9 Phase C module: Income (PROP-INC-001..006), approved exactly as
 * documented in STEP 9.1/9.2C. Runs under the "authenticated" project.
 * See pages/masters/IncomePage.ts / utils/constants.ts incomeFormSelectors
 * for the full source trail — confirmed real, working Post workflow
 * (distinct from the dead Collection/Payment/Deposit/Withdrawal Post
 * buttons); confirmed field-locking only takes effect on a fresh page load
 * (the AJAX post completion only toggles buttons), so PROP-INC-005 reloads
 * before asserting the form is locked. Delete is confirmed NOT SUPPORTED
 * here — no delete affordance on Index at all.
 */
test.describe('Income — PROP-INC', () => {
  test(`PROP-INC-001 List/grid loads ${tags.regression} ${tags.p1}`, async ({ incomePage, incomeExpenseCategoryPrerequisite }) => {
    assertAdminCredentialsReady();

    const { categoryName } = await incomeExpenseCategoryPrerequisite('Income');
    const code = await incomePage.createIncome({ categoryName, amount: 500 });

    await incomePage.goto();
    await incomePage.grid.search(code);
    await incomePage.grid.waitForLoad();
    expect(await incomePage.grid.rowCount()).toBeGreaterThanOrEqual(1);
    await expect(await incomePage.grid.findRowByText(code)).toBeVisible();
  });

  test(`PROP-INC-002 Create with header + detail line (Category + Amount) ${tags.regression} ${tags.p0}`, async ({
    incomePage,
    incomeExpenseCategoryPrerequisite,
  }) => {
    assertAdminCredentialsReady();

    const { categoryName } = await incomeExpenseCategoryPrerequisite('Income');
    const code = await incomePage.createIncome({ categoryName, amount: 750 });

    await incomePage.goto();
    await incomePage.grid.search(code);
    await expect(await incomePage.grid.findRowByText(code)).toBeVisible();
  });

  test(`PROP-INC-003 Create without Transaction Date rejected ${tags.regression} ${tags.negative} ${tags.p1}`, async ({
    incomePage,
    page,
  }) => {
    assertAdminCredentialsReady();

    await incomePage.gotoCreate();
    // TransactionDate defaults to today via kendoDatePicker — actively cleared here.
    // form.valid() fails on this alone and returns before collectDetails() ever
    // runs, so no detail line is needed for this scenario.
    await incomePage.clearTransactionDate();
    await incomePage.clickSave();

    await incomePage.expectTransactionDateRequiredValidation();
    await expect(page).toHaveURL(/\/DMS\/Income\/Create/i);
  });

  test(`PROP-INC-004 Edit and verify persistence ${tags.regression} ${tags.p1}`, async ({
    incomePage,
    incomeExpenseCategoryPrerequisite,
  }) => {
    assertAdminCredentialsReady();

    const { categoryName } = await incomeExpenseCategoryPrerequisite('Income');
    const code = await incomePage.createIncome({ categoryName, amount: 300 });

    const updatedComments = uniqueCode('INCCMT');
    await incomePage.updateComments(updatedComments);

    await incomePage.openEditFor(code);
    expect(await incomePage.getComments()).toBe(updatedComments);
  });

  test(`PROP-INC-005 Draft to Posted transition and form locking ${tags.regression} ${tags.p0}`, async ({
    incomePage,
    incomeExpenseCategoryPrerequisite,
    page,
  }) => {
    assertAdminCredentialsReady();

    const { categoryName } = await incomeExpenseCategoryPrerequisite('Income');
    await incomePage.createIncome({ categoryName, amount: 400 });
    expect(await incomePage.isAlreadyPosted()).toBe(false);

    await incomePage.post();
    expect(await incomePage.isAlreadyPosted()).toBe(true);

    // Confirmed: the AJAX post completion only hides/shows buttons; the real
    // Visibility(true) field-lock only runs on page load from #IsPost — reload
    // to observe genuine form locking, not just the Already-Posted indicator.
    await page.reload();
    await expect(page.locator('#Comments')).not.toBeEditable();
  });

  test(`PROP-INC-006 Grid search by Code/FiscalYear ${tags.regression} ${tags.p2}`, async ({
    incomePage,
    incomeExpenseCategoryPrerequisite,
  }) => {
    assertAdminCredentialsReady();

    const { categoryName } = await incomeExpenseCategoryPrerequisite('Income');
    const code = await incomePage.createIncome({ categoryName, amount: 200 });

    await incomePage.goto();
    await incomePage.grid.search(code);
    await incomePage.grid.waitForLoad();

    expect(await incomePage.grid.rowCount()).toBe(1);
    await expect(await incomePage.grid.findRowByText(code)).toBeVisible();
  });
});
