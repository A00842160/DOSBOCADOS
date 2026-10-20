// Everything is stored on the tablet first (IndexedDB inside the Android
// WebView), so service keeps working with no internet.

import Dexie, { type EntityTable } from 'dexie';
import type { Day } from './domain/cash';
import { applyMovements, saleMovements, type Movement, type Recipes, type Supply } from './domain/inventory';
import type { Order } from './domain/order';

export interface Setting {
  key: string;
  value: unknown;
}

class PosDatabase extends Dexie {
  orders!: EntityTable<Order, 'id'>;
  settings!: EntityTable<Setting, 'key'>;
  days!: EntityTable<Day, 'id'>;
  supplies!: EntityTable<Supply, 'id'>;
  movements!: EntityTable<Movement, 'id'>;

  constructor() {
    super('dosbocados');
    this.version(1).stores({
      orders: 'id, channel, table, createdAt, closedAt, dayId',
      settings: 'key',
    });
    this.version(2).stores({ days: 'id, openedAt, closedAt' });
    this.version(3).stores({ supplies: 'id', movements: 'id, supplyId, at, orderId' });
  }
}

export const db = new PosDatabase();

// Ask the browser not to evict our data under storage pressure.
navigator.storage?.persist?.().catch(() => {});

/** Stores a new order, tagged with the open day so it lands in that day's corte. */
export async function saveOrder(order: Order): Promise<string> {
  return db.transaction('rw', db.orders, db.days, async () => {
    const day = await currentDay();
    return db.orders.put(day && !order.dayId ? { ...order, dayId: day.id } : order);
  });
}

export async function openOrders(): Promise<Order[]> {
  const all = await db.orders.toArray();
  return all.filter((o) => !o.closedAt && !o.cancelledAt).sort((a, b) => a.createdAt - b.createdAt);
}

/** Thrown when a payment is attempted while no day is open. */
export class CajaCerrada extends Error {
  constructor() {
    super('La caja no está abierta. El encargado la abre en Encargado › Caja antes de cobrar.');
  }
}

/**
 * Applies a change to the latest stored copy of an order. Screens must use this
 * instead of saving the copy they rendered, so quick taps never overwrite each other.
 */
export async function mutateOrder(orderId: string, change: (order: Order) => Order): Promise<Order | undefined> {
  return db.transaction('rw', [db.orders, db.days, db.settings, db.supplies, db.movements], async () => {
    const current = await db.orders.get(orderId);
    if (!current) return undefined;
    let next = change(current);
    // Money can only come in while the caja is open, so every peso lands in a corte.
    const newPayment = (next.payments?.length ?? 0) > (current.payments?.length ?? 0);
    const day = newPayment || (next.closedAt && !current.closedAt) ? await currentDay() : undefined;
    if (newPayment && !day) throw new CajaCerrada();
    // A bill counts for the day it was paid in, even if it was opened before.
    if (next.closedAt && !current.closedAt) {
      if (day) next = { ...next, dayId: day.id };
      await recordMovements(saleMovements(next, await loadRecipes(), next.closedAt));
    }
    if (next !== current) await db.orders.put(next);
    return next;
  });
}

/** Drops an order that was opened but never got any item. */
export async function discardIfEmpty(orderId: string): Promise<void> {
  const order = await db.orders.get(orderId);
  if (order && order.lines.length === 0) await db.orders.delete(orderId);
}

/** The day that is open right now, if any. Only one is open at a time. */
export async function currentDay(): Promise<Day | undefined> {
  const days = await db.days.toArray();
  return days.filter((d) => !d.closedAt).sort((a, b) => b.openedAt - a.openedAt)[0];
}

/** Opens the day. Unpaid orders, including ones left from the last corte, join it. */
export async function startDay(day: Day): Promise<void> {
  await db.transaction('rw', db.days, db.orders, async () => {
    if (await currentDay()) return;
    await db.days.put(day);
    const waiting = await openOrders();
    await db.orders.bulkPut(waiting.map((o) => ({ ...o, dayId: day.id })));
  });
}

export async function recentDays(limit = 14): Promise<Day[]> {
  return db.days.orderBy('openedAt').reverse().limit(limit).toArray();
}

export async function mutateDay(dayId: string, change: (day: Day) => Day): Promise<Day | undefined> {
  return db.transaction('rw', db.days, async () => {
    const current = await db.days.get(dayId);
    if (!current) return undefined;
    const next = change(current);
    if (next !== current) await db.days.put(next);
    return next;
  });
}

export const RECIPES_KEY = 'recetas';

export async function loadRecipes(): Promise<Recipes> {
  const row = await db.settings.get(RECIPES_KEY);
  return (row?.value as Recipes | undefined) ?? {};
}

/** Saves movements and updates each supply's stock in the same transaction. */
export async function recordMovements(movements: Movement[]): Promise<void> {
  if (!movements.length) return;
  await db.transaction('rw', db.supplies, db.movements, async () => {
    const ids = [...new Set(movements.map((m) => m.supplyId))];
    const supplies = (await db.supplies.bulkGet(ids)).filter((s): s is Supply => Boolean(s));
    const known = movements.filter((m) => supplies.some((s) => s.id === m.supplyId));
    await db.movements.bulkPut(known);
    await db.supplies.bulkPut(applyMovements(supplies, known));
  });
}
