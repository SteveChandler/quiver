/**
 * Beach URL utilities for hierarchical URL structure
 * Converts beach data to SEO-friendly URLs: /{state}/{city}/{beach-slug}
 */

import type { Beach } from "@/types/database";
import { slugify } from "@/lib/utils/text-utils";

/**
 * Map of state codes/names to URL slugs
 * Using short codes for US states for brevity
 * Handles both 2-letter codes and full state names
 */
const STATE_SLUG_MAP: Record<string, string> = {
  // US States (2-letter codes)
  CA: "ca",
  FL: "fl",
  GA: "ga",
  HI: "hi",
  MA: "ma",
  ME: "me",
  NC: "nc",
  NH: "nh",
  NJ: "nj",
  NY: "ny",
  OR: "or",
  PR: "pr",
  RI: "ri",
  SC: "sc",
  TX: "tx",
  WA: "wa",

  // US States (full names) - common surf states
  California: "ca",
  Florida: "fl",
  Georgia: "ga",
  Hawaii: "hi",
  Maine: "me",
  Massachusetts: "ma",
  "New Hampshire": "nh",
  "New Jersey": "nj",
  "New York": "ny",
  "North Carolina": "nc",
  Oregon: "or",
  "Puerto Rico": "pr",
  "Rhode Island": "ri",
  "South Carolina": "sc",
  Texas: "tx",
  Washington: "wa",

  // International locations
  "Baja California": "mexico/baja-california",
  // Add more states/regions as needed
};

/**
 * Convert state name or code to URL slug
 * Examples:
 *   "CA" → "ca"
 *   "Baja California" → "mexico/baja-california"
 */
export function stateToSlug(state: string | null | undefined): string {
  if (!state) return "";

  // Check if we have a direct mapping
  if (STATE_SLUG_MAP[state]) {
    return STATE_SLUG_MAP[state];
  }

  // Otherwise slugify the state name and lowercase
  return slugify(state).toLowerCase();
}

/**
 * Convert city name to URL slug
 * Examples:
 *   "San Diego" → "san-diego"
 *   "Huntington Beach" → "huntington-beach"
 */
export function cityToSlug(city: string | null | undefined): string {
  if (!city) return "";
  return slugify(city);
}

/**
 * Build hierarchical URL for a beach
 * Returns: /{state-slug}/{city-slug}/{beach-slug}
 *
 * @param beach - Beach object with slug, city, and state
 * @returns Hierarchical URL path (without domain)
 *
 * @example
 * buildBeachUrl({ slug: "ocean-beach", city: "San Diego", state: "CA" })
 * // Returns: "/ca/san-diego/ocean-beach"
 */
export function buildBeachUrl(beach: {
  slug: string | null;
  city: string | null;
  state: string | null;
}): string {
  const stateSlug = stateToSlug(beach.state);
  const citySlug = cityToSlug(beach.city);
  const beachSlug = beach.slug;

  if (!stateSlug || !citySlug || !beachSlug) {
    console.warn("Beach missing required URL components:", {
      state: beach.state,
      city: beach.city,
      slug: beach.slug,
    });
    // Fallback to old format if data is incomplete
    return `/beach/${beachSlug || "unknown"}`;
  }

  return `/${stateSlug}/${citySlug}/${beachSlug}`;
}

/**
 * Build hierarchical URL for a beach with optional tab parameter
 *
 * @param beach - Beach object
 * @param tab - Optional tab name (e.g., "reviews", "info", "gallery")
 * @returns Hierarchical URL path with query parameter
 *
 * @example
 * buildBeachUrlWithTab(beach, "reviews")
 * // Returns: "/ca/san-diego/ocean-beach?tab=reviews"
 */
export function buildBeachUrlWithTab(
  beach: {
    slug: string | null;
    city: string | null;
    state: string | null;
  },
  tab: string
): string {
  const baseUrl = buildBeachUrl(beach);
  return `${baseUrl}?tab=${tab}`;
}

/**
 * Parse hierarchical beach URL into components
 *
 * @param url - URL path like "/california/san-diego/ocean-beach"
 * @returns Object with state, city, and beach slug components
 *
 * @example
 * parseBeachUrl("/ca/san-diego/ocean-beach")
 * // Returns: { stateSlug: "ca", citySlug: "san-diego", beachSlug: "ocean-beach" }
 */
export function parseBeachUrl(url: string): {
  stateSlug: string;
  citySlug: string;
  beachSlug: string;
} | null {
  // Remove leading slash and query parameters
  const cleanUrl = url.replace(/^\//, "").split("?")[0];
  const parts = cleanUrl.split("/");

  if (parts.length !== 3) {
    return null;
  }

  return {
    stateSlug: parts[0],
    citySlug: parts[1],
    beachSlug: parts[2],
  };
}

/**
 * Build URL for state-level page (list of all beaches in state)
 *
 * @param state - State name or code
 * @returns State page URL
 *
 * @example
 * buildStateUrl("CA")
 * // Returns: "/ca"
 */
export function buildStateUrl(state: string | null | undefined): string {
  const stateSlug = stateToSlug(state);
  if (!stateSlug) return "/";
  return `/${stateSlug}`;
}

/**
 * Build URL for city-level page (list of all beaches in city)
 *
 * @param state - State name or code
 * @param city - City name
 * @returns City page URL
 *
 * @example
 * buildCityUrl("CA", "San Diego")
 * // Returns: "/ca/san-diego"
 */
export function buildCityUrl(
  state: string | null | undefined,
  city: string | null | undefined
): string {
  const stateSlug = stateToSlug(state);
  const citySlug = cityToSlug(city);

  if (!stateSlug || !citySlug) return "/";
  return `/${stateSlug}/${citySlug}`;
}

/**
 * Safely get beach URL with automatic fallback to ID-based URL
 * This is the recommended function for most components
 *
 * @param beach - Beach object with optional slug, city, state, and id
 * @returns Beach URL (hierarchical if possible, otherwise ID-based fallback) or null
 *
 * @example
 * // With full data - returns hierarchical URL
 * getBeachUrlSafe({ id: "123", slug: "ocean-beach", city: "San Diego", state: "CA" })
 * // Returns: "/ca/san-diego/ocean-beach"
 *
 * // With missing slug - returns ID fallback
 * getBeachUrlSafe({ id: "123", slug: null, city: "San Diego", state: "CA" })
 * // Returns: "/beach/123"
 *
 * // With no ID - returns null
 * getBeachUrlSafe({ slug: null, city: null, state: null })
 * // Returns: null
 */
export function getBeachUrlSafe(beach: {
  id?: string;
  slug?: string | null;
  city?: string | null;
  state?: string | null;
}): string | null {
  // Try hierarchical URL first if all required data is available
  if (beach.slug && beach.city && beach.state) {
    return buildBeachUrl({
      slug: beach.slug,
      city: beach.city,
      state: beach.state,
    });
  }

  // Fallback to slug-based URL if hierarchical data is missing
  if (beach.slug) {
    return `/beach/${beach.slug}`;
  }

  // We no longer fallback to ID-based URLs as they cause 404s or bad UX
  // if (beach.id) { return \`/beach/\${beach.id}\`; }

  // No valid URL can be generated
  return null;
}

/**
 * Get all valid state slugs from the STATE_SLUG_MAP
 * Useful for route validation to ensure dynamic [state] param is a real state
 *
 * @returns Array of unique state slug strings (e.g., ["ca", "or", "wa", "hi", ...])
 */
export function getValidStateSlugs(): string[] {
  return [...new Set(Object.values(STATE_SLUG_MAP))];
}

/**
 * Check if a given slug is a valid state slug
 * Used to validate dynamic route parameters and distinguish from intent slugs
 *
 * @param slug - The slug to validate (e.g., "ca", "or", "surf-forecast")
 * @returns true if the slug represents a valid state
 *
 * @example
 * isValidStateSlug("ca") // true
 * isValidStateSlug("or") // true
 * isValidStateSlug("surf-forecast") // false
 */
export function isValidStateSlug(slug: string): boolean {
  return getValidStateSlugs().includes(slug.toLowerCase());
}
