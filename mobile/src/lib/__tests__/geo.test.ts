import { describe, expect, it } from 'vitest';

import { angleDiff, bearingDegrees, distanceMeters } from '../geo';

describe('distanceMeters', () => {
  it('measures about 111 km per degree of latitude', () => {
    expect(distanceMeters(30, -97, 31, -97)).toBeCloseTo(111_195, -2);
  });

  it('is zero for the same point', () => {
    expect(distanceMeters(30.27, -97.74, 30.27, -97.74)).toBe(0);
  });
});

describe('bearingDegrees', () => {
  it('points north, east, south and west', () => {
    expect(bearingDegrees(30, -97, 30.001, -97)).toBeCloseTo(0, 1);
    expect(bearingDegrees(30, -97, 30, -96.999)).toBeCloseTo(90, 1);
    expect(bearingDegrees(30, -97, 29.999, -97)).toBeCloseTo(180, 1);
    expect(bearingDegrees(30, -97, 30, -97.001)).toBeCloseTo(270, 1);
  });
});

describe('angleDiff', () => {
  it('wraps around north', () => {
    expect(angleDiff(350, 10)).toBe(20);
    expect(angleDiff(10, 350)).toBe(-20);
    expect(angleDiff(0, 180)).toBe(180);
  });
});
