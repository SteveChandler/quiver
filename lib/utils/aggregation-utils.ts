/**
 * Utility functions for aggregating data by keys.
 * Used for statistics and analytics endpoints.
 */

/**
 * Aggregate an array of items by a key, counting occurrences.
 *
 * @param items - Array of items to aggregate (null-safe)
 * @param keyExtractor - Function to extract the grouping key from each item
 * @returns Record mapping keys to their occurrence counts
 *
 * @example
 * ```ts
 * const logs = [{ type: 'error' }, { type: 'info' }, { type: 'error' }];
 * const byType = aggregateByKey(logs, (log) => log.type);
 * // Result: { error: 2, info: 1 }
 * ```
 */
export function aggregateByKey<T>(
  items: T[] | null | undefined,
  keyExtractor: (item: T) => string
): Record<string, number> {
  if (!items) return {};

  return items.reduce((acc, item) => {
    const key = keyExtractor(item);
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
}

/**
 * Sum a numeric field across an array of items.
 *
 * @param items - Array of items to sum (null-safe)
 * @param valueExtractor - Function to extract the numeric value from each item
 * @returns Sum of all extracted values
 *
 * @example
 * ```ts
 * const runs = [{ emails_sent: 10 }, { emails_sent: 5 }];
 * const total = sumByField(runs, (r) => r.emails_sent);
 * // Result: 15
 * ```
 */
export function sumByField<T>(
  items: T[] | null | undefined,
  valueExtractor: (item: T) => number | null | undefined
): number {
  if (!items) return 0;

  return items.reduce((sum, item) => {
    const value = valueExtractor(item);
    return sum + (value || 0);
  }, 0);
}
