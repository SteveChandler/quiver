/**
 * Location Slug Utilities
 *
 * Utilities for generating URL-friendly slugs and building location-based URLs
 * for the AllTrails-style location browsing feature.
 */

import { slugify } from "@/lib/utils/text-utils";

/**
 * Generate a URL-friendly slug from location text
 *
 * @param text - Location name (e.g., "La Jolla", "San Diego")
 * @returns Slugified text (e.g., "la-jolla", "san-diego")
 */
export function generateLocationSlug(text: string | null | undefined): string {
  if (!text) return "";
  return slugify(text);
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
 * Parse location name from URL slug
 *
 * @param slug - URL slug (e.g., "la-jolla", "san-diego")
 * @returns Human-readable location name (e.g., "La Jolla", "San Diego")
 */
export function parseLocationFromSlug(slug: string): string {
  if (!slug) return "";

  // Convert slug back to readable format
  // "la-jolla" → "La Jolla"
  // "san-diego" → "San Diego"
  // "cardiff-by-the-sea" → "Cardiff By The Sea"

  return slug
    .split("-")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
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

  if (normalized === "MX" || normalized === "MEXICO") {
    return "Mexico";
  }

  return country; // Return original if no match
}

/**
 * Normalize state name to abbreviation format
 *
 * @param state - State name or abbreviation
 * @returns State abbreviation (e.g., "CA")
 */
export function normalizeState(state: string | null | undefined): string {
  if (!state) return "";

  const normalized = state.trim();

  // If already abbreviated (2 chars), return uppercase
  if (normalized.length === 2) {
    return normalized.toUpperCase();
  }

  // Common state name mappings
  const stateMap: Record<string, string> = {
    "california": "CA",
    "baja california": "Baja California", // Keep full name for Mexican states
    "oregon": "OR",
    "washington": "WA",
    "hawaii": "HI",
    "florida": "FL",
  };

  const mapped = stateMap[normalized.toLowerCase()];
  return mapped || normalized; // Return mapped or original
}
