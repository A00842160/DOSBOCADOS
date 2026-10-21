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

// Names and notes the built-in menu used before the October 2026 menu. A stored
// menu still carrying one of them gets the new text; anything the owner already
// changed by hand is left alone.
type CategoryText = Pick<Category, 'name' | 'note'>;
const RENAMED_CATEGORIES: Record<string, [from: CategoryText, to: Partial<CategoryText>]> = {
  tostadas: [{ name: 'Tostadas' }, { name: 'Volcanes', note: 'Tostada con queso y guacamole' }],
  volcanes: [
    { name: 'Volcanes', note: 'Tortilla de harina, incluyen queso y guacamole' },
    { name: 'Quesadillas' },
  ],
};
const RENAMED_PRODUCTS: Record<string, [from: string, to: string]> = {
  tostada: ['Tostada', 'Volcán'],
  volcan: ['Volcán', 'Quesadilla'],
  'agua-fresca': ['Agua fresca', 'Agua de sabor'],
};
const OLD_DESCRIPTIONS: Record<string, string | undefined> = {
  'tostada.asada': 'Queso, carne asada y guacamole',
  'tostada.chistorra': 'Queso, chistorra y guacamole',
  'tostada.campechano': 'Queso, carne asada, chistorra y guacamole',
  'volcan.asada': undefined,
  'volcan.chistorra': undefined,
  'volcan.campechana': undefined,
  'papas.asada': 'Puré de papa, queso, carne asada y crema',
  'papas.chistorra': 'Puré de papa, queso, chistorra y crema',
  'papas.campechana': 'Puré de papa, queso, asada, chistorra y crema',
  'papas.especial': 'Puré de papa, queso, asada, chistorra, tocino y crema',
};

/** Brings a menu stored on the device up to the current built-in names. */
export function upgradeMenu(menu: Menu): Menu {
  const builtIn = new Map(PRODUCTS.flatMap((p) => p.variants).map((v) => [v.id, v.description]));
  const categories = menu.categories.map((c) => {
    const rename = RENAMED_CATEGORIES[c.id];
    if (!rename || c.name !== rename[0].name || c.note !== rename[0].note) return c;
    return { ...c, ...rename[1] };
  });
  const products = menu.products.map((p) => {
    const rename = RENAMED_PRODUCTS[p.id];
    const variants = p.variants.map((v) =>
      v.id in OLD_DESCRIPTIONS && v.description === OLD_DESCRIPTIONS[v.id]
        ? { ...v, description: builtIn.get(v.id) }
        : v,
    );
    return { ...p, name: rename && p.name === rename[0] ? rename[1] : p.name, variants };
  });
  return { categories, products };
}
