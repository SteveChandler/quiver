

/**
 * Check if viewport has significantly changed to reduce API calls
 * @param current Current viewport coordinates and zoom
 * @param previous Previous viewport coordinates and zoom
 * @returns True if viewport has changed significantly
 */
export function hasViewportChanged(
  current: { lat: number; lon: number; zoom: number },
  previous: { lat: number; lon: number; zoom: number } | null
): boolean {
  if (!previous) return true;

  // Use larger coordinate thresholds to reduce calls (0.01 degrees ≈ 1km)
  const latChanged = Math.abs(current.lat - previous.lat) >= 0.01;
  const lonChanged = Math.abs(current.lon - previous.lon) >= 0.01;
  const zoomChanged = Math.abs(current.zoom - previous.zoom) >= 1;

  return latChanged || lonChanged || zoomChanged;
}
