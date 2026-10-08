import { Logger } from '../utils/logger';

/**
 * PERFORMANCE-LOAD-LIFECYCLE evidence recorder.
 *
 * Pure measurement/documentation utility — per this task's own rules ("Do
 * NOT: change SQL query, add indexes, modify API optimization, change
 * business logic, fake large data" / "Only: Measure, Document, Identify
 * bottleneck, Create automation coverage"), this class has no effect on
 * anything it measures. It times a real, already-implemented page-object
 * call, records the exact evidence shape this task's own "Evidence
 * Required" section asks for (Operation / Start Time / End Time / Duration
 * / Result), and never modifies the operation's own behavior or timeout.
 *
 * Deliberately does NOT use `expect()` internally: per the task's own
 * "Performance Threshold" rule ("Do not fail tests only based on
 * assumptions. First capture actual baseline."), a threshold comparison
 * here is DATA (the `result` field), not a hard pass/fail gate — callers
 * decide whether/how to assert on it (this project's convention is
 * `expect.soft()`, which records a failure without aborting the rest of
 * the lifecycle — see the spec's own usage).
 */
export interface PerformanceRecord {
  operation: string;
  category: string;
  startedAt: string;
  endedAt: string;
  durationMs: number;
  thresholdMs: number | null;
  /** 'PASS' if durationMs <= thresholdMs; 'FAIL' if it exceeded it; 'INFO' when no threshold applies (thresholdMs === null) — recorded as data either way, never thrown from here. */
  result: 'PASS' | 'FAIL' | 'INFO';
  /** Populated only when the measured action itself threw — the record is still kept (evidence of a real timeout/error is exactly what this task asks to capture), and the original error is rethrown after recording. */
  error?: string;
}

export class PerformanceRecorder {
  private readonly records: PerformanceRecord[] = [];

  constructor(private readonly logger?: Logger) {}

  /**
   * Times `action`, records the result, and returns whatever `action`
   * returned. `thresholdMs: null` records the measurement as pure
   * information (no PASS/FAIL judged) — used for sub-steps the task's own
   * benchmark table doesn't name a threshold for (e.g. "apply filter" as
   * its own line item, distinct from the report's overall "Report Load"
   * figure). On error, the record is kept (result implicitly reflects an
   * incomplete operation — see `error`) and the original error is
   * rethrown unchanged, so a genuine functional failure still surfaces
   * through Playwright's normal failure/trace/screenshot mechanism exactly
   * as it would without this wrapper.
   */
  async measure<T>(operation: string, category: string, thresholdMs: number | null, action: () => Promise<T>): Promise<T> {
    const startedAt = new Date();
    try {
      const value = await action();
      const endedAt = new Date();
      const durationMs = endedAt.getTime() - startedAt.getTime();
      const result: PerformanceRecord['result'] = thresholdMs === null ? 'INFO' : durationMs <= thresholdMs ? 'PASS' : 'FAIL';
      const record: PerformanceRecord = {
        operation,
        category,
        startedAt: startedAt.toISOString(),
        endedAt: endedAt.toISOString(),
        durationMs,
        thresholdMs,
        result,
      };
      this.records.push(record);
      this.logger?.info(`[PERF] ${operation}: ${durationMs}ms (${result}${thresholdMs !== null ? `, threshold ${thresholdMs}ms` : ''})`);
      return value;
    } catch (error) {
      const endedAt = new Date();
      const durationMs = endedAt.getTime() - startedAt.getTime();
      this.records.push({
        operation,
        category,
        startedAt: startedAt.toISOString(),
        endedAt: endedAt.toISOString(),
        durationMs,
        thresholdMs,
        result: 'FAIL',
        error: error instanceof Error ? error.message : String(error),
      });
      this.logger?.warn(`[PERF] ${operation}: FAILED after ${durationMs}ms`, error);
      throw error;
    }
  }

  getRecords(): PerformanceRecord[] {
    return [...this.records];
  }

  /**
   * PERFORMANCE-STABILIZATION-LIFECYCLE addition — records a duration that
   * was measured externally (e.g. a sub-phase timed by racing a Locator's
   * own `waitFor()` alongside a page-object call that itself performs the
   * full operation, so no page object/component needs to be modified or
   * instrumented internally to get sub-phase visibility). Purely additive:
   * `measure()` above is completely unchanged and every existing caller is
   * unaffected. `startedAt`/`endedAt` are synthesized from `durationMs`
   * ending "now", since the actual wall-clock instants already elapsed by
   * the time the caller has a duration to report — same evidence shape
   * (`toReportText()`) either way.
   */
  recordDuration(operation: string, category: string, thresholdMs: number | null, durationMs: number, opts?: { timedOut?: boolean; error?: string }): void {
    const endedAt = new Date();
    const startedAt = new Date(endedAt.getTime() - Math.max(durationMs, 0));
    const timedOut = opts?.timedOut ?? false;
    const result: PerformanceRecord['result'] = timedOut ? 'FAIL' : thresholdMs === null ? 'INFO' : durationMs <= thresholdMs ? 'PASS' : 'FAIL';
    const record: PerformanceRecord = {
      operation,
      category,
      startedAt: startedAt.toISOString(),
      endedAt: endedAt.toISOString(),
      durationMs,
      thresholdMs,
      result,
      ...(timedOut ? { error: opts?.error ?? 'Timed out waiting for the measured sub-phase to complete' } : {}),
    };
    this.records.push(record);
    this.logger?.info(`[PERF] ${operation}: ${durationMs}ms (${result}${thresholdMs !== null ? `, threshold ${thresholdMs}ms` : ''})`);
  }

  /** Renders every captured record in this task's own "Evidence Required" format, for console output / test-report attachment. */
  toReportText(): string {
    return this.records
      .map((r) => {
        const lines = [
          `Operation: ${r.operation} [${r.category}]`,
          `Start: ${r.startedAt}`,
          `End: ${r.endedAt}`,
          `Duration: ${r.durationMs}ms${r.thresholdMs !== null ? ` (threshold ${r.thresholdMs}ms)` : ''}`,
          `Result: ${r.result}`,
        ];
        if (r.error) lines.push(`Error: ${r.error}`);
        return lines.join('\n');
      })
      .join('\n\n');
  }
}
