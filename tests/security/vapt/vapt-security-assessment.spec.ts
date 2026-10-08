import { test, expect } from '@playwright/test';
import { SecurityApiClient, decodeJwtPayloadUnverified } from '../../../api/SecurityApiClient';
import { env, assertEnvReady } from '../../../utils/env';
import { uniqueCode } from '../../../utils/random-data';
import { readProp } from '../../../utils/test-data-setup';
import { tags } from '../../../config/tags';

/**
 * VAPT SECURITY ASSESSMENT — consolidated, non-destructive API suite.
 *
 * Purpose: a repeatable evidence harness for the confirmed findings of the
 * VAPT-SECURITY-ASSESSMENT engagement against the ShampanPOS REST API
 * (https://localhost:7242). Every check here was first reproduced manually
 * with minimal live requests and cross-checked against source; these tests
 * lock that behavior in so a fix can be independently re-tested later.
 *
 * ASSERTION POLICY (matches this project's established
 * tests/api/unauthenticated-access.spec.ts and auth-login.spec.ts precedent):
 * defect tests assert the CONFIRMED ACTUAL (insecure) behavior — each with a
 * comment stating the SECURE expectation — so the suite is green and serves
 * as a faithful, reproducible record of reality (VAPT "reproduce it / repeat
 * it"). Genuine positive controls assert the SECURE behavior. Nothing here is
 * weakened to pass, and no assertion hides a vulnerability. These are NOT
 * tagged @known-defect (that gate asserts secure behavior and its candidate
 * list is changed only by explicit approval — see config/tags.ts).
 *
 * SAFETY: all checks are read-only except one UOM insert used to prove
 * unauthenticated write, which is deleted again in the same test. No
 * DROP/UPDATE/mass-writes, no brute force, no destructive payloads. Secrets
 * (passwords/tokens) are never printed or asserted by value.
 *
 * Reuses: api/SecurityApiClient (raw HTTP with caller-chosen Authorization),
 * utils/env, utils/random-data, utils/test-data-setup, config/tags.
 */

// A [Authorize]-protected endpoint (CustomerController carries class-level
// [Authorize]) and a couple of no-[Authorize] controllers, all source-confirmed.
const PROTECTED_LIST = '/api/Customer/List';
const PROTECTED_GRIDDATA = '/api/Customer/GetGridData';
const UNAUTH_COMPANY_LIST = '/api/CompanyProfile/List';
const UNAUTH_USER_LLIST = '/api/UserProfile/LList';

async function newClient(): Promise<SecurityApiClient> {
  assertEnvReady('apiBaseUrl');
  return SecurityApiClient.create();
}

function firstRow(body: unknown): Record<string, unknown> | null {
  const rows = (readProp(body, 'DataVM') ?? readProp(body, 'Data')) as unknown;
  if (Array.isArray(rows) && rows.length > 0 && typeof rows[0] === 'object' && rows[0] !== null) {
    return rows[0] as Record<string, unknown>;
  }
  return null;
}

/** Case-insensitive property lookup that returns the value without logging it. */
function pickValue(row: Record<string, unknown>, ...names: string[]): unknown {
  const lowered = names.map((n) => n.toLowerCase());
  for (const key of Object.keys(row)) {
    if (lowered.includes(key.toLowerCase())) return row[key];
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// PHASE 2 — AUTHENTICATION
// ---------------------------------------------------------------------------
test.describe(`VAPT Phase 2 — Authentication ${tags.security}`, () => {
  test(`VAPT-AUTH-001 valid login issues a token ${tags.regression} ${tags.p0}`, async () => {
    assertEnvReady('apiBaseUrl', 'adminUsername', 'adminPassword');
    const client = await newClient();
    const { status, token, body } = await client.login(env.adminUsername, env.adminPassword);
    expect(status).toBe(200);
    expect(readProp(body, 'Status')).toBe('Success');
    expect(typeof token).toBe('string');
    expect((token ?? '').length).toBeGreaterThan(0);
    await client.dispose();
  });

  test(`VAPT-AUTH-002 invalid password is rejected (no token) ${tags.regression} ${tags.negative} ${tags.p1}`, async () => {
    assertEnvReady('apiBaseUrl', 'adminUsername');
    const client = await newClient();
    const { token, body } = await client.login(env.adminUsername, `wrong-${uniqueCode('PW')}`);
    // SECURE-ish: credentials ARE really checked (no token issued). Observation
    // for the report: SignIn returns HTTP 200 with a Fail body rather than 401.
    expect(readProp(body, 'Status')).toBe('Fail');
    expect(token).toBeFalsy();
    await client.dispose();
  });

  test(`VAPT-AUTH-003 blank credentials are rejected (400) ${tags.regression} ${tags.negative} ${tags.p1}`, async () => {
    const client = await newClient();
    const res = await client.request('post', '/api/UserLogin/SignIn', null, { UserName: '', Password: '' });
    expect(res.status()).toBe(400); // model validation — SECURE
    await client.dispose();
  });

  test(`VAPT-AUTH-004 missing token on protected endpoint returns 401 ${tags.regression} ${tags.p0}`, async () => {
    const client = await newClient();
    const res = await client.request('post', PROTECTED_LIST, null, { Id: '1' });
    expect(res.status()).toBe(401); // SECURE — [Authorize] enforced
    await client.dispose();
  });

  test(`VAPT-AUTH-005 malformed token on protected endpoint returns 401 ${tags.regression} ${tags.p0}`, async () => {
    const client = await newClient();
    const res = await client.request('post', PROTECTED_LIST, 'not.a.valid.jwt', { Id: '1' });
    expect(res.status()).toBe(401); // SECURE — JWT validation rejects garbage
    await client.dispose();
  });

  test(`VAPT-AUTH-007 no token revocation / logout mechanism ${tags.regression} ${tags.p2}`, async () => {
    assertEnvReady('apiBaseUrl', 'adminUsername', 'adminPassword');
    const client = await newClient();
    const { token } = await client.login(env.adminUsername, env.adminPassword);
    expect(token).toBeTruthy();
    // There is no server-side logout/revocation endpoint (confirmed: no
    // logout/signout/revoke action exists in any controller). A stateless JWT
    // stays valid until natural expiry. DEFECT (no revocation): the same token
    // keeps working with nothing able to invalidate it server-side. Asserting
    // the token remains accepted, which is the confirmed actual behavior.
    const res = await client.request('post', PROTECTED_LIST, token, { Id: '1' });
    expect(res.status()).toBe(200);
    await client.dispose();
  });
});

// ---------------------------------------------------------------------------
// PHASE 3 / 11 — AUTHORIZATION & AUTHENTICATION-BYPASS
// ---------------------------------------------------------------------------
test.describe(`VAPT Phase 3 — Authorization & auth-bypass ${tags.security}`, () => {
  test(`VAPT-AUTHZ-001 CRITICAL api/Auth/login mints a token for a never-created account, accepted by protected endpoints ${tags.regression} ${tags.p0}`, async () => {
    const client = await newClient();

    // Step 1: /api/Auth/login performs NO credential check — it signs a valid
    // JWT for any non-blank username/password (AuthController.Login).
    const loginRes = await client.request('post', '/api/Auth/login', null, {
      Username: `attacker_${uniqueCode('NOACCT')}`,
      Password: `whatever_${uniqueCode('PW')}`,
    });
    expect(loginRes.status()).toBe(200);
    const loginBody = await loginRes.json().catch(() => null);
    const forgedToken = readProp(loginBody, 'Token') as string;
    expect(typeof forgedToken).toBe('string');
    expect(forgedToken.length).toBeGreaterThan(0);

    // Step 2 (control): the same protected endpoint rejects a token-less call.
    const noTokenRes = await client.request('post', PROTECTED_LIST, null, { Id: '1' });
    expect(noTokenRes.status()).toBe(401);

    // Step 3 (bypass): the forged-account token is ACCEPTED by the [Authorize]
    // endpoint. SECURE expectation: 401/403 (the account never existed).
    // Confirmed actual: 200 Success — full authentication bypass.
    const bypassRes = await client.request('post', PROTECTED_LIST, forgedToken, { Id: '1' });
    expect(bypassRes.status()).toBe(200);
    const bypassBody = await bypassRes.json().catch(() => null);
    expect(readProp(bypassBody, 'Status')).toBe('Success');

    await client.dispose();
  });

  test(`VAPT-AUTHZ-002 server-issued tokens carry no role claim (no RBAC) ${tags.regression} ${tags.p1}`, async () => {
    assertEnvReady('apiBaseUrl', 'adminUsername', 'adminPassword');
    const client = await newClient();
    const { token } = await client.login(env.adminUsername, env.adminPassword);
    expect(token).toBeTruthy();
    const claims = decodeJwtPayloadUnverified(token as string);
    // DEFECT: no 'role'/'roles' claim exists anywhere in the real token, so no
    // endpoint can enforce role-based authorization. Every valid token is
    // equally privileged. SECURE expectation would be a role/authorization
    // claim the API actually checks.
    const roleKeys = Object.keys(claims).filter((k) => k.toLowerCase().includes('role'));
    expect(roleKeys).toHaveLength(0);
    await client.dispose();
  });
});

// ---------------------------------------------------------------------------
// PHASE 5 / 9 — BROKEN ACCESS CONTROL (unauthenticated data exposure)
// ---------------------------------------------------------------------------
test.describe(`VAPT Phase 5 — Unauthenticated access control ${tags.security}`, () => {
  test(`VAPT-BAC-001 unauthenticated read of CompanyProfile succeeds ${tags.regression} ${tags.p1}`, async () => {
    const client = await newClient();
    // No [Authorize] on CompanyProfileController. SECURE expectation: 401.
    // Confirmed actual: 200 Success with company records for an anonymous caller.
    const res = await client.request('post', UNAUTH_COMPANY_LIST, null, { Id: '' });
    expect(res.status()).toBe(200);
    const body = await res.json().catch(() => null);
    expect(readProp(body, 'Status')).toBe('Success');
    await client.dispose();
  });

  test(`VAPT-BAC-002 CRITICAL unauthenticated UserProfile read exposes stored plaintext password ${tags.regression} ${tags.p0}`, async () => {
    assertEnvReady('apiBaseUrl', 'adminUsername');
    const client = await newClient();
    // No [Authorize] on UserProfileController; the projection includes the
    // custom NormalizedPassword column (stored in plaintext). SECURE
    // expectation: 401, and passwords should never be returned or stored in
    // plaintext at all. Confirmed actual: an anonymous caller receives the
    // user record including a non-empty plaintext password field.
    const res = await client.request('post', UNAUTH_USER_LLIST, null, { Name: env.adminUsername });
    expect(res.status()).toBe(200);
    const body = await res.json().catch(() => null);
    const row = firstRow(body);
    expect(row, 'expected at least one user record for the admin username').not.toBeNull();
    const pw = pickValue(row as Record<string, unknown>, 'normalizedPassword', 'password');
    // Assert the sensitive field is present AND populated — WITHOUT ever
    // logging or asserting its actual value.
    expect(typeof pw).toBe('string');
    expect((pw as string).length).toBeGreaterThan(0);
    await client.dispose();
  });

  test(`VAPT-BAC-003 unauthenticated write is accepted (UOM insert, self-cleaned) ${tags.regression} ${tags.p0}`, async () => {
    const client = await newClient();
    const name = uniqueCode('VAPTUOM');
    // No [Authorize] on UOMController.Insert. SECURE expectation: 401.
    // Confirmed actual: 200 Success and a row is really created.
    const res = await client.request('post', '/api/UOM/Insert', null, {
      Name: name,
      IsActive: true,
      CreatedBy: 'vapt',
      CreatedFrom: 'API',
      CompanyId: 1,
    });
    expect(res.status()).toBe(200);
    const body = await res.json().catch(() => null);
    expect(readProp(body, 'Status')).toBe('Success');
    const newId = String(readProp(body, 'Id') ?? '');
    expect(newId).not.toBe('');

    // Non-destructive tidy-up: remove the row we just created.
    if (newId && newId !== '0') {
      const del = await client.request('post', '/api/UOM/Delete', null, {
        Id: newId,
        IDs: [newId],
        ModifyBy: 'vapt',
        ModifyFrom: 'API',
      });
      expect(del.status()).toBe(200);
    }
    await client.dispose();
  });
});

// ---------------------------------------------------------------------------
// PHASE 6 / 9 — SQL INJECTION & INFORMATION DISCLOSURE
// ---------------------------------------------------------------------------
test.describe(`VAPT Phase 6 — SQL injection & information disclosure ${tags.security}`, () => {
  // Minimal, read-only grid payload; only the filter Value changes between the
  // baseline and the injected case.
  const gridPayload = (filterValue: string) => ({
    skip: 0,
    take: 5,
    page: 1,
    pageSize: 5,
    sort: [] as unknown[],
    filter: { Logic: 'and', Filters: [{ Operator: 'eq', Field: 'H.Code', Value: filterValue }] },
    vm: { CompanyId: '1' },
    CompanyId: 1,
  });

  test(`VAPT-SQLI-001 error-based SQL injection via grid filter value ${tags.regression} ${tags.p0}`, async () => {
    assertEnvReady('apiBaseUrl', 'adminUsername', 'adminPassword');
    const client = await newClient();
    const { token } = await client.login(env.adminUsername, env.adminPassword);
    expect(token).toBeTruthy();

    // Baseline: a well-formed value returns normally.
    const baseRes = await client.request('post', PROTECTED_GRIDDATA, token, gridPayload('ZZZNONE'));
    expect(baseRes.status()).toBe(200);
    const baseBody = await baseRes.json().catch(() => null);
    expect(readProp(baseBody, 'Status')).toBe('Success');

    // Injected: an unbalanced single quote breaks out of the string literal
    // because filter.Value is concatenated straight into the SQL (BuildWhereClause).
    // SECURE expectation: parameterized query, value treated as data (still Success/empty).
    // Confirmed actual: a raw SQL syntax error is produced.
    const injRes = await client.request('post', PROTECTED_GRIDDATA, token, gridPayload("ZZZ'NONE"));
    expect(injRes.status()).toBe(200);
    const injBody = await injRes.json().catch(() => null);
    const message = String(readProp(injBody, 'Message') ?? '');
    expect(readProp(injBody, 'Status')).toBe('Fail');
    expect(message.toLowerCase()).toContain('incorrect syntax'); // SQL Server error text => injection confirmed
    await client.dispose();
  });

  test(`VAPT-INFO-001 API leaks raw exception with server file path & line number ${tags.regression} ${tags.p1}`, async () => {
    assertEnvReady('apiBaseUrl', 'adminUsername', 'adminPassword');
    const client = await newClient();
    const { token } = await client.login(env.adminUsername, env.adminPassword);
    // Reuse the injection above purely as a reliable way to trigger a handled
    // exception, then assert on what the error response DISCLOSES.
    const injRes = await client.request('post', PROTECTED_GRIDDATA, token, gridPayload("ZZZ'NONE"));
    const injBody = await injRes.json().catch(() => null);
    const message = String(readProp(injBody, 'Message') ?? '') + String(readProp(injBody, 'ExMessage') ?? '');
    // DEFECT: response body carries an absolute server source-file path and
    // line number. SECURE expectation: a generic error with no internals.
    expect(message).toMatch(/\.cs:line \d+/);
    await client.dispose();
  });

  test(`VAPT-INFO-002 Swagger/OpenAPI spec is served without authentication ${tags.regression} ${tags.p2}`, async () => {
    const client = await newClient();
    // DEFECT (attack-surface disclosure): the full API contract is public.
    // SECURE expectation: Swagger disabled in production or access-controlled.
    const res = await client.request('get', '/swagger/v1/swagger.json', null);
    expect(res.status()).toBe(200);
    const text = await res.text();
    const pathCount = (text.match(/"\/api\//g) ?? []).length;
    expect(pathCount).toBeGreaterThan(50);
    await client.dispose();
  });
});
