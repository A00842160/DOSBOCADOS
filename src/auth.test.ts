import { describe, expect, it } from 'vitest';
import { hashPin, pinMatches, roleForPin, type AuthSettings } from './auth';

describe('PINs', () => {
  it('stores only a salted hash and checks it', async () => {
    const stored = await hashPin('123456');
    expect(stored.hash).not.toContain('123456');
    expect(await pinMatches('123456', stored)).toBe(true);
    expect(await pinMatches('654321', stored)).toBe(false);
    expect(await pinMatches('123456', undefined)).toBe(false);
  });

  it('gives each PIN its own role', async () => {
    const auth: AuthSettings = { owner: await hashPin('111111'), encargado: await hashPin('2222'), staff: [] };
    expect(await roleForPin('111111', auth)).toBe('dueno');
    expect(await roleForPin('2222', auth)).toBe('encargado');
    expect(await roleForPin('3333', auth)).toBeNull();
  });
});
