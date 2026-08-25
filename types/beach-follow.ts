export enum FollowTopic {
  Surf = "surf",
  WaterTemp = "water_temp",
  Tide = "tide",
  WaterQuality = "water_quality",
  Wind = "wind",
  General = "general",
}

export type FollowTopicAddedAt = Partial<Record<FollowTopic, string>>;

export interface FollowedBeach {
  beachId: string;
  topics: FollowTopic[];
  topicAddedAt: FollowTopicAddedAt;
  createdAt: string;
  updatedAt: string;
}

export interface FollowTombstone {
  beachId: string;
  removedAt: string;
}

export interface FollowTopicTombstone {
  beachId: string;
  topic: FollowTopic;
  removedAt: string;
}

export interface BfrHoldoutAssignmentRecord {
  subjectId: string;
  experimentKey: "bfr-follow-holdout-v1";
  arm: "holdout" | "treatment";
  assignedAt: string;
  version: 1;
}

export interface LocalFollowStateV1 {
  version: 1;
  follows: FollowedBeach[];
  tombstones: FollowTombstone[];
  bfrHoldoutAssignment: BfrHoldoutAssignmentRecord | null;
}

export interface LocalFollowStateV2 {
  version: 2;
  follows: Array<Omit<FollowedBeach, "topicAddedAt">>;
  tombstones: FollowTombstone[];
  topicTombstones: FollowTopicTombstone[];
  bfrHoldoutAssignment: BfrHoldoutAssignmentRecord | null;
}

export interface LocalFollowStateV3 {
  version: 3;
  follows: FollowedBeach[];
  tombstones: FollowTombstone[];
  topicTombstones: FollowTopicTombstone[];
  bfrHoldoutAssignment: BfrHoldoutAssignmentRecord | null;
}

export type LocalFollowState = LocalFollowStateV3;

export interface AccountFollowState {
  scope: "account";
  follows: FollowedBeach[];
}

export type LocalFollowMutationResult =
  | { status: "applied"; state: LocalFollowState }
  | { status: "sync_required"; state: LocalFollowState }
  | { status: "unsupported_version"; opaqueEnvelope: unknown };

/**
 * Normalization preserves over-limit current state for sync and future envelopes
 * opaquely until a compatible migrator is available.
 */
export type LocalFollowNormalizationResult = LocalFollowMutationResult;

export interface MergeInput {
  anonState: unknown;
  serverRows: readonly FollowedBeach[];
}

interface SupportedMergeResult {
  /** sync_required preserves local state; follow-overflow plans may still emit upserts. */
  status: "applied" | "sync_required";
  /** Rows that callers should upsert; existing rows may carry newly unioned topics. */
  rowsToInsert: FollowedBeach[];
  rowsToDelete: string[];
  accountState: AccountFollowState;
  residualLocalState: LocalFollowState;
  clearedTombstones: string[];
}

interface UnsupportedVersionMergeResult {
  status: "unsupported_version";
  rowsToInsert: [];
  rowsToDelete: [];
  accountState: AccountFollowState;
  residualLocalState: unknown;
  clearedTombstones: [];
}

export type MergeResult = SupportedMergeResult | UnsupportedVersionMergeResult;
