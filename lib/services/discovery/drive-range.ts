export const DEFAULT_MAX_DRIVE_MINUTES = 200;
export const MIN_CONFIGURED_DRIVE_MINUTES = 15;
export const MAX_CONFIGURED_DRIVE_MINUTES = 90;
export const MILES_PER_DRIVE_MINUTE = 0.5;

export function resolveMaxDriveMinutes(configuredMinutes: number | null): number {
  if (configuredMinutes === null || !Number.isFinite(configuredMinutes)) {
    return DEFAULT_MAX_DRIVE_MINUTES;
  }

  return Math.min(
    MAX_CONFIGURED_DRIVE_MINUTES,
    Math.max(MIN_CONFIGURED_DRIVE_MINUTES, Math.round(configuredMinutes)),
  );
}

export function resolveDriveRadiusMiles(configuredMinutes: number | null): number {
  return resolveMaxDriveMinutes(configuredMinutes) * MILES_PER_DRIVE_MINUTE;
}
