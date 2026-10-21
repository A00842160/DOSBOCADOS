// The menu is modelled as base products with priced variants, so the three
// meat options (Asada / Chistorra / Campechano) don't become separate dishes.
// Prices are whole Mexican pesos. Sold-out state lives on the device (see
// availability.ts) so the encargado can change it during service.

export interface Variant {
  id: string;
  name: string;
  price: number;
  description?: string;
  favorite?: boolean;
}

export interface Product {
  id: string;
  categoryId: string;
  name: string;
  description?: string;
  variants: Variant[];
}

export interface Category {
  id: string;
  name: string;
  note?: string;
}

export const CATEGORIES: Category[] = [
  { id: 'tacos', name: 'Tacos' },
  { id: 'tostadas', name: 'Volcanes', note: 'Tostada con queso y guacamole' },
  { id: 'volcanes', name: 'Quesadillas', note: 'Tortilla de harina, incluyen queso y guacamole' },
  { id: 'queso', name: 'Queso fundido', note: 'Incluye 3 tortillas de harina' },
  { id: 'papas', name: 'Papas' },
  { id: 'kilos', name: 'Medio kilo / Kilo', note: 'Incluyen tortillas, limones, cebolla, cilantro y salsa' },
  { id: 'especialidades', name: 'Especialidades' },
  { id: 'tortas', name: 'Tortas' },
  { id: 'extras', name: 'Guarniciones y extras' },
  { id: 'bebidas', name: 'Bebidas', note: 'Sujetas a disponibilidad del día' },
];

type VariantSpec = [name: string, price: number, description?: string, favorite?: boolean];

function variants(productId: string, specs: VariantSpec[]): Variant[] {
  return specs.map(([name, price, description, favorite]) => ({
    id: `${productId}.${slug(name)}`,
    name,
    price,
    description,
    favorite,
  }));
}

function single(productId: string, price: number): Variant[] {
  return [{ id: `${productId}.unico`, name: '', price }];
}

export function slug(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function product(
  categoryId: string,
  id: string,
  name: string,
  variantList: Variant[] | ((productId: string) => Variant[]),
  description?: string,
): Product {
  return {
    id,
    categoryId,
    name,
    description,
    variants: typeof variantList === 'function' ? variantList(id) : variantList,
  };
}

const flavours = (names: string[], price: number): VariantSpec[] => names.map((name) => [name, price]);

export const PRODUCTS: Product[] = [
  product('tacos', 'taco', 'Taco', (id) =>
    variants(id, [
      ['Asada', 25, 'Carne asada con guacamole'],
      ['Chistorra', 25, 'Chistorra con guacamole'],
      ['Campechano', 25, 'Asada y chistorra con guacamole', true],
    ]),
  ),
  // The ids keep their first names (tostada, volcan) so recipes, sold-out marks
  // and past sales still match after the menu renamed them.
  product('tostadas', 'tostada', 'Volcán', (id) =>
    variants(id, [
      ['Asada', 40, 'Tostada con queso, carne asada y guacamole'],
      ['Chistorra', 40, 'Tostada con queso, chistorra y guacamole'],
      ['Campechano', 40, 'Tostada con queso, carne asada, chistorra y guacamole', true],
    ]),
  ),
  product('volcanes', 'volcan', 'Quesadilla', (id) =>
    variants(id, [
      ['Asada', 45, 'Tortilla de harina, queso, carne asada y guacamole'],
      ['Chistorra', 50, 'Tortilla de harina, queso, chistorra y guacamole'],
      ['Campechana', 50, 'Tortilla de harina, queso, asada, chistorra y guacamole', true],
    ]),
  ),
  product('queso', 'queso-fundido', 'Queso fundido', (id) =>
    variants(id, [
      ['Natural', 105, 'Sin carne'],
      ['Asada', 115],
      ['Chistorra', 115],
      ['Campechano', 125, 'Asada y chistorra', true],
    ]),
  ),
  product('papas', 'papas', 'Papas', (id) =>
    variants(id, [
      ['Asada', 90, 'Puré de papa, queso, carne asada, crema, cebolla y cilantro'],
      ['Chistorra', 95, 'Puré de papa, queso, chistorra, crema, cebolla y cilantro'],
      ['Campechana', 100, 'Puré de papa, queso, asada, chistorra, crema, cebolla y cilantro', true],
      ['Especial', 105, 'Puré de papa, queso, asada, chistorra, tocino, crema, cebolla y cilantro', true],
    ]),
  ),
  product('kilos', 'medio-kilo', 'Medio kilo', (id) =>
    variants(id, [
      ['Asada', 275, 'Media cebolla asada'],
      ['Campechano', 300, 'Media cebolla asada', true],
    ]),
  ),
  product('kilos', 'kilo', 'Kilo', (id) =>
    variants(id, [
      ['Asada', 520, 'Cebolla asada'],
      ['Campechano', 550, 'Cebolla asada', true],
    ]),
  ),
  product(
    'especialidades',
    'parrillada',
    'Parrillada',
    (id) => single(id, 300),
    'Carne asada, chistorra, 2 salchichas asadas, cebolla asada, tortillas y salsa',
  ),
  product(
    'especialidades',
    'alambre',
    'Alambre',
    (id) => single(id, 205),
    'Carne asada con pimiento morrón, cebolla, tocino y queso, con 3 tortillas de harina',
  ),
  product('tortas', 'torta', 'Torta', (id) =>
    variants(id, [
      ['Asada', 70, 'Mayonesa, carne asada y guacamole'],
      ['Chistorra', 75, 'Mayonesa, chistorra y guacamole'],
      ['Campechana', 80, 'Mayonesa, carne asada, chistorra y guacamole', true],
    ]),
  ),
  product('extras', 'cebolla-asada', 'Cebolla asada', (id) => single(id, 45)),
  product('extras', 'guacamole', 'Guacamole', (id) =>
    variants(id, [
      ['Natural', 70],
      ['Con cebolla y cilantro', 70],
    ]),
  ),
  product('extras', 'tostadas-extra', 'Tostadas (3)', (id) => single(id, 15)),
  product('extras', 'extra-queso', 'Extra queso', (id) => single(id, 15)),
  product('extras', 'tortilla-harina', 'Tortilla de harina (1)', (id) => single(id, 10)),
  product('extras', 'tortilla-maiz', 'Tortilla de maíz (5)', (id) => single(id, 15)),
  product('extras', 'salsa-extra', 'Salsa extra', (id) => single(id, 15)),
  product('bebidas', 'agua-natural', 'Agua natural', (id) => single(id, 25)),
  product('bebidas', 'refresco', 'Refresco', (id) => variants(id, flavours(['Coca', 'Coca Zero', 'Fresada Peñafiel', 'Piñada Peñafiel', 'Limonada Peñafiel', 'Naranjada Peñafiel'], 30))),
  product('bebidas', 'agua-fresca', 'Agua de sabor', (id) =>
    variants(
      id,
      flavours(['Maracuyá', 'Limón', 'Jamaica', 'Pepino-limón', 'Horchata'], 30),
    ),
  ),
];

export function productsIn(categoryId: string): Product[] {
  return PRODUCTS.filter((p) => p.categoryId === categoryId);
}

export function formatPrice(pesos: number): string {
  return `$${pesos.toLocaleString('es-MX')}`;
}
