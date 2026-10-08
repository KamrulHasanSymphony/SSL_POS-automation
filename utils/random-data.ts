import { randomBytes } from 'crypto';

/**
 * Formats "now" as YYYYMMDDHHmmss for use in unique identifiers.
 */
function timestampToken(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}` +
    `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
  );
}

/**
 * 4-character lowercase alphanumeric random token, e.g. "7f3a".
 */
function randomToken(length = 4): string {
  return randomBytes(length)
    .toString('hex')
    .slice(0, length);
}

/**
 * Generates a unique per-run identifier following the plan's naming convention:
 * AUTO_<MODULE>_<TIMESTAMP>_<RANDOM>
 *
 * Used for all master-data and transactional test data so parallel/repeated runs
 * never collide, and so transactional records that cannot be reliably deleted
 * (Purchase Order, Sale, Sale Return — see STEP 2 §I) remain safely distinguishable.
 */
export function uniqueCode(module: string): string {
  const normalizedModule = module.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  return `AUTO_${normalizedModule}_${timestampToken()}_${randomToken()}`;
}

/**
 * Generates a random N-digit numeric string (digits only, no leading-zero concerns
 * since callers prefix a fixed leading segment, e.g. phone11Digit below).
 */
function randomDigits(length: number): string {
  let digits = '';
  for (let i = 0; i < length; i += 1) {
    digits += Math.floor(Math.random() * 10).toString();
  }
  return digits;
}

/**
 * Convenience helpers for common field shapes seeded from a uniqueCode.
 */
export const randomData = {
  code: uniqueCode,
  name: (module: string) => `Auto Test ${module} ${randomToken(6)}`,
  email: (module: string) => `auto.${module.toLowerCase()}.${randomToken(8)}@example-test.invalid`,
  /** Matches the confirmed UserProfileVM.PhoneNumber validation regex ^\d{11}$ */
  phone11Digit: () => `01${randomDigits(9)}`,
  int: (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min,
};
