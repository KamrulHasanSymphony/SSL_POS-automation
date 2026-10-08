# POS Authentication Baseline Report

**Phase:** Authentication verification against the new target UI environment
**Date:** 2026-10-07
**Prepared by:** Automation (Playwright + TypeScript) — application source untouched

---

## Environment

```text
Target UI URL        : http://103.231.239.122:8006/
Login URL            : /  (also /Login/Index — both serve the login page, HTTP 200)
Login available      : YES (HTTP 200, Microsoft-IIS/10.0, ASP.NET MVC 5.3)
Authentication       : REQUIRED (Forms Auth, .ASPXAUTH cookie)
```

---

## Automation Configuration

```text
BASE_URL source      : automation/.env  ->  process.env.BASE_URL  ->  playwright.config.ts (use.baseURL)
Credential source    : automation/.env  (ADMIN_USERNAME / ADMIN_PASSWORD), loaded via utils/env.ts
Login Page Object    : pages/auth/LoginPage.ts
Auth setup file      : fixtures/auth.setup.ts  (npm run test:setup -> playwright test --project=setup)
Per-worker auth      : fixtures/auth.fixture.ts (workerAuthState — one real login per worker, in-memory)
Storage-state file   : storage/auth.json  (git-ignored via `storage/*.json`)
Username             : [configured in .env / redacted]
Password             : [configured securely / redacted]
```

### How credentials flow (STEP 1 findings)

1. **Username** — `env.adminUsername` ← `ADMIN_USERNAME` in `.env` (`utils/env.ts`).
2. **Password** — `env.adminPassword` ← `ADMIN_PASSWORD` in `.env` (never hard-coded in any spec).
3. **From `.env`?** — Yes, exclusively. No credentials are embedded in test files.
4. **storageState created by setup?** — Yes. `fixtures/auth.setup.ts` persists `storage/auth.json`; the `authenticated` project additionally builds a per-worker in-memory session via `fixtures/auth.fixture.ts` (`workerAuthState`). No project declares a static `dependencies: ['setup']` anymore — each worker self-authenticates.
5. **Storage-state location** — `storage/auth.json` (git-ignored).
6. **Tests depending on authenticated state** — every spec in the `authenticated` project: `tests/ui/{masters,purchase,sales,banking,reports,navigation}` and `tests/api/**`. They obtain their session from the per-worker fixture, not the static file.
7. **Company/branch selection during login** — No separate *company* step (a hidden `dbName` input, empty, is resolved server-side). A conditional **branch** step exists, handled by `pages/common/BranchSelectPage.resolveIfPresent()` (auto-redirect for single-branch, double-click row for multi-branch).
8. **Existing full-workflow login helper?** — Yes. `LoginPage.login()` + `BranchSelectPage.resolveIfPresent()` + `DashboardPage.expectLoaded()` are composed by both `auth.setup.ts` and the `performLogin` / `workerAuthState` fixtures. No duplicate infrastructure was created.

### STEP 2 — Setup command verified

`npm run test:setup` = `playwright test --project=setup`, which runs the single `authenticate` setup test in `fixtures/auth.setup.ts`: real login → resolve branch if present → assert dashboard loaded → save `storage/auth.json`. This is the correct, existing command — it was inspected before running, not assumed.

---

## Login Flow (actual runtime behaviour observed)

```text
Login (POST /)
  → Server responds 302 Found, Location: /     ← bounced BACK to the login page
  → No .ASPXAUTH session cookie issued
  → Redirected login page shows flash: "Wrong user name or password!"
  → Company selection : not reached (blocked at credential check)
  → Branch selection  : not reached (blocked at credential check)
  → Authenticated landing page (/Common/Home) : NOT reached
```

**Outcome: authentication did NOT succeed** with the configured `.env` credentials against `http://103.231.239.122:8006/`.

**Evidence (two independent methods, consistent):**

- **Playwright (`--project=setup`)**: login page loaded, both fields filled, `.login-btn` found/clicked; the submit's post-navigation never settled and the captured failure snapshot shows the login page with the message **"Wrong user name or password!"** (the app's exact `invalidCredentials` string). Artifacts: `test-results/fixtures-auth.setup.ts-authenticate-setup/` (screenshot + video + error-context).
- **Direct form POST** (credentials read from `.env`, never printed): `HTTP/1.1 302 Found`, `Location: /`, **no `.ASPXAUTH` cookie** granted.

All automation selectors resolved correctly — this is **not** a selector/automation defect. The server itself rejected the credentials.

---

## Verification Result

| Check | Result | Notes |
|---|---|---|
| TypeScript compile | **PASS** | `npx tsc --noEmit` exit 0, no errors |
| Login page load | **PASS** | `/` and `/Login/Index` return 200; login form renders |
| Username selector | **PASS** | `#UserName` resolved and filled |
| Password selector | **PASS** | `#Password` resolved and filled |
| Login submission | **PASS** | `.login-btn` found, enabled, clicked; POST sent |
| Authentication | **FAIL** | Server returned 302→`/`, no `.ASPXAUTH`; "Wrong user name or password!" |
| Company selection | **N/A** | Not reached (blocked before this point); no distinct company step in this UI |
| Branch selection | **N/A** | Not reached (blocked at credential check) |
| Storage state | **FAIL** | `storage/auth.json` was NOT refreshed (setup failed); existing file is stale (2026-08-27, old local env) and unusable against this environment |
| Authenticated smoke | **BLOCKED** | Cannot run until a valid authenticated session exists |

### Failure classification (STEP 8)

```text
Category : INVALID_CREDENTIAL  (environment credential configuration required)
```

The configured `ADMIN_USERNAME` / `ADMIN_PASSWORD` (carried over from the previous local environment) are not valid on this remote environment — the account may not exist in this environment's database, or this deployment may be multi-tenant and require a specific `dbName` (the login form carries a hidden, currently-empty `dbName` field). **Per the safety rules, no credentials or `dbName` value were guessed, and the application was not modified to force a pass.**

**To unblock:** provide valid credentials for `http://103.231.239.122:8006/` (and the `dbName`/company identifier if this deployment requires one). Only `automation/.env` needs updating — no code change.

---

## API Environment Status

```text
Remote API endpoint (API_BASE_URL) : NOT PROVIDED
```

`automation/.env` still contains the previous local value (`https://localhost:7242`), which is unreachable from this environment. The correct remote API URL has not been supplied, so **no API tests were executed** (they are not cleanly skipped — because `API_BASE_URL` is non-empty they would attempt the stale local host and fail with connection errors rather than skip).

**Affected API automation — all classified `READY_ONCE_API_URL_IS_PROVIDED`:**

| File | Dependency |
|---|---|
| `tests/api/auth-login.spec.ts` | `assertEnvReady('apiBaseUrl')` |
| `tests/api/enum-type.spec.ts` | `assertEnvReady('apiBaseUrl')` |
| `tests/api/unauthenticated-access.spec.ts` | `assertEnvReady('apiBaseUrl')` |
| `tests/api/due-amount-validation.spec.ts` | `ApiClient` / `api-helper` |
| `tests/api/duplicate-validation.spec.ts` | `ApiClient` / `api-helper` |
| `tests/api/e2e/api-security-hardening-validation.spec.ts` | `API_BASE_URL` / client |
| `tests/api/e2e/api-security-lifecycle.spec.ts` | `API_BASE_URL` / client |
| `tests/api/e2e/data-integrity-validation.spec.ts` | `ApiClient` / `api-helper` |
| `tests/api/e2e/error-api-revalidation.spec.ts` | `ApiClient` / `api-helper` |
| `tests/api/e2e/error-api-validation.spec.ts` | `ApiClient` / `api-helper` |
| `tests/security/vapt/vapt-security-assessment.spec.ts` | references `API_BASE_URL` |

```text
NOT_DEPENDENT_ON_REMOTE_API : the UI-only suites
  (tests/ui/**, tests/smoke/**) — these depend on BASE_URL, not API_BASE_URL.
```

The remote API endpoint will not be guessed, invented, or derived. No application API source was modified.

> **Update 2026-10-07 — full API dependency analysis:** see `Automation/Documents/POS_API_DEPENDENCY_ANALYSIS.md`. Under the existing-API-usage policy, the 11 files above are reclassified **`BLOCKED — VERIFIED POS API BASE URL REQUIRED`** (not merely "ready once provided"), since no verified remote POS API URL exists. In addition, **11 UI specs are `UI_WITH_API_DEPENDENCY`** (API used for test-data setup/cleanup/verification via the lazy `apiClient`/`cleanup` fixtures and `masters`/`masters4` fixtures) — their UI logic is sound but their API-backed path is likewise blocked. The remaining **63 files are `UI_ONLY`/`NO_API_DEPENDENCY`** (depend on `BASE_URL` only) and are blocked solely by the UI credential issue, not by the API gap. No tests were converted, removed, or disabled.

---

## Source-Code Safety Verification

```text
POS Frontend Modified     : NO
POS Backend/API Modified  : NO
POS Database Modified     : NO
Automation Project Modified: YES  (automation/.env BASE_URL; this report; see note)
```

Verified via `git status --short` / `git diff` at repo root `D:\All type Test\SSL_POS_Api\SSL_POS`:

- The **only** change inside the application tree is a **pre-existing, uncommitted** 1-line working-tree edit to `ShampanPOSUI/Areas/DMS/js/Controllers/SaleOrderController.js`. This predates this session (the file was last committed 2026-07-29) and was **NOT** made by this automation work. It is flagged here for transparency, not modified.
- All changes from this phase are confined to the (git-untracked) `automation/` folder: `automation/.env` (`BASE_URL` set in a prior step) and this report. `.env` is git-ignored by design.
- No controllers, services, repositories, models, viewmodels, DTOs, Razor views, application JS/TS, SQL objects, stored procedures, migrations, or server config were touched.

---

## Conclusion / Next action

- **UI automation infrastructure is sound**: config wiring, TypeScript, login page, selectors, and the login→branch→dashboard flow are all correct and reusable.
- **Authentication is blocked by environment configuration only**: valid credentials for `http://103.231.239.122:8006/` (plus `dbName`/company if required) are needed in `automation/.env`. Once supplied, re-run `npm run test:setup`; the same flow should then reach the dashboard and persist `storage/auth.json`, unblocking the authenticated smoke test.
- **API automation is blocked** pending the remote `API_BASE_URL`.

Stopping here per the phase STOP condition — no mass validation implementation, no Page Object rework, and no API automation started.

---

## DMS Cross-Project Contamination Audit

Added 2026-10-07. Full detail: `Automation/Documents/POS_DMS_CONTAMINATION_AUDIT.md`.

**Policy-aligned verdict (corrected 2026-10-07):** every DMS reference is tracked as an **OPEN issue** per the authoritative policy — `DMS FOUND = OPEN ISSUE`, `DMS FIX NOW = NO`, `CURRENT ACTION = USE AS-IS`, `ISSUE STATUS = OPEN — WAITING FOR APPLICATION DEVELOPER`. Runtime functionality does **not** cancel this classification.

**Verified runtime observations (preserved, unchanged):** `/DMS/...` routes are functional and belong to the currently deployed POS app — `/DMS/TableSection/Index`, `/DMS/Product/Index`, `/DMS/Customer/Index` return **302 → the POS login page** with a POS `ReturnUrl`, while `/DMS/NonExistentXyz/Index` returns **404** (real controller resolution). The app's own source tree is `ShampanPOSUI/Areas/DMS/...`; `package.json` names the app "Shampan POS/DMS". **No foreign DMS API / base URL / host / dataset exists** — every reference is a relative route against the POS `BASE_URL`. These facts justify `USE AS-IS`; they do not close the issue.

```text
Total DMS References Found:      ~220 genuine DMS-area references (368 raw, minus ~25+ `thresholdMs` camelCase false positives)
Classification:                  DMS_ROUTE_REFERENCE / DMS_APPLICATION_REFERENCE (POS app's own MVC Area)
  DMS Route References:          138 literal `/DMS/...` + 81 `routes.dms()` helper (all relative, resolve against POS BASE_URL)
  DMS API References:            0  (no foreign DMS API/base URL anywhere)
  DMS Config References:         0  (none in .env/.env.example/playwright.config.ts/tsconfig; package.json description "POS/DMS" is accurate)
  DMS Test References:           page objects + specs navigating POS DMS-area screens
  DMS Test-Data References:      0  (DB/TestData datasets hold field inputs only — no DMS routes)
  DMS Documentation References:  74 `Areas/DMS/...` source-path citations (accurate, informational)

Runtime Status:                  FUNCTIONAL
Issue Status:                    OPEN — WAITING FOR APPLICATION DEVELOPER
Current Automation Action:       USE AS-IS
Remediation:                     DO NOT FIX NOW
DMS Issues Fixed / Routes Changed / References Renamed: 0 / 0 / 0
```

**DMS used as a POS dependency on a *foreign* project: NO** (every reference is a relative route against the POS `BASE_URL`). **DMS as an OPEN issue awaiting the application developer: YES** — do not rename, replace, remove, or refactor any `/DMS/...` route or code now; re-analyze and update Automation only after the developer changes the application. See `POS_DMS_CONTAMINATION_AUDIT.md` §0 for the same policy-aligned status.

Verification (documentation-only correction, 2026-10-07): `npx tsc --noEmit` → exit 0; `npx playwright test --list` → 384 tests / 89 files (unchanged by this edit). No source code modified.

---

## Authentication Re-Verification — 2026-10-07 (Phase 8 pre-flight)

Re-ran the **existing** auth workflow (`playwright test --project=setup` → `fixtures/auth.setup.ts` → `LoginPage` + `BranchSelectPage` + `DashboardPage`). No second login workflow was created. Historical findings above are unchanged; this is an additive, dated re-check.

| Item | Result |
|---|---|
| Target UI | `http://103.231.239.122:8006/` — reachable; `/` and `/Login/Index` → 200, "Login - Shampan POS" |
| Credential status | `ADMIN_USERNAME` = `erp` (configured); `ADMIN_PASSWORD` configured (not printed); `dbName`/`DB_NAME` not configured (login's hidden `dbName` is empty, server-resolved) |
| Login result | **INVALID_CREDENTIAL** |
| Evidence | Playwright run ended on the login page with flash **"Wrong user name or password!"** (never reached `/Common/Home`). Independent direct POST: **HTTP 302 → `/`, no `.ASPXAUTH` cookie granted**. Two methods agree. |
| Company selection | **BLOCKED** — not reached (login fails first) |
| Branch selection | **BLOCKED** — not reached |
| CompanyId | **NOT VERIFIED** (blocked) |
| BranchId | **NOT VERIFIED** (blocked) |
| Storage state | **NOT REFRESHED** — `storage/auth.json` remains stale (2026-08-27) and unusable against this environment |
| Authenticated smoke | **BLOCKED** (no session) |
| Customer route | `/DMS/Customer/Index` (via `routes.dms('Customer')`) — Runtime FUNCTIONAL (verified earlier: 302→POS login), Issue OPEN — WAITING FOR APPLICATION DEVELOPER, Action USE AS-IS. Not reachable authenticated this run. |
| Remaining blocker | **AUTH_BLOCKER REMAINS** — valid credentials for this environment required (and a `dbName`/company value if this deployment is multi-tenant). No credentials guessed; app unchanged. |

Discovery unchanged: `tsc --noEmit` exit 0; `playwright test --list` → 384 tests / 89 files (no tests added this pre-flight). Full scope detail: `POS_AUTH_COMPANY_BRANCH_SCOPE_REPORT.md`.

### Authentication Re-Verification #2 — 2026-10-07 (after credential update)

The user updated credentials in `automation/.env`; re-ran the **existing** auth flow (`--project=setup`). Prior INVALID_CREDENTIAL evidence above is retained; this is an additive entry.

| Item | Result |
|---|---|
| Credential status | `ADMIN_USERNAME` = `erp` (configured); `ADMIN_PASSWORD` configured and **updated** (not printed); `dbName`/`DB_NAME` still not configured |
| Login result | **INVALID_CREDENTIAL (still)** |
| Evidence | Playwright: ended on login page with **"Wrong user name or password!"**, URL stayed `http://103.231.239.122:8006/`, `/Common/Home` not reached. Direct POST: **HTTP 302 → `/`, no `.ASPXAUTH`**. Two methods agree. |
| Company / Branch / CompanyId / BranchId | **BLOCKED / NOT VERIFIED** (downstream of login) |
| Storage state | **NOT REFRESHED** (`storage/auth.json` still stale) |
| Authenticated smoke / Customer page | **BLOCKED** |
| Remaining blocker | **AUTH_BLOCKER REMAINS** — the updated password is also rejected. Possible causes (not guessed, to confirm with the environment owner): wrong password still, username form differs (e.g. email), or this deployment requires a specific `dbName`/company (login's hidden `dbName` is empty). No credentials/`dbName` guessed; app unchanged. |

Discovery unchanged: `tsc --noEmit` exit 0; `playwright test --list` → 384 / 89.

### Authentication Re-Verification #3 — 2026-10-07 (new SQA credential)

Environment owner supplied a new account; `.env` updated (`ADMIN_USERNAME=sqa@gmail.com`, password configured — never printed). Re-ran the existing auth flow. Prior `erp` INVALID_CREDENTIAL evidence (#1/#2) retained.

| Item | Result |
|---|---|
| Credential status | `ADMIN_USERNAME` = `sqa@gmail.com` (configured); `ADMIN_PASSWORD` configured (redacted); `dbName` not configured |
| Login result | **INVALID_CREDENTIAL (SQA account also rejected)** |
| Evidence | Playwright `--project=setup`: ended on login page with **"Wrong user name or password!"**, URL stayed `http://103.231.239.122:8006/`, `/Common/Home` not reached. Direct POST: **HTTP 302 → `/`, no `.ASPXAUTH`**. Two methods agree. |
| .ASPXAUTH / Dashboard / Storage | ABSENT / BLOCKED / NOT REFRESHED |
| Company / Branch / CompanyId / BranchId | BLOCKED / NOT VERIFIED (downstream of login) |
| Automation login contract | **CORRECT** (unchanged — posts exactly what the live form posts) |
| Next owner | **ENVIRONMENT / APPLICATION AUTH TEAM** — manually verify `sqa@gmail.com` in a browser on the target and check server-side Identity/profile/API config. No variations retried; no password printed. |

Discovery unchanged: `tsc` exit 0; `playwright test --list` → 384 / 89.
