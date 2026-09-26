interface Point {
  lat: number;
  lon: number;
}

const EARTH_RADIUS_KM = 6371.0088;
const toRadians = (deg: number): number => (deg * Math.PI) / 180;
const toDegrees = (rad: number): number => (rad * 180) / Math.PI;

export function haversineKm(a: Point, b: Point): number {
  const dLat = toRadians(b.lat - a.lat);
  const dLon = toRadians(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(a.lat)) * Math.cos(toRadians(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

function bearingDeg(from: Point, to: Point): number {
  const lat1 = toRadians(from.lat);
  const lat2 = toRadians(to.lat);
  const dLon = toRadians(to.lon - from.lon);
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return (toDegrees(Math.atan2(y, x)) + 360) % 360;
}

/** Direction the beach faces, from two points along the shoreline and which side the sea is on. */
export function seawardNormalDeg(from: Point, to: Point, seaSide: "left" | "right"): number {
  const turn = seaSide === "right" ? 90 : -90;
  return (bearingDeg(from, to) + turn + 360) % 360;
}
