// A bill can be paid in several parts, each with its own method, so a table
// can split the check or pay part cash and part card.
// Tips: with the Clip terminal the customer picks a percentage there, and the
// waitress enters the same percentage here. Cash tips stay in the drawer.

import { isPlatform, orderTotal, type Order } from './order';

export type Method = 'efectivo' | 'transferencia' | 'terminal' | 'plataforma';

export const METHODS: { id: Method; label: string }[] = [
  { id: 'efectivo', label: 'Efectivo' },
  { id: 'terminal', label: 'Terminal (Clip)' },
  { id: 'transferencia', label: 'Transferencia' },
  { id: 'plataforma', label: 'Pagado en la app' },
];

/** Payment methods to offer: delivery app orders can also be paid inside the app. */
export function methodsFor(order: Order): { id: Method; label: string }[] {
  return isPlatform(order.channel) ? [METHODS[3], ...METHODS.slice(0, 3)] : METHODS.slice(0, 3);
}

export interface Payment {
  id: string;
  method: Method;
  /** Part of the bill this payment covers, in pesos. */
  amount: number;
  tip: number;
  /** Cash handed over by the customer; only for efectivo. */
  received?: number;
  at: number;
  by?: string;
}

export function payments(order: Order): Payment[] {
  return order.payments ?? [];
}

export function paidAmount(order: Order): number {
  return payments(order).reduce((sum, p) => sum + p.amount, 0);
}

export function remaining(order: Order): number {
  return Math.max(0, orderTotal(order) - paidAmount(order));
}

export function tipFromPercent(amount: number, percent: number): number {
  return Math.round((amount * percent) / 100);
}

/** Change to hand back; negative means the cash isn't enough. */
export function changeDue(amount: number, tip: number, received: number): number {
  return received - amount - tip;
}

/**
 * One person's share when the whole bill is split equally, rounded up to whole
 * pesos. It is the same share for every person, and the last one pays what is left.
 */
export function equalPart(order: Order, parts: number): number {
  const left = remaining(order);
  if (parts <= 1) return left;
  return Math.min(left, Math.ceil(orderTotal(order) / parts));
}

export function addPayment(order: Order, payment: Omit<Payment, 'id' | 'at'>, now = Date.now()): Order {
  const amount = Math.min(payment.amount, remaining(order));
  if (amount <= 0) return order;
  const next: Order = {
    ...order,
    payments: [...payments(order), { ...payment, amount, id: crypto.randomUUID(), at: now }],
    updatedAt: now,
  };
  return remaining(next) === 0 ? { ...next, closedAt: now } : next;
}

/**
 * After the bill shrank (the owner took back a dish), closes it if what was paid
 * already covers it. Anything paid beyond the new total is taken off the latest
 * payments, so the corte expects what stays in the drawer; `refund` is what to
 * hand back to the customer.
 */
export function settle(order: Order, now = Date.now()): { order: Order; refund: number } {
  if (order.closedAt || !payments(order).length) return { order, refund: 0 };
  const total = orderTotal(order);
  const refund = Math.max(0, paidAmount(order) - total);
  if (paidAmount(order) < total) return { order, refund: 0 };

  let excess = refund;
  const kept: Payment[] = [];
  for (const p of [...payments(order)].reverse()) {
    const cut = Math.min(excess, p.amount);
    excess -= cut;
    if (p.amount - cut > 0) kept.unshift({ ...p, amount: p.amount - cut });
    else if (p.tip > 0) kept.unshift({ ...p, amount: 0 });
  }
  const next = { ...order, payments: kept, updatedAt: now };
  // Everything was taken back and no tip stays: there is no sale left, so the order ends cancelled.
  return { order: total > 0 || kept.length ? { ...next, closedAt: now } : { ...next, cancelledAt: now }, refund };
}

export function removePayment(order: Order, paymentId: string, now = Date.now()): Order {
  if (order.closedAt) return order;
  return { ...order, payments: payments(order).filter((p) => p.id !== paymentId), updatedAt: now };
}

export function methodLabel(method: Method): string {
  return METHODS.find((m) => m.id === method)!.label;
}
