import { render, screen, waitFor } from "@testing-library/react";

import { BeachFollowSyncBoundary } from "@/components/beach-follow/beach-follow-sync-boundary";
import type { BeachFollowSyncPersistence } from "@/lib/beach-follow/sync";
import { FollowTopic, type FollowedBeach } from "@/types/beach-follow";

const BEACH_ID = "00000000-0000-4000-8000-000000000001";
const NOW = "2026-08-25T16:00:00.000Z";
let user: { id: string } | null = null;
const mockTrack = jest.fn();

jest.mock("@/context/auth-context", () => ({
  useAuth: () => ({ user }),
}));

jest.mock("@/hooks/use-track-event", () => ({
  useTrackEvent: () => ({ track: mockTrack }),
}));

const FOLLOW: FollowedBeach = {
  beachId: BEACH_ID,
  topics: [FollowTopic.General],
  topicAddedAt: { [FollowTopic.General]: NOW },
  createdAt: NOW,
  updatedAt: NOW,
};

function persistence(): jest.Mocked<BeachFollowSyncPersistence> {
  let reads = 0;
  return {
    readServerRows: jest.fn(async () => (reads++ === 0 ? [] : [FOLLOW])),
    applyMerge: jest.fn(async (
      _input: Parameters<BeachFollowSyncPersistence["applyMerge"]>[0],
    ) => undefined),
    invalidateOwnership: jest.fn(async () => undefined),
  };
}

describe("BeachFollowSyncBoundary", () => {
  beforeEach(() => {
    user = null;
    mockTrack.mockClear();
    localStorage.clear();
    localStorage.setItem("quiver_beach_follow_state", JSON.stringify({
      version: 3,
      follows: [FOLLOW],
      tombstones: [],
      topicTombstones: [],
      bfrHoldoutAssignment: {
        subjectId: "visitor-1",
        experimentKey: "bfr-follow-holdout-v1",
        arm: "treatment",
        assignedAt: NOW,
        version: 1,
      },
    }));
  });

  it("does not attempt account sync for anonymous visitors", async () => {
    const adapter = persistence();
    render(<BeachFollowSyncBoundary persistence={adapter} />);

    await Promise.resolve();
    expect(adapter.readServerRows).not.toHaveBeenCalled();
  });

  it("syncs after auth, confirms before clearing local state, and invalidates ownership", async () => {
    user = { id: "user-1" };
    const adapter = persistence();
    render(<BeachFollowSyncBoundary persistence={adapter} />);

    expect(await screen.findByText(/my coast is synced across devices/i)).toBeInTheDocument();
    expect(adapter.applyMerge).toHaveBeenCalledTimes(1);
    expect(adapter.invalidateOwnership).toHaveBeenCalledTimes(1);
    expect(JSON.parse(localStorage.getItem("quiver_beach_follow_state") ?? "null").follows).toEqual([]);
    expect(mockTrack).toHaveBeenCalledWith(
      "beach_follow_sync_started",
      expect.objectContaining({ metadata: expect.any(Object) }),
    );
    expect(mockTrack).toHaveBeenCalledWith(
      "beach_follow_sync_completed",
      expect.objectContaining({ metadata: expect.any(Object) }),
    );
  });

  it("keeps local state and retries the same revision after a failed write", async () => {
    user = { id: "user-1" };
    const adapter = persistence();
    let confirmed = false;
    adapter.readServerRows.mockImplementation(async () => confirmed ? [FOLLOW] : []);
    adapter.applyMerge
      .mockRejectedValueOnce(new Error("offline"))
      .mockImplementationOnce(async () => {
        confirmed = true;
      });
    render(<BeachFollowSyncBoundary persistence={adapter} />);

    expect(await screen.findByText(/sync is pending/i)).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem("quiver_beach_follow_state") ?? "null").follows).toEqual([FOLLOW]);

    window.dispatchEvent(new StorageEvent("storage", { key: "quiver_beach_follow_state" }));
    await waitFor(() => expect(adapter.applyMerge).toHaveBeenCalledTimes(2));
  });
});
