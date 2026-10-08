/**
 * Phase 7 (Customer DB-driven data) — Automation-side DB safety layer.
 *
 * Two independent guards, both mandatory before any real query ever runs:
 *   1) assertReadOnlySql()  — rejects anything that is not a plain SELECT/CTE.
 *   2) assertDbConfigReady() — refuses to proceed unless a complete, explicitly
 *      read-only DB configuration is supplied via environment variables.
 *
 * These are a belt-and-suspenders layer ON TOP OF using a genuinely read-only
 * database credential. The Automation data-provider layer never issues writes;
 * the POS application database stays READ-ONLY from here. No credentials are
 * hard-coded; no password is ever logged.
 */

/** Write/DDL tokens that must never appear in an Automation query. */
const FORBIDDEN_SQL = /\b(INSERT|UPDATE|DELETE|MERGE|TRUNCATE|DROP|ALTER|CREATE|GRANT|REVOKE|EXEC|EXECUTE|INTO|SET)\b/i;

export class ReadOnlySqlViolationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ReadOnlySqlViolationError';
  }
}

export class DbConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DbConfigError';
  }
}

/**
 * Throws unless `sql` is a single read-only statement: it must begin with
 * SELECT or WITH (a CTE), contain no write/DDL keyword, and not stack multiple
 * statements. Returns the trimmed SQL on success. This is a safety assertion —
 * the provider still binds parameters (never string-concatenates values).
 */
export function assertReadOnlySql(sql: string): string {
  const trimmed = sql.trim();
  if (trimmed.length === 0) {
    throw new ReadOnlySqlViolationError('Empty SQL is not allowed.');
  }

  // Disallow statement stacking (allow at most one trailing semicolon).
  const withoutTrailingSemicolon = trimmed.replace(/;\s*$/, '');
  if (withoutTrailingSemicolon.includes(';')) {
    throw new ReadOnlySqlViolationError(
      `Multiple SQL statements are not allowed in a read-only query:\n${trimmed}`
    );
  }

  if (!/^(SELECT|WITH)\b/i.test(withoutTrailingSemicolon)) {
    throw new ReadOnlySqlViolationError(
      `Read-only queries must start with SELECT or WITH:\n${trimmed}`
    );
  }

  const forbidden = withoutTrailingSemicolon.match(FORBIDDEN_SQL);
  if (forbidden) {
    throw new ReadOnlySqlViolationError(
      `Write/DDL keyword "${forbidden[0].toUpperCase()}" is not allowed in a read-only query:\n${trimmed}`
    );
  }

  return trimmed;
}

/** Complete, validated read-only DB configuration (no secrets logged). */
export interface DbConfig {
  server: string;
  database: string;
  username: string;
  /** Present in memory only; never logged or serialized into reports/datasets. */
  password: string;
  port: number;
  /** Must be explicitly true — the operator affirms the credential is read-only. */
  readonly: true;
}

const REQUIRED_ENV = ['DB_SERVER', 'DB_DATABASE', 'DB_USERNAME', 'DB_PASSWORD'] as const;

/**
 * Builds a DbConfig from an env-like source (defaults to process.env). Throws a
 * DbConfigError naming the MISSING keys (never their values) if incomplete, or
 * if the credential is not explicitly marked read-only (`DB_READONLY=true`).
 * The provider must refuse to run without this — it never guesses a server or
 * database name.
 */
export function assertDbConfigReady(source: NodeJS.ProcessEnv = process.env): DbConfig {
  const missing = REQUIRED_ENV.filter((key) => {
    const v = source[key];
    return v === undefined || v.length === 0;
  });
  if (missing.length > 0) {
    throw new DbConfigError(
      `BLOCKED — read-only POS DB configuration incomplete. Missing: ${missing.join(
        ', '
      )}. Set these in .env (never commit real credentials); do not guess a server/database.`
    );
  }

  if ((source.DB_READONLY ?? '').toLowerCase() !== 'true') {
    throw new DbConfigError(
      'BLOCKED — DB_READONLY must be explicitly "true" to affirm the supplied credential is read-only. ' +
        'Supply a read-only DB login; the Automation layer must never hold a write-capable credential.'
    );
  }

  const port = Number(source.DB_PORT ?? '1433');
  if (!Number.isFinite(port) || port <= 0) {
    throw new DbConfigError(`Invalid DB_PORT: ${String(source.DB_PORT)}`);
  }

  return {
    server: source.DB_SERVER as string,
    database: source.DB_DATABASE as string,
    username: source.DB_USERNAME as string,
    password: source.DB_PASSWORD as string,
    port,
    readonly: true,
  };
}
