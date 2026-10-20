// A business day runs from opening the drawer with the fondo until the owner
// closes it with the corte, even if that is after midnight.
// Expected cash = fondo + cash sales + cash tips - salidas. Card and transfer
// tips never reach the drawer, so they are shown apart.

import { activeLines, commission, lineTotal, orderTotal, perChannel, type Channel, type Order } from './order';
import { payments, remaining, type Method } from './payment';

export type SalidaKind = 'compra' | 'propinas' | 'ventas' | 'otro';

export const SALIDA_KINDS: { id: SalidaKind; label: string }[] = [
  { id: 'compra', label: 'Compra' },
  { id: 'propinas', label: 'Propinas' },
  { id: 'ventas', label: 'Retiro de ventas' },
  { id: 'otro', label: 'Otro' },
];

export interface Salida {
  id: string;
  kind: SalidaKind;
  amount: number;
  concept: string;
  at: number;
  by?: string;
}

export interface Day {
  id: string;
  openedAt: number;
  openedBy?: string;
  fondo: number;
  salidas: Salida[];
  closedAt?: number;
  closedBy?: string;
  /** Cash the owner counted in the drawer at the corte. */
  counted?: number;
}

export function openDay(fondo: number, by?: string, now = Date.now()): Day {
  return { id: crypto.randomUUID(), openedAt: now, openedBy: by, fondo, salidas: [] };
}

export function addSalida(day: Day, salida: Omit<Salida, 'id' | 'at'>, now = Date.now()): Day {
  if (day.closedAt || salida.amount <= 0) return day;
  return { ...day, salidas: [...day.salidas, { ...salida, concept: salida.concept.trim(), id: crypto.randomUUID(), at: now }] };
}

export function removeSalida(day: Day, salidaId: string): Day {
  if (day.closedAt) return day;
  return { ...day, salidas: day.salidas.filter((s) => s.id !== salidaId) };
}

export function closeDay(day: Day, counted: number | undefined, by?: string, now = Date.now()): Day {
  return { ...day, closedAt: now, closedBy: by, counted };
}

/**
 * Orders tagged with the day, plus untagged ones created while it was open. A closed
 * day also keeps the bills that were still open at its corte, even after the next day
 * took them over, so its corte reads the same later.
 */
export function ordersForDay(orders: Order[], day: Day): Order[] {
  const closed = day.closedAt;
  return orders.filter(
    (o) =>
      o.dayId === day.id ||
      (!o.dayId && o.createdAt >= day.openedAt && (!closed || o.createdAt < closed)) ||
      (closed !== undefined &&
        o.dayId !== undefined &&
        o.createdAt < closed &&
        (o.closedAt ?? Infinity) > closed &&
        (o.cancelledAt ?? Infinity) > closed),
  );
}

export interface ItemSale {
  name: string;
  qty: number;
  total: number;
}

export interface Corte {
  fondo: number;
  sales: number;
  byMethod: Record<Method, { sales: number; tips: number }>;
  byChannel: Record<Channel, { orders: number; sales: number }>;
  items: ItemSale[];
  tipsCash: number;
  tipsCard: number;
  /** What Uber Eats, Rappi and DiDi keep. */
  commissions: number;
  salidas: number;
  salidasByKind: Record<SalidaKind, number>;
  expectedCash: number;
  /** Money (sales plus tips) each person registered, most first. */
  byStaff: { name: string; amount: number; tips: number }[];
  orders: number;
  averageTicket: number;
  cancelledOrders: number;
  cancelledLines: number;
  cancelledAmount: number;
  /** Orders still open; their money isn't in the corte yet. */
  openOrders: number;
  /** What open orders still owe. */
  openAmount: number;
  /** Paid today toward bills that are still open; it is in the drawer but not yet a sale. */
  onAccount: number;
  /** Paid on an earlier day toward bills that closed today; a sale today but not in today's drawer. */
  paidBefore: number;
}

/** The order as it stood at `time`: payments, closing and cancelling after it are left out. */
function asOf(order: Order, time: number): Order {
  if ((order.closedAt ?? 0) <= time && (order.cancelledAt ?? 0) <= time) return order;
  return {
    ...order,
    payments: (order.payments ?? []).filter((p) => p.at <= time),
    closedAt: order.closedAt && order.closedAt <= time ? order.closedAt : undefined,
    cancelledAt: order.cancelledAt && order.cancelledAt <= time ? order.cancelledAt : undefined,
  };
}

export function corte(day: Day, allOrders: Order[]): Corte {
  // A closed corte shows each order as it was at the corte, so what happens later never changes it.
  const orders = ordersForDay(allOrders, day)
    .filter((o) => o.lines.length > 0)
    .map((o) => (day.closedAt ? asOf(o, day.closedAt) : o));
  const paid = orders.filter((o) => o.closedAt && !o.cancelledAt);
  const open = orders.filter((o) => !o.closedAt && !o.cancelledAt);

  const byMethod: Corte['byMethod'] = {
    efectivo: { sales: 0, tips: 0 },
    terminal: { sales: 0, tips: 0 },
    transferencia: { sales: 0, tips: 0 },
    plataforma: { sales: 0, tips: 0 },
  };
  const byChannel: Corte['byChannel'] = perChannel(() => ({ orders: 0, sales: 0 }));
  const items = new Map<string, ItemSale>();

  // The drawer counts every payment taken while this day was open, by the time it was
  // taken, even when the bill closes on another day. Only one day is open at a time.
  const inDay = (at: number) => at >= day.openedAt && (!day.closedAt || at <= day.closedAt);
  const staff = new Map<string, { amount: number; tips: number }>();
  let onAccount = 0;
  for (const order of allOrders) {
    if (order.cancelledAt) continue;
    for (const p of payments(order)) {
      if (!inDay(p.at)) continue;
      byMethod[p.method].sales += p.amount;
      byMethod[p.method].tips += p.tip;
      const who = staff.get(p.by ?? 'Sin nombre') ?? { amount: 0, tips: 0 };
      staff.set(p.by ?? 'Sin nombre', { amount: who.amount + p.amount, tips: who.tips + p.tip });
      if (!paid.some((o) => o.id === order.id)) onAccount += p.amount;
    }
  }
  const paidBefore = paid.reduce(
    (sum, o) => sum + payments(o).filter((p) => !inDay(p.at)).reduce((n, p) => n + p.amount, 0),
    0,
  );

  for (const order of paid) {
    byChannel[order.channel].orders += 1;
    byChannel[order.channel].sales += orderTotal(order);
    for (const line of activeLines(order)) {
      const item = items.get(line.name) ?? { name: line.name, qty: 0, total: 0 };
      item.qty += line.qty;
      item.total += lineTotal(line);
      items.set(line.name, item);
    }
  }

  let cancelledLines = 0;
  let cancelledAmount = 0;
  for (const order of orders) {
    for (const line of order.lines) {
      if (line.cancelled && line.status !== 'pendiente') {
        cancelledLines += 1;
        cancelledAmount += line.unitPrice * line.qty;
      }
    }
  }

  const salidasByKind: Corte['salidasByKind'] = { compra: 0, propinas: 0, ventas: 0, otro: 0 };
  for (const s of day.salidas) salidasByKind[s.kind] += s.amount;
  const salidas = day.salidas.reduce((sum, s) => sum + s.amount, 0);

  const sales = paid.reduce((sum, o) => sum + orderTotal(o), 0);
  const tipsCash = byMethod.efectivo.tips;
  const tipsCard = byMethod.terminal.tips + byMethod.transferencia.tips + byMethod.plataforma.tips;

  return {
    fondo: day.fondo,
    sales,
    byMethod,
    byChannel,
    items: [...items.values()].sort((a, b) => b.total - a.total || a.name.localeCompare(b.name)),
    tipsCash,
    tipsCard,
    commissions: paid.reduce((sum, o) => sum + commission(o), 0),
    salidas,
    salidasByKind,
    expectedCash: day.fondo + byMethod.efectivo.sales + tipsCash - salidas,
    byStaff: [...staff].map(([name, v]) => ({ name, ...v })).sort((a, b) => b.amount - a.amount),
    orders: paid.length,
    averageTicket: paid.length ? Math.round(sales / paid.length) : 0,
    cancelledOrders: orders.filter((o) => o.cancelledAt).length,
    cancelledLines,
    cancelledAmount,
    openOrders: open.length,
    openAmount: open.reduce((sum, o) => sum + remaining(o), 0),
    onAccount,
    paidBefore,
  };
}
