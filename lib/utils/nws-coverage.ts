/**
 * Coarse check for whether api.weather.gov can serve a point. NWS covers the US
 * and its territories only; points in Mexico/Canada/etc. answer 404 or 500, never data,
 * so callers should skip the request instead of logging a failure per beach per run.
 * Deliberately generous at the borders: a false "covered" just costs one request.
 */
export function isWithinNwsCoverage(lat: number, lon: number): boolean {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return false;

  // Alaska (incl. Aleutians crossing the antimeridian), Hawaii, Caribbean, Pacific territories.
  if (lat >= 51 && lat <= 72 && (lon <= -129 || lon >= 172)) return true;
  if (lat >= 18.5 && lat <= 22.5 && lon >= -161 && lon <= -154.5) return true;
  if (lat >= 17.5 && lat <= 18.8 && lon >= -68 && lon <= -64) return true;
  if (lat >= 13 && lat <= 21 && lon >= 144 && lon <= 146.2) return true;
  if (lat >= -15 && lat <= -13.5 && lon >= -171.5 && lon <= -168.5) return true;

  // Contiguous US bounding box, minus Mexico's border region.
  if (lat < 24.4 || lat > 49.6 || lon < -125.1 || lon > -66.8) return false;
  if (lat < 32.55 && lon < -114.7) return false; // Baja California, Sonora coast
  if (lat < 31.3 && lon < -106.5) return false;
  if (lon >= -106.5 && lat < 25.9 + (-97.15 - lon) * 0.631) return false; // Rio Grande
  return true;
}
