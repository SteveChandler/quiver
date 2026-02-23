/**
 * Null-safe display utilities for consistent handling of nullable numeric values.
 *
 * These functions provide a uniform approach to displaying numbers, percentages,
 * and counts throughout the app, preventing masking of missing data as zeros.
 */

const EM_DASH = "—";

/**
 * Display a number with optional formatting and suffix.
 * Returns em-dash for null/undefined values.
 *
 * @example
 * displayNumber(85) // "85"
 * displayNumber(85, { suffix: "%" }) // "85%"
 * displayNumber(85, { format: (n) => n.toFixed(1) }) // "85.0"
 * displayNumber(null) // "—"
 */
export function displayNumber(
  val: number | null | undefined,
  opts?: {
    fallback?: string;
    format?: (n: number) => string;
    suffix?: string;
  }
): string {
  if (val === null || val === undefined) {
    return opts?.fallback ?? EM_DASH;
  }

  const formatted = opts?.format ? opts.format(val) : String(val);
  return opts?.suffix ? `${formatted}${opts.suffix}` : formatted;
}

/**
 * Display a number as a percentage.
 * Returns em-dash for null/undefined values.
 *
 * @example
 * displayPercent(85) // "85%"
 * displayPercent(null) // "—"
 */
export function displayPercent(val: number | null | undefined): string {
  return displayNumber(val, { suffix: "%" });
}

/**
 * Display a count with singular/plural labels.
 * Returns null for null/undefined values (caller decides whether to render).
 *
 * @example
 * displayCount(5, { singular: "review", plural: "reviews" }) // "5 reviews"
 * displayCount(1, { singular: "review", plural: "reviews" }) // "1 review"
 * displayCount(null, { singular: "review", plural: "reviews" }) // null
 */
function displayCount(
  val: number | null | undefined,
  opts: {
    singular: string;
    plural: string;
  }
): string | null {
  if (val === null || val === undefined) {
    return null;
  }

  const label = val === 1 ? opts.singular : opts.plural;
  return `${val} ${label}`;
}

/**
 * Type guard to narrow nullable numbers to number.
 * Useful for filtering and conditional rendering.
 *
 * @example
 * const scores = [85, null, 90, undefined];
 * const validScores = scores.filter(hasValue); // number[]
 */
export function hasValue(val: number | null | undefined): val is number {
  return val !== null && val !== undefined;
}

/**
 * Sorting comparator that pushes null/undefined values to the end.
 * Works with both ascending and descending sorts.
 *
 * @example
 * beaches.sort(nullsLast(b => b.confidence_score, 'desc'))
 * beaches.sort(nullsLast(b => b.review_count, 'asc'))
 */
export function nullsLast<T>(
  extract: (item: T) => number | null | undefined,
  direction: "asc" | "desc" = "asc"
): (a: T, b: T) => number {
  return (a: T, b: T): number => {
    const aVal = extract(a);
    const bVal = extract(b);

    // Both null/undefined - equal
    if (aVal === null || aVal === undefined) {
      if (bVal === null || bVal === undefined) {
        return 0;
      }
      return 1; // a is null, b has value - a goes last
    }

    // a has value, b is null
    if (bVal === null || bVal === undefined) {
      return -1; // b goes last
    }

    // Both have values - normal comparison
    if (direction === "asc") {
      return aVal - bVal;
    } else {
      return bVal - aVal;
    }
  };
}
