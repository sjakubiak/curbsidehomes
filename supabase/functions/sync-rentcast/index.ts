// Pulls active sale listings from RentCast for each configured area and upserts them into `listings`.
// Listings in a synced area that RentCast no longer returns are marked Inactive.
//
// Secrets (supabase secrets set ...):
//   RENTCAST_API_KEY  RentCast key. Server-side only; RentCast's terms don't allow sharing it with end users.
//   SYNC_AREAS        JSON list of areas, e.g. [{"city":"Austin","state":"TX"}] or [{"zipCode":"78704"}]
//   SYNC_SECRET       Callers must send it as `x-sync-secret`, so nobody else can run up the RentCast bill.
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase.
//
// Every RentCast request is billed, so each page of 500 listings costs one call per sync.

import { createClient } from 'npm:@supabase/supabase-js@2';

type Area = { city?: string; state?: string; zipCode?: string };

type RentCastListing = {
  id: string;
  formattedAddress: string;
  city?: string;
  state?: string;
  zipCode?: string;
  latitude?: number;
  longitude?: number;
  price?: number;
  propertyType?: string;
  bedrooms?: number;
  bathrooms?: number;
  squareFootage?: number;
  status?: string;
  listedDate?: string;
  lastSeenDate?: string;
  mlsNumber?: string;
};

const PAGE_SIZE = 500;
const MAX_PAGES_PER_AREA = 40; // 20,000 listings; a guard against runaway billing.

async function fetchArea(apiKey: string, area: Area): Promise<RentCastListing[]> {
  const all: RentCastListing[] = [];
  for (let page = 0; page < MAX_PAGES_PER_AREA; page++) {
    const params = new URLSearchParams({ status: 'Active', limit: String(PAGE_SIZE), offset: String(page * PAGE_SIZE) });
    for (const [k, v] of Object.entries(area)) if (v) params.set(k, v);
    const res = await fetch(`https://api.rentcast.io/v1/listings/sale?${params}`, {
      headers: { 'X-Api-Key': apiKey, Accept: 'application/json' },
    });
    if (!res.ok) throw new Error(`RentCast ${res.status}: ${await res.text()}`);
    const batch = (await res.json()) as RentCastListing[];
    all.push(...batch);
    if (batch.length < PAGE_SIZE) break;
  }
  return all;
}

const toRow = (l: RentCastListing, syncedAt: string) => ({
  id: l.id,
  address: l.formattedAddress,
  city: l.city ?? null,
  state: l.state ?? null,
  zip_code: l.zipCode ?? null,
  price: l.price,
  property_type: l.propertyType ?? null,
  bedrooms: l.bedrooms ?? null,
  bathrooms: l.bathrooms ?? null,
  sqft: l.squareFootage ?? null,
  status: 'Active',
  listed_date: l.listedDate ?? null,
  last_seen_date: l.lastSeenDate ?? null,
  mls_number: l.mlsNumber ?? null,
  location: `SRID=4326;POINT(${l.longitude} ${l.latitude})`,
  synced_at: syncedAt,
});

Deno.serve(async (req) => {
  const secret = Deno.env.get('SYNC_SECRET');
  if (!secret || req.headers.get('x-sync-secret') !== secret) {
    return new Response('Forbidden', { status: 403 });
  }
  const apiKey = Deno.env.get('RENTCAST_API_KEY');
  const areas = JSON.parse(Deno.env.get('SYNC_AREAS') ?? '[]') as Area[];
  if (!apiKey || areas.length === 0) {
    return Response.json({ error: 'Set RENTCAST_API_KEY and SYNC_AREAS' }, { status: 500 });
  }
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const syncedAt = new Date().toISOString();
  const summary: Record<string, number> = {};

  for (const area of areas) {
    const label = JSON.stringify(area);
    const listings = (await fetchArea(apiKey, area)).filter(
      (l) => l.price != null && l.latitude != null && l.longitude != null,
    );
    for (let i = 0; i < listings.length; i += 500) {
      const { error } = await db.from('listings').upsert(listings.slice(i, i + 500).map((l) => toRow(l, syncedAt)));
      if (error) throw error;
    }

    // Anything in this area we didn't just see is no longer for sale.
    let stale = db.from('listings').update({ status: 'Inactive' }).eq('status', 'Active').lt('synced_at', syncedAt);
    if (area.zipCode) stale = stale.eq('zip_code', area.zipCode);
    if (area.city) stale = stale.eq('city', area.city);
    if (area.state) stale = stale.eq('state', area.state);
    const { error } = await stale;
    if (error) throw error;

    summary[label] = listings.length;
  }

  return Response.json({ syncedAt, listings: summary });
});
