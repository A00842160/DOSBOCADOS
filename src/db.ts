// Everything is stored on the tablet first (IndexedDB inside the Android
// WebView), so service keeps working with no internet.

import Dexie, { type EntityTable } from 'dexie';
import type { Day } from './domain/cash';
import type { Order } from './domain/order';

export interface Setting {
  key: string;
  value: unknown;
}

class PosDatabase extends Dexie {
  orders!: EntityTable<Order, 'id'>;
  settings!: EntityTable<Setting, 'key'>;
  days!: EntityTable<Day, 'id'>;

  constructor() {
    super('dosbocados');
    this.version(1).stores({
      orders: 'id, channel, table, createdAt, closedAt, dayId',
      settings: 'key',
    });
    this.version(2).stores({ days: 'id, openedAt, closedAt' });
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

/**
 * Applies a change to the latest stored copy of an order. Screens must use this
 * instead of saving the copy they rendered, so quick taps never overwrite each other.
 */
export async function mutateOrder(orderId: string, change: (order: Order) => Order): Promise<Order | undefined> {
  return db.transaction('rw', db.orders, db.days, async () => {
    const current = await db.orders.get(orderId);
    if (!current) return undefined;
    let next = change(current);
    // A bill counts for the day it was paid in, even if it was opened before.
    if (next.closedAt && !current.closedAt) {
      const day = await currentDay();
      if (day) next = { ...next, dayId: day.id };
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
