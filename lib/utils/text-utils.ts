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

/**
 * Convert a string to a URL-safe ASCII slug by normalizing Unicode and stripping diacritics.
 *
 * This is useful for matching user-facing slugs (e.g., "rincon") against
 * database values that contain accented characters (e.g., "Rincón").
 *
 * @param input - The string to slugify
 * @returns A lowercase, hyphenated ASCII slug with diacritics removed
 *
 * @example
 * ```ts
 * slugifyAscii("Rincón") // "rincon"
 * slugifyAscii("São Paulo") // "sao-paulo"
 * slugifyAscii("Cardiff-by-the-Sea") // "cardiff-by-the-sea"
 * ```
 */
export function slugifyAscii(input: string): string {
  return (input || "")
    .toString()
    .trim()
    .normalize("NFD") // Decompose accented characters (é → e + combining accent)
    .replace(/[\u0300-\u036f]/g, "") // Remove combining diacritical marks
    .toLowerCase()
    .replace(/['']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}









