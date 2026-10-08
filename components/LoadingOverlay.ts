import { Page } from '@playwright/test';

/**
 * The app wires a global loading overlay (gasparesganga-jquery-loading-overlay)
 * to jQuery's ajaxStart/ajaxComplete/ajaxError events (confirmed in STEP 1 §G).
 * Waiting for this overlay to disappear is the application-specific
 * synchronization point for "an AJAX call just finished" — use this instead
 * of page.waitForTimeout() wherever a Save/Post/grid-load triggers an AJAX call.
 *
 * The exact overlay element/class was not independently re-confirmed against
 * live-rendered DOM (app not run in this environment yet) — the selector below
 * targets the library's documented default class. Confirm and adjust against
 * the live app on first real usage; do not assume it is exact until then.
 */
const OVERLAY_SELECTOR = '.loadingoverlay, .overlay-loading, [class*="loadingoverlay"]';

export class LoadingOverlay {
  constructor(private readonly page: Page) {}

  /**
   * Waits for any in-flight AJAX-triggered overlay to appear and then
   * disappear. Tolerant of the overlay never appearing at all (some actions
   * complete faster than Playwright's poll interval).
   */
  async waitForIdle(timeoutMs = 15000): Promise<void> {
    const overlay = this.page.locator(OVERLAY_SELECTOR).first();
    try {
      await overlay.waitFor({ state: 'visible', timeout: 1000 });
    } catch {
      // Overlay may never have appeared — that's fine, nothing to wait out.
      return;
    }
    await overlay.waitFor({ state: 'hidden', timeout: timeoutMs });
  }
}
