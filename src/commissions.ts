// Commission each delivery app keeps, in percent. The owner sets it; new
// orders copy the current rate so changing it later doesn't rewrite the past.

import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';
import type { Platform } from './domain/order';

const KEY = 'comisiones';
const EMPTY: Record<Platform, number> = { uber: 0, rappi: 0, didi: 0 };

export async function loadCommissions(): Promise<Record<Platform, number>> {
  const row = await db.settings.get(KEY);
  return { ...EMPTY, ...(row?.value as Partial<Record<Platform, number>> | undefined) };
}

export function useCommissions(): Record<Platform, number> {
  return useLiveQuery(loadCommissions, [], EMPTY);
}

export async function setCommission(platform: Platform, percent: number): Promise<void> {
  await db.transaction('rw', db.settings, async () => {
    await db.settings.put({ key: KEY, value: { ...(await loadCommissions()), [platform]: percent } });
  });
}
