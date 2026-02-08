/**
 * Shared helpers for SEO content generators.
 *
 * Used by city-content-generator.ts and state-content-generator.ts
 * to avoid duplicated utility logic.
 */

/**
 * Count occurrences of non-null values in an array.
 */
export function countValues(values: (string | null | undefined)[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const v of values) {
    if (v) {
      counts[v] = (counts[v] || 0) + 1;
    }
  }
  return counts;
}

const IRREGULAR_PLURALS: Record<string, string> = {
  city: "cities",
};

/**
 * Simple English pluralization with irregular word support.
 */
export function pluralize(word: string, count: number): string {
  if (count === 1) return word;
  return IRREGULAR_PLURALS[word] ?? `${word}s`;
}

/**
 * Join a list of items with commas and "and" (Oxford comma style).
 */
export function joinList(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}
