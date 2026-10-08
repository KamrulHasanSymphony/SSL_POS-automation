# POS — Authentication Source Analysis (read-only root-cause)

**Project:** Shampan POS · **Target UI:** http://103.231.239.122:8006/ · **Date:** 2026-10-07
**Task:** READ-ONLY investigation of the application's real auth requirements. No app/DB change; no live DB; no credential/`dbName` guessing.

## Objective

Explain, from source, why login returns `INVALID_CREDENTIAL` ("Wrong user name or password!", 302→/, no `.ASPXAUTH`) and state exactly what external input is missing. Every conclusion is backed by a source citation.

## Source Files Inspected (read-only)

- `SSL_POS/ShampanPOSUI/Controllers/LoginController.cs` (MVC login)
- `SSL_POS/ShampanPOS.Models/LoginResource.cs` (login ViewModel)
- `SSL_POS/ShampanPOSUI/Views/Login/Index.cshtml` (login view + JS)
- `SSL_POS/ShampanPOS.Repo/CommonRepo.cs` (`SignInAuthentication`)
- `SSL_POS/ShampanPOS.Repo/Configuration/HttpRequestHelper.cs` (API base URL + token call)
- `SSL_POS_Api/ShampanPOS/Controllers/UserLoginController.cs` (API `SignIn`, `GetAccessToken`)
- `SSL_POS_Api/ShampanPOS.Repository/*` (AspNetUsers / `DatabaseHelper.AuthDbName()` / `GetConnectionString()`)

## Login Entry Point

- Active POST: `LoginController.Index(LoginResource model)` — `LoginController.cs:349-448`. (An older `xxxIndex` at `:127` is dead.)
- View: `Views/Login/Index.cshtml` — `Html.BeginForm("Index","Login",FormMethod.Post)` (`:476`), `#UserName` (`:503`), `#Password` (`:518`), hidden `dbName` (`:481`). The `<select id="CompanyId">` is **commented out** (`:542-552`); the only JS is the password-visibility toggle (`:588-596`). **No JS populates `dbName`.**

## Login POST Flow (evidence-based)

```text
Browser POST / (UserName, Password, dbName="", returnUrl)
  └─ LoginController.Index  (LoginController.cs:350)
       └─ CommonRepo.SignInAuthentication(model)  (CommonRepo.cs:14)
            ├─ HttpRequestHelper.GetAuthentication(UserName,Password) → JWT token   (CommonRepo.cs:19)   [server→API]
            └─ POST api/UserLogin/SignIn (serialized model)                         (CommonRepo.cs:21)   [server→API]
                 └─ UserLoginController.SignIn(LoginResourceVM)  (UserLoginController.cs:306)
                      ├─ _signInManager.PasswordSignInAsync(UserName,Password,false,false)  (:311)
                      │     └─ !Succeeded → Status "Fail", "Wrong username or password"      (:313-317)
                      ├─ _userManager.Users.SingleOrDefault(UserName==…)                     (:319)
                      │     └─ null → "Wrong username or password"                            (:347-351)
                      ├─ UserProfileService.List(["U.UserName"],[UserName])                   (:325)
                      │     └─ non-Success/DataVM null → "User profile not found"             (:327-331)
                      └─ success → Status "Success", Data=JWT, DataVM=UserProfileVM(CompanyId/BranchId/…)  (:352-356)
  ← back in MVC Index:
       result.Data.ToString() (NRE if Data null)  (LoginController.cs:368)
       result.Status=="Success" → build ClaimsIdentity + OWIN SignIn + Session, redirect /Common/Home  (:374-426)
       else → TempData["ErrorMessage"]="Wrong user name or password!" → redirect /  (:430-435)
       catch(any) → TempData["ErrorMessage"]="Wrong user name or password!" → redirect /  (:439-446)
```

## Username Semantics

```text
Login identifier expected:        AspNetUsers.UserName  (ASP.NET Core Identity)
Field compared:                   _signInManager.PasswordSignInAsync(model.UserName,…) + _userManager.Users ... UserName == model.UserName  (UserLoginController.cs:311,319)
Case sensitivity:                 case-insensitive by Identity default (NormalizedUserName); not overridden in source read
Normalization:                    Identity normalizer (upper-invariant). LoginResource had a letters-only regex but it is COMMENTED OUT (LoginResource.cs:19) — no format restriction enforced.
```

## Password Verification

ASP.NET **Core Identity** `PasswordSignInAsync` (`UserLoginController.cs:311`) → Identity password **hash** (PBKDF2) in `AspNetUsers.PasswordHash`. **Not** plaintext, not a custom SP. Client-side min length 6 (`LoginResource.cs:22-23`). No password value/hash/key/secret was read or printed; no cracking/recovery attempted.

## dbName Resolution

```text
dbName required for the LOGIN CREDENTIAL check:  NO  (not referenced in the SignIn credential path)
Current login form sends:                        hidden dbName, EMPTY (Index.cshtml:481); no JS sets it
Empty dbName behavior (credential step):         accepted — PasswordSignInAsync ignores dbName
dbName role:                                     post-auth tenant/business-DB selection for company/branch data; resolved SERVER-SIDE (config/session via DatabaseHelper), CONDITIONAL/UNKNOWN exact mechanism — NOT the credential check
```

`dbName` exists on `LoginResource` (`:32`) and `DbConfig.cs`/`SessionClass.DBName`, but the Identity credential check does not consume it. **dbName is therefore not the cause of the current failure.** Do not invent a `dbName`.

## Tenant / Database Selection

Two logical databases (SQL Server): an **auth DB** holding `AspNetUsers` (`[{DatabaseHelper.AuthDbName()}].[dbo].AspNetUsers`, e.g. `UserProfileRepository.cs:637`) and a **business DB** (`DatabaseHelper.DBName()` / `GetConnectionString()`, used across repositories). Both resolved server-side from the API's own configuration/session — **not** from the posted `dbName` for the credential check.

```text
Connection strategy:       server-side config/session-driven (DatabaseHelper.GetConnectionString()/AuthDbName())
Database selected using:    API configuration + session (not the posted dbName at credential time)
Credential secret values:   NOT READ / REDACTED (no connection strings or secrets inspected or printed)
```

## Invalid-Credential Message Conditions (all proven causes)

The single UI string "Wrong user name or password!" can mean **any** of:
1. `PasswordSignInAsync` not succeeded — user not found, **wrong password**, lockout, or not-allowed (`UserLoginController.cs:313`).
2. `_userManager.Users` lookup returns null (`:347-351`).
3. `UserProfileService.List` returns non-Success / null DataVM → "User profile not found" — i.e. **user exists but has no company/branch/profile mapping** (`:327-331`), remapped by MVC to the generic message.
4. **Any exception** in `LoginController.Index` — including the backend API being unreachable **from the MVC server**, `result.Data` null → NRE at `LoginController.cs:368`, or JSON deserialize error — caught at `:439-446` and shown as the same message.

The generic message deliberately hides which of these occurred.

## User Status Rules

`PasswordSignInAsync(...false,false)` → `lockoutOnFailure=false`. The account-creation path sets `EmailConfirmed=false, LockoutEnabled=false` (`UserLoginController.cs:132`). If this Identity instance is configured with `SignIn.RequireConfirmedAccount/Email=true`, sign-in returns **NotAllowed** → failure — a *candidate* contributing cause (Identity options file not read; not asserted). No `IsActive/IsArchive` business flag gates the Identity credential step (those gate business rows, not AspNetUsers login).

## Company Selection Flow

No pre-login company screen is active (the login company `<select>` is commented out, `Index.cshtml:542-552`). Company is established **after** a successful password sign-in, from the `UserProfileVM` returned by `UserProfileService.List` (`UserLoginController.cs:325,356`) → `CompanyId/CompanyName` set as claims + Session (`LoginController.cs:401-420`), with Session fallback.

## Branch Selection Flow

Also **after** login: `BranchId/BranchName` come from the same `UserProfileVM` or Session (`LoginController.cs:387-394,405-424`). When the session has no current branch, the dashboard shows the branch modal (`BranchSelectPage` territory — double-click a row → `/Common/Home/AssignBranch`). `BranchId` is persisted in claims + Session. (Note the commented-out `GetDefaultBranchId` mapping at `UserLoginController.cs:340-343`.)

## Claims / Session State (post-success)

`ClaimsIdentity` + `Session` both receive: `UserId`/`UserName` (= model.UserName), `CompanyId`, `CompanyName`, `BranchId`, `BranchName` (`LoginController.cs:397-424`); OWIN cookie sign-in (`:409-410`) issues the `.ASPXAUTH` ticket. **CompanyId/BranchId are only knowable after a successful login** — which is why they remain NOT VERIFIED while auth fails.

## Stored Procedure / Repository Evidence

Credential check uses Identity (`UserManager`/`SignInManager`) against `AspNetUsers` — not a bespoke login SP. `sp_GetCustomerList.sql` and the Customer repositories (inspected earlier) are business-data, unrelated to login. No SQL executed; nothing modified.

## Automation vs Application Login Contract (STEP 17)

| Required login input (credential step) | Source | Automation sends it? |
|---|---|---|
| UserName (`#UserName`) | `Index.cshtml:503` | YES (`LoginPage.fillUsername`) |
| Password (`#Password`) | `Index.cshtml:518` | YES (`LoginPage.fillPassword`) |
| hidden `dbName` (empty) | `Index.cshtml:481` | YES (left empty — matches a real browser; credential path ignores it) |
| CompanyId `<select>` | **commented out** | N/A (not on the live form) |

```text
Does Automation send all required login inputs?  YES
AUTOMATION AUTH FLOW:                              CORRECT
Remaining issue:                                   ENVIRONMENT CREDENTIAL / TENANT CONFIGURATION
```

The automation posts exactly what a real browser posts. There is **no AUTOMATION_AUTH_GAP** (no required non-secret field, including `dbName`, is missing from automation).

## Root Cause Classification

```text
PRIMARY:   AUTH_CREDENTIAL_CONFIGURATION
           The configured UserName (`erp`) + Password are not accepted by Identity in this deployment
           (user absent in this environment's AspNetUsers, wrong password, or account not-allowed).
POSSIBLE:  ENVIRONMENT_CONFIGURATION
           (a) MVC server's own internal API base URL/token call failing (would surface as the same
               generic message via the catch), or (b) Identity RequireConfirmedAccount blocking sign-in,
           or (c) user exists but has no company/branch/profile mapping ("User profile not found").
NOT:       AUTOMATION_AUTH_GAP (automation sends all inputs), AUTH_DBNAME_CONFIGURATION (dbName not used
           in the credential path), APPLICATION_AUTH_DEFECT (no defect proven — the generic message is
           intentional, if unhelpful).
```

### Identifier format check (STEP 14)

```text
Configured value format:              erp
Expected identifier format (source):  AspNetUsers.UserName (free-form; letters-only regex is commented out)
Structurally compatible:              YES  (does NOT imply the account exists or the password is correct)
```

## Required External Inputs (from the environment owner)

```text
Required:
 - valid AspNetUsers UserName for this deployment (confirm whether it is `erp` or a different login name)
 - valid Password for that user
 - confirmation the account is active / allowed to sign in (not blocked by RequireConfirmedAccount)
 - confirmation the user has a company/branch/profile mapping (so UserProfileService.List returns Success)

NOT required for the credential step:
 - dbName / tenant value (empty is accepted by PasswordSignInAsync; tenant DB is resolved server-side)
 - a login-form company selection (the company <select> is commented out)
```

Once a valid credential logs in, capture `CompanyId`/`BranchId` from the authenticated claims/session/`UserProfileVM` (runtime evidence) — never guessed.

## Phase 8 Impact

Phase 8 stays **NOT STARTED / BLOCKED** on authentication. The automation framework and login flow are correct; only valid environment credentials are missing. DB-backed Customer cases (`CUS-GRP-002`, `CUS-DUP-001`) remain `BLOCKED_DB` additionally pending a verified read-only DB credential + the then-knowable CompanyId/BranchId scope.

## Source Safety

```text
POS Frontend Modified:                 NO
POS Backend/API Modified:              NO
POS Database Modified:                 NO (no SQL executed; schema read-only inspected)
Automation Code Modified:              NO
Automation Documentation Modified:     YES (this report + plan blocker note)
SaleOrderController pre-existing change preserved: YES
```
