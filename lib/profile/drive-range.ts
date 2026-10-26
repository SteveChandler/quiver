const MILES_PER_DRIVE_MINUTE = 0.5;
export const DEFAULT_DRIVE_MINUTES = 60;
export const NO_LIMIT_DRIVE_MINUTES = 200;
export const MAX_DRIVE_RADIUS_MILES = 100;

/**
 * Candidate radius for a profile's `max_drive_minutes`. Never-set (NULL or
 * undefined), non-finite, and non-positive values default to 60 minutes (30 mi).
 * Explicit "No limit" is stored as 200 minutes and resolves to the 100-mile cap;
 * other configured values use half a mile per minute, capped at 100 miles.
 */
export function driveRadiusMiles(maxDriveMinutes: number | null | undefined): number {
  if (typeof maxDriveMinutes !== 'number' || !Number.isFinite(maxDriveMinutes) || maxDriveMinutes <= 0) {
    return DEFAULT_DRIVE_MINUTES * MILES_PER_DRIVE_MINUTE;
  }
  return Math.min(
    MAX_DRIVE_RADIUS_MILES,
    maxDriveMinutes * MILES_PER_DRIVE_MINUTE,
  );
}
