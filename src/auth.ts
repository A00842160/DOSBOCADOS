// PINs are stored only as salted SHA-256 hashes on the device. They keep the
// encargado and owner screens away from staff; they don't encrypt the data.

import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';
import { afterFailure, lockedFor, lockMessage, UNLOCKED, type PinLock } from './domain/pinLock';

export type Role = 'encargado' | 'dueno';

export interface PinHash {
  salt: string;
  hash: string;
}

export interface StaffMember extends PinHash {
  id: string;
  name: string;
}

export interface AuthSettings {
  owner?: PinHash;
  encargado?: PinHash;
  staff: StaffMember[];
}

const KEY = 'auth';
const EMPTY: AuthSettings = { staff: [] };

export async function hashPin(pin: string, salt: string = crypto.randomUUID()): Promise<PinHash> {
  const bytes = new TextEncoder().encode(`${salt}:${pin}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const hash = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
  return { salt, hash };
}

export async function pinMatches(pin: string, stored: PinHash | undefined): Promise<boolean> {
  if (!stored) return false;
  return (await hashPin(pin, stored.salt)).hash === stored.hash;
}

const LOCK_KEY = 'dosbocados.pinLock';

function readLock(): PinLock {
  try {
    return { ...UNLOCKED, ...JSON.parse(localStorage.getItem(LOCK_KEY) ?? '{}') };
  } catch {
    return memoryLock;
  }
}

function writeLock(lock: PinLock): void {
  memoryLock = lock;
  try {
    localStorage.setItem(LOCK_KEY, JSON.stringify(lock));
  } catch {
    // Private mode: the in-memory copy still pauses entry until the app restarts.
  }
}

let memoryLock: PinLock = UNLOCKED;

/**
 * Checks a PIN typed on any PIN pad. Returns an error to show, or null when it
 * matched. Wrong PINs count toward a pause shared by every pad.
 */
export async function verifyPin(pin: string, stored: PinHash | undefined): Promise<string | null> {
  const wait = lockedFor(readLock());
  if (wait > 0) return lockMessage(wait);
  if (await pinMatches(pin, stored)) {
    writeLock(UNLOCKED);
    return null;
  }
  const next = afterFailure(readLock());
  writeLock(next);
  const locked = lockedFor(next);
  return locked > 0 ? lockMessage(locked) : 'PIN incorrecto';
}

export async function loadAuth(): Promise<AuthSettings> {
  const row = await db.settings.get(KEY);
  return { ...EMPTY, ...(row?.value as AuthSettings | undefined) };
}

export function useAuth(): AuthSettings | undefined {
  return useLiveQuery(loadAuth, []);
}

async function saveAuth(change: (a: AuthSettings) => AuthSettings): Promise<void> {
  await db.transaction('rw', db.settings, async () => {
    await db.settings.put({ key: KEY, value: change(await loadAuth()) });
  });
}

export async function setRolePin(role: Role, pin: string): Promise<void> {
  const hashed = await hashPin(pin);
  await saveAuth((a) => (role === 'dueno' ? { ...a, owner: hashed } : { ...a, encargado: hashed }));
}

export async function removeEncargadoPin(): Promise<void> {
  await saveAuth((a) => ({ ...a, encargado: undefined }));
}

export async function addStaff(name: string, pin: string): Promise<void> {
  const hashed = await hashPin(pin);
  await saveAuth((a) => ({ ...a, staff: [...a.staff, { id: crypto.randomUUID(), name: name.trim(), ...hashed }] }));
}

export async function removeStaff(id: string): Promise<void> {
  await saveAuth((a) => ({ ...a, staff: a.staff.filter((s) => s.id !== id) }));
}

/** Returns the role a PIN unlocks. The owner PIN also opens everything the encargado sees. */
export async function roleForPin(pin: string, auth: AuthSettings): Promise<Role | null> {
  if (await pinMatches(pin, auth.owner)) return 'dueno';
  if (await pinMatches(pin, auth.encargado)) return 'encargado';
  return null;
}

export async function staffForPin(pin: string, auth: AuthSettings, staffId: string): Promise<StaffMember | null> {
  const member = auth.staff.find((s) => s.id === staffId);
  return member && (await pinMatches(pin, member)) ? member : null;
}
