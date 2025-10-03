const EARTH_RADIUS_MILES = 3958.761327;

export interface Coordinates {
  lat: number;
  lon: number;
}

export function milesBetween(a?: Coordinates | null, b?: Coordinates | null) {
  if (!a || !b) return null;

  const { lat: lat1, lon: lon1 } = a;
  const { lat: lat2, lon: lon2 } = b;

  if (
    !Number.isFinite(lat1) ||
    !Number.isFinite(lon1) ||
    !Number.isFinite(lat2) ||
    !Number.isFinite(lon2)
  ) {
    return null;
  }

  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const radLat1 = toRadians(lat1);
  const radLat2 = toRadians(lat2);

  const sinHalfDLat = Math.sin(dLat / 2);
  const sinHalfDLon = Math.sin(dLon / 2);

  const haversine =
    sinHalfDLat * sinHalfDLat +
    Math.cos(radLat1) * Math.cos(radLat2) * sinHalfDLon * sinHalfDLon;

  const arc = 2 * Math.asin(Math.min(1, Math.sqrt(haversine)));

  return EARTH_RADIUS_MILES * arc;
}

export function formatMiles(miles?: number, digits = 1) {
  if (typeof miles !== "number" || !Number.isFinite(miles) || miles < 0) {
    return "—";
  }

  if (miles === 0) {
    return "0.0 miles away";
  }

  if (miles < 0.05) {
    return "<0.1 miles away";
  }

  const factor = 10 ** Math.max(0, digits);
  const rounded = Math.round(miles * factor) / factor;

  return `${rounded.toFixed(digits)} miles away`;
}
