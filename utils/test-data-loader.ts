/**
 * Phase 6 — Data-Driven Architecture: dataset loader + resolvers.
 *
 * Responsibilities (STEP 7/9/5):
 *   - Resolve a dataset path safely (relative to automation/DB/TestData, no
 *     hard-coded machine/drive paths; Windows-safe via path.resolve).
 *   - Load + parse JSON with clear errors for missing file / malformed JSON.
 *   - Structurally validate via validation-dataset.assertValidDataset().
 *   - Resolve expectedMessageKey -> existing utils/constants.ts message text
 *     (single-sourced; never duplicated into JSON).
 *   - Resolve a dataset's dynamic input tokens -> existing utils/random-data.ts
 *     generators (typed lookup; no eval).
 *
 * No UI, no API, no auth — pure Node + the project's existing utilities, so it
 * is safe to exercise in the framework-only Playwright project.
 */
import * as fs from 'fs';
import * as path from 'path';
import {
  assertValidDataset,
  InputGeneratorToken,
  isInputGeneratorToken,
  ValidationDataset,
  ValidationDatasetError,
} from './validation-dataset';
import { uniqueCode, randomData } from './random-data';
import {
  loginValidationMessages,
  productValidationMessages,
  customerValidationMessages,
  supplierValidationMessages,
  userProfileValidationMessages,
  companyProfileValidationMessages,
  customerAdvanceValidationMessages,
  bankInformationValidationMessages,
  customerGroupValidationMessages,
  supplierGroupValidationMessages,
  productGroupValidationMessages,
  masterItemGroupValidationMessages,
  masterSupplierGroupValidationMessages,
  uomValidationMessages,
  businessTypeValidationMessages,
  paymentTypeValidationMessages,
  overHeadValidationMessages,
  apiMessages,
} from './constants';

/** Absolute path to the Automation test-data root. Derived from this file's location — never hard-coded. */
export const TEST_DATA_ROOT = path.resolve(__dirname, '..', 'DB', 'TestData');

/**
 * Registry mapping a message key's first segment to the existing constants
 * group. Adding a module = add one line here (no message text is copied).
 */
const MESSAGE_GROUPS: Record<string, Record<string, string>> = {
  login: loginValidationMessages,
  product: productValidationMessages,
  customer: customerValidationMessages,
  supplier: supplierValidationMessages,
  userProfile: userProfileValidationMessages,
  companyProfile: companyProfileValidationMessages,
  customerAdvance: customerAdvanceValidationMessages,
  bankInformation: bankInformationValidationMessages,
  customerGroup: customerGroupValidationMessages,
  supplierGroup: supplierGroupValidationMessages,
  productGroup: productGroupValidationMessages,
  masterItemGroup: masterItemGroupValidationMessages,
  masterSupplierGroup: masterSupplierGroupValidationMessages,
  uom: uomValidationMessages,
  businessType: businessTypeValidationMessages,
  paymentType: paymentTypeValidationMessages,
  overHead: overHeadValidationMessages,
  api: apiMessages,
};

/**
 * Loads and validates a dataset by its path relative to TEST_DATA_ROOT, e.g.
 * `loadValidationDataset('Masters/customer.validation.json')`.
 */
export function loadValidationDataset(relativePath: string): ValidationDataset {
  const absolute = path.resolve(TEST_DATA_ROOT, relativePath);

  // Guard against path escaping the test-data root.
  const normalizedRoot = path.resolve(TEST_DATA_ROOT) + path.sep;
  if (!(absolute + path.sep).startsWith(normalizedRoot)) {
    throw new ValidationDatasetError(
      `Refusing to load dataset outside TestData root:\n${relativePath}\n(resolved to ${absolute})`
    );
  }

  if (!fs.existsSync(absolute)) {
    throw new ValidationDatasetError(
      `Validation dataset not found:\n${relativePath}\n(looked in ${absolute})`
    );
  }

  let raw: string;
  try {
    raw = fs.readFileSync(absolute, 'utf-8');
  } catch (err) {
    throw new ValidationDatasetError(
      `Could not read validation dataset:\n${relativePath}\n${(err as Error).message}`
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new ValidationDatasetError(
      `Malformed JSON in validation dataset:\n${relativePath}\n${(err as Error).message}`
    );
  }

  return assertValidDataset(parsed, relativePath);
}

/**
 * Resolves a dotted message key (e.g. "customer.telephoneRequired") to the
 * existing constants.ts message text. Throws a clear error if the group or
 * key does not exist — messages are never invented here.
 */
export function resolveExpectedMessage(key: string): string {
  const dot = key.indexOf('.');
  if (dot <= 0 || dot === key.length - 1) {
    throw new ValidationDatasetError(
      `Invalid expectedMessageKey "${key}". Expected "<group>.<messageName>".`
    );
  }
  const group = key.slice(0, dot);
  const name = key.slice(dot + 1);
  const bag = MESSAGE_GROUPS[group];
  if (!bag) {
    throw new ValidationDatasetError(
      `Unknown message group "${group}" in key "${key}". Add it to MESSAGE_GROUPS in test-data-loader.ts if the constants group exists.`
    );
  }
  const message = bag[name];
  if (typeof message !== 'string') {
    throw new ValidationDatasetError(
      `Unknown message "${name}" in group "${group}" (key "${key}"). Do not invent it — add the constant to utils/constants.ts first.`
    );
  }
  return message;
}

/**
 * Resolves a dataset `input` value: a typed generator token becomes a freshly
 * generated runtime value (via the existing random-data helpers); anything
 * else is returned unchanged. No eval, no arbitrary function names.
 */
export function resolveInput(input: unknown): unknown {
  if (!isInputGeneratorToken(input)) {
    return input;
  }
  const token: InputGeneratorToken = input;
  switch (token.generator) {
    case 'uniqueCode':
      return uniqueCode(token.arg ?? 'DATA');
    case 'randomData.code':
      return randomData.code(token.arg ?? 'DATA');
    case 'randomData.name':
      return randomData.name(token.arg ?? 'DATA');
    case 'randomData.email':
      return randomData.email(token.arg ?? 'DATA');
    case 'randomData.phone11Digit':
      return randomData.phone11Digit();
    case 'randomData.int':
      return randomData.int(token.min ?? 0, token.max ?? 100);
    default:
      // Exhaustiveness guard — unreachable while INPUT_GENERATORS matches this switch.
      throw new ValidationDatasetError(`Unsupported input generator: ${String(token.generator)}`);
  }
}
