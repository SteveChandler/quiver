/**
 * Batch Update Coordinator
 *
 * Handles batch processing of forecast updates with:
 * - Sharding support for horizontal scaling
 * - Deadline-aware processing
 * - Configurable batch sizes and delays
 */

/**
 * Simple deterministic hash function for sharding.
 * Uses djb2 algorithm to produce a stable hash from a string.
 * Exported for use by other modules needing consistent sharding.
 */
export function hashString(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) ^ str.charCodeAt(i);
  }
  // Convert to unsigned 32-bit integer
  return hash >>> 0;
}

export interface BatchResult<T> {
  item: T;
  success: boolean;
  error?: string;
}

export interface BatchUpdateOptions {
  batchSize?: number;
  batchDelayMs?: number;
  maxItemsPerRun?: number;
}

export class BatchUpdateCoordinator {
  private readonly batchDelayMs: number;

  constructor(options: { batchDelayMs?: number } = {}) {
    this.batchDelayMs = options.batchDelayMs ?? 1000;
  }

  /**
   * Instance method wrapper for hashString (for backward compatibility)
   */
  hashString(str: string): number {
    return hashString(str);
  }

  /**
   * Filter items by shard (synchronous version for testing)
   */
  filterByShardSync<T extends { id: string }>(
    items: T[],
    shard: number,
    shardCount: number
  ): T[] {
    return items.filter((item) => {
      const itemHash = this.hashString(item.id);
      return itemHash % shardCount === shard;
    });
  }

  /**
   * Process items in batches with configurable delay
   */
  async processBatches<T, R>(
    items: T[],
    batchSize: number,
    processor: (batch: T[]) => Promise<BatchResult<R>[]>,
    options?: { deadlineMs?: number }
  ): Promise<BatchResult<R>[]> {
    const allResults: BatchResult<R>[] = [];
    const deadlineMs = options?.deadlineMs;
    const hasDeadline = typeof deadlineMs === "number" && Number.isFinite(deadlineMs);

    const shouldStop = () => hasDeadline && Date.now() >= deadlineMs!;

    // Split into batches
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }

    for (let i = 0; i < batches.length; i++) {
      if (shouldStop()) break;

      const batch = batches[i];
      const results = await processor(batch);
      allResults.push(...results);

      // Add delay between batches (except after last batch)
      if (i < batches.length - 1 && !shouldStop()) {
        if (hasDeadline && Date.now() + this.batchDelayMs >= deadlineMs!) {
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, this.batchDelayMs));
      }
    }

    return allResults;
  }
}
