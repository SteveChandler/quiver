import {
  angularDistance,
  clusterPointsIntoBboxes,
  confidenceForSources,
  hasAmbiguousCoastline,
  nearestCoastlineSegments,
  roundBearing,
  segmentBearing,
  signedAngularDelta,
} from '../offshore-bearing-geometry';

describe('offshore bearing geometry', () => {
  it('clusters points into padded boxes no wider than 0.6 degrees', () => {
    const clusters = clusterPointsIntoBboxes([
      { lat: 32.7, lon: -117.2 },
      { lat: 32.9, lon: -117.1 },
      { lat: 34.0, lon: -118.0 },
    ], 0.56);
    expect(clusters).toHaveLength(2);
    expect(clusters[0].box.north - clusters[0].box.south).toBeLessThanOrEqual(0.6);
    expect(clusters[0].box.east - clusters[0].box.west).toBeLessThanOrEqual(0.6);
  });

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
