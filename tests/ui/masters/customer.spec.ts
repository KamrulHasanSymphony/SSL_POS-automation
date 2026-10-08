import { test, expect } from '../../../fixtures/masters.fixture';
import { assertAdminCredentialsReady } from '../../../utils/env';
import { uniqueCode, randomData } from '../../../utils/random-data';
import { tags } from '../../../config/tags';

/**
 * STEP 5 module: Customer (PROP-CUST-001..007) — PROPOSED SOURCE-VERIFIED
 * COVERAGE, approved as the authoritative STEP 5 scope. Runs under the
 * "authenticated" project.
 *
 * Prerequisite (Customer Group) is created via API only (masters.fixture's
 * customerPrerequisites) — the Customer module itself is always exercised
 * through the real UI, per the API Setup Rule.
 *
 * Delete is explicitly OUT OF SCOPE (STEP 5 approved decision §3): the
 * CustomerController.Delete action is itself commented out, and the button
 * is also commented out of Customer/Index.cshtml — doubly unreachable.
 */
test.describe('Customer — PROP-CUST', () => {
  test(`PROP-CUST-001 Customer list/grid loads and displays records ${tags.regression} ${tags.smoke} ${tags.p0}`, async ({
    customerPage,
    customerPrerequisites,
  }) => {
    assertAdminCredentialsReady();

    const { customerGroupName } = await customerPrerequisites();
    const name = uniqueCode('CUSTOMER');
    await customerPage.createCustomer({
      name,
      customerGroupName,
      telephoneNo: randomData.phone11Digit(),
      email: randomData.email('customer'),
      address: `Automation Address ${uniqueCode('ADDR')}`,
    });

    await customerPage.goto();
    await customerPage.grid.search(name);
    await customerPage.grid.waitForLoad();
    expect(await customerPage.grid.rowCount()).toBeGreaterThanOrEqual(1);
    await expect(await customerPage.grid.findRowByText(name)).toBeVisible();
  });

  test(`PROP-CUST-002 Create Customer with required fields succeeds ${tags.regression} ${tags.smoke} ${tags.p0}`, async ({
    customerPage,
    customerPrerequisites,
  }) => {
    assertAdminCredentialsReady();

    const { customerGroupName } = await customerPrerequisites();
    const name = uniqueCode('CUSTOMER');
    await customerPage.createCustomer({
      name,
      customerGroupName,
      telephoneNo: randomData.phone11Digit(),
      email: randomData.email('customer'),
      address: `Automation Address ${uniqueCode('ADDR')}`,
    });

    // Verify actual persistence, not just the toast.
    await customerPage.goto();
    await customerPage.grid.search(name);
    await expect(await customerPage.grid.findRowByText(name)).toBeVisible();
  });

  test(`PROP-CUST-003 Create Customer without Customer Group is rejected ${tags.regression} ${tags.negative} ${tags.p1}`, async ({
    customerPage,
    page,
  }) => {
    assertAdminCredentialsReady();

    await customerPage.gotoCreate();
    await customerPage.fillName(uniqueCode('CUSTOMER'));
    await customerPage.fillTelephone(randomData.phone11Digit());
    await customerPage.fillEmail(randomData.email('customer'));
    await customerPage.fillAddress(`Automation Address ${uniqueCode('ADDR')}`);
    // Customer Group deliberately left unselected.
    await customerPage.clickSave();

    await customerPage.expectCustomerGroupRequiredIndicated();
    await expect(page).toHaveURL(/\/DMS\/Customer\/Create/i);
  });

  test(`PROP-CUST-004 Create Customer with empty Telephone is rejected ${tags.regression} ${tags.negative} ${tags.p1}`, async ({
    customerPage,
    customerPrerequisites,
    page,
  }) => {
    assertAdminCredentialsReady();

    const { customerGroupName } = await customerPrerequisites();
    await customerPage.gotoCreate();
    await customerPage.fillName(uniqueCode('CUSTOMER'));
    await customerPage.selectCustomerGroup(customerGroupName);
    // Telephone deliberately left empty.
    await customerPage.fillEmail(randomData.email('customer'));
    await customerPage.fillAddress(`Automation Address ${uniqueCode('ADDR')}`);
    await customerPage.clickSave();

    await customerPage.expectTelephoneRequiredValidation();
    await expect(page).toHaveURL(/\/DMS\/Customer\/Create/i);
  });

  test(`PROP-CUST-005 Create Customer with invalid Email is rejected ${tags.regression} ${tags.negative} ${tags.p1}`, async ({
    customerPage,
    customerPrerequisites,
    page,
  }) => {
    assertAdminCredentialsReady();

    const { customerGroupName } = await customerPrerequisites();
    await customerPage.gotoCreate();
    await customerPage.fillName(uniqueCode('CUSTOMER'));
    await customerPage.selectCustomerGroup(customerGroupName);
    await customerPage.fillTelephone(randomData.phone11Digit());
    await customerPage.fillEmail('not-a-valid-email');
    await customerPage.fillAddress(`Automation Address ${uniqueCode('ADDR')}`);
    await customerPage.clickSave();

    await customerPage.expectInvalidEmailValidation();
    await expect(page).toHaveURL(/\/DMS\/Customer\/Create/i);
  });

  test(`PROP-CUST-006 Edit Customer Name/Address and verify persistence ${tags.regression} ${tags.p0}`, async ({
    customerPage,
    customerPrerequisites,
  }) => {
    assertAdminCredentialsReady();

    const { customerGroupName } = await customerPrerequisites();
    const originalName = uniqueCode('CUSTOMER');
    await customerPage.createCustomer({
      name: originalName,
      customerGroupName,
      telephoneNo: randomData.phone11Digit(),
      email: randomData.email('customer'),
      address: `Automation Address ${uniqueCode('ADDR')}`,
    });

    // Confirmed source behavior: a successful Create navigates directly to
    // /DMS/Customer/Edit/{id} — openEditFor() no-ops if already there.
    await customerPage.openEditFor(originalName);
    const updatedName = uniqueCode('CUSTOMER');
    const updatedAddress = `Updated Address ${uniqueCode('ADDR')}`;
    await customerPage.updateNameAndAddress(updatedName, updatedAddress);

    await customerPage.goto();
    await customerPage.grid.search(updatedName);
    await expect(await customerPage.grid.findRowByText(updatedName)).toBeVisible();
  });

  test(`PROP-CUST-007 Customer grid search filters by Code/Name/Telephone ${tags.regression} ${tags.p2}`, async ({
    customerPage,
    customerPrerequisites,
  }) => {
    assertAdminCredentialsReady();

    const { customerGroupName } = await customerPrerequisites();
    const name = uniqueCode('CUSTOMER');
    await customerPage.createCustomer({
      name,
      customerGroupName,
      telephoneNo: randomData.phone11Digit(),
      email: randomData.email('customer'),
      address: `Automation Address ${uniqueCode('ADDR')}`,
    });

    await customerPage.goto();
    await customerPage.grid.search(name);
    await customerPage.grid.waitForLoad();

    expect(await customerPage.grid.rowCount()).toBe(1);
    await expect(await customerPage.grid.findRowByText(name)).toBeVisible();
  });
});
