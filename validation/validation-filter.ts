/**
 * Phase 7 — case filtering / execution planning. Pure functions over a dataset;
 * no IO, no DB, no Playwright. Lets a spec select exactly the cases it can run
 * (e.g. P0 only, excluding DB/API/runtime-verification cases while those are
 * blocked).
 */
import {
  FieldValidationCase,
  Priority,
  ValidationCaseType,
  ValidationDataset,
} from '../utils/validation-dataset';

/** A case is DB-dependent if it sources input from the DB or is tagged needs-db. */
export function isDbDependent(testCase: FieldValidationCase): boolean {
  return testCase.inputSource !== undefined || (testCase.tags?.includes('needs-db') ?? false);
}

/** A case is API-dependent if tagged needs-api (e.g. duplicate via API setup). */
export function isApiDependent(testCase: FieldValidationCase): boolean {
  return testCase.tags?.includes('needs-api') ?? false;
}

/** A case whose expectation is not source-proven and must be confirmed live. */
export function needsRuntimeVerification(testCase: FieldValidationCase): boolean {
  return testCase.tags?.includes('needs-runtime-verification') ?? false;
}

export interface FilterOptions {
  priorities?: Priority[];
  caseTypes?: ValidationCaseType[];
  fields?: string[];
  /** Require ALL of these tags to be present. */
  tags?: string[];
  /** Default true. When false, drop cases tagged needs-runtime-verification. */
  includeRuntimeVerification?: boolean;
  /** Default true. When false, drop API-dependent cases. */
  includeApiDependent?: boolean;
  /** Default true. When false, drop DB-dependent cases. */
  includeDbDependent?: boolean;
}

/** Returns the subset of a dataset's cases matching every provided criterion. */
export function filterValidationCases(
  dataset: ValidationDataset,
  options: FilterOptions = {}
): FieldValidationCase[] {
  const {
    priorities,
    caseTypes,
    fields,
    tags,
    includeRuntimeVerification = true,
    includeApiDependent = true,
    includeDbDependent = true,
  } = options;

  return dataset.cases.filter((c) => {
    if (priorities && !(c.priority && priorities.includes(c.priority))) return false;
    if (caseTypes && !caseTypes.includes(c.caseType)) return false;
    if (fields && !fields.includes(c.field)) return false;
    if (tags && !tags.every((t) => c.tags?.includes(t))) return false;
    if (!includeRuntimeVerification && needsRuntimeVerification(c)) return false;
    if (!includeApiDependent && isApiDependent(c)) return false;
    if (!includeDbDependent && isDbDependent(c)) return false;
    return true;
  });
}

/** Convenience counts for planning / reporting (no execution). */
export interface DatasetPlanSummary {
  total: number;
  byPriority: Record<string, number>;
  dbDependent: number;
  apiDependent: number;
  runtimeVerification: number;
  runnableWithoutDbApiRuntime: number;
}

export function summarizeDatasetPlan(dataset: ValidationDataset): DatasetPlanSummary {
  const byPriority: Record<string, number> = {};
  for (const c of dataset.cases) {
    const key = c.priority ?? 'unset';
    byPriority[key] = (byPriority[key] ?? 0) + 1;
  }
  return {
    total: dataset.cases.length,
    byPriority,
    dbDependent: dataset.cases.filter(isDbDependent).length,
    apiDependent: dataset.cases.filter(isApiDependent).length,
    runtimeVerification: dataset.cases.filter(needsRuntimeVerification).length,
    runnableWithoutDbApiRuntime: filterValidationCases(dataset, {
      includeDbDependent: false,
      includeApiDependent: false,
      includeRuntimeVerification: false,
    }).length,
  };
}
