// A bill can be paid in several parts, each with its own method, so a table
// can split the check or pay part cash and part card.
// Tips: with the Clip terminal the customer picks a percentage there, and the
// waitress enters the same percentage here. Cash tips stay in the drawer.

import { orderTotal, type Order } from './order';

export type Method = 'efectivo' | 'transferencia' | 'terminal';

export const METHODS: { id: Method; label: string }[] = [
  { id: 'efectivo', label: 'Efectivo' },
  { id: 'terminal', label: 'Terminal (Clip)' },
  { id: 'transferencia', label: 'Transferencia' },
];

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

/** Splits what is left into equal parts, rounding the first part up to whole pesos. */
export function equalPart(order: Order, parts: number): number {
  const left = remaining(order);
  if (parts <= 1) return left;
  return Math.ceil(left / parts);
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

export function removePayment(order: Order, paymentId: string, now = Date.now()): Order {
  if (order.closedAt) return order;
  return { ...order, payments: payments(order).filter((p) => p.id !== paymentId), updatedAt: now };
}

export function methodLabel(method: Method): string {
  return METHODS.find((m) => m.id === method)!.label;
}
