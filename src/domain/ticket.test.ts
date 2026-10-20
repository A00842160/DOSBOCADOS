import { describe, expect, it } from 'vitest';
import { PRODUCTS } from '../menu';
import { addItem, newOrder, sendToKitchen, setNotes, setQty } from './order';
import { billTicket, kitchenTicket, TICKET_WIDTH } from './ticket';

const taco = PRODUCTS.find((p) => p.id === 'taco')!;
const asada = taco.variants.find((v) => v.name === 'Asada')!;
const papas = PRODUCTS.find((p) => p.id === 'papas')!;
const especial = papas.variants.find((v) => v.name === 'Especial')!;

describe('tickets', () => {
  it('prints the kitchen ticket without prices and with notes', () => {
    let o = addItem(addItem(newOrder('mesa', { table: 4 }), taco, asada), taco, asada);
    o = setNotes(o, o.lines[0].id, ['Sin cebolla'], 'bien dorado');
    const { order, batch } = sendToKitchen(o);
    const text = kitchenTicket(order, batch).join('\n');
    expect(text).toContain('COCINA');
    expect(text).toContain('Ronda 1');
    expect(text).toContain('Mesa 4');
    expect(text).toContain(' 2  Taco Asada');
    expect(text).toContain('- Sin cebolla');
    expect(text).toContain('* bien dorado');
    expect(text).not.toContain('$');
  });

  it('lists cancelled lines under CAMBIOS', () => {
    let o = sendToKitchen(addItem(newOrder('llevar', { customerName: 'Ana' }), taco, asada)).order;
    o = setQty(o, o.lines[0].id, 0);
    const { order, batch } = sendToKitchen(o);
    const text = kitchenTicket(order, batch).join('\n');
    expect(text).toContain('Para llevar · Ana');
    expect(text).toContain('CAMBIOS:');
    expect(text).toContain('Taco Asada (CANCELADO)');
  });

  it('prints the bill with line totals and keeps every line within the width', () => {
    let o = addItem(newOrder('whatsapp', { customerName: 'Juan', phone: '2291234567' }), papas, especial);
    o = addItem(o, taco, asada);
    o = addItem(o, taco, asada);
    const lines = billTicket(o);
    expect(lines.join('\n')).toContain('Tel. 2291234567');
    expect(lines.some((l) => l.startsWith('2 Taco Asada') && l.endsWith('$50'))).toBe(true);
    expect(lines.some((l) => l.startsWith('TOTAL') && l.endsWith('$155'))).toBe(true);
    for (const l of lines) expect(l.length).toBeLessThanOrEqual(TICKET_WIDTH);
  });
});
