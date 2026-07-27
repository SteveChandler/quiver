/**
 * @jest-environment node
 */

const getSpotGalleryPhotos = jest.fn();

jest.mock("@/actions/spot/spot-data-actions", () => ({
  getSpotGalleryPhotos: (...args: unknown[]) => getSpotGalleryPhotos(...args),
}));

describe("beach media actions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
  });

  test("returns the shared resolved photo contract for beach galleries", async () => {
    getSpotGalleryPhotos.mockResolvedValue([
      {
        id: "community-1",
        source: "community",
        imageUrl: "/api/community-photos/community-1/image",
        thumbUrl: null,
        attributionHtml: null,
        attribution: {
          kind: "profile",
          displayName: "Jo",
          profileId: "profile-1",
        },
        title: "Clean morning",
        creatorName: "Jo",
        community: {
          voteScore: 0.4,
          upvotes: 8,
          downvotes: 2,
          viewerVote: null,
          canVote: false,
          canReport: false,
          canRemove: false,
          isPinned: false,
        },
        createdAt: "2026-07-25T12:00:00.000Z",
      },
    ]);

    const { getBestBeachPhotosAction } = await import(
      "@/actions/beach-media-actions"
    );
    const result = await getBestBeachPhotosAction("beach-1", 6);

    expect(result).toEqual({
      success: true,
      data: [
        expect.objectContaining({
          id: "community-1",
          public_url: "/api/community-photos/community-1/image",
          attribution: {
            kind: "profile",
            displayName: "Jo",
            profileId: "profile-1",
          },
          community: expect.objectContaining({ upvotes: 8, downvotes: 2 }),
        }),
      ],
    });
    expect(getSpotGalleryPhotos).toHaveBeenCalledWith("beach-1", 6);
  });

  test("keeps an empty resolver result empty", async () => {
    getSpotGalleryPhotos.mockResolvedValue([]);

    const { getBestBeachPhotosAction } = await import(
      "@/actions/beach-media-actions"
    );
    const result = await getBestBeachPhotosAction("beach-1", 6);

    expect(result).toEqual({ success: true, data: [] });
  });
});
