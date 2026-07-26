import type { ImgHTMLAttributes } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { CommunityPhotoModeration } from "@/components/admin/community-photo-moderation";

const refetch = jest.fn();

jest.mock("@/hooks/use-data-fetcher", () => ({
  useDataFetcher: () => ({
    data: {
      photos: [
        {
          id: "photo-1",
          targetType: "beach",
          targetId: "beach-1",
          imageUrl: "/api/community-photos/photo-1/image",
          visibility: "public",
          processingStatus: "ready",
          moderationStatus: "visible",
          lifecycleStatus: "active",
          attribution: {
            kind: "profile",
            displayName: "<strong>Jo</strong>",
            profileId: "profile-1",
          },
          upvotes: 8,
          downvotes: 2,
          reportCounts: { severe: 1, quality: 2, total: 3 },
          isPinned: false,
          hold: null,
          contributorRestriction: null,
          createdAt: "2026-07-25T12:00:00.000Z",
          removedAt: null,
          recoverableUntil: null,
        },
      ],
      nextCursor: null,
    },
    loading: false,
    error: null,
    refetch,
  }),
}));

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

describe("CommunityPhotoModeration", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(globalThis.crypto, "randomUUID").mockReturnValue(
      "00000000-0000-4000-8000-000000000001",
    );
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ photoId: "photo-1", status: "hidden" }),
    }) as jest.Mock;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("renders moderation evidence and safe profile attribution", () => {
    render(<CommunityPhotoModeration />);

    expect(
      screen.getByRole("link", { name: "<strong>Jo</strong>" }),
    ).toHaveAttribute("href", "/profile/profile-1");
    expect(document.querySelector("strong")).not.toBeInTheDocument();
    expect(screen.getByText("1 severe · 2 quality · 3 total")).toBeInTheDocument();
    expect(screen.getByText("8 up · 2 down")).toBeInTheDocument();
  });

  it("hides a photo through the audited admin endpoint and refreshes the queue", async () => {
    render(<CommunityPhotoModeration />);

    fireEvent.click(screen.getByRole("button", { name: "Hide photo" }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/admin/community-photos/photo-1/moderation",
        expect.objectContaining({
          method: "POST",
          cache: "no-store",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "hide",
            reason: "manual_admin_review",
            idempotencyKey: "00000000-0000-4000-8000-000000000001",
          }),
        }),
      );
    });
    expect(refetch).toHaveBeenCalled();
  });

  it("places a documented investigation hold", async () => {
    render(<CommunityPhotoModeration />);

    fireEvent.change(screen.getByLabelText("Hold reason for photo-1"), {
      target: { value: "Preserve while reviewing privacy report" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Place hold" }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/admin/community-photos/photo-1/hold",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            reason: "Preserve while reviewing privacy report",
            idempotencyKey: "00000000-0000-4000-8000-000000000001",
          }),
        }),
      );
    });
  });
});
