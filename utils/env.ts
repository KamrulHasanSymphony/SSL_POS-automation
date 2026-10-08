import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

function optional(name: string, fallback: string): string {
  const value = process.env[name];
  return value && value.length > 0 ? value : fallback;
}

function required(name: string): string {
  const value = process.env[name];
  if (!value || value.length === 0) {
    // Intentionally not throwing at import time: config loading must succeed even
    // before real credentials/URLs are supplied (STEP 3 validates wiring, not values).
    // Individual tests/fixtures that truly need the value should assert on it themselves.
    return '';
  }
  return value;
}

export interface EnvConfig {
  baseUrl: string;
  apiBaseUrl: string;
  adminUsername: string;
  adminPassword: string;
  testUsername: string;
  testPassword: string;
  headless: boolean;
  actionTimeoutMs: number;
  navigationTimeoutMs: number;
}

export const env: EnvConfig = {
  baseUrl: required('BASE_URL'),
  apiBaseUrl: required('API_BASE_URL'),
  adminUsername: required('ADMIN_USERNAME'),
  adminPassword: required('ADMIN_PASSWORD'),
  testUsername: optional('TEST_USERNAME', ''),
  testPassword: optional('TEST_PASSWORD', ''),
  headless: optional('HEADLESS', 'true').toLowerCase() !== 'false',
  actionTimeoutMs: Number(optional('ACTION_TIMEOUT_MS', '15000')),
  navigationTimeoutMs: Number(optional('NAVIGATION_TIMEOUT_MS', '30000')),
};

/**
 * Call at the start of a test/fixture that cannot proceed without real
 * environment values (e.g. login). Fails fast with a clear message instead
 * of letting Playwright time out against an empty URL.
 *
 * Generic/low-level — prefer the named `assert*Ready()` helpers below for
 * the three standard scoping levels (STEP 4.1). Call this directly only for
 * a genuinely one-off combination that doesn't fit one of those three (e.g.
 * AUTH-003's "valid username as the baseline for a wrong-password mutation"
 * — baseUrl + adminUsername, deliberately NOT adminPassword).
 */
export function assertEnvReady(...keys: (keyof EnvConfig)[]): void {
  const missing = keys.filter((key) => env[key] === '' || env[key] === undefined);
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment configuration: ${missing.join(', ')}. ` +
        `Copy .env.example to .env and fill in real values before running this test.`
    );
  }
}

/**
 * Level A (STEP 4.1 §1): the application must be reachable, but no
 * credentials are needed — empty-field validation, anonymous-access checks,
 * UI-only interactions (e.g. password visibility toggle), invalid-username
 * negative tests using a locally generated username.
 */
export function assertBaseUrlReady(): void {
  assertEnvReady('baseUrl');
}

/**
 * Level B: a full, real login is required.
 */
export function assertAdminCredentialsReady(): void {
  assertEnvReady('baseUrl', 'adminUsername', 'adminPassword');
}

/**
 * Level D: a genuinely restricted/non-admin account is required (e.g. a
 * menu-restriction-bypass test) — not used by any of the 19 STEP 4 tests
 * today, defined here for the tests that will need it later.
 */
export function assertTestCredentialsReady(): void {
  assertEnvReady('baseUrl', 'testUsername', 'testPassword');
}
