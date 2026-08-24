export enum FollowTopic {
  Surf = "surf",
  WaterTemp = "water_temp",
  Tide = "tide",
  WaterQuality = "water_quality",
  Wind = "wind",
  General = "general",
}

export interface FollowedBeach {
  beachId: string;
  topics: FollowTopic[];
  createdAt: string;
  updatedAt: string;
}

export interface FollowTombstone {
  beachId: string;
  removedAt: string;
}

export interface LocalFollowStateV1 {
  version: 1;
  follows: FollowedBeach[];
  tombstones: FollowTombstone[];
}

export type LocalFollowState = LocalFollowStateV1;

export interface MergeInput {
  anonState: unknown;
  serverRows: readonly FollowedBeach[];
}

export interface MergeResult {
  /** Rows that callers should upsert; existing rows may carry newly unioned topics. */
  rowsToInsert: FollowedBeach[];
  rowsToDelete: string[];
  mergedState: LocalFollowState;
  clearedTombstones: string[];
}
