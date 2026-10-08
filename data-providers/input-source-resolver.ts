/**
 * Phase 7 — resolves a dataset case's value, choosing between the Phase 6
 * literal/generator path and the Customer DB-driven path. This is the ONLY
 * place the two worlds meet; it contains NO SQL (that lives in the providers)
 * and the generic validation runner must not import a DB provider directly.
 *
 *   Validation Dataset -> resolveCaseInput() -> { literal | generator | DB provider } -> value
 */
import { DatabaseInputSource, FieldValidationCase } from '../utils/validation-dataset';
import { resolveInput } from '../utils/test-data-loader';
import { CustomerDataProvider, CustomerGroupDataProvider } from './customer-db-provider';

/** Providers injected by the module adapter / test setup (never by the generic runner). */
export interface DbProviderRegistry {
  customer: CustomerDataProvider;
  customerGroup: CustomerGroupDataProvider;
}

/** Dispatches an allow-listed DB input source to its provider method. No SQL here. */
export async function resolveInputSource(
  source: DatabaseInputSource,
  registry: DbProviderRegistry
): Promise<unknown> {
  switch (source.provider) {
    case 'customer':
      // allow-listed method: getAnyActiveCustomerName
      return registry.customer.getAnyActiveCustomerName();
    case 'customerGroup':
      // allow-listed method: getAnyActiveCustomerGroup
      return registry.customerGroup.getAnyActiveCustomerGroup();
    default: {
      // Exhaustiveness guard — unreachable while DatabaseInputSource matches this switch.
      const exhaustive: never = source;
      throw new Error(`Unsupported DB input source: ${JSON.stringify(exhaustive)}`);
    }
  }
}

/**
 * Resolves the effective input for a case:
 *   - DB-sourced (`inputSource`)  -> requires a provider registry (throws BLOCKED if absent)
 *   - literal / generator (`input`) -> delegated to the Phase 6 resolver (no DB needed)
 */
export async function resolveCaseInput(
  testCase: FieldValidationCase,
  registry?: DbProviderRegistry
): Promise<unknown> {
  if (testCase.inputSource) {
    if (!registry) {
      throw new Error(
        `BLOCKED — case "${testCase.id}" requires a DB provider registry (inputSource), but none was supplied. ` +
          'Provide a verified read-only DB provider (or a fake in framework tests).'
      );
    }
    return resolveInputSource(testCase.inputSource, registry);
  }
  return resolveInput(testCase.input);
}
