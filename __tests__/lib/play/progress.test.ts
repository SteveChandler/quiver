/** @jest-environment node */

import {
  createProgressStore,
  DEFAULT_PLAY_PROGRESS,
  PLAY_PROGRESS_KEY,
  type StorageLike,
} from "@/lib/play";

function createMemoryStorage(): StorageLike {
  const values = new Map<string, string>();
  return {
    getItem: (key: string): string | null => values.get(key) ?? null,
    setItem: (key: string, value: string): void => {
      values.set(key, value);
    },
  };
}

describe("OUTSIDE progress store", () => {
  it("persists progress behind a storage interface", () => {
    const storage = createMemoryStorage();
    const store = createProgressStore(storage);
    const progress = {
      ...DEFAULT_PLAY_PROGRESS,
      unlockedBreakIndex: 2,
      muted: true,
      controlsSeen: true,
      bestHeatTotals: { pipeline: 14.8 },
    };

    store.save(progress);

    expect(storage.getItem(PLAY_PROGRESS_KEY)).not.toBeNull();
    expect(store.load()).toEqual(progress);
  });

  it("falls back safely for malformed saved data", () => {
    const storage = createMemoryStorage();
    storage.setItem(PLAY_PROGRESS_KEY, "not json");

    expect(createProgressStore(storage).load()).toEqual(DEFAULT_PLAY_PROGRESS);
  });
});
