/**
 * Shared utilities for the city/location listing page.
 *
 * Extracted from page.tsx to avoid duplicating Hawaii parsing
 * and metro config resolution between the page and metadata exports.
 */

import { isMetroArea, getMetroConfig } from "@/lib/constants/metro-areas";
import type { MetroAreaConfig } from "@/lib/constants/metro-areas";
import {
  parseHiIslandCitySlug,
  getHiIslandDisplayName,
  getBeachHrefSafe,
  isValidStateSlug,
} from "@/lib/utils/beach-url-utils";
import type { BeachWithMetrics, LocationIdentifier } from "@/types/location";
import { buildCitySlug } from "@/lib/seo/city-slug-utils";
import { COLLISION_CITY_MAP } from "@/lib/seo/city-collision-list";
import { slugifyAscii } from "@/lib/utils/text-utils";

export const SITE_ORIGIN = (
  process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
).replace(/\/$/, "");

export interface LocationPageParams {
  country: string;
  state: string;
  city: string;
}

export interface LocationPageProps {
  params: Promise<LocationPageParams>;
}

/**
 * Resolve display city name, handling Hawaii island-suffixed slugs.
 *
 * For Hawaii cities like "waimea-big-island", returns "Waimea (Big Island)".
 * For all other cities, returns the city name as-is.
 */
export function resolveDisplayCityName(
  cityName: string,
  stateSlug: string,
  citySlug: string
): string {
  const hiParsed =
    stateSlug?.toLowerCase() === "hi"
      ? parseHiIslandCitySlug(citySlug)
      : null;
  const islandDisplayName = hiParsed?.islandSlug
    ? getHiIslandDisplayName(hiParsed.islandSlug)
    : null;
  return islandDisplayName ? `${cityName} (${islandDisplayName})` : cityName;
}

/**
 * Resolve metro config if the city slug matches a metro area.
 */
export function resolveMetroConfig(
  citySlug: string
): MetroAreaConfig | null {
  return isMetroArea(citySlug) ? getMetroConfig(citySlug) : null;
}

/**
 * Slug of the city's /[intent]/[city] pages (tide, water-temp, best-time), or
 * null when the hub has none.
 *
 * Intent pages put a state suffix on city names that exist in several states
 * (/tide/long-beach-ca), so the bare hub slug 404s there. Every other hub keeps
 * its route slug: island-suffixed Hawaii slugs differ from slugifyAscii(city).
 * A metro has intent pages only when it is also one of its own cities
 * (San Diego yes, Orange County no).
 */
export function resolveIntentCitySlug(
  params: LocationPageParams,
  location: LocationIdentifier,
  metroConfig: MetroAreaConfig | null
): string | null {
  if (metroConfig) {
    const metroIsOwnCity = metroConfig.cities.some(
      (city) => slugifyAscii(city) === metroConfig.slug
    );
    return metroIsOwnCity ? params.city : null;
  }
  if (params.country.toLowerCase() !== "usa") return params.city;
  if (!COLLISION_CITY_MAP.has(slugifyAscii(location.city))) return params.city;
  return buildCitySlug(location.city, location.state, COLLISION_CITY_MAP);
}

/**
 * Get the Hawaii island display name for a city slug, if applicable.
 * Returns null for non-Hawaii states or slugs without island suffixes.
 */
export function resolveIslandDisplayName(
  stateSlug: string,
  citySlug: string
): string | null {
  const hiParsed =
    stateSlug?.toLowerCase() === "hi"
      ? parseHiIslandCitySlug(citySlug)
      : null;
  return hiParsed?.islandSlug
    ? getHiIslandDisplayName(hiParsed.islandSlug)
    : null;
}

/**
 * Build the canonical short URL path for a city page.
 *
 * USA cities:          /{state}/{city}          (e.g., /ca/san-diego)
 * International cities: /{country}/{region}/{city} (e.g., /mexico/baja-california/rosarito)
 */
export function buildCanonicalCityPath(params: LocationPageParams): string {
  const isUsa = params.country.toLowerCase() === "usa";
  if (isUsa && isValidStateSlug(params.state)) {
    return `/${params.state}/${params.city}`;
  }
  return `/${params.country}/${params.state}/${params.city}`;
}

/**
 * Build ItemList items for JSON-LD structured data (carousel SERP feature).
 */
export function buildItemListItems(
  beaches: BeachWithMetrics[]
): { name: string; url: string; position: number }[] {
  return beaches.flatMap((beach, index) => {
    const href = getBeachHrefSafe(beach);
    if (!href) return [];
    return [
      {
        name: beach.name,
        url: `${SITE_ORIGIN}${href}`,
        position: index + 1,
      },
    ];
  });
}
