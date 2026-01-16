import { BatchUpdateCoordinator } from "@/lib/services/forecast/batch-update-coordinator";

describe("BatchUpdateCoordinator", () => {
  it("calculates correct shard for beach ID", () => {
    const coordinator = new BatchUpdateCoordinator();
    const hash1 = coordinator.hashString("beach-1");
    const hash2 = coordinator.hashString("beach-2");

    expect(typeof hash1).toBe("number");
    expect(hash1).toBeGreaterThanOrEqual(0);
    expect(hash1).not.toBe(hash2);
  });

  it("filters beaches by shard correctly", () => {
    const coordinator = new BatchUpdateCoordinator();
    const beaches = [
      { id: "beach-1", name: "Beach 1" },
      { id: "beach-2", name: "Beach 2" },
      { id: "beach-3", name: "Beach 3" },
      { id: "beach-4", name: "Beach 4" },
    ] as any[];

    const shard0 = coordinator.filterByShardSync(beaches, 0, 2);
    const shard1 = coordinator.filterByShardSync(beaches, 1, 2);

    // All beaches should be in exactly one shard
    expect(shard0.length + shard1.length).toBe(beaches.length);

    // No beach should be in both shards
    const shard0Ids = new Set(shard0.map(b => b.id));
    const shard1Ids = new Set(shard1.map(b => b.id));
    for (const id of shard0Ids) {
      expect(shard1Ids.has(id)).toBe(false);
    }
  });

  it("processes batches with delay between", async () => {
    const coordinator = new BatchUpdateCoordinator({ batchDelayMs: 10 });
    const items = [1, 2, 3, 4, 5];
    const processed: number[] = [];

    const startTime = Date.now();
    await coordinator.processBatches(
      items,
      2,
      async (batch) => {
        processed.push(...batch);
        return batch.map(i => ({ item: i, success: true }));
      }
    );
    const duration = Date.now() - startTime;

    expect(processed).toEqual([1, 2, 3, 4, 5]);
    // Should have 2 delays (between 3 batches)
    expect(duration).toBeGreaterThanOrEqual(15);
  });

  it("respects deadline and stops early", async () => {
    const coordinator = new BatchUpdateCoordinator({ batchDelayMs: 100 });
    const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const processed: number[] = [];

    const deadline = Date.now() + 50; // 50ms deadline

    await coordinator.processBatches(
      items,
      2,
      async (batch) => {
        processed.push(...batch);
        return batch.map(i => ({ item: i, success: true }));
      },
      { deadlineMs: deadline }
    );

    // Should not process all items due to deadline
    expect(processed.length).toBeLessThan(items.length);
  });
});
