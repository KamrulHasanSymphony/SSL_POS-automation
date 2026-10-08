/**
 * Canonical tag vocabulary for this project, matching STEP 2's tagging model
 * plus the STEP 3 final-review corrections. Use these constants in test
 * titles (Playwright tags are embedded in the test title as @tag, e.g.
 * test('AUTH-001 valid login @smoke @p0', ...)) instead of retyping literal
 * strings, so a typo can't silently drop a test out of a suite.
 */
export const tags = {
  smoke: '@smoke',
  sanity: '@sanity',
  regression: '@regression',
  negative: '@negative',
  security: '@security',
  /**
   * Marks a security test that currently asserts the SECURE expected
   * behavior against a confirmed, source-code-verified application gap
   * (STEP 2 section 2 / STEP 3 correction 5). A @known-defect test failing
   * is the correct, desired signal — it must never be "fixed" by weakening
   * the assertion to match current (insecure) behavior. Excluded from the
   * default @smoke/@sanity/@regression grep patterns below by design, so a
   * confirmed open vulnerability never silently breaks the functional
   * build gate; it is reported through its own explicit suite instead.
   */
  knownDefect: '@known-defect',
  /**
   * Marks infrastructure/framework-validation tests (e.g.
   * tests/smoke/_framework-scaffold.spec.ts) that are NOT part of the
   * STEP 2-approved 267-test business coverage count. Excluded from the
   * default @smoke/@sanity/@regression/@security grep patterns below.
   */
  frameworkOnly: '@framework-only',
  p0: '@p0',
  p1: '@p1',
  p2: '@p2',
  p3: '@p3',
} as const;

/** All four priority tags — every planned business test must carry exactly
 * one of these, including P3 (there is no "unpriority" default). */
export const priorityTags = [tags.p0, tags.p1, tags.p2, tags.p3] as const;

/**
 * Grep patterns for package.json scripts / CI invocation, kept here so the
 * suite-composition rules live in one place instead of being re-derived from
 * memory in ad hoc `--grep` flags.
 *
 * `exclude` is meant to be passed to Playwright's `--grep-invert` alongside
 * the matching `include` pattern passed to `--grep`, e.g.:
 *   playwright test --grep "@smoke" --grep-invert "@known-defect|@framework-only"
 */
export const suitePatterns = {
  smoke: { include: tags.smoke, exclude: `${tags.knownDefect}|${tags.frameworkOnly}` },
  sanity: { include: tags.sanity, exclude: `${tags.knownDefect}|${tags.frameworkOnly}` },
  regression: { include: tags.regression, exclude: `${tags.knownDefect}|${tags.frameworkOnly}` },
  /** Security tests run as their own explicit suite (tests/ui/security) —
   * never silently folded into smoke/regression pass/fail counts. */
  security: { include: tags.security, exclude: tags.frameworkOnly },
  /** Opt-in only — known-open-vulnerability assertions, run and reported separately. */
  knownDefects: { include: tags.knownDefect, exclude: tags.frameworkOnly },
} as const;

/**
 * STEP 2 §2-confirmed candidates for @known-defect (assert secure behavior,
 * currently expected to fail against the live application until fixed).
 * Kept here as a single reference point so STEP 4/5 test authors tag these
 * consistently instead of re-deriving the list from the STEP 2 document.
 * Update this list only alongside an explicit STEP 2 revision, per the
 * test-count-protection rule in README.md.
 */
export const knownDefectCandidateIds = [
  'SEC-002', // BranchCreateController reachable without auth
  'SEC-003', // MasterSupplierProductController reachable without auth
  'SEC-004', // ReplaceReceiveController reachable without auth
  'SEC-005', // menu-restricted-but-authenticated user bypasses restriction via direct URL
  'ROLE-007', // same finding, cross-checked from the Role/Menu module
  'SEC-006', // unprotected API controllers reachable without a bearer token
  'SRET-006', // SaleReturn Delete route resolves to List logic instead of deleting
] as const;
