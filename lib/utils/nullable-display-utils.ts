

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
