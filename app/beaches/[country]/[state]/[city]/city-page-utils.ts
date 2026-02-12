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
} from "@/lib/utils/beach-url-utils";
import type { BeachWithMetrics } from "@/types/location";

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
