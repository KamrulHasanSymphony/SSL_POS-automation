# Shampan POS/DMS — Playwright Automation

Independent Playwright + TypeScript automation project for **ShampanPOSUI** (the DMS/POS web application at `../ShampanPOSUI`). This project is self-contained: it does not modify, depend on, or live inside the application source tree's build process. It only drives the application's browser UI (and, where explicitly allowed, its backend API for test-data setup/cleanup) as an external client.

## Project Purpose

Implements the automation scope defined in:
- **STEP 1** — source-code-verified application analysis (modules, routes, auth flow, UI stack)
- **STEP 2** — the 267-test SQA Automation Coverage Plan (smoke/sanity/regression/security suites, priorities P0–P3)
- **STEP 3 (this project)** — the reusable framework foundation those 267 tests will be implemented against in a later step

This step builds **infrastructure only** — fixtures, page objects, reusable UI components, and configuration. It does not yet implement the planned test cases themselves.

## Prerequisites

- Node.js 18+ and npm
- The ShampanPOSUI application reachable at a known URL (IIS Express or otherwise), with a valid login account
- The ShampanPOS backend API reachable at a known URL (only needed for API-based test-data setup/cleanup, not for UI test execution itself)

## Installation

```bash
cd automation
npm install
npx playwright install chromium
```

> If your machine's system drive is low on space, `npm`/`npx`/Playwright's TypeScript transform cache all write to the OS temp directory by default. If installs or test runs fail with `ENOSPC`, redirect `TEMP`/`TMP` (and optionally `npm config set cache`) to a drive with free space before retrying.

## Environment Configuration

Copy `.env.example` to `.env` and fill in real values:

```
BASE_URL=              # ShampanPOSUI base URL, e.g. https://localhost:44300
API_BASE_URL=          # ShampanPOS API base URL, e.g. https://localhost:7242

ADMIN_USERNAME=        # Account used for the authenticated storageState (most tests)
ADMIN_PASSWORD=

TEST_USERNAME=         # Secondary/limited account for role-restriction negative tests
TEST_PASSWORD=

HEADLESS=true
```

`.env` is git-ignored. Never hard-code credentials in test files — always read them via `utils/env.ts`.

## Running Tests

```bash
npm test                    # everything, including setup + framework-only scaffold tests
npm run test:smoke          # @smoke, excluding @known-defect and @framework-only — 15-test fast build-health gate
npm run test:sanity         # @sanity, excluding @known-defect and @framework-only — 23-test narrow post-fix check
npm run test:regression     # @regression, excluding @known-defect and @framework-only — full business suite (P0+P1+P2/P3)
npm run test:negative       # @negative, excluding @known-defect and @framework-only
npm run test:security       # tests/ui/security only, excluding @framework-only — see note below
npm run test:known-defects  # @known-defect only — confirmed-open vulnerabilities, opt-in
npm run test:p0             # @p0, excluding @framework-only
npm run test:p1             # @p1, excluding @framework-only
npm run test:p2             # @p2, excluding @framework-only
npm run test:p3             # @p3, excluding @framework-only
npm run test:framework-only # @framework-only — infrastructure validation, not business coverage
npm run test:framework      # --project=framework — same tests, selected by project instead of tag
npm run test:unauthenticated # --project=unauthenticated — login/security tests, no pre-loaded session
npm run test:setup          # --project=setup — the one-time real login, run in isolation
npm run test:authenticated  # --project=authenticated — every business test that needs a session
npx playwright test tests/ui/masters/product.spec.ts   # a single file
npx playwright test -g "PROD-002"                       # a single test by ID/title
```

### Running security tests

Security tests (STEP 2 §2) assert the **secure expected behavior**, not the currently-observed one. Two tagging dimensions apply:

- `@security` — every test in `tests/ui/security` (and the security-relevant tests embedded in other folders, e.g. `SESS-002/003`, `ROLE-007`, `SRET-006`).
- `@known-defect` — the subset of `@security` tests that assert secure behavior against a **confirmed, source-code-verified, currently-unfixed** application gap (the full list lives in `config/tags.ts`'s `knownDefectCandidateIds`: `SEC-002`, `SEC-003`, `SEC-004`, `SEC-005`, `ROLE-007`, `SEC-006`, `SRET-006`). A `@known-defect` test **failing is the correct, desired signal** — it documents an open defect and must never be "fixed" by weakening the assertion to match current insecure behavior.

`test:smoke`, `test:sanity`, `test:regression`, and `test:negative` all pass `--grep-invert "@known-defect|@framework-only"`, so a confirmed open vulnerability can never silently redden the normal functional build gate. Run `npm run test:security` (all security tests, for visibility) and `npm run test:known-defects` (just the known-open-vulnerability subset, for defect tracking) as their own separate, explicit CI steps — never folded into the smoke/regression pass/fail count.

### Viewing the HTML report

```bash
npm run report
```

Opens the report generated at `reports/html/index.html`. Failure screenshots/videos are linked from there; the underlying files live in Playwright's own `test-results/` artifact directory (see the note in `playwright.config.ts` about why per-type folders aren't natively separable).

## Folder Structure

```
automation/
├── tests/
│   ├── ui/
│   │   ├── auth/         Login, logout, session (AUTH, LOGOUT, SESS test IDs)
│   │   ├── security/     Security suite — see "Running security tests" above
│   │   ├── navigation/   Dashboard, direct-URL navigation (NAV)
│   │   ├── masters/      Product, Customer, Supplier, etc. (PROD/CUST/SUPP/...)
│   │   ├── purchase/     PurchaseOrder → Purchase → PurchaseReturn (PO/PUR/PRET)
│   │   ├── sales/        SaleOrder → Sale → SaleReturn (SO/SALE/SRET)
│   │   ├── banking/      Bank, Deposit, Withdrawal, Collection, Payment
│   │   └── reports/      Selected P2 reports
│   ├── api/               Independent API-level checks (not UI-workflow replacements)
│   └── smoke/              (contains only the STEP 3 scaffold-validation spec for now)
│
├── pages/                 Page Object Model classes, one subfolder per business area
├── components/             Reusable UI-widget helpers (see below)
├── fixtures/               base.fixture.ts, auth.fixture.ts, auth.setup.ts
├── test-data/              Static/reusable test-data JSON (module fixtures), not yet populated
├── utils/                  env, logger, random-data, constants, api-helper, test-data setup/cleanup
├── config/                 tags.ts — canonical @tag vocabulary
├── storage/                auth.json (git-ignored, generated by the setup project)
├── reports/, screenshots/, videos/, traces/   Output folders — see config note below
├── playwright.config.ts
├── package.json
├── tsconfig.json
├── .env.example
└── .gitignore
```

### Reusable components (`components/`)

| Component | Covers |
|---|---|
| `components/common-grid/KendoGrid.ts` | List-page grids — load/wait, search, sort, paginate, empty-state |
| `components/kendo/KendoComboBox.ts`, `KendoMultiColumnComboBox.ts` | Enhanced dropdown fields (this app does not use native `<select>` or select2 on sampled forms) |
| `components/kendo/KendoDatePicker.ts` | Kendo date/datetime fields (`kendoDate`/`kendoDateTime` classes) |
| `components/date-picker/DateRangePicker.ts` | jQuery `daterangepicker` fields — a **different** library from Kendo's picker, confirmed both are in live use on different modules |
| `components/BootstrapSwitch.ts` | `IsActive`-style boolean toggles |
| `components/modal/ConfirmDialog.ts` | SweetAlert2/bootbox Delete/Post confirmations |
| `components/notification/Toastr.ts` | Success/error notification assertions |
| `components/LoadingOverlay.ts` | Waits out the app's global AJAX loading overlay instead of `waitForTimeout()` |

**Important:** several of these components target library-standard markup (ARIA roles, default CSS classes) that STEP 1's source-code analysis could not fully confirm against *live rendered DOM*, since the application has not yet been run in this environment. Each file says so explicitly in its header comment, with the specific fallback to check. See the **Live DOM Verification Rule** below.

## Live DOM Verification Rule

**Before using any reusable component for the first real automation test, verify its selectors and interaction behavior against the live rendered DOM.** This applies especially to:

- `KendoGrid`
- `KendoComboBox`
- `KendoMultiColumnComboBox`
- `KendoDatePicker`
- `DateRangePicker`
- `Toastr`
- `ConfirmDialog` (SweetAlert2/bootbox)
- `BootstrapSwitch`

Each of these files carries a `LIVE DOM VERIFICATION RULE` comment pointing back here. **If a source-code-derived selector differs from the live DOM, update the reusable component itself — never patch around it with a one-off workaround inside an individual test.** A workaround in one test file hides the drift from every other test that uses the same component; fixing the component fixes it everywhere at once and keeps the component's own header comment accurate for the next person who reads it.

### Why `screenshots/`, `videos/`, `traces/` are (mostly) empty

Playwright does not support routing each artifact type to a separate top-level folder — screenshot/video/trace files for a given test are always written together under its own subfolder of `outputDir` (configured here as `test-results/`), and the HTML report links to them from there. The requested folders exist for structural completeness but real artifacts will land in `test-results/` until/unless a custom reporter is added to redistribute them — flagged here rather than silently pretending otherwise.

## Project Architecture (Playwright projects)

Four execution contexts, defined in `playwright.config.ts`, each scoped so a given test file is picked up by **exactly one** project:

| Project | Scope (testMatch) | Auth dependency | Requires real credentials to run |
|---|---|---|---|
| `framework` | Any file matching `**/_*.spec.ts` (leading-underscore naming convention) | None | No — runs with an empty `.env` |
| `unauthenticated` | `tests/ui/auth/**`, `tests/ui/security/**` | None; `storageState: undefined` explicitly | No |
| `setup` | `fixtures/auth.setup.ts` only | None (performs the login itself) | **Yes** — fails fast via `assertEnvReady()` if missing |
| `authenticated` | Everything else under `tests/` (masters, purchase, sales, banking, reports, navigation, api) | `dependencies: ['setup']` | Yes, transitively (needs `setup` to succeed first) |

**Dependency graph:**
```
framework         (no dependency)
unauthenticated    (no dependency)
setup              (no dependency — performs the real UI login itself)
authenticated  ──▶  setup
```

- `fixtures/auth.setup.ts` runs once (as the `setup` project) to log in through the real UI (`pages/auth/LoginPage.ts`), resolve the conditional branch-selection step if present (`pages/common/BranchSelectPage.ts`), verify the dashboard/session state, and persist the resulting OWIN session cookie to `storage/auth.json` via Playwright's `storageState`.
- The `authenticated` project depends on `setup` and reuses `storage/auth.json` — module/business tests start already authenticated, without repeating a UI login per test.
- The `unauthenticated` project starts every test with **no pre-loaded session** — this does not mean the test never logs in, only that it never starts already-authenticated. `AUTH-*`/`LOGOUT-*` tests exercise login/logout as their actual test action; `SEC-001..004/006` exercise genuinely anonymous access. The one deliberate nuance: `SEC-005`/`ROLE-007` ("a menu-restricted but authenticated user bypasses the restriction via direct URL") also belongs here, because it needs to log in as a *specific restricted account* (`TEST_USERNAME`/`TEST_PASSWORD`), not the `ADMIN_USERNAME` session `setup` produces — so it performs that login itself, inline, via `LoginPage`, the same way `AUTH-*` tests do, rather than depending on `storage/auth.json`.
- The `framework` project exists purely so infrastructure/scaffold validation (`tests/smoke/_framework-scaffold.spec.ts`) can run without needing any application at all — it has no dependency on `setup` and no storageState.
- The `unauthenticatedPage` fixture in `fixtures/auth.fixture.ts` remains available as a defensive, project-independent guarantee (see its doc comment) for the rare case a test in the `authenticated` project needs a one-off unauthenticated check without leaving its main flow.

### Authentication validation status

Code-reviewed and structurally complete: `auth.setup.ts` opens the real application, performs UI login, resolves the conditional branch-selection step, verifies dashboard/session state before proceeding, saves `storage/auth.json`, and the `authenticated` project reuses that file for every dependent test. Its **failure path has been executed for real** (missing-config → `assertEnvReady()` throws a clear error, confirmed via an actual `--project=setup` run). Its **success path — a real login completing against a running application — has not been executed**, because no `BASE_URL`/`ADMIN_USERNAME`/`ADMIN_PASSWORD` have been supplied yet, and this project does not fake or mock that path. Once those three values are set in `.env`, running `npm run test:setup` will exercise the full flow for real; do not treat it as validated before that run has actually happened and actually passed.

## Test Data Strategy

- `utils/random-data.ts` generates unique identifiers as `AUTO_<MODULE>_<TIMESTAMP>_<RANDOM>` (e.g. `AUTO_PROD_20260810153245_7f3a`), per STEP 2 §H.
- **API Setup Rule** (STEP 2 §3 / STEP 3 requirement): the primary functionality of the module under test must always be validated through the UI. `utils/api-helper.ts`, `utils/test-data-setup.ts`, and `utils/test-data-cleanup.ts` exist only for prerequisite data setup, cleanup, independent API verification, or faster fixture creation of a module that is *not* the one under test. Never use them to replace the UI workflow a test is meant to validate.
- `utils/test-data-cleanup.ts`'s `CleanupRegistry` deletes tracked records after each test — except records from modules confirmed to have no reliable delete path (Purchase Order, Sale, Sale Return), which must never be registered there; those rely entirely on unique naming instead.

## Test Independence

- No test may depend on execution order or another test's leftover state.
- Every test creates/obtains its own prerequisites via fixtures (UI or API per the rule above).
- Shared fixtures are for stable baseline data only (e.g. a pre-existing Company/Branch/FiscalYear, or static ProductGroup/UOM/CustomerGroup/SupplierGroup) — never for transactional/document data.

## Tagging

Ten canonical tags, all defined in `config/tags.ts` — do not retype them as literal strings in test titles:

- **Suite tags:** `@smoke`, `@sanity`, `@regression`, `@negative`, `@security`
- **Priority tags (exactly one required on every business test, including P3):** `@p0`, `@p1`, `@p2`, `@p3` — there is no "no tag" default for P3; every business test carries one of these four.
- **Isolation tags:** `@known-defect` (security test asserting secure behavior against a confirmed, currently-unfixed gap — see "Running security tests" above), `@framework-only` (infrastructure/scaffold validation, not business coverage — see next section).

## Framework Test Isolation

Two tests currently exist in this project, and **neither counts toward the STEP 2-approved 267 business test cases**:

| Test | File | Why it's excluded |
|---|---|---|
| `authenticate` | `fixtures/auth.setup.ts` | Infrastructure — establishes the session every `authenticated`-project test reuses. Runs automatically as a dependency of the `authenticated` project (Playwright's project-dependency mechanism), even though it carries no suite tag and is never matched by `--grep`. The `framework` and `unauthenticated` projects never trigger it. Any custom pass/fail reporting built on top of this suite must filter out `project === 'setup'` before counting results. |
| `framework scaffold` (3 tests) | `tests/smoke/_framework-scaffold.spec.ts` | STEP 3 scaffold validation only, proving the fixture/page-object/component/config layers compile and wire together. Every test title carries `@framework-only`, which is mechanically excluded from `test:smoke`, `test:sanity`, `test:regression`, `test:negative`, and `test:security` via `--grep-invert` in `package.json` — not excluded by naming convention alone. Delete or replace this file once real smoke tests (STEP 2, `AUTH-001` etc.) are implemented. |

## Test Count Protection

**267 is the approved business automation coverage count from the FINAL APPROVED STEP 2: SQA Automation Coverage Plan.** It is recorded machine-readably in `config/coverage-baseline.ts` (total, phase breakdown, priority breakdown, and smoke/sanity/security subset counts).

- Infrastructure/setup/scaffold-validation tests (`auth.setup.ts`, `_framework-scaffold.spec.ts`, and anything tagged `@framework-only`) are **not** included in this count.
- Do not silently increase or decrease the approved 267-test coverage during implementation.
- Any new or removed **business** test case must be explicitly documented with the reason (in the commit/PR description, and — if the change is structural rather than a single test — as an update to `config/coverage-baseline.ts` itself).

## Current Status (as of STEP 3.1)

Framework foundation only. Zero of the 267 planned STEP 2 business test cases are implemented yet. The only tests that currently exist (`authenticate` and the 3 `@framework-only` scaffold tests) are infrastructure, not business coverage — see "Framework Test Isolation" above.
