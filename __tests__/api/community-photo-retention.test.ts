/**
 * @jest-environment node
 */

export {};

const mockRpc = jest.fn();
const mockRemove = jest.fn();
const mockValidateCronRequest = jest.fn(() => true);

jest.mock("@/lib/cron/observability", () => ({
  withObservedCron:
    (_route: string, handler: (request: Request) => Promise<Response>) =>
    (request: Request) =>
      handler(request),
}));

jest.mock("@/lib/middleware/api-wrappers", () => ({
  validateCronRequest: mockValidateCronRequest,
}));

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: () => ({
    rpc: mockRpc,
    storage: {
      from: () => ({ remove: mockRemove }),
    },
  }),
}));

const FIRST_ID = "10000000-0000-4000-8000-000000000001";
const SECOND_ID = "10000000-0000-4000-8000-000000000002";

describe("community photo retention cron", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockValidateCronRequest.mockReturnValue(true);
  });

  it("deletes private objects before finalizing claimed rows", async () => {
    mockRpc.mockImplementation(async (name: string) => {
      if (name === "purge_removed_community_spot_photos_v1") {
        return {
          data: [
            { photo_id: FIRST_ID, storage_path: "user/first.webp" },
            { photo_id: SECOND_ID, storage_path: "user/second.webp" },
          ],
          error: null,
        };
      }
      if (name === "finalize_purged_community_spot_photos_v1") {
        return { data: 2, error: null };
      }
      if (
        name === "claim_stuck_community_spot_photo_uploads_v1" ||
        name === "list_orphan_community_photo_objects_v1"
      ) {
        return { data: [], error: null };
      }
      return { data: 0, error: null };
    });
    mockRemove.mockResolvedValue({ data: [], error: null });

    const { GET } = await import(
      "@/app/api/cron/community-photo-retention/route"
    );
    const response = await GET(
      new Request("https://example.com/api/cron/community-photo-retention"),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      claimed: 2,
      purged: 2,
      released: 0,
      stuckClaimed: 0,
      stuckCleaned: 0,
      stuckReleased: 0,
      orphansFound: 0,
      orphansRemoved: 0,
      orphanFailures: 0,
    });
    expect(mockRemove).toHaveBeenNthCalledWith(1, ["user/first.webp"]);
    expect(mockRpc).toHaveBeenCalledWith(
      "finalize_purged_community_spot_photos_v1",
      { p_photo_ids: [FIRST_ID, SECOND_ID] },
    );
  });

  it("releases storage failures for retry and never finalizes their rows", async () => {
    mockRpc.mockImplementation(async (name: string) => {
      if (name === "purge_removed_community_spot_photos_v1") {
        return {
          data: [
            { photo_id: FIRST_ID, storage_path: "user/first.webp" },
            { photo_id: SECOND_ID, storage_path: "user/second.webp" },
          ],
          error: null,
        };
      }
      if (name === "finalize_purged_community_spot_photos_v1") {
        return { data: 1, error: null };
      }
      if (
        name === "claim_stuck_community_spot_photo_uploads_v1" ||
        name === "list_orphan_community_photo_objects_v1"
      ) {
        return { data: [], error: null };
      }
      return { data: 1, error: null };
    });
    mockRemove
      .mockResolvedValueOnce({ data: [], error: { message: "unavailable" } })
      .mockResolvedValueOnce({ data: [], error: null });

    const { GET } = await import(
      "@/app/api/cron/community-photo-retention/route"
    );
    const response = await GET(
      new Request("https://example.com/api/cron/community-photo-retention"),
    );

    expect(await response.json()).toEqual({
      ok: false,
      claimed: 2,
      purged: 1,
      released: 1,
      stuckClaimed: 0,
      stuckCleaned: 0,
      stuckReleased: 0,
      orphansFound: 0,
      orphansRemoved: 0,
      orphanFailures: 0,
    });
    expect(mockRpc).toHaveBeenCalledWith(
      "release_community_spot_photo_purge_v1",
      { p_photo_ids: [FIRST_ID] },
    );
    expect(mockRpc).toHaveBeenCalledWith(
      "finalize_purged_community_spot_photos_v1",
      { p_photo_ids: [SECOND_ID] },
    );
  });

  it("compensates stuck processing rows and orphaned bucket objects", async () => {
    mockRpc.mockImplementation(async (name: string) => {
      if (name === "claim_stuck_community_spot_photo_uploads_v1") {
        return {
          data: [{ photo_id: FIRST_ID, storage_path: "user/stuck.webp" }],
          error: null,
        };
      }
      if (name === "finalize_stuck_community_spot_photo_uploads_v1") {
        return { data: 1, error: null };
      }
      if (name === "list_orphan_community_photo_objects_v1") {
        return {
          data: [{ storage_path: "orphan/orphan.webp" }],
          error: null,
        };
      }
      if (name === "purge_removed_community_spot_photos_v1") {
        return { data: [], error: null };
      }
      return { data: 0, error: null };
    });
    mockRemove.mockResolvedValue({ data: [], error: null });

    const { GET } = await import(
      "@/app/api/cron/community-photo-retention/route"
    );
    const response = await GET(
      new Request("https://example.com/api/cron/community-photo-retention"),
    );

    expect(await response.json()).toEqual({
      ok: true,
      claimed: 0,
      purged: 0,
      released: 0,
      stuckClaimed: 1,
      stuckCleaned: 1,
      stuckReleased: 0,
      orphansFound: 1,
      orphansRemoved: 1,
      orphanFailures: 0,
    });
    expect(mockRemove).toHaveBeenCalledWith(["user/stuck.webp"]);
    expect(mockRemove).toHaveBeenCalledWith(["orphan/orphan.webp"]);
    expect(mockRpc).toHaveBeenCalledWith(
      "finalize_stuck_community_spot_photo_uploads_v1",
      { p_photo_ids: [FIRST_ID] },
    );
  });
});
