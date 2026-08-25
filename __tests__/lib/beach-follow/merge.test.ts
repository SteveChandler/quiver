import {
  acknowledgeBeachFollowMerge,
  mergeBeachFollows,
} from "@/lib/beach-follow/merge";
import { bfrHoldoutAssignment } from "@/lib/experiments/bfr-holdout";
import {
  MAX_FOLLOWED_BEACHES,
  MAX_PENDING_FOLLOW_OPERATIONS,
  addFollow,
  createLocalFollowState,
  normalizeLocalFollowState,
  removeFollow,
  updateFollowTopics,
} from "@/lib/beach-follow/state";
import {
  FollowTopic,
  type FollowedBeach,
  type LocalFollowMutationResult,
  type LocalFollowState,
  type MergeResult,
} from "@/types/beach-follow";

const FIRST_TIME = "2026-08-24T12:00:00.000Z";
const SECOND_TIME = "2026-08-24T13:00:00.000Z";
const EARLIER_TIME = "2026-08-24T11:00:00.000Z";
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

function appliedState(result: LocalFollowMutationResult): LocalFollowState {
  expect(result.status).toBe("applied");
  if (!("state" in result)) {
    throw new Error("Expected a supported local follow state");
  }
  return result.state;
}

function residualState(result: MergeResult): LocalFollowState {
  if (result.status === "unsupported_version") {
    throw new Error("Expected a supported merge result");
  }
  return result.residualLocalState;
}

describe("anonymous beach-follow merge", () => {
  it("applies a newer anonymous topic removal without resurrecting the server topic", () => {
    const followed = appliedState(addFollow(
      createLocalFollowState(),
      { beachId: BEACH_A, topics: [FollowTopic.Surf, FollowTopic.Tide] },
      FIRST_TIME
    ));
    const anonState = appliedState(updateFollowTopics(
      followed,
      BEACH_A,
      [FollowTopic.Tide],
      SECOND_TIME
    ));

    const result = mergeBeachFollows({
      anonState,
      serverRows: [
        serverFollow(BEACH_A, [FollowTopic.Surf, FollowTopic.Tide], FIRST_TIME),
      ],
    });

    expect(result.rowsToInsert).toEqual([
      serverFollow(BEACH_A, [FollowTopic.Tide], SECOND_TIME),
    ]);
    expect(result.accountState.follows).toEqual([
      serverFollow(BEACH_A, [FollowTopic.Tide], SECOND_TIME),
    ]);
  });

  it("preserves concurrent topic additions from both anonymous and server state", () => {
    const anonState = appliedState(addFollow(
      createLocalFollowState(),
      { beachId: BEACH_A, topics: [FollowTopic.Tide] },
      SECOND_TIME
    ));

    const result = mergeBeachFollows({
      anonState,
      serverRows: [serverFollow(BEACH_A, [FollowTopic.Wind], SECOND_TIME)],
    });

    expect(result.rowsToInsert).toEqual([
      serverFollow(BEACH_A, [FollowTopic.Tide, FollowTopic.Wind], SECOND_TIME),
    ]);
  });

  it("does not let an older anonymous topic removal erase a newer server topic", () => {
    const followed = appliedState(addFollow(
      createLocalFollowState(),
      { beachId: BEACH_A, topics: [FollowTopic.Surf, FollowTopic.Tide] },
      "2026-08-24T10:00:00.000Z"
    ));
    const anonState = appliedState(updateFollowTopics(
      followed,
      BEACH_A,
      [FollowTopic.Tide],
      EARLIER_TIME
    ));
    const serverRow = serverFollow(
      BEACH_A,
      [FollowTopic.Surf, FollowTopic.Tide],
      FIRST_TIME
    );

    const result = mergeBeachFollows({ anonState, serverRows: [serverRow] });

    const mergedRow = {
      ...serverRow,
      createdAt: "2026-08-24T10:00:00.000Z",
    };
    expect(result.rowsToInsert).toEqual([mergedRow]);
    expect(result.accountState.follows).toEqual([mergedRow]);
  });

  it("lets an anonymous topic removal win a server-add timestamp tie", () => {
    const followed = appliedState(addFollow(
      createLocalFollowState(),
      { beachId: BEACH_A, topics: [FollowTopic.Surf, FollowTopic.Tide] },
      "2026-08-24T10:00:00.000Z"
    ));
    const anonState = appliedState(updateFollowTopics(
      followed,
      BEACH_A,
      [FollowTopic.Tide],
      FIRST_TIME
    ));

    const result = mergeBeachFollows({
      anonState,
      serverRows: [
        serverFollow(BEACH_A, [FollowTopic.Surf, FollowTopic.Tide], FIRST_TIME),
      ],
    });

    expect(result.accountState.follows[0]).toMatchObject({
      topics: [FollowTopic.Tide],
      updatedAt: FIRST_TIME,
    });
  });

  it.each(["-23:59", "+14:01"])(
    "does not turn malformed %s offsets into follow inserts or tombstone deletes",
    (offset) => {
      const serverRow = serverFollow(BEACH_A, [FollowTopic.Surf]);
      const malformedInstant = `2026-08-24T00:00:00${offset}`;

      const result = mergeBeachFollows({
        anonState: {
          version: 1,
          follows: [{
            beachId: BEACH_B,
            topics: [FollowTopic.Tide],
            createdAt: malformedInstant,
            updatedAt: malformedInstant,
          }],
          tombstones: [{ beachId: BEACH_A, removedAt: malformedInstant }],
          bfrHoldoutAssignment: null,
        },
        serverRows: [serverRow],
      });

      expect(result.rowsToInsert).toEqual([]);
      expect(result.rowsToDelete).toEqual([]);
      expect(result.accountState.follows).toEqual([serverRow]);
    }
  );

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

  it("retains a newer server follow and consumes the stale tombstone", () => {
    const anonState = appliedState(removeFollow(
      createLocalFollowState(),
      BEACH_A,
      FIRST_TIME
    ));
    const serverRow = serverFollow(
      BEACH_A,
      [FollowTopic.Surf],
      SECOND_TIME
    );

    const result = mergeBeachFollows({
      anonState,
      serverRows: [serverRow],
    });

    expect(result.rowsToDelete).toEqual([]);
    expect(result.accountState.follows).toEqual([serverRow]);
    expect(result.clearedTombstones).toEqual([BEACH_A]);
  });

  it("applies a newer tombstone against an older server follow", () => {
    const anonState = appliedState(removeFollow(
      createLocalFollowState(),
      BEACH_A,
      SECOND_TIME
    ));

    const result = mergeBeachFollows({
      anonState,
      serverRows: [serverFollow(BEACH_A, [FollowTopic.Surf], FIRST_TIME)],
    });

    expect(result.rowsToDelete).toEqual([BEACH_A]);
    expect(result.accountState.follows).toEqual([]);
    expect(result.clearedTombstones).toEqual([BEACH_A]);
  });

  it("lets a tombstone win a timestamp tie deterministically", () => {
    const anonState = appliedState(removeFollow(
      createLocalFollowState(),
      BEACH_A,
      SECOND_TIME
    ));

    const result = mergeBeachFollows({
      anonState,
      serverRows: [serverFollow(BEACH_A, [FollowTopic.Surf], SECOND_TIME)],
    });

    expect(result.rowsToDelete).toEqual([BEACH_A]);
    expect(result.accountState.follows).toEqual([]);
  });

  it.each([
    ["newer follow survives", SECOND_TIME, FIRST_TIME, false],
    ["newer tombstone applies", FIRST_TIME, SECOND_TIME, true],
    ["tied tombstone applies", SECOND_TIME, SECOND_TIME, true],
  ] as const)(
    "resolves a local same-beach conflict before merge: %s",
    (_, updatedAt, removedAt, shouldDelete) => {
      const result = mergeBeachFollows({
        anonState: {
          version: 1,
          follows: [{
            beachId: BEACH_A,
            topics: [FollowTopic.Tide],
            createdAt: FIRST_TIME,
            updatedAt,
          }],
          tombstones: [{ beachId: BEACH_A, removedAt }],
          bfrHoldoutAssignment: null,
        },
        serverRows: [serverFollow(BEACH_A, [FollowTopic.Surf], EARLIER_TIME)],
      });

      expect(result.rowsToDelete).toEqual(shouldDelete ? [BEACH_A] : []);
      expect(result.rowsToInsert).toEqual(shouldDelete ? [] : [{
        beachId: BEACH_A,
        topics: [FollowTopic.Surf, FollowTopic.Tide],
        createdAt: FIRST_TIME,
        updatedAt: SECOND_TIME,
      }]);
      expect(result.accountState.follows).toHaveLength(shouldDelete ? 0 : 1);
    }
  );

  it("preserves an explicit removal when the v1 follows array is corrupt", () => {
    const result = mergeBeachFollows({
      anonState: {
        version: 1,
        follows: null,
        tombstones: [{ beachId: BEACH_A, removedAt: SECOND_TIME }],
        bfrHoldoutAssignment: null,
      },
      serverRows: [serverFollow(BEACH_A, [FollowTopic.Surf])],
    });

    expect(result.rowsToDelete).toEqual([BEACH_A]);
    expect(result.accountState).toEqual({ scope: "account", follows: [] });
    expect(result.clearedTombstones).toEqual([BEACH_A]);
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
    expect(
      appliedState(normalizeLocalFollowState(result.residualLocalState))
    ).toEqual(result.residualLocalState);
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

    expect(residualState(result).bfrHoldoutAssignment).toEqual(assignment);
    expect(residualState(result).bfrHoldoutAssignment?.subjectId).toBe(
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

  it("does not build a delete plan from a quarantined 101-tombstone envelope", () => {
    const tombstones = Array.from(
      { length: MAX_PENDING_FOLLOW_OPERATIONS + 1 },
      (_, index) => ({
        beachId: beachIdFor("server", index),
        removedAt: SECOND_TIME,
      })
    );
    const serverRows = tombstones.map(({ beachId }) =>
      serverFollow(beachId, [FollowTopic.General])
    );

    const result = mergeBeachFollows({
      anonState: {
        version: 1,
        follows: [],
        tombstones,
        bfrHoldoutAssignment: null,
      },
      serverRows,
    });

    expect(result.status).toBe("sync_required");
    expect(result.rowsToDelete).toEqual([]);
    expect(result.clearedTombstones).toEqual([]);
    expect(residualState(result).tombstones).toEqual(tombstones);
  });

  it("does not rewrite an impossible tombstone date into an account delete", () => {
    const serverRow = serverFollow(beachIdFor("server", 1), [FollowTopic.Surf]);

    const result = mergeBeachFollows({
      anonState: {
        version: 1,
        follows: [],
        tombstones: [{
          beachId: serverRow.beachId,
          removedAt: "2026-02-30T00:00:00Z",
        }],
        bfrHoldoutAssignment: null,
      },
      serverRows: [serverRow],
    });

    expect(result.status).toBe("applied");
    expect(result.rowsToDelete).toEqual([]);
    expect(result.accountState.follows).toEqual([serverRow]);
  });

  it("quarantines an unsupported envelope without merging or overwriting it", () => {
    const futureEnvelope = JSON.stringify({
      version: 3,
      follows: [serverFollow(beachIdFor("anon", 1), [FollowTopic.Surf])],
      tombstones: [],
      futureField: { retained: true },
    });
    const serverRow = serverFollow(beachIdFor("server", 1), [FollowTopic.Tide]);

    const result = mergeBeachFollows({
      anonState: futureEnvelope,
      serverRows: [serverRow],
    });

    expect(result).toEqual({
      status: "unsupported_version",
      rowsToInsert: [],
      rowsToDelete: [],
      accountState: { scope: "account", follows: [serverRow] },
      residualLocalState: futureEnvelope,
      clearedTombstones: [],
    });
  });

  it("acknowledges all 55 semantically persisted follows after the server trigger rewrites time", () => {
    const clientTime = "2099-08-24T13:00:00.000Z";
    const postTriggerTime = "2026-08-24T13:00:00.000Z";
    const follows = Array.from(
      { length: MAX_FOLLOWED_BEACHES + 5 },
      (_, index) => ({
        beachId: beachIdFor("anon", index),
        topics: [FollowTopic.General],
        createdAt: FIRST_TIME,
        updatedAt: clientTime,
      })
    );
    const assignment = bfrHoldoutAssignment("anon-visitor-123", FIRST_TIME);
    const anonState: LocalFollowState = {
      version: 2,
      follows,
      tombstones: [],
      topicTombstones: [],
      bfrHoldoutAssignment: assignment,
    };

    const result = mergeBeachFollows({ anonState, serverRows: [] });

    expect(result.status).toBe("sync_required");
    expect(result.rowsToInsert).toEqual(follows);
    expect(result.rowsToDelete).toEqual([]);
    expect(result.accountState.follows).toEqual(follows);
    expect(result.residualLocalState).toEqual(anonState);
    expect(result.clearedTombstones).toEqual([]);

    const acknowledged = acknowledgeBeachFollowMerge({
      residualLocalState: result.residualLocalState,
      postWriteServerRows: result.accountState.follows.map((follow) => ({
        ...follow,
        updatedAt: postTriggerTime,
      })),
    });

    expect(acknowledged).toEqual({
      status: "applied",
      state: {
        version: 2,
        follows: [],
        tombstones: [],
        topicTombstones: [],
        bfrHoldoutAssignment: assignment,
      },
    });
    if (acknowledged.status !== "applied") {
      throw new Error("Expected the acknowledged state to converge");
    }

    const resumed = addFollow(
      acknowledged.state,
      {
        beachId: beachIdFor("anon", MAX_FOLLOWED_BEACHES + 5),
        topics: [FollowTopic.Surf],
      },
      SECOND_TIME
    );
    expect(resumed.status).toBe("applied");
    if (!("state" in resumed)) {
      throw new Error("Expected a supported local follow state");
    }
    expect(resumed.state.follows).toHaveLength(1);
  });

  it("keeps only unconfirmed oversized follows locked", () => {
    const follows = Array.from(
      { length: MAX_FOLLOWED_BEACHES + 5 },
      (_, index) => ({
        beachId: beachIdFor("anon", index),
        topics: [FollowTopic.General],
        createdAt: FIRST_TIME,
        updatedAt: SECOND_TIME,
      })
    );
    const anonState: LocalFollowState = {
      version: 2,
      follows,
      tombstones: [],
      topicTombstones: [],
      bfrHoldoutAssignment: null,
    };
    const result = mergeBeachFollows({ anonState, serverRows: [] });

    const partial = acknowledgeBeachFollowMerge({
      residualLocalState: result.residualLocalState,
      postWriteServerRows: result.accountState.follows.slice(0, -1),
    });

    expect(partial).toEqual({
      status: "sync_required",
      state: {
        version: 2,
        follows: [follows[follows.length - 1]],
        tombstones: [],
        topicTombstones: [],
        bfrHoldoutAssignment: null,
      },
    });
  });

  it("keeps an oversized follow locked when the server is missing a requested topic", () => {
    const follows = Array.from(
      { length: MAX_FOLLOWED_BEACHES + 5 },
      (_, index) => ({
        beachId: beachIdFor("anon", index),
        topics: [FollowTopic.General, FollowTopic.Surf],
        createdAt: FIRST_TIME,
        updatedAt: SECOND_TIME,
      })
    );
    const anonState: LocalFollowState = {
      version: 2,
      follows,
      tombstones: [],
      topicTombstones: [],
      bfrHoldoutAssignment: null,
    };
    const result = mergeBeachFollows({ anonState, serverRows: [] });
    const incompleteServerRows = result.accountState.follows.map(
      (follow, index) => index === 0
        ? { ...follow, topics: [FollowTopic.General] }
        : follow
    );

    expect(acknowledgeBeachFollowMerge({
      residualLocalState: result.residualLocalState,
      postWriteServerRows: incompleteServerRows,
    })).toEqual({
      status: "sync_required",
      state: {
        version: 2,
        follows: [residualState(result).follows[0]],
        tombstones: [],
        topicTombstones: [],
        bfrHoldoutAssignment: null,
      },
    });
  });

  it("does not clear oversized follows without server confirmation", () => {
    const follows = Array.from(
      { length: MAX_FOLLOWED_BEACHES + 5 },
      (_, index) => ({
        beachId: beachIdFor("anon", index),
        topics: [FollowTopic.General],
        createdAt: FIRST_TIME,
        updatedAt: SECOND_TIME,
      })
    );
    const anonState: LocalFollowState = {
      version: 2,
      follows,
      tombstones: [],
      topicTombstones: [],
      bfrHoldoutAssignment: null,
    };
    const result = mergeBeachFollows({ anonState, serverRows: [] });

    expect(acknowledgeBeachFollowMerge({
      residualLocalState: result.residualLocalState,
      postWriteServerRows: [],
    })).toEqual({ status: "sync_required", state: anonState });
  });

  it("acknowledges only tombstones absent from the post-write snapshot", () => {
    const retainedServerRow = serverFollow(BEACH_A, [FollowTopic.Surf]);
    const anonState: LocalFollowState = {
      version: 2,
      follows: [],
      tombstones: [
        { beachId: BEACH_A, removedAt: SECOND_TIME },
        { beachId: BEACH_B, removedAt: SECOND_TIME },
      ],
      topicTombstones: [],
      bfrHoldoutAssignment: null,
    };

    expect(acknowledgeBeachFollowMerge({
      residualLocalState: anonState,
      postWriteServerRows: [retainedServerRow],
    })).toEqual({
      status: "sync_required",
      state: {
        ...anonState,
        tombstones: [{ beachId: BEACH_A, removedAt: SECOND_TIME }],
      },
    });
  });
});
