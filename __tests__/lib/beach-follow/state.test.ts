import {
  MAX_BEACH_ID_LENGTH,
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
const BEACH_A = "11111111-1111-4111-8111-111111111111";
const BEACH_B = "22222222-2222-4222-8222-222222222222";

function beachIdFor(index: number): string {
  return `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`;
}

describe("local beach-follow state", () => {
  it("creates an empty versioned envelope", () => {
    expect(createLocalFollowState()).toEqual({
      version: 1,
      follows: [],
      tombstones: [],
      bfrHoldoutAssignment: null,
    });
  });

  it("adds a follow, dedupes topics and duplicate beach input", () => {
    const added = addFollow(
      createLocalFollowState(),
      {
        beachId: BEACH_A,
        topics: [FollowTopic.Tide, FollowTopic.Surf, FollowTopic.Tide],
      },
      FIRST_TIME
    );
    const duplicate = addFollow(
      added,
      { beachId: BEACH_A, topics: [FollowTopic.Wind] },
      SECOND_TIME
    );

    expect(duplicate.follows).toEqual([
      {
        beachId: BEACH_A,
        topics: [FollowTopic.Surf, FollowTopic.Tide, FollowTopic.Wind],
        createdAt: FIRST_TIME,
        updatedAt: SECOND_TIME,
      },
    ]);
  });

  it("updates topics without creating an absent follow", () => {
    const state = addFollow(
      createLocalFollowState(),
      { beachId: BEACH_A, topics: [FollowTopic.General] },
      FIRST_TIME
    );

    expect(
      updateFollowTopics(
        state,
        BEACH_A,
        [FollowTopic.WaterTemp, FollowTopic.Tide],
        SECOND_TIME
      ).follows[0]
    ).toMatchObject({
      topics: [FollowTopic.WaterTemp, FollowTopic.Tide],
      updatedAt: SECOND_TIME,
    });
    expect(
      updateFollowTopics(state, BEACH_B, [FollowTopic.Surf], SECOND_TIME)
    ).toEqual(state);
  });

  it("removes a follow and writes one deterministic tombstone", () => {
    const state = addFollow(
      createLocalFollowState(),
      { beachId: BEACH_A, topics: [FollowTopic.WaterQuality] },
      FIRST_TIME
    );
    const removed = removeFollow(state, BEACH_A, SECOND_TIME);

    expect(removed).toEqual({
      version: 1,
      follows: [],
      tombstones: [{ beachId: BEACH_A, removedAt: SECOND_TIME }],
      bfrHoldoutAssignment: null,
    });
    expect(removeFollow(removed, BEACH_A, SECOND_TIME)).toEqual(removed);
  });

  it("migrates only known versions and recovers future versions to empty", () => {
    const legacyFollow = {
      beachId: BEACH_A,
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
      bfrHoldoutAssignment: null,
    });
    expect(
      normalizeLocalFollowState({
        version: 99,
        follows: [legacyFollow],
        tombstones: [],
      })
    ).toEqual(createLocalFollowState());
  });

  it("drops corrupt beach IDs while retaining canonical UUID rows", () => {
    const validFollow = {
      beachId: BEACH_A,
      topics: [FollowTopic.Surf],
      createdAt: FIRST_TIME,
      updatedAt: FIRST_TIME,
    };
    const invalidIds = [
      "not-a-uuid",
      BEACH_A.toUpperCase(),
      `1${"0".repeat(MAX_BEACH_ID_LENGTH)}`,
    ];

    const normalized = normalizeLocalFollowState({
      version: 1,
      follows: [
        validFollow,
        ...invalidIds.map((beachId) => ({ ...validFollow, beachId })),
      ],
      tombstones: [],
    });

    expect(normalized.follows).toEqual([validFollow]);
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
        beachId: beachIdFor(index),
        topics: [FollowTopic.General],
        createdAt: new Date(Date.UTC(2026, 7, 24, 0, index)).toISOString(),
        updatedAt: new Date(Date.UTC(2026, 7, 24, 0, index)).toISOString(),
      })),
      tombstones: [],
    };

    const normalized = normalizeLocalFollowState(oversized);

    expect(normalized.follows).toHaveLength(MAX_FOLLOWED_BEACHES);
    expect(normalized.follows[0].beachId).toBe(beachIdFor(5));
    expect(normalized.follows.at(-1)?.beachId).toBe(beachIdFor(54));
  });
});
