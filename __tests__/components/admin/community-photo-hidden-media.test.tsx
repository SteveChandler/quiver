import type { ImgHTMLAttributes } from "react";
import { render, screen } from "@testing-library/react";

import { CommunityPhotoModeration } from "@/components/admin/community-photo-moderation";

let mockPhotos: Array<Record<string, unknown>> = [];

jest.mock("@/hooks/use-data-fetcher", () => ({
  useDataFetcher: () => ({
    data: {
      photos: mockPhotos,
      nextCursor: null,
    },
    loading: false,
    error: null,
    refetch: jest.fn(),
  }),
}));

function hiddenRemovedPhoto(): Record<string, unknown> {
  return {
    id: "photo-hidden",
    targetType: "beach",
    targetId: "beach-1",
    imageUrl: "/api/community-photos/photo-hidden/image",
    visibility: "public",
    processingStatus: "ready",
    moderationStatus: "hidden",
    lifecycleStatus: "removed",
    attribution: null,
    upvotes: 0,
    downvotes: 0,
    reportCounts: { severe: 1, quality: 0, total: 1 },
    isPinned: false,
    hold: null,
    contributorRestriction: null,
    createdAt: "2026-07-25T12:00:00.000Z",
    removedAt: "2026-07-26T12:00:00.000Z",
    recoverableUntil: "2026-08-25T12:00:00.000Z",
  };
}

jest.mock("next/image", () => ({
  __esModule: true,
  default: ({
    alt = "",
    fill: _fill,
    unoptimized: _unoptimized,
    ...props
  }: ImgHTMLAttributes<HTMLImageElement> & {
    fill?: boolean;
    unoptimized?: boolean;
  }) => <img alt={alt} {...props} />,
}));

describe("CommunityPhotoModeration hidden media", () => {
  beforeEach(() => {
    mockPhotos = [hiddenRemovedPhoto()];
    jest.spyOn(globalThis.crypto, "randomUUID").mockReturnValue(
      "00000000-0000-4000-8000-000000000009",
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("loads hidden non-purging media through the audited admin-only URL", () => {
    render(<CommunityPhotoModeration />);

    expect(
      screen.getByRole("img", { name: "Community photo photo-hidden" }),
    ).toHaveAttribute(
      "src",
      "/api/admin/community-photos/photo-hidden/image?auditId=00000000-0000-4000-8000-000000000009",
    );
  });

  it("does not request inaccessible media for a visible owner-removed photo", () => {
    mockPhotos = [
      {
        ...hiddenRemovedPhoto(),
        id: "photo-owner-removed",
        imageUrl: "/api/community-photos/photo-owner-removed/image",
        moderationStatus: "visible",
      },
    ];

    render(<CommunityPhotoModeration />);

    expect(
      screen.queryByRole("img", {
        name: "Community photo photo-owner-removed",
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText("Owner-removed media is available only to the contributor."),
    ).toBeInTheDocument();
  });
});
