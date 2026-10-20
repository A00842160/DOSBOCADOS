// The encargado marks dishes or drinks as sold out; staff then can't pick them.

import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';

const KEY = 'agotados';
const EMPTY = new Set<string>();

export async function soldOutIds(): Promise<Set<string>> {
  const row = await db.settings.get(KEY);
  return new Set((row?.value as string[] | undefined) ?? []);
}

export function useSoldOut(): Set<string> {
  return useLiveQuery(soldOutIds, [], EMPTY);
}

export async function setSoldOut(variantIds: string[], soldOut: boolean): Promise<void> {
  await db.transaction('rw', db.settings, async () => {
    const current = await soldOutIds();
    for (const id of variantIds) {
      if (soldOut) current.add(id);
      else current.delete(id);
    }
    await db.settings.put({ key: KEY, value: [...current] });
  });
}

export async function clearSoldOut(): Promise<void> {
  await db.settings.put({ key: KEY, value: [] });
}
