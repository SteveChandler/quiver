import {
  type FollowedBeach,
  type MergeInput,
  type MergeResult,
} from "@/types/beach-follow";
import {
  dedupeFollowedBeaches,
  normalizeFollowTopics,
  normalizeLocalFollowState,
} from "./state";

function rowsMatch(left: FollowedBeach, right: FollowedBeach): boolean {
  return (
    left.createdAt === right.createdAt &&
    left.updatedAt === right.updatedAt &&
    left.topics.length === right.topics.length &&
    left.topics.every((topic, index) => topic === right.topics[index])
  );
}

function unionRows(server: FollowedBeach, anon: FollowedBeach): FollowedBeach {
  return {
    beachId: server.beachId,
    topics: normalizeFollowTopics([...server.topics, ...anon.topics]),
    createdAt:
      Date.parse(server.createdAt) <= Date.parse(anon.createdAt)
        ? server.createdAt
        : anon.createdAt,
    updatedAt:
      Date.parse(server.updatedAt) >= Date.parse(anon.updatedAt)
        ? server.updatedAt
        : anon.updatedAt,
  };
}

export function mergeBeachFollows(input: MergeInput): MergeResult {
  const anonState = normalizeLocalFollowState(input.anonState);
  const serverRows = dedupeFollowedBeaches(input.serverRows);
  const serverByBeachId = new Map(serverRows.map((row) => [row.beachId, row]));
  const deletedBeachIds = new Set(
    anonState.tombstones.map((tombstone) => tombstone.beachId)
  );
  const rowsToDelete = serverRows
    .filter((row) => deletedBeachIds.has(row.beachId))
    .map((row) => row.beachId)
    .sort();
  const retainedServerRows = serverRows.filter(
    (row) => !deletedBeachIds.has(row.beachId)
  );
  const retainedByBeachId = new Map(
    retainedServerRows.map((row) => [row.beachId, row])
  );
  const rowsToInsert: FollowedBeach[] = [];

  for (const anonRow of anonState.follows) {
    if (deletedBeachIds.has(anonRow.beachId)) continue;
    const serverRow = serverByBeachId.get(anonRow.beachId);
    if (serverRow) {
      const unioned = unionRows(serverRow, anonRow);
      retainedByBeachId.set(anonRow.beachId, unioned);
      if (!rowsMatch(serverRow, unioned)) rowsToInsert.push(unioned);
      continue;
    }

    retainedByBeachId.set(anonRow.beachId, anonRow);
    rowsToInsert.push(anonRow);
  }

  const mergedFollows = [...retainedByBeachId.values()].sort((left, right) =>
    left.beachId.localeCompare(right.beachId)
  );

  return {
    rowsToInsert,
    rowsToDelete,
    accountState: {
      scope: "account",
      follows: mergedFollows,
    },
    residualLocalState: {
      version: 1,
      follows: [],
      tombstones: [],
      bfrHoldoutAssignment: anonState.bfrHoldoutAssignment,
    },
    clearedTombstones: anonState.tombstones
      .map((tombstone) => tombstone.beachId)
      .sort(),
  };
}
