/**
 * A beach's shoaling buckets are fitted against one buoy's Hs. Applied to any
 * other buoy they scale the wrong waves: Andrew Molera showed 8.8 ft from a
 * buoy ~200 km away through buckets fitted to its own dead buoy (Nov 2026).
 */

/**
 * "CDIP 103", "103" and "0103" name the same station; ERDDAP pads ids to three
 * digits, so "71" and "071" are one buoy there.
 */
export function normalizeCdipStationId(id: string | null | undefined): string | null {
  if (id == null) return null;
  const bare = String(id).trim().replace(/^CDIP\s*/i, "").replace(/^0+(?=\d)/, "");
  return bare === "" ? null : bare;
}

export function calibrationReferenceStation(factors: unknown): string | null {
  if (factors == null || typeof factors !== "object") return null;
  const calibration = (factors as { calibration?: unknown }).calibration;
  if (calibration == null || typeof calibration !== "object") return null;
  const reference = (calibration as { reference_buoy?: unknown }).reference_buoy;
  return typeof reference === "string" ? normalizeCdipStationId(reference) : null;
}

/**
 * The beach's buckets when they were fitted against `stationId`, else null so
 * the reading takes the uncalibrated path. A missing reference_buoy keeps the
 * buckets: unknown provenance must not silently drop a calibration.
 */
export function shoalingFactorsForStation<T>(
  factors: T | null,
  stationId: string | null | undefined,
): T | null {
  if (factors == null || stationId == null) return factors;
  const reference = calibrationReferenceStation(factors);
  if (reference === null) return factors;
  return reference === normalizeCdipStationId(stationId) ? factors : null;
}
