// A backup is every table of the tablet in one JSON file. PINs are left out:
// a 4-digit PIN is easy to guess from its stored form, and the file travels by
// WhatsApp or email. After restoring on a new tablet the owner sets PINs again.

import type { Day } from './cash';
import type { Movement, Supply } from './inventory';
import type { Order } from './order';

export const BACKUP_APP = 'dosbocados';
export const BACKUP_VERSION = 1;

/** Settings that never go into a backup or get replaced by one. */
export const PRIVATE_SETTINGS = ['auth'];

export interface BackupTables {
  orders: Order[];
  settings: { key: string; value: unknown }[];
  days: Day[];
  supplies: Supply[];
  movements: Movement[];
}

export interface Backup {
  app: typeof BACKUP_APP;
  version: number;
  createdAt: number;
  tables: BackupTables;
}

export function buildBackup(tables: BackupTables, now = Date.now()): Backup {
  return {
    app: BACKUP_APP,
    version: BACKUP_VERSION,
    createdAt: now,
    tables: { ...tables, settings: tables.settings.filter((s) => !PRIVATE_SETTINGS.includes(s.key)) },
  };
}

const TABLES: (keyof BackupTables)[] = ['orders', 'settings', 'days', 'supplies', 'movements'];

/** Reads a backup file, or explains in plain words why it can't be used. */
export function parseBackup(text: string): Backup {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('El archivo no es un respaldo de DosBocados.');
  }
  const b = data as Partial<Backup>;
  if (!b || b.app !== BACKUP_APP || typeof b.createdAt !== 'number' || !b.tables) {
    throw new Error('El archivo no es un respaldo de DosBocados.');
  }
  if ((b.version ?? 0) > BACKUP_VERSION) {
    throw new Error('Este respaldo es de una versión más nueva de la app. Actualiza la app primero.');
  }
  for (const t of TABLES) {
    if (!Array.isArray(b.tables[t] ?? [])) throw new Error('El respaldo está dañado.');
  }
  const tables = Object.fromEntries(TABLES.map((t) => [t, b.tables![t] ?? []])) as unknown as BackupTables;
  return { app: BACKUP_APP, version: b.version ?? 1, createdAt: b.createdAt, tables };
}

export interface BackupSummary {
  createdAt: number;
  orders: number;
  days: number;
  supplies: number;
}

export function summarize(b: Backup): BackupSummary {
  return {
    createdAt: b.createdAt,
    orders: b.tables.orders.length,
    days: b.tables.days.length,
    supplies: b.tables.supplies.length,
  };
}

export function backupFileName(now = Date.now()): string {
  const d = new Date(now);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `dosbocados-respaldo-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}.json`;
}

/** Days since the last backup, or null if there never was one. */
export function daysSince(last: number | undefined, now = Date.now()): number | null {
  return last === undefined ? null : Math.floor((now - last) / (24 * 60 * 60 * 1000));
}
