/**
 * Distance calculation utilities
 * Centralized implementation to eliminate code duplication across the codebase
 */

/**
 * Calculate distance between two geographic points using Haversine formula
 * @param lat1 Latitude of first point
 * @param lng1 Longitude of first point
 * @param lat2 Latitude of second point
 * @param lng2 Longitude of second point
 * @param unit Unit for result ('miles' | 'km' | 'meters')
 * @returns Distance in specified unit, or NaN if inputs are invalid
 */
export function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
  unit: "miles" | "km" | "meters" = "miles"
): number {
  // Validate inputs - return NaN for invalid coordinates
  if (
    !Number.isFinite(lat1) ||
    !Number.isFinite(lng1) ||
    !Number.isFinite(lat2) ||
    !Number.isFinite(lng2)
  ) {
    return NaN;
  }

  const R = unit === "miles" ? 3958.8 : 6371; // Earth's radius
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return unit === "meters" ? distance * 1000 : distance;
}

/**
 * Calculate distance and return formatted string
 * @returns Formatted distance string, or "—" if calculation fails
 */
export function calculateDistanceFormatted(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
  unit: "miles" | "km" = "miles"
): string {
  const distance = calculateDistance(lat1, lng1, lat2, lng2, unit);

  // Return fallback if distance is invalid
  if (!Number.isFinite(distance)) {
    return "—";
  }

  const unitLabel = unit === "miles" ? "miles" : "km";
  return `${distance.toFixed(1)} ${unitLabel}`;
}

/**
 * Helper function for miles calculation (legacy compatibility)
 */
export function calculateDistanceInMiles(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  return calculateDistance(lat1, lng1, lat2, lng2, "miles");
}

/**
 * Helper function for radians conversion
 */
export function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}
