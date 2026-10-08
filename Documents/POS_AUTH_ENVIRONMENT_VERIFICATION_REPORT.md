# POS — Authentication Environment Verification (read-only)

**Project:** Shampan POS · **Target UI:** http://103.231.239.122:8006/ · **Date:** 2026-10-07
**Task:** Narrow the auth blocker to the exact environment-side dependency. No source change, no password discovery/reset, no live DB, no credential guessing.

## Objective

Given the completed source analysis (automation login contract CORRECT; `dbName` not needed; identifier = `AspNetUsers.UserName`; verification = Identity `PasswordSignInAsync`), determine what environment-side fact remains unverified and hand it off precisely.

## Current Evidence (unchanged, confirmed)

Runtime: `INVALID_CREDENTIAL` — 302→/, no `.ASPXAUTH`, "Wrong user name or password!" (two methods, re-verified ×2 on 2026-10-07). Target UI reachable (200). Automation posts `UserName` + `Password` + empty hidden `dbName` — identical to a real browser.

## MVC Internal API Dependency

```text
MVC internal API base:   ConfigurationManager.AppSettings["baseUrl"]   (HttpRequestHelper.cs:27)
Configuration source:    ShampanPOSUI/Web.config  <appSettings> key "baseUrl"
Source-tree value:       https://localhost:7242/   (Web.config:42)  ← SOURCE value; the DEPLOYED :8006 server's value is NOT visible to this analysis and may differ
Auth endpoints called:
  1) POST {baseUrl}api/Auth/login      (token)    HttpRequestHelper.GetAuthentication -> CommonRepo.cs:19
  2) POST {baseUrl}api/UserLogin/SignIn (profile) CommonRepo.cs:21
Secret values:           REDACTED / NOT READ (no connection strings, tokens, or keys inspected/printed)
```

Two separate API-URL concepts (kept distinct, per STEP 3):
- **A. MVC app's own internal API target** = its deployed Web.config `baseUrl` (server-side; unknown value).
- **B. `automation/.env` `API_BASE_URL`** = still BLOCKED/unknown for the Automation's *own* direct API tests. **A and B are independent;** this task does not change B.

### Critical finding — the token step does NOT validate the password

`api/Auth/login` (`AuthController.cs:25-53`) returns a JWT whenever `Username`/`Password` are merely **non-empty** — it performs **no password check**. Therefore the real credential gate is **only** `PasswordSignInAsync` inside `api/UserLogin/SignIn` (`UserLoginController.cs:311`). The login failure is at the SignIn stage, not the token stage.

## Internal API Configuration

`AddIdentity<ApplicationUser, IdentityRole>().AddEntityFrameworkStores<ApplicationDbContext>().AddDefaultTokenProviders()` (`Program.cs:72-74`) — **registered with NO options** (the password/sign-in options block is commented out, `Program.cs:24-31`). So Identity runs on framework defaults.

## Reachability Result

```text
POS UI external reachability (automation host -> :8006):  VERIFIED (HTTP 200)
MVC server -> its configured internal API:                SERVER-TO-API REACHABILITY NOT PROVEN
```

The MVC server's internal call to its own `baseUrl` is a server-to-server call that cannot be observed or proven from the Automation host, and the deployed `baseUrl` value is unknown. The source value (`https://localhost:7242/`) is the MVC server's own localhost and is not meaningfully probeable from here. **No overclaim:** EXTERNAL REACHABILITY VERIFIED; SERVER-TO-API REACHABILITY NOT PROVEN. (No user enumeration, no password lists, no state change were attempted.)

## Identity Sign-In Requirements

| Setting | Status | Evidence |
|---|---|---|
| `SignIn.RequireConfirmedAccount` | VERIFIED DISABLED (framework default; not set) | `Program.cs:72` plain `AddIdentity` (no options); options block commented `:24-31` |
| `SignIn.RequireConfirmedEmail` | VERIFIED DISABLED (default; not set) | same |
| Lockout on this sign-in | NOT A FACTOR | `PasswordSignInAsync(..., lockoutOnFailure: false)` (`UserLoginController.cs:311`) |
| Password policy | framework default (unconfirmed email does NOT block sign-in by default) | `Program.cs:72` |

Conclusion: a **correct** username+password for an existing account should sign in; account-confirmation/lockout flags are unlikely to block it.

## Profile Mapping Requirements (post-credential)

After `PasswordSignInAsync` succeeds, `api/UserLogin/SignIn` additionally requires (`UserLoginController.cs:319-334`):
1. `_userManager.Users.SingleOrDefault(UserName == model.UserName)` returns a user (not null).
2. `UserProfileService.List(["U.UserName"],[UserName])` returns `Status == "Success"` with a non-null `DataVM` (a `UserProfileVM`) — i.e. the user must have a **profile row** that carries `CompanyId`/`BranchId`/names. If not → `"User profile not found"`, which the MVC remaps to the same generic message (`LoginController.cs:430-435`).

## Company / Branch Requirements

`CompanyId`/`CompanyName`/`BranchId`/`BranchName` come from that `UserProfileVM` (or Session fallback) and are written to claims + Session on success (`LoginController.cs:387-424`). They are **only knowable after a successful login** → remain `NOT VERIFIED` while auth fails. (`dbName`/tenant is resolved server-side via `DatabaseHelper`, not from the posted field, and is not part of the credential gate.)

## Generic Error Matrix (why one message = many causes)

| Stage | Condition | Backend outcome | MVC shows | External verification |
|---|---|---|---|---|
| Credential | wrong password / user not found | `SignIn` Status=Fail "Wrong username or password" (`UserLoginController.cs:313-317`) | "Wrong user name or password!" (else, `LoginController.cs:432`) | env owner: AspNetUsers row + password |
| Post sign-in | `_userManager.Users` null | "Wrong username or password" (`:347-351`) | same | env owner: `UserName=erp` exists? |
| Profile mapping | `UserProfileService.List` non-Success/null | "User profile not found" (`:327-331`) | same (remapped) | env owner: UserProfile/Company/Branch mapping |
| Connectivity | MVC→API unreachable | exception/no response | same (catch `LoginController.cs:439-446`) | devops: deployed `baseUrl` reachable from MVC host |
| Exception | `result.Data` null → NRE | exception at `LoginController.cs:368` | same (catch) | server logs (Elmah) |
| Success | valid creds + profile | Status=Success, token + profile (`:352-356`) | redirect `/Common/Home`, `.ASPXAUTH` set | automation re-run `npm run test:setup` |

## Root-Cause Confidence

```text
PROVEN:        Automation login contract is CORRECT (sends exactly what the live form posts).      [source + runtime]
PROVEN:        dbName is NOT part of the credential check.                                          [AuthController/UserLoginController]
PROVEN:        Token step (api/Auth/login) does not validate the password; the gate is SignIn.      [AuthController.cs:25-53]
LIKELY:        Identity account-confirmation/lockout flags are NOT blocking (framework defaults).    [Program.cs:72]

MOST LIKELY:   AUTH_CREDENTIAL_CONFIGURATION — `erp`+password not valid for an existing allowed account in this env.
POSSIBLE:      PROFILE_MAPPING_CONFIGURATION — user exists but lacks a UserProfile/Company/Branch mapping ("User profile not found").
POSSIBLE:      ENVIRONMENT_CONFIGURATION — deployed MVC `baseUrl` unreachable/misconfigured (same generic message via catch).
NOT SUPPORTED: AUTOMATION_AUTH_GAP · AUTH_DBNAME_CONFIGURATION · APPLICATION_AUTH_DEFECT (no defect proven; the generic message is intentional).
```

## Environment Owner Checklist (handoff)

Please verify on the target environment (`http://103.231.239.122:8006/`):

```text
Credential stage:
 1. Does an AspNetUsers record exist for UserName = erp (or what is the correct login name)?
 2. Is the supplied password valid for that account?
 3. Is the Identity account allowed to sign in (not disabled)?

Post-credential stage:
 4. Does the user have a valid UserProfile (UserProfileService.List returns Success)?
 5. Does the profile carry a valid CompanyId?
 6. Does it have valid branch/profile access (BranchId or a resolvable branch workflow)?

Environment stage:
 7. Can the deployed MVC app reach its configured authentication API (Web.config appSettings "baseUrl")?
```

Do **not** need: a `dbName` value, or any login-form company selection (the company `<select>` is commented out). Request these only if new source evidence contradicts the completed analysis.

## Recommended Automation Account

Ask the environment owner to provide a **dedicated Automation/QA login** (do not create it ourselves; no DB change):

```text
- a real AspNetUsers account (not a personal one)
- appropriate POS permissions for the modules under test
- a known Company mapping (CompanyId)
- known Branch access (BranchId / branch workflow)
- stable, non-production-personal credentials usable by CI
```

## Phase 8 Impact

Phase 8 remains **NOT STARTED / BLOCKED** on authentication (an environment credential/account fact, not an automation defect). DB-backed Customer cases (`CUS-GRP-002`, `CUS-DUP-001`) stay `BLOCKED_DB` additionally pending a verified read-only DB credential + the then-knowable CompanyId/BranchId.

## Source Safety

```text
POS Frontend Modified:             NO
POS Backend/API Modified:          NO
POS Database Modified:             NO (no SQL executed; schema read-only inspected)
Automation Code Modified:          NO
Automation Documentation Modified: YES (this report + plan blocker note)
SaleOrderController pre-existing change preserved: YES
```
