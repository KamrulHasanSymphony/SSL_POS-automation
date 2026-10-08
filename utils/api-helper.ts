import { APIRequestContext, request as playwrightRequest } from '@playwright/test';
import { env } from './env';
import { createLogger } from './logger';

const logger = createLogger('api-helper');

/**
 * STEP 16A: reads `key` off `obj` trying both the PascalCase name as
 * declared on the backend's C# ViewModel (e.g. "CompanyId") and its
 * camelCase equivalent (e.g. "companyId") — ASP.NET Core's default
 * System.Text.Json naming policy camelCases every response property, but
 * nothing here should have to assume one casing over the other. Returns
 * undefined if `obj` is nullish or the key isn't present under either
 * casing.
 */
function readProp(obj: unknown, key: string): any {
  if (obj === null || typeof obj !== 'object') return undefined;
  const camelKey = key.length > 0 ? key[0].toLowerCase() + key.slice(1) : key;
  const record = obj as Record<string, unknown>;
  if (key in record) return record[key];
  if (camelKey in record) return record[camelKey];
  return undefined;
}

/**
 * Thin wrapper around Playwright's APIRequestContext, scoped to the backend
 * Web API (ShampanPOS) base URL.
 *
 * PER THE API SETUP RULE (STEP 2 §3 / STEP 3 §4):
 * This helper exists ONLY for test prerequisite setup, cleanup, independent
 * API-specific verification, or faster fixture creation of a module that is
 * NOT the module currently under test. It must never be used to perform the
 * primary action a UI test is meant to validate.
 */
export class ApiClient {
  private companyId: number | null = null;

  private constructor(private readonly context: APIRequestContext, private token: string | null) {}

  static async create(): Promise<ApiClient> {
    if (!env.apiBaseUrl) {
      throw new Error('API_BASE_URL is not configured — copy .env.example to .env and set it.');
    }
    const context = await playwrightRequest.newContext({
      baseURL: env.apiBaseUrl,
      ignoreHTTPSErrors: true,
    });
    return new ApiClient(context, null);
  }

  /**
   * Authenticates against the endpoint the MVC app itself uses
   * (confirmed in STEP 1: POST api/UserLogin/SignIn — NOT api/Auth/login,
   * which the UI does not call). Stores the returned token for subsequent
   * requests to [Authorize]-protected API controllers.
   *
   * STEP 16 ROOT CAUSE: ShampanPOS_Api's ResultVM is a plain C# class
   * (Status/Data/DataVM, PascalCase), but ASP.NET Core serializes it with
   * System.Text.Json's default CamelCase naming policy (Program.cs never
   * overrides it) — confirmed by a live call to /api/UserLogin/SignIn,
   * whose actual response uses `status`/`data`/`dataVM`/`dataVM.companyId`,
   * all camelCase. The PascalCase-only lookups below therefore always
   * resolved to undefined for `Status` and `DataVM.CompanyId` regardless of
   * the real (correct) values the backend was returning. `readProp` checks
   * both casings for every field pulled from this response so the parsing
   * is correct however a given deployment happens to be configured.
   */
  async authenticate(username: string, password: string): Promise<void> {
    const response = await this.context.post('/api/UserLogin/SignIn', {
      data: { UserName: username, Password: password },
    });
    if (!response.ok()) {
      throw new Error(`API authentication failed: ${response.status()} ${await response.text()}`);
    }
    const body = await response.json();
    const status = readProp(body, 'Status');
    if (status && status !== 'Success') {
      throw new Error(`API authentication failed: SignIn returned Status="${status}" (${readProp(body, 'Message') ?? 'no message'})`);
    }
    const data = readProp(body, 'Data');
    const dataVM = readProp(body, 'DataVM');
    this.token = readProp(data, 'token') ?? readProp(data, 'Token') ?? readProp(body, 'token') ?? readProp(body, 'Token') ?? null;
    this.companyId = readProp(dataVM, 'CompanyId') ?? null;
    if (!this.token) {
      logger.warn('SignIn succeeded but no token field was found in the response body', body);
    }
  }

  /**
   * CompanyId of the authenticated user (from the SignIn response's
   * DataVM), for scoping API-created prerequisite records to the same
   * company the authenticated UI session operates in. Null until
   * authenticate() has been called and succeeded.
   */
  getCompanyId(): number | null {
    return this.companyId;
  }

  private authHeaders(): Record<string, string> {
    return this.token ? { Authorization: `Bearer ${this.token}` } : {};
  }

  async get(path: string) {
    return this.context.get(path, { headers: this.authHeaders() });
  }

  async post(path: string, data: unknown) {
    return this.context.post(path, { data, headers: this.authHeaders() });
  }

  async dispose(): Promise<void> {
    await this.context.dispose();
  }
}
