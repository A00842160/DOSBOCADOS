import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';
import { DEFAULT_MENU, type Menu } from './domain/menuEdit';

const KEY = 'menu';

export async function loadMenu(): Promise<Menu> {
  const row = await db.settings.get(KEY);
  return (row?.value as Menu | undefined) ?? DEFAULT_MENU;
}

/** The menu as the owner left it; the built-in one until it is edited. */
export function useMenu(): Menu {
  return useLiveQuery(loadMenu, [], DEFAULT_MENU);
}

export async function editMenu(change: (menu: Menu) => Menu): Promise<void> {
  await db.transaction('rw', db.settings, async () => {
    await db.settings.put({ key: KEY, value: change(await loadMenu()) });
  });
}

export async function resetMenu(): Promise<void> {
  await db.settings.delete(KEY);
}
