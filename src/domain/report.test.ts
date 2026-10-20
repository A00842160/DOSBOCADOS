import { describe, expect, it } from 'vitest';
import { PRODUCTS } from '../menu';
import { addItem, cancelOrder, newOrder, type Order } from './order';
import { addPayment } from './payment';
import { lastDays, month, salesReport } from './report';

const refresco = PRODUCTS.find((p) => p.id === 'refresco')!;
const kilo = PRODUCTS.find((p) => p.id === 'kilo')!;

function paidAt(time: number, extra = 0): Order {
  let o = addItem(newOrder('mesa', { table: 1 }, time - 1000), refresco, refresco.variants[0]);
  for (let i = 0; i < extra; i++) o = addItem(o, kilo, kilo.variants[0]);
  return addPayment(o, { method: 'efectivo', amount: 10_000, tip: 5 }, time);
}

describe('sales report', () => {
  const now = new Date(2026, 9, 20, 15, 0).getTime();
  const at = (day: number, hour: number) => new Date(2026, 9, day, hour, 30).getTime();

  it('groups the last 7 days by day, hour and dish', () => {
    const orders = [
      paidAt(at(20, 14)),
      paidAt(at(20, 14)),
      paidAt(at(18, 21), 1),
      paidAt(at(10, 13)), // outside the 7 days
      cancelOrder(addItem(newOrder('llevar', {}, at(20, 12)), refresco, refresco.variants[0])),
      addItem(newOrder('mesa', {}, at(20, 13)), refresco, refresco.variants[0]), // unpaid
    ];
    const r = salesReport(orders, lastDays(7, now));
    const kiloPrice = kilo.variants[0].price;
    expect(r.orders).toBe(3);
    expect(r.sales).toBe(90 + kiloPrice);
    expect(r.tips).toBe(15);
    expect(r.byDay).toHaveLength(7);
    expect(r.byDay.at(-1)).toMatchObject({ sales: 60, orders: 2 });
    expect(r.byDay.at(-3)).toMatchObject({ sales: 30 + kiloPrice, orders: 1 });
    expect(r.byHour[14]).toBe(60);
    expect(r.byHour[21]).toBe(30 + kiloPrice);
    expect(r.byMethod.efectivo).toBe(r.sales);
    expect(r.items[0]).toEqual({ name: 'Refresco Coca', qty: 3, total: 90 });
  });

  it('covers whole calendar months', () => {
    const orders = [paidAt(at(1, 10)), paidAt(new Date(2026, 8, 30, 22).getTime())];
    expect(salesReport(orders, month(0, now)).orders).toBe(1);
    expect(salesReport(orders, month(-1, now)).orders).toBe(1);
    expect(salesReport(orders, month(0, now)).byDay).toHaveLength(31);
  });
});
