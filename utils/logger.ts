/* eslint-disable no-console */

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

function timestamp(): string {
  return new Date().toISOString();
}

function write(level: LogLevel, scope: string, message: string, meta?: unknown): void {
  const line = `[${timestamp()}] [${level.toUpperCase()}] [${scope}] ${message}`;
  const payload = meta !== undefined ? [line, meta] : [line];

  switch (level) {
    case 'error':
      console.error(...payload);
      break;
    case 'warn':
      console.warn(...payload);
      break;
    default:
      console.log(...payload);
  }
}

/**
 * Minimal scoped logger. Scope is typically the test file/module name
 * (e.g. "AUTH", "PROD", "auth.fixture") so CI output can be filtered per module.
 */
export function createLogger(scope: string) {
  return {
    info: (message: string, meta?: unknown) => write('info', scope, message, meta),
    warn: (message: string, meta?: unknown) => write('warn', scope, message, meta),
    error: (message: string, meta?: unknown) => write('error', scope, message, meta),
    debug: (message: string, meta?: unknown) => write('debug', scope, message, meta),
  };
}

export type Logger = ReturnType<typeof createLogger>;
