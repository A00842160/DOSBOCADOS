// What the kitchen has to prepare right now, how long each round has waited,
// and afterwards how long food took to come out.

import { isOpen, type Order, type OrderLine } from './order';
import type { Range } from './report';

/** Minutes after which a round shows yellow, then red. */
export const WARN_MINUTES = 10;
export const LATE_MINUTES = 15;

const MINUTE = 60 * 1000;

export type WaitLevel = 'ok' | 'warn' | 'late';

export function waitLevel(minutes: number): WaitLevel {
  if (minutes >= LATE_MINUTES) return 'late';
  if (minutes >= WARN_MINUTES) return 'warn';
  return 'ok';
}

export interface KitchenRound {
  order: Order;
  batch: number;
  sentAt: number;
  lines: OrderLine[];
  minutes: number;
}

function cooking(line: OrderLine): boolean {
  return line.status === 'en-cocina' && !line.cancelled;
}

/** Every round still in the kitchen, the one waiting longest first. */
export function kitchenQueue(orders: Order[], now = Date.now()): KitchenRound[] {
  const rounds: KitchenRound[] = [];
  for (const order of orders.filter(isOpen)) {
    const byBatch = new Map<number, OrderLine[]>();
    for (const line of order.lines.filter(cooking)) {
      const batch = line.batch ?? 0;
      byBatch.set(batch, [...(byBatch.get(batch) ?? []), line]);
    }
    for (const [batch, lines] of byBatch) {
      // Rounds sent before times were recorded count from the order's last change.
      const sentAt = Math.min(...lines.map((l) => l.sentAt ?? order.updatedAt));
      rounds.push({ order, batch, sentAt, lines, minutes: Math.floor((now - sentAt) / MINUTE) });
    }
  }
  return rounds.sort((a, b) => a.sentAt - b.sentAt);
}

export interface PrepItem {
  name: string;
  qty: number;
  /** Special requests with how many carry them, e.g. "2 Sin cebolla". */
  notes: string[];
}

/** All dishes in the kitchen added up, so the cook can make them together. */
export function prepSummary(rounds: KitchenRound[]): PrepItem[] {
  const items = new Map<string, { qty: number; notes: Map<string, number> }>();
  for (const line of rounds.flatMap((r) => r.lines)) {
    const item = items.get(line.name) ?? { qty: 0, notes: new Map() };
    item.qty += line.qty;
    for (const note of [...line.mods, line.note].filter(Boolean)) {
      item.notes.set(note, (item.notes.get(note) ?? 0) + line.qty);
    }
    items.set(line.name, item);
  }
  return [...items.entries()]
    .map(([name, i]) => ({ name, qty: i.qty, notes: [...i.notes].map(([note, n]) => `${n} ${note}`) }))
    .sort((a, b) => b.qty - a.qty || a.name.localeCompare(b.name));
}

export interface KitchenTimes {
  /** Rounds that came out in the range. */
  rounds: number;
  averageMinutes: number;
  /** Share of rounds that took LATE_MINUTES or more, as a whole percent. */
  latePercent: number;
  /** Average minutes per hour of the day the round was sent, or null with no rounds. */
  byHour: (number | null)[];
  /** Dishes that take longest on average, with at least a few servings. */
  slowest: { name: string; averageMinutes: number; servings: number }[];
}

export function kitchenTimes(orders: Order[], range: Range): KitchenTimes {
  const rounds: { sentAt: number; minutes: number; names: string[] }[] = [];
  for (const order of orders) {
    const byBatch = new Map<number, OrderLine[]>();
    for (const line of order.lines) {
      if (line.cancelled || !line.sentAt || !line.servedAt) continue;
      if (line.servedAt < range.from || line.servedAt >= range.to) continue;
      const batch = line.batch ?? 0;
      byBatch.set(batch, [...(byBatch.get(batch) ?? []), line]);
    }
    for (const lines of byBatch.values()) {
      const sentAt = Math.min(...lines.map((l) => l.sentAt!));
      const servedAt = Math.max(...lines.map((l) => l.servedAt!));
      rounds.push({ sentAt, minutes: (servedAt - sentAt) / MINUTE, names: lines.map((l) => l.name) });
    }
  }

  const hours: number[][] = Array.from({ length: 24 }, () => []);
  const dishes = new Map<string, number[]>();
  for (const r of rounds) {
    hours[new Date(r.sentAt).getHours()].push(r.minutes);
    for (const name of new Set(r.names)) dishes.set(name, [...(dishes.get(name) ?? []), r.minutes]);
  }
  const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

  return {
    rounds: rounds.length,
    averageMinutes: rounds.length ? Math.round(avg(rounds.map((r) => r.minutes))) : 0,
    latePercent: rounds.length
      ? Math.round((rounds.filter((r) => r.minutes >= LATE_MINUTES).length / rounds.length) * 100)
      : 0,
    byHour: hours.map((xs) => (xs.length ? Math.round(avg(xs)) : null)),
    slowest: [...dishes]
      .filter(([, xs]) => xs.length >= 3)
      .map(([name, xs]) => ({ name, averageMinutes: Math.round(avg(xs)), servings: xs.length }))
      .sort((a, b) => b.averageMinutes - a.averageMinutes)
      .slice(0, 5),
  };
}
