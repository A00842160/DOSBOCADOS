import { describe, expect, it } from 'vitest';
import { CATEGORIES, PRODUCTS } from './menu';

const priceOf = (productId: string, variantName = '') =>
  PRODUCTS.find((p) => p.id === productId)?.variants.find((v) => v.name === variantName)?.price;

describe('menu', () => {
  it('uses unique product and variant ids', () => {
    const productIds = PRODUCTS.map((p) => p.id);
    const variantIds = PRODUCTS.flatMap((p) => p.variants.map((v) => v.id));
    expect(new Set(productIds).size).toBe(productIds.length);
    expect(new Set(variantIds).size).toBe(variantIds.length);
  });

  it('puts every product in a known category with at least one priced variant', () => {
    const categoryIds = new Set(CATEGORIES.map((c) => c.id));
    for (const p of PRODUCTS) {
      expect(categoryIds.has(p.categoryId)).toBe(true);
      expect(p.variants.length).toBeGreaterThan(0);
      for (const v of p.variants) expect(v.price).toBeGreaterThan(0);
    }
  });

  it('matches prices from the owner menu', () => {
    expect(priceOf('taco', 'Campechano')).toBe(25);
    expect(priceOf('tostada', 'Asada')).toBe(40);
    expect(priceOf('volcan', 'Asada')).toBe(45);
    expect(priceOf('volcan', 'Chistorra')).toBe(50);
    expect(priceOf('queso-fundido', 'Natural')).toBe(105);
    expect(priceOf('queso-fundido', 'Asada')).toBe(115);
    expect(priceOf('queso-fundido', 'Chistorra')).toBe(115);
    expect(priceOf('queso-fundido', 'Campechano')).toBe(125);
    expect(priceOf('papas', 'Especial')).toBe(105);
    expect(priceOf('medio-kilo', 'Campechano')).toBe(300);
    expect(priceOf('kilo', 'Asada')).toBe(520);
    expect(priceOf('kilo', 'Campechano')).toBe(550);
    expect(priceOf('parrillada')).toBe(300);
    expect(priceOf('alambre')).toBe(205);
    expect(priceOf('torta', 'Campechana')).toBe(80);
    expect(priceOf('tortilla-harina')).toBe(10);
    expect(priceOf('agua-natural')).toBe(25);
    expect(priceOf('agua-fresca', 'Horchata')).toBe(30);
  });

  it('lists all eight aguas frescas and both refrescos', () => {
    expect(PRODUCTS.find((p) => p.id === 'agua-fresca')?.variants).toHaveLength(8);
    expect(PRODUCTS.find((p) => p.id === 'refresco')?.variants).toHaveLength(2);
  });
});
