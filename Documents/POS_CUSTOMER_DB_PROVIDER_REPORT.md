# POS — Customer DB-Driven Data Provider Report

**Project:** Shampan POS · **Target UI:** http://103.231.239.122:8006/ · **Date:** 2026-10-07
**Scope:** Automation project only. Application source & DB schema STRICTLY READ-ONLY / UNCHANGED.

## Objective

Make Customer *existing/reference* data come from the verified POS database (read-only), while Customer *validation scenarios* stay in JSON — without any DB write and without guessing schema or credentials.

```text
WHAT TO TEST                      = DB/TestData/Masters/customer.validation.json
WHICH REAL CUSTOMER / GROUP       = POS database (read-only provider)
HOW TO INTERACT                   = existing Customer Page Object
HOW TO ASSERT                     = validation framework (Phase 7)
DATABASE WRITE                    = NEVER from the DB provider
```

## Verified schema (read-only source inspection — not guessed)

SQL Server. Evidence: `ShampanPOS_Api/ShampanPOS.Repository/CustomerRepository.cs` + `CustomerGroupRepository.cs` + `DB Master/sp_GetCustomerList.sql`.

- `Customers` — Id (PK, IDENTITY), Code, Name, BanglaName, CustomerGroupId, **CompanyId, BranchId**, Address, BanglaAddress, TelephoneNo, FaxNo, Email, TINNo, BINNo, NIDNo, Comments, **IsArchive, IsActive**, CreatedFrom/By/On, …
- `CustomerGroups` — Id (PK), Code, Name, **CompanyId, BranchId**, Description, Comments, IsArchive, IsActive.
- Active record = `IsActive = 1 AND IsArchive = 0` (Delete sets `IsArchive=1, IsActive=0`).
- Tenant scope = **CompanyId AND BranchId** — every query must filter by the authenticated company/branch.

## What was built (Automation only — all additions)

| File | Role |
|---|---|
| `data-providers/db-safety.ts` | `assertReadOnlySql()` (SELECT/CTE only; rejects INSERT/UPDATE/DELETE/MERGE/TRUNCATE/DROP/ALTER/CREATE/EXEC + statement stacking) and `assertDbConfigReady()` (requires `DB_SERVER/DB_DATABASE/DB_USERNAME/DB_PASSWORD` + `DB_READONLY=true`; never logs the password). |
| `data-providers/customer-db-provider.ts` | `CustomerDbRecord`/`CustomerGroupDbRecord` types, `CustomerDataProvider`/`CustomerGroupDataProvider` intent interfaces, verified SELECT-only query templates (CompanyId/BranchId-scoped, parameters bound — never concatenated; validated by `assertReadOnlySql` at load), `FakeCustomer*DataProvider` for tests, and `createCustomerDbProvider()` which **refuses to connect (BLOCKED)**. |
| `data-providers/input-source-resolver.ts` | `resolveInputSource()` / `resolveCaseInput()` — typed allow-list dispatch to providers. **No SQL here;** the generic runner stays DB-agnostic. |
| `utils/validation-dataset.ts` (extended) | `DatabaseInputSource` type + `DB_PROVIDER_METHODS` allow-list + `describeInputSourceProblem()`; `assertValidDataset()` now rejects raw `{ "sql": … }` and unknown provider/method. |
| `DB/TestData/Masters/customer.validation.json` (extended) | Added `CUS-GRP-002` (valid CustomerGroup via DB) and `CUS-DUP-001` (duplicate name via DB) using `inputSource` — no hard-coded IDs/names. |
| `tests/framework/_customer-db-provider.spec.ts` | 9 framework-only tests (no DB/UI/auth/API). |

## Separation of concerns

```text
Validation Dataset -> resolveCaseInput() -> { literal | generator | DB provider } -> value
DB Provider (data) · Validation Runner (execution) · Page Object (UI) · Dataset (scenario)
```

Raw SQL lives only in `customer-db-provider.ts`. JSON may select only from a typed provider/method allow-list — no SQL, no `eval`.

## Safety verification

- **Read-only guard:** proven for all shipped query templates; every write/DDL keyword and statement-stacking attempt is rejected (tested).
- **Config guard:** refuses incomplete config or a non-read-only credential; password never logged.
- **No DB write path** exists in the provider. CREATE/duplicate tests use the UI (duplicate name is *read* from DB, then re-entered via UI).
- **DB-read records need no cleanup;** UI/API-created records use the existing cleanup strategy.

## Status — LIVE DB INTEGRATION BLOCKED

```text
BLOCKED — CUSTOMER DB QUERY SCOPE REQUIRES VERIFIED COMPANY/BRANCH
```

Reasons: (1) no read-only DB config in `automation/.env`; (2) no SQL driver installed; (3) company/branch scope needs verified authentication (currently blocked). The interface, typing, guards, query templates and a fake-provider unit test are delivered; the concrete SQL-Server provider is wired only once a verified read-only credential **and** the authenticated scope are available. Nothing was connected to an unknown DB; no credentials/schema were guessed.

## Verification

```text
npx tsc --noEmit            -> exit 0
npx playwright test --list  -> 363 tests in 88 files (was 354/87; +9 framework tests, the DB proof spec)
Framework proof specs       -> 20 passed (11 loader + 9 DB), 0 failed
Existing tests removed      -> 0
```

## Source-code safety

```text
POS Frontend Modified:   NO
POS Backend/API Modified: NO
POS Database Modified:    NO (schema read-only inspected, never altered; no SQL executed)
Automation Project Modified: YES (additions under automation/ only)
Pre-existing SaleOrderController.js change: PRESERVED (untouched)
```

## Recommended next

Clear the two blockers (valid UI credentials → company/branch scope; verified **read-only** DB login in `.env`), then implement the concrete SQL-Server `CustomerDataProvider` (add an `mssql` dev-dependency at that point) behind the existing interface, and build the Phase 7 validation runner that consumes datasets + `resolveCaseInput()`.
