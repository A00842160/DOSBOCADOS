// Sales reports over any date range. A bill counts on the day and hour it was
// paid, like the corte.

import { activeLines, commission, lineTotal, orderTotal, perChannel, type Channel, type Order } from './order';
import { payments, type Method } from './payment';

export interface Range {
  from: number;
  to: number;
}

export interface DaySales {
  /** Local midnight of the day. */
  day: number;
  sales: number;
  orders: number;
}

export interface Report {
  sales: number;
  orders: number;
  averageTicket: number;
  tips: number;
  commissions: number;
  byDay: DaySales[];
  /** Sales per hour of the day, 0-23. */
  byHour: number[];
  /** Sales per weekday, 0 = Sunday. */
  byWeekday: number[];
  byMethod: Record<Method, number>;
  byChannel: Record<Channel, number>;
  items: { name: string; qty: number; total: number }[];
}

export function startOfDay(time: number): number {
  const d = new Date(time);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function addDays(time: number, days: number): number {
  const d = new Date(time);
  d.setDate(d.getDate() + days);
  return d.getTime();
}

/** The last few days, including today. */
export function lastDays(days: number, now = Date.now()): Range {
  const today = startOfDay(now);
  return { from: addDays(today, -(days - 1)), to: addDays(today, 1) };
}

/** A calendar month; offset 0 is this month, -1 the previous one. */
export function month(offset: number, now = Date.now()): Range {
  const d = new Date(now);
  const from = new Date(d.getFullYear(), d.getMonth() + offset, 1).getTime();
  const to = new Date(d.getFullYear(), d.getMonth() + offset + 1, 1).getTime();
  return { from, to };
}

/** Bills paid within the range. */
export function paidIn(orders: Order[], range: Range): Order[] {
  return orders.filter((o) => o.closedAt && !o.cancelledAt && o.closedAt >= range.from && o.closedAt < range.to);
}

export function salesReport(orders: Order[], range: Range): Report {
  const paid = paidIn(orders, range);

  const days = new Map<number, DaySales>();
  for (let day = startOfDay(range.from); day < range.to; day = addDays(day, 1)) {
    days.set(day, { day, sales: 0, orders: 0 });
  }
  const byHour = Array<number>(24).fill(0);
  const byWeekday = Array<number>(7).fill(0);
  const byMethod: Record<Method, number> = { efectivo: 0, terminal: 0, transferencia: 0, plataforma: 0 };
  const byChannel = perChannel(() => 0);
  const items = new Map<string, { name: string; qty: number; total: number }>();
  let tips = 0;

  for (const order of paid) {
    const total = orderTotal(order);
    const at = new Date(order.closedAt!);
    const day = days.get(startOfDay(order.closedAt!));
    if (day) {
      day.sales += total;
      day.orders += 1;
    }
    byHour[at.getHours()] += total;
    byWeekday[at.getDay()] += total;
    byChannel[order.channel] += total;
    for (const p of payments(order)) {
      byMethod[p.method] += p.amount;
      tips += p.tip;
    }
    for (const line of activeLines(order)) {
      const item = items.get(line.name) ?? { name: line.name, qty: 0, total: 0 };
      item.qty += line.qty;
      item.total += lineTotal(line);
      items.set(line.name, item);
    }
  }

  const sales = paid.reduce((sum, o) => sum + orderTotal(o), 0);
  return {
    sales,
    orders: paid.length,
    averageTicket: paid.length ? Math.round(sales / paid.length) : 0,
    tips,
    commissions: paid.reduce((sum, o) => sum + commission(o), 0),
    byDay: [...days.values()],
    byHour,
    byWeekday,
    byMethod,
    byChannel,
    items: [...items.values()].sort((a, b) => b.qty - a.qty || b.total - a.total || a.name.localeCompare(b.name)),
  };
}
