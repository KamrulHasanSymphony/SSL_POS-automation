# POS Automation — Master Test Plan

> **Single source of truth for POS Automation progress.** Every future phase reads this file first, continues from the recorded phase, then updates this same file. Do **not** create another master test plan. Actual code / tests / runtime evidence remain the source of truth for PASS/FAIL and coverage.

**Project:** Shampan POS · **Target UI:** http://103.231.239.122:8006/ · **Automation:** `SSL_POS/automation` (Playwright + TypeScript, Page Object Model + data-driven)
**Last updated:** 2026-10-07

---

## 1. Project Objective

Deliver complete, truthful Playwright + TypeScript automation for Shampan POS by: measuring and preserving existing working automation; identifying every form/field; adding field-level validations (positive, negative, boundary) and business-rule checks; building a centralized data-driven architecture backed by `automation/DB/TestData/`; reusing the existing POM/fixtures/helpers; using existing application APIs as-is where legitimately depended upon; keeping DMS references as open issues (use-as-is, do-not-fix-now); and finishing with a full regression and handover report — **without ever modifying POS application source code.**

## 2. Baselines

### 2a. ORIGINAL verified baseline (Phase 0 — historical record, do NOT change)

```text
Target UI:                       http://103.231.239.122:8006/
TypeScript (tsc --noEmit):       PASS
Playwright discovery:            343 tests in 86 files   <-- original business-suite baseline
UI_ONLY / NO_API_DEPENDENCY:     63 spec files
API_ONLY:                        11 spec files
UI_WITH_API_DEPENDENCY:          11 spec files
Authentication:                  BLOCKED — INVALID_CREDENTIAL
Verified remote POS API_BASE_URL: NOT AVAILABLE
```

Tag distribution (original suite): `@p0` 111 · `@p1` 147 · `@p2` 61 · `@p3` 1 · `@smoke` 34 · `@sanity` 2 · `@regression` 310 · `@negative` 88 · `@security` 29 · `@known-defect` 21.

### 2b. CURRENT state (updated each phase)

```text
TypeScript (tsc --noEmit):       PASS
Playwright discovery:            384 tests in 89 files   <-- current (as of Phase 7)
  = 343/86 original business suite (0 removed)
  + 11 Phase 6 loader/data-framework proof tests (tests/framework/_test-data-loader.spec.ts)
  +  9 Customer DB-provider proof tests        (tests/framework/_customer-db-provider.spec.ts)
  + 21 Phase 7 validation-framework proof tests (tests/framework/_validation-framework.spec.ts)
Existing business tests removed: 0
Authentication:                  BLOCKED — INVALID_CREDENTIAL
Verified remote POS API_BASE_URL: NOT AVAILABLE
Live Customer DB:                BLOCKED — VERIFIED CONNECTION + COMPANY/BRANCH REQUIRED
```

> `original baseline = 343 / 86` (never rewritten) · `current baseline = 384 / 89` (framework proof tests only; 0 business tests removed). Counts are re-verified at the end of each phase against `playwright test --list`.

## 3. Scope

- Measure existing automation coverage; preserve all working tests.
- Field inventory + validation gap analysis for every POS form (done this phase).
- Add missing field validations: Required/Empty/Whitespace/Length/Boundary/Format/Numeric/Special-char/Unicode-Bangla/Duplicate/Conditional/Business-rule, plus Save/Update.
- Centralized data-driven architecture under `automation/DB/TestData/`.
- Use existing application APIs as-is for setup/cleanup/verification where already depended upon.
- Full regression + final coverage/handover report.

## 4. Out of Scope

- Any change to POS application source (frontend, backend/API, DB, controllers, services, repos, models/VMs/DTOs, Razor, app JS/TS, SQL, migrations, business logic, production config).
- Guessing credentials, `dbName`, or a remote API URL.
- Renaming/replacing/removing DMS routes or endpoints.
- Creating `automation/DB/TestData/` or the validation framework **before** the authorizing phase.
- Fixing confirmed application defects (document them instead).

## 5. Source-Code Safety Rules

```text
POS Application Source:   STRICTLY READ-ONLY
Automation Project:       ONLY ALLOWED WORKING AREA
```

Do NOT modify: Frontend · Backend/API · Database project · Controllers · Services · Repositories · Models · ViewModels · DTOs · Razor Views · application JavaScript · application TypeScript · SQL · migrations · business logic · production configuration.

**Preserve the pre-existing modification** `ShampanPOSUI/Areas/DMS/js/Controllers/SaleOrderController.js` (uncommitted, dated 2026-07-29, not made by this automation work) — do **not** modify or revert it. Never use destructive git reset/checkout that would touch it.

## 6. DMS Issue Policy

```text
DMS FOUND  = OPEN ISSUE
DMS FIX NOW = NO
```

`/DMS/...` are verified to be a functional **MVC Area of the Shampan POS app** (runtime: real `/DMS/<ctrl>/Index` → 302 POS login; fake → 404). Keep using them as-is. Record as `DMS_ROUTE_REFERENCE`, Runtime `FUNCTIONAL`, Issue `OPEN — WAITING FOR APPLICATION DEVELOPER`, Action `USE AS-IS`, Future `RE-ANALYZE AFTER DEVELOPER CHANGE`. `DMS_API_REFERENCE`: none found. (The app also carries its own `DMSApiUrl` Settings row — app data, not automation.) See `POS_DMS_CONTAMINATION_AUDIT.md`.

## 7. Existing API Usage Policy

Existing application APIs **may be used as-is** for API testing, UI+API integration, test-data setup/verification/cleanup, auth support, prerequisites, backend-rule checks, E2E. Using an API ≠ modifying source. API **source** must not be modified. A remote POS API URL is used only if verified (config/docs/traffic) — never guessed or derived from the UI port. Until then, direct-API work is `BLOCKED — VERIFIED POS API BASE URL REQUIRED`. See `POS_API_DEPENDENCY_ANALYSIS.md`.

## 8. Automation Architecture

- **POM:** `pages/**` (≈45 page objects) over `pages/common/BasePage.ts`; selectors/messages centralized in `utils/constants.ts`.
- **Config:** `playwright.config.ts` → `BASE_URL` from `.env` (via `utils/env.ts`); projects `framework` / `unauthenticated` / `setup` / `authenticated`.
- **Auth:** UI login (`pages/auth/LoginPage.ts`) composed by `fixtures/auth.setup.ts` (persists `storage/auth.json`) and `fixtures/auth.fixture.ts` (per-worker session); branch step via `BranchSelectPage.resolveIfPresent()`.
- **Fixtures:** `base.fixture.ts` (lazy `apiClient` + `cleanup`) → `auth.fixture.ts` → `masters*.fixture.ts` (API prerequisite data) and lifecycle fixtures.
- **Data:** `utils/random-data.ts` (unique values), `utils/test-data-setup.ts`/`test-data-cleanup.ts` (API), expected messages in `constants.ts`.
- **Reporting:** HTML + list + Allure.
- **Rule:** reuse existing fixtures/helpers/POM; never duplicate infrastructure.

## 9. Module Coverage Baseline

~45 modules under test across: **Masters/DMS** (Product, Customer, Supplier, the *Group lookups, UOM, BusinessType, PaymentType, TableSection/Info, IncomeExpenseCategory, OverHead, MasterSupplier/Item/SupplierItem, SupplierProduct, MasterItem/SupplierProduct, Area, FiscalYear, BranchProfile/Create, CustomerAdvance, Income, Expense), **Transactions** (Purchase/Order/Return, Sale/Order/Return), **Banking** (BankInformation, BankAccount, Deposit, Withdrawal, Collection, Payment), **SetUp** (CompanyProfile/Create, Role, RoleMenu, UserProfile, UserBranchProfile, Registration, SignUp, Settings), **Auth** (Login/Logout/BranchSelect). Per-folder tests: masters 137 · banking 31 · setup 29 · purchase 20 · sales 19 · ui-e2e 20 · auth 15 · api 13 · api-e2e 37 · vapt 14 · security 3 · navigation 1 · smoke 3. Full field inventory: `POS_FIELD_VALIDATION_INVENTORY_AND_GAP_ANALYSIS.md`.

## 10. Field Validation Strategy

For each field: derive obligations from the app's confirmed `*ValidationMessages` + control type; assert the exact message where one exists, else a stable "becomes-visible/blocked" signal; never assert unstable decorative text; drive inputs from datasets (Phase 6+). Positive (valid save/update) + negative (each invalid class) + boundary.

## 11. Validation Types (applied where relevant per field)

Required · Empty · Whitespace-only · Leading/Trailing whitespace · Min Length · Max Length · Below Min · Above Max · Valid/Invalid Format · Numeric · Integer · Decimal · Zero · Negative · Positive · Min/Max · Boundary · Special Characters · Unicode/Bangla · Duplicate · Email · Phone/Mobile · Date · Invalid/Past/Future Date · Dropdown · Searchable Combobox (never `selectOption()` unless native `<select>`) · Checkbox · Radio · Conditional Required · Dependent Field · Business Rule · Save · Update.

**Measured current coverage:** strong on Required/Empty/Invalid-Format/Duplicate; **near-zero on Length/Boundary/Whitespace/Special-char/Unicode-Bangla/numeric-boundary** (the primary gap — see inventory report §A/§C).

## 12. Data-Driven Testing Strategy

Current state (corrected 2026-10-07 — this was previously marked "NOT yet created", now stale):

```text
automation/DB/TestData/:        CREATED in Phase 6
Typed dataset contract:         CREATED (utils/validation-dataset.ts)
Loader / resolvers:             CREATED (utils/test-data-loader.ts; data-providers/input-source-resolver.ts)
Initial datasets:               CREATED (8 files / 85+ cases under DB/TestData/{Masters,Banking,Setup})
Reusable validation framework:  CREATED in Phase 7 (automation/validation/*)
Business-spec migration:        NOT STARTED
```

Design (unchanged): `automation/DB/TestData/<area>/<module>.validation.json` rows `{ field, caseType, input, expectedResult, expectedMessageKey }`, with `expectedMessageKey` referencing existing `constants.ts` messages so messages stay single-sourced; the Phase 7 runner iterates rows against existing Page Objects (no POM rewrite). Keep `uniqueCode` dynamic; never hard-code seed/business data. `automation/DB/Schemas/` + `README.md` are an automation-test-data repository only (never the app DB).

### 12.1 Customer Data Strategy (DB-driven for existing/reference data)

```text
Customer Data Strategy:              DATABASE-DRIVEN FOR EXISTING/REFERENCE DATA
Customer Validation Scenario Strategy: JSON DATASET
Customer DB Writes:                  NOT ALLOWED
Customer DB Reads:                   ALLOWED — VERIFIED READ-ONLY CONNECTION ONLY
```

- **What to test** = `DB/TestData/Masters/customer.validation.json` (validation scenarios/invalid inputs only — never existing production IDs/names).
- **Which real Customer / CustomerGroup to use** = POS database, via the read-only provider layer in `data-providers/` (`customer-db-provider.ts`, `db-safety.ts`, `input-source-resolver.ts`). Datasets name a provider+method through a typed allow-list (`inputSource`), never raw SQL.
- **How to interact** = existing Customer Page Object. **How to assert** = validation framework (Phase 7). **DB write** = never from the provider; CREATE goes through UI (or verified POS API).
- **Verified schema (read-only inspection, SQL Server):** `Customers` (Id, Code, Name, BanglaName, CustomerGroupId, CompanyId, BranchId, Address, TelephoneNo, Email, Comments, IsArchive, IsActive, …); `CustomerGroups` (Id, Name, CompanyId, BranchId, IsArchive, IsActive). Active = `IsActive=1 AND IsArchive=0`; **every query scoped by CompanyId + BranchId**.
- **Guards:** `assertReadOnlySql()` (SELECT/CTE only; rejects INSERT/UPDATE/DELETE/MERGE/DROP/ALTER/CREATE/TRUNCATE/EXEC/stacking) + `assertDbConfigReady()` (refuses unless `DB_SERVER/DB_DATABASE/DB_USERNAME/DB_PASSWORD` set and `DB_READONLY=true`; never logs the password). Credentials live in `.env` only.
- **Status: live DB BLOCKED** — no read-only DB config in `.env`, no SQL driver installed, and company/branch scope needs verified auth. Interface + typing + guards + fake-provider unit test delivered (9 framework tests pass). See `POS_CUSTOMER_DB_PROVIDER_REPORT.md`.

## 13. API Dependency Strategy

63 UI_ONLY specs need `BASE_URL` only. 11 API_ONLY + 11 UI_WITH_API_DEPENDENCY need a verified POS API URL. Use APIs as-is for setup/cleanup/verification; keep hybrids hybrid; do not convert API tests to UI or strip API deps. All direct-API work stays `BLOCKED — VERIFIED POS API BASE URL REQUIRED` until a URL is verified.

## 14. Authentication Strategy

UI login via existing POM/fixtures (`storage/auth.json` + per-worker session). Credentials from `.env` only, never printed. Currently `BLOCKED — INVALID_CREDENTIAL` on the remote env; needs valid credentials (and possibly `dbName`). Re-run `npm run test:setup` once supplied. Do not guess.

## 15. Test Execution Strategy

Non-destructive first (smoke/auth/read-only). Grep scripts by tag (`test:smoke/sanity/regression/negative/p0..p3`) and project (`framework/unauthenticated/setup/authenticated`). Parallel per-worker auth. Allure for evidence. No mass destructive transaction runs during analysis phases. Truthful PASS/FAIL/BLOCKED only.

## 16. Defect Classification

```text
APPLICATION_DEFECT · AUTOMATION_DEFECT · ENVIRONMENT_BLOCKER · AUTH_BLOCKER · API_BLOCKER · DMS_OPEN_ISSUE · TEST_DATA_ISSUE
```

## 17. Phase-by-Phase Roadmap

```text
Phase 0  — Existing Baseline ...................... COMPLETED
Phase 1  — Authentication Assessment .............. COMPLETED (BLOCKED outcome: invalid credentials)
Phase 2  — DMS Issue Audit ........................ COMPLETED (OPEN issue, use-as-is)
Phase 3  — API Dependency Analysis ................ COMPLETED
Phase 4  — Field Validation Inventory ............. COMPLETED (this phase)
Phase 5  — Validation Gap Analysis ................ COMPLETED (this phase)
Phase 6  — Data-Driven Architecture (DB/TestData) . COMPLETED (2026-10-07)
Phase 7  — Reusable Validation Framework .......... COMPLETED (2026-10-07)
Phase 8  — P0 Validation Implementation ........... NOT STARTED (needs auth unblocked)
Phase 9  — P1 Validation Implementation ........... NOT STARTED
Phase 10 — P2 Validation Implementation ........... NOT STARTED
Phase 11 — P3 / Edge Cases ........................ NOT STARTED
Phase 12 — API Validation ......................... BLOCKED (needs verified POS API URL)
Phase 13 — Full Regression ........................ NOT STARTED (needs auth + API)
Phase 14 — Final Coverage Audit ................... NOT STARTED
Phase 15 — Final Handover ......................... NOT STARTED
```

---

## Execution Tracker

| Phase | Objective | Status | Evidence/Report | Blocker | Next Action |
|---|---|---|---|---|---|
| 0 | Existing baseline | COMPLETED | this plan §2 | — | — |
| 1 | Authentication assessment | COMPLETED | `POS_AUTHENTICATION_BASELINE_REPORT.md` | AUTH_BLOCKER | Supply valid credentials; re-run `test:setup` |
| 2 | DMS issue audit | COMPLETED | `POS_DMS_CONTAMINATION_AUDIT.md` | DMS_OPEN_ISSUE | Re-analyze after developer change |
| 3 | API dependency analysis | COMPLETED | `POS_API_DEPENDENCY_ANALYSIS.md` | API_BLOCKER | Supply verified POS API URL |
| 4 | Field validation inventory | COMPLETED | `POS_FIELD_VALIDATION_INVENTORY_AND_GAP_ANALYSIS.md` §B | — | — |
| 5 | Validation gap analysis | COMPLETED | same report §A/§C | — | — |
| 6 | Data-driven architecture | COMPLETED | `POS_DATA_DRIVEN_ARCHITECTURE_REPORT.md` | — | Datasets + typed loader + proof test done (11/11 pass). Spec migration deferred to validation phases |
| 7 | Reusable validation framework | COMPLETED | `POS_VALIDATION_FRAMEWORK_REPORT.md` | — | Runner + adapter contract + assertions + filters + diagnostics + fake adapter done; 41/41 framework tests pass. Live module adapters/specs = Phase 8 |
| 8–11 | P0→P3 validation implementation | NOT STARTED | — | AUTH_BLOCKER | After auth unblocked + framework |
| 12 | API validation | BLOCKED | `POS_API_DEPENDENCY_ANALYSIS.md` | API_BLOCKER | Verified POS API URL |
| 13 | Full regression | NOT STARTED | — | AUTH_BLOCKER + API_BLOCKER | After implementation |
| 14 | Final coverage audit | NOT STARTED | — | — | After regression |
| 15 | Final handover | NOT STARTED | — | — | Final |

**Current phase:** 7 → **COMPLETED** (2026-10-07). Reusable validation framework built under `automation/validation/` (DB-agnostic runner, typed adapter contract, assertion modes, filters, diagnostics with secret redaction, fake adapter) + a framework-only proof spec (21 tests). All framework proof tests pass: **41/41** (11 loader + 9 DB + 21 framework). No business specs migrated (by design). Discovery 363/88 → **384/89** (+21 proof tests only; 0 business tests removed). Customer DB-provider framework = READY; live Customer DB = BLOCKED (verified read-only credential + company/branch scope unavailable). **Next recommended phase:** Phase 8 (P0 Validation Implementation) — **requires explicit authorization** and the AUTH blocker cleared (live UI); DB `inputSource` cases also need the read-only DB credential + scope.

**Phase 8 pre-flight (2026-10-07) — auth + company/branch scope re-verification, re-runs #1–#3:** ran the existing auth workflow three times — initial (`erp`), after a password update (`erp`), and with a new SQA account (`sqa@gmail.com`). **All three results INVALID_CREDENTIAL** (302→/, no `.ASPXAUTH`, "Wrong user name or password!"), confirmed by Playwright + a direct POST. Since the automation login contract is proven CORRECT and two distinct accounts are rejected, the next owner is the **ENVIRONMENT / APPLICATION AUTH TEAM** (verify the account in a browser on the target; check Identity/profile/MVC→API config). **Phase 8A attempt (2026-10-07):** the mandatory auth precondition was re-run (SQA cred) before any Customer-validation implementation — result INVALID_CREDENTIAL again, so the HARD STOP fired: **no `CustomerValidationAdapter`, no Customer P0 spec, no POM change were created.** Phase 8 stays NOT STARTED. `AUTH_BLOCKER = REMAINS`; Company/Branch selection, `CompanyId`/`BranchId`, storage-state refresh, authenticated smoke, and Customer-page load all **BLOCKED** (downstream of login). DB config absent (`DB_SERVER/DB_DATABASE/DB_USERNAME/DB_PASSWORD/DB_READONLY` all unset); `mssql` not installed; no DB connection attempted. **Phase 8 Ready = NO** (even non-DB P0 Customer cases need a live session). No credentials/IDs guessed; no application source/DB changed; discovery unchanged 384/89. Evidence: `POS_AUTH_COMPANY_BRANCH_SCOPE_REPORT.md` + the dated section in `POS_AUTHENTICATION_BASELINE_REPORT.md`.

---

## Validation Implementation Tracker

Field count = input controls (combos counted as fields); "Existing" = validation classes currently asserted; "Missing" = gap classes to add (Length, Boundary, Whitespace, Special-char, Unicode/Bangla, numeric-boundary, conditional unless noted). Implementation status is NOT STARTED until Phase 8+.

| Module | Form | Fields | Existing Validation | Missing Validation | Priority | Implementation Status |
|---|---|---:|---:|---:|---|---|
| Customer | Create/Edit | 5 | Required, Email fmt, Group req | Length, Whitespace, Special-char, Unicode/Bangla, phone boundary, duplicate | P0 | NOT STARTED |
| Product | Create/Edit | 6 | Name req, combo req | Length, Whitespace, VAT/SD numeric-boundary (zero/neg/decimal), Unicode | P0 | NOT STARTED |
| Supplier | Create/Edit | 3 | Name req, Address req | Length, Whitespace, Special-char, Unicode, duplicate | P0 | NOT STARTED |
| UserProfile | Create | 7 | Phone fmt, Email fmt | ConfirmPassword match, password length/policy, Required, Unicode | P0 | NOT STARTED |
| Registration | Create | 7 | CompanyName req | Phone fmt (msg-less), ConfirmPassword match, Length, Email fmt | P1 | NOT STARTED |
| CompanyProfile/Create | Create | 7 | CompanyName req | Email fmt, Telephone fmt, FY date order, Length | P1 | NOT STARTED |
| CustomerAdvance | Create | 2 | Amount >0 | Boundary (min/zero/neg/decimal/large), combo req | P1 | NOT STARTED |
| BankInformation | Create/Edit | 2 | Name req, Telephone req | Telephone fmt/length, Length, Whitespace | P1 | NOT STARTED |
| BankAccount | Create/Edit | 4 | partial | Required, Length, Whitespace, combo req | P1 | NOT STARTED |
| Deposit / Withdrawal | Create | 5 | TransactionDate req | From≠To dependent, amount boundary, date (past/future) | P1 | NOT STARTED |
| Collection / Payment | Create | 4–5 | required (generic), API due-rule | amount boundary, date, dependent-detail | P1 | NOT STARTED (API-dep) |
| Flat lookups (ProductGroup, CustomerGroup, SupplierGroup, MasterItemGroup, MasterSupplierGroup, UOM, BusinessType, PaymentType, OverHead) | Create/Edit | 1 each | Name required | Length, Whitespace, Special-char, Unicode, duplicate (uniform dataset) | P1–P2 | NOT STARTED |
| TableSection / TableInfo | Create | 1–2 | generic required | Length, Whitespace, combo req | P2 | NOT STARTED |
| IncomeExpenseCategory | Modal | 2 | Name/Type req | Length, Whitespace, Unicode | P2 | NOT STARTED |
| MasterSupplier / MasterItem / MasterSupplierItem / SupplierProduct | Create | 2–3 (+picker) | Name/Supplier req | Length, Whitespace, picker-required, Unicode | P2 | NOT STARTED |
| BranchProfile / BranchCreate | Create | 3 | Name req, Telephone req+fmt | Length, Whitespace, DistributorCode rules | P2 | NOT STARTED |
| FiscalYear | Create | 3 | none | date-range ordering, required-ish | P2 | NOT STARTED |
| Income / Expense | Create | 3 (+picker) | TransactionDate req | date (past/future), detail-required | P2 | NOT STARTED |
| Role / RoleMenu | Create | 1 / checkbox | Name req / ≥1 checkbox | Length, Whitespace, Unicode | P2 | NOT STARTED |
| SignUp / UserBranchProfile / Settings | Create/Edit | varies | partial / none | ConfirmPassword match, Length, select req | P3 | NOT STARTED |
| Purchase / PurchaseOrder / PurchaseReturn | Create | 4–6 (+grid) | Supplier/date req (partial) | grid line boundary (qty/price zero/neg/decimal), date, BE length | P2–P3 | NOT STARTED |
| Sale / SaleOrder / SaleReturn | Create | 3–4 (+grid) | Customer/date req (partial) | grid line boundary, payment-grid rules, date | P2–P3 | NOT STARTED |
| Area | Create | 1 | Name req | **BLOCKED (app defect: location cascade 404)** | P3 | BLOCKED |

## Data-Driven Migration Tracker (planning only — no migration yet)

`DATASET CREATED` ≠ `SPEC MIGRATION` — a dataset file existing does **not** mean any spec consumes it. Spec migration is deferred to the validation phases (8–11) and the runner (Phase 7).

| Module | Current Data Source | Target Dataset | Migration Status |
|---|---|---|---|
| Customer | inline literals + `randomData` | `DB/TestData/Masters/customer.validation.json` (validation scenarios) + **read-only DB** for existing Customer/CustomerGroup via `inputSource` | DATASET CREATED (incl. DB `inputSource` rows) · DB PROVIDER LAYER CREATED · LIVE DB BLOCKED · SPEC MIGRATION NOT STARTED |
| Product | inline literals + `randomData` | `DB/TestData/Masters/product.validation.json` | DATASET CREATED · SPEC MIGRATION NOT STARTED |
| Supplier | inline literals + `randomData` | `DB/TestData/Masters/supplier.validation.json` | DATASET CREATED · SPEC MIGRATION NOT STARTED |
| UserProfile | inline literals + `randomData.phone11Digit` | `DB/TestData/Setup/user-profile.validation.json` | DATASET CREATED · SPEC MIGRATION NOT STARTED |
| CompanyProfile/Create | inline literals | `DB/TestData/Setup/company-profile.validation.json` | DATASET CREATED · SPEC MIGRATION NOT STARTED |
| CustomerAdvance | inline numeric literals | `DB/TestData/Masters/customer-advance.validation.json` | DATASET CREATED · SPEC MIGRATION NOT STARTED |
| BankInformation | inline literals | `DB/TestData/Banking/bank-information.validation.json` | DATASET CREATED · SPEC MIGRATION NOT STARTED |
| Flat lookups (8 Name-based modules) | inline Name literals | `DB/TestData/Masters/lookup-common.validation.json` (shared) | DATASET CREATED · SPEC MIGRATION NOT STARTED |
| BankAccount | inline literals | `DB/TestData/Banking/bank-account.validation.json` | NOT STARTED (dataset not yet created) |
| Transaction headers | inline literals + grid helpers | `DB/TestData/Transactions/*.validation.json` | NOT STARTED (dataset not yet created) |
| Other ~30 modules | inline literals | per-module datasets | NOT STARTED (later phases) |
| Expected messages | `utils/constants.ts` (already centralized) | referenced by `expectedMessageKey` (keep single-sourced) | N/A (reuse as-is) |

## DMS Tracker

```text
DMS FOUND = OPEN ISSUE   ·   DMS FIX NOW = NO
```

| Issue/Area | Runtime Status | Issue Status | Current Automation Action | Future Action |
|---|---|---|---|---|
| `/DMS/...` routes (~220 refs via `routes.dms()` + literals; masters/txn/banking POM) | FUNCTIONAL | OPEN — WAITING FOR APPLICATION DEVELOPER | USE AS-IS | RE-ANALYZE AFTER DEVELOPER CHANGE |
| `DMS_API_REFERENCE` in automation API code | N/A (none found) | — | — | — |
| App `DMSApiUrl` Settings row (app data, surfaced by Settings page object) | FUNCTIONAL (app) | OPEN — WAITING FOR APPLICATION DEVELOPER | USE AS-IS (read/target row only) | RE-ANALYZE AFTER DEVELOPER CHANGE |

## Blocker Tracker

| Blocker | Impact | Status | Required To Unblock |
|---|---|---|---|
| Invalid POS UI credentials | 63 UI_ONLY specs + UI portion of 11 hybrids cannot run; Company/Branch scope + CompanyId/BranchId unobtainable (set only after successful login) | BLOCKED — REMAINS (re-verified 2026-10-07 ×2: INVALID_CREDENTIAL). **Root cause (source analysis):** `AUTH_CREDENTIAL_CONFIGURATION` — login is ASP.NET Identity `PasswordSignInAsync` against `AspNetUsers`; `erp`+password not accepted (user absent/wrong password/not-allowed/no company-branch mapping). `dbName` is NOT used in the credential path (empty is fine); **automation login contract = CORRECT** (no automation gap). See `POS_AUTH_SOURCE_ANALYSIS_REPORT.md`. | Obtain from environment owner: valid `AspNetUsers` UserName + Password (confirm whether it is `erp`), account active/allowed, a company/branch/profile mapping, and that the deployed MVC app can reach its configured auth API (`Web.config` appSettings `baseUrl`). Put in `.env`; re-run `npm run test:setup`; capture CompanyId/BranchId from authenticated claims/session. No `dbName`/company-select change needed. Env verification: `POS_AUTH_ENVIRONMENT_VERIFICATION_REPORT.md`. Confirmed: token step `api/Auth/login` does NOT check the password (gate is `PasswordSignInAsync` in `api/UserLogin/SignIn`); Identity confirmation/lockout flags not blocking (defaults). Username exists / password valid / profile mapping = NOT VERIFIED (no live DB). MVC internal auth API = NOT PROVEN reachable (server-to-server). Most likely `AUTH_CREDENTIAL_CONFIGURATION`; possible `PROFILE_MAPPING_CONFIGURATION` / `ENVIRONMENT_CONFIGURATION`. |
| Verified remote POS `API_BASE_URL` not available | 11 API_ONLY + API path of 11 hybrids blocked (incl. duplicate/due-amount) | BLOCKED | Verified remote POS API base URL in `.env` (never guessed/derived) |
| DMS routes pending developer | Tracked only; not execution-blocking (routes functional) | WAITING FOR DEVELOPER | Developer changes app; then re-analyze |
| Area location cascade (app defect) | Area create/length/boundary tests blocked | WAITING FOR DEVELOPER | App fixes `/Common/Common/GetAreaLocationList` |
| Read-only POS DB connection not configured | Customer (and future) DB-sourced reference data cannot be fetched; `inputSource` rows blocked | BLOCKED — CUSTOMER DB QUERY SCOPE REQUIRES VERIFIED COMPANY/BRANCH | Provide a verified **read-only** DB login (`DB_SERVER/DB_DATABASE/DB_USERNAME/DB_PASSWORD`, `DB_READONLY=true`) in `.env` + clear the auth blocker so company/branch scope is known; then wire the concrete SQL-Server provider |

---

## Source-Code Safety (cumulative — current truthful state)

```text
POS Frontend Modified:       NO
POS Backend/API Modified:    NO
POS Database Modified:       NO  (schema read-only inspected only; no SQL executed)
Automation Project Modified: YES

Reason (automation additions across phases):
  - Data-driven architecture (automation/DB/)
  - Validation datasets (DB/TestData/**/*.validation.json)
  - Typed dataset contract (utils/validation-dataset.ts)
  - Loader + resolvers (utils/test-data-loader.ts)
  - Customer DB provider interfaces (data-providers/customer-db-provider.ts)
  - DB safety layer (data-providers/db-safety.ts)
  - Input-source resolver (data-providers/input-source-resolver.ts)
  - Reusable validation framework (automation/validation/*)
  - Framework proof tests (tests/framework/_*.spec.ts)
  - Documentation (automation/Documents/*)
```

Verified via `git status`/`git diff`: only the untracked `automation/` folder (plus `.vscode/`) and the pre-existing, not-mine `SaleOrderController.js` change (preserved, untouched). No business spec/code/behaviour was changed or removed. Current verification: `tsc --noEmit` exit 0; `playwright test --list` 384 tests / 89 files (original 343/86 intact + framework proof tests only).
