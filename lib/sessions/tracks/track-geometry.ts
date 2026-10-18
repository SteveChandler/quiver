type Point = { lat: number; lon: number };

const EARTH_RADIUS_M = 6_371_000;
const toRadians = (degrees: number): number => degrees * Math.PI / 180;

export function haversineM(a: Point, b: Point): number {
  const deltaLat = toRadians(b.lat - a.lat);
  const deltaLon = toRadians(b.lon - a.lon);
  const arc = Math.sin(deltaLat / 2) ** 2
    + Math.cos(toRadians(a.lat)) * Math.cos(toRadians(b.lat)) * Math.sin(deltaLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(arc)));
}

export function bearingDeg(a: Point, b: Point): number {
  const deltaLon = toRadians(b.lon - a.lon);
  const y = Math.sin(deltaLon) * Math.cos(toRadians(b.lat));
  const x = Math.cos(toRadians(a.lat)) * Math.sin(toRadians(b.lat))
    - Math.sin(toRadians(a.lat)) * Math.cos(toRadians(b.lat)) * Math.cos(deltaLon);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

export function angleDiffDeg(a: number, b: number): number {
  const difference = ((a - b) % 360 + 360) % 360;
  return Math.min(difference, 360 - difference);
}
