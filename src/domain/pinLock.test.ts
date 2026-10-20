import { describe, expect, it } from 'vitest';
import { afterFailure, LOCK_MS, lockedFor, lockMessage, MAX_FAILURES, UNLOCKED } from './pinLock';

describe('PIN lockout', () => {
  it('pauses entry for a minute after five wrong PINs', () => {
    let lock = UNLOCKED;
    for (let i = 1; i < MAX_FAILURES; i++) {
      lock = afterFailure(lock, 1000);
      expect(lockedFor(lock, 1000)).toBe(0);
    }
    lock = afterFailure(lock, 1000);
    expect(lockedFor(lock, 1000)).toBe(60);
    expect(lockedFor(lock, 1000 + LOCK_MS - 1500)).toBe(2);
    expect(lockedFor(lock, 1000 + LOCK_MS)).toBe(0);
    expect(lockMessage(60)).toBe('Demasiados intentos. Espera 60 segundos.');
  });

  it('starts counting again after the pause', () => {
    let lock = UNLOCKED;
    for (let i = 0; i < MAX_FAILURES; i++) lock = afterFailure(lock, 1000);
    lock = afterFailure(lock, 1000 + LOCK_MS);
    expect(lockedFor(lock, 1000 + LOCK_MS)).toBe(0);
  });
});
