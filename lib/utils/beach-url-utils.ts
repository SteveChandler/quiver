/**
 * Beach URL utilities for hierarchical URL structure
 * Converts beach data to SEO-friendly URLs.
 *
 * Canonical patterns:
 * - USA:  /{state}/{city}/{beachSlug}
 * - Intl: /{country}/{regionState}/{city}/{beachSlug}
 */

import type { Beach } from "@/types/database";
import { slugifyAscii } from "@/lib/utils/text-utils";

// ============================================================================
// Hawaii island-specific city helpers (Waimea-only to start)
// ============================================================================

export type HiIslandSlug = "kauai" | "big-island";

const HI_AMBIGUOUS_CITY_SLUGS = new Set(["waimea"]);

const HI_ISLAND_DISPLAY_NAME: Record<HiIslandSlug, string> = {
  kauai: "Kauai",
  "big-island": "Big Island",
};

export function parseHiIslandCitySlug(citySlug: string): {
  baseCitySlug: string;
  islandSlug: HiIslandSlug | null;
} {
  const input = (citySlug || "").toLowerCase();

  // Only treat known ambiguous HI cities as island-splittable.
  for (const islandSlug of Object.keys(
    HI_ISLAND_DISPLAY_NAME
  ) as HiIslandSlug[]) {
    const suffix = `-${islandSlug}`;
    if (!input.endsWith(suffix)) continue;

    const baseCitySlug = input.slice(0, -suffix.length);
    if (!HI_AMBIGUOUS_CITY_SLUGS.has(baseCitySlug)) {
      return { baseCitySlug: input, islandSlug: null };
    }

    return { baseCitySlug, islandSlug };
  }

  return { baseCitySlug: input, islandSlug: null };
}

export function getHiIslandDisplayName(islandSlug: HiIslandSlug): string {
  return HI_ISLAND_DISPLAY_NAME[islandSlug] || islandSlug;
}

function getHiIslandSlugFromRegion(
  region: string | null | undefined
): HiIslandSlug | null {
  if (!region) return null;
  const s = slugifyAscii(region);

  if (s === "kauai") return "kauai";
  if (s === "big-island" || s === "hawaii" || s === "hawaii-island") {
    return "big-island";
  }
  return null;
}

/**
 * Build an island-correct city URL for Hawaii beaches when the city is ambiguous.
 *
 * Example (Waimea):
 * - Beach.region="Kauai"     -> /hi/waimea-kauai
 * - Beach.region="Big Island"-> /hi/waimea-big-island
 *
 * Falls back to buildCityUrl() when not applicable.
 */
export function buildHiCityUrlForBeach(beach: {
  state: string | null | undefined;
  city: string | null | undefined;
  region?: string | null | undefined;
}): string {
  const stateSlug = stateToSlug(beach.state);
  const baseCitySlug = cityToSlug(beach.city);

  if (!stateSlug || !baseCitySlug) return "/";

  // Only apply island suffixing for HI + known ambiguous city slugs.
  if (stateSlug !== "hi" || !HI_AMBIGUOUS_CITY_SLUGS.has(baseCitySlug)) {
    return buildCityUrl(beach.state, beach.city);
  }

  const islandSlug = getHiIslandSlugFromRegion(beach.region);
  if (!islandSlug) {
    return buildCityUrl(beach.state, beach.city);
  }

  return `/${stateSlug}/${baseCitySlug}-${islandSlug}`;
}

/**
 * Map of US state codes/names to URL slugs.
 *
 * IMPORTANT:
 * - Keep this map USA-only. `isValidStateSlug()` is used to disambiguate routing
 *   between state slugs and intent slugs (see `docs/architecture/URL_ROUTING.md`).
 */
export const US_STATE_SLUG_MAP: Record<string, string> = {
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
  VA: "va",
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
  Virginia: "va",
  Washington: "wa",
};

/**
 * Convert state name or code to URL slug
 * Examples:
 *   "CA" → "ca"
 *   "Baja California" → "baja-california" (international regions are handled separately)
 */
export function stateToSlug(state: string | null | undefined): string {
  if (!state) return "";

  // Check if we have a direct mapping
  if (US_STATE_SLUG_MAP[state]) {
    return US_STATE_SLUG_MAP[state];
  }

  // Otherwise slugify the state name and lowercase
  return slugifyAscii(state).toLowerCase();
}

export function normalizeBeachCountry(
  country: string | null | undefined,
): string | null {
  if (typeof country !== "string") return null;
  const normalized = country.trim();
  return normalized.length > 0 ? normalized : null;
}

export function isUsaCountry(country: string | null | undefined): boolean {
  // Preserve the legacy omitted-country behavior, but never classify an
  // explicitly unknown value as USA.
  if (country === undefined) return true;
  const normalized = normalizeBeachCountry(country)?.toLowerCase();
  if (!normalized) return false;
  return (
    normalized === "usa" ||
    normalized === "us" ||
    normalized === "united states" ||
    normalized === "united states of america"
  );
}

export function countryToSlug(country: string | null | undefined): string {
  const normalized = normalizeBeachCountry(country);
  if (!normalized) return "";
  return slugifyAscii(normalized).toLowerCase();
}

export function regionToSlug(region: string | null | undefined): string {
  if (!region) return "";
  return slugifyAscii(region).toLowerCase();
}

/**
 * Convert city name to URL slug
 *
 * Uses slugifyAscii to properly handle accented characters (diacritics).
 * This ensures "Rincón" → "rincon" (not "rinc-n" or "rincn").
 *
 * Examples:
 *   "San Diego" → "san-diego"
 *   "Huntington Beach" → "huntington-beach"
 *   "Rincón" → "rincon"
 *   "São Paulo" → "sao-paulo"
 */
export function cityToSlug(city: string | null | undefined): string {
  if (!city) return "";
  return slugifyAscii(city);
}

/**
 * Build hierarchical URL for a beach
 * Returns:
 * - USA:  /{state-slug}/{city-slug}/{beach-slug}
 * - Intl: /{country-slug}/{region-slug}/{city-slug}/{beach-slug}
 *
 * @param beach - Beach object with slug, city, state, and optional country
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
  country?: string | null;
}): string {
  const beachSlug = beach.slug;
  const citySlug = cityToSlug(beach.city);

  if (!citySlug || !beachSlug || !beach.state) {
    console.warn("Beach missing required URL components:", {
      state: beach.state,
      city: beach.city,
      slug: beach.slug,
      country: beach.country,
    });
    // Fallback to old format if data is incomplete
    return `/beach/${beachSlug || "unknown"}`;
  }

  const hasCountryField = Object.prototype.hasOwnProperty.call(beach, "country");
  if (hasCountryField && normalizeBeachCountry(beach.country) === null) {
    return `/beach/${beachSlug}`;
  }

  if (!hasCountryField || isUsaCountry(beach.country)) {
    const stateSlug = stateToSlug(beach.state);
    if (!stateSlug) return `/beach/${beachSlug}`;
    return `/${stateSlug}/${citySlug}/${beachSlug}`;
  }

  const countrySlug = countryToSlug(beach.country);
  const regionSlug = regionToSlug(beach.state);
  if (!countrySlug || !regionSlug) return `/beach/${beachSlug}`;

  return `/${countrySlug}/${regionSlug}/${citySlug}/${beachSlug}`;
}

export function buildInternationalCityUrl(
  country: string | null | undefined,
  regionState: string | null | undefined,
  city: string | null | undefined
): string {
  const countrySlug = countryToSlug(country);
  const regionSlug = regionToSlug(regionState);
  const citySlug = cityToSlug(city);
  if (!countrySlug || !regionSlug || !citySlug) return "/";
  return `/${countrySlug}/${regionSlug}/${citySlug}`;
}

export function buildInternationalBeachUrl(
  country: string | null | undefined,
  regionState: string | null | undefined,
  city: string | null | undefined,
  beachSlug: string | null | undefined
): string {
  const countrySlug = countryToSlug(country);
  const regionSlug = regionToSlug(regionState);
  const citySlug = cityToSlug(city);
  if (!countrySlug || !regionSlug || !citySlug || !beachSlug) return "/";
  return `/${countrySlug}/${regionSlug}/${citySlug}/${beachSlug}`;
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
    country?: string | null;
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
 * Return a US state listing URL path (e.g. "/beaches/usa/ca") when the input
 * maps to a valid 2-letter US state slug. Returns null for non-US / international states.
 *
 * This is useful for schema generation and internal navigation where we only
 * want crawlable state-root routes for valid US states.
 *
 * Previously returned "/{stateSlug}" (e.g. "/ca") which pointed to non-existent
 * routes. The canonical state listing pages live at "/beaches/usa/{stateSlug}".
 */
export function getUsStateRootPathOrNull(
  state: string | null | undefined
): string | null {
  const stateSlug = stateToSlug(state);
  if (!stateSlug) return null;
  if (!isValidStateSlug(stateSlug)) return null;
  return `/beaches/usa/${stateSlug}`;
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
  country?: string | null;
}): string | null {
  // An explicit null country means the location lookup is incomplete. Keep
  // the link country-independent instead of guessing a US route for Mexico.
  if (beach.country === null && beach.slug) {
    return `/beach/${beach.slug}`;
  }

  // Try hierarchical URL first if all required data is available
  if (beach.slug && beach.city && beach.state) {
    const beachForUrl: {
      slug: string;
      city: string;
      state: string;
      country?: string | null;
    } = {
      slug: beach.slug,
      city: beach.city,
      state: beach.state,
    };
    if (Object.prototype.hasOwnProperty.call(beach, "country")) {
      beachForUrl.country = beach.country;
    }
    return buildBeachUrl(beachForUrl);
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
 * Get a crawlable internal beach href, even when hierarchical data is missing.
 *
 * Priority:
 * 1) Hierarchical URL via getBeachUrlSafe() (or its slug fallback)
 * 2) /beach/{slug}
 * 3) /beach/{id}
 * 4) null (caller should omit link instead of using "#")
 *
 * NOTE: /beach/[slug] route supports back-compat ID lookups, so /beach/{id}
 * is an acceptable last-resort internal link.
 */
export function getBeachHrefSafe(beach: {
  id?: string | null;
  slug?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
}): string | null {
  const safe = getBeachUrlSafe({
    id: beach.id ?? undefined,
    slug: beach.slug ?? undefined,
    city: beach.city ?? undefined,
    state: beach.state ?? undefined,
    ...(Object.prototype.hasOwnProperty.call(beach, "country")
      ? { country: beach.country }
      : {}),
  });
  if (safe) return safe;

  if (beach.slug) return `/beach/${beach.slug}`;
  if (beach.id) return `/beach/${beach.id}`;

  return null;
}

/**
 * Get all valid state slugs from the STATE_SLUG_MAP
 * Useful for route validation to ensure dynamic [state] param is a real state
 *
 * @returns Array of unique state slug strings (e.g., ["ca", "or", "wa", "hi", ...])
 */
export function getValidStateSlugs(): string[] {
  return [...new Set(Object.values(US_STATE_SLUG_MAP))];
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

/**
 * Coastal US state slugs prioritized by surfing popularity.
 * Used for state-suffix city resolution (e.g., finding "belmar-nj" from "belmar").
 *
 * This list is intentionally ordered by surfing popularity to optimize
 * the search process when trying state suffixes.
 */
export const COASTAL_STATE_SUFFIXES = [
  "ca", "fl", "hi", "nc", "sc", "nj", "ny", "or", "wa", "tx", "ma", "me", "ri", "pr"
] as const;

export type CoastalStateSuffix = typeof COASTAL_STATE_SUFFIXES[number];

// ============================================================================
// Country Validation
// ============================================================================

/**
 * Valid country slugs for the location page route.
 *
 * This set prevents intent slugs (beginner, sunset, etc.) from being
 * incorrectly matched as the country parameter in /beaches/[country]/[state]/[city]
 * routes, which would cause broken beach URLs to be generated.
 *
 * @see app/beaches/[country]/[state]/[city]/page.tsx
 */
const VALID_COUNTRY_SLUGS = new Set(["usa", "mexico"]);

/**
 * Validate if a slug represents a valid country in the routing system.
 *
 * @param slug - The slug to validate (e.g., "usa", "mexico", "beginner")
 * @returns true if the slug represents a valid country
 *
 * @example
 * isValidCountrySlug("usa")      // true
 * isValidCountrySlug("mexico")   // true
 * isValidCountrySlug("beginner") // false (intent, not country)
 */
export function isValidCountrySlug(slug: string): boolean {
  if (!slug) return false;
  return VALID_COUNTRY_SLUGS.has(slug.toLowerCase());
}

/**
 * Get a human-friendly US state display name from a 2-letter state slug.
 *
 * Examples:
 * - "ca" -> "California"
 * - "nj" -> "New Jersey"
 * Falls back to the uppercased slug when unknown.
 */
export function getUsStateDisplayNameFromSlug(stateSlug: string): string {
  const slug = (stateSlug || "").toLowerCase();
  if (!slug) return "";

  // Prefer full state names (e.g., "California") over 2-letter codes (e.g., "CA").
  for (const [key, value] of Object.entries(US_STATE_SLUG_MAP)) {
    if (value === slug && key.length > 2) return key;
  }
  for (const [key, value] of Object.entries(US_STATE_SLUG_MAP)) {
    if (value === slug && key.length === 2) return key;
  }
  return slug.toUpperCase();
}
