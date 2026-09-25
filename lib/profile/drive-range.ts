const MILES_PER_DRIVE_MINUTE = 0.5;
export const MAX_DRIVE_RADIUS_MILES = 100;

/**
 * Candidate radius for a profile's `max_drive_minutes`. NULL is the picker's
 * "No limit" choice, so it resolves to the largest supported radius rather
 * than a smaller default.
 */
export function driveRadiusMiles(maxDriveMinutes: number | null | undefined): number {
  if (typeof maxDriveMinutes !== 'number' || !Number.isFinite(maxDriveMinutes)) {
    return MAX_DRIVE_RADIUS_MILES;
  }
  return Math.min(
    MAX_DRIVE_RADIUS_MILES,
    Math.max(0, maxDriveMinutes * MILES_PER_DRIVE_MINUTE),
  );
}
