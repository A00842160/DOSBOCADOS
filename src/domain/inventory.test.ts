import { describe, expect, it } from 'vitest';
import { PRODUCTS } from '../menu';
import {
  applyMovements,
  consumption,
  countMovement,
  daysLeft,
  formatQty,
  isLow,
  saleMovements,
  setRecipeAmount,
  usage,
  type Movement,
  type Recipes,
  type Supply,
} from './inventory';
import { addItem, newOrder, setQty } from './order';

const refresco = PRODUCTS.find((p) => p.id === 'refresco')!;
const kilo = PRODUCTS.find((p) => p.id === 'kilo')!;

const carne: Supply = { id: 'carne', name: 'Carne asada', unit: 'kg', minimum: 2, stock: 10 };
const coca: Supply = { id: 'coca', name: 'Coca', unit: 'pza', minimum: 6, stock: 24 };

const recipes: Recipes = {
  [kilo.variants[0].id]: { carne: 1, coca: 0 },
  [refresco.variants[0].id]: { coca: 1 },
};

describe('inventory', () => {
  it('works out what a bill uses, skipping cancelled lines', () => {
    let o = addItem(newOrder('mesa'), kilo, kilo.variants[0]);
    o = addItem(o, refresco, refresco.variants[0]);
    o = addItem(o, refresco, refresco.variants[0]);
    expect(consumption(o, recipes)).toEqual({ carne: 1, coca: 2 });
    o = setQty(o, o.lines[1].id, 0);
    expect(consumption(o, recipes)).toEqual({ carne: 1, coca: 0 });
    expect(saleMovements(o, recipes).map((m) => [m.supplyId, m.qty])).toEqual([['carne', -1]]);
  });

  it('keeps small recipe amounts exact', () => {
    let o = newOrder('mesa');
    for (let i = 0; i < 3; i++) o = addItem(o, refresco, refresco.variants[0]);
    expect(consumption(o, { [refresco.variants[0].id]: { carne: 0.1 } })).toEqual({ carne: 0.3 });
  });

  it('applies purchases, sales and counts to stock', () => {
    const moves: Movement[] = [
      { id: '1', supplyId: 'carne', qty: 5, kind: 'compra', at: 1 },
      { id: '2', supplyId: 'carne', qty: -12.5, kind: 'venta', at: 2 },
    ];
    const [c, k] = applyMovements([carne, coca], moves);
    expect(c.stock).toBe(2.5);
    expect(k).toBe(coca);
    expect(isLow(c)).toBe(false);
    expect(isLow({ ...c, stock: 2 })).toBe(true);
    expect(countMovement(c, 2.5)).toBeNull();
    expect(countMovement(c, 2)!.qty).toBe(-0.5);
  });

  it('summarises a week and estimates days left', () => {
    const moves: Movement[] = [
      { id: '1', supplyId: 'carne', qty: 20, kind: 'compra', at: 1 },
      { id: '2', supplyId: 'carne', qty: -14, kind: 'venta', at: 2 },
      { id: '3', supplyId: 'carne', qty: -0.5, kind: 'merma', at: 3 },
      { id: '4', supplyId: 'carne', qty: -0.25, kind: 'conteo', at: 4 },
    ];
    const u = usage(moves, 7).carne;
    expect(u).toEqual({ bought: 20, sold: 14, lost: 0.75, perDay: 2 });
    expect(daysLeft(carne, u.perDay)).toBe(5);
    expect(daysLeft(carne, 0)).toBeNull();
  });

  it('edits recipes and drops empty ones', () => {
    let r = setRecipeAmount({}, 'v', 'carne', 0.1);
    r = setRecipeAmount(r, 'v', 'coca', 1);
    expect(r).toEqual({ v: { carne: 0.1, coca: 1 } });
    r = setRecipeAmount(setRecipeAmount(r, 'v', 'carne', 0), 'v', 'coca', 0);
    expect(r).toEqual({});
  });

  it('formats amounts', () => {
    expect(formatQty(2.5, 'kg')).toBe('2.5 kg');
    expect(formatQty(12, 'pza')).toBe('12 pzas');
  });
});
