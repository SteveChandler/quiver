import { MAX_DRIVE_RADIUS_MILES } from "@/lib/profile/drive-range";
import { calculateDistanceInMiles } from "@/lib/utils/distance-utils";

export const LOCATION_FIX_MAX_AGE_HOURS = 24;
/**
 * The morning Daily Call trusts only a fix from the last 12 hours. Returning
 * users reopen the app every ~14 h at the median (PostHog, 2026-10-11), so an
 * older fix is often from somewhere the surfer has since left; the home beach
 * is the better guess.
 */
export const DAILY_CALL_LOCATION_FIX_MAX_AGE_HOURS = 12;
/**
 * A fix too old to rank around still says where the surfer went. Three days
 * covers a trip's first mornings without the app being reopened.
 */
export const AWAY_FROM_HOME_FIX_MAX_AGE_HOURS = 72;

export interface LocationSnapshot {
  lat: number;
  lon: number;
  captured_at: string;
}

export interface LocationAnchor {
  anchor: { lat: number; lon: number } | null;
  source: "location" | "home" | "none";
}

export function resolveLocationAnchor(
  snapshot: LocationSnapshot | null | undefined,
  now: Date,
  homeBeach: { lat: number | null; lon: number | null } | null | undefined,
  maxAgeHours: number = LOCATION_FIX_MAX_AGE_HOURS,
): LocationAnchor {
  const ageMs = snapshot ? now.getTime() - Date.parse(snapshot.captured_at) : NaN;
  if (snapshot && ageMs >= 0 && ageMs <= maxAgeHours * 60 * 60 * 1000
    && Number.isFinite(snapshot.lat) && Number.isFinite(snapshot.lon)) {
    return { anchor: { lat: snapshot.lat, lon: snapshot.lon }, source: "location" };
  }
  if (homeBeach?.lat != null && homeBeach.lon != null
    && Number.isFinite(homeBeach.lat) && Number.isFinite(homeBeach.lon)) {
    return { anchor: { lat: homeBeach.lat, lon: homeBeach.lon }, source: "home" };
  }
  return { anchor: null, source: "none" };
}

/**
 * True when a recent fix puts the surfer farther from home than any drive
 * range, so home-beach picks would be for a place they are not. The fixed
 * 100-mile line, not the profile's drive radius, keeps a surfer who lives
 * inland of their home beach from counting as away.
 */
export function isAwayFromHome(
  snapshot: LocationSnapshot | null | undefined,
  now: Date,
  homeBeach: { lat: number | null; lon: number | null } | null | undefined,
  maxAgeHours: number = AWAY_FROM_HOME_FIX_MAX_AGE_HOURS,
): boolean {
  if (!snapshot || homeBeach?.lat == null || homeBeach.lon == null) return false;
  const ageMs = now.getTime() - Date.parse(snapshot.captured_at);
  if (!(ageMs >= 0 && ageMs <= maxAgeHours * 60 * 60 * 1000)) return false;
  if (!Number.isFinite(snapshot.lat) || !Number.isFinite(snapshot.lon)) return false;
  return calculateDistanceInMiles(
    { lat: snapshot.lat, lon: snapshot.lon },
    { lat: homeBeach.lat, lon: homeBeach.lon },
  ) > MAX_DRIVE_RADIUS_MILES;
}
