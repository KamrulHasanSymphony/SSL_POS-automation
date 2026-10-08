# POS — Field Validation Inventory, Gap Analysis & Data-Driven Readiness

**Project:** Shampan POS · **Target UI:** http://103.231.239.122:8006/ · **Date:** 2026-10-07
**Phase:** 4–6 evidence (Field Validation Inventory + Validation Gap Analysis + Data-Driven Readiness)
**Scope:** Automation project only — application source STRICTLY READ-ONLY. No tests changed/added this phase.

Method: static extraction from `utils/constants.ts` (`*FormSelectors` / `*ValidationMessages`), the page objects under `pages/**`, the specs under `tests/**`, and `playwright test --list` (343 tests / 86 files). Validation-type coverage measured by keyword frequency in discovered test titles. No runtime execution (auth is blocked — see baseline report).

---

## A. Validation coverage — measured signal (whole suite)

Discovered-title keyword frequency (existing coverage), and the systematic gaps (0 occurrences):

| Validation type | In test titles | Status |
|---|---:|---|
| Required | 30 | COVERED (broad) |
| Empty | 30 | COVERED (broad) |
| Invalid format | 14 | COVERED (email/phone/telephone/date) |
| Valid format | (implicit in positive) | PARTIAL |
| Duplicate | 9 | COVERED (API-backed, e.g. "Data Already Exist!") |
| Phone/Mobile | 7 | COVERED (partial) |
| Date / required-date | 11 | COVERED (partial) |
| Email | 2 | COVERED (partial) |
| Numeric / Zero / Range | 2 / 1 | THIN (CustomerAdvance range only) |
| Dropdown / Combobox required | 2 | THIN |
| Checkbox required | 2 | THIN (RoleMenu "select ≥1") |
| **Whitespace-only** | **0** | **GAP** |
| **Leading/Trailing whitespace (trim)** | **0** | **GAP** |
| **Min Length** | **0** | **GAP** |
| **Max Length** | **0** | **GAP** |
| **Boundary (min−1 / min / max / max+1)** | **0** | **GAP** |
| **Below Min / Above Max** | **0** | **GAP** |
| **Negative number** (explicit) | **0** | **GAP** |
| **Decimal precision** | **0** | **GAP** |
| **Special characters** | **0** | **GAP** |
| **Unicode / Bangla** | **0** | **GAP (high relevance — BD POS)** |
| **Radio** | **0** | **GAP (if any radio fields exist)** |
| **Conditional-required / dependent-field** (explicit) | **0** | **GAP** |

Tag distribution: `@p0` 111 · `@p1` 147 · `@p2` 61 · `@p3` 1 · `@smoke` 34 · `@regression` 310 · `@negative` 88 · `@security` 29 · `@known-defect` 21.

**Interpretation:** existing validation testing is strong on **Required / Empty / Invalid-Format / Duplicate** but has an almost complete absence of **length, boundary, whitespace, special-character, Unicode/Bangla, and numeric-boundary** cases. That is the core gap the later implementation phases target.

---

## B. Field Validation Inventory (per module)

Fields are the real input controls (validation-message/error-span/grid-container locators excluded). "Combo" = Kendo MultiColumnComboBox / searchable combobox (NOT a native `<select>` — must not use `selectOption()`). Existing-validation column reflects what the specs + `*ValidationMessages` currently assert.

### B.1 Masters (DMS area)

| Module | Form fields | Existing validation asserted |
|---|---|---|
| Product | Name, ProductGroupId(combo), UOMId(combo), ProductStock(create-only), VATRate, SDRate | Name required; group/UOM dropdown required (partial) |
| Customer | Name, CustomerGroupId(combo), TelephoneNo, Email, Address | Telephone required; email format; group required (JS) |
| Supplier | Name, SupplierGroupId(combo), Address | Name required; Address required |
| ProductGroup / CustomerGroup / SupplierGroup / MasterItemGroup / MasterSupplierGroup / UOM / BusinessType / PaymentType / OverHead | Name (OverHead: OverHead) | Name required (one case each) |
| TableSection | SectionName | required (generic visible) |
| TableInfo | TableNumber, SectionId(combo) | required (generic visible) |
| IncomeExpenseCategory | Name, Type(native select) | Name/Type required (toastr) |
| MasterSupplier | Name, MasterSupplierGroupId(combo), Address | Name required; Address required |
| MasterItem | Name, MasterItemGroupId(combo), UOMId(combo) | Name required |
| MasterSupplierItem | MasterSupplierId(combo), MasterItemGroupId(combo), item picker | Supplier required |
| SupplierProduct | SupplierId(combo), ProductGroupId(combo), item picker | Supplier required |
| MasterItemProduct / MasterSupplierProduct | item picker only | "Add at least one detail." |
| Area | Name (location cascade **broken** in app — create blocked) | Name required only |
| FiscalYear | Year(native select), YearStart, YearEnd | none ([Required]-free VM) |
| BranchProfile / BranchCreate | DistributorCode, Name, TelephoneNo | Name required; telephone required + format |
| CustomerAdvance | AdvanceAmount(range>0), PaymentEnumTypeId(combo) | AdvanceAmount range (>0) |
| Income / Expense | TransactionDate, Comments, category picker | TransactionDate required |

### B.2 Transactions (DMS area)

| Module | Form fields | Existing validation asserted |
|---|---|---|
| Purchase | SupplierId(combo), InvoiceDateTime, PurchaseDate, BENumber, + line-item grid | Supplier required; BE/date (partial) |
| PurchaseOrder | SupplierId(combo), OrderDate, DeliveryDateTime, + grid | OrderDate required |
| PurchaseReturn | PurchaseDate, InvoiceDateTime, SupplierId(combo), BENumber, + grid | partial |
| Sale | CustomerId(combo), InvoiceDateTime, payment grid, + line-item grid | Customer required (partial) |
| SaleOrder | CustomerId(combo), OrderDate, DeliveryDate, + grid | OrderDate required |
| SaleReturn | CustomerId(combo), InvoiceDateTime, + grid | partial |

### B.3 Banking

| Module | Form fields | Existing validation asserted |
|---|---|---|
| BankInformation | Name, TelephoneNo | Name required; Telephone required |
| BankAccount | AccountNo, AccountName, BankId(combo), BranchName | partial |
| Deposit | FromBankAccountId(combo), ToBankAccountId(combo), TransactionDate, ChequeDate, TotalDepositAmount | TransactionDate required; account required (generic) |
| Withdrawal | FromBankAccountId(combo), ToBankAccountId(combo), TransactionDate, ChequeDate, TotalDepositAmount | TransactionDate required |
| Collection | CustomerId(combo), TransactionDate, details grid, TotalCollectAmount | required (generic); API due-amount rule |
| Payment | SupplierId(combo), TransactionDate, details grid, TotalPaymentAmount | required (generic); API due-amount rule |

### B.4 SetUp

| Module | Form fields | Existing validation asserted |
|---|---|---|
| CompanyProfile / CompanyCreate | CompanyName, CompanyLegalName, TelephoneNo, Email, FYearStart, FYearEnd | CompanyName required |
| Role | Name | Name required |
| RoleMenu | select-all checkbox (≥1 required) | "Please Select CheckBox First!" |
| UserProfile | UserName, FullName, Password, ConfirmPassword, Email, PhoneNumber, RoleId(optional combo) | Phone format (`^\d{11}$`); email format |
| Registration | FullName, EmailAsLoginId, PhoneNumber, Password, ConfirmPassword, CompanyName, CompanyAddress | CompanyName required |
| SignUp | UserName, FullName, Email, Password, ConfirmPassword, PhoneNumber | email format; phone (class-only, no msg span) |
| UserBranchProfile | multiBranch select2 (modal) | none (no [Required] fields) |
| Settings | SettingValue (per-row singleton; includes an app **"DMSApiUrl"** row) | none (edit-only) |

### B.5 Auth

| Module | Form fields | Existing validation asserted |
|---|---|---|
| Login | dbName(hidden), UserName, Password, RememberMe | UserName required; Password required; invalid-credentials; password-visibility toggle |

---

## C. Validation Gap Analysis

### C.1 Cross-cutting gaps (apply to nearly every text/numeric field)

These validation types are **essentially absent** suite-wide and should be added systematically in the implementation phases:

1. **Length** — Min Length, Max Length (and max+1 overflow) on every free-text field (Name, Address, Code, Comments, AccountName, etc.).
2. **Boundary** — for numeric fields (AdvanceAmount, VATRate, SDRate, TotalAmount, quantities/prices in line-item grids): below-min, min, max, above-max, zero, negative, decimal precision.
3. **Whitespace** — whitespace-only input, and leading/trailing-whitespace trimming behaviour.
4. **Special characters & injection-shaped input** — `< > " ' & / \ %`, SQL/script-like strings (negative/robustness; distinct from the dedicated VAPT security specs).
5. **Unicode / Bangla** — high relevance for a Bangladesh POS; currently 0 coverage. Name/Address fields likely must accept Bangla; verify acceptance + round-trip persistence.
6. **Format depth** — email (more invalid shapes), phone/telephone (length/prefix boundary), date (invalid/past/future, FY ordering).
7. **Conditional/dependent** — e.g. ConfirmPassword must equal Password (UserProfile/Registration/SignUp); From/To bank accounts must differ (Deposit/Withdrawal); category/detail-line dependencies.

### C.2 Per-field validation obligations the app actually enforces (confirmed from `*ValidationMessages`)

Already-known exact messages that make high-confidence negative targets (positive = currently tested; others = to add): Product `Product Name is required.`; Customer `Telephone No. is required.` / `Invalid email format`; Supplier `Name is required.` / `Address is required.`; BankInformation `Name is required.` / `Telephone No is required.`; CustomerAdvance `Advance Amount must be greater than zero.`; UserProfile `Please enter a valid 11-digit phone number.` / `Please enter a valid email address.`; Registration `Company Name is required.`; Role `The Role Name field is required.`; CompanyProfile `The Company Name field is required.`; duplicate `Data Already Exist!`; Collection/Payment `… cannot be greater than due.`.

### C.3 Known application constraints that bound what can be tested (do NOT work around by changing the app)

- **Area** create is blocked by a broken location cascade (`/Common/Common/GetAreaLocationList` 404 in the app) → length/boundary tests for Area create are **BLOCKED (application defect)**, not an automation gap.
- Several dropdown error spans have **id collisions** in app markup (`#titleError1/2` reused) — selectors already compensate via `:nth-match`.
- Duplicate `#Name` on BranchProfile/Area/BranchCreate (HiddenFor + TextBoxFor) — handled via `.last()`.
- `FiscalYear`, `TableSection/Info`, `UserBranchProfile` have no `[Required]` fields → fewer validation obligations.

---

## D. Data-Driven Readiness Analysis

### D.1 Current data sources

| Source | Role | Data-driven? |
|---|---|---|
| `utils/random-data.ts` (`uniqueCode`, `randomData.{code,name,email,phone11Digit,int}`) | Runtime-unique values for create/CRUD | Generator (good), not dataset-driven |
| `utils/constants.ts` `*ValidationMessages` | Expected messages (centralized) | **Yes — already externalized & reusable** |
| `utils/test-data-setup.ts` (API creators) | Prerequisite entity creation via API | API-backed (needs POS API URL) |
| Inline literals in spec files | Specific invalid inputs for negative cases | **No — hard-coded in tests** |
| `test-data/` | — | **Empty (.gitkeep only)** |
| `automation/DB/TestData/` | — | **Does not exist yet** |

### D.2 Readiness verdict

- **Good foundations:** expected messages are already centralized (half of a data-driven validation model), unique-value generation is centralized, and the POM + fixtures are clean to plug a dataset layer into.
- **Gap:** the *input* side of validation cases is inline in specs; there is no structured dataset store. There is no `automation/DB/TestData/` yet.
- **Target structure (to build in Phase 6, NOT now):** `automation/DB/TestData/<module>.validation.json` with rows of `{ field, caseType, input, expectedResult, expectedMessageKey }`, where `expectedMessageKey` references the existing `*ValidationMessages` entries so messages stay single-sourced. A small table-driven runner (Phase 7) iterates rows against the existing Page Objects — no POM rewrite.
- **Migration principle:** externalize validation *inputs* and reusable datasets; keep unique-identifier generation dynamic (`uniqueCode`) so parallel runs never collide; never hard-code seed/business data.

### D.3 Migration candidates (planning only — no migration this phase)

Highest-value first: Customer, Product, Supplier, UserProfile, Registration, CompanyProfile, CustomerAdvance, BankInformation (rich field sets + known messages) → then the flat lookup-masters (single Name field, uniform length/whitespace/special-char dataset) → then transaction headers.

---

## E. Blockers affecting this inventory

- **AUTH_BLOCKER** — UI auth blocked (invalid credentials); no runtime re-verification of messages was possible this phase. Inventory is from source/specs, which the project confirmed against app source historically.
- **API_BLOCKER** — no verified remote POS API URL; duplicate/due-amount and API-backed setup cases cannot execute.
- **DMS_OPEN_ISSUE** — `/DMS/...` routes (and the app's own `DMSApiUrl` setting row surfaced by the Settings module) remain FUNCTIONAL, USE-AS-IS, OPEN pending developer.

No application source was modified; `git status` shows only the untracked `automation/` folder and the pre-existing (not-mine) `SaleOrderController.js`.
