import type { ImgHTMLAttributes } from "react";
import { render, screen } from "@testing-library/react";

import { SpotPhotoGallery } from "@/components/spots/spot-photo-gallery";

jest.mock("next/image", () => ({
  __esModule: true,
  default: ({
    alt = "",
    fill: _fill,
    unoptimized: _unoptimized,
    priority: _priority,
    ...props
  }: ImgHTMLAttributes<HTMLImageElement> & {
    fill?: boolean;
    unoptimized?: boolean;
    priority?: boolean;
  }) => <img alt={alt} {...props} />,
}));

jest.mock("@/hooks/use-data-fetcher", () => ({
  useDataFetcher: () => ({
    data: [
      {
        id: "community-photo-1",
        source: "community",
        imageUrl: "https://example.com/full.jpg",
        thumbUrl: "https://example.com/thumb.jpg",
        title: "Lineup at sunset",
        creatorName: "Dawn Patrol",
        attributionHtml: null,
        attribution: {
          kind: "profile",
          displayName: "<b>Dawn Patrol</b>",
          profileId: "profile-1",
        },
        community: {
          voteScore: 0.42,
          upvotes: 8,
          downvotes: 2,
          viewerVote: null,
          canVote: true,
          canReport: true,
          canRemove: false,
          isPinned: false,
        },
        createdAt: "2026-07-25T12:00:00.000Z",
      },
    ],
    loading: false,
  }),
}));

jest.mock("@/lib/image-proxy", () => ({
  getOptimizedImageUrl: (url: string) => `optimized:${url}`,
}));

jest.mock("@/actions/spot/spot-data-actions", () => ({
  getSpotGalleryPhotos: jest.fn(),
}));

describe("SpotPhotoGallery", () => {
  it("renders generated gallery and photo icons", () => {
    render(<SpotPhotoGallery beachId="beach-1" spotName="Huntington Beach Pier" />);

    expect(screen.getByText("Huntington Beach Pier Photos")).toBeInTheDocument();
    expect(screen.getByAltText("Lineup at sunset")).toHaveAttribute(
      "src",
      "optimized:https://example.com/thumb.jpg"
    );
    expect(screen.getAllByAltText("").some((image) =>
      image.getAttribute("src") === "/images/spot-icons/gallery.png"
    )).toBe(true);
    expect(screen.getAllByAltText("").some((image) =>
      image.getAttribute("src") === "/images/spot-icons/photo.png"
    )).toBe(true);
    expect(
      screen.getByRole("link", { name: "<b>Dawn Patrol</b>" }),
    ).toHaveAttribute("href", "/profile/profile-1");
    expect(document.querySelector("b")).not.toBeInTheDocument();
    expect(screen.getByText("8 up · 2 down")).toBeInTheDocument();
  });
});
