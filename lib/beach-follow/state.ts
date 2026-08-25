import {
  type BfrHoldoutAssignmentRecord,
  FollowTopic,
  type FollowedBeach,
  type FollowTombstone,
  type LocalFollowMutationResult,
  type LocalFollowState,
} from "@/types/beach-follow";

export const LOCAL_FOLLOW_STATE_VERSION = 1 as const;
export const MAX_FOLLOWED_BEACHES = 50;
export const MAX_PENDING_FOLLOW_OPERATIONS = 100;
export const MAX_BEACH_ID_LENGTH = 36;
const MAX_ISO_INSTANT_LENGTH = 35;

const CANONICAL_UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const ISO_INSTANT_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/;
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
    bfrHoldoutAssignment: null,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeInstant(value: unknown): string | null {
  if (
    typeof value !== "string" ||
    value.length > MAX_ISO_INSTANT_LENGTH ||
    !ISO_INSTANT_PATTERN.test(value)
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
  const assignedAt = normalizeInstant(value.assignedAt);
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
  const createdAt = normalizeInstant(value.createdAt);
  const updatedAt = normalizeInstant(value.updatedAt);
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
  const removedAt = normalizeInstant(value.removedAt);
  if (!beachId || !removedAt) return null;
  return { beachId, removedAt };
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

function parseState(value: unknown): unknown {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

export function normalizeLocalFollowState(value: unknown): LocalFollowState {
  const parsed = parseState(value);
  if (!isRecord(parsed)) {
    return createLocalFollowState();
  }

  let source: Record<string, unknown>;
  switch (parsed.version) {
    case 0:
      source = { ...parsed, tombstones: [], bfrHoldoutAssignment: null };
      break;
    case LOCAL_FOLLOW_STATE_VERSION:
      source = parsed;
      break;
    default:
      return createLocalFollowState();
  }

  if (!Array.isArray(source.follows)) return createLocalFollowState();

  const tombstones = Array.isArray(source.tombstones)
    ? dedupeTombstones(source.tombstones)
    : [];
  const removedBeachIds = new Set(tombstones.map((item) => item.beachId));
  const follows = dedupeFollowedBeaches(source.follows)
    .filter((follow) => !removedBeachIds.has(follow.beachId))
    .sort(
      (left, right) =>
        Date.parse(left.updatedAt) - Date.parse(right.updatedAt) ||
        left.beachId.localeCompare(right.beachId)
    )
    .slice(-MAX_FOLLOWED_BEACHES);

  return {
    version: LOCAL_FOLLOW_STATE_VERSION,
    follows,
    tombstones,
    bfrHoldoutAssignment: normalizeBfrHoldoutAssignment(
      source.bfrHoldoutAssignment
    ),
  };
}

function applied(state: LocalFollowState): LocalFollowMutationResult {
  return { status: "applied", state };
}

function syncRequired(state: LocalFollowState): LocalFollowMutationResult {
  return { status: "sync_required", state };
}

function pendingOperationCount(state: LocalFollowState): number {
  return state.follows.length + state.tombstones.length;
}

export function addFollow(
  state: unknown,
  input: FollowInput,
  now: string
): LocalFollowMutationResult {
  const normalized = normalizeLocalFollowState(state);
  const beachId = normalizeBeachId(input.beachId);
  const topics = normalizeFollowTopics(input.topics);
  const normalizedNow = normalizeInstant(now);
  if (!beachId || topics.length === 0 || !normalizedNow) {
    return applied(normalized);
  }

  const existing = normalized.follows.find((follow) => follow.beachId === beachId);
  const existingTombstone = normalized.tombstones.some(
    (item) => item.beachId === beachId
  );
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

  return applied(
    normalizeLocalFollowState({
      ...normalized,
      follows: [
        ...normalized.follows.filter((follow) => follow.beachId !== beachId),
        nextFollow,
      ],
      tombstones: normalized.tombstones.filter(
        (item) => item.beachId !== beachId
      ),
    })
  );
}

export function updateFollowTopics(
  state: unknown,
  beachIdInput: string,
  topicsInput: readonly FollowTopic[],
  now: string
): LocalFollowMutationResult {
  const normalized = normalizeLocalFollowState(state);
  const beachId = normalizeBeachId(beachIdInput);
  const topics = normalizeFollowTopics(topicsInput);
  const normalizedNow = normalizeInstant(now);
  if (!beachId || topics.length === 0 || !normalizedNow) {
    return applied(normalized);
  }
  if (!normalized.follows.some((follow) => follow.beachId === beachId)) {
    return applied(normalized);
  }

  return applied(
    normalizeLocalFollowState({
      ...normalized,
      follows: normalized.follows.map((follow) =>
        follow.beachId === beachId
          ? { ...follow, topics, updatedAt: normalizedNow }
          : follow
      ),
    })
  );
}

export function removeFollow(
  state: unknown,
  beachIdInput: string,
  now: string
): LocalFollowMutationResult {
  const normalized = normalizeLocalFollowState(state);
  const beachId = normalizeBeachId(beachIdInput);
  const normalizedNow = normalizeInstant(now);
  if (!beachId || !normalizedNow) return applied(normalized);

  const existingTombstone = normalized.tombstones.find(
    (item) => item.beachId === beachId
  );
  if (
    existingTombstone?.removedAt === normalizedNow &&
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

  return applied(
    normalizeLocalFollowState({
      ...normalized,
      follows: normalized.follows.filter(
        (follow) => follow.beachId !== beachId
      ),
      tombstones: [
        ...normalized.tombstones.filter((item) => item.beachId !== beachId),
        { beachId, removedAt: normalizedNow },
      ],
    })
  );
}
