# POS Automation — API Dependency Analysis

**Project:** Shampan POS
**Target UI:** http://103.231.239.122:8006/
**Date:** 2026-10-07
**Scope:** Playwright + TypeScript Automation project only (application source untouched)

---

## 1. Policy applied

- **Existing application APIs MAY be used as-is** (test-data setup/cleanup/verification, auth support, backend-rule checks). Using an existing API is **not** a source-code modification.
- **Application API source MUST NOT be modified.** No controllers/services/repos/DTOs/models/routes/config/DB touched.
- **No remote POS API URL is guessed or derived from the UI port.** A URL is used only if already verified in config/docs/traffic.
- **DMS references** are kept **as-is** where the currently deployed app depends on them, and tracked as **OPEN** issues (see §6 and the DMS audit).

---

## 2. Is a verified remote POS API URL available?

**No.** The only `API_BASE_URL` present is the previous local example `https://localhost:7242` (in `.env`, with `.env.example` and `README.md` showing it only as an example). No verified **remote** POS API endpoint exists in configuration, documentation, or captured traffic.

> `README.md:18` — *"The ShampanPOS backend API reachable at a known URL (only needed for API-based test-data setup/cleanup, not for UI test execution itself)."*

**Therefore every test that directly depends on `API_BASE_URL` is:**

```text
BLOCKED — VERIFIED POS API BASE URL REQUIRED
```

**UI-only tests that do not depend on `API_BASE_URL` are NOT blocked by this** (they are blocked only by the separate, already-reported invalid-credentials issue).

---

## 3. How the API dependency is wired (architecture)

```text
base.fixture.ts  ── defines apiClient (lazy) + cleanup (depends on apiClient)   [utils/api-helper.ts -> API_BASE_URL]
      ▲
auth.fixture.ts  ── UI login only (no API); provides performLogin / per-worker session
      ▲
masters.fixture.ts / masters4.fixture.ts  ── use apiClient to CREATE prerequisite data (API_FOR_TEST_SETUP)
```

Key point: `apiClient` and `cleanup` are **lazy** Playwright fixtures — they are instantiated **only** when a test (or a fixture it uses) actually references them. A UI spec that never touches `apiClient`/`cleanup` and never imports `masters`/`masters4` makes **no** API call, even though it transitively extends `base.fixture`. This was verified by reference analysis, not assumed.

Supporting API code (clients/helpers — not tests): `utils/api-helper.ts` (`ApiClient`), `api/SecurityApiClient.ts`, `utils/test-data-setup.ts`, `utils/test-data-cleanup.ts`, `utils/env.ts`.

---

## 4. Classification summary

| Category | Spec files | Depends on `API_BASE_URL`? | Runtime status |
|---|---:|---|---|
| **UI_ONLY / NO_API_DEPENDENCY** | 63 | No | READY once UI auth works (blocked only by invalid credentials) |
| **API_ONLY** | 11 | Yes (direct) | BLOCKED — VERIFIED POS API BASE URL REQUIRED |
| **UI_WITH_API_DEPENDENCY** | 11 | Yes (setup/cleanup/verify) | UI sound; BLOCKED on API for the setup/verify path |
| **Total** | **85 spec files** | — | (+ `fixtures/auth.setup.ts` infra = 86 in `--list`; 343 tests) |

- **UI_ONLY = 62 UI specs + 1 framework scaffold (`tests/smoke/_framework-scaffold.spec.ts`).**
- No test was converted, removed, or disabled. Classification is descriptive only.

---

## 5. Detailed classification

### 5.1 API_ONLY — 11 files → BLOCKED — VERIFIED POS API BASE URL REQUIRED

Direct API tests (`ApiClient` / `SecurityApiClient` / `assertEnvReady('apiBaseUrl')`). Do **not** convert to UI or remove.

| File | Notes |
|---|---|
| `tests/api/auth-login.spec.ts` | API SignIn (`assertEnvReady('apiBaseUrl')`) |
| `tests/api/enum-type.spec.ts` | API enum endpoints |
| `tests/api/unauthenticated-access.spec.ts` | API authz checks |
| `tests/api/due-amount-validation.spec.ts` | `ApiClient` — business-rule (due amount) |
| `tests/api/duplicate-validation.spec.ts` | `ApiClient` — duplicate rule |
| `tests/api/e2e/api-security-hardening-validation.spec.ts` | API security |
| `tests/api/e2e/api-security-lifecycle.spec.ts` | API security |
| `tests/api/e2e/data-integrity-validation.spec.ts` | `ApiClient` — data integrity |
| `tests/api/e2e/error-api-revalidation.spec.ts` | `ApiClient` — error revalidation |
| `tests/api/e2e/error-api-validation.spec.ts` | `ApiClient` — error validation |
| `tests/security/vapt/vapt-security-assessment.spec.ts` | `SecurityApiClient` / `API_BASE_URL` |

### 5.2 UI_WITH_API_DEPENDENCY — 11 files

**API_FOR_TEST_SETUP** (prerequisite data created via API before a UI workflow) — 8 files:

| File | API role |
|---|---|
| `tests/ui/masters/customer.spec.ts` | `masters.fixture` → create prerequisite groups via API |
| `tests/ui/masters/product.spec.ts` | `masters.fixture` → product group / UOM via API |
| `tests/ui/masters/supplier.spec.ts` | `masters.fixture` → supplier group via API |
| `tests/ui/masters/income.spec.ts` | `masters4.fixture` → API setup |
| `tests/ui/masters/expense.spec.ts` | `masters4.fixture` → API setup |
| `tests/ui/masters/master-item.spec.ts` | `masters4.fixture` → UOM via API |
| `tests/ui/masters/master-supplier-item.spec.ts` | `masters4.fixture` → API setup |
| `tests/ui/e2e/inventory-stock-lifecycle.spec.ts` | `masters`/`masters4` → API setup |

**API_FOR_TEST_SETUP + API_FOR_TEST_CLEANUP + API_FOR_VERIFICATION** — 3 files:

| File | API role |
|---|---|
| `tests/ui/e2e/data-integrity-lifecycle.spec.ts` | `apiClient`/`cleanup` — setup + verification |
| `tests/ui/e2e/error-handling-recovery-lifecycle.spec.ts` | `apiClient.post('/api/Purchase/Insert', …)` — backend error-handling verification |
| `tests/ui/e2e/error-handling-recovery-revalidation.spec.ts` | `apiClient.post('/api/Purchase/Insert', …)` — backend error-handling revalidation |

> These 11 stay as hybrid tests. Their UI logic is sound; only the API-backed setup/verification cannot run until a verified POS API URL is supplied. Do **not** strip the API dependency to force them UI-only.

### 5.3 UI_ONLY / NO_API_DEPENDENCY — 63 files → not blocked by the API gap

All `tests/ui/**` specs **except** the 11 above, plus `tests/smoke/_framework-scaffold.spec.ts`. These drive the browser through the POS UI; the application handles its own backend. They depend on **`BASE_URL` only**. Includes: all auth/logout/branch specs, banking (bank/collection/deposit/payment/withdrawal), navigation, security/unauthenticated-access, most masters CRUD (business-type, uom, payment-type, over-head, table-section/info, all *-group and branch/area/fiscal-year/customer-advance/company specs), all setup specs, purchase/sales UI specs, and the UI-driven e2e lifecycles (financial, sales, purchase, vat, multi-branch, audit-trail, etc.).

**Status:** READY to run once the already-reported **UI credential blocker** is cleared — the missing API URL does **not** block these.

---

## 6. DMS references and the API (policy-aligned status)

Per the updated DMS policy, DMS references are recorded as **OPEN** issues but used as-is while the deployed app depends on them.

```text
DMS_ROUTE_REFERENCE   : ~220 (relative /DMS/... routes used by Page Objects/specs)
  Runtime Status      : FUNCTIONAL  (verified live: /DMS/<real>/Index -> 302 POS login; /DMS/<fake>/Index -> 404)
  Issue Status        : OPEN — WAITING FOR APPLICATION DEVELOPER
  Current Action      : USE AS-IS
  Remediation         : DO NOT FIX NOW

DMS_API_REFERENCE     : 0  (no API endpoint path, client, or base URL contains DMS;
                            the only API path seen is /api/Purchase/Insert)
```

No DMS endpoint will be renamed, replaced, invented, or disabled. See `POS_DMS_CONTAMINATION_AUDIT.md`.

---

## 7. Recommended next actions

1. **Provide a verified remote POS API base URL** (from the deployment's own configuration or captured traffic — not guessed, not the UI port). Then set `API_BASE_URL` in `automation/.env` and the 11 API_ONLY + the API-backed paths of the 11 hybrid specs become runnable.
2. **Provide valid POS UI credentials** to clear the separate authentication blocker; that alone unblocks the 63 UI_ONLY specs and the UI portions of the hybrids.
3. Leave DMS routes as-is (OPEN issue) pending the application developer.

---

## 8. Source-Code Safety Verification

```text
POS Frontend Modified:       NO
POS Backend/API Modified:    NO
POS Database Modified:       NO
Automation Project Modified: YES (this analysis document only; no test/code behaviour changed)
```

Verified via `git status`/`git diff` at repo root — the only application-tree change remains the pre-existing, not-mine 1-line `ShampanPOSUI/Areas/DMS/js/Controllers/SaleOrderController.js` edit (committed 2026-07-29), left untouched.

## 9. Post-analysis verification

```text
npx tsc --noEmit            -> exit 0 (clean)
npx playwright test --list  -> 343 tests in 86 files (discovery unchanged; nothing disabled)
```
