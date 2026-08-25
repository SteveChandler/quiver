import {
  type BfrHoldoutAssignmentRecord,
  FollowTopic,
  type FollowedBeach,
  type FollowTopicTombstone,
  type FollowTombstone,
  type LocalFollowMutationResult,
  type LocalFollowNormalizationResult,
  type LocalFollowState,
} from "@/types/beach-follow";

export const LOCAL_FOLLOW_STATE_VERSION = 2 as const;
export const MAX_FOLLOWED_BEACHES = 50;
export const MAX_PENDING_FOLLOW_OPERATIONS = 100;
export const MAX_BEACH_ID_LENGTH = 36;
const MAX_ISO_INSTANT_LENGTH = 35;

const CANONICAL_UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const ISO_INSTANT_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?(?:Z|([+-])(\d{2}):(\d{2}))$/;
const TOPIC_ORDER: readonly FollowTopic[] = [
  FollowTopic.Surf,
  FollowTopic.WaterTemp,
  FollowTopic.Tide,
  FollowTopic.WaterQuality,
  FollowTopic.Wind,
  FollowTopic.General,
];
const FOLLOW_TOPICS = new Set<string>(TOPIC_ORDER);

interface FollowInput {
  beachId: string;
  topics: readonly FollowTopic[];
}

export function createLocalFollowState(): LocalFollowState {
  return {
    version: LOCAL_FOLLOW_STATE_VERSION,
    follows: [],
    tombstones: [],
    topicTombstones: [],
    bfrHoldoutAssignment: null,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function normalizeBoundedIsoInstant(value: unknown): string | null {
  if (
    typeof value !== "string" ||
    value.length > MAX_ISO_INSTANT_LENGTH ||
    !ISO_INSTANT_PATTERN.test(value)
  ) {
    return null;
  }

  const match = ISO_INSTANT_PATTERN.exec(value);
  if (!match) return null;
  const [, year, month, day, hour, minute, second] = match
    .slice(0, 7)
    .map(Number);
  const offsetHour = match[8] === undefined ? null : Number(match[8]);
  const offsetMinute = match[9] === undefined ? null : Number(match[9]);
  if (
    offsetHour !== null
    && offsetMinute !== null
    && (
      offsetHour > 14
      || offsetMinute > 59
      || (offsetHour === 14 && offsetMinute !== 0)
    )
  ) {
    return null;
  }
  const calendar = new Date(0);
  calendar.setUTCHours(0, 0, 0, 0);
  calendar.setUTCFullYear(year, month - 1, day);
  calendar.setUTCHours(hour, minute, second, 0);
  if (
    calendar.getUTCFullYear() !== year
    || calendar.getUTCMonth() !== month - 1
    || calendar.getUTCDate() !== day
    || calendar.getUTCHours() !== hour
    || calendar.getUTCMinutes() !== minute
    || calendar.getUTCSeconds() !== second
  ) {
    return null;
  }

  const millis = Date.parse(value);
  return Number.isFinite(millis) ? new Date(millis).toISOString() : null;
}

function normalizeBeachId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  if (value.length !== MAX_BEACH_ID_LENGTH) return null;
  return CANONICAL_UUID_PATTERN.test(value) ? value : null;
}

function normalizeBfrHoldoutAssignment(
  value: unknown
): BfrHoldoutAssignmentRecord | null {
  if (!isRecord(value)) return null;
  const assignedAt = normalizeBoundedIsoInstant(value.assignedAt);
  if (
    value.version !== 1 ||
    value.experimentKey !== "bfr-follow-holdout-v1" ||
    (value.arm !== "holdout" && value.arm !== "treatment") ||
    typeof value.subjectId !== "string" ||
    value.subjectId.length === 0 ||
    value.subjectId.length > 200 ||
    /[\u0000-\u001F\u007F]/.test(value.subjectId) ||
    !assignedAt
  ) {
    return null;
  }

  return {
    subjectId: value.subjectId,
    experimentKey: value.experimentKey,
    arm: value.arm,
    assignedAt,
    version: value.version,
  };
}

export function normalizeFollowTopics(value: unknown): FollowTopic[] {
  if (!Array.isArray(value)) return [];
  const topics = new Set<FollowTopic>();

  for (const topic of value) {
    if (typeof topic === "string" && FOLLOW_TOPICS.has(topic)) {
      topics.add(topic as FollowTopic);
    }
  }

  return TOPIC_ORDER.filter((topic) => topics.has(topic));
}

function normalizeFollow(value: unknown): FollowedBeach | null {
  if (!isRecord(value)) return null;
  const beachId = normalizeBeachId(value.beachId);
  const topics = normalizeFollowTopics(value.topics);
  const createdAt = normalizeBoundedIsoInstant(value.createdAt);
  const updatedAt = normalizeBoundedIsoInstant(value.updatedAt);
  if (!beachId || topics.length === 0) return null;
  if (!createdAt || !updatedAt) return null;

  return {
    beachId,
    topics,
    createdAt,
    updatedAt,
  };
}

function normalizeTombstone(value: unknown): FollowTombstone | null {
  if (!isRecord(value)) return null;
  const beachId = normalizeBeachId(value.beachId);
  const removedAt = normalizeBoundedIsoInstant(value.removedAt);
  if (!beachId || !removedAt) return null;
  return { beachId, removedAt };
}

function normalizeTopicTombstone(
  value: unknown
): FollowTopicTombstone | null {
  if (!isRecord(value)) return null;
  const beachId = normalizeBeachId(value.beachId);
  const topics = normalizeFollowTopics([value.topic]);
  const removedAt = normalizeBoundedIsoInstant(value.removedAt);
  if (!beachId || topics.length !== 1 || !removedAt) return null;
  return { beachId, topic: topics[0], removedAt };
}

function earlierDate(left: string, right: string): string {
  return Date.parse(left) <= Date.parse(right) ? left : right;
}

function laterDate(left: string, right: string): string {
  return Date.parse(left) >= Date.parse(right) ? left : right;
}

export function dedupeFollowedBeaches(values: readonly unknown[]): FollowedBeach[] {
  const byBeachId = new Map<string, FollowedBeach>();

  for (const value of values) {
    const follow = normalizeFollow(value);
    if (!follow) continue;
    const existing = byBeachId.get(follow.beachId);
    if (!existing) {
      byBeachId.set(follow.beachId, follow);
      continue;
    }

    byBeachId.set(follow.beachId, {
      beachId: follow.beachId,
      topics: normalizeFollowTopics([...existing.topics, ...follow.topics]),
      createdAt: earlierDate(existing.createdAt, follow.createdAt),
      updatedAt: laterDate(existing.updatedAt, follow.updatedAt),
    });
  }

  return [...byBeachId.values()];
}

function dedupeTombstones(values: readonly unknown[]): FollowTombstone[] {
  const byBeachId = new Map<string, FollowTombstone>();

  for (const value of values) {
    const tombstone = normalizeTombstone(value);
    if (!tombstone) continue;
    const existing = byBeachId.get(tombstone.beachId);
    if (!existing || Date.parse(tombstone.removedAt) > Date.parse(existing.removedAt)) {
      byBeachId.set(tombstone.beachId, tombstone);
    }
  }

  return [...byBeachId.values()].sort(
    (left, right) =>
      Date.parse(left.removedAt) - Date.parse(right.removedAt) ||
      left.beachId.localeCompare(right.beachId)
  );
}

function dedupeTopicTombstones(
  values: readonly unknown[]
): FollowTopicTombstone[] {
  const byTopic = new Map<string, FollowTopicTombstone>();

  for (const value of values) {
    const tombstone = normalizeTopicTombstone(value);
    if (!tombstone) continue;
    const key = `${tombstone.beachId}:${tombstone.topic}`;
    const existing = byTopic.get(key);
    if (!existing || Date.parse(tombstone.removedAt) > Date.parse(existing.removedAt)) {
      byTopic.set(key, tombstone);
    }
  }

  return [...byTopic.values()].sort(
    (left, right) =>
      Date.parse(left.removedAt) - Date.parse(right.removedAt)
      || left.beachId.localeCompare(right.beachId)
      || TOPIC_ORDER.indexOf(left.topic) - TOPIC_ORDER.indexOf(right.topic)
  );
}

function parseState(value: unknown): unknown {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

export function normalizeLocalFollowState(
  value: unknown
): LocalFollowNormalizationResult {
  const parsed = parseState(value);
  if (!isRecord(parsed)) {
    return applied(createLocalFollowState());
  }

  let source: Record<string, unknown>;
  switch (parsed.version) {
    case 0:
      source = {
        ...parsed,
        tombstones: [],
        topicTombstones: [],
        bfrHoldoutAssignment: null,
      };
      break;
    case 1:
      source = { ...parsed, topicTombstones: [] };
      break;
    case LOCAL_FOLLOW_STATE_VERSION:
      source = parsed;
      break;
    default:
      if (
        typeof parsed.version === "number"
        && Number.isInteger(parsed.version)
        && parsed.version > LOCAL_FOLLOW_STATE_VERSION
      ) {
        return { status: "unsupported_version", opaqueEnvelope: value };
      }
      return applied(createLocalFollowState());
  }

  const dedupedTombstones = Array.isArray(source.tombstones)
    ? dedupeTombstones(source.tombstones)
    : [];
  const dedupedTopicTombstones = Array.isArray(source.topicTombstones)
    ? dedupeTopicTombstones(source.topicTombstones)
    : [];
  const tombstoneByBeachId = new Map(
    dedupedTombstones.map((tombstone) => [tombstone.beachId, tombstone])
  );
  const topicTombstoneByKey = new Map(
    dedupedTopicTombstones.map((tombstone) => [
      `${tombstone.beachId}:${tombstone.topic}`,
      tombstone,
    ])
  );
  const follows = dedupeFollowedBeaches(
    Array.isArray(source.follows) ? source.follows : []
  )
    .map((follow) => ({
      ...follow,
      topics: follow.topics.filter((topic) => {
        const tombstone = topicTombstoneByKey.get(
          `${follow.beachId}:${topic}`
        );
        return !tombstone
          || Date.parse(follow.updatedAt) > Date.parse(tombstone.removedAt);
      }),
    }))
    .filter((follow) => follow.topics.length > 0)
    .filter((follow) => {
      const tombstone = tombstoneByBeachId.get(follow.beachId);
      return !tombstone
        || Date.parse(follow.updatedAt) > Date.parse(tombstone.removedAt);
    })
    .sort(
      (left, right) =>
        Date.parse(left.updatedAt) - Date.parse(right.updatedAt) ||
        left.beachId.localeCompare(right.beachId)
    );
  const retainedFollowBeachIds = new Set(
    follows.map((follow) => follow.beachId)
  );
  const tombstones = dedupedTombstones.filter(
    (tombstone) => !retainedFollowBeachIds.has(tombstone.beachId)
  );
  const retainedTombstoneBeachIds = new Set(
    tombstones.map((tombstone) => tombstone.beachId)
  );
  const followByBeachId = new Map(
    follows.map((follow) => [follow.beachId, follow])
  );
  const topicTombstones = dedupedTopicTombstones.filter((tombstone) => {
    if (retainedTombstoneBeachIds.has(tombstone.beachId)) return false;
    const follow = followByBeachId.get(tombstone.beachId);
    return !follow
      || !follow.topics.includes(tombstone.topic)
      || Date.parse(tombstone.removedAt) >= Date.parse(follow.updatedAt);
  });

  const state: LocalFollowState = {
    version: LOCAL_FOLLOW_STATE_VERSION,
    follows,
    tombstones,
    topicTombstones,
    bfrHoldoutAssignment: normalizeBfrHoldoutAssignment(
      source.bfrHoldoutAssignment
    ),
  };

  if (
    state.follows.length > MAX_FOLLOWED_BEACHES
    || pendingOperationCount(state) > MAX_PENDING_FOLLOW_OPERATIONS
  ) {
    return syncRequired(state);
  }
  return applied(state);
}

function applied(state: LocalFollowState): LocalFollowMutationResult {
  return { status: "applied", state };
}

function syncRequired(state: LocalFollowState): LocalFollowMutationResult {
  return { status: "sync_required", state };
}

function pendingOperationCount(state: LocalFollowState): number {
  return (
    state.follows.length
    + state.tombstones.length
    + state.topicTombstones.length
  );
}

export function addFollow(
  state: unknown,
  input: FollowInput,
  now: string
): LocalFollowMutationResult {
  const normalization = normalizeLocalFollowState(state);
  if (normalization.status !== "applied") return normalization;
  const normalized = normalization.state;
  const beachId = normalizeBeachId(input.beachId);
  const topics = normalizeFollowTopics(input.topics);
  const normalizedNow = normalizeBoundedIsoInstant(now);
  if (!beachId || topics.length === 0 || !normalizedNow) {
    return applied(normalized);
  }

  const existing = normalized.follows.find((follow) => follow.beachId === beachId);
  const existingTombstone = normalized.tombstones.some(
    (item) => item.beachId === beachId
  );
  if (!existing && normalized.follows.length >= MAX_FOLLOWED_BEACHES) {
    return syncRequired(normalized);
  }
  if (
    !existing &&
    !existingTombstone &&
    pendingOperationCount(normalized) >= MAX_PENDING_FOLLOW_OPERATIONS
  ) {
    return syncRequired(normalized);
  }
  const nextFollow: FollowedBeach = existing
    ? {
        ...existing,
        topics: normalizeFollowTopics([...existing.topics, ...topics]),
        updatedAt: normalizedNow,
      }
    : {
        beachId,
        topics,
        createdAt: normalizedNow,
        updatedAt: normalizedNow,
      };

  return normalizeLocalFollowState({
    ...normalized,
    follows: [
      ...normalized.follows.filter((follow) => follow.beachId !== beachId),
      nextFollow,
    ],
    tombstones: normalized.tombstones.filter(
      (item) => item.beachId !== beachId
    ),
    topicTombstones: normalized.topicTombstones.filter((item) => (
      item.beachId !== beachId
      || !nextFollow.topics.includes(item.topic)
      || Date.parse(item.removedAt) >= Date.parse(normalizedNow)
    )),
  });
}

export function updateFollowTopics(
  state: unknown,
  beachIdInput: string,
  topicsInput: readonly FollowTopic[],
  now: string
): LocalFollowMutationResult {
  const normalization = normalizeLocalFollowState(state);
  if (normalization.status !== "applied") return normalization;
  const normalized = normalization.state;
  const beachId = normalizeBeachId(beachIdInput);
  const topics = normalizeFollowTopics(topicsInput);
  const normalizedNow = normalizeBoundedIsoInstant(now);
  if (!beachId || topics.length === 0 || !normalizedNow) {
    return applied(normalized);
  }
  const existing = normalized.follows.find(
    (follow) => follow.beachId === beachId
  );
  if (!existing) {
    return applied(normalized);
  }

  const removedTopics = existing.topics.filter(
    (topic) => !topics.includes(topic)
  );
  const nextTopicTombstones = [
    ...normalized.topicTombstones.filter((item) => (
      item.beachId !== beachId
      || (
        !topics.includes(item.topic)
        && !removedTopics.includes(item.topic)
      )
      || Date.parse(item.removedAt) >= Date.parse(normalizedNow)
    )),
    ...removedTopics.map((topic) => {
      const existingTombstone = normalized.topicTombstones.find((item) => (
        item.beachId === beachId && item.topic === topic
      ));
      return {
        beachId,
        topic,
        removedAt: existingTombstone
          ? laterDate(existingTombstone.removedAt, normalizedNow)
          : normalizedNow,
      };
    }),
  ];

  return normalizeLocalFollowState({
    ...normalized,
    follows: normalized.follows.map((follow) =>
      follow.beachId === beachId
        ? { ...follow, topics, updatedAt: normalizedNow }
        : follow
    ),
    topicTombstones: nextTopicTombstones,
  });
}

export function removeFollow(
  state: unknown,
  beachIdInput: string,
  now: string
): LocalFollowMutationResult {
  const normalization = normalizeLocalFollowState(state);
  if (normalization.status !== "applied") return normalization;
  const normalized = normalization.state;
  const beachId = normalizeBeachId(beachIdInput);
  const normalizedNow = normalizeBoundedIsoInstant(now);
  if (!beachId || !normalizedNow) return applied(normalized);

  const existingTombstone = normalized.tombstones.find(
    (item) => item.beachId === beachId
  );
  const removedAt = existingTombstone
    ? laterDate(existingTombstone.removedAt, normalizedNow)
    : normalizedNow;
  if (
    existingTombstone?.removedAt === removedAt &&
    !normalized.follows.some((follow) => follow.beachId === beachId)
  ) {
    return applied(normalized);
  }

  const hasFollow = normalized.follows.some(
    (follow) => follow.beachId === beachId
  );
  if (
    !hasFollow &&
    !existingTombstone &&
    pendingOperationCount(normalized) >= MAX_PENDING_FOLLOW_OPERATIONS
  ) {
    return syncRequired(normalized);
  }

  return normalizeLocalFollowState({
    ...normalized,
    follows: normalized.follows.filter(
      (follow) => follow.beachId !== beachId
    ),
    tombstones: [
      ...normalized.tombstones.filter((item) => item.beachId !== beachId),
      { beachId, removedAt },
    ],
    topicTombstones: normalized.topicTombstones.filter(
      (item) => item.beachId !== beachId
    ),
  });
}
