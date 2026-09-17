import {
  angularDistance,
  confidenceForSources,
  hasAmbiguousCoastline,
  nearestCoastlineSegments,
  roundBearing,
  segmentBearing,
  signedAngularDelta,
} from '../offshore-bearing-geometry';

describe('offshore bearing geometry', () => {
  it('handles compass wraparound and rounding', () => {
    expect(angularDistance(355, 5)).toBe(10);
    expect(signedAngularDelta(5, 355)).toBe(10);
    expect(roundBearing(358)).toBe(0);
  });

  it('computes north/east segment bearings', () => {
    expect(segmentBearing({ lat: 0, lon: 0 }, { lat: 1, lon: 0 })).toBe(0);
    expect(segmentBearing({ lat: 0, lon: 0 }, { lat: 0, lon: 1 })).toBe(90);
  });

  it('finds the nearest coastline segment', () => {
    const result = nearestCoastlineSegments(
      { lat: 0, lon: 0.001 },
      [
        { wayId: 1, start: { lat: 0, lon: 0 }, end: { lat: 0.01, lon: 0 } },
        { wayId: 2, start: { lat: 1, lon: 1 }, end: { lat: 1.01, lon: 1 } },
      ],
    );
    expect(result?.segments.map(({ wayId }) => wayId)).toEqual([1]);
    expect(result?.distanceM).toBeCloseTo(111.32, 0);
  });

  it('requires nearby coastline geometry for confidence', () => {
    expect(confidenceForSources(270, 280, 275, 300)).toBe('HIGH');
    expect(confidenceForSources(null, 270, 310, 700)).toBe('MEDIUM');
    expect(confidenceForSources(270, 320, 270, 300)).toBe('MEDIUM');
    expect(confidenceForSources(270, null, null, null)).toBe('REVIEW');
    expect(confidenceForSources(270, 270, null, 300, true)).toBe('REVIEW');
    expect(confidenceForSources(270, 270, null, 1100)).toBe('REVIEW');
  });

  it('flags nearby coastline segments with conflicting orientation', () => {
    expect(hasAmbiguousCoastline(
      { lat: 0, lon: 0 },
      [
        { wayId: 1, start: { lat: 0, lon: 0 }, end: { lat: 0.001, lon: 0 } },
        { wayId: 2, start: { lat: 0, lon: 0 }, end: { lat: 0, lon: 0.001 } },
      ],
    )).toBe(true);
  });
});
