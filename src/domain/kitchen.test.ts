import { describe, expect, it } from 'vitest';
import { PRODUCTS } from '../menu';
import { kitchenQueue, kitchenTimes, prepSummary, waitLevel } from './kitchen';
import { addItem, markServed, newOrder, sendToKitchen, setNotes, type Order } from './order';

const taco = PRODUCTS.find((p) => p.id === 'taco')!;
const papas = PRODUCTS.find((p) => p.categoryId === 'papas')!;
const MIN = 60 * 1000;
const t0 = new Date(2026, 9, 20, 14, 0).getTime();

function sent(order: Order, at: number): Order {
  return sendToKitchen(order, at).order;
}

describe('kitchen', () => {
  it('queues rounds oldest first with waiting minutes', () => {
    let a = addItem(newOrder('mesa', { table: 1 }, t0), taco, taco.variants[0]);
    a = sent(a, t0);
    a = sent(addItem(a, papas, papas.variants[0]), t0 + 5 * MIN);
    const b = sent(addItem(addItem(newOrder('llevar', {}, t0), taco, taco.variants[0]), taco, taco.variants[0]), t0 + 2 * MIN);

    const q = kitchenQueue([b, a], t0 + 16 * MIN);
    expect(q.map((r) => [r.order.id, r.batch, r.minutes])).toEqual([
      [a.id, 1, 16],
      [b.id, 1, 14],
      [a.id, 2, 11],
    ]);
    expect(q.map((r) => waitLevel(r.minutes))).toEqual(['late', 'warn', 'warn']);
    expect(kitchenQueue([markServed(a, t0 + 17 * MIN, 1)], t0 + 17 * MIN).map((r) => r.batch)).toEqual([2]);
  });

  it('adds up what to prepare with special requests', () => {
    let a = addItem(newOrder('mesa', { table: 1 }), taco, taco.variants[0]);
    a = setNotes(a, a.lines[0].id, ['Sin cebolla'], '');
    a = sent(a, t0);
    let b = addItem(newOrder('llevar'), taco, taco.variants[0]);
    b = addItem(b, taco, taco.variants[0]);
    b = sent(b, t0);
    const name = a.lines[0].name;
    expect(prepSummary(kitchenQueue([a, b], t0))).toEqual([{ name, qty: 3, notes: ['1 Sin cebolla'] }]);
  });

  it('measures how long rounds took to come out', () => {
    const range = { from: t0 - 60 * MIN, to: t0 + 24 * 60 * MIN };
    const orders = [5, 10, 20].map((m) =>
      markServed(sent(addItem(newOrder('mesa', { table: 1 }), taco, taco.variants[0]), t0), t0 + m * MIN),
    );
    const k = kitchenTimes(orders, range);
    expect(k.rounds).toBe(3);
    expect(k.averageMinutes).toBe(12);
    expect(k.latePercent).toBe(33);
    expect(k.byHour[14]).toBe(12);
    expect(k.byHour[13]).toBeNull();
    expect(k.slowest).toEqual([{ name: orders[0].lines[0].name, averageMinutes: 12, servings: 3 }]);
  });
});
