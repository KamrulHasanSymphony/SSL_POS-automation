# POS — Authentication + Company/Branch Scope Re-Verification Report

**Project:** Shampan POS · **Target UI:** http://103.231.239.122:8006/ · **Date:** 2026-10-07
**Task:** Phase 8 pre-flight (NOT Phase 8 implementation). UI authentication + company/branch scope only.
**Scope:** Automation project only. Application source & DB schema STRICTLY READ-ONLY / UNCHANGED.

## Objective

Determine whether POS UI authentication now succeeds and whether an authenticated **CompanyId** / **BranchId** can be established, so Customer validation (Phase 8) — especially DB-backed `inputSource` cases (`CUS-GRP-002`, `CUS-DUP-001`) — can be scoped safely. No credentials/IDs guessed; no app or DB change.

## Environment

```text
Target UI:        http://103.231.239.122:8006/  (reachable; / and /Login/Index -> 200, "Login - Shampan POS")
ADMIN_USERNAME:   configured (erp)
ADMIN_PASSWORD:   configured (not printed)
dbName / DB_NAME: NOT configured (login hidden dbName is empty, server-resolved)
Auth workflow:    existing — fixtures/auth.setup.ts -> LoginPage + BranchSelectPage + DashboardPage (reused; no new workflow)
```

## Authentication Result

**INVALID_CREDENTIAL.** Two independent methods agree:

- **Playwright `--project=setup`:** ended on the login page with the app flash **"Wrong user name or password!"**; URL stayed at `http://103.231.239.122:8006/` (23× unexpected value); `/Common/Home` never reached. Artifacts: `test-results/fixtures-auth.setup.ts-authenticate-setup/` (screenshot/video/error-context).
- **Direct form POST** (creds read from `.env`, password never printed): **HTTP 302 → `/`**, **no `.ASPXAUTH` cookie** granted.

Auth cookie/session: **ABSENT**. Not a navigation-timeout guess — the server's own rejection message + the missing session cookie are the evidence.

## Company Selection Result

**BLOCKED** — not reached (login fails before any company step). This deployment may also be multi-tenant (empty hidden `dbName`), which could itself contribute to the rejection; unconfirmed, not guessed.

## Branch Selection Result

**BLOCKED** — not reached. `BranchSelectPage.resolveIfPresent()` (which uses `dblclick()` on a branch row for the multi-branch case) could not run without a valid session.

## CompanyId Evidence

**NOT VERIFIED (BLOCKED).** No authenticated context exists, so no claim/hidden field/session value/request payload is available. Fake-provider IDs (companyId=1, branchId=1) are **TEST-ONLY** and must never be used as live scope.

## BranchId Evidence

**NOT VERIFIED (BLOCKED).** Same reason.

## Storage State

**NOT REFRESHED.** `automation/storage/auth.json` remains stale (2026-08-27) and unusable against this environment. No cookie/token values printed. `.gitignore` keeps `storage/*.json` uncommitted.

## Customer Page Verification

**BLOCKED** (no authenticated session). Route (unchanged): `/DMS/Customer/Index` via `routes.dms('Customer')`.

## Customer DB Scope Readiness

```text
Company/Branch names verified: NO
Numeric/internal IDs verified: NO
Customer DB live query scope:  BLOCKED
```

DB-backed Customer cases (`CUS-GRP-002`, `CUS-DUP-001`) stay **BLOCKED_DB** (the Phase 7 runner already returns this status, not FAIL).

## DB Config Readiness

```text
DB_SERVER configured:   NO
DB_DATABASE configured: NO
DB_USERNAME configured: NO
DB_PASSWORD configured: NO
DB_PORT configured:     NO
DB_READONLY=true:       NO
```

No DB_* keys exist in `automation/.env`. SQL driver (`mssql`): **NOT installed** (not installed in this task, by instruction). No DB connection attempted.

## API Status

**BLOCKED — VERIFIED POS API BASE URL REQUIRED** (unchanged; out of scope for this pre-flight; not guessed/derived).

## DMS Status

```text
DMS FOUND = OPEN ISSUE · DMS FIX NOW = NO · CURRENT ACTION = USE AS-IS
Customer route /DMS/Customer/Index -> Runtime FUNCTIONAL, Issue OPEN — WAITING FOR APPLICATION DEVELOPER
DMS Issues Fixed: 0 · Routes Changed: 0 · References Renamed: 0
```

## Blockers (verified)

1. **AUTH_BLOCKER — REMAINS**: `erp` + configured password rejected (302→/, no `.ASPXAUTH`, "Wrong user name or password!"). Needs valid credentials for this environment (and possibly a `dbName`/company value).
2. **CompanyId/BranchId — BLOCKED**: unobtainable until auth succeeds.
3. **Live Customer DB — BLOCKED**: no read-only DB config + no verified company/branch scope.
4. **Remote POS API — BLOCKED**: no verified URL.

## Source Safety

```text
POS Frontend Modified By This Task:    NO
POS Backend/API Modified By This Task: NO
POS Database Modified By This Task:    NO
Automation Modified:                   YES (documentation only: this report + baseline-report section + plan status; no code/tests/behaviour changed)
Pre-existing SaleOrderController change preserved: YES (still 1 line, untouched)
```

## Recommendation

- **Phase 8 is NOT ready** to begin live execution: authentication fails, so even non-DB P0 Customer cases cannot run against the UI. The framework itself (Phases 6–7) is ready and verified.
- **To unblock:** supply valid credentials for `http://103.231.239.122:8006/` (and a `dbName`/company identifier if multi-tenant) in `.env`, then re-run `npm run test:setup`. On success, capture CompanyId/BranchId from authenticated runtime evidence (hidden fields / request payloads / branch-company dropdowns) — never guessed.
- **For DB-backed Customer cases**, additionally supply a verified **read-only** DB credential (`DB_READONLY=true`) and wire the concrete SQL-Server provider in a later explicitly-authorized task (install `mssql` then, not now).
- Until credentials land, Phase 8 can at most be **PARTIALLY READY** (JSON/generator cases runnable once auth works; DB `inputSource` cases remain `BLOCKED_DB`).

---

## Re-Verification #2 — 2026-10-07 (after credential update)

Credentials were updated in `automation/.env`; the existing auth flow was re-run. **Result unchanged: INVALID_CREDENTIAL.**

- **Evidence:** Playwright `--project=setup` ended on the login page with **"Wrong user name or password!"** (URL stayed `http://103.231.239.122:8006/`, `/Common/Home` never reached). Direct POST: **HTTP 302 → `/`, no `.ASPXAUTH` cookie**. `ADMIN_USERNAME` = `erp`; `ADMIN_PASSWORD` updated (not printed).
- **Company / Branch / CompanyId / BranchId:** still BLOCKED / NOT VERIFIED (downstream of login). Fake-provider IDs remain test-only.
- **DB config:** still absent (`DB_SERVER/DB_DATABASE/DB_USERNAME/DB_PASSWORD/DB_READONLY` unset); `mssql` not installed; no connection attempted.
- **Phase 8 Ready = NO.** The updated password is also rejected. To unblock, confirm with the environment owner: the exact valid username form, the correct password, and whether a specific `dbName`/company is required (the login's hidden `dbName` is empty). No values guessed; no app/DB change. Discovery unchanged 384/89; `tsc` exit 0.

---

## Re-Verification #3 — 2026-10-07 (new SQA credential)

A new account `sqa@gmail.com` was provided and set in `.env` (password redacted). Existing auth flow re-run. **Result unchanged: INVALID_CREDENTIAL.**

- **Evidence:** Playwright `--project=setup` ended on the login page with **"Wrong user name or password!"** (`/Common/Home` not reached). Direct POST: **HTTP 302 → `/`, no `.ASPXAUTH`**.
- **Company / Branch / CompanyId / BranchId:** still BLOCKED / NOT VERIFIED (login fails first). DB config still absent; `mssql` not installed; no DB connection attempted.
- **Phase 8 Ready = NO.** Both `erp` and `sqa@gmail.com` are rejected and the automation login contract is proven CORRECT — so this is an environment/application-side account or server config matter. **Next owner: ENVIRONMENT / APPLICATION AUTH TEAM** (verify `sqa@gmail.com` in a browser on the target; check Identity account / profile mapping / MVC→API config). No variations retried; no secrets printed; app/DB unchanged.
