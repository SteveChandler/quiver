/**
 * Fetches items in parallel batches to avoid URL length limits.
 * Uses Promise.allSettled for partial failure resilience — successful
 * batches are returned even if others fail.
 */
export async function fetchInBatches<T, R>({
  items,
  batchSize,
  fetchBatch,
  onBatchError,
}: {
  items: T[];
  batchSize: number;
  fetchBatch: (batch: T[]) => Promise<R>;
  onBatchError?: (error: unknown, batchIndex: number) => void;
}): Promise<R[]> {
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    batches.push(items.slice(i, i + batchSize));
  }

  const results = await Promise.allSettled(
    batches.map((batch, idx) =>
      fetchBatch(batch).catch((err) => {
        onBatchError?.(err, idx);
        throw err;
      })
    )
  );

  return results
    .filter((r) => r.status === "fulfilled")
    .map((r) => (r as PromiseFulfilledResult<Awaited<R>>).value);
}
