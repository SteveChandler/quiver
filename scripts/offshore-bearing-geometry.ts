export type Point = { lat: number; lon: number };
export type CoastlineSegment = { wayId: number; start: Point; end: Point };
export type BoundingBox = { south: number; west: number; north: number; east: number };

export function clusterPointsIntoBboxes(
  points: Point[],
  maxUnpaddedSpan = 0.28,
  padding = 0.02,
): Array<{ box: BoundingBox; points: Point[] }> {
  const clusters = new Map<string, Point[]>();
  for (const point of points) {
    const key = `${Math.floor(point.lat / maxUnpaddedSpan)}:${Math.floor(point.lon / maxUnpaddedSpan)}`;
    clusters.set(key, [...(clusters.get(key) ?? []), point]);
  }
  return [...clusters.values()].map((cluster) => {
    const south = Math.min(...cluster.map(({ lat }) => lat));
    const west = Math.min(...cluster.map(({ lon }) => lon));
    const north = Math.max(...cluster.map(({ lat }) => lat));
    const east = Math.max(...cluster.map(({ lon }) => lon));
    return { box: { south: south - padding, west: west - padding, north: north + padding, east: east + padding }, points: cluster };
  });
}

export function normalizeAngle(degrees: number): number {
  return ((degrees % 360) + 360) % 360;
}

export function angularDistance(a: number, b: number): number {
  const difference = Math.abs(normalizeAngle(a) - normalizeAngle(b));
  return Math.min(difference, 360 - difference);
}

export function signedAngularDelta(target: number, current: number): number {
  const delta = normalizeAngle(target - current);
  return delta > 180 ? delta - 360 : delta;
}

export function roundBearing(degrees: number, increment = 5): number {
  return normalizeAngle(Math.round(normalizeAngle(degrees) / increment) * increment);
}

export function segmentBearing(start: Point, end: Point): number {
  const meanLat = ((start.lat + end.lat) / 2) * Math.PI / 180;
  const x = (end.lon - start.lon) * Math.cos(meanLat);
  const y = end.lat - start.lat;
  return normalizeAngle(Math.atan2(x, y) * 180 / Math.PI);
}

function localProjection(point: Point, origin: Point): { x: number; y: number } {
  const metersPerDegree = 111_320;
  return {
    x: (point.lon - origin.lon) * metersPerDegree * Math.cos(origin.lat * Math.PI / 180),
    y: (point.lat - origin.lat) * metersPerDegree,
  };
}

export function pointToSegmentDistance(point: Point, start: Point, end: Point): number {
  const p = localProjection(point, point);
  const a = localProjection(start, point);
  const b = localProjection(end, point);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, (-(a.x * dx + a.y * dy)) / lengthSquared));
  const x = a.x + t * dx;
  const y = a.y + t * dy;
  return Math.hypot(x, y);
}

export function nearestCoastlineSegments(point: Point, segments: CoastlineSegment[]): { segments: CoastlineSegment[]; distanceM: number } | null {
  if (segments.length === 0) return null;
  const distances = segments.map((segment) => ({ segment, distanceM: pointToSegmentDistance(point, segment.start, segment.end) }));
  const distanceM = Math.min(...distances.map((item) => item.distanceM));
  return {
    distanceM,
    segments: distances.filter((item) => item.distanceM <= distanceM + 5).map((item) => item.segment),
  };
}

export function hasAmbiguousCoastline(point: Point, segments: CoastlineSegment[], radiusM = 150): boolean {
  const nearby = segments
    .map((segment) => ({ segment, distanceM: pointToSegmentDistance(point, segment.start, segment.end) }))
    .filter(({ distanceM }) => distanceM <= radiusM)
    .map(({ segment }) => segmentBearing(segment.start, segment.end));
  return nearby.some((bearing, index) => nearby.slice(index + 1).some((other) => angularDistance(bearing, other) > 60));
}

export function circularMean(degrees: number[]): number | null {
  if (degrees.length === 0) return null;
  const vector = degrees.reduce((sum, degree) => {
    const radians = degree * Math.PI / 180;
    return { x: sum.x + Math.sin(radians), y: sum.y + Math.cos(radians) };
  }, { x: 0, y: 0 });
  return normalizeAngle(Math.atan2(vector.x, vector.y) * 180 / Math.PI);
}

export function confidenceForSources(
  aspect: number | null,
  geometry: number | null,
  windowCenter: number | null,
  distanceM: number | null,
  ambiguous = false,
): 'HIGH' | 'MEDIUM' | 'REVIEW' {
  if (geometry === null || distanceM === null || distanceM > 1000 || ambiguous) return 'REVIEW';
  const weakAgreement = [aspect, windowCenter].some((source) => source !== null && angularDistance(source, geometry) <= 45);
  if (distanceM <= 400 && weakAgreement) return 'HIGH';
  if (distanceM <= 1000) return 'MEDIUM';
  return 'REVIEW';
}
