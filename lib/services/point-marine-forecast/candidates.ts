export interface PointCoordinate {
  lat: number;
  lon: number;
}

const CANDIDATE_OFFSETS: ReadonlyArray<readonly [number, number]> = [
  [0, 0],
  [0.035, 0],
  [-0.035, 0],
  [0, 0.035],
  [0, -0.035],
  [0.05, 0.05],
  [0.05, -0.05],
  [-0.05, 0.05],
  [-0.05, -0.05],
];

export function normalizeLongitude(longitude: number): number {
  const normalized = ((longitude + 180) % 360 + 360) % 360 - 180;
  return normalized === -0 ? 0 : normalized;
}

export function buildPointForecastCandidates(
  requestedPoint: PointCoordinate,
): PointCoordinate[] {
  return CANDIDATE_OFFSETS
    .map(([latOffset, lonOffset]) => ({
      lat: requestedPoint.lat + latOffset,
      lon: latOffset === 0 && lonOffset === 0
        ? requestedPoint.lon
        : normalizeLongitude(requestedPoint.lon + lonOffset),
    }))
    .filter((point) => point.lat >= -90 && point.lat <= 90)
    .sort((first, second) => (
      distanceBetweenPointsMiles(requestedPoint, first)
      - distanceBetweenPointsMiles(requestedPoint, second)
    ));
}

export function distanceBetweenPointsMiles(
  first: PointCoordinate,
  second: PointCoordinate,
): number {
  const earthRadiusMiles = 3958.7613;
  const toRadians = (value: number): number => (value * Math.PI) / 180;
  const deltaLat = toRadians(second.lat - first.lat);
  const deltaLon = toRadians(normalizeLongitude(second.lon - first.lon));
  const firstLat = toRadians(first.lat);
  const secondLat = toRadians(second.lat);
  const a = Math.sin(deltaLat / 2) ** 2
    + Math.cos(firstLat) * Math.cos(secondLat) * Math.sin(deltaLon / 2) ** 2;
  return earthRadiusMiles * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function selectNearestValidCandidate<T extends PointCoordinate>(
  requestedPoint: PointCoordinate,
  candidates: T[],
): T | null {
  return candidates.reduce<T | null>((nearest, candidate) => {
    if (!nearest) return candidate;
    return distanceBetweenPointsMiles(requestedPoint, candidate)
      < distanceBetweenPointsMiles(requestedPoint, nearest)
      ? candidate
      : nearest;
  }, null);
}
