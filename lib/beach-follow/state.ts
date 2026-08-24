import {
  FollowTopic,
  type FollowedBeach,
  type FollowTombstone,
  type LocalFollowState,
} from "@/types/beach-follow";

export const LOCAL_FOLLOW_STATE_VERSION = 1 as const;
export const MAX_FOLLOWED_BEACHES = 50;

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
  return { version: LOCAL_FOLLOW_STATE_VERSION, follows: [], tombstones: [] };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isValidDate(value: unknown): value is string {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

function normalizeBeachId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const beachId = value.trim();
  return beachId.length > 0 ? beachId : null;
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
  if (!beachId || topics.length === 0) return null;
  if (!isValidDate(value.createdAt) || !isValidDate(value.updatedAt)) return null;

  return {
    beachId,
    topics,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  };
}

function normalizeTombstone(value: unknown): FollowTombstone | null {
  if (!isRecord(value)) return null;
  const beachId = normalizeBeachId(value.beachId);
  if (!beachId || !isValidDate(value.removedAt)) return null;
  return { beachId, removedAt: value.removedAt };
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

  return [...byBeachId.values()]
    .sort((left, right) => left.removedAt.localeCompare(right.removedAt))
    .slice(-MAX_FOLLOWED_BEACHES);
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
  if (!isRecord(parsed) || !Array.isArray(parsed.follows)) {
    return createLocalFollowState();
  }

  const tombstones = Array.isArray(parsed.tombstones)
    ? dedupeTombstones(parsed.tombstones)
    : [];
  const removedBeachIds = new Set(tombstones.map((item) => item.beachId));
  const follows = dedupeFollowedBeaches(parsed.follows)
    .filter((follow) => !removedBeachIds.has(follow.beachId))
    .sort((left, right) => left.updatedAt.localeCompare(right.updatedAt))
    .slice(-MAX_FOLLOWED_BEACHES);

  return {
    version: LOCAL_FOLLOW_STATE_VERSION,
    follows,
    tombstones,
  };
}

export function addFollow(
  state: unknown,
  input: FollowInput,
  now: string
): LocalFollowState {
  const normalized = normalizeLocalFollowState(state);
  const beachId = normalizeBeachId(input.beachId);
  const topics = normalizeFollowTopics(input.topics);
  if (!beachId || topics.length === 0 || !isValidDate(now)) return normalized;

  const existing = normalized.follows.find((follow) => follow.beachId === beachId);
  const nextFollow: FollowedBeach = existing
    ? {
        ...existing,
        topics: normalizeFollowTopics([...existing.topics, ...topics]),
        updatedAt: now,
      }
    : { beachId, topics, createdAt: now, updatedAt: now };

  return normalizeLocalFollowState({
    ...normalized,
    follows: [
      ...normalized.follows.filter((follow) => follow.beachId !== beachId),
      nextFollow,
    ],
    tombstones: normalized.tombstones.filter((item) => item.beachId !== beachId),
  });
}

export function updateFollowTopics(
  state: unknown,
  beachIdInput: string,
  topicsInput: readonly FollowTopic[],
  now: string
): LocalFollowState {
  const normalized = normalizeLocalFollowState(state);
  const beachId = normalizeBeachId(beachIdInput);
  const topics = normalizeFollowTopics(topicsInput);
  if (!beachId || topics.length === 0 || !isValidDate(now)) return normalized;
  if (!normalized.follows.some((follow) => follow.beachId === beachId)) {
    return normalized;
  }

  return normalizeLocalFollowState({
    ...normalized,
    follows: normalized.follows.map((follow) =>
      follow.beachId === beachId ? { ...follow, topics, updatedAt: now } : follow
    ),
  });
}

export function removeFollow(
  state: unknown,
  beachIdInput: string,
  now: string
): LocalFollowState {
  const normalized = normalizeLocalFollowState(state);
  const beachId = normalizeBeachId(beachIdInput);
  if (!beachId || !isValidDate(now)) return normalized;

  const existingTombstone = normalized.tombstones.find(
    (item) => item.beachId === beachId
  );
  if (
    existingTombstone?.removedAt === now &&
    !normalized.follows.some((follow) => follow.beachId === beachId)
  ) {
    return normalized;
  }

  return normalizeLocalFollowState({
    ...normalized,
    follows: normalized.follows.filter((follow) => follow.beachId !== beachId),
    tombstones: [
      ...normalized.tombstones.filter((item) => item.beachId !== beachId),
      { beachId, removedAt: now },
    ],
  });
}
