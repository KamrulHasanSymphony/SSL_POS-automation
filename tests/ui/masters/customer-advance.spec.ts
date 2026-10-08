import { test, expect } from '../../../fixtures/masters6.fixture';
import { assertAdminCredentialsReady } from '../../../utils/env';
import { uniqueCode } from '../../../utils/random-data';
import { tags } from '../../../config/tags';

/**
 * STEP 10 Phase B module: CustomerAdvance (PROP-CUSTADV-001..004), approved
 * exactly as documented in STEP 10.2/10.3B. Runs under the "authenticated"
 * project. See pages/masters/CustomerAdvancePage.ts for the full source
 * trail: standalone screen (not an embedded Customer tab), reached with a
 * real Customer database Id. `Post` is confirmed to call a broken
 * endpoint — not implemented, per explicit instruction.
 */
test.describe('CustomerAdvance — PROP-CUSTADV', () => {
  test(`PROP-CUSTADV-001 List/grid loads and displays records ${tags.regression} ${tags.p1}`, async ({
    customerAdvancePage,
    customerWithIdPrerequisite,
  }) => {
    assertAdminCredentialsReady();

    const { customerId, customerName } = await customerWithIdPrerequisite();
    await customerAdvancePage.createCustomerAdvance(customerId, 500);

    await customerAdvancePage.goto(customerId, customerName);
    expect(await customerAdvancePage.grid.rowCount()).toBeGreaterThanOrEqual(1);
  });

  test(`PROP-CUSTADV-002 Create with required fields succeeds ${tags.regression} ${tags.p0}`, async ({
    customerAdvancePage,
    customerWithIdPrerequisite,
  }) => {
    assertAdminCredentialsReady();

    const { customerId, customerName } = await customerWithIdPrerequisite();
    await customerAdvancePage.createCustomerAdvance(customerId, 750);

    await customerAdvancePage.goto(customerId, customerName);
    expect(await customerAdvancePage.grid.rowCount()).toBeGreaterThanOrEqual(1);
  });

  test(`PROP-CUSTADV-003 Create with invalid Advance Amount rejected ${tags.regression} ${tags.negative} ${tags.p1}`, async ({
    customerAdvancePage,
    customerWithIdPrerequisite,
    page,
  }) => {
    assertAdminCredentialsReady();

    const { customerId } = await customerWithIdPrerequisite();
    await customerAdvancePage.gotoCreate(customerId);
    // Advance Amount deliberately set to 0 (fails [Range(1, double.MaxValue)]);
    // Payment Type deliberately left unselected — the two checks are
    // independent, so this alone exercises the Advance Amount rejection.
    await customerAdvancePage.fillAdvanceAmount(0);
    await customerAdvancePage.clickSave();

    await customerAdvancePage.expectAdvanceAmountInvalidValidation();
    await expect(page).toHaveURL(/\/DMS\/CustomerAdvance\/Create/i);
  });

  test(`PROP-CUSTADV-004 Edit and verify persistence ${tags.regression} ${tags.p1}`, async ({
    customerAdvancePage,
    customerWithIdPrerequisite,
  }) => {
    assertAdminCredentialsReady();

    const { customerId, customerName } = await customerWithIdPrerequisite();
    await customerAdvancePage.createCustomerAdvance(customerId, 300);

    await customerAdvancePage.openEditFor(customerId, customerName);
    const updatedDocumentNo = uniqueCode('CUSTADVDOC');
    await customerAdvancePage.updateDocumentNo(updatedDocumentNo);

    await customerAdvancePage.goto(customerId, customerName);
    await customerAdvancePage.grid.search(updatedDocumentNo);
    await expect(await customerAdvancePage.grid.findRowByText(updatedDocumentNo)).toBeVisible();
  });
});
