/**
 * Phase 6 — Data-Driven Architecture.
 *
 * Strongly-typed contract for POS field-validation datasets stored under
 * `automation/DB/TestData/`. This module defines ONLY the shape + a
 * lightweight runtime validator; it performs no file IO (see
 * `test-data-loader.ts` for loading, message resolution, and dynamic-input
 * resolution).
 *
 * Design intent (per the Master Test Plan §12):
 *   Input data            -> datasets (this contract)
 *   Expected message text -> existing utils/constants.ts (referenced by key)
 *   Runtime unique values -> existing utils/random-data.ts (referenced by generator token)
 *   UI interaction        -> existing Page Objects (unchanged)
 *
 * No executable code lives in the JSON. Dynamic values are expressed as a
 * small, typed `InputGeneratorToken`, never as JavaScript strings — there is
 * no `eval` anywhere in this layer.
 */

/** The validation case categories this project plans to cover (gap analysis §A/§C). */
export const VALIDATION_CASE_TYPES = [
  'required',
  'empty',
  'whitespace',
  'min-length',
  'max-length',
  'below-min',
  'above-max',
  'valid-format',
  'invalid-format',
  'zero',
  'negative',
  'positive',
  'boundary',
  'decimal-precision',
  'special-character',
  'unicode-bangla',
  'duplicate',
  'leading-whitespace',
  'trailing-whitespace',
  'conditional-required',
  'dependent-field',
  'business-rule',
] as const;

export type ValidationCaseType = (typeof VALIDATION_CASE_TYPES)[number];

export type ExpectedResult = 'valid' | 'invalid';

export type Priority = 'P0' | 'P1' | 'P2' | 'P3';

/**
 * Names of the runtime generators in `utils/random-data.ts` that a dataset
 * row may reference instead of a static input. Kept as an explicit allow-list
 * so a dataset can never name an arbitrary function — resolution is a lookup,
 * not a dynamic call.
 */
export const INPUT_GENERATORS = [
  'uniqueCode',
  'randomData.code',
  'randomData.name',
  'randomData.email',
  'randomData.phone11Digit',
  'randomData.int',
] as const;

export type InputGeneratorName = (typeof INPUT_GENERATORS)[number];

/**
 * A typed token standing in for a runtime-generated input value. Resolved by
 * `test-data-loader.resolveInput()`. `arg`/`min`/`max` cover the generator
 * signatures (`uniqueCode(module)`, `randomData.int(min,max)`).
 */
export interface InputGeneratorToken {
  generator: InputGeneratorName;
  arg?: string;
  min?: number;
  max?: number;
}

export function isInputGeneratorToken(value: unknown): value is InputGeneratorToken {
  return (
    typeof value === 'object' &&
    value !== null &&
    'generator' in value &&
    typeof (value as { generator: unknown }).generator === 'string'
  );
}

/**
 * Typed database input source (Customer DB-driven policy). A dataset row may
 * source a value from a read-only DB provider — but ONLY by naming a provider
 * and a method from a fixed allow-list. Arbitrary SQL is NOT permitted in JSON
 * (no `{ "sql": "..." }`); resolution is a typed dispatch, never query text.
 */
export const DB_PROVIDER_METHODS = {
  customer: ['getAnyActiveCustomerName'],
  customerGroup: ['getAnyActiveCustomerGroup'],
} as const;

export type DbProviderName = keyof typeof DB_PROVIDER_METHODS;

export type DatabaseInputSource =
  | { type: 'database'; provider: 'customer'; method: (typeof DB_PROVIDER_METHODS)['customer'][number] }
  | { type: 'database'; provider: 'customerGroup'; method: (typeof DB_PROVIDER_METHODS)['customerGroup'][number] };

/**
 * Validates that `value` is a well-formed, allow-listed DatabaseInputSource.
 * Returns a reason string when invalid (for precise dataset errors), or null
 * when valid. Rejects anything carrying raw SQL or an unknown provider/method.
 */
export function describeInputSourceProblem(value: unknown): string | null {
  if (typeof value !== 'object' || value === null) return 'inputSource must be an object';
  const src = value as Record<string, unknown>;
  if ('sql' in src) return 'raw SQL is not allowed in inputSource';
  if (src.type !== 'database') return `inputSource.type must be "database" (got ${String(src.type)})`;
  if (typeof src.provider !== 'string' || !(src.provider in DB_PROVIDER_METHODS)) {
    return `unknown inputSource.provider: ${String(src.provider)}`;
  }
  const allowed = DB_PROVIDER_METHODS[src.provider as DbProviderName] as readonly string[];
  if (typeof src.method !== 'string' || !allowed.includes(src.method)) {
    return `method "${String(src.method)}" is not allow-listed for provider "${String(src.provider)}"`;
  }
  return null;
}

export function isDatabaseInputSource(value: unknown): value is DatabaseInputSource {
  return describeInputSourceProblem(value) === null;
}

/** One field-level validation case. `input` is a literal OR an InputGeneratorToken (or omitted for `empty`/`required`). */
export interface FieldValidationCase {
  /** Stable unique id within the dataset, e.g. "CUS-TEL-003". */
  id: string;
  module: string;
  form: string;
  field: string;
  /** Control type, e.g. "text" | "textarea" | "number" | "combobox" | "select" | "checkbox" | "date" | "password". */
  fieldType: string;
  caseType: ValidationCaseType;
  /** Static value, or a typed generator token; omitted for empty/required cases. */
  input?: unknown;
  /** Value sourced from a read-only DB provider via a typed, allow-listed method (mutually exclusive with literal `input`). */
  inputSource?: DatabaseInputSource;
  expectedResult: ExpectedResult;
  /** Dotted key into utils/constants.ts validation messages, e.g. "customer.telephoneRequired". */
  expectedMessageKey?: string;
  priority?: Priority;
  tags?: string[];
  notes?: string;
}

/** A dataset file: metadata + its cases. */
export interface ValidationDataset {
  module: string;
  form: string;
  cases: FieldValidationCase[];
}

/** Thrown with a precise, human-readable message on any dataset contract violation. */
export class ValidationDatasetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationDatasetError';
  }
}

const REQUIRED_CASE_FIELDS: (keyof FieldValidationCase)[] = [
  'id',
  'module',
  'form',
  'field',
  'fieldType',
  'caseType',
  'expectedResult',
];

/**
 * Lightweight structural validation (STEP 8) — no external schema dependency.
 * Throws a `ValidationDatasetError` naming the file, the offending row id, and
 * exactly what is wrong. Returns the value typed as `ValidationDataset` on
 * success. `sourceName` is only used to make error messages precise.
 */
export function assertValidDataset(data: unknown, sourceName: string): ValidationDataset {
  if (typeof data !== 'object' || data === null) {
    throw new ValidationDatasetError(`Invalid validation dataset: ${sourceName}\nTop level is not an object.`);
  }
  const obj = data as Record<string, unknown>;
  if (typeof obj.module !== 'string' || obj.module.length === 0) {
    throw new ValidationDatasetError(`Invalid validation dataset: ${sourceName}\nMissing or empty: module`);
  }
  if (typeof obj.form !== 'string' || obj.form.length === 0) {
    throw new ValidationDatasetError(`Invalid validation dataset: ${sourceName}\nMissing or empty: form`);
  }
  if (!Array.isArray(obj.cases)) {
    throw new ValidationDatasetError(`Invalid validation dataset: ${sourceName}\nMissing or non-array: cases`);
  }

  const seenIds = new Set<string>();
  obj.cases.forEach((rawCase, index) => {
    if (typeof rawCase !== 'object' || rawCase === null) {
      throw new ValidationDatasetError(
        `Invalid validation dataset: ${sourceName}\nRow index ${index} is not an object.`
      );
    }
    const c = rawCase as Record<string, unknown>;
    const rowLabel = typeof c.id === 'string' && c.id.length > 0 ? c.id : `index ${index}`;

    for (const key of REQUIRED_CASE_FIELDS) {
      const v = c[key];
      if (typeof v !== 'string' || v.length === 0) {
        throw new ValidationDatasetError(
          `Invalid validation dataset: ${sourceName}\nRow: ${rowLabel}\nMissing: ${key}`
        );
      }
    }

    if (!(VALIDATION_CASE_TYPES as readonly string[]).includes(c.caseType as string)) {
      throw new ValidationDatasetError(
        `Invalid validation dataset: ${sourceName}\nRow: ${rowLabel}\nUnknown caseType: ${String(c.caseType)}`
      );
    }
    if (c.expectedResult !== 'valid' && c.expectedResult !== 'invalid') {
      throw new ValidationDatasetError(
        `Invalid validation dataset: ${sourceName}\nRow: ${rowLabel}\nexpectedResult must be 'valid' or 'invalid' (got ${String(
          c.expectedResult
        )})`
      );
    }
    if (seenIds.has(c.id as string)) {
      throw new ValidationDatasetError(
        `Invalid validation dataset: ${sourceName}\nDuplicate row id: ${String(c.id)}`
      );
    }
    seenIds.add(c.id as string);

    if ('input' in c && isInputGeneratorToken(c.input)) {
      if (!(INPUT_GENERATORS as readonly string[]).includes(c.input.generator)) {
        throw new ValidationDatasetError(
          `Invalid validation dataset: ${sourceName}\nRow: ${rowLabel}\nUnknown input generator: ${c.input.generator}`
        );
      }
    }

    if ('inputSource' in c && c.inputSource !== undefined) {
      const problem = describeInputSourceProblem(c.inputSource);
      if (problem) {
        throw new ValidationDatasetError(
          `Invalid validation dataset: ${sourceName}\nRow: ${rowLabel}\nInvalid inputSource: ${problem}`
        );
      }
    }
  });

  return obj as unknown as ValidationDataset;
}
