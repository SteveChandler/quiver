import {
  addFollow,
  createLocalFollowState,
  MAX_FOLLOWED_BEACHES,
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
import {
  type ExplicitBeachIntent,
  type IntentSignals,
} from "@/lib/beach-follow/intent";

export const LOCAL_BEACH_FOLLOW_STORAGE_KEY = "quiver_beach_follow_state";
export const LOCAL_BEACH_INTENT_STORAGE_KEY = "quiver_beach_intent_evidence";
export const LOCAL_MY_COAST_VIEW_STORAGE_KEY = "quiver_my_coast_views";

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

export function persistLocalBeachFollowState(
  state: LocalFollowState,
  status: "ready" | "sync_required",
  storage?: Storage | null,
): LocalBeachFollowSnapshot {
  const persisted = persistState(state, storage);
  return {
    state,
    status: persisted ? status : "unavailable",
    persisted,
  };
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

export interface LocalBeachIntentEvidence {
  explicitChoice: ExplicitBeachIntent | null;
  signals: IntentSignals;
}

export interface MyCoastViewRecord {
  recordedAt: string;
  forecastUpdatedAt: string | null;
  waterTempF: number | null;
  tideStatus: string | null;
  windSpeedMph: number | null;
  windDirection: string | null;
  waveHeightFt: number | null;
  waterQualityStatus: string | null;
}

export type MyCoastViewRecords = Record<string, MyCoastViewRecord>;

const EMPTY_INTENT_EVIDENCE: LocalBeachIntentEvidence = {
  explicitChoice: null,
  signals: {
    utilityPageViewCount: 0,
    surfSpecificSignalCount: 0,
  },
};

const EXPLICIT_INTENTS = new Set<ExplicitBeachIntent>([
  "surfing",
  "swimming",
  "beach_days",
  "fishing",
  "diving_paddling",
  "other",
]);

function readJsonStorage(key: string, storage?: Storage | null): unknown {
  const target = resolveStorage(storage);
  if (!target) return null;

  try {
    const raw = target.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeJsonStorage(
  key: string,
  value: unknown,
  storage?: Storage | null,
): boolean {
  const target = resolveStorage(storage);
  if (!target) return false;

  try {
    target.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function readLocalBeachIntentEvidence(
  storage?: Storage | null,
): LocalBeachIntentEvidence {
  const value = readJsonStorage(LOCAL_BEACH_INTENT_STORAGE_KEY, storage);
  if (!value || typeof value !== "object") return EMPTY_INTENT_EVIDENCE;

  const record = value as Record<string, unknown>;
  const explicitChoice = EXPLICIT_INTENTS.has(
    record.explicitChoice as ExplicitBeachIntent,
  )
    ? (record.explicitChoice as ExplicitBeachIntent)
    : null;
  const signals = record.signals && typeof record.signals === "object"
    ? record.signals as Record<string, unknown>
    : {};

  return {
    explicitChoice,
    signals: {
      utilityPageViewCount:
        typeof signals.utilityPageViewCount === "number"
          ? signals.utilityPageViewCount
          : 0,
      surfSpecificSignalCount:
        typeof signals.surfSpecificSignalCount === "number"
          ? signals.surfSpecificSignalCount
          : 0,
      spotComparison: signals.spotComparison === true,
      detailedSwellWindTideOpen: signals.detailedSwellWindTideOpen === true,
      surfAlertSaved: signals.surfAlertSaved === true,
      exactSurfWindowHandoff: signals.exactSurfWindowHandoff === true,
    },
  };
}

export function persistLocalBeachIntentChoice(
  explicitChoice: ExplicitBeachIntent,
  storage?: Storage | null,
): boolean {
  const current = readLocalBeachIntentEvidence(storage);
  return writeJsonStorage(
    LOCAL_BEACH_INTENT_STORAGE_KEY,
    { ...current, explicitChoice },
    storage,
  );
}

export function readMyCoastViewRecords(
  storage?: Storage | null,
): MyCoastViewRecords {
  const value = readJsonStorage(LOCAL_MY_COAST_VIEW_STORAGE_KEY, storage);
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .slice(-MAX_FOLLOWED_BEACHES)
      .flatMap(([beachId, valueRecord]): Array<[string, MyCoastViewRecord]> => {
        if (!valueRecord || typeof valueRecord !== "object") return [];
        const record = valueRecord as Record<string, unknown>;
        if (
          typeof record.recordedAt !== "string"
          || !Number.isFinite(Date.parse(record.recordedAt))
        ) return [];
        const nullableString = (field: string): string | null => (
          typeof record[field] === "string" ? record[field] : null
        );
        const nullableNumber = (field: string): number | null => (
          typeof record[field] === "number" && Number.isFinite(record[field])
            ? record[field]
            : null
        );
        return [[beachId, {
          recordedAt: record.recordedAt,
          forecastUpdatedAt: nullableString("forecastUpdatedAt"),
          waterTempF: nullableNumber("waterTempF"),
          tideStatus: nullableString("tideStatus"),
          windSpeedMph: nullableNumber("windSpeedMph"),
          windDirection: nullableString("windDirection"),
          waveHeightFt: nullableNumber("waveHeightFt"),
          waterQualityStatus: nullableString("waterQualityStatus"),
        }]];
      }),
  );
}

export function persistMyCoastViewRecords(
  records: MyCoastViewRecords,
  storage?: Storage | null,
): boolean {
  return writeJsonStorage(
    LOCAL_MY_COAST_VIEW_STORAGE_KEY,
    Object.fromEntries(
      Object.entries(records).slice(-MAX_FOLLOWED_BEACHES),
    ),
    storage,
  );
}
