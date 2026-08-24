import { mergeBeachFollows } from "@/lib/beach-follow/merge";
import {
  MAX_FOLLOWED_BEACHES,
  addFollow,
  createLocalFollowState,
  removeFollow,
} from "@/lib/beach-follow/state";
import { FollowTopic, type FollowedBeach } from "@/types/beach-follow";

const FIRST_TIME = "2026-08-24T12:00:00.000Z";
const SECOND_TIME = "2026-08-24T13:00:00.000Z";

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
      { beachId: "beach-a", topics: [FollowTopic.Surf, FollowTopic.Tide] },
      SECOND_TIME
    );
    anonState = addFollow(
      anonState,
      { beachId: "beach-b", topics: [FollowTopic.WaterTemp] },
      SECOND_TIME
    );

    const result = mergeBeachFollows({
      anonState,
      serverRows: [
        serverFollow("beach-a", [FollowTopic.Tide, FollowTopic.Wind]),
        serverFollow("beach-c", [FollowTopic.General]),
      ],
    });

    expect(result.rowsToInsert).toEqual([
      serverFollow(
        "beach-a",
        [FollowTopic.Surf, FollowTopic.Tide, FollowTopic.Wind],
        SECOND_TIME
      ),
      {
        beachId: "beach-b",
        topics: [FollowTopic.WaterTemp],
        createdAt: SECOND_TIME,
        updatedAt: SECOND_TIME,
      },
    ]);
    expect(result.rowsToDelete).toEqual([]);
    expect(result.mergedState.follows.map((follow) => follow.beachId)).toEqual([
      "beach-a",
      "beach-b",
      "beach-c",
    ]);
  });

  it("applies explicit-removal tombstones exactly once and clears them", () => {
    const anonState = removeFollow(
      addFollow(
        createLocalFollowState(),
        { beachId: "beach-a", topics: [FollowTopic.Tide] },
        FIRST_TIME
      ),
      "beach-a",
      SECOND_TIME
    );

    const result = mergeBeachFollows({
      anonState,
      serverRows: [serverFollow("beach-a", [FollowTopic.Surf])],
    });

    expect(result.rowsToDelete).toEqual(["beach-a"]);
    expect(result.clearedTombstones).toEqual(["beach-a"]);
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
      { beachId: "beach-a", topics: [FollowTopic.Surf] },
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

  it("does not merge additions beyond the follow bound", () => {
    let anonState = createLocalFollowState();
    for (let index = 0; index < 3; index += 1) {
      anonState = addFollow(
        anonState,
        { beachId: `anon-${index}`, topics: [FollowTopic.General] },
        SECOND_TIME
      );
    }
    const serverRows = Array.from(
      { length: MAX_FOLLOWED_BEACHES - 1 },
      (_, index) => serverFollow(`server-${index}`, [FollowTopic.General])
    );

    const result = mergeBeachFollows({ anonState, serverRows });

    expect(result.mergedState.follows).toHaveLength(MAX_FOLLOWED_BEACHES);
    expect(result.rowsToInsert).toHaveLength(1);
  });
});
