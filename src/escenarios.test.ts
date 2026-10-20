// Service scenarios from the October 2026 test report, run against the real
// database layer (IndexedDB faked in memory).
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { CajaCerrada, db, mutateOrder, saveOrder, startDay } from './db';
import { closeDay, corte, openDay } from './domain/cash';
import { addItem, canCancelOrder, cancelOrder, MAX_QTY, markServed, newOrder, ownerCancelLine, sendToKitchen, setQty, type Order } from './domain/order';
import { addPayment, equalPart, remaining, settle } from './domain/payment';
import { PRODUCTS } from './menu';

const kilo = PRODUCTS.find((p) => p.id === 'kilo')!;
const campechano = kilo.variants.find((v) => v.name === 'Campechano')!;
const refresco = PRODUCTS.find((p) => p.id === 'refresco')!;

function mesa580(): Order {
  return addItem(addItem(newOrder('mesa', { table: 4 }), kilo, campechano), refresco, refresco.variants[0]);
}

const cash = (amount: number) => (o: Order) => addPayment(o, { method: 'efectivo', amount, tip: 0 });

async function corteOf(dayId: string) {
  return corte((await db.days.get(dayId))!, await db.orders.toArray());
}

beforeEach(async () => {
  await Promise.all([db.orders.clear(), db.days.clear()]);
});

describe('escenarios de servicio', () => {
  it('1. does not take a payment while the caja is closed', async () => {
    const id = await saveOrder(mesa580());
    await expect(mutateOrder(id, cash(580))).rejects.toBeInstanceOf(CajaCerrada);
    expect((await db.orders.get(id))!.payments ?? []).toHaveLength(0);

    const day = openDay(500);
    await startDay(day);
    await mutateOrder(id, cash(580));
    const c = await corteOf(day.id);
    expect(c.sales).toBe(580);
    expect(c.expectedCash).toBe(1080);
  });

  it('2. never changes a corte that is already closed', async () => {
    const day = openDay(500);
    await startDay(day);
    const id = await saveOrder(mesa580());
    await db.days.put(closeDay((await db.days.get(day.id))!, 500));
    const before = await corteOf(day.id);

    await expect(mutateOrder(id, cash(580))).rejects.toBeInstanceOf(CajaCerrada);
    const next = openDay(500);
    await startDay(next);
    await mutateOrder(id, cash(580));

    const after = await corteOf(day.id);
    expect(after.sales).toBe(before.sales);
    expect(after.expectedCash).toBe(before.expectedCash);
    expect(after.sales).toBe(0);
    expect((await corteOf(next.id)).sales).toBe(580);
  });

  it('2b. a bill paid after the corte does not join it even if still tagged with that day', () => {
    const day = openDay(500, undefined, 1000);
    const late = { ...addPayment(mesa580(), { method: 'efectivo', amount: 580, tip: 0 }, 3000), dayId: day.id };
    const c = corte(closeDay(day, 500, undefined, 2000), [late]);
    expect(c.sales).toBe(0);
    expect(c.expectedCash).toBe(500);
    expect(c.openOrders).toBe(1);
  });

  it('3. a double tap on Registrar is ignored by the screen, and a full bill takes no more money', async () => {
    await startDay(openDay(500));
    const id = await saveOrder(addItem(addItem(newOrder('mesa', { table: 1 }), refresco, refresco.variants[0]), refresco, refresco.variants[0]));
    // Even if two payments for the whole rest arrive, the second one finds nothing left.
    await Promise.all([mutateOrder(id, cash(60)), mutateOrder(id, cash(60))]);
    const o = (await db.orders.get(id))!;
    expect(o.payments).toHaveLength(1);
    expect(o.payments![0].amount).toBe(60);
  });

  it('4. an order with a payment cannot be cancelled, so the money stays in the corte', async () => {
    const day = openDay(500);
    await startDay(day);
    const id = await saveOrder(mesa580());
    await mutateOrder(id, cash(100));
    const o = (await db.orders.get(id))!;
    expect(canCancelOrder(o)).toBe(false);
    await mutateOrder(id, cancelOrder);
    expect((await db.orders.get(id))!.cancelledAt).toBeUndefined();
  });

  it('5. closes the bill when the owner takes back a dish and what was paid covers it', async () => {
    const day = openDay(500);
    await startDay(day);
    const id = await saveOrder(mesa580());
    await mutateOrder(id, (o) => markServed(sendToKitchen(o).order));
    await mutateOrder(id, cash(560));
    const kiloLine = (await db.orders.get(id))!.lines.find((l) => l.name.includes('Campechano'))!;

    let refund = 0;
    await mutateOrder(id, (o) => {
      const r = settle(ownerCancelLine(o, kiloLine.id));
      refund = r.refund;
      return r.order;
    });
    const o = (await db.orders.get(id))!;
    expect(o.closedAt).toBeDefined();
    expect(refund).toBe(530);
    expect(remaining(o)).toBe(0);
    expect((await corteOf(day.id)).expectedCash).toBe(530);
  });

  it('6. "Entre 3" gives everyone the same share', () => {
    let o = mesa580();
    expect(equalPart(o, 3)).toBe(194);
    o = addPayment(o, { method: 'efectivo', amount: equalPart(o, 3), tip: 0 });
    expect(equalPart(o, 3)).toBe(194);
    o = addPayment(o, { method: 'efectivo', amount: equalPart(o, 3), tip: 0 });
    expect(equalPart(o, 3)).toBe(192);
  });

  it('caps a dish at 99 pieces', () => {
    let o = addItem(newOrder('mesa', { table: 2 }), refresco, refresco.variants[0]);
    o = setQty(o, o.lines[0].id, 1000);
    expect(o.lines[0].qty).toBe(MAX_QTY);
    o = addItem(o, refresco, refresco.variants[0]);
    expect(o.lines[0].qty).toBe(MAX_QTY);
    expect(o.lines).toHaveLength(1);
  });
});
