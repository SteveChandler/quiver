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

  // Match only a leading "**...**" segment (optionally preceded by whitespace).
  // Capture:
  // - 1: any leading whitespace before the segment
  // - 2: the bolded segment content
  // - 3: any immediate whitespace after the segment
  // - 4: the rest of the description
  const match = description.match(/^(\s*)\*\*([^*]+)\*\*(\s*)([\s\S]*)$/);
  if (!match) return description;

  const leadingWhitespace = match[1] ?? "";
  const bolded = match[2]?.trim() ?? "";
  const afterSpace = match[3] ?? "";
  const rest = match[4] ?? "";

  // Compare in a forgiving way (collapse whitespace, case-insensitive).
  const normalize = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();
  const boldedNorm = normalize(bolded);
  const nameNorm = normalize(name);

  // Strip parenthetical qualifier from beach name for comparison.
  // Example: "Sunset Cliffs (Garbage)" -> "Sunset Cliffs"
  const nameWithoutParens = normalize(name.replace(/\s*\([^)]*\)\s*$/, ""));

  // Primary: exact match with the provided beach name.
  if (boldedNorm === nameNorm) {
    return `${leadingWhitespace}${name}${afterSpace}${rest}`;
  }

  // Secondary: handle cases where the DB record uses a shorter canonical name
  // but the seeded description includes a common suffix like "Beach" or "Pier".
  //
  // Example:
  //   beachName = "Blacks"
  //   description starts with "**Blacks Beach** ..."
  //   OR beachName = "Scripps"
  //   description starts with "**Scripps Pier** ..."
  //
  // Only allow specific suffixes to avoid stripping meaningful bold markup.
  const allowedSuffixes = ["beach", "pier", "point", "reef"];
  for (const suffix of allowedSuffixes) {
    if (boldedNorm === `${nameNorm} ${suffix}`) {
      return `${leadingWhitespace}${bolded}${afterSpace}${rest}`;
    }
  }

  // Tertiary: handle cases where the DB record has a parenthetical qualifier
  // but the seeded description uses the base name without parenthetical.
  //
  // Example:
  //   beachName = "Sunset Cliffs (Garbage)"
  //   description starts with "**Sunset Cliffs** ..."
  if (nameWithoutParens !== nameNorm && boldedNorm === nameWithoutParens) {
    return `${leadingWhitespace}${bolded}${afterSpace}${rest}`;
  }

  // Quaternary: combine parenthetical stripping with suffix handling.
  //
  // Example:
  //   beachName = "Sunset Cliffs (Garbage)"
  //   description starts with "**Sunset Cliffs Beach** ..."
  if (nameWithoutParens !== nameNorm) {
    for (const suffix of allowedSuffixes) {
      if (boldedNorm === `${nameWithoutParens} ${suffix}`) {
        return `${leadingWhitespace}${bolded}${afterSpace}${rest}`;
      }
    }
  }

  return description;
}
