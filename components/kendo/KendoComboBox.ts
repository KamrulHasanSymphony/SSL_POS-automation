import { Page } from '@playwright/test';

/**
 * Kendo UI ComboBox — the dominant dropdown widget in this app (confirmed
 * STEP 1 §G: kendoComboBox on most Create/Edit forms, e.g. SupplierId on
 * PurchaseOrder/Create, ProductGroupId on Product/Create).
 *
 * Kendo transforms the original <input id="{fieldId}"> in place: the bound
 * input becomes hidden and Kendo renders a visible text input plus a
 * dropdown-arrow trigger inside a wrapping span, following Kendo's documented
 * ARIA pattern (role="combobox" on the visible input, role="listbox"/"option"
 * on the popup list). This uses that ARIA contract (accessible-role locators,
 * priority 3 per the STEP 3 locator strategy) rather than guessing Kendo's
 * internal CSS class names, which have changed across Kendo versions.
 *
 * NOT independently re-confirmed against this app's live rendered DOM (app
 * not run in this environment); if the ARIA attributes are absent in the
 * deployed Kendo version, fall back to the documented `.k-input-inner` /
 * `.k-list-container` class selectors noted inline below.
 *
 * LIVE DOM VERIFICATION RULE (see README.md): before using this component in
 * the first real automation test, verify these selectors against the live
 * rendered page and adjust here — not with a one-off workaround in the test.
 */
export class KendoComboBox {
  constructor(private readonly page: Page, private readonly fieldId: string) {}

  private visibleInput() {
    // Preferred: ARIA role. Fallback (uncomment if the deployed Kendo version
    // lacks ARIA roles): this.page.locator(`#${this.fieldId}`).locator('..').locator('.k-input-inner')
    return this.page.getByRole('combobox', { name: new RegExp(this.fieldId, 'i') })
      .or(this.page.locator(`input#${this.fieldId}, input[aria-owns*="${this.fieldId}"]`))
      .first();
  }

  async open(): Promise<void> {
    await this.visibleInput().click();
  }

  async selectByText(text: string): Promise<void> {
    await this.open();
    await this.page.getByRole('option', { name: text, exact: false }).first().click();
  }

  /**
   * COLLECTION-INVOICE-PICKER-INVESTIGATION E2E FINDING: confirmed live
   * (network + DOM capture on CollectionPage's own CustomerId combo) that
   * clicking the page's first `option` role — with no name filter — races
   * Kendo's own async, debounced re-filter of the popup list against the
   * just-typed `query`: `fill()` returns as soon as the input's value is
   * set, well before the filtered AJAX response re-renders the option
   * list, so `.first()` can (and did) grab a stale, unrelated option left
   * over from the widget's initial/previous render — confirmed: selected
   * "Maria Electric" (an unrelated pre-existing customer) instead of the
   * just-typed unique `AUTO_CUSTOMER_...` name, silently pointing every
   * following step at the wrong record. Scoping the option lookup to
   * `query` — the same name-filtered pattern `selectByText()` already uses
   * successfully above — makes Playwright's own auto-waiting wait for an
   * option actually matching what was typed to render, instead of
   * whichever option happens to be first at click time.
   */
  /**
   * BANKACCOUNT-COMBO-INVESTIGATION E2E FINDING: `timeoutMs` is optional and
   * defaults to Playwright's own configured action timeout (unchanged
   * behavior for every other caller) — added specifically because BankId's
   * combo (`GetBankIdComboBox()`, BankAccountController.js) confirmed live
   * to have NO real server- or client-side filtering despite declaring
   * `filter: "contains"`: typing does not reduce the rendered option count
   * at all, so every selection here renders its FULL, ever-growing
   * BankInformations table as unfiltered `<li>` options (180+ and rising
   * in this shared environment) before the target option can be found and
   * clicked — confirmed correct and successful given enough time (live
   * diagnostic: `#BankId` resolved correctly), just occasionally slower
   * than the default action timeout under normal load. Every other combo
   * in this app (Customer, Product Group, UOM, ...) filters its list for
   * real, so their `typeAndSelectFirst()` calls stay fast and are
   * unaffected by leaving `timeoutMs` unset.
   */
  /**
   * SALE-RETURN-LIFECYCLE E2E FINDING: confirmed live (CollectionPage's own
   * CustomerId combo) that, contrary to this class's own prior "every other
   * combo... filters its list for real" assumption, CustomerId does NOT
   * filter server- or client-side either — a freshly-typed, unique
   * `AUTO_CUSTOMER_...` name still resolved to a `data-offset-index` in the
   * 200s (this shared environment's full, ever-growing Customer table),
   * the same confirmed "no real filtering" shape already documented above
   * for BankId, just not previously known to extend to Customer. Two
   * distinct, compounding symptoms confirmed from that same evidence:
   * (1) a stray `<div aria-hidden="true" class="k-animation-container">` —
   * a transient leftover from Kendo's own popup open/re-filter fade
   * animation — can intercept the click even once the option is genuinely
   * "visible, enabled, stable" (same "real, valid, momentarily-covered
   * control" shape already fixed for `PurchaseReturnPage.createFromPurchase()`'s
   * own radio-button click — bypassed here via `force: true`); (2) with the
   * option that far down a virtualized list, a single scroll-then-click
   * can still land mid-render with the option's absolutely-positioned node
   * not yet inside the popup's own scrollable viewport at all (confirmed
   * live: `locator.click: Element is outside of the viewport`, immediately
   * after Playwright's own "done scrolling" log) — retried below (scroll,
   * then click, a few times) rather than assuming one scroll always
   * suffices, since Kendo's own virtual-list re-render needs a moment to
   * catch up.
   */
  async typeAndSelectFirst(query: string, timeoutMs?: number): Promise<void> {
    await this.visibleInput().fill(query);
    const option = this.page.getByRole('option', { name: query, exact: false }).first();
    await option.waitFor({ state: 'visible', timeout: timeoutMs });

    const attemptTimeout = timeoutMs ?? 5000;
    let lastError: unknown;
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        await option.scrollIntoViewIfNeeded({ timeout: attemptTimeout });
        await option.click({ force: true, timeout: attemptTimeout });
        return;
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError;
  }

  /**
   * PURCHASE-LIFECYCLE E2E LIVE RUNTIME FINDING: confirmed live (Product
   * Group / UOM combos on Product/Edit) that `.inputValue()` on the matched
   * element can return an empty string even though the combo's selected
   * text is clearly visible/accessible (confirmed via accessibility
   * snapshot: `combobox "Product Group": AUTO_PRODGROUP_...`) — the
   * ARIA-role match can land on a display element whose value lives in its
   * visible text, not a form `value` attribute. Falls back to `.textContent()`
   * only when `.inputValue()` is empty; `open()`/`selectByText()`/
   * `typeAndSelectFirst()` above are unaffected by this change.
   */
  async getSelectedText(): Promise<string> {
    const viaInputValue = (await this.visibleInput().inputValue().catch(() => '')) ?? '';
    if (viaInputValue) return viaInputValue;
    return ((await this.visibleInput().textContent().catch(() => '')) ?? '').trim();
  }

  /**
   * DATA-INTEGRITY-LIFECYCLE addition — non-throwing counterpart to
   * `typeAndSelectFirst()`: types `query` and reports whether any matching
   * option ever appeared, instead of waiting/erroring when it doesn't. Used
   * to prove a structural property this app's combo-driven forms have for
   * free (not a validation rule written anywhere): every SupplierId/
   * CustomerId/ProductId field a transaction Create screen submits is only
   * ever populated by clicking a REAL option this exact widget rendered
   * from the server's own Dropdown() data — there is no way to type/submit
   * an arbitrary, nonexistent id through this control, unlike a raw API
   * request. Every existing caller (`typeAndSelectFirst()`, `selectByText()`)
   * is unaffected by this addition.
   */
  /**
   * PERFORMANCE-STABILIZATION-LIFECYCLE addition — sub-phase-timed sibling
   * of `typeAndSelectFirst()` above. Purely additive: duplicates that
   * method's exact same fill/wait/scroll-click sequence (unchanged
   * behavior, same locators, same retry shape) but returns three
   * independently-measured checkpoints instead of void, so a caller can
   * report "Search"/"Dropdown Render"/"Selection" as the distinct
   * sub-metrics this task's own Phase 2 asks for — without instrumenting
   * (or otherwise changing the behavior of) `typeAndSelectFirst()` itself,
   * which every other existing test in this project already depends on
   * unchanged. `timeoutMs` defaults exactly like `typeAndSelectFirst()`.
   */
  async typeAndSelectFirstTimed(
    query: string,
    timeoutMs?: number
  ): Promise<{ fillMs: number; renderMs: number; selectMs: number; totalMs: number }> {
    const t0 = Date.now();
    await this.visibleInput().fill(query);
    const t1 = Date.now();

    const option = this.page.getByRole('option', { name: query, exact: false }).first();
    await option.waitFor({ state: 'visible', timeout: timeoutMs });
    const t2 = Date.now();

    const attemptTimeout = timeoutMs ?? 5000;
    let lastError: unknown;
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        await option.scrollIntoViewIfNeeded({ timeout: attemptTimeout });
        await option.click({ force: true, timeout: attemptTimeout });
        const t3 = Date.now();
        return { fillMs: t1 - t0, renderMs: t2 - t1, selectMs: t3 - t2, totalMs: t3 - t0 };
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError;
  }

  async hasMatchingOption(query: string, timeoutMs = 5000): Promise<boolean> {
    await this.visibleInput().fill(query);
    const option = this.page.getByRole('option', { name: query, exact: false }).first();
    return option
      .waitFor({ state: 'visible', timeout: timeoutMs })
      .then(() => true)
      .catch(() => false);
  }
}
