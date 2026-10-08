# POS — Phase 7: Reusable Validation Framework Report

**Project:** Shampan POS · **Target UI:** http://103.231.239.122:8006/ · **Date:** 2026-10-07
**Phase:** 7 — Reusable Validation Framework · **Status:** COMPLETED
**Scope:** Automation project only. Application source & DB schema STRICTLY READ-ONLY / UNCHANGED. No business specs migrated.

## Architecture

```text
Validation Dataset (DB/TestData/*.validation.json)
        │  filterValidationCases()  ← execution planning
        ▼
resolveCaseInput()  ──►  literal | generator | DB inputSource (+ optional provider registry)
        ▼
runValidationCase()  ──►  classify → resolve input → adapter → assert
        ▼
ValidationFormAdapter (module-specific)  ──►  existing Page Object (selectors/UI)
        ▼
Assertion (MESSAGE_EXACT / SUBMISSION_BLOCKED / ACCEPTED / PATTERN / CUSTOM)
```

The generic runner is **DB-agnostic, page-selector-agnostic, module-agnostic**: it imports `resolveCaseInput` + the opaque `DbProviderRegistry` type only — never `customer-db-provider.ts`, `mssql`, raw SQL, or a Page Object. DB values arrive solely through `resolveCaseInput` + an injected registry.

## Files Created (all under `automation/`)

| File | Role |
|---|---|
| `validation/validation-adapter.ts` | `ValidationFormAdapter` contract; `ExecutionStatus`, `AssertionMode` types |
| `validation/validation-filter.ts` | `filterValidationCases()` + `isDbDependent/isApiDependent/needsRuntimeVerification` + `summarizeDatasetPlan()` |
| `validation/validation-assertions.ts` | `resolveAssertionMode()`, `assertMessageExact/Pattern`, `assertSubmissionBlocked` (message text via `resolveExpectedMessage`, never duplicated) |
| `validation/validation-diagnostics.ts` | `buildValidationTestTitle()`, `buildCaseDiagnostics()`, `formatDiagnostics()`, redaction (`isSensitiveField`, `redactValue`) |
| `validation/validation-runner.ts` | `runValidationCase()`, `classifyCase()` — the DB-agnostic orchestrator |
| `validation/fake-validation-adapter.ts` | in-memory adapter for proof tests (accepted/rejected/message/blocked/cleanup) |
| `tests/framework/_validation-framework.spec.ts` | 21 framework-only proof tests |

## Files Modified

**0 existing business files.** Only the Master Test Plan + this report (documentation). No existing spec/Page Object/fixture/constant changed; `data-providers/` and `utils/` from earlier phases are reused unchanged.

## Runner

`runValidationCase({ testCase, adapter, providerRegistry?, env? })` → `ValidationRunResult { caseId, status, assertionMode?, resolvedValue?, diagnostics }`. Classifies first; blocking statuses short-circuit (no adapter interaction, no fake backfill); genuine assertion/adapter failures throw with **Case-ID-led** diagnostics. Cleanup runs for interacted cases, never for blocked ones.

## Adapter Contract

`open` / `setFieldValue` / `triggerValidation` required; `prepareCase` / `getValidationMessage` / `isSubmissionBlocked` / `verifyAccepted` / `cleanupCase` optional. Module adapters (Phase 8) wrap the existing Page Objects + `BasePage` helpers (`clickSave`, `confirmDialog`, `toastr`, `expectRequiredIndicatorVisible`, …).

## Assertion Modes

`MESSAGE_EXACT` (resolves `expectedMessageKey` via constants), `SUBMISSION_BLOCKED`, `ACCEPTED`, `MESSAGE_PATTERN`, `CUSTOM`. Auto-selected from the case: valid→ACCEPTED, invalid+key→MESSAGE_EXACT, invalid+no key→SUBMISSION_BLOCKED.

## Filters

By `priorities`, `caseTypes`, `fields`, `tags`, and toggles `includeRuntimeVerification` / `includeApiDependent` / `includeDbDependent`. DB detection via `inputSource` or `needs-db` tag; API via `needs-api`; runtime via `needs-runtime-verification`.

## DB Input Support

DB-sourced cases resolve through `resolveCaseInput` + the fake registry in tests. `CUS-GRP-002` → resolves a CustomerGroup record from `FakeCustomerGroupDataProvider`; `CUS-DUP-001` → resolves an existing Customer name from `FakeCustomerDataProvider`. The runner never names these methods — it only passes the registry through.

## Blocked-Case Handling

Statuses: `RUNNABLE`, `BLOCKED_AUTH`, `BLOCKED_API`, `BLOCKED_DB`, `NEEDS_RUNTIME_VERIFICATION`. A DB case with no registry → **`BLOCKED_DB`** (returned, not `FAIL`); never silently backfilled with fake production data. `classifyCase` also honours `env.authAvailable` / `env.apiAvailable`.

## Diagnostics

Structured, secret-free: Case ID, module, form, field, caseType, input-source type, expectedResult, expectedMessageKey, priority, execution status, and (for DB cases) **provider + method only** — never SQL/connection/password/token/cookie. Password-type field values are redacted to `[REDACTED]`. Titles: `[CUS-TEL-001] Customer :: TelephoneNo :: required :: invalid`.

## Proof Tests

`tests/framework/_validation-framework.spec.ts` — 21 tests, NO UI/auth/DB/API/network. Covers: literal/generator/DB input, BLOCKED_DB without registry, MESSAGE_EXACT pass + wrong-message failure (Case-ID in diagnostics), ACCEPTED, SUBMISSION_BLOCKED pass/fail, runtime-verification/API/DB/priority/caseType/field filtering, cleanup hook (runs vs not), password redaction, deterministic title, `classifyCase` gating, real `CUS-GRP-002`/`CUS-DUP-001` fake-DB resolution, and the real-dataset planning summary.

## Customer Dataset Proof (no UI)

`loadValidationDataset('Masters/customer.validation.json')` + `summarizeDatasetPlan()`: total = all cases; **dbDependent ≥ 2** (`CUS-GRP-002`, `CUS-DUP-001`); ≥1 P0; `runnableWithoutDbApiRuntime < total`. Confirmed in test #21.

## Existing Specs Migrated

**0** (Phase 7 is framework-only; migration begins in Phase 8). No inline test data removed.

## Status

```text
Authentication:  BLOCKED — INVALID_CREDENTIAL
Remote POS API:  BLOCKED — VERIFIED URL REQUIRED
Live Customer DB: BLOCKED — VERIFIED CONNECTION + COMPANY/BRANCH REQUIRED
DMS:             OPEN — WAITING FOR APPLICATION DEVELOPER (USE AS-IS; 0 fixed/renamed/changed)
```

## Source Safety

```text
POS Frontend modified:   NO
POS Backend/API modified: NO
POS Database modified:   NO (no SQL executed)
Automation modified:     YES (additions under automation/ only)
SaleOrderController.js pre-existing change preserved: YES
```

## Verification

```text
npx tsc --noEmit            -> exit 0
npx playwright test --list  -> 384 tests in 89 files  (before Phase 7: 363/88)
Framework proof specs       -> 41 passed / 0 failed
  Phase 6 loader proof        : 11 passed
  Customer DB-provider proof  :  9 passed
  Phase 7 framework proof     : 21 passed
New framework tests (Phase 7): +21 · Existing tests removed: 0
```

## Phase 8 Recommendation

Implement **P0 live validation** starting with Customer: build `CustomerValidationAdapter` wrapping the existing `CustomerPage`, inject the (then-wired) read-only DB provider registry, and drive `filterValidationCases(customer, { priorities:['P0'] })` through `runValidationCase`. This needs the **AUTH blocker cleared** (valid credentials → company/branch scope) and, for `inputSource` rows, the **verified read-only DB credential**. Promote `needs-runtime-verification` cases only after confirming the real app behaviour. Do not mass-migrate all modules at once; add `mssql` and the concrete `CustomerDataProvider` only when the verified connection exists.
