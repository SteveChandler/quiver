import { createLocalFollowState } from "@/lib/beach-follow/state";
import {
  beachFollowStateRevision,
  syncBeachFollows,
  type BeachFollowSyncPersistence,
} from "@/lib/beach-follow/sync";
import type { LocalBeachFollowSnapshot } from "@/lib/beach-follow/local-storage";
import { FollowTopic, type FollowedBeach } from "@/types/beach-follow";

const BEACH_ID = "00000000-0000-4000-8000-000000000001";
const ADDED_AT = "2026-08-25T16:00:00.000Z";

function follow(): FollowedBeach {
  return {
    beachId: BEACH_ID,
    topics: [FollowTopic.WaterTemp, FollowTopic.Tide],
    topicAddedAt: {
      [FollowTopic.WaterTemp]: ADDED_AT,
      [FollowTopic.Tide]: ADDED_AT,
    },
    createdAt: ADDED_AT,
    updatedAt: ADDED_AT,
  };
}

function snapshot(): LocalBeachFollowSnapshot {
  return {
    state: { ...createLocalFollowState(), follows: [follow()] },
    status: "ready",
    persisted: true,
  };
}

function persistence(
  postWriteRows: FollowedBeach[] = [follow()],
): jest.Mocked<BeachFollowSyncPersistence> {
  let reads = 0;
  return {
    readServerRows: jest.fn(async () => (reads++ === 0 ? [] : postWriteRows)),
    applyMerge: jest.fn(async (
      _input: Parameters<BeachFollowSyncPersistence["applyMerge"]>[0],
    ) => undefined),
    invalidateOwnership: jest.fn(async () => undefined),
  };
}

describe("syncBeachFollows", () => {
  it("keeps local state until a semantic post-write confirmation arrives", async () => {
    const local = snapshot();
    const writes: LocalBeachFollowSnapshot[] = [];
    const adapter = persistence();

    const result = await syncBeachFollows(local, adapter, (next) => {
      writes.push(next);
      return next;
    });

    expect(adapter.applyMerge).toHaveBeenCalledWith({
      revision: beachFollowStateRevision(local.state),
      rowsToInsert: [follow()],
      rowsToDelete: [],
    });
    expect(writes).toHaveLength(1);
    expect(writes[0].state.follows).toEqual([]);
    expect(result.status).toBe("completed");
    expect(adapter.invalidateOwnership).toHaveBeenCalledTimes(1);
  });

  it("retains an unconfirmed topic set as pending", async () => {
    const incomplete = { ...follow(), topics: [FollowTopic.WaterTemp] };
    const writes: LocalBeachFollowSnapshot[] = [];

    const result = await syncBeachFollows(
      snapshot(),
      persistence([incomplete]),
      (next) => {
        writes.push(next);
        return next;
      },
    );

    expect(result.status).toBe("pending_confirmation");
    expect(writes[0].state.follows).toEqual([follow()]);
  });

  it("does not acknowledge or invalidate after a failed write", async () => {
    const adapter = persistence();
    adapter.applyMerge.mockRejectedValue(new Error("write failed"));
    const writeLocalState = jest.fn();

    await expect(
      syncBeachFollows(snapshot(), adapter, writeLocalState),
    ).rejects.toThrow("write failed");
    expect(writeLocalState).not.toHaveBeenCalled();
    expect(adapter.invalidateOwnership).not.toHaveBeenCalled();
  });

  it("uses the same revision for idempotent retries and concurrent tabs", async () => {
    const local = snapshot();
    const revisions = new Set<string>();
    let durableWrites = 0;
    const adapter = persistence();
    adapter.applyMerge.mockImplementation(async ({ revision }) => {
      if (!revisions.has(revision)) durableWrites += 1;
      revisions.add(revision);
    });

    await Promise.all([
      syncBeachFollows(local, adapter, (next) => next),
      syncBeachFollows(local, adapter, (next) => next),
    ]);

    expect(revisions).toEqual(new Set([beachFollowStateRevision(local.state)]));
    expect(durableWrites).toBe(1);
  });

  it("does no account work when there are no local changes", async () => {
    const adapter = persistence();
    const empty = { ...snapshot(), state: createLocalFollowState() };

    await expect(
      syncBeachFollows(empty, adapter, (next) => next),
    ).resolves.toEqual({ status: "no_local_changes", snapshot: empty });
    expect(adapter.readServerRows).not.toHaveBeenCalled();
    expect(adapter.applyMerge).not.toHaveBeenCalled();
  });
});
