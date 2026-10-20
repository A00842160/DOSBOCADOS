// After a few wrong PINs in a row, PIN entry pauses for a while, so a 4-digit
// PIN can't be found by trying numbers one after another.

export const MAX_FAILURES = 5;
export const LOCK_MS = 60 * 1000;

export interface PinLock {
  failures: number;
  lockedUntil: number;
}

export const UNLOCKED: PinLock = { failures: 0, lockedUntil: 0 };

/** Seconds left before PINs can be tried again, or 0. */
export function lockedFor(lock: PinLock, now = Date.now()): number {
  return lock.lockedUntil > now ? Math.ceil((lock.lockedUntil - now) / 1000) : 0;
}

export function afterFailure(lock: PinLock, now = Date.now()): PinLock {
  const failures = lock.failures + 1;
  return failures >= MAX_FAILURES ? { failures: 0, lockedUntil: now + LOCK_MS } : { ...lock, failures };
}

export function lockMessage(seconds: number): string {
  return `Demasiados intentos. Espera ${seconds} segundos.`;
}
