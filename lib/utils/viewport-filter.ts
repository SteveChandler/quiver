/**
 * Viewport filtering utilities for map-based beach display
 *
 * Used to filter beaches by geographic bounds when displaying in sidebars
 * or lists alongside map views. Designed for use in `useMemo` hooks.
 */

/**
 * Geographic bounds of a map viewport
 * Matches the bounds object from Mapbox GL
 */
export interface ViewportBounds {
  west: number;
  south: number;
  east: number;
  north: number;
}

/**
 * Filter beaches to only those within the viewport bounds
 *
 * Pure function designed for use in `useMemo` - no side effects, deterministic output.
 *
 * @param beaches - Array of beaches to filter
 * @param bounds - Viewport bounds from map component, or null if not available
 * @returns Filtered array of beaches within viewport, or original array if bounds is null
 *
 * @example
 * ```tsx
 * const visibleBeaches = useMemo(() => {
 *   return filterBeachesByViewport(allBeaches, mapBounds);
 * }, [allBeaches, mapBounds]);
 * ```
 */
export function filterBeachesByViewport<T extends { lat: number | null; lon: number | null }>(
  beaches: T[],
  bounds: ViewportBounds | null
): T[] {
  // Return all beaches if no bounds provided
  if (!bounds) {
    return beaches;
  }

  // Filter to only beaches with valid coordinates within bounds
  return beaches.filter((beach) => {
    // Exclude beaches with missing coordinates
    if (beach.lat == null || beach.lon == null) {
      return false;
    }

    // Check if beach is within viewport bounds
    const withinLatitude = beach.lat >= bounds.south && beach.lat <= bounds.north;
    const withinLongitude = beach.lon >= bounds.west && beach.lon <= bounds.east;

    return withinLatitude && withinLongitude;
  });
}
