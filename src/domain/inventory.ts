// Supplies (meat, tortillas, sodas...) and how much of each a dish uses.
// When a bill is paid, its dishes take their supplies out of stock; purchases
// add to it and a physical count corrects it. Every change is a movement, so
// the owner can see where stock went.

import { activeLines, type Order } from './order';

export type Unit = 'kg' | 'lt' | 'pza' | 'paq';

/** Recipes are written in grams or millilitres for kilos and litres. */
export const UNITS: { id: Unit; label: string; recipeLabel: string; factor: number }[] = [
  { id: 'kg', label: 'kg', recipeLabel: 'g', factor: 1000 },
  { id: 'lt', label: 'litros', recipeLabel: 'ml', factor: 1000 },
  { id: 'pza', label: 'pzas', recipeLabel: 'pzas', factor: 1 },
  { id: 'paq', label: 'paq.', recipeLabel: 'paq.', factor: 1 },
];

export function unitInfo(unit: Unit) {
  return UNITS.find((u) => u.id === unit)!;
}

export interface Supply {
  id: string;
  name: string;
  unit: Unit;
  /** Warn when stock drops to this or below. */
  minimum: number;
  stock: number;
}

/** Per menu variant: how much of each supply one of it uses, in the supply's unit. */
export type Recipes = Record<string, Record<string, number>>;

export type MovementKind = 'compra' | 'venta' | 'conteo' | 'merma';

export const MOVEMENT_KINDS: { id: MovementKind; label: string }[] = [
  { id: 'compra', label: 'Compra' },
  { id: 'venta', label: 'Venta' },
  { id: 'conteo', label: 'Ajuste por conteo' },
  { id: 'merma', label: 'Merma' },
];

export interface Movement {
  id: string;
  supplyId: string;
  /** Positive adds to stock, negative takes from it. */
  qty: number;
  kind: MovementKind;
  at: number;
  orderId?: string;
  by?: string;
  note?: string;
}

/** Avoids 0.30000000000000004 after many small recipe amounts. */
export function round(qty: number): number {
  return Math.round(qty * 1000) / 1000;
}

/** What an order's dishes use up, per supply. */
export function consumption(order: Order, recipes: Recipes): Record<string, number> {
  const used: Record<string, number> = {};
  for (const line of activeLines(order)) {
    for (const [supplyId, qty] of Object.entries(recipes[line.variantId] ?? {})) {
      used[supplyId] = round((used[supplyId] ?? 0) + qty * line.qty);
    }
  }
  return used;
}

export function saleMovements(order: Order, recipes: Recipes, now = Date.now()): Movement[] {
  return Object.entries(consumption(order, recipes))
    .filter(([, qty]) => qty > 0)
    .map(([supplyId, qty]) => ({ id: crypto.randomUUID(), supplyId, qty: -qty, kind: 'venta', at: now, orderId: order.id }));
}

/** A physical count: the difference with what the app expected becomes an adjustment. */
export function countMovement(supply: Supply, counted: number, now = Date.now(), by?: string): Movement | null {
  const diff = round(counted - supply.stock);
  if (diff === 0) return null;
  return { id: crypto.randomUUID(), supplyId: supply.id, qty: diff, kind: 'conteo', at: now, by };
}

export function applyMovements(supplies: Supply[], movements: Movement[]): Supply[] {
  return supplies.map((s) => {
    const delta = movements.filter((m) => m.supplyId === s.id).reduce((sum, m) => sum + m.qty, 0);
    return delta === 0 ? s : { ...s, stock: round(s.stock + delta) };
  });
}

export function isLow(supply: Supply): boolean {
  return supply.minimum > 0 && supply.stock <= supply.minimum;
}

export interface SupplyUsage {
  bought: number;
  sold: number;
  /** Merma plus count corrections, as a positive amount lost (negative if a count found more). */
  lost: number;
  /** Average sold per day over the period. */
  perDay: number;
}

export function usage(movements: Movement[], days: number): Record<string, SupplyUsage> {
  const out: Record<string, SupplyUsage> = {};
  for (const m of movements) {
    const u = (out[m.supplyId] ??= { bought: 0, sold: 0, lost: 0, perDay: 0 });
    if (m.kind === 'compra') u.bought = round(u.bought + m.qty);
    if (m.kind === 'venta') u.sold = round(u.sold - m.qty);
    if (m.kind === 'merma' || m.kind === 'conteo') u.lost = round(u.lost - m.qty);
  }
  for (const u of Object.values(out)) u.perDay = round(u.sold / days);
  return out;
}

/** Whole days the current stock lasts at the recent pace, or null with no recent sales. */
export function daysLeft(supply: Supply, perDay: number): number | null {
  if (perDay <= 0) return null;
  return Math.max(0, Math.floor(supply.stock / perDay));
}

export function setRecipeAmount(recipes: Recipes, variantId: string, supplyId: string, qty: number): Recipes {
  const current = { ...(recipes[variantId] ?? {}) };
  if (qty > 0) current[supplyId] = qty;
  else delete current[supplyId];
  const next = { ...recipes };
  if (Object.keys(current).length) next[variantId] = current;
  else delete next[variantId];
  return next;
}

/** Shows an amount the way people say it: 2.5 kg, 300 g, 12 pzas. */
export function formatQty(qty: number, unit: Unit): string {
  const n = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 2 }).format(round(qty));
  return `${n} ${unitInfo(unit).label}`;
}
