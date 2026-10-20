import { describe, expect, it } from 'vitest';
import {
  addProduct,
  addVariant,
  DEFAULT_MENU,
  findProduct,
  productsOf,
  removeProduct,
  removeVariant,
  renameProduct,
  setPrice,
} from './menuEdit';

describe('menu editing', () => {
  it('changes a price without touching the built-in menu', () => {
    const refresco = findProduct(DEFAULT_MENU, 'refresco')!;
    const coca = refresco.variants[0];
    const menu = setPrice(DEFAULT_MENU, 'refresco', coca.id, 35);
    expect(findProduct(menu, 'refresco')!.variants[0].price).toBe(35);
    expect(coca.price).toBe(30);
    expect(setPrice(DEFAULT_MENU, 'refresco', coca.id, -1)).toBe(DEFAULT_MENU);
    expect(setPrice(DEFAULT_MENU, 'refresco', coca.id, 2.5)).toBe(DEFAULT_MENU);
  });

  it('adds and removes products and options with unique ids', () => {
    let menu = addProduct(DEFAULT_MENU, 'bebidas', 'Café de olla', 25);
    menu = addProduct(menu, 'bebidas', 'Café de olla', 30);
    const cafes = productsOf(menu, 'bebidas').filter((p) => p.name === 'Café de olla');
    expect(cafes.map((p) => p.id)).toEqual(['cafe-de-olla', 'cafe-de-olla-2']);
    expect(productsOf(menu, 'bebidas').at(-1)!.id).toBe('cafe-de-olla-2');

    menu = addVariant(menu, 'agua-fresca', 'Tamarindo', 30);
    menu = addVariant(menu, 'agua-fresca', 'Tamarindo', 30);
    const ids = findProduct(menu, 'agua-fresca')!.variants.map((v) => v.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain('agua-fresca.tamarindo-2');

    menu = removeVariant(menu, 'agua-fresca', 'agua-fresca.tamarindo-2');
    expect(findProduct(menu, 'agua-fresca')!.variants.map((v) => v.id)).not.toContain('agua-fresca.tamarindo-2');
    menu = removeProduct(menu, 'cafe-de-olla');
    expect(findProduct(menu, 'cafe-de-olla')).toBeUndefined();
  });

  it('keeps at least one price and a name', () => {
    const menu = addProduct(DEFAULT_MENU, 'extras', 'Cebollitas', 20);
    const only = findProduct(menu, 'cebollitas')!.variants[0];
    expect(removeVariant(menu, 'cebollitas', only.id)).toEqual(menu);
    expect(renameProduct(menu, 'cebollitas', '  ')).toBe(menu);
    expect(findProduct(renameProduct(menu, 'cebollitas', 'Cebollitas asadas'), 'cebollitas')!.name).toBe('Cebollitas asadas');
  });
});
