// Orders are plain data so the rules can be tested without a database.
// Each line moves pendiente -> en-cocina -> salio. A line can be changed or
// cancelled until it leaves the kitchen; after that only the owner can cancel it.

import type { Product, Variant } from '../menu';

export type Channel = 'mesa' | 'llevar' | 'whatsapp';
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
    lines: order.lines.map((l) => (l.id === lineId && canEditLine(l) ? change(l) : l)),
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

export function isOpen(order: Order): boolean {
  return !order.closedAt && !order.cancelledAt;
}

export function orderLabel(order: Order): string {
  if (order.channel === 'mesa') return `Mesa ${order.table}`;
  const kind = order.channel === 'whatsapp' ? 'WhatsApp' : 'Para llevar';
  return order.customerName ? `${kind} · ${order.customerName}` : kind;
}
