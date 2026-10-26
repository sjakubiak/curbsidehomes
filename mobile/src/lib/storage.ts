import Storage from 'expo-sqlite/kv-store';

import { initialDriveState, type DriveState } from './matcher';
import type { AlertMode, DriveLogEntry, Listing } from './types';

// The background location task runs outside React, so all shared state lives here.

const KEYS = {
  driveState: 'driveState',
  driveLog: 'driveLog',
  mode: 'alertMode',
  cache: 'listingCache',
  testListings: 'testListings',
} as const;

const MAX_LOG_ENTRIES = 500;

function read<T>(key: string, fallback: T): T {
  const raw = Storage.getItemSync(key);
  if (raw == null) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

const write = (key: string, value: unknown) => Storage.setItemSync(key, JSON.stringify(value));

export const getDriveState = () => read<DriveState>(KEYS.driveState, initialDriveState());
export const setDriveState = (s: DriveState) => write(KEYS.driveState, s);

export const getAlertMode = () => read<AlertMode>(KEYS.mode, 'live');
export const setAlertMode = (m: AlertMode) => write(KEYS.mode, m);

export const getDriveLog = () => read<DriveLogEntry[]>(KEYS.driveLog, []);
export function appendDriveLog(listings: Listing[], passedAt: number) {
  if (listings.length === 0) return;
  const next = [...listings.map((listing) => ({ listing, passedAt })), ...getDriveLog()];
  write(KEYS.driveLog, next.slice(0, MAX_LOG_ENTRIES));
}
export const clearDriveLog = () => write(KEYS.driveLog, []);

export type ListingCache = { lat: number; lng: number; fetchedAt: number; listings: Listing[] };
export const getListingCache = () => read<ListingCache | null>(KEYS.cache, null);
export const setListingCache = (c: ListingCache) => write(KEYS.cache, c);

export const getTestListings = () => read<Listing[]>(KEYS.testListings, []);
export const setTestListings = (l: Listing[]) => write(KEYS.testListings, l);
