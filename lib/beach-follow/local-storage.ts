import {
  addFollow,
  createLocalFollowState,
  normalizeLocalFollowState,
  removeFollow,
  updateFollowTopics,
} from "@/lib/beach-follow/state";
import { bfrHoldoutAssignment } from "@/lib/experiments/bfr-holdout";
import {
  type BfrHoldoutAssignmentRecord,
  type FollowTopic,
  type LocalFollowMutationResult,
  type LocalFollowState,
} from "@/types/beach-follow";

export const LOCAL_BEACH_FOLLOW_STORAGE_KEY = "quiver_beach_follow_state";

export type LocalBeachFollowStorageStatus =
  | "ready"
  | "unavailable"
  | "sync_required";

export interface LocalBeachFollowSnapshot {
  state: LocalFollowState;
  status: LocalBeachFollowStorageStatus;
  persisted: boolean;
}

type FollowMutation = (state: LocalFollowState) => LocalFollowMutationResult;

function browserStorage(): Storage | null {
  if (typeof window === "undefined") return null;

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function resolveStorage(storage?: Storage | null): Storage | null {
  return storage === undefined ? browserStorage() : storage;
}

function persistState(
  state: LocalFollowState,
  storage?: Storage | null,
): boolean {
  const target = resolveStorage(storage);
  if (!target) return false;

  try {
    target.setItem(LOCAL_BEACH_FOLLOW_STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export function readLocalBeachFollowState(
  storage?: Storage | null,
): LocalBeachFollowSnapshot {
  const target = resolveStorage(storage);
  if (!target) {
    return {
      state: createLocalFollowState(),
      status: "unavailable",
      persisted: false,
    };
  }

  let rawState: string | null;
  try {
    rawState = target.getItem(LOCAL_BEACH_FOLLOW_STORAGE_KEY);
  } catch {
    return {
      state: createLocalFollowState(),
      status: "unavailable",
      persisted: false,
    };
  }

  const normalized = normalizeLocalFollowState(rawState);
  if (normalized.status === "unsupported_version") {
    return {
      state: createLocalFollowState(),
      status: "sync_required",
      persisted: false,
    };
  }

  return {
    state: normalized.state,
    status: normalized.status === "sync_required" ? "sync_required" : "ready",
    persisted: true,
  };
}

function applyMutation(
  snapshot: LocalBeachFollowSnapshot,
  mutation: FollowMutation,
  storage?: Storage | null,
): LocalBeachFollowSnapshot {
  if (snapshot.status === "sync_required") return snapshot;

  const result = mutation(snapshot.state);
  if (result.status === "unsupported_version") {
    return { ...snapshot, status: "sync_required", persisted: false };
  }
  if (result.status === "sync_required") {
    return { state: result.state, status: "sync_required", persisted: false };
  }

  const persisted = persistState(result.state, storage);
  return {
    state: result.state,
    status: persisted ? "ready" : "unavailable",
    persisted,
  };
}

export function addLocalBeachFollow(
  snapshot: LocalBeachFollowSnapshot,
  beachId: string,
  topics: readonly FollowTopic[],
  now: string,
  storage?: Storage | null,
): LocalBeachFollowSnapshot {
  return applyMutation(
    snapshot,
    (state) => addFollow(state, { beachId, topics }, now),
    storage,
  );
}

export function updateLocalBeachFollowTopics(
  snapshot: LocalBeachFollowSnapshot,
  beachId: string,
  topics: readonly FollowTopic[],
  now: string,
  storage?: Storage | null,
): LocalBeachFollowSnapshot {
  return applyMutation(
    snapshot,
    (state) => updateFollowTopics(state, beachId, topics, now),
    storage,
  );
}

export function removeLocalBeachFollow(
  snapshot: LocalBeachFollowSnapshot,
  beachId: string,
  now: string,
  storage?: Storage | null,
): LocalBeachFollowSnapshot {
  return applyMutation(
    snapshot,
    (state) => removeFollow(state, beachId, now),
    storage,
  );
}

export interface LocalBfrAssignmentResult extends LocalBeachFollowSnapshot {
  assignment: BfrHoldoutAssignmentRecord;
}

export function ensureLocalBfrAssignment(
  snapshot: LocalBeachFollowSnapshot,
  subjectId: string,
  now: string,
  storage?: Storage | null,
): LocalBfrAssignmentResult {
  const existing = snapshot.state.bfrHoldoutAssignment;
  if (existing) return { ...snapshot, assignment: existing };

  const assignment = bfrHoldoutAssignment(subjectId, now);
  const state = { ...snapshot.state, bfrHoldoutAssignment: assignment };
  if (snapshot.status === "sync_required") {
    return { ...snapshot, state, assignment };
  }

  const persisted = persistState(state, storage);
  return {
    state,
    assignment,
    status: persisted ? snapshot.status : "unavailable",
    persisted,
  };
}
