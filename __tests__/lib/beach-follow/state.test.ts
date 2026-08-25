import {
  MAX_BEACH_ID_LENGTH,
  MAX_FOLLOWED_BEACHES,
  MAX_PENDING_FOLLOW_OPERATIONS,
  addFollow,
  createLocalFollowState,
  normalizeLocalFollowState,
  removeFollow,
  updateFollowTopics,
} from "@/lib/beach-follow/state";
import { bfrHoldoutAssignment } from "@/lib/experiments/bfr-holdout";
import {
  FollowTopic,
  type LocalFollowMutationResult,
  type LocalFollowState,
} from "@/types/beach-follow";

const FIRST_TIME = "2026-08-24T12:00:00.000Z";
const SECOND_TIME = "2026-08-24T13:00:00.000Z";
const BEACH_A = "11111111-1111-4111-8111-111111111111";
const BEACH_B = "22222222-2222-4222-8222-222222222222";
const BEACH_C = "33333333-3333-4333-8333-333333333333";

function beachIdFor(index: number): string {
  return `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`;
}

function resultState(result: LocalFollowMutationResult): LocalFollowState {
  if (!("state" in result)) {
    throw new Error("Expected a supported local follow state");
  }
  return result.state;
}

function appliedState(result: LocalFollowMutationResult): LocalFollowState {
  expect(result.status).toBe("applied");
  return resultState(result);
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
    const added = appliedState(addFollow(
      createLocalFollowState(),
      {
        beachId: BEACH_A,
        topics: [FollowTopic.Tide, FollowTopic.Surf, FollowTopic.Tide],
      },
      FIRST_TIME
    ));
    const duplicate = appliedState(addFollow(
      added,
      { beachId: BEACH_A, topics: [FollowTopic.Wind] },
      SECOND_TIME
    ));

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
    const state = appliedState(addFollow(
      createLocalFollowState(),
      { beachId: BEACH_A, topics: [FollowTopic.General] },
      FIRST_TIME
    ));

    expect(
      appliedState(updateFollowTopics(
        state,
        BEACH_A,
        [FollowTopic.WaterTemp, FollowTopic.Tide],
        SECOND_TIME
      )).follows[0]
    ).toMatchObject({
      topics: [FollowTopic.WaterTemp, FollowTopic.Tide],
      updatedAt: SECOND_TIME,
    });
    expect(
      appliedState(
        updateFollowTopics(state, BEACH_B, [FollowTopic.Surf], SECOND_TIME)
      )
    ).toEqual(state);
  });

  it("removes a follow and writes one deterministic tombstone", () => {
    const state = appliedState(addFollow(
      createLocalFollowState(),
      { beachId: BEACH_A, topics: [FollowTopic.WaterQuality] },
      FIRST_TIME
    ));
    const removed = appliedState(removeFollow(state, BEACH_A, SECOND_TIME));

    expect(removed).toEqual({
      version: 1,
      follows: [],
      tombstones: [{ beachId: BEACH_A, removedAt: SECOND_TIME }],
      bfrHoldoutAssignment: null,
    });
    expect(appliedState(removeFollow(removed, BEACH_A, SECOND_TIME))).toEqual(
      removed
    );
  });

  it("migrates known versions and preserves future envelopes for quarantine", () => {
    const legacyFollow = {
      beachId: BEACH_A,
      topics: ["tide", "invalid", "tide"],
      createdAt: FIRST_TIME,
      updatedAt: FIRST_TIME,
    };

    expect(
      appliedState(
        normalizeLocalFollowState({ version: 0, follows: [legacyFollow] })
      )
    ).toMatchObject({
      version: 1,
      follows: [{ ...legacyFollow, topics: [FollowTopic.Tide] }],
      tombstones: [],
      bfrHoldoutAssignment: null,
    });
    const futureEnvelope = {
      version: 2,
      follows: [legacyFollow],
      tombstones: [],
      futureField: { retained: true },
    };
    const serialized = JSON.stringify(futureEnvelope);

    expect(normalizeLocalFollowState(serialized)).toEqual({
      status: "unsupported_version",
      opaqueEnvelope: serialized,
    });
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

    const normalized = appliedState(
      normalizeLocalFollowState({
        version: 1,
        follows: [
          validFollow,
          ...invalidIds.map((beachId) => ({ ...validFollow, beachId })),
        ],
        tombstones: [],
      })
    );

    expect(normalized.follows).toEqual([validFollow]);
  });

  it("recovers from corrupt JSON and invalid shapes without throwing", () => {
    expect(appliedState(normalizeLocalFollowState("{broken-json"))).toEqual(
      createLocalFollowState()
    );
    expect(
      appliedState(normalizeLocalFollowState({ follows: "not-an-array" }))
    ).toEqual(createLocalFollowState());
    expect(appliedState(normalizeLocalFollowState(null))).toEqual(
      createLocalFollowState()
    );
  });

  it("normalizes follows and tombstones independently in a v1 envelope", () => {
    expect(appliedState(normalizeLocalFollowState({
      version: 1,
      follows: null,
      tombstones: [{ beachId: BEACH_A, removedAt: SECOND_TIME }],
      bfrHoldoutAssignment: null,
    }))).toEqual({
      version: 1,
      follows: [],
      tombstones: [{ beachId: BEACH_A, removedAt: SECOND_TIME }],
      bfrHoldoutAssignment: null,
    });

    expect(appliedState(normalizeLocalFollowState({
      version: 1,
      follows: [{
        beachId: BEACH_B,
        topics: [FollowTopic.Surf],
        createdAt: FIRST_TIME,
        updatedAt: SECOND_TIME,
      }],
      tombstones: null,
      bfrHoldoutAssignment: null,
    }))).toEqual({
      version: 1,
      follows: [{
        beachId: BEACH_B,
        topics: [FollowTopic.Surf],
        createdAt: FIRST_TIME,
        updatedAt: SECOND_TIME,
      }],
      tombstones: [],
      bfrHoldoutAssignment: null,
    });
  });

  it.each([
    ["keeps a newer follow", SECOND_TIME, FIRST_TIME, true],
    ["keeps a newer tombstone", FIRST_TIME, SECOND_TIME, false],
    ["lets a tombstone win a timestamp tie", SECOND_TIME, SECOND_TIME, false],
  ] as const)("%s for the same local beach", (_, updatedAt, removedAt, followWins) => {
    const follow = {
      beachId: BEACH_A,
      topics: [FollowTopic.Tide],
      createdAt: FIRST_TIME,
      updatedAt,
    };
    const tombstone = { beachId: BEACH_A, removedAt };
    const normalized = appliedState(normalizeLocalFollowState({
      version: 1,
      follows: [follow],
      tombstones: [tombstone],
      bfrHoldoutAssignment: null,
    }));

    expect(normalized.follows).toEqual(followWins ? [follow] : []);
    expect(normalized.tombstones).toEqual(followWins ? [] : [tombstone]);
  });

  it("quarantines an oversized valid follow envelope without truncation", () => {
    const validFollows = Array.from(
      { length: MAX_FOLLOWED_BEACHES + 5 },
      (_, index) => ({
        beachId: beachIdFor(index),
        topics: [FollowTopic.General],
        createdAt: new Date(Date.UTC(2026, 7, 24, 0, index)).toISOString(),
        updatedAt: new Date(Date.UTC(2026, 7, 24, 0, index)).toISOString(),
      })
    );
    const oversized = {
      version: 1,
      follows: [
        ...validFollows,
        { beachId: "garbage", topics: ["garbage"] },
      ],
      tombstones: [],
    };

    const normalized = normalizeLocalFollowState(JSON.stringify(oversized));
    const expected = {
      status: "sync_required",
      state: {
        version: 1,
        follows: validFollows,
        tombstones: [],
        bfrHoldoutAssignment: null,
      },
    } as const;

    expect(normalized).toEqual(expected);
    expect(normalizeLocalFollowState(JSON.stringify(resultState(normalized)))).toEqual(
      expected
    );
  });

  it("retains 51 unacknowledged removals and returns sync_required before overflow", () => {
    let state = createLocalFollowState();

    for (let index = 0; index < 51; index += 1) {
      state = appliedState(
        removeFollow(
          state,
          beachIdFor(index),
          new Date(Date.UTC(2026, 7, 24, 0, index)).toISOString()
        )
      );
    }

    expect(state.tombstones).toHaveLength(51);
    expect(state.tombstones.map((item) => item.beachId)).toEqual(
      Array.from({ length: 51 }, (_, index) => beachIdFor(index))
    );

    for (let index = 51; index < MAX_PENDING_FOLLOW_OPERATIONS; index += 1) {
      state = appliedState(
        removeFollow(
          state,
          beachIdFor(index),
          new Date(Date.UTC(2026, 7, 24, 1, index)).toISOString()
        )
      );
    }

    expect(
      removeFollow(
        state,
        beachIdFor(MAX_PENDING_FOLLOW_OPERATIONS),
        "2026-08-24T03:00:00.000Z"
      )
    ).toEqual({ status: "sync_required", state });
  });

  it("returns sync_required instead of evicting a follow at the 50-to-51 boundary", () => {
    const state: LocalFollowState = {
      ...createLocalFollowState(),
      follows: Array.from({ length: MAX_FOLLOWED_BEACHES }, (_, index) => ({
        beachId: beachIdFor(index),
        topics: [FollowTopic.General],
        createdAt: new Date(Date.UTC(2026, 7, 24, 0, index)).toISOString(),
        updatedAt: new Date(Date.UTC(2026, 7, 24, 0, index)).toISOString(),
      })),
    };

    const result = addFollow(
      state,
      {
        beachId: beachIdFor(MAX_FOLLOWED_BEACHES),
        topics: [FollowTopic.Surf],
      },
      SECOND_TIME
    );

    expect(result).toEqual({ status: "sync_required", state });
    expect(resultState(result).follows).toHaveLength(MAX_FOLLOWED_BEACHES);
    expect(resultState(result).follows.map((follow) => follow.beachId)).toEqual(
      state.follows.map((follow) => follow.beachId)
    );

    const updated = updateFollowTopics(
      state,
      beachIdFor(0),
      [FollowTopic.Surf, FollowTopic.Tide],
      SECOND_TIME
    );
    expect(updated.status).toBe("applied");
    expect(resultState(updated).follows).toHaveLength(MAX_FOLLOWED_BEACHES);
    expect(resultState(updated).follows.find(
      (follow) => follow.beachId === beachIdFor(0)
    )?.topics).toEqual([FollowTopic.Surf, FollowTopic.Tide]);
  });

  it("quarantines 101 persisted tombstones without truncating them", () => {
    const tombstones = Array.from(
      { length: MAX_PENDING_FOLLOW_OPERATIONS + 1 },
      (_, index) => ({
        beachId: beachIdFor(index),
        removedAt: new Date(Date.UTC(2026, 7, 24, 0, index)).toISOString(),
      })
    );

    expect(normalizeLocalFollowState({
      version: 1,
      follows: [],
      tombstones,
      bfrHoldoutAssignment: null,
    })).toEqual({
      status: "sync_required",
      state: {
        version: 1,
        follows: [],
        tombstones,
        bfrHoldoutAssignment: null,
      },
    });
  });

  it("normalizes strict ISO instants and orders retention by epoch milliseconds", () => {
    const normalized = appliedState(
      normalizeLocalFollowState({
        version: 1,
        follows: [
          {
            beachId: BEACH_A,
            topics: [FollowTopic.Surf],
            createdAt: "2026-08-24T05:00:00-07:00",
            updatedAt: "2026-08-24T12:00:01Z",
          },
          {
            beachId: BEACH_B,
            topics: [FollowTopic.Tide],
            createdAt: FIRST_TIME,
            updatedAt: "2026-08-24T11:59:59.500Z",
          },
          {
            beachId: BEACH_C,
            topics: [FollowTopic.General],
            createdAt: FIRST_TIME,
            updatedAt: `August 24, 2026 ${" ".repeat(1_000)}`,
          },
        ],
        tombstones: [
          {
            beachId: beachIdFor(90),
            removedAt: "2026-08-24T06:00:00-07:00",
          },
        ],
        bfrHoldoutAssignment: {
          subjectId: "anon-1",
          experimentKey: "bfr-follow-holdout-v1",
          arm: "treatment",
          assignedAt: "2026-08-24T05:00:00-07:00",
          version: 1,
        },
      })
    );

    expect(normalized.follows.map((follow) => follow.beachId)).toEqual([
      BEACH_B,
      BEACH_A,
    ]);
    expect(normalized.follows[1]).toMatchObject({
      createdAt: FIRST_TIME,
      updatedAt: "2026-08-24T12:00:01.000Z",
    });
    expect(normalized.tombstones[0].removedAt).toBe(SECOND_TIME);
    expect(normalized.bfrHoldoutAssignment?.assignedAt).toBe(FIRST_TIME);
  });

  it("drops follows and tombstones with impossible calendar dates", () => {
    const normalized = appliedState(normalizeLocalFollowState({
      version: 1,
      follows: [
        {
          beachId: BEACH_A,
          topics: [FollowTopic.Surf],
          createdAt: "2026-02-30T00:00:00Z",
          updatedAt: FIRST_TIME,
        },
        {
          beachId: BEACH_B,
          topics: [FollowTopic.Tide],
          createdAt: FIRST_TIME,
          updatedAt: "2026-04-31T00:00:00-07:00",
        },
      ],
      tombstones: [
        {
          beachId: BEACH_C,
          removedAt: "2026-02-30T00:00:00Z",
        },
      ],
      bfrHoldoutAssignment: null,
    }));

    expect(normalized.follows).toEqual([]);
    expect(normalized.tombstones).toEqual([]);
  });

  it("round-trips a constructed BFR holdout assignment through local state", () => {
    const assignment = bfrHoldoutAssignment(
      "anon-1",
      "2026-08-24T05:00:00-07:00"
    );
    const normalized = appliedState(normalizeLocalFollowState({
      ...createLocalFollowState(),
      bfrHoldoutAssignment: assignment,
    }));

    expect(normalized.bfrHoldoutAssignment).toEqual(assignment);
    expect(normalized.bfrHoldoutAssignment?.assignedAt).toBe(FIRST_TIME);
  });
});
