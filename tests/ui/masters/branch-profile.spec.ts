import { test, expect } from '../../../fixtures/masters3.fixture';
import { assertAdminCredentialsReady } from '../../../utils/env';
import { uniqueCode } from '../../../utils/random-data';
import { tags } from '../../../config/tags';

/**
 * STEP 9 Phase B module: BranchProfile (PROP-BRPF-001..005), approved
 * exactly as documented in STEP 9.1/9.2B. Runs under the "authenticated"
 * project.
 *
 * CONFIRMED LIMITATION (preserved per SQA instruction, not silently
 * changed): `AreaId` is `[Required]` on BranchProfileVM.cs but has no input
 * anywhere in Create.cshtml (fully commented out) and `CreateEdit` performs
 * no `ModelState.IsValid` check — Create succeeds with AreaId silently
 * null. See pages/masters/BranchProfilePage.ts for the full source trail.
 *
 * Delete is explicitly OUT OF SCOPE: button commented out on Index.
 */
test.describe('BranchProfile — PROP-BRPF', () => {
  test(`PROP-BRPF-001 List/grid loads and displays records ${tags.regression} ${tags.p1}`, async ({ branchProfilePage }) => {
    assertAdminCredentialsReady();

    const code = await branchProfilePage.createBranchProfile({
      distributorCode: uniqueCode('BRPFDC'),
      name: uniqueCode('BRPF'),
      telephoneNo: '01700000000',
    });

    await branchProfilePage.goto();
    await branchProfilePage.grid.search(code);
    await branchProfilePage.grid.waitForLoad();
    expect(await branchProfilePage.grid.rowCount()).toBeGreaterThanOrEqual(1);
    await expect(await branchProfilePage.grid.findRowByText(code)).toBeVisible();
  });

  test(`PROP-BRPF-002 Create with required fields succeeds despite missing AreaId input ${tags.regression} ${tags.p0}`, async ({
    branchProfilePage,
  }) => {
    assertAdminCredentialsReady();

    const code = await branchProfilePage.createBranchProfile({
      distributorCode: uniqueCode('BRPFDC'),
      name: uniqueCode('BRPF'),
      telephoneNo: '01700000000',
    });

    await branchProfilePage.goto();
    await branchProfilePage.grid.search(code);
    await expect(await branchProfilePage.grid.findRowByText(code)).toBeVisible();
  });

  test(`PROP-BRPF-003 Create with invalid Telephone No. format rejected ${tags.regression} ${tags.negative} ${tags.p1}`, async ({
    branchProfilePage,
    page,
  }) => {
    assertAdminCredentialsReady();

    await branchProfilePage.gotoCreate();
    await branchProfilePage.fillDistributorCode(uniqueCode('BRPFDC'));
    await branchProfilePage.fillName(uniqueCode('BRPF'));
    // TelephoneNo's `oninput` strips non-digits client-side, but the
    // RegularExpression requires 10-15 digits — 5 digits deliberately fails it.
    await branchProfilePage.fillTelephoneNo('12345');
    await branchProfilePage.clickSave();

    await branchProfilePage.expectTelephoneInvalidFormatValidation();
    await expect(page).toHaveURL(/\/DMS\/BranchProfile\/Create/i);
  });

  test(`PROP-BRPF-004 Edit and verify persistence ${tags.regression} ${tags.p1}`, async ({ branchProfilePage }) => {
    assertAdminCredentialsReady();

    const originalName = uniqueCode('BRPF');
    const code = await branchProfilePage.createBranchProfile({
      distributorCode: uniqueCode('BRPFDC'),
      name: originalName,
      telephoneNo: '01700000000',
    });

    await branchProfilePage.openEditFor(code);
    const updatedName = uniqueCode('BRPF');
    await branchProfilePage.updateName(updatedName);

    await branchProfilePage.goto();
    await branchProfilePage.grid.search(updatedName);
    await expect(await branchProfilePage.grid.findRowByText(updatedName)).toBeVisible();
  });

  test(`PROP-BRPF-005 Grid search filters ${tags.regression} ${tags.p2}`, async ({ branchProfilePage }) => {
    assertAdminCredentialsReady();

    const code = await branchProfilePage.createBranchProfile({
      distributorCode: uniqueCode('BRPFDC'),
      name: uniqueCode('BRPF'),
      telephoneNo: '01700000000',
    });

    await branchProfilePage.goto();
    await branchProfilePage.grid.search(code);
    await branchProfilePage.grid.waitForLoad();

    expect(await branchProfilePage.grid.rowCount()).toBe(1);
    await expect(await branchProfilePage.grid.findRowByText(code)).toBeVisible();
  });
});
