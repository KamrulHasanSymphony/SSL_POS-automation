import { test, expect } from '../../../fixtures/masters7.fixture';
import { assertAdminCredentialsReady } from '../../../utils/env';
import { tags } from '../../../config/tags';

/**
 * STEP 10 Phase C module: CompanyCreate (PROP-COMPCREATE-001), approved
 * exactly as documented in STEP 10.2/10.3C. See pages/setup/CompanyCreatePage.ts
 * for the full source trail: reached via `/SetUp/CompanyCreate/Create?id={userId}`
 * after a real SignUp (`signedUpUserPrerequisite`), and confirmed to
 * redirect unconditionally to BranchCreate on success — that redirect is
 * this test's completion signal.
 */
test.describe('CompanyCreate — PROP-COMPCREATE', () => {
  test(`PROP-COMPCREATE-001 Company creation succeeds after SignUp flow ${tags.regression} ${tags.p1}`, async ({
    companyCreatedPrerequisite,
    page,
  }) => {
    assertAdminCredentialsReady();

    const { companyId, userId } = await companyCreatedPrerequisite();

    expect(companyId).toBeTruthy();
    expect(userId).toBeTruthy();
    await expect(page).toHaveURL(/\/DMS\/BranchCreate\/BranchCreate\?companyId=/i);
  });
});
