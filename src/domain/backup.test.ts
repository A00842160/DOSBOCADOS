import { describe, expect, it } from 'vitest';
import { backupFileName, buildBackup, daysSince, parseBackup, summarize } from './backup';
import { newOrder } from './order';

const tables = {
  orders: [newOrder('mesa', { table: 1 }, 1)],
  settings: [
    { key: 'auth', value: { owner: 'hash' } },
    { key: 'menu', value: { categories: [] } },
  ],
  days: [],
  supplies: [{ id: 's', name: 'Carne', unit: 'kg' as const, minimum: 1, stock: 3 }],
  movements: [],
};

describe('backup', () => {
  it('round-trips everything except PINs', () => {
    const b = buildBackup(tables, 1000);
    expect(b.tables.settings.map((s) => s.key)).toEqual(['menu']);
    const back = parseBackup(JSON.stringify(b));
    expect(back.tables.orders).toEqual(tables.orders);
    expect(back.tables.supplies).toEqual(tables.supplies);
    expect(summarize(back)).toEqual({ createdAt: 1000, orders: 1, days: 0, supplies: 1 });
  });

  it('rejects files that are not a backup', () => {
    expect(() => parseBackup('hola')).toThrow('no es un respaldo');
    expect(() => parseBackup('{"app":"otra"}')).toThrow('no es un respaldo');
    const newer = { ...buildBackup(tables), version: 99 };
    expect(() => parseBackup(JSON.stringify(newer))).toThrow('versión más nueva');
    const broken = { ...buildBackup(tables), tables: { ...tables, orders: 'x' } };
    expect(() => parseBackup(JSON.stringify(broken))).toThrow('dañado');
  });

  it('accepts older backups missing newer tables', () => {
    const old = { app: 'dosbocados', version: 1, createdAt: 5, tables: { orders: [], settings: [], days: [] } };
    expect(parseBackup(JSON.stringify(old)).tables.supplies).toEqual([]);
  });

  it('names files by date and counts days', () => {
    expect(backupFileName(new Date(2026, 9, 20, 21, 5).getTime())).toBe('dosbocados-respaldo-2026-10-20-2105.json');
    expect(daysSince(undefined)).toBeNull();
    expect(daysSince(0, 3 * 24 * 60 * 60 * 1000 + 5)).toBe(3);
  });
});
