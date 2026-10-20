import { describe, expect, it } from 'vitest';
import { PRODUCTS } from '../menu';
import { addItem, itemCount, newOrder, orderTotal, setNotes, setQty, type Order } from './order';

const taco = PRODUCTS.find((p) => p.id === 'taco')!;
const campechano = taco.variants.find((v) => v.name === 'Campechano')!;
const asada = taco.variants.find((v) => v.name === 'Asada')!;

function sent(order: Order, status: 'en-cocina' | 'salio'): Order {
  return { ...order, lines: order.lines.map((l) => ({ ...l, status })) };
}

describe('order', () => {
  it('merges repeated taps on the same variant into one line', () => {
    let o = newOrder('mesa', { table: 1 });
    o = addItem(o, taco, campechano);
    o = addItem(o, taco, campechano);
    o = addItem(o, taco, asada);
    expect(o.lines).toHaveLength(2);
    expect(o.lines[0]).toMatchObject({ name: 'Taco Campechano', qty: 2, unitPrice: 25 });
    expect(orderTotal(o)).toBe(75);
    expect(itemCount(o)).toBe(3);
  });

  it('starts a new line once the existing one has notes', () => {
    let o = addItem(newOrder('llevar'), taco, asada);
    o = setNotes(o, o.lines[0].id, ['Sin cebolla'], '');
    o = addItem(o, taco, asada);
    expect(o.lines).toHaveLength(2);
  });

  it('removes a pending line when its quantity reaches zero', () => {
    let o = addItem(newOrder('mesa', { table: 2 }), taco, asada);
    o = setQty(o, o.lines[0].id, 0);
    expect(o.lines).toHaveLength(0);
  });

  it('cancels a line that is in the kitchen but keeps it on record', () => {
    let o = sent(addItem(newOrder('mesa', { table: 2 }), taco, asada), 'en-cocina');
    o = setQty(o, o.lines[0].id, 0);
    expect(o.lines[0].cancelled).toBe(true);
    expect(orderTotal(o)).toBe(0);
  });

  it('does not let a line change after it left the kitchen', () => {
    let o = sent(addItem(newOrder('mesa', { table: 3 }), taco, asada), 'salio');
    const id = o.lines[0].id;
    o = setQty(o, id, 5);
    o = setNotes(o, id, ['Sin salsa'], 'x');
    o = setQty(o, id, 0);
    expect(o.lines[0]).toMatchObject({ qty: 1, mods: [], note: '' });
    expect(o.lines[0].cancelled).toBeUndefined();
  });
});
