/**
 * Text manipulation utilities.
 * Generic string helpers for slugification, formatting, etc.
 */

/**
 * Convert a string to a URL-safe slug
 * 
 * @param input - The string to slugify
 * @returns A lowercase, hyphenated slug with special characters removed
 * 
 * @example
 * ```ts
 * slugify("Malibu Beach") // "malibu-beach"
 * slugify("O'ahu's North Shore") // "oahus-north-shore"
 * ```
 */
export function slugify(input: string): string {
  return (input || "")
    .toString()
    .trim()
    .toLowerCase()
    .replace(/['']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}





