import { describe, expect, it } from 'vitest';
import { PRODUCTS } from '../menu';
import {
  addItem,
  cancelOrder,
  canCancelOrder,
  hasKitchenWork,
  itemCount,
  markServed,
  newOrder,
  orderTotal,
  sendToKitchen,
  setNotes,
  setQty,
  type Order,
} from './order';

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

describe('kitchen flow', () => {
  it('sends pending lines as numbered batches', () => {
    let o = addItem(newOrder('mesa', { table: 1 }), taco, asada);
    const first = sendToKitchen(o);
    o = first.order;
    expect(first.batch.number).toBe(1);
    expect(first.batch.newLines).toHaveLength(1);
    expect(o.lines[0]).toMatchObject({ status: 'en-cocina', batch: 1 });
    expect(hasKitchenWork(o)).toBe(false);

    o = addItem(o, taco, campechano);
    const second = sendToKitchen(o);
    expect(second.batch.number).toBe(2);
    expect(second.batch.newLines.map((l) => l.name)).toEqual(['Taco Campechano']);
  });

  it('reports changes to lines already in the kitchen', () => {
    let o = sendToKitchen(addItem(newOrder('mesa', { table: 1 }), taco, asada)).order;
    o = setNotes(o, o.lines[0].id, ['Sin cebolla'], '');
    expect(hasKitchenWork(o)).toBe(true);
    const { batch, order } = sendToKitchen(o);
    expect(batch.newLines).toHaveLength(0);
    expect(batch.changedLines[0].mods).toEqual(['Sin cebolla']);
    expect(order.lines[0].changed).toBe(false);
  });

  it('locks lines once they are marked as served', () => {
    let o = sendToKitchen(addItem(newOrder('mesa', { table: 1 }), taco, asada)).order;
    o = markServed(o);
    expect(o.lines[0].status).toBe('salio');
    expect(canCancelOrder(o)).toBe(false);
    expect(cancelOrder(o).cancelledAt).toBeUndefined();
  });

  it('cancels an order whose food is still in the kitchen', () => {
    const o = cancelOrder(sendToKitchen(addItem(newOrder('llevar'), taco, asada)).order);
    expect(o.cancelledAt).toBeDefined();
    expect(o.lines[0]).toMatchObject({ cancelled: true, changed: true });
  });
});
