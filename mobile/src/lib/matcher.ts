import { angleDiff, bearingDegrees, distanceMeters } from './geo';
import type { AlertMode, Fix, Listing } from './types';

export const MATCH_RULES = {
  /** A listing counts as "beside you" within this distance. */
  radiusM: 80,
  /** Anything this close counts regardless of heading (GPS jitter, slow streets). */
  alwaysMatchM: 30,
  /** Relative bearing window (either side) that counts as beside rather than ahead or behind. */
  minAbeamDeg: 45,
  maxAbeamDeg: 135,
  /** Heading is only trusted above this speed (about 7 mph). */
  minHeadingSpeedMps: 3,
  /** Don't alert for the same listing again within this window. */
  realertAfterMs: 7 * 24 * 60 * 60 * 1000,
  /** At most one live alert in this window; extra matches only go to the drive log. */
  minAlertGapMs: 2 * 60 * 1000,
  /** Below this speed for parkedAfterMs counts as parked. */
  parkedSpeedMps: 1,
  parkedAfterMs: 2 * 60 * 1000,
} as const;

export type DriveState = {
  /** Listing id -> last time it matched. */
  seen: Record<string, number>;
  lastAlertAt: number | null;
  /** When speed first dropped below the parked threshold, or null while moving. */
  slowSince: number | null;
  /** Listings matched in save-for-later mode, waiting for the parked summary. */
  pending: Listing[];
};

export const initialDriveState = (): DriveState => ({
  seen: {},
  lastAlertAt: null,
  slowSince: null,
  pending: [],
});

export type Decision = {
  /** Listing to alert on now, if any. */
  alert: Listing | null;
  /** Newly passed listings to add to the drive log. */
  logged: Listing[];
  /** Listings to summarize because the driver has parked. */
  parkedSummary: Listing[] | null;
  state: DriveState;
};

/** Listings within the radius that are beside the car, nearest first. */
export function listingsBeside(fix: Fix, listings: Listing[]): Listing[] {
  const trustHeading =
    fix.heading != null && fix.heading >= 0 && (fix.speed ?? 0) >= MATCH_RULES.minHeadingSpeedMps;

  return listings
    .map((listing) => ({ listing, d: distanceMeters(fix.lat, fix.lng, listing.lat, listing.lng) }))
    .filter(({ listing, d }) => {
      if (d > MATCH_RULES.radiusM) return false;
      if (d <= MATCH_RULES.alwaysMatchM || !trustHeading) return true;
      const rel = Math.abs(angleDiff(fix.heading!, bearingDegrees(fix.lat, fix.lng, listing.lat, listing.lng)));
      return rel >= MATCH_RULES.minAbeamDeg && rel <= MATCH_RULES.maxAbeamDeg;
    })
    .sort((a, b) => a.d - b.d)
    .map(({ listing }) => listing);
}

export function decide(fix: Fix, listings: Listing[], prev: DriveState, mode: AlertMode): Decision {
  const now = fix.timestamp;
  const state: DriveState = { ...prev, seen: { ...prev.seen }, pending: [...prev.pending] };

  const fresh = listingsBeside(fix, listings).filter((l) => {
    const last = state.seen[l.id];
    return last == null || now - last >= MATCH_RULES.realertAfterMs;
  });
  for (const l of fresh) state.seen[l.id] = now;

  let alert: Listing | null = null;
  if (mode === 'live') {
    const gapOk = state.lastAlertAt == null || now - state.lastAlertAt >= MATCH_RULES.minAlertGapMs;
    if (fresh.length > 0 && gapOk) {
      alert = fresh[0];
      state.lastAlertAt = now;
    }
  } else {
    state.pending.push(...fresh);
  }

  const slow = fix.speed != null && fix.speed >= 0 && fix.speed < MATCH_RULES.parkedSpeedMps;
  state.slowSince = slow ? (state.slowSince ?? now) : null;

  let parkedSummary: Listing[] | null = null;
  if (
    state.slowSince != null &&
    now - state.slowSince >= MATCH_RULES.parkedAfterMs &&
    state.pending.length > 0
  ) {
    parkedSummary = state.pending;
    state.pending = [];
  }

  return { alert, logged: fresh, parkedSummary, state };
}
