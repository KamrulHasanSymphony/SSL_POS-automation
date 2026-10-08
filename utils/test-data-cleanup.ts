import { ApiClient } from './api-helper';
import { CreatedEntity } from './test-data-setup';
import { createLogger } from './logger';

const logger = createLogger('test-data-cleanup');

/**
 * Tracks entities created during a single test (via API or UI-driven creation
 * where the created id/code is known) and deletes them in teardown.
 *
 * Per STEP 2 §I: do NOT register PurchaseOrder, Sale, or SaleReturn records
 * here — those cannot be reliably deleted (confirmed no Delete action for
 * PurchaseOrder/Sale; SaleReturn's Delete route is confirmed broken). Those
 * modules rely entirely on unique naming (see utils/random-data.ts) instead
 * of cleanup-by-deletion. Registering them here would just produce noisy
 * failed-cleanup warnings, not an actual leak fix.
 */
export class CleanupRegistry {
  private readonly entities: CreatedEntity[] = [];

  register(entity: CreatedEntity): void {
    this.entities.push(entity);
  }

  async cleanupAll(api: ApiClient): Promise<void> {
    // Reverse order: delete most-recently-created first in case of FK-style dependencies.
    for (const entity of [...this.entities].reverse()) {
      if (!entity.deletePath) {
        logger.debug(`Skipping cleanup for ${entity.module} (${entity.id}) — no delete path registered`);
        continue;
      }
      try {
        const response = await api.post(entity.deletePath, { Id: entity.id });
        if (!response.ok()) {
          logger.warn(
            `Cleanup failed for ${entity.module} (${entity.id}) at ${entity.deletePath}: ${response.status()}`
          );
        }
      } catch (error) {
        logger.warn(`Cleanup threw for ${entity.module} (${entity.id})`, error);
      }
    }
    this.entities.length = 0;
  }
}
