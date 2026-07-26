const rpc = jest.fn();
const from = jest.fn();

jest.mock("@/lib/supabase", () => ({
  createServiceRoleClient: () => ({ rpc, from }),
}));

import {
  getCanonicalSpotPhotos,
  getCommunityPhotoById,
  getCommunityPhotosForTarget,
  getResolvedSpotPhotoMap,
} from "@/lib/community-photos/resolver";

const TARGET_ID = "10000000-0000-4000-8000-000000000001";
const PHOTO_ID = "20000000-0000-4000-8000-000000000001";
const VIEWER_ID = "30000000-0000-4000-8000-000000000001";

const communityRow = {
  photo_id: PHOTO_ID,
  target_type: "beach",
  target_id: TARGET_ID,
  visibility: "public",
  width: 1600,
  height: 900,
  uploader_id: "40000000-0000-4000-8000-000000000001",
  display_name: "Local Surfer",
  upvotes: 8,
  downvotes: 2,
  viewer_vote: "up",
  wilson_score: 0.49,
  is_pinned: false,
  created_at: "2026-07-25T12:00:00.000Z",
};

describe("community photo resolver", () => {
  const originalRead = process.env.COMMUNITY_PHOTOS_READ_ENABLED;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.COMMUNITY_PHOTOS_READ_ENABLED = "true";
  });

  afterAll(() => {
    process.env.COMMUNITY_PHOTOS_READ_ENABLED = originalRead;
  });

  it("returns stable gated URLs, structured attribution, dimensions and controls", async () => {
    rpc.mockResolvedValue({ data: [communityRow], error: null });

    await expect(
      getCommunityPhotosForTarget({
        target: { type: "beach", id: TARGET_ID },
        viewerId: VIEWER_ID,
      }),
    ).resolves.toEqual([
      {
        id: PHOTO_ID,
        source: "community",
        visibility: "public",
        imageUrl: `/api/community-photos/${PHOTO_ID}/image`,
        thumbUrl: `/api/community-photos/${PHOTO_ID}/image`,
        width: 1600,
        height: 900,
        title: null,
        creatorName: null,
        attributionHtml: null,
        attribution: {
          kind: "profile",
          displayName: "Local Surfer",
          profileId: "40000000-0000-4000-8000-000000000001",
        },
        community: {
          voteScore: 0.49,
          upvotes: 8,
          downvotes: 2,
          viewerVote: "up",
          canVote: true,
          canReport: true,
          canRemove: false,
          isPinned: false,
        },
        createdAt: "2026-07-25T12:00:00.000Z",
      },
    ]);
  });

  it("removes attribution and public controls from owner-private custom photos", async () => {
    rpc.mockResolvedValue({
      data: [
        {
          ...communityRow,
          target_type: "custom_spot",
          visibility: "private",
          uploader_id: VIEWER_ID,
        },
      ],
      error: null,
    });
    const [photo] = await getCommunityPhotosForTarget({
      target: { type: "custom_spot", id: TARGET_ID },
      viewerId: VIEWER_ID,
    });

    expect(photo.visibility).toBe("private");
    expect(photo.attribution).toBeNull();
    expect(photo.community).toEqual(
      expect.objectContaining({
        canVote: false,
        canReport: false,
        canRemove: true,
        isPinned: false,
      }),
    );
  });

  it("does not expose profileId when no safe display name exists", async () => {
    rpc.mockResolvedValue({
      data: [{ ...communityRow, display_name: null }],
      error: null,
    });

    const [photo] = await getCommunityPhotosForTarget({
      target: { type: "beach", id: TARGET_ID },
      viewerId: VIEWER_ID,
    });

    expect(photo.attribution).toEqual({
      kind: "community",
      displayName: "Quiver community",
      profileId: null,
    });
  });

  it("resolves a newly reserved upload directly by id", async () => {
    rpc.mockResolvedValue({ data: [communityRow], error: null });

    await expect(
      getCommunityPhotoById({ photoId: PHOTO_ID, viewerId: VIEWER_ID }),
    ).resolves.toEqual(expect.objectContaining({ id: PHOTO_ID }));
    expect(rpc).toHaveBeenCalledWith(
      "resolve_community_spot_photo_by_id_v1",
      { p_photo_id: PHOTO_ID, p_viewer_id: VIEWER_ID },
    );
  });

  it("returns a fail-closed empty response without touching the database", async () => {
    process.env.COMMUNITY_PHOTOS_READ_ENABLED = "false";
    await expect(
      getCommunityPhotosForTarget({
        target: { type: "beach", id: TARGET_ID },
      }),
    ).resolves.toEqual([]);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("resolves a batch through one RPC without N+1 calls", async () => {
    rpc.mockResolvedValue({ data: [communityRow], error: null });
    const limit = jest.fn().mockResolvedValue({ data: [], error: null });
    const order = jest.fn(() => ({ limit }));
    const is = jest.fn(() => ({ order }));
    const eq = jest.fn(() => ({ is }));
    const inTargets = jest.fn(() => ({ eq }));
    const publicOr = jest
      .fn()
      .mockResolvedValue({ data: [{ id: TARGET_ID }], error: null });
    const publicIn = jest.fn(() => ({ or: publicOr }));
    from.mockImplementation((table: string) =>
      table === "beaches"
        ? { select: jest.fn(() => ({ in: publicIn })) }
        : { select: jest.fn(() => ({ in: inTargets })) },
    );
    const targets = [
      { type: "beach" as const, id: TARGET_ID },
      {
        type: "custom_spot" as const,
        id: "50000000-0000-4000-8000-000000000001",
      },
    ];
    const result = await getResolvedSpotPhotoMap({ targets, viewerId: VIEWER_ID });

    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith(
      "resolve_community_spot_photo_batch_v1",
      expect.objectContaining({
        p_targets: [
          { target_type: "beach", target_id: TARGET_ID },
          {
            target_type: "custom_spot",
            target_id: "50000000-0000-4000-8000-000000000001",
          },
        ],
      }),
    );
    expect(result.get(`beach:${TARGET_ID}`)?.[0].id).toBe(PHOTO_ID);
  });

  it("merges eligible community, curated fallback, and new submissions canonically", async () => {
    rpc.mockResolvedValue({
      data: [
        communityRow,
        {
          ...communityRow,
          photo_id: "60000000-0000-4000-8000-000000000001",
          upvotes: 1,
          downvotes: 0,
          wilson_score: 0,
        },
      ],
      error: null,
    });
    const limit = jest.fn().mockResolvedValue({
      data: [
        {
          id: "70000000-0000-4000-8000-000000000001",
          image_url: "https://images.example/curated.webp",
          thumb_url: null,
          title: "Curated",
          creator_name: "Photographer",
          attribution_html: "Licensed source",
          fetched_at: "2025-01-01T00:00:00.000Z",
        },
      ],
      error: null,
    });
    const order = jest.fn(() => ({ limit }));
    const is = jest.fn(() => ({ order }));
    const approvedEq = jest.fn(() => ({ is }));
    const beachEq = jest.fn(() => ({ eq: approvedEq }));
    const select = jest.fn(() => ({ eq: beachEq }));
    const maybeSingle = jest
      .fn()
      .mockResolvedValue({ data: { id: TARGET_ID }, error: null });
    const publicOr = jest.fn(() => ({ maybeSingle }));
    const publicEq = jest.fn(() => ({ or: publicOr }));
    from.mockImplementation((table: string) =>
      table === "beaches"
        ? { select: jest.fn(() => ({ eq: publicEq })) }
        : { select },
    );

    const photos = await getCanonicalSpotPhotos({
      target: { type: "beach", id: TARGET_ID },
      viewerId: VIEWER_ID,
      limit: 3,
    });

    expect(photos.map(({ id }) => id)).toEqual([
      PHOTO_ID,
      "70000000-0000-4000-8000-000000000001",
      "60000000-0000-4000-8000-000000000001",
    ]);
    expect(photos[1]).toEqual(
      expect.objectContaining({
        source: "curated",
        visibility: "public",
        community: null,
      }),
    );
  });
});
