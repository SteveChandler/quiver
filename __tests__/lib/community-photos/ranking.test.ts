import {
  mergeResolvedSpotPhotos,
  wilsonLowerBound,
  type ResolvedSpotPhoto,
} from "@/lib/community-photos";

function community(
  id: string,
  upvotes: number,
  downvotes: number,
  isPinned = false,
): ResolvedSpotPhoto {
  return {
    id,
    source: "community",
    visibility: "public",
    imageUrl: `/api/community-photos/${id}/image`,
    thumbUrl: `/api/community-photos/${id}/image`,
    width: 1200,
    height: 800,
    title: null,
    creatorName: null,
    attributionHtml: null,
    attribution: {
      kind: "community",
      displayName: "Quiver community",
      profileId: null,
    },
    community: {
      voteScore: wilsonLowerBound(upvotes, downvotes),
      upvotes,
      downvotes,
      viewerVote: null,
      canVote: true,
      canReport: true,
      canRemove: false,
      isPinned,
    },
    createdAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("community photo ranking", () => {
  it("returns zero below five votes and the Wilson 95% lower bound otherwise", () => {
    expect(wilsonLowerBound(4, 0)).toBe(0);
    expect(wilsonLowerBound(5, 0)).toBeCloseTo(0.5655, 3);
    expect(wilsonLowerBound(8, 2)).toBeCloseTo(0.4902, 3);
  });

  it("orders eligible photos by pin, score, total votes, then UUID without recency", () => {
    const lowerId = "10000000-0000-4000-8000-000000000001";
    const higherId = "20000000-0000-4000-8000-000000000001";
    const pinned = "30000000-0000-4000-8000-000000000001";
    const result = mergeResolvedSpotPhotos({
      curated: [],
      community: [
        community(higherId, 5, 0),
        community(lowerId, 5, 0),
        community(pinned, 2, 3, true),
      ],
      limit: 10,
    });

    expect(result.map((photo) => photo.id)).toEqual([
      pinned,
      lowerId,
      higherId,
    ]);
  });

  it("keeps curated photos after eligible community photos and before photos gathering votes", () => {
    const curated = {
      ...community("curated-id", 0, 0),
      source: "curated" as const,
      community: null,
      imageUrl: "https://images.example/curated.webp",
      thumbUrl: null,
    };
    const result = mergeResolvedSpotPhotos({
      curated: [curated],
      community: [
        community("eligible-community-id", 5, 0),
        community("new-community-id", 1, 0),
      ],
      limit: 3,
    });
    expect(result.map(({ id }) => id)).toEqual([
      "eligible-community-id",
      "curated-id",
      "new-community-id",
    ]);
  });
});
