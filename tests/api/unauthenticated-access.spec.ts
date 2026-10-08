import { test, expect } from '../../fixtures/base.fixture';
import { ApiClient } from '../../utils/api-helper';
import { assertEnvReady } from '../../utils/env';
import { uniqueCode } from '../../utils/random-data';
import { readProp } from '../../utils/test-data-setup';
import { tags } from '../../config/tags';

/**
 * STEP 8 module: Independent API-level checks — unauthenticated-access
 * security scenarios (PROP-API-001..003), approved in STEP 8.1/8.2.
 * Confirmed directly from ShampanPOS_Api source: `UOMController`,
 * `DepositController`, `WithdrawalController` carry NO `[Authorize]`
 * attribute at all (class- or action-level) — unlike every sibling
 * Group/module controller, which does. These tests prove that gap for
 * real, independent of any UI test (a browser session can't construct a
 * token-less API request the way these do).
 *
 * Genuinely independent of the 111 existing UI tests — no UI test can ever
 * send an unauthenticated API request, since the `authenticated` project's
 * `page` always carries a pre-loaded session cookie, and `unauthenticated`
 * project tests never call this API directly.
 *
 * Expected SECURE behavior would be: request rejected (401/403). Source
 * confirms the opposite is what actually happens — these tests assert the
 * CONFIRMED actual (insecure) behavior, per your instruction to distinguish
 * "expected secure behavior" from "security defect" rather than assume one.
 */
test.describe('Independent API checks — unauthenticated access', () => {
  test(`PROP-API-001 UOM Insert without Authorization succeeds ${tags.regression} ${tags.security} ${tags.p1}`, async ({
    cleanup,
  }) => {
    assertEnvReady('apiBaseUrl');

    const unauthClient = await ApiClient.create();
    const name = uniqueCode('UOMAPI');
    const response = await unauthClient.post('/api/UOM/Insert', {
      Name: name,
      IsActive: true,
      CreatedBy: 'automation',
      CreatedFrom: 'API',
      // STEP 18A: this client is deliberately unauthenticated (that's the
      // point of the test), so it has no apiClient.getCompanyId() to read —
      // CompanyId 1 is the confirmed-valid id for this environment (STEP 16
      // live evidence: the admin account's own SignIn response), supplied
      // here only because UOMRepository.Insert's SQL requires it (STEP 18).
      CompanyId: 1,
    });
    const body = await response.json();

    // SECURITY DEFECT (confirmed by source, not assumed): an unauthenticated
    // request is accepted and the record is actually created — the secure
    // expectation would be a 401/rejection, which this app does not enforce
    // for this controller. Asserting the CONFIRMED actual behavior.
    expect(response.status()).toBe(200);
    expect(readProp(body, 'Status')).toBe('Success');
    expect(readProp(body, 'Id')).toBeTruthy();

    cleanup.register({ module: 'UOMAPI', deletePath: '/api/UOM/Delete', id: readProp(body, 'Id') });
    await unauthClient.dispose();
  });

  test(`PROP-API-002 Deposit Insert without Authorization succeeds ${tags.regression} ${tags.security} ${tags.p0}`, async ({
    cleanup,
  }) => {
    assertEnvReady('apiBaseUrl');

    const unauthClient = await ApiClient.create();
    const today = new Date().toISOString().slice(0, 10);
    const response = await unauthClient.post('/api/Deposit/Insert', {
      TransactionDate: today,
      ChequeDate: today,
      IsCash: true,
    });
    const body = await response.json();

    expect(response.status()).toBe(200);
    // Confirmed from source: FromBankAccountId/ToBankAccountId are safely
    // nullable at the application layer (no code-level exception either
    // way); asserting only that the request was NOT rejected as
    // unauthenticated (no 401, and a real ResultVM came back), which is
    // the actual security-relevant claim under test — not full business success.
    const status = readProp(body, 'Status');
    expect(status).toBeDefined();
    expect(['Success', 'Fail']).toContain(status);
    if (status === 'Success' && readProp(body, 'Id')) {
      cleanup.register({ module: 'DEPAPI', deletePath: '/api/Deposit/Delete', id: readProp(body, 'Id') });
    }
    await unauthClient.dispose();
  });

  test(`PROP-API-003 Withdrawal Insert without Authorization succeeds ${tags.regression} ${tags.security} ${tags.p0}`, async ({
    cleanup,
  }) => {
    assertEnvReady('apiBaseUrl');

    const unauthClient = await ApiClient.create();
    const today = new Date().toISOString().slice(0, 10);
    const response = await unauthClient.post('/api/Withdrawal/Insert', {
      TransactionDate: today,
      ChequeDate: today,
      IsCash: true,
    });
    const body = await response.json();

    expect(response.status()).toBe(200);
    const status = readProp(body, 'Status');
    expect(status).toBeDefined();
    expect(['Success', 'Fail']).toContain(status);
    if (status === 'Success' && readProp(body, 'Id')) {
      cleanup.register({ module: 'WDAPI', deletePath: '/api/Withdrawal/Delete', id: readProp(body, 'Id') });
    }
    await unauthClient.dispose();
  });
});
