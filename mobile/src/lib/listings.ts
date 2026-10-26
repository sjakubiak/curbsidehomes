import { distanceMeters } from './geo';
import { getListingCache, getTestListings, setListingCache } from './storage';
import type { Listing } from './types';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/** Listings are fetched for a circle this big around the car... */
const FETCH_RADIUS_M = 3000;
/** ...and refetched once the car is this far from the circle's center, or the cache is this old. */
const REFETCH_AFTER_M = 1500;
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

export const backendConfigured = () => Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

type ListingRow = {
  id: string;
  address: string;
  price: number;
  lat: number;
  lng: number;
  bedrooms: number | null;
  bathrooms: number | null;
  sqft: number | null;
};

async function fetchListingsNear(lat: number, lng: number): Promise<Listing[]> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/listings_near`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY!,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ lat, lng, radius_m: FETCH_RADIUS_M }),
  });
  if (!res.ok) throw new Error(`listings_near failed: ${res.status}`);
  const rows = (await res.json()) as ListingRow[];
  return rows.map((r) => ({ ...r }));
}

/**
 * Listings around a position, from the on-device cache when it still covers the area.
 * Hand-dropped test listings are always included.
 */
export async function listingsAround(lat: number, lng: number, now = Date.now()): Promise<Listing[]> {
  const tests = getTestListings();
  if (!backendConfigured()) return tests;

  const cache = getListingCache();
  const cacheOk =
    cache != null &&
    now - cache.fetchedAt < CACHE_TTL_MS &&
    distanceMeters(lat, lng, cache.lat, cache.lng) < REFETCH_AFTER_M;
  if (cacheOk) return [...cache.listings, ...tests];

  try {
    const listings = await fetchListingsNear(lat, lng);
    setListingCache({ lat, lng, fetchedAt: now, listings });
    return [...listings, ...tests];
  } catch (e) {
    console.warn(e);
    // Offline or backend down: keep using whatever we had.
    return [...(cache?.listings ?? []), ...tests];
  }
}
