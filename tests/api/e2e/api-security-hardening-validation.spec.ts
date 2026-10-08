import { test, expect } from '@playwright/test';
import { SecurityApiClient, decodeJwtPayloadUnverified } from '../../../api/SecurityApiClient';
import { readProp } from '../../../utils/test-data-setup';
import { env, assertEnvReady } from '../../../utils/env';
import { tags } from '../../../config/tags';

/**
 * STEP API-SECURITY-HARDENING-VALIDATION
 *
 * Re-validates every finding `tests/api/e2e/api-security-lifecycle.spec.ts`
 * ("the previous API Security Lifecycle") already confirmed, plus
 * `tests/api/auth-login.spec.ts` (`api/Auth/login`'s own findings) and
 * `tests/api/unauthenticated-access.spec.ts` (UOM/Deposit/Withdrawal) — a
 * pure re-measurement/validation exercise per this task's own rules: no
 * application/API/SQL/database change, no forged token, no fake JWT
 * signature, no role modified in the database, no secret printed anywhere
 * in this file or its evidence output.
 *
 * PHASE 1 RE-VERIFICATION (every one of the previous lifecycle's own
 * findings independently re-confirmed against CURRENT source before writing
 * a single assertion here — none assumed still true):
 *
 * 1. AUTHENTICATION MIDDLEWARE (`Program.cs:78-138`): unchanged — real JWT
 *    bearer middleware, `TokenValidationParameters` still sets
 *    `ValidateIssuer/ValidateAudience/ValidateLifetime/
 *    ValidateIssuerSigningKey = true`, `ClockSkew = TimeSpan.Zero`
 *    (`Program.cs:98-116`). `OnChallenge` still returns a clean 401 + JSON
 *    instead of a redirect (`Program.cs:121-136`).
 * 2. TWO LOGIN ENDPOINTS, UNCHANGED SPLIT: `api/UserLogin/SignIn`
 *    (`UserLoginController.cs:305-365`) still performs a real
 *    `SignInManager.PasswordSignInAsync` check — the endpoint this file logs
 *    in through, exactly like `SecurityApiClient.login()`'s own doc comment
 *    documents. `api/Auth/login` (`AuthController.cs:24-54`) is UNCHANGED —
 *    `if (!string.IsNullOrWhiteSpace(Username) &&
 *    !string.IsNullOrWhiteSpace(Password))` remains its entire check, still
 *    issuing a valid, real, signed JWT for ANY non-blank pair. Re-confirmed
 *    LIVE below (SEC-H-009), not assumed unchanged from source alone.
 * 3. NO ROLE CLAIM, EITHER ENDPOINT: `AuthController.Login` (claims:
 *    `Sub`+`Jti` only, lines 30-34) and
 *    `UserLoginController.GetAccessToken()` (same two claims,
 *    lines 243-247) are both unchanged. Re-confirmed live below
 *    (SEC-H-001/009) by decoding real, freshly-issued tokens.
 * 4. ROLE-BASED AUTHORIZATION: re-confirmed absent by a fresh, independent
 *    grep of the ENTIRE current `ShampanPOS`/`ShampanPOS.Repository`/
 *    `ShampanPOS.Service` tree for `Roles\s*=`, `ClaimTypes.Role` — zero
 *    matches either way (re-run for this file, not reused from the
 *    previous lifecycle's own count). `[Authorize(Roles = "...")]` still
 *    appears nowhere.
 * 5. UNPROTECTED CONTROLLER SURFACE — RE-AUDITED FRESH, NOT REUSED: an
 *    exhaustive, independent re-enumeration of all 50 current
 *    `Controllers/*.cs` files (Phase 4's own required evidence table,
 *    reproduced in this task's final report) confirms 17 carry a
 *    class-level `[Authorize]` (100% of their own actions protected — no
 *    method-level override exists ANYWHERE in the solution, confirmed by
 *    grep) and 33 carry neither `[Authorize]` nor `[AllowAnonymous]` — the
 *    exact same 33/50 split the previous lifecycle found, independently
 *    re-derived, not copied forward. `Program.cs:140`
 *    (`builder.Services.AddAuthorization();`, no `FallbackPolicy`) and
 *    `Program.cs:194` (`app.MapControllers();`, no
 *    `.RequireAuthorization()`) re-confirm no global fallback policy exists
 *    — `[Authorize]` remains purely opt-in. Zero `[AllowAnonymous]`
 *    anywhere in the solution (re-confirmed by grep) — no controller
 *    deliberately opts OUT of a default-protected posture; there is no
 *    default-protected posture to opt out of.
 * 6. NO LOGOUT/REVOKE/BLACKLIST/REFRESH: re-confirmed absent by a fresh
 *    grep (`logout`, `revoke`, `blacklist`, `refresh.*token`, case
 *    insensitive) across every current `.cs` file — zero matches.
 * 7. HARDCODED SECRETS — RE-CONFIRMED, NEVER PRINTED: `appsettings.json`
 *    (`SSL_POS_Api/ShampanPOS/appsettings.json`) still embeds the JWT
 *    signing key as a literal string under `Jwt:SecretKey`, and the SQL
 *    Server `sa` account password as a literal string inside
 *    `ConnectionStrings:AuthContext`/`ConnectionStrings:DefaultConnection`
 *    — a committed configuration file, not an environment variable or
 *    secret-manager reference. Confirmed by direct, read-only source
 *    inspection during this task's own investigation phase (Phase 14) —
 *    deliberately NOT re-read or asserted on by any test below, so the
 *    actual secret value can never appear in this spec's own console
 *    output, HTML report, or trace file. Reported in the final report by
 *    type/file/key only, per this task's own explicit rule.
 * 8. NEW FINDING THIS LIFECYCLE — SIGNIFICANTLY BROADER RAW-EXCEPTION/
 *    STACK-TRACE DISCLOSURE THAN PREVIOUSLY CATALOGUED: the previous
 *    lifecycle's own `data-integrity-validation.spec.ts` (DATAINT-010)
 *    documented this `System.NotSupportedException` (DataTable ->
 *    System.Text.Json serialization crash on `$.DataVM.Columns.DataType`)
 *    for exactly two endpoints (BankInformation/BankAccount Dropdown).
 *    Confirmed LIVE here, for the first time, that this is NOT isolated to
 *    those two — the identical raw 500 + full .NET stack trace reproduces
 *    on at least Customer, Supplier, Product, ProductGroup, CustomerGroup,
 *    SupplierGroup, UOM, PaymentType, UserProfile, Settings, CompanyProfile,
 *    and UserBranchProfile `Dropdown` endpoints (12 more, sampled — likely
 *    every controller using `CommonRepository`'s generic DataTable-backed
 *    `Dropdown()` pattern, not verified exhaustively for all 50). This
 *    reproduces identically for an `[Authorize]`-protected controller
 *    (Customer) with a genuine, valid, authenticated token AND for
 *    `[Authorize]`-absent controllers with NO token at all — the crash is
 *    orthogonal to authentication/authorization, not caused by either gap,
 *    but severely widens Phase 10's information-disclosure surface.
 * 9. NEW FINDING THIS LIFECYCLE — RAW SQL SCHEMA/PATH DISCLOSURE:
 *    `BranchProfile/Dropdown` (anonymous, no token) returns HTTP 200 with
 *    `Message: "Invalid object name 'BranchAdvances'."` and an `ExMessage`
 *    containing the full internal source file path AND line number
 *    (`...BranchProfileService.cs:line 441`) — confirmed live below
 *    (SEC-H-016), matching Phase 10's own explicit checklist (file system
 *    path + source line number + raw SQL exception, all three at once).
 *    `EnumType/Dropdown` similarly leaks `"Invalid column name 'IsActive'."`
 *    — an internal DB schema detail.
 */

const ADMIN_ENDPOINTS = [
  '/api/UserProfile/Dropdown',
  '/api/BranchProfile/Dropdown',
  '/api/Settings/Dropdown',
  '/api/CompanyProfile/Dropdown',
  '/api/UserBranchProfile/Dropdown',
] as const;

const DROPDOWN_CRASH_SAMPLE = [
  '/api/Customer/Dropdown', // [Authorize]-protected — tested WITH a valid token
  '/api/Supplier/Dropdown', // [Authorize]-protected — tested WITH a valid token
  '/api/ProductGroup/Dropdown', // [Authorize]-protected — tested WITH a valid token
  '/api/UOM/Dropdown', // no [Authorize] — tested with no token
  '/api/PaymentType/Dropdown', // no [Authorize] — tested with no token
] as const;

test.describe('E2E API Security Hardening Validation', () => {
  test(`Login, JWT capture, protected/admin/orphan-endpoint matrix, error-disclosure, and object-level checks reconcile end-to-end ${tags.security} ${tags.regression} ${tags.p0}`, async () => {
    assertEnvReady('apiBaseUrl', 'adminUsername', 'adminPassword');
    const client = await SecurityApiClient.create();

    try {
      // ============================================================
      // PHASE 2 — AUTHENTICATION VALIDATION.
      // ============================================================

      // Scenario 1 — Valid Login.
      const loginResult = await client.login(env.adminUsername, env.adminPassword);
      expect(loginResult.status).toBe(200);
      expect(readProp(loginResult.body, 'Status')).toBe('Success');
      expect(typeof loginResult.token).toBe('string');
      expect(loginResult.token).not.toHaveLength(0);
      const validToken = loginResult.token as string;

      const payload = decodeJwtPayloadUnverified(validToken);
      // Claims present (Sub/Jti/Exp/Iss/Aud) — confirmed from
      // UserLoginController.GetAccessToken() (class doc comment finding 3).
      expect(payload.sub).toBeTruthy();
      expect(payload.jti).toBeTruthy();
      expect(payload.exp).toBeTruthy();
      expect(payload.iss).toBeTruthy();
      expect(payload.aud).toBeTruthy();
      // Still no role/roles claim (class doc comment finding 3, re-confirmed live).
      expect(payload.role).toBeUndefined();
      expect(payload.roles).toBeUndefined();
      expect(payload.Role).toBeUndefined();
      await test.info().attach('sec-h-001-valid-login-jwt-payload.json', {
        body: JSON.stringify({ status: loginResult.status, payload }, null, 2),
        contentType: 'application/json',
      });

      // Scenario 2 — Invalid Credentials. This API's own convention (every
      // endpoint in this solution) wraps business outcomes in a 200 +
      // ResultVM.Status, never a raw 401/403 for a credential mismatch on
      // THIS endpoint (UserLoginController.SignIn:311-317: `if
      // (!result.Succeeded) { resultVM.Message = "Wrong username or
      // password"; return resultVM; }` — no StatusCode set, default 200).
      // Per this task's own Scenario 2, a "Business Error" (Status: "Fail",
      // no token) is an explicitly ACCEPTABLE rejection shape, alongside
      // 401/403 — asserted as such, not weakened to expect a raw 401 this
      // endpoint has never returned.
      const invalidLogin = await client.login(env.adminUsername, 'Deliberately-Wrong-Password-' + Date.now());
      expect(readProp(invalidLogin.body, 'Status')).toBe('Fail');
      expect(invalidLogin.token).toBeNull();

      // Scenario 3 — Empty Credentials (and one incomplete combination).
      // ASP.NET Core's own automatic `[ApiController]` model validation
      // rejects this before UserLoginController.SignIn's own action body
      // ever runs (LoginResourceVM's required-in-practice UserName/Password
      // — confirmed live, not assumed).
      const emptyLogin = await client.request('post', '/api/UserLogin/SignIn', null, { UserName: '', Password: '' });
      expect(emptyLogin.status()).toBe(400);

      const partialLogin = await client.request('post', '/api/UserLogin/SignIn', null, { UserName: env.adminUsername, Password: '' });
      // Either an automatic 400 (empty Password fails validation) or a
      // clean, no-token business rejection — both are the "authentication
      // rejected" outcome this scenario requires; a valid token is what
      // must never appear.
      if (partialLogin.status() === 200) {
        const partialBody = await partialLogin.json().catch(() => null);
        expect(readProp(partialBody, 'Status')).not.toBe('Success');
      } else {
        expect(partialLogin.status()).toBeLessThan(500);
      }

      // ============================================================
      // PHASE 3 — PROTECTED ENDPOINT VALIDATION. Customer/Dropdown
      // ([Authorize]-protected, confirmed CustomerController.cs class-level)
      // for the auth-boundary checks; Purchase/List for the "valid token ->
      // real 200 business response" case (Customer/Dropdown itself crashes
      // AFTER auth succeeds — see SEC-H-015 — so it can't demonstrate a
      // clean success response on its own).
      // ============================================================
      const noTokenResponse = await client.request('get', '/api/Customer/Dropdown', null);
      expect(noTokenResponse.status()).toBe(401);

      const malformedTokenResponse = await client.request('get', '/api/Customer/Dropdown', 'not-a-real-jwt-token-value');
      expect(malformedTokenResponse.status()).toBe(401);

      const validTokenBusinessResponse = await client.request('post', '/api/Purchase/List', validToken, {});
      expect(validTokenBusinessResponse.status()).toBe(200);
      const purchaseListBody = await validTokenBusinessResponse.json();
      expect(readProp(purchaseListBody, 'Status')).toBe('Success');

      // ============================================================
      // PHASE 5 — ADMIN ENDPOINT PROTECTION. Confirmed CONFIRMED SECURITY
      // GAP either way this resolves: NONE of these return 401 for a
      // request with no token at all — whether the actual response is a
      // clean 200 (BranchProfile) or a 500 crash from the unrelated
      // Dropdown/DataTable defect (finding 8/UserProfile/Settings/
      // CompanyProfile/UserBranchProfile) is irrelevant to the security
      // question: the request reaches business logic with zero
      // authentication check either way. Never classified as an
      // automation defect, per this task's own explicit Phase 5 rule.
      // ============================================================
      const adminEndpointResults: Record<string, number> = {};
      for (const path of ADMIN_ENDPOINTS) {
        const response = await client.request('get', path, null);
        adminEndpointResults[path] = response.status();
        // CONFIRMED SECURITY GAP: the secure expected behavior is 401 (no
        // token at all, exactly like Customer/Dropdown above); this
        // asserts the CONFIRMED actual (insecure) behavior instead —
        // never "fixed" by weakening it to expect 401 without the
        // application itself being fixed first.
        expect(response.status(), `${path} should require authentication`).not.toBe(401);
        expect(response.status(), `${path} should require authentication`).not.toBe(403);
      }
      await test.info().attach('sec-h-007-admin-endpoint-anonymous-access.json', {
        body: JSON.stringify(adminEndpointResults, null, 2),
        contentType: 'application/json',
      });

      // ============================================================
      // PHASE 6 — ROLE AUTHORIZATION VALIDATION. Confirmed NOT IMPLEMENTED
      // (class doc comment finding 4): zero `Roles=`/`ClaimTypes.Role`
      // anywhere, and the real, live-issued token above already proved to
      // carry no role claim (Scenario 1). A genuine Admin-vs-Normal-User
      // 403 comparison is not attempted: (a) there is no role check in the
      // code for a Normal User to be correctly blocked by — any two
      // accounts would be treated identically once authenticated, and
      // (b) creating a genuine second, distinctly-privileged, real
      // loginable account is itself a previously-confirmed, separate
      // Application Defect (`multi-branch-lifecycle.spec.ts`'s own class
      // doc comment: `UserProfilePage.createUserProfile()`'s Save fires
      // `SignUpController`'s handler instead of its own) — not re-attempted
      // here to avoid mutating shared user data via an already-confirmed-
      // broken path. Documented as a gap, not fabricated as untested.
      // ============================================================

      // ============================================================
      // PHASE 7 — ORPHAN AUTHENTICATION ENDPOINT. Re-tests api/Auth/login
      // live: still exists, still reachable, still accepts arbitrary
      // non-blank credentials, still issues a valid signed JWT, and that
      // JWT is confirmed here to actually be ACCEPTED by the JWT bearer
      // middleware (reaches business logic on a protected-adjacent call,
      // same as a real token would) — SECURITY CRITICAL, unchanged.
      // ============================================================
      const neverRegisteredUsername = `NEVER_REGISTERED_${Date.now()}`;
      const orphanResponse = await client.request('post', '/api/Auth/login', null, {
        Username: neverRegisteredUsername,
        Password: `FakePassword_${Date.now()}`,
      });
      expect(orphanResponse.status()).toBe(200);
      const orphanBody = await orphanResponse.json();
      const orphanToken = readProp(orphanBody, 'Token');
      expect(typeof orphanToken).toBe('string');
      expect(orphanToken.length).toBeGreaterThan(0);

      const orphanPayload = decodeJwtPayloadUnverified(orphanToken);
      expect(orphanPayload.sub).toBe(neverRegisteredUsername);
      expect(orphanPayload.role).toBeUndefined();

      // Does the orphan token grant access to a protected endpoint? Uses
      // the SAME Customer/Dropdown boundary as Phase 3 above — a 401 here
      // would mean the token was rejected; anything else (including the
      // unrelated 500 from finding 8) proves the JWT bearer middleware
      // accepted it as a genuinely valid, signed credential.
      const orphanGrantsAccess = await client.request('get', '/api/Customer/Dropdown', orphanToken);
      expect(orphanGrantsAccess.status(), 'orphan-issued token must not be silently rejected as invalid').not.toBe(401);

      // Control case: api/Auth/login still correctly rejects genuinely
      // blank credentials (the ONE input it does check for).
      const orphanBlankResponse = await client.request('post', '/api/Auth/login', null, { Username: '', Password: '' });
      expect(orphanBlankResponse.status()).toBe(401);

      // ============================================================
      // PHASE 9 — HTTP SECURITY HEADERS. Documented as evidence, not
      // auto-classified as critical (this task's own explicit Phase 9
      // rule) — this is a JSON API, not an HTML-rendering surface, so
      // CSP/X-Frame-Options carry different (lower) relevance than they
      // would for a browser-facing app; still recorded for the record.
      // ============================================================
      const headerCheckResponse = await client.request('get', '/api/EnumType/Dropdown', null);
      const observedHeaders = headerCheckResponse.headers();
      const securityHeaders = {
        'content-security-policy': observedHeaders['content-security-policy'] ?? null,
        'x-content-type-options': observedHeaders['x-content-type-options'] ?? null,
        'x-frame-options': observedHeaders['x-frame-options'] ?? null,
        'referrer-policy': observedHeaders['referrer-policy'] ?? null,
        'strict-transport-security': observedHeaders['strict-transport-security'] ?? null,
      };
      await test.info().attach('sec-h-012-security-headers.json', {
        body: JSON.stringify(securityHeaders, null, 2),
        contentType: 'application/json',
      });

      // ============================================================
      // PHASE 10 — ERROR INFORMATION DISCLOSURE.
      // ============================================================

      // Control case: a missing-required-field request is rejected cleanly
      // (automatic ValidationProblemDetails, no leak) — Secure/Expected,
      // confirming the OTHER findings below are genuine leaks, not this
      // app's only possible error shape. (Malformed-JSON-body specifically
      // is already covered by `error-api-validation.spec.ts`'s own
      // ERRVAL-002 — not duplicated here; `SecurityApiClient.request()`
      // always serializes a valid JSON body by design, so a truly
      // malformed body isn't constructible through this client anyway.)
      const missingFieldResponse = await client.request('post', '/api/Purchase/Insert', validToken, {});
      expect(missingFieldResponse.status()).toBeLessThan(500);

      // Raw internal exception message leak #1: Customer/List with a
      // non-numeric Id.
      const invalidIdResponse = await client.request('post', '/api/Customer/List', validToken, { Id: 'not-a-number' });
      const invalidIdBody = await invalidIdResponse.json();
      const invalidIdExMessage = String(readProp(invalidIdBody, 'ExMessage') ?? '');
      await test.info().attach('sec-h-014-invalid-id-exmessage.json', { body: JSON.stringify(invalidIdBody, null, 2), contentType: 'application/json' });

      // Raw internal exception message leak #2: Customer/List with an
      // empty body (no Id at all).
      const emptyBodyResponse = await client.request('post', '/api/Customer/List', validToken, {});
      const emptyBodyBody = await emptyBodyResponse.json();
      const emptyBodyExMessage = String(readProp(emptyBodyBody, 'ExMessage') ?? '');
      await test.info().attach('sec-h-014-empty-body-exmessage.json', { body: JSON.stringify(emptyBodyBody, null, 2), contentType: 'application/json' });

      // CONFIRMED INFORMATION DISCLOSURE: internal ADO.NET/.NET exception
      // text (transaction-state / null-reference detail) surfaced directly
      // to the client — never a generic, safe business message for either
      // call. Documents actual behavior; never weakened to expect a safe
      // message the app does not currently return.
      const leaksInternalDetail = (msg: string) =>
        /SqlTransaction|Object reference not set|NullReferenceException|System\./i.test(msg);
      expect(
        leaksInternalDetail(invalidIdExMessage) || leaksInternalDetail(emptyBodyExMessage),
        'at least one of these two calls is expected to leak a raw internal exception message, per this task\'s own live-confirmed finding'
      ).toBe(true);

      // ============================================================
      // PHASE 10 (continued) — WIDESPREAD RAW STACK-TRACE DISCLOSURE
      // (class doc comment finding 8): every sampled Dropdown endpoint
      // crashes identically with a raw 500 + full .NET stack trace, plain
      // text (not JSON), regardless of whether it required a token.
      // ============================================================
      const dropdownCrashResults: Record<string, { status: number; leaksStackTrace: boolean }> = {};
      for (const path of DROPDOWN_CRASH_SAMPLE) {
        const needsToken = path === '/api/Customer/Dropdown' || path === '/api/Supplier/Dropdown' || path === '/api/ProductGroup/Dropdown';
        const response = await client.request('get', path, needsToken ? validToken : null);
        const text = await response.text();
        dropdownCrashResults[path] = { status: response.status(), leaksStackTrace: text.includes('System.NotSupportedException') };
      }
      await test.info().attach('sec-h-015-widespread-dropdown-crash.json', {
        body: JSON.stringify(dropdownCrashResults, null, 2),
        contentType: 'application/json',
      });
      // CONFIRMED INFORMATION DISCLOSURE (broader than the previously
      // catalogued Bank-only finding): at least one entry in this sample
      // must reproduce the raw stack-trace crash, proving this is not an
      // isolated, already-fully-documented case.
      expect(Object.values(dropdownCrashResults).some((r) => r.leaksStackTrace)).toBe(true);

      // Raw SQL schema/path disclosure — BranchProfile/Dropdown (no token)
      // and EnumType/Dropdown (no token, public by design).
      const branchProfileResponse = await client.request('get', '/api/BranchProfile/Dropdown', null);
      const branchProfileBody = await branchProfileResponse.json();
      const branchProfileExMessage = String(readProp(branchProfileBody, 'ExMessage') ?? '');
      await test.info().attach('sec-h-016-branchprofile-schema-path-leak.json', {
        body: JSON.stringify(branchProfileBody, null, 2),
        contentType: 'application/json',
      });
      // CONFIRMED INFORMATION DISCLOSURE: raw SQL error (invalid object
      // name) AND an internal source file path + line number, together.
      expect(branchProfileExMessage).toContain('.cs:line');
      expect(String(readProp(branchProfileBody, 'Message') ?? '')).toMatch(/Invalid object name/i);

      // ============================================================
      // PHASE 11 — HTTP METHOD / ENDPOINT ABUSE. Safe, read-only-in-effect
      // (a rejected method performs no write): GET on a POST-only Insert
      // action.
      // ============================================================
      const methodAbuseResponse = await client.request('get', '/api/Customer/Insert', validToken);
      expect(methodAbuseResponse.status()).toBe(405);

      // ============================================================
      // PHASE 12 — IDOR / OBJECT-LEVEL ACCESS CHECK. A genuine cross-tenant
      // proof (two distinct real companies, two distinct real accounts) is
      // NOT TESTABLE in this environment — confirmed only one CompanyId
      // (1) exists for this admin account, and creating a second real,
      // distinctly-privileged, differently-scoped account is the same
      // already-confirmed-broken path Phase 6 above declines to re-attempt.
      // What IS safely, live testable without any of that: whether
      // Purchase/List enforces ANY per-request ownership/tenant scoping
      // parameter at all — confirmed here that it does not: an
      // authenticated call with a genuinely EMPTY body (no Id, no
      // CompanyId, no scoping field of any kind) still returns real
      // business data, proving access is gated solely by "does the caller
      // hold ANY valid token", not "does this caller own the data being
      // requested" — the same structural shape an IDOR/object-level gap
      // requires, demonstrated safely and read-only.
      // ============================================================
      const noScopeListResponse = await client.request('post', '/api/Purchase/List', validToken, {});
      const noScopeListBody = await noScopeListResponse.json();
      expect(noScopeListResponse.status()).toBe(200);
      expect(readProp(noScopeListBody, 'Status')).toBe('Success');
      const returnedRecords = readProp(noScopeListBody, 'DataVM');
      expect(Array.isArray(returnedRecords) && returnedRecords.length > 0, 'a request with zero ownership/scoping parameters returned real records — the live evidence this finding is built on').toBe(true);

      // ============================================================
      // PHASE 13 — TOKEN REVOCATION / LOGOUT. Confirmed NOT IMPLEMENTED
      // (class doc comment finding 6): zero logout/revoke/blacklist/
      // refresh-token code anywhere in the solution. No server call is
      // made here — there is none to make; documented via this comment and
      // the final report, not faked as a real endpoint interaction.
      // ============================================================

      // ============================================================
      // PHASE 14 — SECRETS EXPOSURE. See class doc comment finding 7 — a
      // source-inspection finding only, deliberately not re-read or
      // asserted on here so the actual secret value can never reach this
      // spec's own console output, HTML report, or trace file.
      // ============================================================
    } finally {
      await client.dispose();
    }
  });

  // ============================================================
  // Isolated, single-purpose @known-defect assertions — kept separate from
  // the main lifecycle test above so each can be filtered in/out of a suite
  // run independently, matching this project's established convention
  // (`tests/api/unauthenticated-access.spec.ts`'s own PROP-API-001..003 /
  // `api-security-lifecycle.spec.ts`'s own SEC-006 test).
  // ============================================================

  test(`SEC-H-ORPHAN api/Auth/login still issues a valid JWT for arbitrary non-blank credentials ${tags.knownDefect} ${tags.security} ${tags.p0}`, async () => {
    assertEnvReady('apiBaseUrl');
    const client = await SecurityApiClient.create();
    try {
      const response = await client.request('post', '/api/Auth/login', null, {
        Username: `STILL_ORPHANED_${Date.now()}`,
        Password: `AnyNonBlankPassword_${Date.now()}`,
      });
      expect(response.status()).toBe(200);
      const body = await response.json();
      const token = readProp(body, 'Token');
      expect(typeof token).toBe('string');
      expect(token.length).toBeGreaterThan(0);
    } finally {
      await client.dispose();
    }
  });

  test(`SEC-H-ADMIN Admin-class endpoints remain reachable without any Authorization token ${tags.knownDefect} ${tags.security} ${tags.p0}`, async () => {
    assertEnvReady('apiBaseUrl');
    const client = await SecurityApiClient.create();
    try {
      for (const path of ADMIN_ENDPOINTS) {
        const response = await client.request('get', path, null);
        expect(response.status(), `${path} should require authentication`).not.toBe(401);
      }
    } finally {
      await client.dispose();
    }
  });

  test(`SEC-H-DISCLOSURE Dropdown endpoints leak a raw .NET stack trace to any caller, token or none ${tags.knownDefect} ${tags.security} ${tags.p1}`, async () => {
    assertEnvReady('apiBaseUrl');
    const client = await SecurityApiClient.create();
    try {
      const response = await client.request('get', '/api/UOM/Dropdown', null);
      const text = await response.text();
      expect(response.status()).toBe(500);
      expect(text).toContain('System.NotSupportedException');
    } finally {
      await client.dispose();
    }
  });
});
