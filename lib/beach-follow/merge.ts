import {
  type FollowedBeach,
  type FollowTopicAddedAt,
  type FollowTopicTombstone,
  type FollowTombstone,
  type LocalFollowMutationResult,
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
    left.topics.every((topic, index) => (
      topic === right.topics[index]
      && left.topicAddedAt[topic] === right.topicAddedAt[topic]
    ))
  );
}

function unionRows(
  server: FollowedBeach,
  anon: FollowedBeach | undefined,
  wholeTombstone: FollowTombstone | undefined,
  topicTombstones: readonly FollowTopicTombstone[]
): FollowedBeach {
  const latestRemovalByTopic = new Map(
    topicTombstones
      .filter((tombstone) => tombstone.beachId === server.beachId)
      .map((tombstone) => [tombstone.topic, tombstone.removedAt])
  );
  const candidateTopics = normalizeFollowTopics([
    ...server.topics,
    ...(anon?.topics ?? []),
  ]);
  const topicAddedAt = candidateTopics.reduce<FollowTopicAddedAt>(
    (timestamps, topic) => {
      const additions = [
        server.topics.includes(topic) ? server.topicAddedAt[topic] : undefined,
        anon?.topics.includes(topic) ? anon.topicAddedAt[topic] : undefined,
      ].filter((value): value is string => value !== undefined);
      timestamps[topic] = additions.sort(
        (left, right) => Date.parse(right) - Date.parse(left)
      )[0];
      return timestamps;
    },
    {}
  );
  const topics = candidateTopics
    .filter((topic) => {
      const latestAddition = topicAddedAt[topic];
      if (latestAddition === undefined) return false;
      const removalTimes = [
        wholeTombstone?.removedAt,
        latestRemovalByTopic.get(topic),
      ].filter((value): value is string => value !== undefined);
      return removalTimes.every(
        (removedAt) => Date.parse(latestAddition) > Date.parse(removedAt)
      );
    });
  const removedTopics = candidateTopics.filter(
    (topic) => !topics.includes(topic)
  );
  const latestAppliedRemoval = [
    ...(wholeTombstone && removedTopics.length > 0
      ? [wholeTombstone.removedAt]
      : []),
    ...topicTombstones
      .filter((tombstone) => (
        tombstone.beachId === server.beachId
        && removedTopics.includes(tombstone.topic)
      ))
      .map((tombstone) => tombstone.removedAt),
  ]
    .sort((left, right) => Date.parse(right) - Date.parse(left))[0];

  return {
    beachId: server.beachId,
    topics,
    topicAddedAt: topics.reduce<FollowTopicAddedAt>((timestamps, topic) => {
      timestamps[topic] = topicAddedAt[topic];
      return timestamps;
    }, {}),
    createdAt:
      !anon || Date.parse(server.createdAt) <= Date.parse(anon.createdAt)
        ? server.createdAt
        : anon.createdAt,
    updatedAt: [server.updatedAt, anon?.updatedAt, latestAppliedRemoval]
      .filter((value): value is string => value !== undefined)
      .sort((left, right) => Date.parse(right) - Date.parse(left))[0],
  };
}

function serverConfirmsFollow(
  server: FollowedBeach,
  local: FollowedBeach
): boolean {
  if (server.beachId !== local.beachId) return false;

  const persistedTopics = new Set(server.topics);
  return local.topics.every((topic) => {
    if (!persistedTopics.has(topic)) return false;
    const persistedAddedAt = server.topicAddedAt[topic];
    const localAddedAt = local.topicAddedAt[topic];
    return persistedAddedAt !== undefined
      && localAddedAt !== undefined
      && Date.parse(persistedAddedAt) >= Date.parse(localAddedAt);
  });
}

export interface AcknowledgeBeachFollowMergeInput {
  residualLocalState: unknown;
  postWriteServerRows: readonly FollowedBeach[];
}

export function acknowledgeBeachFollowMerge(
  input: AcknowledgeBeachFollowMergeInput
): LocalFollowMutationResult {
  const normalization = normalizeLocalFollowState(input.residualLocalState);
  if (normalization.status === "unsupported_version") return normalization;

  const serverRows = dedupeFollowedBeaches(input.postWriteServerRows);
  const serverByBeachId = new Map(serverRows.map((row) => [row.beachId, row]));
  const rawServerByBeachId = new Map(
    input.postWriteServerRows.map((row) => [row.beachId, row])
  );
  const follows = normalization.state.follows.filter((localRow) => {
    const serverRow = serverByBeachId.get(localRow.beachId);
    const rawServerRow = rawServerByBeachId.get(localRow.beachId);
    return !serverRow
      || !rawServerRow
      || !serverConfirmsFollow(rawServerRow, localRow);
  });
  const tombstones = normalization.state.tombstones.filter((tombstone) =>
    serverByBeachId.has(tombstone.beachId)
  );
  const topicTombstones = normalization.state.topicTombstones.filter(
    (tombstone) => {
      const serverRow = serverByBeachId.get(tombstone.beachId);
      return serverRow?.topics.includes(tombstone.topic) === true;
    }
  );
  const state = {
    ...normalization.state,
    follows,
    tombstones,
    topicTombstones,
  };

  return (
    follows.length === 0
    && tombstones.length === 0
    && topicTombstones.length === 0
  )
    ? { status: "applied", state }
    : { status: "sync_required", state };
}

export function mergeBeachFollows(input: MergeInput): MergeResult {
  const normalization = normalizeLocalFollowState(input.anonState);
  const serverRows = dedupeFollowedBeaches(input.serverRows);
  if (normalization.status === "unsupported_version") {
    return {
      status: "unsupported_version",
      rowsToInsert: [],
      rowsToDelete: [],
      accountState: {
        scope: "account",
        follows: serverRows.sort((left, right) =>
          left.beachId.localeCompare(right.beachId)
        ),
      },
      residualLocalState: normalization.opaqueEnvelope,
      clearedTombstones: [],
    };
  }
  const normalizedPendingCount =
    normalization.state.follows.length
    + normalization.state.tombstones.length
    + normalization.state.topicTombstones.length;
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
  const wholeTombstoneByBeachId = new Map(
    anonState.tombstones.map((tombstone) => [tombstone.beachId, tombstone])
  );
  const retainedByBeachId = new Map<string, FollowedBeach>();
  const rowsToInsert: FollowedBeach[] = [];
  const rowsToDeleteSet = new Set<string>();
  const anonByBeachId = new Map(
    anonState.follows.map((row) => [row.beachId, row])
  );

  for (const serverRow of serverRows) {
    const unioned = unionRows(
      serverRow,
      anonByBeachId.get(serverRow.beachId),
      wholeTombstoneByBeachId.get(serverRow.beachId),
      anonState.topicTombstones
    );
    if (unioned.topics.length === 0) {
      rowsToDeleteSet.add(serverRow.beachId);
      continue;
    }
    retainedByBeachId.set(serverRow.beachId, unioned);
    if (!rowsMatch(serverRow, unioned)) rowsToInsert.push(unioned);
  }

  for (const anonRow of anonState.follows) {
    const serverRow = serverByBeachId.get(anonRow.beachId);
    if (serverRow) continue;

    retainedByBeachId.set(anonRow.beachId, anonRow);
    rowsToInsert.push(anonRow);
  }

  const mergedFollows = [...retainedByBeachId.values()].sort((left, right) =>
    left.beachId.localeCompare(right.beachId)
  );

  return {
    status: isPlannableFollowOverflow ? "sync_required" : "applied",
    rowsToInsert,
    rowsToDelete: [...rowsToDeleteSet].sort(),
    accountState: {
      scope: "account",
      follows: mergedFollows,
    },
    residualLocalState: isPlannableFollowOverflow
      ? anonState
      : {
          version: 3,
          follows: [],
          tombstones: [],
          topicTombstones: [],
          bfrHoldoutAssignment: anonState.bfrHoldoutAssignment,
        },
    clearedTombstones: isPlannableFollowOverflow
      ? []
      : anonState.tombstones
          .map((tombstone) => tombstone.beachId)
          .sort(),
  };
}
