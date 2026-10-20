import { describe, expect, it } from 'vitest';
import { PRODUCTS } from '../menu';
import { addItem, newOrder, ownerCancelLine, type Order } from './order';
import { addPayment, changeDue, equalPart, paidAmount, remaining, removePayment, settle, tipFromPercent } from './payment';
import { billTicket } from './ticket';

const kilo = PRODUCTS.find((p) => p.id === 'kilo')!;
const campechano = kilo.variants.find((v) => v.name === 'Campechano')!;
const refresco = PRODUCTS.find((p) => p.id === 'refresco')!;

function bill(): Order {
  // $550 + $30 = $580
  return addItem(addItem(newOrder('mesa', { table: 6 }), kilo, campechano), refresco, refresco.variants[0]);
}

describe('payments', () => {
  it('computes change and Clip tips', () => {
    expect(changeDue(230, 0, 500)).toBe(270);
    expect(changeDue(230, 20, 500)).toBe(250);
    expect(changeDue(230, 0, 200)).toBe(-30);
    expect(tipFromPercent(580, 10)).toBe(58);
    expect(tipFromPercent(333, 15)).toBe(50);
  });

  it('closes the order once mixed payments cover the total', () => {
    let o = addPayment(bill(), { method: 'efectivo', amount: 300, tip: 0, received: 300 });
    expect(remaining(o)).toBe(280);
    expect(o.closedAt).toBeUndefined();
    o = addPayment(o, { method: 'terminal', amount: 280, tip: 28 });
    expect(remaining(o)).toBe(0);
    expect(o.closedAt).toBeDefined();
  });

  it('never takes more than what is left', () => {
    const o = addPayment(bill(), { method: 'transferencia', amount: 1000, tip: 0 });
    expect(o.payments![0].amount).toBe(580);
  });

  it('splits equally in whole pesos', () => {
    expect(equalPart(bill(), 3)).toBe(194);
    expect(equalPart(bill(), 1)).toBe(580);
  });

  it('lets a payment be removed while the bill is still open', () => {
    let o = addPayment(bill(), { method: 'efectivo', amount: 100, tip: 0 });
    o = removePayment(o, o.payments![0].id);
    expect(remaining(o)).toBe(580);
  });

  it('prints payments, tip and change on the bill', () => {
    const o = addPayment(bill(), { method: 'efectivo', amount: 580, tip: 20, received: 1000 });
    const text = billTicket(o).join('\n');
    expect(text).toMatch(/Efectivo\s+\$580/);
    expect(text).toMatch(/Propina\s+\$20/);
    expect(text).toMatch(/Cambio\s+\$400/);
  });

  it('settles a bill the owner shrank, trimming the latest payments and keeping their tips', () => {
    let o = addPayment(bill(), { method: 'efectivo', amount: 30, tip: 0 });
    o = addPayment(o, { method: 'terminal', amount: 500, tip: 50 });
    const kiloLine = o.lines.find((l) => l.unitPrice === 550)!;
    const { order, refund } = settle(ownerCancelLine(o, kiloLine.id));
    expect(refund).toBe(500);
    expect(order.closedAt).toBeDefined();
    expect(paidAmount(order)).toBe(30);
    expect(order.payments!.map((p) => [p.amount, p.tip])).toEqual([[30, 0], [0, 50]]);
  });

  it('leaves a bill open while something is still owed', () => {
    const o = addPayment(bill(), { method: 'efectivo', amount: 100, tip: 0 });
    const { order, refund } = settle(o);
    expect(order).toBe(o);
    expect(refund).toBe(0);
  });
});
