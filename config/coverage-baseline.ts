/**
 * Approved business automation coverage baseline, from the FINAL APPROVED
 * STEP 2: SQA Automation Coverage Plan. This is the single source of truth
 * for "how many tests are we building" — do not let this number drift
 * silently as STEP 4/5 implementation proceeds.
 *
 * RULE (STEP 3 final-review correction 6): 267 is the approved count.
 * Infrastructure/setup/scaffold-validation tests (fixtures/auth.setup.ts,
 * tests/smoke/_framework-scaffold.spec.ts, and anything tagged
 * @framework-only) are explicitly NOT part of this count. Any new or removed
 * business test case during implementation must be documented — in the PR/
 * commit description and, if the change is structural, as an update to this
 * file with a stated reason — not silently added or dropped.
 */
export const approvedCoverageBaseline = {
  totalTestCases: 267,
  byPhase: {
    phase1P0Modules: 139,
    phase2P1Modules: 70,
    phase3P2P3Modules: 58,
  },
  byPriority: {
    p0: 62,
    p1: 103,
    p2AndP3: 102,
  },
  bySuite: {
    /** Subsets of the 267 total, not additive — a test can carry more than one tag. */
    smoke: 15,
    sanity: 23,
    security: 11,
  },
  /** STEP 2 §2-confirmed count of tests expected to assert secure behavior
   * against a currently-unfixed application gap — see config/tags.ts's
   * knownDefectCandidateIds for the specific IDs. */
  knownDefectCandidates: 7,
  source: 'FINAL APPROVED STEP 2: SQA Automation Coverage Plan',
  lastRevised: '2026-08-10',
} as const;
