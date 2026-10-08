import { Page, expect } from '@playwright/test';
import { LoadingOverlay } from '../../components/LoadingOverlay';
import { Toastr } from '../../components/notification/Toastr';
import { ConfirmDialog } from '../../components/modal/ConfirmDialog';
import { commonFormSelectors } from '../../utils/constants';

/**
 * Shared behavior for the standard CRUD form pattern used by nearly every
 * DMS/SetUp module (confirmed STEP 1 §C): single #frmEntry form, common
 * Save/Update/New/Post button classes, audit panel toggle. Module-specific
 * page objects should extend this rather than re-implementing the pattern.
 */
export class BasePage {
  readonly overlay: LoadingOverlay;
  readonly toastr: Toastr;
  readonly confirmDialog: ConfirmDialog;

  constructor(protected readonly page: Page) {
    this.overlay = new LoadingOverlay(page);
    this.toastr = new Toastr(page);
    this.confirmDialog = new ConfirmDialog(page);
  }

  /**
   * STEP 5 LIVE DOM CORRECTION (two issues fixed together, both hit on the
   * very first real Save/Update call this project ever makes):
   *
   * 1. Product/Customer/Supplier's Create.cshtml (and, per the shared-layout
   *    pattern, every other module using this same form convention) renders
   *    TWO buttons matching `.btnsave.sslSave` / `.btnsave.sslUpdate` — one
   *    above the form, one below it, both bound to the same jQuery
   *    class-selector click handler. `.locator(...).click()` without
   *    narrowing throws a Playwright strict-mode violation ("resolved to 2
   *    elements"). `.first()` is correct, not a workaround: both buttons are
   *    functionally identical, so clicking either performs the same action.
   *
   * 2. Confirmed from source (e.g.
   * CustomerController.js's `.btnsave` click handler) that Save/Update only
   * show the Bootbox "Are you sure?" confirmation AFTER client-side
   * validation (`form.valid()` + CommonValidationHelper.CheckValidation)
   * already passes — `if (!mvcValid || !customValid) { return false; }` runs
   * first, and the dialog is never shown at all on a validation failure.
   * `acceptIfPresent()` handles both outcomes: a valid save shows and
   * accepts the dialog before the AJAX call fires; an invalid save never
   * shows one, so this is a no-op and the caller's own validation
   * assertions take over.
   */
  async clickSave(): Promise<void> {
    await this.page.locator(commonFormSelectors.saveButton).first().click();
    await this.confirmDialog.acceptIfPresent();
    await this.overlay.waitForIdle();
  }

  async clickUpdate(): Promise<void> {
    await this.page.locator(commonFormSelectors.updateButton).first().click();
    await this.confirmDialog.acceptIfPresent();
    await this.overlay.waitForIdle();
  }

  async clickNew(): Promise<void> {
    await this.page.locator(commonFormSelectors.newButton).first().click();
  }

  /**
   * STEP 6 LIVE DOM CORRECTION: confirmed from source (Purchase/PurchaseOrder/
   * PurchaseReturn/Sale/SaleOrder/SaleReturn's `.btnPost` click handlers) that
   * Post shows the same Bootbox "Are you sure? Do You Want to Post Data?"
   * confirmation as Save/Update before calling `MultiplePost` — same
   * acceptIfPresent() reasoning as clickSave()/clickUpdate() above. Also
   * confirmed `.btnPost.sslPost` renders twice (top+bottom) on every one of
   * the 6 transaction modules' Create views, same double-button pattern as
   * Save/Update — `.first()` for the same reason.
   */
  async clickPost(): Promise<void> {
    await this.page.locator(commonFormSelectors.postButton).first().click();
    await this.confirmDialog.acceptIfPresent();
    await this.overlay.waitForIdle();
  }

  /**
   * STEP 6 LIVE DOM CORRECTION: `.sslPush` ("Already Posted") also renders
   * twice (top+bottom) when the IsPost branch is active on the 6 transaction
   * modules, same as the other buttons — but unlike a `.click()` (which fails
   * loudly if `.first()` resolves to a non-actionable node), `.isVisible()`
   * on a plain `.first()` could silently report `false` if DOM order ever
   * put a non-live match first. Checks every match instead of assuming order.
   */
  async isAlreadyPosted(): Promise<boolean> {
    const matches = this.page.locator(commonFormSelectors.alreadyPostedIndicator);
    const count = await matches.count();
    for (let i = 0; i < count; i += 1) {
      if (await matches.nth(i).isVisible().catch(() => false)) {
        return true;
      }
    }
    return false;
  }

  async goBack(): Promise<void> {
    await this.page.locator(commonFormSelectors.backButton).click();
  }

  /**
   * AUDIT-TRAIL-LIFECYCLE E2E FINDING (first live exercise of this method
   * in this project — it existed but was never previously called by any
   * test): confirmed live that calling this immediately after
   * `clickUpdate()`/`clickSave()`/`clickPost()` can still race a lingering
   * Bootbox confirm dialog's own close animation — `acceptIfPresent()`
   * inside that prior action had already resolved, but the dialog's
   * `.bootbox.modal` was still mid-fade and intercepted this click. Same
   * `acceptIfPresent()` guard those other actions already use, applied
   * here too, rather than requiring every caller to add its own defensive
   * wait.
   */
  async showAuditPanel(): Promise<void> {
    await this.confirmDialog.acceptIfPresent();
    await this.page.locator(commonFormSelectors.auditToggle).click();
  }

  /**
   * AUDIT-TRAIL-LIFECYCLE addition — reads the Audit Details panel's own
   * six readonly fields, confirmed from source
   * (`Areas/DMS/Views/Purchase/Create.cshtml:648-660`, same pattern
   * confirmed on Product/Customer/Expense/Income's own Create.cshtml views):
   * `@Html.TextBoxFor(model => model.CreatedBy, ...)` etc render with the
   * bound property's own name as their `id` (standard MVC helper
   * behavior — the CSS classes shown alongside, e.g. `LastUpdateBy`/`lub`,
   * are NOT the element ids). Confirmed from `PurchaseController.Edit()`:
   * this panel is populated from the SAME row/repository call that backs
   * the record's own grid listing — there is no separate audit
   * table/endpoint behind it (see AUDIT-TRAIL-LIFECYCLE investigation) —
   * so this reads the record's own `CreatedBy`/`CreatedOn`/
   * `LastModifiedBy`/`LastModifiedOn`/`PostedBy`/`PostedOn` columns exactly
   * as persisted. `PostedBy`/`PostedOn` render empty string on modules that
   * don't have a Post workflow, or on any record not yet posted — callers
   * on such modules/states should expect empty results for those two
   * fields, not treat it as a failure to read.
   */
  async getAuditDetails(): Promise<{
    createdBy: string;
    createdOn: string;
    lastModifiedBy: string;
    lastModifiedOn: string;
    postedBy: string;
    postedOn: string;
  }> {
    const read = async (id: string): Promise<string> => (await this.page.locator(`#${id}`).inputValue().catch(() => '')) ?? '';
    return {
      createdBy: await read('CreatedBy'),
      createdOn: await read('CreatedOn'),
      lastModifiedBy: await read('LastModifiedBy'),
      lastModifiedOn: await read('LastModifiedOn'),
      postedBy: await read('PostedBy'),
      postedOn: await read('PostedOn'),
    };
  }

  /**
   * STEP 6 addition: every module built on this shared form pattern
   * (confirmed across Product/Customer/Supplier in STEP 5 and all six
   * transaction modules in STEP 6) renders a readonly, server-generated
   * `#Code` textbox that gets populated once a record is saved. Several
   * transaction modules (PurchaseOrder, SaleOrder) have no other
   * manually-set unique text field to search/re-open a record by, so
   * capturing this generated Code right after a successful save is the one
   * universally reliable identifier for a later grid search / edit lookup.
   */
  async getCode(): Promise<string> {
    return (await this.page.locator('#Code').inputValue()) ?? '';
  }

  /**
   * PURCHASE-LIFECYCLE E2E LIVE RUNTIME FINDING: several transaction modules
   * (confirmed live for PurchaseOrder; already-established for SaleOrder)
   * populate `#Code` via an in-place client-side update (`$("#Code").val(...)`,
   * `divSave`/`divUpdate` toggled) with NO page navigation at all — the
   * success toast can render-and-fade, or never render, before Playwright's
   * own `toastr.expectSuccess()` check runs, well before or after `#Code`
   * itself actually populates. Polling the one field the save is actually
   * trying to produce is a more durable signal than the toast for this
   * pattern; callers on modules that DO navigate after save (Product/
   * Customer/Supplier) already have their own, more specific
   * `page.waitForURL(...)` signal and don't need this.
   */
  async waitForCode(timeoutMs = 15000): Promise<string> {
    await expect.poll(async () => this.getCode(), { timeout: timeoutMs }).not.toBe('');
    return this.getCode();
  }

  /**
   * STEP 5 addition: several required-field validations in this app are
   * enforced by a Kendo-combo-specific check (`CommonService.validateDropdown`)
   * rather than standard jQuery Unobtrusive Validation, since Kendo replaces
   * the original bound <select>-equivalent input. The exact populated text
   * for these spans was not independently confirmed against a live render
   * for every field (unlike plain-text-input DataAnnotation messages, which
   * ARE confirmed exact strings) — so callers assert only that the indicator
   * becomes visible with non-empty text, per the same "assert state, not an
   * unconfirmed exact string" precedent already used by AUTH-005.
   */
  protected async expectRequiredIndicatorVisible(selector: string, timeoutMs = 10000): Promise<void> {
    await expect
      .poll(
        async () => {
          const el = this.page.locator(selector);
          const visible = await el.isVisible().catch(() => false);
          if (!visible) return false;
          const text = (await el.textContent().catch(() => '')) ?? '';
          return text.trim().length > 0;
        },
        { timeout: timeoutMs }
      )
      .toBe(true);
  }
}
