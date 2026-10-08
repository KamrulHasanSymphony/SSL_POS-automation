import { Page } from '@playwright/test';

/**
 * INVENTORY-LIFECYCLE E2E addition: this project has no existing
 * console/network monitoring helper anywhere (confirmed — no
 * `page.on('console'`/`page.on('pageerror'`/`page.on('requestfailed'`
 * usage exists outside one-off inline diagnostic code already removed from
 * prior work). Wraps Playwright's own standard page events; does not
 * duplicate or replace anything.
 *
 * Deliberately does NOT hard-fail on every console message or every failed
 * request by itself — a legacy jQuery/Kendo-heavy admin UI reliably emits
 * third-party noise (CDN latency, ad/analytics script failures) unrelated
 * to this application's own code, already documented elsewhere in this
 * project (the CKEditor CDN latency finding). Callers should assert against
 * `pageErrors` (uncaught JS exceptions — always a real defect) and a
 * same-origin-filtered view of `failedRequests`/`responses`, not the raw
 * arrays, to keep assertions evidence-based rather than flaky-by-noise.
 */
export interface NetworkDiagnostics {
  /** Uncaught JS exceptions (`page.on('pageerror')`) — always same-origin by construction, always a real defect if non-empty. */
  readonly pageErrors: string[];
  /** `console.error(...)` calls (`page.on('console')`, type `'error'`). */
  readonly consoleErrors: string[];
  /** Requests that failed at the network layer (`page.on('requestfailed')`) — DNS/abort/connection-reset, not HTTP error statuses. */
  readonly failedRequests: { url: string; method: string; failure: string }[];
  /** Every response observed (`page.on('response')`) — used to check HTTP status codes for specific save/report endpoints. */
  readonly responses: { url: string; status: number }[];
  /** Detaches all listeners. Call once diagnostics are no longer needed (end of test). */
  stop(): void;
}

export function captureNetworkDiagnostics(page: Page): NetworkDiagnostics {
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  const failedRequests: { url: string; method: string; failure: string }[] = [];
  const responses: { url: string; status: number }[] = [];

  const onPageError = (error: Error) => pageErrors.push(error.message);
  const onConsole = (msg: import('@playwright/test').ConsoleMessage) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  };
  const onRequestFailed = (request: import('@playwright/test').Request) =>
    failedRequests.push({
      url: request.url(),
      method: request.method(),
      failure: request.failure()?.errorText ?? 'unknown',
    });
  const onResponse = (response: import('@playwright/test').Response) =>
    responses.push({ url: response.url(), status: response.status() });

  page.on('pageerror', onPageError);
  page.on('console', onConsole);
  page.on('requestfailed', onRequestFailed);
  page.on('response', onResponse);

  return {
    pageErrors,
    consoleErrors,
    failedRequests,
    responses,
    stop() {
      page.off('pageerror', onPageError);
      page.off('console', onConsole);
      page.off('requestfailed', onRequestFailed);
      page.off('response', onResponse);
    },
  };
}

/** Filters a diagnostics array's URLs to the application's own origin (matching `page.url()`'s origin at call time) — excludes third-party CDN/analytics noise. */
export function sameOrigin(baseUrl: string, url: string): boolean {
  try {
    return new URL(url).origin === new URL(baseUrl).origin;
  } catch {
    return false;
  }
}

/**
 * INVENTORY-LIFECYCLE E2E FINDING: confirmed live (network trace) that a
 * multi-page-navigation flow reliably produces `net::ERR_ABORTED` entries in
 * `failedRequests` for the Dashboard's own background-widget AJAX calls
 * (`Home/GetTopProductsLast3MonthsTotalSale`, `Common/Home/
 * LoadBranchProfiles`, etc.) — fired on Dashboard load, then cancelled by
 * Chromium itself the moment the test navigates on to the next step, before
 * they resolve. This is standard browser behavior (`ERR_ABORTED` is
 * Chromium's own signal for "the browser cancelled this request," most
 * commonly via navigation), categorically different from a real
 * network/server failure (DNS error, connection reset, timeout, CORS
 * block) — not a defect in this application. Excluded here, in the shared
 * utility, rather than per-caller, since this is true of any multi-page-
 * navigation Playwright flow, not specific to one test.
 */
export function isRealNetworkFailure(failure: string): boolean {
  return failure !== 'net::ERR_ABORTED';
}
