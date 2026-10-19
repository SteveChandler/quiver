/**
 * Beach wind orientation: which way offshore blows and how wide its cone is.
 *
 * Every surface that classifies wind against a beach (scoring, alerts,
 * recommendations, embeds) resolves missing data here so they agree. Native
 * mirrors this in quiver-native `src/lib/wind-relation.ts`.
 */

import { normalizeAngle } from './angle-utils';

/** Matches the `beaches.wind_offshore_tol_deg` column default and native. */
export const DEFAULT_WIND_OFFSHORE_TOL_DEG = 30;

export interface WindOrientationSource {
  wind_offshore_deg?: number | null;
  wind_offshore_tol_deg?: number | null;
  aspect_deg?: number | null;
}

export interface WindOrientation {
  /** Direction offshore wind blows from, 0-360; null when the beach has no orientation data. */
  offshoreDeg: number | null;
  toleranceDeg: number;
}

function finite(value: number | null | undefined): value is number {
  return value != null && Number.isFinite(value);
}

/**
 * Offshore = stored offshore bearing, else the opposite of the facing
 * direction, else unknown. Never a hardcoded compass default: east is
 * offshore on the West Coast and onshore on the East Coast.
 */
export function resolveOffshoreDeg(
  beach: WindOrientationSource | null | undefined,
): number | null {
  if (finite(beach?.wind_offshore_deg)) return normalizeAngle(beach.wind_offshore_deg);
  if (finite(beach?.aspect_deg)) return normalizeAngle(beach.aspect_deg + 180);
  return null;
}

export function resolveOffshoreToleranceDeg(
  beach: WindOrientationSource | null | undefined,
): number {
  const tol = beach?.wind_offshore_tol_deg;
  return finite(tol) && tol >= 0 ? tol : DEFAULT_WIND_OFFSHORE_TOL_DEG;
}

export function resolveWindOrientation(
  beach: WindOrientationSource | null | undefined,
): WindOrientation {
  return {
    offshoreDeg: resolveOffshoreDeg(beach),
    toleranceDeg: resolveOffshoreToleranceDeg(beach),
  };
}
