import * as fs from 'fs';
import * as path from 'path';
import { createLogger } from './logger';

/**
 * STEP 15E — worker authentication semaphore (STEP 15D-approved remediation
 * for the remaining "login storm" left by STEP 15A/15C).
 *
 * STEP 15A/15C already gave every Playwright worker its own independently
 * logged-in session instead of sharing one `storage/auth.json` (see
 * fixtures/auth.fixture.ts). That removed the server-side InProc session
 * lock contention, but did nothing to bound HOW MANY of those per-worker
 * logins can be in flight at the same moment: with `workers: undefined`
 * (local runs default to CPU core count), every worker's first
 * "authenticated"-project test can land at once and all of them fire a real
 * login request against the same login endpoint simultaneously — a login
 * storm, independent of the InProc issue.
 *
 * This module bounds that concurrency with a small cross-process counting
 * semaphore: at most AUTH_LOGIN_CONCURRENCY workers may be actively
 * mid-login at once; any further worker blocks (polling) until a slot frees
 * up, then proceeds. Playwright workers are separate OS processes, so the
 * semaphore state can't live in memory — it's coordinated via exclusive
 * ("wx") file creation in storage/.auth-locks/, which is atomic at the OS
 * level: only one process can ever succeed in creating a given slot file at
 * a time, which is exactly the primitive a semaphore needs.
 *
 * Deliberately dependency-free (no new package) — this is the minimum
 * mechanism needed, matching the "minimum framework/configuration
 * necessary" constraint.
 */

const LOCK_DIR = path.resolve(__dirname, '..', 'storage', '.auth-locks');
const MAX_CONCURRENT_LOGINS = Number(process.env.AUTH_LOGIN_CONCURRENCY ?? 2);
const POLL_INTERVAL_MS = 150;
// A real login (submit credentials + resolve branch-select + wait for
// dashboard) should never take anywhere near this long — anything older is
// almost certainly a slot orphaned by a crashed/killed worker, not one
// genuinely still in use, and is safe to reclaim.
const STALE_LOCK_MS = 120_000;
const ACQUIRE_TIMEOUT_MS = 90_000;

const logger = createLogger('auth-semaphore');

function delay(ms: number): Promise<void> {
  // Small random jitter so workers that started polling at the exact same
  // instant don't all retry in lockstep against the same slot files.
  return new Promise((resolve) => setTimeout(resolve, ms + Math.random() * ms * 0.5));
}

function slotPath(slot: number): string {
  return path.join(LOCK_DIR, `slot-${slot}.lock`);
}

function reclaimIfStale(slot: number): void {
  try {
    const stat = fs.statSync(slotPath(slot));
    if (Date.now() - stat.mtimeMs > STALE_LOCK_MS) {
      fs.unlinkSync(slotPath(slot));
      logger.warn(`Reclaimed stale lock slot-${slot}.lock (older than ${STALE_LOCK_MS}ms)`);
    }
  } catch {
    // Lock file was removed by another process between the failed acquire
    // and this check (released normally, or reclaimed by a racing worker) —
    // nothing to do, the next poll iteration will retry acquiring it.
  }
}

function tryAcquireSlot(slot: number): boolean {
  try {
    fs.mkdirSync(LOCK_DIR, { recursive: true });
    const fd = fs.openSync(slotPath(slot), 'wx');
    fs.writeSync(fd, `pid=${process.pid} acquiredAt=${new Date().toISOString()}`);
    fs.closeSync(fd);
    return true;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'EEXIST') {
      reclaimIfStale(slot);
      return false;
    }
    throw err;
  }
}

/**
 * Blocks (polling, non-busy-wait) until fewer than AUTH_LOGIN_CONCURRENCY
 * logins are in flight across all workers, then reserves a slot and
 * returns a function that releases it. Callers must always release the
 * slot (use try/finally) — an unreleased slot blocks that concurrency slot
 * for every other worker until STALE_LOCK_MS passes.
 */
export async function acquireAuthSlot(): Promise<() => void> {
  const deadline = Date.now() + ACQUIRE_TIMEOUT_MS;

  while (Date.now() < deadline) {
    for (let slot = 0; slot < MAX_CONCURRENT_LOGINS; slot++) {
      if (tryAcquireSlot(slot)) {
        logger.debug(`Acquired login slot ${slot}/${MAX_CONCURRENT_LOGINS - 1} (pid=${process.pid})`);
        let released = false;
        return () => {
          if (released) return;
          released = true;
          try {
            fs.unlinkSync(slotPath(slot));
            logger.debug(`Released login slot ${slot}/${MAX_CONCURRENT_LOGINS - 1} (pid=${process.pid})`);
          } catch {
            // Already gone (e.g. reclaimed as stale) — releasing is then a no-op.
          }
        };
      }
    }
    await delay(POLL_INTERVAL_MS);
  }

  throw new Error(
    `auth-semaphore: timed out after ${ACQUIRE_TIMEOUT_MS}ms waiting for a free login slot ` +
      `(AUTH_LOGIN_CONCURRENCY=${MAX_CONCURRENT_LOGINS}). This means logins are taking far ` +
      `longer than expected, or a slot lock in ${LOCK_DIR} is stuck — check for a crashed ` +
      `worker process holding a stale lock file.`
  );
}
