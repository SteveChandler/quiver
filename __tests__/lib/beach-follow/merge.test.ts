import { mergeBeachFollows } from "@/lib/beach-follow/merge";
import { bfrHoldoutAssignment } from "@/lib/experiments/bfr-holdout";
import {
  addFollow,
  createLocalFollowState,
  removeFollow,
} from "@/lib/beach-follow/state";
import { FollowTopic, type FollowedBeach } from "@/types/beach-follow";

const FIRST_TIME = "2026-08-24T12:00:00.000Z";
const SECOND_TIME = "2026-08-24T13:00:00.000Z";
const BEACH_A = "11111111-1111-4111-8111-111111111111";
const BEACH_B = "22222222-2222-4222-8222-222222222222";
const BEACH_C = "33333333-3333-4333-8333-333333333333";

function beachIdFor(prefix: "anon" | "server", index: number): string {
  const namespace = prefix === "anon" ? "a000" : "5000";
  return `00000000-0000-4000-8000-${namespace}${String(index).padStart(8, "0")}`;
}

function serverFollow(
  beachId: string,
  topics: FollowTopic[],
  updatedAt = FIRST_TIME
): FollowedBeach {
  return { beachId, topics, createdAt: FIRST_TIME, updatedAt };
}

describe("anonymous beach-follow merge", () => {
  it("unions signed-in rows, beaches and topics without duplicates", () => {
    let anonState = addFollow(
      createLocalFollowState(),
      { beachId: BEACH_A, topics: [FollowTopic.Surf, FollowTopic.Tide] },
      SECOND_TIME
    );
    anonState = addFollow(
      anonState,
      { beachId: BEACH_B, topics: [FollowTopic.WaterTemp] },
      SECOND_TIME
    );

    const result = mergeBeachFollows({
      anonState,
      serverRows: [
        serverFollow(BEACH_A, [FollowTopic.Tide, FollowTopic.Wind]),
        serverFollow(BEACH_C, [FollowTopic.General]),
      ],
    });

    expect(result.rowsToInsert).toEqual([
      serverFollow(
        BEACH_A,
        [FollowTopic.Surf, FollowTopic.Tide, FollowTopic.Wind],
        SECOND_TIME
      ),
      {
        beachId: BEACH_B,
        topics: [FollowTopic.WaterTemp],
        createdAt: SECOND_TIME,
        updatedAt: SECOND_TIME,
      },
    ]);
    expect(result.rowsToDelete).toEqual([]);
    expect(result.mergedState.follows.map((follow) => follow.beachId)).toEqual([
      BEACH_A,
      BEACH_B,
      BEACH_C,
    ]);
  });

  it("applies explicit-removal tombstones exactly once and clears them", () => {
    const anonState = removeFollow(
      addFollow(
        createLocalFollowState(),
        { beachId: BEACH_A, topics: [FollowTopic.Tide] },
        FIRST_TIME
      ),
      BEACH_A,
      SECOND_TIME
    );

    const result = mergeBeachFollows({
      anonState,
      serverRows: [serverFollow(BEACH_A, [FollowTopic.Surf])],
    });

    expect(result.rowsToDelete).toEqual([BEACH_A]);
    expect(result.clearedTombstones).toEqual([BEACH_A]);
    expect(result.mergedState).toEqual(createLocalFollowState());

    const retry = mergeBeachFollows({
      anonState: result.mergedState,
      serverRows: [],
    });
    expect(retry.rowsToInsert).toEqual([]);
    expect(retry.rowsToDelete).toEqual([]);
    expect(retry.clearedTombstones).toEqual([]);
  });

  it("is a no-op after the first merge result is persisted", () => {
    const anonState = addFollow(
      createLocalFollowState(),
      { beachId: BEACH_A, topics: [FollowTopic.Surf] },
      SECOND_TIME
    );
    const first = mergeBeachFollows({ anonState, serverRows: [] });
    const retry = mergeBeachFollows({
      anonState: first.mergedState,
      serverRows: first.mergedState.follows,
    });

    expect(retry.rowsToInsert).toEqual([]);
    expect(retry.rowsToDelete).toEqual([]);
    expect(retry.clearedTombstones).toEqual([]);
  });

  it("losslessly merges every anonymous follow even when the account exceeds the device bound", () => {
    let anonState = createLocalFollowState();
    for (let index = 0; index < 3; index += 1) {
      anonState = addFollow(
        anonState,
        { beachId: beachIdFor("anon", index), topics: [FollowTopic.General] },
        SECOND_TIME
      );
    }
    const serverRows = Array.from(
      { length: 49 },
      (_, index) =>
        serverFollow(beachIdFor("server", index), [FollowTopic.General])
    );

    const result = mergeBeachFollows({ anonState, serverRows });

    expect(result.mergedState.follows).toHaveLength(52);
    expect(result.rowsToInsert.map((row) => row.beachId)).toEqual([
      beachIdFor("anon", 0),
      beachIdFor("anon", 1),
      beachIdFor("anon", 2),
    ]);
  });

  it("preserves the anonymous holdout assignment across account merge", () => {
    const assignment = bfrHoldoutAssignment("anon-visitor-123", FIRST_TIME);
    const anonState = {
      ...addFollow(
        createLocalFollowState(),
        { beachId: BEACH_A, topics: [FollowTopic.Surf] },
        SECOND_TIME
      ),
      bfrHoldoutAssignment: assignment,
    };

    const result = mergeBeachFollows({ anonState, serverRows: [] });

    expect(result.mergedState.bfrHoldoutAssignment).toEqual(assignment);
    expect(result.mergedState.bfrHoldoutAssignment?.subjectId).toBe(
      "anon-visitor-123"
    );
  });
});
