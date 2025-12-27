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

/**
 * Sanitize beach/spot descriptions that were seeded with a leading markdown-bold spot name.
 *
 * Example:
 *   "**Terramar Point** represents ..." -> "Terramar Point represents ..."
 *
 * This only strips a leading bold segment when it matches the provided beach name
 * (case/whitespace-insensitive), so we don't accidentally remove meaningful `**...**` markup
 * in other contexts.
 */
export function sanitizeBeachDescription(
  description: string | null | undefined,
  beachName: string | null | undefined
): string | null {
  if (!description) return null;
  if (!beachName) return description;

  const name = beachName.trim();
  if (!name) return description;

  // Match only a leading "**...**" segment.
  // Capture:
  // - 1: the bolded segment content
  // - 2: any immediate whitespace after the segment
  // - 3: the rest of the description
  const match = description.match(/^\*\*([^*]+)\*\*(\s*)([\s\S]*)$/);
  if (!match) return description;

  const bolded = match[1]?.trim() ?? "";
  const afterSpace = match[2] ?? "";
  const rest = match[3] ?? "";

  // Compare in a forgiving way (collapse whitespace, case-insensitive).
  const normalize = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();
  if (normalize(bolded) !== normalize(name)) return description;

  return `${name}${afterSpace}${rest}`;
}
