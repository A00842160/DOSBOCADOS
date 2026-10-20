import { useLiveQuery } from 'dexie-react-hooks';
import { db, loadRecipes, recordMovements, RECIPES_KEY } from './db';
import {
  countMovement,
  setRecipeAmount,
  type Movement,
  type MovementKind,
  type Recipes,
  type Supply,
  type Unit,
  unitCost,
} from './domain/inventory';

export function useSupplies(): Supply[] {
  return useLiveQuery(async () => (await db.supplies.toArray()).sort((a, b) => a.name.localeCompare(b.name)), [], []);
}

export function useRecipes(): Recipes {
  return useLiveQuery(loadRecipes, [], {});
}

/** Movements since a moment, newest first. */
export function useMovementsSince(from: number): Movement[] {
  return useLiveQuery(async () => (await db.movements.where('at').aboveOrEqual(from).toArray()).reverse(), [from], []);
}

export async function addSupply(name: string, unit: Unit, minimum: number): Promise<void> {
  await db.supplies.put({ id: crypto.randomUUID(), name: name.trim(), unit, minimum, stock: 0 });
}

export async function updateSupply(id: string, change: Partial<Pick<Supply, 'name' | 'minimum' | 'cost'>>): Promise<void> {
  await db.supplies.update(id, change);
}

/** Removes a supply and its amounts from every recipe. Its history stays. */
export async function removeSupply(id: string): Promise<void> {
  await db.transaction('rw', db.supplies, db.settings, async () => {
    await db.supplies.delete(id);
    const recipes = await loadRecipes();
    let next = recipes;
    for (const variantId of Object.keys(recipes)) next = setRecipeAmount(next, variantId, id, 0);
    await db.settings.put({ key: RECIPES_KEY, value: next });
  });
}

export async function editRecipe(variantId: string, supplyId: string, qty: number): Promise<void> {
  await db.transaction('rw', db.settings, async () => {
    await db.settings.put({ key: RECIPES_KEY, value: setRecipeAmount(await loadRecipes(), variantId, supplyId, qty) });
  });
}

/**
 * Purchase or waste: an amount in or out. A count sets the stock to what was counted.
 * A purchase with what was paid also updates the supply's cost per unit.
 */
export async function registerMovement(
  supply: Supply,
  kind: Exclude<MovementKind, 'venta'>,
  qty: number,
  by?: string,
  paid?: number,
) {
  const now = Date.now();
  if (kind === 'conteo') {
    const fresh = await db.supplies.get(supply.id);
    const m = fresh && countMovement(fresh, qty, now, by);
    if (m) await recordMovements([m]);
    return;
  }
  if (qty <= 0) return;
  const cost = kind === 'compra' && paid ? paid : undefined;
  await recordMovements([
    { id: crypto.randomUUID(), supplyId: supply.id, qty: kind === 'merma' ? -qty : qty, kind, at: now, by, cost },
  ]);
  if (cost) await db.supplies.update(supply.id, { cost: unitCost(cost, qty) });
}
