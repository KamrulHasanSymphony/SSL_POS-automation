import { test, expect } from '../../fixtures/auth.fixture';
import { tags, priorityTags } from '../../config/tags';
import { uniqueCode } from '../../utils/random-data';
import { LoginPage } from '../../pages/auth/LoginPage';
import { KendoGrid } from '../../components/common-grid/KendoGrid';

/**
 * SCAFFOLD VALIDATION ONLY — not one of the STEP 2-approved 267 business
 * test cases (see README.md "Test Count Protection"). Every test title below
 * carries @framework-only precisely so it is mechanically excluded from the
 * @smoke/@sanity/@regression/@security grep patterns in package.json, not
 * just excluded by convention/naming. Exists solely to prove the framework
 * wires together end-to-end: TypeScript compiles across the
 * fixture/page-object/component/config layers, and Playwright can discover
 * and run tests under tests/. Delete or replace this file once real smoke
 * tests (STEP 2, AUTH-001 etc.) are implemented in a later step.
 *
 * Uses static top-level imports only — an earlier draft used dynamic
 * `await import(...)` inside test bodies, which failed at runtime under
 * Playwright's CommonJS-targeted transform with "SyntaxError: Cannot use
 * import statement outside a module" (confirmed by an actual STEP 3.1
 * validation run, project=framework). Static imports are also simply the
 * correct choice here — there was never a lazy-loading reason for dynamic
 * import in the first place.
 */
test.describe('framework scaffold', () => {
  test('random-data and constants utilities are wired correctly @framework-only', async () => {
    const code = uniqueCode('SCAFFOLD');
    expect(code).toMatch(/^AUTO_SCAFFOLD_\d{14}_[0-9a-f]{4}$/);
  });

  test('page objects and components instantiate without runtime error @framework-only', async ({ page }) => {
    const loginPage = new LoginPage(page);
    const grid = new KendoGrid(page, '#GridDataList');
    expect(loginPage).toBeTruthy();
    expect(grid).toBeTruthy();
  });

  test('canonical tag config exposes all four priority tags including @p3 @framework-only', async () => {
    expect(tags.p0).toBe('@p0');
    expect(tags.p1).toBe('@p1');
    expect(tags.p2).toBe('@p2');
    expect(tags.p3).toBe('@p3');
    expect(priorityTags).toContain('@p3');
    expect(tags.knownDefect).toBe('@known-defect');
    expect(tags.frameworkOnly).toBe('@framework-only');
  });
});
