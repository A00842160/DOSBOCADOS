// Orders are plain data so the rules can be tested without a database.
// Each line moves pendiente -> en-cocina -> salio. A line can be changed or
// cancelled until it leaves the kitchen; after that only the owner can cancel it.

import type { Product, Variant } from '../menu';
import type { Payment } from './payment';

export type Platform = 'uber' | 'rappi' | 'didi';
export type Channel = 'mesa' | 'llevar' | 'whatsapp' | Platform;

export const CHANNELS: { id: Channel; label: string }[] = [
  { id: 'mesa', label: 'Mesas' },
  { id: 'llevar', label: 'Para llevar' },
  { id: 'whatsapp', label: 'WhatsApp' },
  { id: 'uber', label: 'Uber Eats' },
  { id: 'rappi', label: 'Rappi' },
  { id: 'didi', label: 'DiDi Food' },
];

export const PLATFORMS: Platform[] = ['uber', 'rappi', 'didi'];

export function isPlatform(channel: Channel): channel is Platform {
  return (PLATFORMS as Channel[]).includes(channel);
}

export function channelLabel(channel: Channel): string {
  return CHANNELS.find((c) => c.id === channel)!.label;
}

/** A record with one zero entry per channel. */
export function perChannel<T>(make: () => T): Record<Channel, T> {
  return Object.fromEntries(CHANNELS.map((c) => [c.id, make()])) as Record<Channel, T>;
}
export type LineStatus = 'pendiente' | 'en-cocina' | 'salio';

export interface OrderLine {
  id: string;
  productId: string;
  variantId: string;
  name: string;
  unitPrice: number;
  qty: number;
  mods: string[];
  note: string;
  status: LineStatus;
  batch?: number;
  cancelled?: boolean;
  /** Changed after it was sent; the kitchen still has to be told. */
  changed?: boolean;
  /** When it was sent to the kitchen and when it came out. */
  sentAt?: number;
  servedAt?: number;
}

export interface Order {
  id: string;
  channel: Channel;
  table?: number;
  customerName?: string;
  phone?: string;
  lines: OrderLine[];
  batches: number;
  createdAt: number;
  updatedAt: number;
  closedAt?: number;
  cancelledAt?: number;
  createdBy?: string;
  dayId?: string;
  /** Delivery app commission in percent, fixed when the order was taken. */
  commissionRate?: number;
  payments?: Payment[];
}

export const TABLES = [1, 2, 3, 4, 5, 6];

export const QUICK_MODS = ['Sin cebolla', 'Sin guacamole', 'Sin cilantro', 'Sin salsa', 'Sin queso', 'Bien dorado'];

export function newId(): string {
  return crypto.randomUUID();
}

export function newOrder(channel: Channel, extra: Partial<Order> = {}, now = Date.now()): Order {
  return { id: newId(), channel, lines: [], batches: 0, createdAt: now, updatedAt: now, ...extra };
}

export function lineName(product: Product, variant: Variant): string {
  return variant.name ? `${product.name} ${variant.name}` : product.name;
}

/** Adds one of the variant, merging into an identical pending line without notes. */
export function addItem(order: Order, product: Product, variant: Variant, now = Date.now()): Order {
  const existing = order.lines.find(
    (l) => l.variantId === variant.id && l.status === 'pendiente' && !l.cancelled && l.mods.length === 0 && !l.note,
  );
  const lines = existing
    ? order.lines.map((l) => (l === existing ? { ...l, qty: l.qty + 1 } : l))
    : [
        ...order.lines,
        {
          id: newId(),
          productId: product.id,
          variantId: variant.id,
          name: lineName(product, variant),
          unitPrice: variant.price,
          qty: 1,
          mods: [],
          note: '',
          status: 'pendiente' as const,
        },
      ];
  return { ...order, lines, updatedAt: now };
}

export function canEditLine(line: OrderLine): boolean {
  return !line.cancelled && line.status !== 'salio';
}

function updateLine(order: Order, lineId: string, change: (l: OrderLine) => OrderLine, now: number): Order {
  return {
    ...order,
    lines: order.lines.map((l) => {
      if (l.id !== lineId || !canEditLine(l)) return l;
      const next = change(l);
      return l.status === 'en-cocina' ? { ...next, changed: true } : next;
    }),
    updatedAt: now,
  };
}

/** Changing a quantity to zero removes a pending line or cancels one already in the kitchen. */
export function setQty(order: Order, lineId: string, qty: number, now = Date.now()): Order {
  const line = order.lines.find((l) => l.id === lineId);
  if (!line || !canEditLine(line)) return order;
  if (qty > 0) return updateLine(order, lineId, (l) => ({ ...l, qty }), now);
  if (line.status === 'pendiente') {
    return { ...order, lines: order.lines.filter((l) => l.id !== lineId), updatedAt: now };
  }
  return updateLine(order, lineId, (l) => ({ ...l, cancelled: true }), now);
}

export function setNotes(order: Order, lineId: string, mods: string[], note: string, now = Date.now()): Order {
  return updateLine(order, lineId, (l) => ({ ...l, mods, note: note.trim() }), now);
}

export function activeLines(order: Order): OrderLine[] {
  return order.lines.filter((l) => !l.cancelled);
}

export function lineTotal(line: OrderLine): number {
  return line.cancelled ? 0 : line.unitPrice * line.qty;
}

export function orderTotal(order: Order): number {
  return order.lines.reduce((sum, l) => sum + lineTotal(l), 0);
}

export function itemCount(order: Order): number {
  return activeLines(order).reduce((sum, l) => sum + l.qty, 0);
}

/** What the delivery app keeps from this order. */
export function commission(order: Order): number {
  return order.commissionRate ? Math.round((orderTotal(order) * order.commissionRate) / 100) : 0;
}

export function isOpen(order: Order): boolean {
  return !order.closedAt && !order.cancelledAt;
}

export function orderLabel(order: Order): string {
  if (order.channel === 'mesa') return `Mesa ${order.table}`;
  const kind = channelLabel(order.channel);
  return order.customerName ? `${kind} · ${order.customerName}` : kind;
}

export interface KitchenBatch {
  number: number;
  newLines: OrderLine[];
  changedLines: OrderLine[];
}

export function hasKitchenWork(order: Order): boolean {
  return order.lines.some((l) => (l.status === 'pendiente' && !l.cancelled) || l.changed);
}

/** Sends new lines and pending changes to the kitchen as one numbered batch. */
export function sendToKitchen(order: Order, now = Date.now()): { order: Order; batch: KitchenBatch } {
  const number = order.batches + 1;
  const newLines = order.lines.filter((l) => l.status === 'pendiente' && !l.cancelled);
  const changedLines = order.lines.filter((l) => l.changed);
  const lines = order.lines.map((l) => {
    if (newLines.includes(l)) return { ...l, status: 'en-cocina' as const, batch: number, sentAt: now };
    if (changedLines.includes(l)) return { ...l, changed: false };
    return l;
  });
  const sent = { ...order, lines, batches: number, updatedAt: now };
  return {
    order: sent,
    batch: {
      number,
      newLines: newLines.map((l) => sent.lines.find((x) => x.id === l.id)!),
      changedLines: changedLines.map((l) => sent.lines.find((x) => x.id === l.id)!),
    },
  };
}

export function hasInKitchen(order: Order): boolean {
  return order.lines.some((l) => l.status === 'en-cocina' && !l.cancelled);
}

/** The waitress picked the food up: those lines can no longer change. Without a round, all of them. */
export function markServed(order: Order, now = Date.now(), batch?: number): Order {
  return {
    ...order,
    lines: order.lines.map((l) =>
      l.status === 'en-cocina' && !l.cancelled && (batch === undefined || (l.batch ?? 0) === batch)
        ? { ...l, status: 'salio' as const, servedAt: now }
        : l,
    ),
    updatedAt: now,
  };
}

/** Owner-only: takes back a line even after it left the kitchen. */
export function ownerCancelLine(order: Order, lineId: string, now = Date.now()): Order {
  return {
    ...order,
    lines: order.lines.map((l) => (l.id === lineId ? { ...l, cancelled: true } : l)),
    updatedAt: now,
  };
}

/** A whole order can be cancelled only while nothing has left the kitchen. */
export function canCancelOrder(order: Order): boolean {
  return !order.lines.some((l) => l.status === 'salio' && !l.cancelled);
}

export function cancelOrder(order: Order, now = Date.now()): Order {
  if (!canCancelOrder(order)) return order;
  return {
    ...order,
    lines: order.lines.map((l) => (l.status === 'en-cocina' ? { ...l, cancelled: true, changed: true } : l)),
    cancelledAt: now,
    updatedAt: now,
  };
}
