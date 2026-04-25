/**
 * NOAA grid-point resolution utilities.
 *
 * Beach coordinates routinely resolve to a coastal-land gridpoint in NOAA's
 * NWS grid (e.g. `SGX/53,34` for onshore Oceanside). Land gridpoints return
 * zeroed / missing `primarySwellHeight` / `secondarySwellHeight` / `wavePeriod2`
 * even though offshore neighbors carry real partition data.
 *
 * `getOceanGridPoint` nudges a beach coordinate ~0.05° (≈5 km) toward deeper
 * water before the `/points/{lat},{lon}` call so the resulting grid (gridId,
 * gridX, gridY) lands over the ocean and returns populated partitions.
 *
 * @module noaa-wavewatch/grid-utils
 */

/**
 * Coordinate shift magnitude in decimal degrees.
 * 0.05° ≈ 5.5 km at the equator (slightly less at higher latitudes) — enough
 * to move off most coastal-land grid cells without jumping to a distant
 * unrelated gridpoint.
 */
const OCEAN_SHIFT_DEG = 0.05;

/**
 * Shift a beach coordinate toward deeper water for NOAA grid resolution.
 *
 * Regions handled:
 * - Pacific coast (CA/OR/WA/Baja/AK): shift west (`lon -= 0.05`)
 * - Atlantic coast (ME→FL east): shift east (`lon += 0.05`)
 * - Gulf coast (TX→FL panhandle): shift south (`lat -= 0.05`)
 * - Hawaii: shift west (most HI surf faces N/W — this is the simplest
 *   heuristic that lands over water for the majority of spots)
 * - Unknown / inland: return input unchanged and let the normal grid
 *   resolution fallback handle it.
 *
 * @param lat - Latitude in decimal degrees
 * @param lon - Longitude in decimal degrees
 * @returns Shifted coordinate, or input unchanged for unknown regions
 */
export function getOceanGridPoint(
  lat: number,
  lon: number
): { lat: number; lon: number } {
  // Pacific coast — CA / OR / WA / Baja / AK / HI-mainland-range
  // Longitude < -100 captures everything west of roughly the 100th meridian;
  // latitude 22-60 captures Baja through southern AK. Ocean is to the WEST.
  if (lon < -100 && lon > -180 && lat >= 22 && lat <= 60) {
    return { lat, lon: lon - OCEAN_SHIFT_DEG };
  }

  // Atlantic coast — ME / NH / MA / RI / NY / NJ / DE / MD / VA / NC / SC / GA / FL-east
  // Longitude -82 to -65, latitude 24-50. Ocean is to the EAST.
  if (lon >= -82 && lon <= -65 && lat >= 24 && lat <= 50) {
    return { lat, lon: lon + OCEAN_SHIFT_DEG };
  }

  // Gulf coast — TX / LA / MS / AL / FL-panhandle
  // Longitude -98 to -82, latitude 24-31. Ocean is to the SOUTH.
  if (lon >= -98 && lon <= -82 && lat >= 24 && lat <= 31) {
    return { lat: lat - OCEAN_SHIFT_DEG, lon };
  }

  // Hawaii — latitude 18-23, longitude -160 to -154.
  // Most HI surf is on the N and W shores; shifting west is the simplest
  // heuristic that lands over water for the majority of spots. More nuanced
  // island-by-island logic can replace this later; for now, unknown cases
  // fall through to the default-passthrough and let grid fallback handle it.
  if (lat >= 18 && lat <= 23 && lon >= -160 && lon <= -154) {
    return { lat, lon: lon - OCEAN_SHIFT_DEG };
  }

  // Unknown region or inland — return unchanged
  return { lat, lon };
}
