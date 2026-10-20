// Everything is stored on the tablet first (IndexedDB inside the Android
// WebView), so service keeps working with no internet.

import Dexie, { type EntityTable } from 'dexie';
import type { Order } from './domain/order';

export interface Setting {
  key: string;
  value: unknown;
}

class PosDatabase extends Dexie {
  orders!: EntityTable<Order, 'id'>;
  settings!: EntityTable<Setting, 'key'>;

  constructor() {
    super('dosbocados');
    this.version(1).stores({
      orders: 'id, channel, table, createdAt, closedAt, dayId',
      settings: 'key',
    });
  }
}

export const db = new PosDatabase();

// Ask the browser not to evict our data under storage pressure.
navigator.storage?.persist?.().catch(() => {});

export function saveOrder(order: Order): Promise<string> {
  return db.orders.put(order);
}

export async function openOrders(): Promise<Order[]> {
  const all = await db.orders.toArray();
  return all.filter((o) => !o.closedAt && !o.cancelledAt).sort((a, b) => a.createdAt - b.createdAt);
}

/** Drops an order that was opened but never got any item. */
export async function discardIfEmpty(orderId: string): Promise<void> {
  const order = await db.orders.get(orderId);
  if (order && order.lines.length === 0) await db.orders.delete(orderId);
}
