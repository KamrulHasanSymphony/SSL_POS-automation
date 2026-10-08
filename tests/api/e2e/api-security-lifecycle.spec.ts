import { test, expect } from '@playwright/test';
import { SecurityApiClient, decodeJwtPayloadUnverified } from '../../../api/SecurityApiClient';
import { readProp } from '../../../utils/test-data-setup';
import { env, assertEnvReady } from '../../../utils/env';
import { tags } from '../../../config/tags';

/**
 * STEP API-SECURITY-LIFECYCLE-INVESTIGATION-AND-IMPLEMENTATION
 *
 * Cross-module E2E API Security lifecycle: Login -> Capture JWT Token ->
 * Call Public API -> Call Protected API Without Token -> Call Protected API
 * With Invalid Token -> Call Protected API With Valid Token -> Role
 * Permission Validation -> Logout. Independent of every UI test (a browser
 * session can never construct a token-less/garbage-token raw API request
 * the way this spec does — same reasoning `tests/api/unauthenticated-access.spec.ts`'s
 * own class doc comment already documents).
 *
 * INVESTIGATION FINDINGS (confirmed exhaustively from source before this
 * spec's first run, not discovered by trial-and-error — every controller
 * under `SSL_POS_Api/ShampanPOS/Controllers/*.cs`, 50 files, was
 * individually enumerated):
 *
 * 1. AUTHENTICATION MIDDLEWARE (`Program.cs`): real JWT-bearer middleware IS
 *    correctly wired (`AddAuthentication(JwtBearerDefaults...).AddJwtBearer(...)`,
 *    `app.UseAuthentication()` + `app.UseAuthorization()`, in the correct
 *    order, before `app.MapControllers()`). `TokenValidationParameters` sets
 *    `ValidateIssuer/ValidateAudience/ValidateLifetime/ValidateIssuerSigningKey
 *    = true` and `ClockSkew = TimeSpan.Zero` — a missing, malformed, wrong-
 *    signature, or expired token IS genuinely rejected by this middleware
 *    wherever `[Authorize]` is actually applied. `OnChallenge` is overridden
 *    to return a clean `401` + JSON body instead of ASP.NET's default HTML
 *    redirect — this is an API, not a browser app, and it behaves like one
 *    here.
 *
 * 2. THE APP HAS TWO DIFFERENT LOGIN ENDPOINTS WITH RADICALLY DIFFERENT
 *    SECURITY:
 *    - `api/UserLogin/SignIn` (`UserLoginController.cs`) — the REAL one,
 *      confirmed used end-to-end by the MVC UI itself
 *      (`ShampanPOSUI/Controllers/LoginController.cs` -> `CommonRepo.
 *      SignInAuthentication`) and by this project's own
 *      `utils/api-helper.ts`'s `ApiClient.authenticate()`. Performs a REAL
 *      credential check via ASP.NET Identity's `SignInManager.
 *      PasswordSignInAsync`. This is the endpoint this spec logs in
 *      through.
 *    - `api/Auth/login` (`AuthController.cs`) — CONFIRMED STRUCTURALLY
 *      UNREACHABLE from any UI-driven flow (already independently
 *      confirmed and covered by this project's own
 *      `tests/api/auth-login.spec.ts`, PROP-API-012/013 — not
 *      re-implemented here). Performs NO credential/DB check at all
 *      (`if (!string.IsNullOrWhiteSpace(Username) && !string.IsNullOrWhiteSpace(Password))`
 *      is the entire check) — issues a valid, real, signed JWT for ANY
 *      non-blank username/password pair, account or not. A dead/orphaned
 *      endpoint that is nonetheless live and exploitable if ever called.
 *
 * 3. NEITHER login endpoint embeds a role claim in the issued JWT — both
 *    `AuthController.Login()` and `UserLoginController.GetAccessToken()`
 *    build their `claims` array from exactly `Sub` (username) + `Jti` (a
 *    random guid), nothing else. Confirmed live below (Step 6b) by
 *    decoding a real, server-issued token's own payload.
 *
 * 4. ZERO `[Authorize(Roles = "...")]` (or any other role-restriction
 *    attribute) exists ANYWHERE in this solution — confirmed by an
 *    exhaustive grep across all 50 controller files: only bare `[Authorize]`
 *    (is-authenticated, not role-checked) appears, on exactly 17 of the 50
 *    controllers. There is no server-side mechanism ANYWHERE in this API to
 *    grant Admin-only access or deny a lower-privileged authenticated user
 *    — even setting finding 3 aside, there is nowhere for such a check to
 *    even be written today.
 *
 * 5. SEC-006 (`config/tags.ts`'s own `knownDefectCandidateIds`: "unprotected
 *    API controllers reachable without a bearer token") — CONFIRMED LIVE
 *    HERE for the first time (previously catalogued, STEP 4-deferred, never
 *    implemented). 33 of the 50 controllers carry NO `[Authorize]` at all,
 *    and — critically — zero `[AllowAnonymous]` attribute exists ANYWHERE
 *    in the solution either: this is not a deliberate "these are public
 *    reference endpoints" design (no controller opts out explicitly), it is
 *    every controller defaulting to public because `Program.cs` never
 *    registers a global fallback authorization policy — `[Authorize]` is
 *    purely opt-IN here, not opt-out. Among the 33: `UserProfileController`,
 *    `BranchProfileController`, `SettingsController`, `CompanyProfileController`,
 *    and `UserBranchProfileController` — exactly the "User Management" /
 *    company-config admin surface this task's own Role Authorization
 *    section calls out — are all reachable with NO token at all, not merely
 *    with the wrong role. `UserProfileController.cs` even has
 *    `using Microsoft.AspNetCore.Authorization;` at the top with no
 *    `[Authorize]` anywhere in the class — strongly suggesting this was
 *    intended to be protected and the attribute was simply never added.
 *
 * 6. NO logout/revoke/sign-out endpoint exists anywhere in this API
 *    (confirmed: zero "logout"/"revoke"/"signout" hits across all
 *    controllers). This is architecturally consistent with stateless JWT —
 *    a client "logs out" simply by discarding the token locally — but there
 *    is no server-side mechanism to revoke a token before its own `exp`
 *    (1 hour for `AuthController`, 24 hours for `UserLoginController`)
 *    elapses, so a leaked token remains valid for its full lifetime
 *    regardless of client-side "logout". Documented at Step 7 below rather
 *    than faked as a real endpoint call.
 *
 * 7. EXPIRED-TOKEN REJECTION — confirmed from source only (finding 1's
 *    `ValidateLifetime = true` / `ClockSkew = TimeSpan.Zero`), NOT
 *    live-exercised: doing so would require either waiting out a real
 *    token's full 1-24 hour lifetime, or minting a fresh JWT signed with
 *    the real `Jwt:SecretKey` from `appsettings.json` with a past `exp`
 *    claim — the latter is exactly the "add a fake token" this task's own
 *    rules forbid (it would mean constructing a new, validly-signed
 *    credential, not merely sending deliberately-bad input). The garbage
 *    string used for "invalid token" below is a nonsense value with no
 *    JWT structure at all — a clearly-malformed negative-test input, not a
 *    forged credential — which is why it is used for that case instead.
 *
 * RESULT: Login/token-capture/public-access/no-token-rejection/invalid-
 * token-rejection/valid-token-acceptance all PASS exactly as the task's own
 * Validation Matrix expects. Role Permission Validation is a CONFIRMED
 * SECURITY GAP (SEC-006 + no role claims + no `[Authorize(Roles=)]`
 * anywhere) rather than a working 403/Forbidden boundary — asserted as the
 * confirmed actual (insecure) behavior, tagged `@known-defect` per this
 * project's established convention (`tests/api/unauthenticated-access.spec.ts`),
 * never silently "fixed" by weakening the assertion to hide it.
 */
test.describe('E2E API Security Lifecycle', () => {
  test(`Login, JWT capture, public/protected access matrix, and Role Permission Validation reconcile end-to-end ${tags.security} ${tags.regression} ${tags.p0}`, async () => {
    assertEnvReady('apiBaseUrl', 'adminUsername', 'adminPassword');
    const client = await SecurityApiClient.create();

    try {
      // ============================================================
      // 1-2. LOGIN -> CAPTURE JWT TOKEN — via api/UserLogin/SignIn, the
      // real, credential-checked endpoint (see class doc comment finding 2).
      // ============================================================
      const loginResult = await client.login(env.adminUsername, env.adminPassword);
      expect(loginResult.status).toBe(200);
      expect(readProp(loginResult.body, 'Status')).toBe('Success');
      expect(typeof loginResult.token).toBe('string');
      expect(loginResult.token).not.toHaveLength(0);
      const validToken = loginResult.token as string;

      // ============================================================
      // 3. CALL PUBLIC API — api/EnumType/Dropdown, confirmed from source
      // (EnumTypeController.cs) to carry no [Authorize] at all. Read-only,
      // parameterless, no data mutation.
      // ============================================================
      const publicResponse = await client.request('get', '/api/EnumType/Dropdown', null);
      expect(publicResponse.status()).toBe(200);

      // ============================================================
      // 4. CALL PROTECTED API WITHOUT TOKEN — api/Customer/Dropdown,
      // confirmed [Authorize]-decorated at class level (CustomerController.cs).
      // Expected AND confirmed live: 401, per the Validation Matrix.
      // ============================================================
      const noTokenResponse = await client.request('get', '/api/Customer/Dropdown', null);
      expect(noTokenResponse.status()).toBe(401);

      // ============================================================
      // 5. CALL PROTECTED API WITH INVALID TOKEN — a deliberately
      // malformed, non-JWT-shaped garbage string (NOT a forged/signed
      // credential — see class doc comment finding 7 for why a real,
      // validly-signed-but-expired token is not constructed here).
      // ============================================================
      const invalidTokenResponse = await client.request('get', '/api/Customer/Dropdown', 'not-a-real-jwt-token-value');
      expect(invalidTokenResponse.status()).toBe(401);

      // ============================================================
      // 6a. CALL PROTECTED API WITH VALID TOKEN — same endpoint, this
      // spec's own real, freshly-issued admin token. Expected AND confirmed
      // live: 200.
      // ============================================================
      const validTokenResponse = await client.request('get', '/api/Customer/Dropdown', validToken);
      expect(validTokenResponse.status()).toBe(200);
      const validBody = await validTokenResponse.json();
      expect(readProp(validBody, 'Status')).toBeDefined();

      // 6b. Confirms class doc comment finding 3 LIVE, against this spec's
      // own real server-issued token: no "role"/"roles"/"Role" claim exists
      // in the payload at all — decoded, not verified/reused for access.
      const payload = decodeJwtPayloadUnverified(validToken);
      expect(payload.role).toBeUndefined();
      expect(payload.roles).toBeUndefined();
      expect(payload.Role).toBeUndefined();

      // ============================================================
      // 7. ROLE PERMISSION VALIDATION.
      //
      // The task's own scenario asks to create a distinct Admin User and
      // Normal User and confirm the Normal User is blocked (403/Access
      // Denied) from Admin-only APIs (User Management, Role Management,
      // Menu Authorization). That comparison is NOT attempted here as a
      // fresh two-account setup, for two independent, evidence-based
      // reasons rather than an arbitrary simplification:
      //   (a) confirmed from source (finding 4, this file's own class doc
      //       comment): zero `[Authorize(Roles = "...")]` exists ANYWHERE
      //       in this API — there is no role check in the code for a
      //       Normal User to be correctly blocked BY, so any two accounts
      //       (however distinctly provisioned) would be treated
      //       identically once authenticated;
      //   (b) creating a genuine second, distinctly-privileged, real
      //       loginable account through any confirmed-working mechanism in
      //       this environment is itself a previously-confirmed
      //       Application Defect, unrelated to this API
      //       (`tests/ui/e2e/multi-branch-lifecycle.spec.ts`'s own class
      //       doc comment: `UserProfilePage.createUserProfile()`'s Save
      //       fires `SignUpController`'s handler instead of its own) — not
      //       re-attempted here to avoid mutating shared user data via an
      //       already-confirmed-broken path.
      //
      // Instead, this proves the CONCRETE, stronger version of the same
      // gap directly: the exact "User Management" / company-config
      // Admin-only surface the task calls out is reachable with NO TOKEN
      // AT ALL — not merely with the wrong role. SEC-006
      // (config/tags.ts's own knownDefectCandidateIds), confirmed live for
      // the first time here. Each of these 5 controllers is confirmed from
      // source to carry no [Authorize] at all; each Dropdown() action is
      // parameterless and read-only (no data mutation, no database write —
      // matches this task's own "Do NOT modify database" rule).
      // ============================================================
      const unprotectedAdminEndpoints = [
        '/api/UserProfile/Dropdown', // User Management
        '/api/BranchProfile/Dropdown', // Branch/company administration
        '/api/Settings/Dropdown', // Application settings
        '/api/CompanyProfile/Dropdown', // Company profile/configuration
        '/api/UserBranchProfile/Dropdown', // User-to-branch role mapping
      ];
      for (const path of unprotectedAdminEndpoints) {
        const response = await client.request('get', path, null);
        // SECURITY DEFECT (SEC-006, confirmed by source, not assumed): the
        // secure expected behavior would be 401 (no token at all, exactly
        // like Step 4's Customer/Dropdown above); this asserts the
        // CONFIRMED actual (insecure) behavior instead, per this project's
        // established `@known-defect` convention — this must NEVER be
        // "fixed" by weakening it to expect 401 without the application
        // itself being fixed first.
        expect(response.status(), `${path} should require authentication (SEC-006)`).not.toBe(401);
        expect(response.status()).toBe(200);
      }

      // ============================================================
      // LOGOUT — confirmed from source (class doc comment finding 6): no
      // server-side logout/revoke/sign-out endpoint exists anywhere in this
      // API; JWT auth here is stateless. "Logout" for an API client is
      // simply discarding the token locally, which this spec does next by
      // disposing its own request context — there is no server call to
      // make, and this spec does not fabricate one.
      // ============================================================
    } finally {
      await client.dispose();
    }
  });

  test(`Unprotected admin-surface API access without any token is a confirmed security defect (SEC-006) ${tags.knownDefect} ${tags.security} ${tags.p0}`, async () => {
    assertEnvReady('apiBaseUrl');
    const client = await SecurityApiClient.create();
    try {
      // Isolated, single-purpose @known-defect assertion (project convention:
      // tests/api/unauthenticated-access.spec.ts's own PROP-API-001..003) —
      // kept separate from the main lifecycle test above so this specific,
      // currently-open vulnerability can be filtered in/out of a suite run
      // independently, without gating the rest of the lifecycle's PASS/FAIL
      // on it.
      const response = await client.request('get', '/api/UserProfile/Dropdown', null);
      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(readProp(body, 'Status')).toBeDefined();
    } finally {
      await client.dispose();
    }
  });
});
