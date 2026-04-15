/**
 * Resolve Active Region (server-only)
 *
 * Single source of truth for deciding which forecast region drives the
 * /forecast hub page. Resolution order:
 *   1. Explicit URL override (`?region=...`)
 *   2. Authed user's home-beach region slug (provided by caller)
 *   3. IP cookie → nearest FORECAST_REGIONS entry via `getClosestRegion`
 *   4. Default: `southern-california` (largest user base, brand-truthful)
 *
 * @module lib/utils/resolve-active-region
 */

import { cookies } from "next/headers";

import {
  FORECAST_REGIONS,
  type ForecastRegion,
} from "@/lib/data/forecast-regions";
import {
  getIPLocationCookieName,
  parseIPLocationCookie,
} from "@/lib/location/ip-location";
import { getClosestRegion } from "@/lib/utils/forecast-hub-utils";

const DEFAULT_REGION_SLUG = "southern-california";

export interface ResolveActiveRegionOptions {
  /** Parsed `searchParams` from the server page (e.g. `{ region: "hawaii" }`). */
  searchParams?: { region?: string | string[] | undefined };
  /**
   * The authenticated user's home-beach region slug, if known.
   * Caller is responsible for the DB lookup to avoid coupling this helper
   * to auth or profile-fetching layers.
   */
  authedUserHomeRegionSlug?: string | null;
}

/**
 * Resolve the forecast region that should drive the /forecast hub page.
 *
 * Reads cookies via `next/headers` — opts the caller out of static ISR.
 */
export async function resolveActiveRegion(
  opts: ResolveActiveRegionOptions = {}
): Promise<ForecastRegion> {
  // 1. Explicit URL override wins
  const rawSlug = opts.searchParams?.region;
  const slug = Array.isArray(rawSlug) ? rawSlug[0] : rawSlug;
  if (slug && FORECAST_REGIONS[slug]) return FORECAST_REGIONS[slug];

  // 2. Authed user's home-beach region
  const authedSlug = opts.authedUserHomeRegionSlug;
  if (authedSlug && FORECAST_REGIONS[authedSlug]) {
    return FORECAST_REGIONS[authedSlug];
  }

  // 3. IP cookie → closest region
  try {
    const cookieStore = await cookies();
    const rawCookie = cookieStore.get(getIPLocationCookieName())?.value;
    if (rawCookie) {
      // The cookie writer stores JSON unencoded, but older clients may have
      // encoded values. Decode defensively — `decodeURIComponent` is a no-op
      // on already-decoded strings unless they contain `%`.
      let cookieValue = rawCookie;
      if (cookieValue.includes("%")) {
        try {
          cookieValue = decodeURIComponent(cookieValue);
        } catch {
          // leave as-is; parse will fail cleanly below
        }
      }
      const ip = parseIPLocationCookie(cookieValue);
      if (ip?.latitude != null && ip?.longitude != null) {
        const closest = getClosestRegion({
          lat: ip.latitude,
          lon: ip.longitude,
        });
        if (closest) return closest;
      }
    }
  } catch {
    // Fall through to default. Cookie reads throw outside a request context.
  }

  // 4. Default
  return FORECAST_REGIONS[DEFAULT_REGION_SLUG];
}
