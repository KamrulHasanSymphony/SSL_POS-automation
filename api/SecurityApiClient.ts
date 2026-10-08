import { APIRequestContext, APIResponse, request as playwrightRequest } from '@playwright/test';
import { env } from '../utils/env';

/**
 * API-SECURITY-LIFECYCLE dedicated, minimal raw-HTTP helper.
 *
 * Deliberately NOT built on top of `utils/api-helper.ts`'s `ApiClient`: that
 * class only ever sends the exact token IT captured internally (private
 * `token` field, no raw getter, no caller-supplied header override) — the
 * right design for its own stated purpose (prerequisite setup/cleanup via
 * `utils/test-data-setup.ts`), but insufficient for a spec that must
 * deliberately send NO token, a garbage token, and a real token side-by-side
 * against the same endpoint, and must read the real JWT string back rather
 * than only a success/fail signal. Scoped to `automation/api/*` per this
 * task's own file-scope rule — `utils/api-helper.ts` itself is not touched.
 */
export class SecurityApiClient {
  private constructor(private readonly context: APIRequestContext) {}

  static async create(): Promise<SecurityApiClient> {
    if (!env.apiBaseUrl) {
      throw new Error('API_BASE_URL is not configured — copy .env.example to .env and set it.');
    }
    const context = await playwrightRequest.newContext({ baseURL: env.apiBaseUrl, ignoreHTTPSErrors: true });
    return new SecurityApiClient(context);
  }

  /**
   * Real login via the SAME endpoint the MVC UI itself uses end-to-end
   * (`ShampanPOSUI/Controllers/LoginController.cs` -> `CommonRepo.
   * SignInAuthentication` -> `api/UserLogin/SignIn`; matches
   * `utils/api-helper.ts`'s own `ApiClient.authenticate()` finding) —
   * confirmed from source (`UserLoginController.SignIn`) to perform a REAL
   * credential check via ASP.NET Identity's own
   * `SignInManager.PasswordSignInAsync`, unlike the separate, parallel
   * `api/Auth/login` endpoint (see the spec's own class doc comment for
   * that confirmed-broken endpoint — not used here). Returns the raw JWT
   * string (`ResultVM.Data.token`, confirmed lowercase field name on the
   * C# `AuthModel` class `UserLoginController.GetAccessToken()` returns),
   * not merely a success/fail signal, so callers can replay it with
   * deliberately modified Authorization headers.
   */
  async login(username: string, password: string): Promise<{ status: number; token: string | null; body: any }> {
    const response = await this.context.post('/api/UserLogin/SignIn', {
      data: { UserName: username, Password: password },
    });
    const body = await response.json().catch(() => null);
    const data = body?.Data ?? body?.data ?? null;
    const token = data?.token ?? data?.Token ?? null;
    return { status: response.status(), token, body };
  }

  /** Raw call with a caller-chosen Authorization header — `token: null` sends no header at all. */
  async request(method: 'get' | 'post', path: string, token: string | null, data?: unknown): Promise<APIResponse> {
    const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
    return method === 'get' ? this.context.get(path, { headers }) : this.context.post(path, { data: data ?? {}, headers });
  }

  async dispose(): Promise<void> {
    await this.context.dispose();
  }
}

/**
 * Decodes a JWT's payload segment WITHOUT verifying its signature — used
 * only to inspect which claims the server itself chose to embed (e.g.
 * confirming no "role" claim exists anywhere in a real, server-issued
 * token), never to construct or accept a token on that basis. Returns `{}`
 * if `token` isn't a 3-segment JWT shape at all (e.g. the deliberately
 * malformed strings this spec's own negative-path tests send).
 */
export function decodeJwtPayloadUnverified(token: string): Record<string, unknown> {
  const parts = token.split('.');
  if (parts.length !== 3) return {};
  try {
    const payloadSegment = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = payloadSegment.padEnd(payloadSegment.length + ((4 - (payloadSegment.length % 4)) % 4), '=');
    const json = Buffer.from(padded, 'base64').toString('utf-8');
    return JSON.parse(json);
  } catch {
    return {};
  }
}
