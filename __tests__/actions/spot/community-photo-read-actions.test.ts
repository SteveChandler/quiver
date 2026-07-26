/**
 * @jest-environment node
 */

import { createThenableQuery } from "@/__tests__/setup/admin-action-test-utils";
import { expectConsoleWarnings } from "@/__tests__/setup/test-utils";

const getResolvedSpotPhotos = jest.fn();

jest.mock("@/lib/community-photos", () => ({
  getResolvedSpotPhotos: (...args: unknown[]) => getResolvedSpotPhotos(...args),
}));

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: jest.fn(),
}));

describe("community photo spot read actions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
  });

  it("merges curated rows through the shared resolver for beach galleries", async () => {
    const { createSupabaseServerClient } = await import("@/lib/supabase/server");
    const query = createThenableQuery({
      data: [
        {
          id: "curated-1",
          image_url: "https://cdn.example.com/full.jpg",
          thumb_url: "https://cdn.example.com/thumb.jpg",
          attribution_html: "Photo by Ari",
          title: "Dawn lines",
          creator_name: "Ari",
          fetched_at: "2026-07-01T12:00:00.000Z",
        },
      ],
      error: null,
    });
    (createSupabaseServerClient as jest.Mock).mockResolvedValue({
      from: jest.fn(() => query),
    });
    const resolved = [
      {
        id: "community-1",
        source: "community",
        imageUrl: "/api/community-photos/community-1/image",
        thumbUrl: null,
        title: null,
        creatorName: "Jo",
        attributionHtml: null,
        attribution: {
          kind: "profile",
          displayName: "Jo",
          profileId: "profile-1",
        },
        community: {
          voteScore: 0.5,
          upvotes: 7,
          downvotes: 1,
          viewerVote: null,
          canVote: false,
          canReport: false,
          canRemove: false,
          isPinned: false,
        },
        createdAt: "2026-07-25T12:00:00.000Z",
      },
    ];
    getResolvedSpotPhotos.mockResolvedValue(resolved);

    const { getSpotGalleryPhotos } = await import(
      "@/actions/spot/spot-data-actions"
    );
    await expect(getSpotGalleryPhotos("beach-1", 6)).resolves.toEqual(resolved);

    expect(getResolvedSpotPhotos).toHaveBeenCalledWith({
      target: { type: "beach", id: "beach-1" },
      curated: [
        expect.objectContaining({
          id: "curated-1",
          source: "curated",
          imageUrl: "https://cdn.example.com/full.jpg",
          attribution: null,
          community: null,
        }),
      ],
      limit: 6,
    });
  });

  it("uses the same resolver result for the featured image", async () => {
    const { createSupabaseServerClient } = await import("@/lib/supabase/server");
    const query = createThenableQuery({ data: [], error: null });
    (createSupabaseServerClient as jest.Mock).mockResolvedValue({
      from: jest.fn(() => query),
    });
    const featured = {
      id: "community-pinned",
      source: "community",
      imageUrl: "/api/community-photos/community-pinned/image",
      thumbUrl: null,
      title: null,
      creatorName: null,
      attributionHtml: null,
      attribution: {
        kind: "community",
        displayName: "Quiver community",
        profileId: null,
      },
      community: {
        voteScore: 0,
        upvotes: 0,
        downvotes: 0,
        viewerVote: null,
        canVote: false,
        canReport: false,
        canRemove: false,
        isPinned: true,
      },
      createdAt: "2026-07-25T12:00:00.000Z",
    };
    getResolvedSpotPhotos.mockResolvedValue([featured]);

    const { getSpotFeaturedPhoto } = await import(
      "@/actions/spot/spot-data-actions"
    );
    await expect(getSpotFeaturedPhoto("beach-1")).resolves.toEqual(featured);
  });

  it("keeps curated photos available when community resolution fails", async () => {
    const { createSupabaseServerClient } = await import("@/lib/supabase/server");
    const query = createThenableQuery({
      data: [
        {
          id: "curated-1",
          image_url: "https://cdn.example.com/full.jpg",
          thumb_url: "https://cdn.example.com/thumb.jpg",
          attribution_html: "Photo by Ari",
          title: "Dawn lines",
          creator_name: "Ari",
          fetched_at: "2026-07-01T12:00:00.000Z",
        },
      ],
      error: null,
    });
    (createSupabaseServerClient as jest.Mock).mockResolvedValue({
      from: jest.fn(() => query),
    });
    getResolvedSpotPhotos.mockRejectedValue(new Error("resolver unavailable"));

    const { getSpotGalleryPhotos } = await import(
      "@/actions/spot/spot-data-actions"
    );

    const photos = await getSpotGalleryPhotos("beach-1", 6);
    expectConsoleWarnings([
      /Community photo resolution failed; using curated photos/,
    ]);
    expect(photos).toEqual([
      expect.objectContaining({
        id: "curated-1",
        source: "curated",
        imageUrl: "https://cdn.example.com/full.jpg",
      }),
    ]);
  });
});
