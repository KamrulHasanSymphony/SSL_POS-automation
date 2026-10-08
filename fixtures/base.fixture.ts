import { test as base } from '@playwright/test';
import { ApiClient } from '../utils/api-helper';
import { CleanupRegistry } from '../utils/test-data-cleanup';
import { createLogger, Logger } from '../utils/logger';
import { env } from '../utils/env';

export interface BaseFixtures {
  /** Scoped logger, named after the running test's title */
  logger: Logger;
  /**
   * Authenticated API client (ShampanPOS backend), for prerequisite setup and
   * cleanup only — see the API Setup Rule in utils/api-helper.ts.
   * Lazily created on first use so tests that never touch the API don't pay
   * for an extra authentication round-trip.
   */
  apiClient: ApiClient;
  /** Tracks API-created prerequisite entities and deletes them after the test */
  cleanup: CleanupRegistry;
}

export const test = base.extend<BaseFixtures>({
  logger: async ({}, use, testInfo) => {
    await use(createLogger(testInfo.title));
  },

  apiClient: async ({}, use) => {
    const client = await ApiClient.create();
    if (env.adminUsername && env.adminPassword) {
      await client.authenticate(env.adminUsername, env.adminPassword);
    }
    await use(client);
    await client.dispose();
  },

  cleanup: async ({ apiClient }, use) => {
    const registry = new CleanupRegistry();
    await use(registry);
    await registry.cleanupAll(apiClient);
  },
});

export { expect } from '@playwright/test';
