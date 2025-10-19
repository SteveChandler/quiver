/**
 * Text Normalization Utilities for Search
 * 
 * Provides punctuation-insensitive, case-insensitive text normalization
 * for beach search functionality.
 */

/**
 * Normalize text for search matching (punctuation-insensitive, case-insensitive)
 * 
 * Examples:
 *   "Black's Beach" → "blacks beach"
 *   "Ocean  Beach" → "ocean beach"
 *   "La Jolla" → "la jolla"
 *   "Swami's" → "swamis"
 * 
 * @param text - Text to normalize
 * @returns Normalized text (lowercase, no punctuation, single spaces)
 */
export function normalizeSearchText(text: string): string {
  return text
    .toLowerCase()
    .trim()
    // Remove punctuation (apostrophes, hyphens, periods, etc)
    .replace(/['''`\-\.]/g, '')
    // Collapse multiple spaces into single space
    .replace(/\s+/g, ' ');
}

/**
 * Common beach name aliases (after normalizeSearchText is applied)
 * Maps abbreviated or common searches to their full forms
 */
export const BEACH_ALIASES: Record<string, string> = {
  'blacks': 'blacks beach',
  'pb': 'pacific beach',
  'ob': 'ocean beach',
  'ib': 'imperial beach',
  'swamis': 'swamis',
  'windansea': 'windansea beach',
};

/**
 * Expand search query with common aliases
 * 
 * Examples:
 *   "blacks" → ["blacks", "blacks beach"]
 *   "pb" → ["pb", "pacific beach"]
 *   "ocean beach" → ["ocean beach"]
 * 
 * @param query - Search query to expand
 * @returns Array of search variants (original + alias if exists)
 */
export function expandSearchWithAliases(query: string): string[] {
  const normalized = normalizeSearchText(query);
  const expansion = BEACH_ALIASES[normalized];
  return expansion ? [normalized, expansion] : [normalized];
}

