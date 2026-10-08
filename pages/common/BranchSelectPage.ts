import { Page } from '@playwright/test';
import { branchSelectSelectors, routes } from '../../utils/constants';

/**
 * Conditional branch-selection flow. REWRITTEN at STEP 4 after reading the
 * actual current source (Areas/Common/Views/Home/Index.cshtml,
 * Content/js/app/Controllers/DashController.js, HomeController.cs) — the
 * original STEP 1-era guess (a distinct "branch picker page" with a
 * clickable button) was wrong on every specific detail. Confirmed real
 * behavior:
 *
 * - There is no separate page. `Common/Home/Index` always renders the same
 *   dashboard view. `DashController.init(count)` runs on load, where `count`
 *   is 0 whenever the server-side session has no `CurrentBranch` yet
 *   (including immediately after every fresh login, and whenever the
 *   "Change Branch" link is used — see routes.changeBranch).
 * - When count === 0, the page calls `GET /Common/Home/LoadBranchProfiles`.
 *   - If the account has exactly one active branch, the response is
 *     `{ autoAssigned: true, redirectUrl }` and the page does a full
 *     `window.location.href` navigation — no modal ever appears.
 *   - Otherwise the response is `{ data: [...] }` and the `#branchProfiles`
 *     Bootstrap modal is shown, populated with one row per branch inside
 *     `#tbdBranchProfiles`.
 * - Selecting a branch is a **double-click** on any `<td>` in that row (not
 *   a button) — this submits a hidden form (POST /Common/Home/AssignBranch)
 *   and the browser navigates to the dashboard again.
 */
export class BranchSelectPage {
  constructor(private readonly page: Page) {}

  /**
   * True if the branch-picker modal is currently visible. Callers should
   * generally prefer `resolveIfPresent()`, which also handles the
   * auto-redirect (no-modal) case correctly.
   */
  async isShowing(): Promise<boolean> {
    return this.page
      .locator(branchSelectSelectors.modal)
      .isVisible()
      .catch(() => false);
  }

  /** Row texts currently populated in the branch picker table. */
  async listBranchNames(): Promise<string[]> {
    const rows = this.page.locator(`${branchSelectSelectors.tableBody} tr`);
    const count = await rows.count();
    const names: string[] = [];
    for (let i = 0; i < count; i += 1) {
      const nameCell = rows.nth(i).locator('td').nth(1);
      names.push(((await nameCell.textContent()) ?? '').trim());
    }
    return names;
  }

  /**
   * Double-clicks the row matching the given branch name (or the first row
   * if no name is given) — confirmed real interaction per DashController.js,
   * not a button click.
   */
  async selectBranch(branchName?: string): Promise<void> {
    const rows = this.page.locator(`${branchSelectSelectors.tableBody} tr`);
    const row = branchName ? rows.filter({ hasText: branchName }).first() : rows.first();
    await row.locator('td').first().dblclick();
  }

  /**
   * Call immediately after a fresh login (or after navigating to
   * routes.changeBranch). Handles all three confirmed real outcomes without
   * assuming which one will occur:
   *   1. Single active branch → silent auto-redirect, modal never appears.
   *   2. Multiple active branches → modal appears; selects the given branch
   *      (or the first available one) and waits for the resulting page
   *      reload to settle.
   *   3. Branch already assigned this session (count !== 0) → no AJAX call
   *      is even made; nothing to resolve.
   *
   * STEP 34/35 FIX: outcome 1's "silent auto-redirect" is client-side JS
   * (`window.location.href` to a URL that itself performs
   * `POST /Common/Home/AssignBranch`) — proven at STEP 34 to be the one
   * request that grants the `.ASPXAUTH` cookie. The previous implementation
   * only waited for the modal and, on timeout, assumed that unawaited
   * auto-redirect had already finished — a race that could return before
   * `.ASPXAUTH` was actually set (reproduced live at STEP 34). This now
   * races the modal's visibility directly against the `AssignBranch`
   * response itself, so outcome 1 only returns once that response has
   * genuinely been observed, not merely once the modal-wait timed out.
   * `.ASPXAUTH`'s own presence in `context.cookies()` is checked first, in
   * case `AssignBranch` already completed before this method was even
   * called — avoiding an unnecessary full `timeoutMs` wait in that case.
   */
  async resolveIfPresent(
    branchName?: string,
    timeoutMs = 8000
  ): Promise<'auto-resolved' | 'selected' | 'already-assigned'> {
    const alreadyAuthenticated = (await this.page.context().cookies()).some((c) => c.name === '.ASPXAUTH');
    if (alreadyAuthenticated) {
      return 'already-assigned';
    }

    const modal = this.page.locator(branchSelectSelectors.modal);
    const modalVisible = modal.waitFor({ state: 'visible', timeout: timeoutMs }).then(() => 'modal' as const);
    const assignBranchSeen = this.page
      .waitForResponse((response) => response.url().includes('/Common/Home/AssignBranch'), { timeout: timeoutMs })
      .then(() => 'assigned' as const);

    const winner = await Promise.race([modalVisible, assignBranchSeen]).catch(() => 'neither' as const);

    if (winner === 'modal') {
      await this.selectBranch(branchName);
      await modal.waitFor({ state: 'hidden', timeout: timeoutMs }).catch(() => undefined);
      await this.page.waitForURL(new RegExp(routes.dashboard.replace(/\//g, '\\/')), { timeout: timeoutMs });
      return 'selected';
    }

    if (winner === 'assigned') {
      await this.page.waitForURL(new RegExp(routes.dashboard.replace(/\//g, '\\/')), { timeout: timeoutMs });
      return 'auto-resolved';
    }

    return 'already-assigned';
  }
}
