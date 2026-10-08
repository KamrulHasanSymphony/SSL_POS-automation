import { test, expect } from '../../../fixtures/masters7.fixture';
import { assertAdminCredentialsReady } from '../../../utils/env';
import { uniqueCode } from '../../../utils/random-data';
import { tags } from '../../../config/tags';

/**
 * STEP 10 Phase C module: BranchCreate (PROP-BRCREATE-001), approved
 * exactly as documented in STEP 10.2/10.3C — the final step of the
 * onboarding chain (SignUp -> CompanyCreate -> BranchCreate). See
 * pages/masters/BranchCreatePage.ts for the full source trail: reached
 * via `/DMS/BranchCreate/BranchCreate?companyId=&userId=` (only reachable
 * in practice via `companyCreatedPrerequisite`'s confirmed redirect chain,
 * not from the already-covered BranchProfile screens). Confirmed to
 * redirect to `/Login/Index` on success — that redirect is this test's
 * completion signal.
 */
test.describe('BranchCreate — PROP-BRCREATE', () => {
  test(`PROP-BRCREATE-001 New branch creation during onboarding chain succeeds ${tags.regression} ${tags.p2}`, async ({
    branchCreatePage,
    companyCreatedPrerequisite,
    page,
  }) => {
    assertAdminCredentialsReady();

    const { companyId, userId } = await companyCreatedPrerequisite();
    const branchName = uniqueCode('ONBBRANCH');

    await branchCreatePage.createBranch(companyId, userId, {
      distributorCode: uniqueCode('ONBBRDC'),
      name: branchName,
      telephoneNo: '01700000000',
    });

    await expect(page).toHaveURL(/\/Login\/Index/i);
  });
});
