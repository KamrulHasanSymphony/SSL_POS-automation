# POS — Phase 6: Data-Driven Architecture Report

**Project:** Shampan POS · **Target UI:** http://103.231.239.122:8006/ · **Date:** 2026-10-07
**Phase:** 6 — Data-Driven Architecture · **Status:** COMPLETED
**Scope:** Automation project only. Application source STRICTLY READ-ONLY. No existing specs modified or migrated.

---

## Architecture Created

A centralized, strongly-typed test-data layer that keeps the four concerns separate:

```text
Input data            -> automation/DB/TestData/**/*.validation.json
Expected message text -> utils/constants.ts (referenced by key — never duplicated)
Runtime unique values -> utils/random-data.ts (referenced by typed generator token)
UI interaction        -> existing Page Objects (unchanged)
```

No existing POM, fixture, helper, constant, or spec was rewritten. `resolveJsonModule` was already enabled; no new npm dependency was added (lightweight TS validator instead of a schema library).

## Folder Structure

```text
automation/DB/
├── TestData/
│   ├── Masters/   customer, product, supplier, customer-advance, lookup-common (.validation.json)
│   ├── Banking/   bank-information.validation.json
│   └── Setup/     user-profile, company-profile (.validation.json)
├── Schemas/       validation-case.schema.json  (reference only; not loaded at runtime)
└── README.md
```

Only module areas with real datasets got folders (Masters/Banking/Setup). `Authentication/Purchase/Sales/Transactions/Common` are intentionally **not** created yet (added when their datasets exist).

## Types / Interfaces

`utils/validation-dataset.ts` — authoritative contract:
- `ValidationCaseType` (22 types: required, empty, whitespace, min/max-length, below-min, above-max, valid/invalid-format, zero, negative, positive, boundary, decimal-precision, special-character, unicode-bangla, duplicate, leading/trailing-whitespace, conditional-required, dependent-field, business-rule).
- `FieldValidationCase` (id, module, form, field, fieldType, caseType, input?, expectedResult, expectedMessageKey?, priority?, tags?, notes?).
- `ValidationDataset` ({ module, form, cases[] }).
- `InputGeneratorToken` + `isInputGeneratorToken()` — typed dynamic-input tokens (no JS/eval in JSON).
- `assertValidDataset()` + `ValidationDatasetError`.

## Loader

`utils/test-data-loader.ts`:
- `TEST_DATA_ROOT` derived from `__dirname` (no hard-coded drive/machine path; Windows-safe `path.resolve`).
- `loadValidationDataset(relativePath)` — path-escape guard, missing-file error, malformed-JSON error, then structural validation.
- `resolveExpectedMessage(key)` — dotted key → existing constants group (18 groups registered incl. `api`).
- `resolveInput(value)` — generator token → `random-data` call; literals passed through; exhaustiveness-guarded.

## Dataset Validation

Lightweight, dependency-free (`assertValidDataset`): verifies top-level `module`/`form`/`cases`, each row's required fields (`id, module, form, field, fieldType, caseType, expectedResult`), `caseType` ∈ union, `expectedResult` ∈ {valid,invalid}, unique row ids, and known input-generator names. Errors name the file, the offending row id, and exactly what is wrong — e.g.:

```text
Invalid validation dataset: in-memory
Row: R1
Missing: caseType
```

## Expected Message Resolution

`expectedMessageKey: "customer.telephoneRequired"` → `customerValidationMessages.telephoneRequired` = `"Telephone No. is required."`. Message text is **never** copied into JSON. Unknown group/key throws (text is never invented). Where the app's message is not yet centralized, the row omits the key and is tagged `needs-runtime-verification`.

## Initial Datasets (8)

| Dataset | Cases | Notable coverage |
|---|---:|---|
| `Masters/customer.validation.json` | 15 | telephone required/format, email formats, group-combo required, Name unicode/special/whitespace/length |
| `Masters/product.validation.json` | 11 | Name required/unicode, combo required (group/UOM), VAT/SD zero/negative/decimal/alpha, stock negative |
| `Masters/supplier.validation.json` | 10 | Name/Address required, special/unicode/whitespace, duplicate (needs-api) |
| `Masters/customer-advance.validation.json` | 7 | Range>0 zero/negative/positive/below-min/decimal/large, payment combo required |
| `Masters/lookup-common.validation.json` | 8 | shared Name cases for 8 flat lookups; per-module required keys documented |
| `Banking/bank-information.validation.json` | 9 | Name/Telephone required, phone short/valid/long/alpha, Name unicode |
| `Setup/user-profile.validation.json` | 9 | email valid/invalid, phone ^\d{11}$ boundaries, ConfirmPassword mismatch (synthetic), FullName unicode |
| `Setup/company-profile.validation.json` | 8 | CompanyName required/whitespace/unicode, email/telephone format, FY date-ordering business rule |

**Total: 85 validation cases.** Every `expectedMessageKey` used resolves (guarded by a proof test over all 8 files). Unproven length/boundary limits are **not invented** — tagged `needs-runtime-verification`.

## Dynamic Data Strategy

Unique/dynamic values use typed tokens resolved against existing generators — never static values where uniqueness matters, never executable JS:
`{ "generator": "uniqueCode", "arg": "CUSTOMER" }`, `{ "generator": "randomData.phone11Digit" }`, `{ "generator": "randomData.int", "min": 1, "max": 100 }`. Allowed: `uniqueCode, randomData.{code,name,email,phone11Digit,int}`.

## Security / Secrets Strategy

Datasets contain **no** passwords, tokens, cookies, API keys, DB credentials, or real customer data. Password-type cases use harmless synthetic values only. Auth secrets stay in `.env` (git-ignored). Verified by inspection of all 8 files.

## Proof Tests

`tests/framework/_test-data-loader.spec.ts` — framework-only (leading-underscore filename → `framework` project; `@framework-only` tag). **No UI / auth / API / data creation.** 11 tests, all passing (2.7s):
load real dataset · missing-file error · path-escape guard · missing-field row · unknown caseType · invalid expectedResult · duplicate id · message-key resolution · unknown-key throws · dynamic-input resolution + literal passthrough · every shipped dataset's keys resolve.

## Existing Specs Modified

**0.** No existing spec, Page Object, fixture, helper, or constant was changed. (Only additions: 2 util modules, 8 datasets, 1 schema, 1 README, 1 framework proof spec — all under `automation/`.)

## Existing Specs Not Yet Migrated

**All of them (by design).** No inline validation data was removed; no spec now consumes a dataset. Migration happens incrementally in Phases 8–11 behind the Phase 7 runner.

## Blockers

- **AUTH_BLOCKER** — invalid credentials; does not affect this phase (framework-only proof needs no auth).
- **API_BLOCKER** — no verified POS API URL; duplicate/business-rule cases tagged `needs-api` remain `BLOCKED — VERIFIED POS API BASE URL REQUIRED`.
- **needs-runtime-verification** — length/boundary/whitespace/format edges with no source-proven rule; to be confirmed live once auth is unblocked (not guessed).

## DMS Status

```text
DMS Issues Fixed: 0 · DMS References Renamed: 0 · DMS Routes Changed: 0
DMS Current Action: USE AS-IS · DMS Issue Status: OPEN — WAITING FOR APPLICATION DEVELOPER
```

Datasets hold field inputs only — they contain no `/DMS/` routes. No DMS reference was touched.

## Source-Code Safety Verification (git status/diff at repo root)

```text
POS Frontend Modified By This Task:    NO
POS Backend/API Modified By This Task: NO
POS Database Modified By This Task:    NO
Automation Project Modified:           YES (additions under automation/ only)
```

Pre-existing application modification preserved: `ShampanPOSUI/Areas/DMS/js/Controllers/SaleOrderController.js` — untouched (no stage/revert/format/delete; no destructive git used).

## Verification

```text
npx tsc --noEmit             -> exit 0 (clean)
npx playwright test --list   -> 354 tests in 87 files
Framework proof test         -> 11 passed (0 failed)

Baseline before: 343 tests / 86 files
After:           354 tests / 87 files
New tests:       +11 (the framework proof spec only)
Existing tests removed: 0
```

## Recommended Phase 7 Work

Build the **reusable field-validation runner** that consumes these datasets against the existing Page Objects: a table-driven helper that, per case, resolves `input`, drives the field via the module's Page Object, and asserts either the resolved `expectedMessageKey` (exact) or a stable "blocked/accepted" signal — iterating `test.describe`/`for` over `loadValidationDataset(...)`. It must run under the `authenticated` project (so it needs the AUTH blocker cleared), start with one P0 module (e.g. Customer or Supplier), and confirm each `needs-runtime-verification` case against the live app before promoting its `expectedResult`. Do not mass-migrate all modules at once.
