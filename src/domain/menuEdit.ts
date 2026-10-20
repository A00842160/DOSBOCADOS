// The owner can change the menu from the app. The built-in menu in menu.ts is
// the starting point; the edited copy is stored on the device. Orders keep the
// name and price they were taken with, so editing never changes past bills.

import { CATEGORIES, PRODUCTS, slug, type Category, type Product, type Variant } from '../menu';

export interface Menu {
  categories: Category[];
  products: Product[];
}

export const DEFAULT_MENU: Menu = { categories: CATEGORIES, products: PRODUCTS };

export function productsOf(menu: Menu, categoryId: string): Product[] {
  return menu.products.filter((p) => p.categoryId === categoryId);
}

function uniqueId(base: string, taken: Set<string>): string {
  let id = base || 'item';
  for (let n = 2; taken.has(id); n++) id = `${base}-${n}`;
  return id;
}

function mapProduct(menu: Menu, productId: string, change: (p: Product) => Product): Menu {
  return { ...menu, products: menu.products.map((p) => (p.id === productId ? change(p) : p)) };
}

function validPrice(price: number): boolean {
  return Number.isInteger(price) && price >= 0;
}

export function setPrice(menu: Menu, productId: string, variantId: string, price: number): Menu {
  if (!validPrice(price)) return menu;
  return mapProduct(menu, productId, (p) => ({
    ...p,
    variants: p.variants.map((v) => (v.id === variantId ? { ...v, price } : v)),
  }));
}

export function renameVariant(menu: Menu, productId: string, variantId: string, name: string): Menu {
  return mapProduct(menu, productId, (p) => ({
    ...p,
    variants: p.variants.map((v) => (v.id === variantId ? { ...v, name: name.trim() } : v)),
  }));
}

export function renameProduct(menu: Menu, productId: string, name: string): Menu {
  if (!name.trim()) return menu;
  return mapProduct(menu, productId, (p) => ({ ...p, name: name.trim() }));
}

export function setDescription(menu: Menu, productId: string, description: string): Menu {
  return mapProduct(menu, productId, (p) => ({ ...p, description: description.trim() || undefined }));
}

/** Adds an option such as a new meat or flavour. A product with one unnamed price gets its first named option. */
export function addVariant(menu: Menu, productId: string, name: string, price: number): Menu {
  if (!name.trim() || !validPrice(price)) return menu;
  return mapProduct(menu, productId, (p) => {
    const taken = new Set(p.variants.map((v) => v.id));
    const variant: Variant = { id: uniqueId(`${p.id}.${slug(name)}`, taken), name: name.trim(), price };
    return { ...p, variants: [...p.variants, variant] };
  });
}

/** A product keeps at least one price. */
export function removeVariant(menu: Menu, productId: string, variantId: string): Menu {
  return mapProduct(menu, productId, (p) =>
    p.variants.length > 1 ? { ...p, variants: p.variants.filter((v) => v.id !== variantId) } : p,
  );
}

export function addProduct(menu: Menu, categoryId: string, name: string, price: number): Menu {
  if (!name.trim() || !validPrice(price)) return menu;
  const id = uniqueId(slug(name), new Set(menu.products.map((p) => p.id)));
  const product: Product = { id, categoryId, name: name.trim(), variants: [{ id: `${id}.unico`, name: '', price }] };
  const last = menu.products.map((p) => p.categoryId).lastIndexOf(categoryId);
  const products = [...menu.products];
  products.splice(last === -1 ? products.length : last + 1, 0, product);
  return { ...menu, products };
}

export function removeProduct(menu: Menu, productId: string): Menu {
  return { ...menu, products: menu.products.filter((p) => p.id !== productId) };
}

export function findProduct(menu: Menu, productId: string): Product | undefined {
  return menu.products.find((p) => p.id === productId);
}
