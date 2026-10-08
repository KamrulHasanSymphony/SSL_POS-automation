import { test, expect } from '../../fixtures/base.fixture';
import { ApiClient } from '../../utils/api-helper';
import { assertEnvReady } from '../../utils/env';
import { uniqueCode } from '../../utils/random-data';
import { readProp } from '../../utils/test-data-setup';
import { tags } from '../../config/tags';

/**
 * STEP 10 Phase A module: api/Auth/login (PROP-API-012..013), approved
 * exactly as documented in STEP 10.2/10.3A. Confirmed directly from
 * `AuthController.cs`: this endpoint is structurally unreachable from any
 * UI-driven flow — `CommonRepo.SignInAuthentication` and all three real
 * login paths in `ShampanPOSUI/Controllers/LoginController.cs` call
 * `api/UserLogin/SignIn` only (matching `ApiClient.authenticate()`'s own
 * documented finding). A Playwright UI test can never isolate this
 * endpoint's own behavior — only a raw API call can.
 *
 * CONFIRMED SECURITY FINDING (asserting actual behavior, not assumed —
 * matching this project's established `tests/api/unauthenticated-access.spec.ts`
 * precedent of asserting confirmed actual behavior over unverified
 * "expected secure" behavior): `AuthController.Login` performs NO
 * credential/DB check at all — `if (!string.IsNullOrWhiteSpace(Username) &&
 * !string.IsNullOrWhiteSpace(Password))` is the entire check, then it signs
 * and returns a valid JWT for ANY non-blank pair, real account or not.
 * Only a genuinely blank/whitespace field is rejected (401).
 *
 * Per explicit instruction: this is flagged as a security finding in the
 * STEP 10 report, but is NOT tagged @known-defect here — that requires
 * separate explicit approval.
 */
test.describe('Independent API checks — Auth/login', () => {
  test(`PROP-API-012 Auth login issues a token for any non-blank credentials ${tags.regression} ${tags.security} ${tags.p1}`, async () => {
    assertEnvReady('apiBaseUrl');

    const client = await ApiClient.create();
    const response = await client.post('/api/Auth/login', {
      Username: uniqueCode('NOACCT'),
      Password: uniqueCode('FAKEPW'),
    });
    const body = await response.json();

    // SECURITY FINDING (confirmed by source, not assumed): no credential
    // check exists — a token is issued for a username that was never
    // created. The secure expectation would be rejection; this asserts the
    // CONFIRMED actual behavior.
    //
    // FULL-REGRESSION-RUN FIX (confirmed automation defect): `body.Token`
    // (PascalCase) is always `undefined` — confirmed live that
    // `AuthController.Login`'s anonymous `{ Token = jwtToken }` object is
    // serialized camelCase (`token`) by ASP.NET Core's default
    // System.Text.Json policy, the exact same casing quirk this project's
    // own `utils/api-helper.ts`/`utils/test-data-setup.ts` already document
    // and built `readProp()` to handle case-insensitively — this file just
    // never used it. `body.Token` directly had never actually been
    // exercised against a live response before this run.
    expect(response.status()).toBe(200);
    const token = readProp(body, 'Token');
    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(0);

    await client.dispose();
  });

  test(`PROP-API-013 Auth login rejects blank credentials ${tags.regression} ${tags.p1}`, async () => {
    assertEnvReady('apiBaseUrl');

    const client = await ApiClient.create();
    const response = await client.post('/api/Auth/login', {
      Username: '',
      Password: '',
    });
    const text = await response.text();

    expect(response.status()).toBe(401);
    expect(text).toContain('Invalid username or password');

    await client.dispose();
  });
});
