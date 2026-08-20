/**
 * Location Slug Utilities
 *
 * Utilities for generating URL-friendly slugs and building location-based URLs
 * for the AllTrails-style location browsing feature.
 */

import { cityToSlug, US_STATE_SLUG_MAP } from "@/lib/utils/beach-url-utils";

/**
 * Generate a URL-friendly slug from location text
 *
 * Delegates to cityToSlug from beach-url-utils for consistency.
 *
 * @param text - Location name (e.g., "La Jolla", "San Diego")
 * @returns Slugified text (e.g., "la-jolla", "san-diego")
 */
export function generateLocationSlug(text: string | null | undefined): string {
  return cityToSlug(text);
}

/**
 * Build a location page URL from location components
 *
 * @param city - City name (e.g., "La Jolla")
 * @param state - State name or abbreviation (e.g., "CA", "California")
 * @param country - Country name (e.g., "USA", "Mexico"). Defaults to "USA"
 * @returns URL path (e.g., "/beaches/usa/ca/la-jolla")
 */
export function buildLocationUrl(
  city: string | null | undefined,
  state: string | null | undefined,
  country?: string | null
): string {
  // Default to USA if no country provided
  const countrySlug = generateLocationSlug(country || "USA");
  const stateSlug = generateLocationSlug(state);
  const citySlug = generateLocationSlug(city);

  // Validate we have required components
  if (!citySlug || !stateSlug) {
    return "/map"; // Fallback to map if location data incomplete
  }

  return `/beaches/${countrySlug}/${stateSlug}/${citySlug}`;
}

/**
 * Common stop-words that should remain lowercase in location names
 * (unless they appear at the start of the name).
 */
const LOCATION_STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "at",
  "by",
  "for",
  "in",
  "of",
  "on",
  "or",
  "the",
  "to",
]);

/**
 * Parse location name from URL slug
 *
 * @param slug - URL slug (e.g., "la-jolla", "san-diego")
 * @returns Human-readable location name (e.g., "La Jolla", "San Diego", "Cardiff by the Sea")
 */
export function parseLocationFromSlug(slug: string): string {
  if (!slug) return "";

  // Convert slug back to readable format
  // "la-jolla" → "La Jolla"
  // "san-diego" → "San Diego"
  // "cardiff-by-the-sea" → "Cardiff by the Sea"

  return slug
    .split("-")
    .map((word, index) => {
      // Capitalize first word always; keep stop-words lowercase elsewhere
      if (index === 0 || !LOCATION_STOP_WORDS.has(word.toLowerCase())) {
        return word.charAt(0).toUpperCase() + word.slice(1);
      }
      return word.toLowerCase();
    })
    .join(" ");
}

/**
 * Build breadcrumb segments from location data
 *
 * @param city - City name
 * @param state - State name
 * @param country - Country name (defaults to "USA")
 * @returns Array of breadcrumb segments with labels and URLs
 */
export function buildBreadcrumbSegments(
  city: string | null | undefined,
  state: string | null | undefined,
  country?: string | null
): Array<{ label: string; url: string | null }> {
  const segments: Array<{ label: string; url: string | null }> = [];

  const countrySlug = generateLocationSlug(country || "USA");
  const stateSlug = generateLocationSlug(state);
  const citySlug = generateLocationSlug(city);

  // Add country segment (optional - can be added later for international)
  if (country && country !== "USA") {
    segments.push({
      label: country,
      url: `/beaches/${countrySlug}`,
    });
  }

  // Add state segment
  if (state) {
    segments.push({
      label: state,
      url: `/beaches/${countrySlug}/${stateSlug}`,
    });
  }

  // Add city segment (main location page)
  if (city) {
    segments.push({
      label: city,
      url: buildLocationUrl(city, state, country),
    });
  }

  return segments;
}

/**
 * Normalize country name to standard format
 *
 * @param country - Country name in various formats
 * @returns Standardized country name
 */
export function normalizeCountry(country: string | null | undefined): string {
  if (!country) return "USA";

  const normalized = country.toUpperCase().trim();

  // Handle common variations
  if (normalized === "US" || normalized === "UNITED STATES" || normalized === "USA") {
    return "USA";
  }

  if (normalized === "MX" || normalized === "MEX" || normalized === "MEXICO") {
    return "Mexico";
  }

  return country; // Return original if no match
}

/**
 * Canonical display names for known international states/regions.
 * Keyed by lowercase for case-insensitive lookup.
 * US states are covered by US_STATE_SLUG_MAP; this handles non-US regions
 * known to the Quiver coverage area.
 */
const INTERNATIONAL_STATE_DISPLAY_NAMES: Record<string, string> = {
  "baja california": "Baja California",
};

/**
 * Normalize state name to abbreviation format
 *
 * Uses US_STATE_SLUG_MAP from beach-url-utils for consistency. Does a
 * case-insensitive lookup so "california", "California", and "CALIFORNIA"
 * all normalize to "CA". Returns 2-letter uppercase abbreviations for known
 * US states, the canonical display name for known international states
 * (e.g., "baja california" → "Baja California"), or the original (trimmed)
 * value for anything unrecognized.
 *
 * @param state - State name or abbreviation
 * @returns State abbreviation (e.g., "CA") or normalized name if recognized
 */
export function normalizeState(state: string | null | undefined): string {
  if (!state) return "";

  const trimmed = state.trim();
  if (!trimmed) return "";

  // If already abbreviated (2 chars), return uppercase
  if (trimmed.length === 2) {
    return trimmed.toUpperCase();
  }

  const trimmedLower = trimmed.toLowerCase();

  // Case-insensitive lookup against US_STATE_SLUG_MAP.
  // The map has entries like { California: "ca", "New York": "ny", ... }.
  // We scan for a key that matches case-insensitively, then uppercase the
  // 2-letter slug to produce the canonical abbreviation (e.g., "CA").
  for (const [key, slug] of Object.entries(US_STATE_SLUG_MAP)) {
    if (key.toLowerCase() === trimmedLower && slug.length === 2) {
      return slug.toUpperCase();
    }
  }

  // Check international state display names (e.g., "baja california" → "Baja California")
  const intlDisplay = INTERNATIONAL_STATE_DISPLAY_NAMES[trimmedLower];
  if (intlDisplay) return intlDisplay;

  // Return original trimmed value for unrecognized states
  return trimmed;
}
