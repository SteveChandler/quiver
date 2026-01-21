/**
 * Slug Helper Utilities
 *
 * Shared utilities for handling city/county slug logic across the application.
 * Centralizes the logic for determining whether a slug represents a county-level
 * identifier and computing the appropriate intent slug to avoid 404s.
 *
 * @see components/city/about-accordion.tsx
 * @see components/city/guides-by-intent-grid.tsx
 * @see app/spots/[slug]/page.tsx
 */

/**
 * Determine if a citySlug is actually a county-level identifier.
 * County slugs typically end with "-county" or match known patterns.
 *
 * @param slug - The city slug to check
 * @returns true if the slug represents a county-level identifier
 *
 * @example
 * isCountySlug('orange-county') // true
 * isCountySlug('san-diego') // false
 */
export function isCountySlug(slug: string | null | undefined): boolean {
  if (!slug) return false;
  return slug.endsWith("-county");
}

/**
 * Get the appropriate slug for intent page links.
 * For county-level pages, use state-level URLs to avoid 404s.
 *
 * @param citySlug - The city slug
 * @param stateSlug - The state slug (e.g., "CA" or "ca")
 * @returns The slug to use for intent pages, or null if citySlug is null
 *
 * @example
 * getIntentSlug('orange-county', 'CA') // 'ca'
 * getIntentSlug('san-diego', 'CA') // 'san-diego'
 * getIntentSlug('san-diego', null) // 'san-diego'
 */
export function getIntentSlug(
  citySlug: string | null,
  stateSlug?: string | null
): string | null {
  if (!citySlug) return null;
  if (isCountySlug(citySlug) && stateSlug) {
    // Convert state to lowercase slug (e.g., "CA" -> "ca")
    return stateSlug.toLowerCase();
  }
  return citySlug;
}
