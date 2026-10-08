# POS — DMS Cross-Project Contamination Audit

**Project:** Shampan POS
**Target UI:** http://103.231.239.122:8006/
**Date:** 2026-10-07
**Scope:** Playwright + TypeScript Automation project only (application source untouched)

---

## 0. Policy-Aligned Status (updated 2026-10-07)

Per the updated DMS API/Route policy, DMS references that the currently deployed POS application depends on are **kept and used as-is**, and tracked as **OPEN** issues until the application developer changes them. The runtime evidence in this report (DMS routes are functional POS MVC-Area routes) is exactly the basis for `USE AS-IS`:

```text
Category            : DMS_ROUTE_REFERENCE   (DMS_API_REFERENCE: none found — 0 in any API path/client/base URL)
Runtime Status      : FUNCTIONAL
Issue Status        : OPEN — WAITING FOR APPLICATION DEVELOPER
Current Automation Action : USE AS-IS
Remediation         : DO NOT FIX NOW
```

No DMS route/endpoint is renamed, replaced, invented, disabled, or fixed now. When the application developer later changes the deployed app, re-scan the live app, discover the new real routes, update the Automation, run regression, then close the issue. The "zero contamination / verified MVC Area" verdict below stands as the evidence; the policy simply formalizes it as an OPEN, do-not-fix-now item rather than a closed non-issue.

---

## 1. Executive Summary

**Verdict: NO cross-project contamination found. `DMS` is a legitimate MVC *Area* (module) inside the Shampan POS application itself — not a separate project — confirmed by independent runtime and source evidence.**

The audit was run on the explicit premise that *"DMS is a completely different project from POS."* That premise does **not** hold for this environment, and the instructions correctly gate on this: a DMS reference may be treated as normal POS behaviour only with *"extremely strong runtime evidence."* That evidence exists and is decisive (see §3). Accordingly:

- **0** references point to a foreign DMS system, host, API, or dataset.
- **0** DMS references in configuration, `.env`, API clients, API base URL, or credentials.
- **Every** `/DMS/...` reference is a *relative* route resolved against the configured POS `BASE_URL`, and every such route is served by the POS app at `:8006` (verified live).
- **No** automation changes were required or made (a blind `DMS → POS` replacement is prohibited and would in fact break every affected test, since these routes are correct).

If your organisation additionally has a *separate* product also called "DMS", that is an application-architecture matter outside this automation project — this automation never targets any host other than the POS `BASE_URL`, so there is no cross-system execution risk either way.

---

## 2. Complete Search Scope

Case-insensitive search for `dms`, `DMS`, `/DMS/`, `DMS_`, `_DMS`, `Distribution Management System`, `DistributionManagement` across the Automation project:

- File types: `*.ts`, `*.js`, `*.json`, `*.md`, `*.txt`, `*.yml/.yaml`, `.env*`
- Folders: `tests/`, `pages/`, `fixtures/`, `helpers/`, `utils/`, `config/`, `api/`, `components/`, `storage/`, `Documents/`, plus root config (`playwright.config.ts`, `package.json`, `tsconfig.json`, `.env`, `.env.example`)
- Excluded from counts: `node_modules/` and generated run artifacts (`allure-results/`, `allure-report/`, `test-results/`, `reports/`, `traces/`, `videos/`, `screenshots/`, `*.log`) — these only echo test titles/steps that already contain the route strings.

### Count reconciliation

| Measure | Count |
|---|---:|
| Raw case-insensitive `dms` matches (source) | 368 |
| — of which camelCase **false positives** (`thresholdMs` etc., substring `dMs`) | 25 (+ more across files) |
| **Genuine DMS-area references** | **~220** |
| &nbsp;&nbsp;• literal `/DMS/...` paths (incl. `Areas/DMS/...` source-citation comments) | 138 |
| &nbsp;&nbsp;• `routes.dms(...)` helper calls + its definition | 81 |
| &nbsp;&nbsp;• `'DMS'` area-type literal (`DashboardPage.gotoModule`) | 1 |
| DMS references in `.env` / `.env.example` / `playwright.config.ts` / `tsconfig.json` | **0** |
| DMS references in API clients / helpers / `env.ts` / any base URL | **0** |
| DMS references attached to any host / URL / `newContext` baseURL | **0** |

---

## 3. All DMS Findings — and the Runtime Evidence

### 3.1 Decisive runtime verification (live app at `:8006`)

Unauthenticated probes of routes used by the automation:

| Request | Result | Meaning |
|---|---|---|
| `GET /DMS/TableSection/Index` | **302 → `/Login/Index?ReturnUrl=%2FDMS%2FTableSection%2FIndex`** | Route exists in **this** app; protected by **this** app's Forms Auth |
| `GET /DMS/Product/Index` | **302 → `/Login/Index?ReturnUrl=%2FDMS%2FProduct%2FIndex`** | Same — real, auth-protected POS route |
| `GET /DMS/Customer/Index` | **302 → `/Login/Index?ReturnUrl=%2FDMS%2FCustomer%2FIndex`** | Same |
| `GET /DMS/NonExistentXyz/Index` | **404** | Proves the 302s are genuine controller resolutions, not a catch-all |
| `GET /SetUp/CompanyProfile/Create` | **302 → login** | `SetUp` is likewise a real Area of this app |

The POS login page itself generates `ReturnUrl` values pointing back into `/DMS/...`. A foreign application's routes could not produce POS-login redirects with POS `ReturnUrl`s, and non-existent DMS controllers 404 — so the resolving ones are real.

### 3.2 Source-structure corroboration

- The application is `ShampanPOSUI`, an ASP.NET MVC app whose own source tree contains `Areas/DMS/`, `Areas/SetUp/`, `Areas/Common/` (standard MVC **Areas** = modules within one application). The pre-existing (not-mine) working-tree file `ShampanPOSUI/Areas/DMS/js/Controllers/SaleOrderController.js` lives inside that area.
- `package.json` describes the project as *"automation project for Shampan POS/DMS (ShampanPOSUI)"* — i.e. the app's own name is **POS/DMS**.
- `utils/constants.ts` DMS routes/selectors carry comments citing the exact `Areas/DMS/Views/...` source files they were confirmed against — accurate citations of **this** app's source.

---

## 4. Route Contamination

**None.** All `/DMS/...` routes are relative and resolve against POS `BASE_URL`; all tested ones are live POS routes (§3.1).

Representative (all in `utils/constants.ts`):

```ts
openBranchCreate: '/DMS/BranchCreate/Index',
confirmedProtectedPage: '/DMS/TableSection/Index',
dms: (controller, action = 'Index') => `/DMS/${controller}/${action}`,   // line 51
```

Page objects navigate via the helper, e.g. `pages/masters/ProductPage.ts:126`:

```ts
await this.page.goto(routes.dms('Product', 'Index'));   // -> http://103.231.239.122:8006/DMS/Product/Index
```

Classification against the requested taxonomy: evaluated as `WRONG_PROJECT_ROUTE` → **rejected on runtime evidence** → disposition **NOT_CONTAMINATION (verified POS MVC Area)**.

## 5. API Contamination

**None.** No `DMS`, `/dms/`, `DMS_API`, or `DMS_BASE_URL` anywhere in `api/`, `utils/api-helper.ts`, `utils/env.ts`, or any spec's API usage. The POS remote API URL remains unprovided and the affected API tests stay **BLOCKED — CORRECT POS API URL REQUIRED** (unchanged from the authentication baseline). No DMS API is or will be used as a fallback.

## 6. Configuration Contamination

**None.** No DMS in `.env`, `.env.example`, `playwright.config.ts`, `tsconfig.json`. The only `package.json` occurrence is the descriptive project name *"Shampan POS/DMS"*, which is accurate.

## 7. Test / Page Object Contamination

**None (as contamination).** `routes.dms(...)` is used by the masters/purchase/sales/banking page objects and their specs to reach the POS app's DMS-area screens. `pages/common/DashboardPage.ts:59` enumerates the app's three real areas: `area: 'DMS' | 'SetUp' | 'Common'`. All legitimate POS targets.

## 8. Test-Data Contamination

**None.** No `Automation/DB/` or `DB/TestData/` folder exists in this project, and no DMS-specific dataset/JSON/CSV was found. (If an `Automation/DB/TestData/` repository is created later, it must remain POS test data only, per the standing rule.)

## 9. Documentation Contamination

**None requiring action.** DMS appears in `README.md` and in `utils/constants.ts` doc comments as accurate citations of the POS app's `Areas/DMS/...` source files. These describe the system under test correctly; classifying them as `STALE_PROJECT_REFERENCE` is not warranted. The `Documents/POS_AUTHENTICATION_BASELINE_REPORT.md` mention of `Areas/DMS/...SaleOrderController.js` is the transparency note about the app source path, not an automation dependency.

## 10. Fixed Automation-Only Issues

**None.** No contamination was found, so no fix was warranted. Per STEP 9, a blanket `DMS → POS` replacement is prohibited; here it would also be actively harmful — it would rewrite 220 correct POS route references into non-existent paths and break the affected suites.

## 11. Unresolved Issues

**None related to DMS.** The two pre-existing, non-DMS blockers from the authentication baseline remain and are unchanged by this audit:

1. **Invalid credentials** for `http://103.231.239.122:8006/` (authentication blocked) — `INVALID_CREDENTIAL`.
2. **Remote POS `API_BASE_URL` not provided** — all API specs `BLOCKED — CORRECT POS API URL REQUIRED`.

## 12. Recommended Next Actions

1. **Accept the evidence** that DMS is a POS MVC Area here; do **not** rename or replace `/DMS/` routes. If you expected DMS to be absent, the question belongs to the *application* team (why the POS deployment exposes a DMS area), not to this automation.
2. If a genuinely separate DMS **product/API** exists elsewhere, keep it out of this project — this automation already references no foreign DMS host, so no action is needed unless one is later introduced.
3. Provide valid POS credentials and the remote POS `API_BASE_URL` to clear the two real blockers above.
4. Keep any future `Automation/DB/TestData/` strictly POS-only.

---

## Issue / Disposition Table

Grouped by reference class (the ~220 genuine references share the same root cause and disposition; per-line enumeration of 220 identical-disposition lines is omitted as non-actionable). Requested taxonomy was evaluated for each and **rejected on runtime evidence**.

| ID | File(s) | Lines | DMS Reference | Taxonomy Evaluated | Disposition | Severity | Used By | Impact | Status |
|---|---|---:|---|---|---|---|---|---|---|
| POS-DMS-001 | `utils/constants.ts` | 42–51 | `/DMS/...` route constants + `dms()` helper | WRONG_PROJECT_ROUTE | NOT_CONTAMINATION — verified POS MVC Area (302→POS login; 404 on fake controller) | NONE | All masters/txn page objects | None — routes resolve correctly on POS | VERIFIED-LEGITIMATE |
| POS-DMS-002 | `pages/**` (masters, purchase, sales, banking) | 81 call sites | `routes.dms('<Ctrl>','<Action>')` | WRONG_PROJECT_ROUTE / WRONG_PROJECT_TEST_LOGIC | NOT_CONTAMINATION — POS navigation | NONE | Their specs | None | VERIFIED-LEGITIMATE |
| POS-DMS-003 | `tests/ui/**` | various | `/DMS/...` navigations/assertions | WRONG_PROJECT_TEST_LOGIC | NOT_CONTAMINATION — POS screens | NONE | Test runner | None | VERIFIED-LEGITIMATE |
| POS-DMS-004 | `utils/constants.ts`, `pages/**`, `README.md` | 74 cites | `Areas/DMS/...` source-path comments | STALE_PROJECT_REFERENCE | NOT_CONTAMINATION — accurate POS source citations | LOW (informational) | Developers | None — documentation only | VERIFIED-LEGITIMATE |
| POS-DMS-005 | `pages/common/DashboardPage.ts` | 59 | `area: 'DMS' \| 'SetUp' \| 'Common'` | WRONG_PROJECT_NAMING | NOT_CONTAMINATION — enumerates the 3 real POS areas | NONE | `gotoModule()` | None | VERIFIED-LEGITIMATE |
| POS-DMS-006 | `package.json` | 4 | description "Shampan POS/DMS" | WRONG_PROJECT_CONFIGURATION | NOT_CONTAMINATION — accurate app name | NONE | — | None | VERIFIED-LEGITIMATE |
| — | `helpers/PerformanceRecorder.ts` + others | 25+ | `thresholdMs` (substring `dMs`) | — | FALSE POSITIVE — not a DMS reference | NONE | — | None | EXCLUDED |

**Severity tally (genuine contamination):** CRITICAL 0 · HIGH 0 · MEDIUM 0 · LOW 0.

---

## Source-Code Safety Verification (git status/diff at repo root)

```text
POS Frontend Modified:      NO
POS Backend/API Modified:   NO
POS Database Modified:      NO
Automation Project Modified: YES  (this audit report + the baseline-report section only; no code changed)
```

The only application-tree change remains the **pre-existing, not-mine** 1-line edit to `ShampanPOSUI/Areas/DMS/js/Controllers/SaleOrderController.js` (last committed 2026-07-29), preserved untouched. No destructive git commands were used.

## Post-audit verification (STEP 14)

```text
npx tsc --noEmit        -> exit 0 (clean)
npx playwright test --list -> Total: 343 tests in 86 files  (discovery unchanged)
```
