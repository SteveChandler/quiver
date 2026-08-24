import {
  MAX_FOLLOWED_BEACHES,
  addFollow,
  createLocalFollowState,
  normalizeLocalFollowState,
  removeFollow,
  updateFollowTopics,
} from "@/lib/beach-follow/state";
import { FollowTopic } from "@/types/beach-follow";

const FIRST_TIME = "2026-08-24T12:00:00.000Z";
const SECOND_TIME = "2026-08-24T13:00:00.000Z";

describe("local beach-follow state", () => {
  it("creates an empty versioned envelope", () => {
    expect(createLocalFollowState()).toEqual({
      version: 1,
      follows: [],
      tombstones: [],
    });
  });

  it("adds a follow, dedupes topics and duplicate beach input", () => {
    const added = addFollow(
      createLocalFollowState(),
      {
        beachId: "beach-a",
        topics: [FollowTopic.Tide, FollowTopic.Surf, FollowTopic.Tide],
      },
      FIRST_TIME
    );
    const duplicate = addFollow(
      added,
      { beachId: "beach-a", topics: [FollowTopic.Wind] },
      SECOND_TIME
    );

    expect(duplicate.follows).toEqual([
      {
        beachId: "beach-a",
        topics: [FollowTopic.Surf, FollowTopic.Tide, FollowTopic.Wind],
        createdAt: FIRST_TIME,
        updatedAt: SECOND_TIME,
      },
    ]);
  });

  it("updates topics without creating an absent follow", () => {
    const state = addFollow(
      createLocalFollowState(),
      { beachId: "beach-a", topics: [FollowTopic.General] },
      FIRST_TIME
    );

    expect(
      updateFollowTopics(
        state,
        "beach-a",
        [FollowTopic.WaterTemp, FollowTopic.Tide],
        SECOND_TIME
      ).follows[0]
    ).toMatchObject({
      topics: [FollowTopic.WaterTemp, FollowTopic.Tide],
      updatedAt: SECOND_TIME,
    });
    expect(
      updateFollowTopics(state, "missing", [FollowTopic.Surf], SECOND_TIME)
    ).toEqual(state);
  });

  it("removes a follow and writes one deterministic tombstone", () => {
    const state = addFollow(
      createLocalFollowState(),
      { beachId: "beach-a", topics: [FollowTopic.WaterQuality] },
      FIRST_TIME
    );
    const removed = removeFollow(state, "beach-a", SECOND_TIME);

    expect(removed).toEqual({
      version: 1,
      follows: [],
      tombstones: [{ beachId: "beach-a", removedAt: SECOND_TIME }],
    });
    expect(removeFollow(removed, "beach-a", SECOND_TIME)).toEqual(removed);
  });

  it("migrates v0 and unknown-version envelopes to normalized v1", () => {
    const legacyFollow = {
      beachId: "beach-a",
      topics: ["tide", "invalid", "tide"],
      createdAt: FIRST_TIME,
      updatedAt: FIRST_TIME,
    };

    expect(
      normalizeLocalFollowState({ version: 0, follows: [legacyFollow] })
    ).toMatchObject({
      version: 1,
      follows: [{ ...legacyFollow, topics: [FollowTopic.Tide] }],
      tombstones: [],
    });
    expect(
      normalizeLocalFollowState({
        version: 99,
        follows: [legacyFollow],
        tombstones: [],
      })
    ).toMatchObject({ version: 1, follows: [{ beachId: "beach-a" }] });
  });

  it("recovers from corrupt JSON and invalid shapes without throwing", () => {
    expect(normalizeLocalFollowState("{broken-json")).toEqual(
      createLocalFollowState()
    );
    expect(normalizeLocalFollowState({ follows: "not-an-array" })).toEqual(
      createLocalFollowState()
    );
    expect(normalizeLocalFollowState(null)).toEqual(createLocalFollowState());
  });

  it("enforces the followed-beach bound deterministically", () => {
    const oversized = {
      version: 1,
      follows: Array.from({ length: MAX_FOLLOWED_BEACHES + 5 }, (_, index) => ({
        beachId: `beach-${index}`,
        topics: [FollowTopic.General],
        createdAt: new Date(Date.UTC(2026, 7, 24, 0, index)).toISOString(),
        updatedAt: new Date(Date.UTC(2026, 7, 24, 0, index)).toISOString(),
      })),
      tombstones: [],
    };

    const normalized = normalizeLocalFollowState(oversized);

    expect(normalized.follows).toHaveLength(MAX_FOLLOWED_BEACHES);
    expect(normalized.follows[0].beachId).toBe("beach-5");
    expect(normalized.follows.at(-1)?.beachId).toBe("beach-54");
  });
});
