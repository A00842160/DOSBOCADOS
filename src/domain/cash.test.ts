import { describe, expect, it } from 'vitest';
import { PRODUCTS } from '../menu';
import { addSalida, closeDay, corte, openDay, ordersForDay, removeSalida } from './cash';
import { addItem, cancelOrder, newOrder, sendToKitchen, type Order } from './order';
import { addPayment } from './payment';
import { corteTicket } from './ticket';

const kilo = PRODUCTS.find((p) => p.id === 'kilo')!;
const campechano = kilo.variants.find((v) => v.name === 'Campechano')!;
const refresco = PRODUCTS.find((p) => p.id === 'refresco')!;

function day() {
  return openDay(500, 'Encargado', 1000);
}

function scenario() {
  const d = day();
  // Mesa: $580, paid $300 cash + $280 Clip with $28 tip.
  let mesa: Order = addItem(addItem(newOrder('mesa', { table: 1, dayId: d.id }, 1100), kilo, campechano), refresco, refresco.variants[0]);
  mesa = addPayment(mesa, { method: 'efectivo', amount: 300, tip: 20, received: 400 });
  mesa = addPayment(mesa, { method: 'terminal', amount: 280, tip: 28 });
  // Para llevar: $30 by transfer.
  let llevar: Order = addItem(newOrder('llevar', { dayId: d.id }, 1200), refresco, refresco.variants[1]);
  llevar = addPayment(llevar, { method: 'transferencia', amount: 30, tip: 0 });
  // WhatsApp still open: $30.
  const abierto = addItem(newOrder('whatsapp', { dayId: d.id }, 1300), refresco, refresco.variants[0]);
  // Cancelled after reaching the kitchen.
  const cancelado = cancelOrder(sendToKitchen(addItem(newOrder('mesa', { table: 2, dayId: d.id }, 1400), refresco, refresco.variants[0])).order);
  // Another day's order is ignored.
  const otro = addPayment(addItem(newOrder('mesa', { table: 3, dayId: 'otro' }, 1500), refresco, refresco.variants[0]), {
    method: 'efectivo',
    amount: 30,
    tip: 0,
  });
  return { d, orders: [mesa, llevar, abierto, cancelado, otro] };
}

describe('corte de caja', () => {
  it('adds up sales, tips and expected cash', () => {
    let { d, orders } = scenario();
    d = addSalida(d, { kind: 'compra', amount: 150, concept: 'Tortillas' });
    d = addSalida(d, { kind: 'propinas', amount: 20, concept: '' });
    const c = corte(d, orders);
    expect(c.sales).toBe(610);
    expect(c.byMethod.efectivo).toEqual({ sales: 300, tips: 20 });
    expect(c.byMethod.terminal).toEqual({ sales: 280, tips: 28 });
    expect(c.byMethod.transferencia.sales).toBe(30);
    expect(c.tipsCash).toBe(20);
    expect(c.tipsCard).toBe(28);
    expect(c.salidas).toBe(170);
    // 500 fondo + 300 cash + 20 cash tips - 170 salidas
    expect(c.expectedCash).toBe(650);
    expect(c.orders).toBe(2);
    expect(c.averageTicket).toBe(305);
    expect(c.byChannel.mesa).toEqual({ orders: 1, sales: 580 });
    expect(c.byChannel.llevar).toEqual({ orders: 1, sales: 30 });
    expect(c.openOrders).toBe(1);
    expect(c.openAmount).toBe(30);
    expect(c.cancelledOrders).toBe(1);
    expect(c.cancelledLines).toBe(1);
    expect(c.items[0]).toEqual({ name: 'Kilo Campechano', qty: 1, total: 550 });
  });

  it('includes untagged orders made while the day was open', () => {
    const d = closeDay(day(), undefined, undefined, 2000);
    const before = newOrder('mesa', {}, 900);
    const during = newOrder('mesa', {}, 1500);
    const after = newOrder('mesa', {}, 2500);
    expect(ordersForDay([before, during, after], d)).toEqual([during]);
  });

  it('ignores empty salidas and freezes a closed day', () => {
    let d = addSalida(day(), { kind: 'otro', amount: 0, concept: 'nada' });
    expect(d.salidas).toHaveLength(0);
    d = addSalida(d, { kind: 'otro', amount: 50, concept: 'Gas' });
    const closed = closeDay(d, 600, 'Dueño');
    expect(addSalida(closed, { kind: 'otro', amount: 10, concept: 'x' })).toBe(closed);
    expect(removeSalida(closed, d.salidas[0].id)).toBe(closed);
    expect(removeSalida(d, d.salidas[0].id).salidas).toHaveLength(0);
  });

  it('prints the corte with the counted difference', () => {
    let { d, orders } = scenario();
    d = addSalida(d, { kind: 'compra', amount: 150, concept: 'Tortillas' });
    d = closeDay(d, 760, 'Dueño', 5000);
    const lines = corteTicket(d, corte(d, orders));
    expect(lines.every((l) => l.length <= 48)).toBe(true);
    const text = lines.join('\n');
    expect(text).toMatch(/= Esperado\s+\$670/);
    expect(text).toMatch(/Diferencia\s+\$90/);
    expect(text).toMatch(/Tortillas\s+\$150/);
    expect(text).toMatch(/ABIERTOS SIN COBRAR \(1\)\s+\$30/);
  });
});

describe('delivery apps', () => {
  it('keeps app orders out of the drawer and subtracts their commission', () => {
    const d = day();
    let uber: Order = addItem(newOrder('uber', { dayId: d.id, commissionRate: 30 }, 1100), kilo, campechano);
    uber = addPayment(uber, { method: 'plataforma', amount: 550, tip: 20 });
    const c = corte(d, [uber]);
    expect(c.sales).toBe(550);
    expect(c.byChannel.uber).toEqual({ orders: 1, sales: 550 });
    expect(c.byMethod.plataforma.sales).toBe(550);
    expect(c.commissions).toBe(165);
    expect(c.tipsCard).toBe(20);
    expect(c.expectedCash).toBe(500);
    const text = corteTicket(d, c).join('\n');
    expect(text).toMatch(/Uber Eats \(1\)\s+\$550/);
    expect(text).toMatch(/Comisiones de apps\s+\$165/);
    expect(text).toMatch(/Venta neta\s+\$385/);
    expect(text).not.toMatch(/Rappi/);
  });
});
