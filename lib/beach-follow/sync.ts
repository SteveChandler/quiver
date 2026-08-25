import {
  persistLocalBeachFollowState,
  type LocalBeachFollowSnapshot,
} from "@/lib/beach-follow/local-storage";
import {
  acknowledgeBeachFollowMerge,
  mergeBeachFollows,
} from "@/lib/beach-follow/merge";
import type { FollowedBeach, LocalFollowState } from "@/types/beach-follow";

export interface BeachFollowSyncPersistence {
  readServerRows(): Promise<FollowedBeach[]>;
  applyMerge(input: {
    revision: string;
    rowsToInsert: FollowedBeach[];
    rowsToDelete: string[];
  }): Promise<void>;
  invalidateOwnership(): Promise<void> | void;
}

export type BeachFollowSyncResult =
  | { status: "no_local_changes"; snapshot: LocalBeachFollowSnapshot }
  | { status: "unsupported_version"; snapshot: LocalBeachFollowSnapshot }
  | { status: "completed"; snapshot: LocalBeachFollowSnapshot }
  | { status: "pending_confirmation"; snapshot: LocalBeachFollowSnapshot };

type LocalStateWriter = (
  snapshot: LocalBeachFollowSnapshot,
) => LocalBeachFollowSnapshot;

export function beachFollowStateRevision(state: LocalFollowState): string {
  return JSON.stringify(state);
}

function hasLocalChanges(state: LocalFollowState): boolean {
  return (
    state.follows.length > 0
    || state.tombstones.length > 0
    || state.topicTombstones.length > 0
  );
}

export async function syncBeachFollows(
  snapshot: LocalBeachFollowSnapshot,
  persistence: BeachFollowSyncPersistence,
  writeLocalState: LocalStateWriter = (next) => persistLocalBeachFollowState(
    next.state,
    next.status === "sync_required" ? "sync_required" : "ready",
  ),
): Promise<BeachFollowSyncResult> {
  if (!hasLocalChanges(snapshot.state)) {
    return { status: "no_local_changes", snapshot };
  }

  const serverRows = await persistence.readServerRows();
  const merge = mergeBeachFollows({ anonState: snapshot.state, serverRows });
  if (merge.status === "unsupported_version") {
    return { status: "unsupported_version", snapshot };
  }
  if (
    merge.status === "sync_required"
    && merge.rowsToInsert.length === 0
    && merge.rowsToDelete.length === 0
  ) {
    return { status: "pending_confirmation", snapshot };
  }

  const wroteServerState = (
    merge.rowsToInsert.length > 0 || merge.rowsToDelete.length > 0
  );
  if (wroteServerState) {
    await persistence.applyMerge({
      revision: beachFollowStateRevision(snapshot.state),
      rowsToInsert: merge.rowsToInsert,
      rowsToDelete: merge.rowsToDelete,
    });
    await persistence.invalidateOwnership();
  }

  const postWriteServerRows = wroteServerState
    ? await persistence.readServerRows()
    : serverRows;
  // Confirmation must evaluate the original pending operations, not the merge plan.
  const acknowledgement = acknowledgeBeachFollowMerge({
    residualLocalState: snapshot.state,
    postWriteServerRows,
  });
  if (acknowledgement.status === "unsupported_version") {
    return { status: "unsupported_version", snapshot };
  }

  const nextSnapshot = writeLocalState({
    state: acknowledgement.state,
    status: acknowledgement.status === "sync_required"
      ? "sync_required"
      : "ready",
    persisted: false,
  });

  return {
    status: acknowledgement.status === "applied"
      ? "completed"
      : "pending_confirmation",
    snapshot: nextSnapshot,
  };
}
