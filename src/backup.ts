import { Capacitor } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';
import { backupFileName, buildBackup, PRIVATE_SETTINGS, type Backup } from './domain/backup';

const LAST_KEY = 'ultimoRespaldo';

export function useLastBackup(): number | undefined {
  return useLiveQuery(async () => (await db.settings.get(LAST_KEY))?.value as number | undefined, []);
}

async function readTables() {
  return db.transaction('r', [db.orders, db.settings, db.days, db.supplies, db.movements], async () => ({
    orders: await db.orders.toArray(),
    settings: (await db.settings.toArray()).filter((s) => s.key !== LAST_KEY),
    days: await db.days.toArray(),
    supplies: await db.supplies.toArray(),
    movements: await db.movements.toArray(),
  }));
}

/**
 * Writes a backup file and hands it to the share sheet on the tablet (WhatsApp,
 * Gmail, Drive...). In a browser it downloads instead.
 */
export async function shareBackup(): Promise<void> {
  const now = Date.now();
  const text = JSON.stringify(buildBackup(await readTables(), now));
  const name = backupFileName(now);

  if (Capacitor.isNativePlatform()) {
    const file = await Filesystem.writeFile({ path: name, data: text, directory: Directory.Cache, encoding: Encoding.UTF8 });
    await Share.share({ title: 'Respaldo DosBocados', files: [file.uri], dialogTitle: 'Guardar o mandar el respaldo' });
  } else {
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }
  await db.settings.put({ key: LAST_KEY, value: now });
}

/** Replaces everything on this tablet with the backup, keeping this tablet's PINs. */
export async function restoreBackup(backup: Backup): Promise<void> {
  const t = backup.tables;
  await db.transaction('rw', [db.orders, db.settings, db.days, db.supplies, db.movements], async () => {
    const keep = (await db.settings.toArray()).filter((s) => PRIVATE_SETTINGS.includes(s.key));
    await Promise.all([db.orders.clear(), db.settings.clear(), db.days.clear(), db.supplies.clear(), db.movements.clear()]);
    await db.orders.bulkPut(t.orders);
    await db.settings.bulkPut([...t.settings.filter((s) => !PRIVATE_SETTINGS.includes(s.key)), ...keep]);
    await db.days.bulkPut(t.days);
    await db.supplies.bulkPut(t.supplies);
    await db.movements.bulkPut(t.movements);
    await db.settings.put({ key: LAST_KEY, value: backup.createdAt });
  });
}
