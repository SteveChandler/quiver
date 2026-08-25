import {
  LOCAL_BEACH_FOLLOW_STORAGE_KEY,
  addLocalBeachFollow,
  ensureLocalBfrAssignment,
  readLocalBeachFollowState,
  removeLocalBeachFollow,
  updateLocalBeachFollowTopics,
} from "@/lib/beach-follow/local-storage";
import { createLocalFollowState } from "@/lib/beach-follow/state";
import { bfrHoldoutAssignment } from "@/lib/experiments/bfr-holdout";
import { FollowTopic } from "@/types/beach-follow";

const BEACH_ID = "11111111-1111-4111-8111-111111111111";
const FIRST_TIME = "2026-08-25T12:00:00.000Z";
const SECOND_TIME = "2026-08-25T13:00:00.000Z";

function createMemoryStorage(): Storage {
  const values = new Map<string, string>();

  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key: string) => values.get(key) ?? null,
    key: (index: number) => [...values.keys()][index] ?? null,
    removeItem: (key: string) => values.delete(key),
    setItem: (key: string, value: string) => values.set(key, value),
  };
}

describe("local beach-follow storage adapter", () => {
  it("persists an anonymous follow and topics without account or network I/O", () => {
    const storage = createMemoryStorage();
    const initial = readLocalBeachFollowState(storage);

    const followed = addLocalBeachFollow(
      initial,
      BEACH_ID,
      [FollowTopic.WaterTemp],
      FIRST_TIME,
      storage,
    );
    const edited = updateLocalBeachFollowTopics(
      followed,
      BEACH_ID,
      [FollowTopic.WaterTemp, FollowTopic.Tide],
      SECOND_TIME,
      storage,
    );

    expect(followed.status).toBe("ready");
    expect(edited.state.follows[0]?.topics).toEqual([
      FollowTopic.WaterTemp,
      FollowTopic.Tide,
    ]);
    expect(readLocalBeachFollowState(storage).state).toEqual(edited.state);
  });

  it("normalizes corrupt storage to an empty usable state", () => {
    const storage = createMemoryStorage();
    storage.setItem(LOCAL_BEACH_FOLLOW_STORAGE_KEY, "{broken-json");

    expect(readLocalBeachFollowState(storage)).toEqual({
      state: createLocalFollowState(),
      status: "ready",
      persisted: true,
    });
  });

  it("keeps follow and unfollow functional when storage is disabled", () => {
    const disabledStorage = {
      get length(): number {
        throw new Error("disabled");
      },
      clear: () => {
        throw new Error("disabled");
      },
      getItem: () => {
        throw new Error("disabled");
      },
      key: () => {
        throw new Error("disabled");
      },
      removeItem: () => {
        throw new Error("disabled");
      },
      setItem: () => {
        throw new Error("disabled");
      },
    } as Storage;

    const initial = readLocalBeachFollowState(disabledStorage);
    const followed = addLocalBeachFollow(
      initial,
      BEACH_ID,
      [FollowTopic.General],
      FIRST_TIME,
      disabledStorage,
    );
    const removed = removeLocalBeachFollow(
      followed,
      BEACH_ID,
      SECOND_TIME,
      disabledStorage,
    );

    expect(initial.status).toBe("unavailable");
    expect(followed).toMatchObject({
      status: "unavailable",
      persisted: false,
      state: { follows: [{ beachId: BEACH_ID }] },
    });
    expect(removed.state.follows).toEqual([]);
  });

  it("preserves a stable holdout assignment in the follow envelope", () => {
    const storage = createMemoryStorage();
    const initial = readLocalBeachFollowState(storage);
    const first = ensureLocalBfrAssignment(
      initial,
      "anon-visitor-1",
      FIRST_TIME,
      storage,
    );
    const reloaded = readLocalBeachFollowState(storage);
    const second = ensureLocalBfrAssignment(
      reloaded,
      "different-subject-that-must-not-reassign",
      SECOND_TIME,
      storage,
    );

    expect(first.state.bfrHoldoutAssignment).toEqual(
      bfrHoldoutAssignment("anon-visitor-1", FIRST_TIME),
    );
    expect(second.state.bfrHoldoutAssignment).toEqual(
      first.state.bfrHoldoutAssignment,
    );
  });

  it("quarantines a future envelope without overwriting it", () => {
    const storage = createMemoryStorage();
    const futureEnvelope = JSON.stringify({
      version: 99,
      follows: [],
      futureField: "keep-me",
    });
    storage.setItem(LOCAL_BEACH_FOLLOW_STORAGE_KEY, futureEnvelope);

    const snapshot = readLocalBeachFollowState(storage);
    const assigned = ensureLocalBfrAssignment(
      snapshot,
      "anon-visitor-1",
      FIRST_TIME,
      storage,
    );

    expect(snapshot.status).toBe("sync_required");
    expect(assigned.status).toBe("sync_required");
    expect(storage.getItem(LOCAL_BEACH_FOLLOW_STORAGE_KEY)).toBe(futureEnvelope);
  });
});
