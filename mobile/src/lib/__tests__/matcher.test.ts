import { describe, expect, it } from 'vitest';

import { decide, initialDriveState, listingsBeside, MATCH_RULES } from '../matcher';
import type { Fix, Listing } from '../types';

// About 0.0000090 degrees of latitude per meter, and 0.0000104 degrees of longitude per meter at 30°N.
const M_LAT = 1 / 111_195;
const M_LNG = 1 / 96_297;

const ORIGIN = { lat: 30.0, lng: -97.0 };

function listingAt(id: string, northM: number, eastM: number): Listing {
  return { id, address: `${id} Main St`, price: 500_000, lat: ORIGIN.lat + northM * M_LAT, lng: ORIGIN.lng + eastM * M_LNG };
}

function fixAt(northM: number, opts: Partial<Fix> = {}): Fix {
  return { lat: ORIGIN.lat + northM * M_LAT, lng: ORIGIN.lng, heading: 0, speed: 13, timestamp: 0, ...opts };
}

describe('listingsBeside', () => {
  it('matches a house to the side of the road', () => {
    expect(listingsBeside(fixAt(0), [listingAt('a', 0, 40)]).map((l) => l.id)).toEqual(['a']);
  });

  it('ignores a house far ahead in the direction of travel', () => {
    expect(listingsBeside(fixAt(0), [listingAt('a', 70, 5)])).toEqual([]);
  });

  it('ignores houses outside the radius', () => {
    expect(listingsBeside(fixAt(0), [listingAt('a', 0, MATCH_RULES.radiusM + 20)])).toEqual([]);
  });

  it('matches very close houses even straight ahead', () => {
    expect(listingsBeside(fixAt(0), [listingAt('a', 20, 0)]).map((l) => l.id)).toEqual(['a']);
  });

  it('ignores heading when moving slowly', () => {
    expect(listingsBeside(fixAt(0, { speed: 1 }), [listingAt('a', 70, 5)]).map((l) => l.id)).toEqual(['a']);
  });

  it('sorts nearest first', () => {
    const ids = listingsBeside(fixAt(0), [listingAt('far', 0, 70), listingAt('near', 0, -40)]).map((l) => l.id);
    expect(ids).toEqual(['near', 'far']);
  });
});

describe('decide', () => {
  it('alerts once per listing', () => {
    const listings = [listingAt('a', 0, 40)];
    const first = decide(fixAt(0, { timestamp: 0 }), listings, initialDriveState(), 'live');
    expect(first.alert?.id).toBe('a');
    expect(first.logged.map((l) => l.id)).toEqual(['a']);

    const again = decide(fixAt(0, { timestamp: 10 * 60_000 }), listings, first.state, 'live');
    expect(again.alert).toBeNull();
    expect(again.logged).toEqual([]);
  });

  it('throttles alerts but still logs every listing', () => {
    const first = decide(fixAt(0, { timestamp: 0 }), [listingAt('a', 0, 40)], initialDriveState(), 'live');
    const second = decide(fixAt(500, { timestamp: 30_000 }), [listingAt('b', 500, 40)], first.state, 'live');
    expect(second.alert).toBeNull();
    expect(second.logged.map((l) => l.id)).toEqual(['b']);

    const third = decide(
      fixAt(1000, { timestamp: MATCH_RULES.minAlertGapMs + 1 }),
      [listingAt('c', 1000, 40)],
      second.state,
      'live',
    );
    expect(third.alert?.id).toBe('c');
  });

  it('holds alerts in save-for-later mode until parked', () => {
    let { state, alert } = decide(fixAt(0, { timestamp: 0 }), [listingAt('a', 0, 40)], initialDriveState(), 'saveForLater');
    expect(alert).toBeNull();

    const stopped = decide(fixAt(2000, { speed: 0, timestamp: 60_000 }), [], state, 'saveForLater');
    expect(stopped.parkedSummary).toBeNull();
    state = stopped.state;

    const parked = decide(
      fixAt(2000, { speed: 0, timestamp: 60_000 + MATCH_RULES.parkedAfterMs }),
      [],
      state,
      'saveForLater',
    );
    expect(parked.parkedSummary?.map((l) => l.id)).toEqual(['a']);
    expect(parked.state.pending).toEqual([]);
  });

  it('resets the parked timer when moving again', () => {
    const { state } = decide(fixAt(0, { speed: 0, timestamp: 0 }), [], initialDriveState(), 'saveForLater');
    const moving = decide(fixAt(0, { speed: 10, timestamp: 1000 }), [], state, 'saveForLater');
    expect(moving.state.slowSince).toBeNull();
  });
});
