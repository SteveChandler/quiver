import { mergeBeachFollows } from "@/lib/beach-follow/merge";
import { bfrHoldoutAssignment } from "@/lib/experiments/bfr-holdout";
import {
  addFollow,
  createLocalFollowState,
  normalizeLocalFollowState,
  removeFollow,
} from "@/lib/beach-follow/state";
import {
  FollowTopic,
  type FollowedBeach,
  type LocalFollowState,
} from "@/types/beach-follow";

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

function appliedState(result: {
  status: string;
  state: LocalFollowState;
}): LocalFollowState {
  expect(result.status).toBe("applied");
  return result.state;
}

describe("anonymous beach-follow merge", () => {
  it("unions signed-in rows, beaches and topics without duplicates", () => {
    let anonState = appliedState(addFollow(
      createLocalFollowState(),
      { beachId: BEACH_A, topics: [FollowTopic.Surf, FollowTopic.Tide] },
      SECOND_TIME
    ));
    anonState = appliedState(addFollow(
      anonState,
      { beachId: BEACH_B, topics: [FollowTopic.WaterTemp] },
      SECOND_TIME
    ));

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
    expect(result.accountState.follows.map((follow) => follow.beachId)).toEqual([
      BEACH_A,
      BEACH_B,
      BEACH_C,
    ]);
  });

  it("applies explicit-removal tombstones exactly once and clears them", () => {
    const anonState = appliedState(removeFollow(
      appliedState(addFollow(
        createLocalFollowState(),
        { beachId: BEACH_A, topics: [FollowTopic.Tide] },
        FIRST_TIME
      )),
      BEACH_A,
      SECOND_TIME
    ));

    const result = mergeBeachFollows({
      anonState,
      serverRows: [serverFollow(BEACH_A, [FollowTopic.Surf])],
    });

    expect(result.rowsToDelete).toEqual([BEACH_A]);
    expect(result.clearedTombstones).toEqual([BEACH_A]);
    expect(result.accountState).toEqual({ scope: "account", follows: [] });
    expect(result.residualLocalState).toEqual(createLocalFollowState());

    const retry = mergeBeachFollows({
      anonState: result.residualLocalState,
      serverRows: [],
    });
    expect(retry.rowsToInsert).toEqual([]);
    expect(retry.rowsToDelete).toEqual([]);
    expect(retry.clearedTombstones).toEqual([]);
  });

  it("is a no-op after the first merge result is persisted", () => {
    const anonState = appliedState(addFollow(
      createLocalFollowState(),
      { beachId: BEACH_A, topics: [FollowTopic.Surf] },
      SECOND_TIME
    ));
    const first = mergeBeachFollows({ anonState, serverRows: [] });
    const retry = mergeBeachFollows({
      anonState: first.residualLocalState,
      serverRows: first.accountState.follows,
    });

    expect(retry.rowsToInsert).toEqual([]);
    expect(retry.rowsToDelete).toEqual([]);
    expect(retry.clearedTombstones).toEqual([]);
  });

  it("losslessly merges every anonymous follow even when the account exceeds the device bound", () => {
    let anonState = createLocalFollowState();
    for (let index = 0; index < 3; index += 1) {
      anonState = appliedState(addFollow(
        anonState,
        { beachId: beachIdFor("anon", index), topics: [FollowTopic.General] },
        SECOND_TIME
      ));
    }
    const serverRows = Array.from(
      { length: 49 },
      (_, index) =>
        serverFollow(beachIdFor("server", index), [FollowTopic.General])
    );

    const result = mergeBeachFollows({ anonState, serverRows });

    expect(result.accountState).toMatchObject({
      scope: "account",
      follows: expect.any(Array),
    });
    expect(result.accountState.follows).toHaveLength(52);
    expect(normalizeLocalFollowState(result.residualLocalState)).toEqual(
      result.residualLocalState
    );
    expect(result.rowsToInsert.map((row) => row.beachId)).toEqual([
      beachIdFor("anon", 0),
      beachIdFor("anon", 1),
      beachIdFor("anon", 2),
    ]);
  });

  it("preserves the anonymous holdout assignment across account merge", () => {
    const assignment = bfrHoldoutAssignment("anon-visitor-123", FIRST_TIME);
    const anonState = {
      ...appliedState(addFollow(
        createLocalFollowState(),
        { beachId: BEACH_A, topics: [FollowTopic.Surf] },
        SECOND_TIME
      )),
      bfrHoldoutAssignment: assignment,
    };

    const result = mergeBeachFollows({ anonState, serverRows: [] });

    expect(result.residualLocalState.bfrHoldoutAssignment).toEqual(assignment);
    expect(result.residualLocalState.bfrHoldoutAssignment?.subjectId).toBe(
      "anon-visitor-123"
    );
  });

  it("emits deletes for all 51 retained tombstones", () => {
    let anonState = createLocalFollowState();
    const serverRows = Array.from({ length: 51 }, (_, index) =>
      serverFollow(beachIdFor("server", index), [FollowTopic.General])
    );

    for (let index = 0; index < serverRows.length; index += 1) {
      anonState = appliedState(
        removeFollow(anonState, serverRows[index].beachId, SECOND_TIME)
      );
    }

    const result = mergeBeachFollows({ anonState, serverRows });

    expect(anonState.tombstones).toHaveLength(51);
    expect(result.rowsToDelete).toEqual(
      serverRows.map((row) => row.beachId).sort()
    );
  });
});
