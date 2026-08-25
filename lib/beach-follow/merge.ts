import {
  type FollowedBeach,
  type MergeInput,
  type MergeResult,
} from "@/types/beach-follow";
import {
  MAX_FOLLOWED_BEACHES,
  MAX_PENDING_FOLLOW_OPERATIONS,
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
  const normalization = normalizeLocalFollowState(input.anonState);
  const serverRows = dedupeFollowedBeaches(input.serverRows);
  const normalizedPendingCount =
    normalization.state.follows.length + normalization.state.tombstones.length;
  const isPlannableFollowOverflow =
    normalization.state.follows.length > MAX_FOLLOWED_BEACHES
    && normalizedPendingCount <= MAX_PENDING_FOLLOW_OPERATIONS;
  if (
    normalization.status === "sync_required"
    && !isPlannableFollowOverflow
  ) {
    return {
      status: "sync_required",
      rowsToInsert: [],
      rowsToDelete: [],
      accountState: {
        scope: "account",
        follows: serverRows.sort((left, right) =>
          left.beachId.localeCompare(right.beachId)
        ),
      },
      residualLocalState: normalization.state,
      clearedTombstones: [],
    };
  }
  const anonState = normalization.state;
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
    status: isPlannableFollowOverflow ? "sync_required" : "applied",
    rowsToInsert,
    rowsToDelete,
    accountState: {
      scope: "account",
      follows: mergedFollows,
    },
    residualLocalState: isPlannableFollowOverflow
      ? anonState
      : {
          version: 1,
          follows: [],
          tombstones: [],
          bfrHoldoutAssignment: anonState.bfrHoldoutAssignment,
        },
    clearedTombstones: isPlannableFollowOverflow
      ? []
      : anonState.tombstones
          .map((tombstone) => tombstone.beachId)
          .sort(),
  };
}
