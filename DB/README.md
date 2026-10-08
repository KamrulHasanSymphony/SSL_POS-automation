# automation/DB — Automation Test-Data Repository

**This folder contains Playwright Automation datasets ONLY.**

It is **not** the application database, a migration project, a SQL project, or production data storage. Nothing here connects to, creates, or alters any real database object. It exists so validation inputs live in structured, reviewable data files instead of being hard-coded across specs.

> Created in Phase 6 (Data-Driven Architecture) of `Documents/POS_AUTOMATION_TEST_PLAN.md`.

## Purpose

```text
Input data            -> datasets here (DB/TestData/**/*.validation.json)
Expected message text -> utils/constants.ts  (referenced by expectedMessageKey — never copied here)
Runtime unique values -> utils/random-data.ts (referenced by a typed generator token)
UI interaction        -> existing Page Objects (unchanged)
```

## Directory structure

```text
DB/
├── TestData/
│   ├── Masters/   customer, product, supplier, customer-advance, lookup-common
│   ├── Banking/   bank-information
│   └── Setup/     user-profile, company-profile
├── Schemas/       validation-case.schema.json (reference schema; not loaded at runtime)
└── README.md      (this file)
```

Folders are created only when a module area actually has a dataset. `Authentication/`, `Purchase/`, `Sales/`, `Transactions/`, and a shared `Common/` are added in later phases when their datasets exist — do not create empty/arbitrary folders.

## Naming convention

`<module>.validation.json` in kebab-case, e.g. `customer.validation.json`, `user-profile.validation.json`, `bank-information.validation.json`, `lookup-common.validation.json`. Existing automation files are **not** renamed for consistency.

## JSON contract

Authoritative type: `utils/validation-dataset.ts` (`ValidationDataset` / `FieldValidationCase`). Each file:

```jsonc
{
  "module": "Customer",
  "form": "Create/Edit",
  "cases": [
    {
      "id": "CUS-TEL-001",              // unique within the file
      "module": "Customer",
      "form": "Create/Edit",
      "field": "TelephoneNo",
      "fieldType": "text",              // text|textarea|number|combobox|select|checkbox|date|password
      "caseType": "required",           // see ValidationCaseType union
      "input": "optional literal or generator token (omit for empty/required)",
      "expectedResult": "invalid",      // 'valid' | 'invalid'
      "expectedMessageKey": "customer.telephoneRequired", // optional; resolves to constants.ts
      "priority": "P0",                 // optional
      "tags": ["negative", "required"], // optional
      "notes": "optional"
    }
  ]
}
```

`Schemas/validation-case.schema.json` mirrors this for editor tooling. The runtime validator is the lightweight TypeScript in `validation-dataset.ts` (no heavy schema dependency added).

## expectedMessageKey usage

A dotted key `"<group>.<messageName>"` resolves to an existing constant via `resolveExpectedMessage()` in `utils/test-data-loader.ts`. Groups registered: `login, product, customer, supplier, userProfile, companyProfile, customerAdvance, bankInformation, customerGroup, supplierGroup, productGroup, masterItemGroup, masterSupplierGroup, uom, businessType, paymentType, overHead, api`. **Never copy message text into JSON.** If a message is not yet centralized, omit the key, tag the row `needs-runtime-verification`, and document it — do **not** invent the text or change application source.

## Runtime generator usage

For values that must be unique/dynamic, use a typed token instead of a static value — never executable JS, never `eval`:

```jsonc
{ "generator": "uniqueCode", "arg": "CUSTOMER" }
{ "generator": "randomData.phone11Digit" }
{ "generator": "randomData.int", "min": 1, "max": 100 }
```

Resolved by `resolveInput()` against `utils/random-data.ts`. Allowed generators: `uniqueCode, randomData.code, randomData.name, randomData.email, randomData.phone11Digit, randomData.int`.

## Security rules — NEVER store here

Passwords, auth tokens, cookies, API keys, production DB credentials, real customer-sensitive data, or any production secret. Password-type cases use **harmless synthetic** values only. Authentication secrets stay in `.env` (git-ignored). Datasets are safe to commit.

## Adding a dataset

1. Create `DB/TestData/<Area>/<module>.validation.json` following the contract.
2. Reference existing message constants via `expectedMessageKey`; if a group isn't registered, add one line to `MESSAGE_GROUPS` in `test-data-loader.ts` (still no copied text).
3. Keep unproven length/boundary limits out — tag `needs-runtime-verification`.
4. `npx tsc --noEmit` and run the framework proof test (`tests/framework/_test-data-loader.spec.ts`).

## Loading a dataset

```ts
import { loadValidationDataset, resolveExpectedMessage, resolveInput } from '../../utils/test-data-loader';
const ds = loadValidationDataset('Masters/customer.validation.json');
for (const c of ds.cases) {
  const value = resolveInput(c.input);
  const msg = c.expectedMessageKey ? resolveExpectedMessage(c.expectedMessageKey) : undefined;
  // ... driven by the field-validation runner in Phase 7 (not built yet)
}
```

## What stays in `.env`

`BASE_URL`, `API_BASE_URL`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`, timeouts, concurrency. Credentials are never duplicated into datasets.

## DMS policy

`DMS FOUND = OPEN ISSUE`, `DMS FIX NOW = NO`, current action `USE AS-IS`. `/DMS/...` routes used by Page Objects remain functional and are not renamed/replaced/removed. Datasets contain no DMS routes (they hold field inputs only).

## API dependency rule

A verified remote POS `API_BASE_URL` is not yet available. Duplicate/business-rule cases tagged `needs-api` require it and remain `BLOCKED — VERIFIED POS API BASE URL REQUIRED`. Do not guess a URL or derive one from the UI port.

## No application database changes

Nothing in this folder creates, migrates, seeds, or modifies any real application database object. It is automation test data only.
