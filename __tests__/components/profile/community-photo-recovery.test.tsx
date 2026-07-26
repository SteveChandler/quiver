import type { ImgHTMLAttributes } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { CommunityPhotoRecovery } from "@/components/profile/community-photo-recovery";

jest.mock("next/image", () => ({
  __esModule: true,
  default: ({
    alt = "",
    unoptimized: _unoptimized,
    ...props
  }: ImgHTMLAttributes<HTMLImageElement> & {
    unoptimized?: boolean;
  }) => <img alt={alt} {...props} />,
}));

const recoverablePhoto = {
  id: "11111111-1111-4111-8111-111111111111",
  targetType: "beach",
  targetId: "22222222-2222-4222-8222-222222222222",
  imageUrl:
    "/api/community-photos/11111111-1111-4111-8111-111111111111/image",
  thumbUrl:
    "/api/community-photos/11111111-1111-4111-8111-111111111111/image",
  recoverableUntil: "2026-08-20T12:00:00.000Z",
  moderationStatus: "visible",
  hasActiveHold: false,
};

describe("CommunityPhotoRecovery", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date("2026-07-26T12:00:00.000Z"));
    jest.spyOn(globalThis.crypto, "randomUUID").mockReturnValue(
      "00000000-0000-4000-8000-000000000001",
    );
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it("lists owner removed photos and recovers one through the authenticated endpoint", async () => {
    global.fetch = jest
      .fn()
      .mockImplementation((input: RequestInfo | URL) => {
        const url = String(input);
        if (url === "/api/community-photos/mine?status=removed") {
          return Promise.resolve({
            ok: true,
            json: async () => ({ photos: [recoverablePhoto] }),
          });
        }
        if (
          url ===
          "/api/community-photos/11111111-1111-4111-8111-111111111111/recover"
        ) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              photoId: recoverablePhoto.id,
              status: "active",
            }),
          });
        }
        throw new Error(`Unexpected fetch: ${url}`);
      }) as jest.Mock;

    render(<CommunityPhotoRecovery />);

    expect(
      await screen.findByRole("heading", { name: "Removed spot photos" }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole("img", { name: "Removed beach spot photo" }),
    ).toHaveAttribute("src", recoverablePhoto.thumbUrl);

    fireEvent.click(screen.getByRole("button", { name: "Recover photo" }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        `/api/community-photos/${recoverablePhoto.id}/recover`,
        {
          method: "POST",
          cache: "no-store",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            idempotencyKey: "00000000-0000-4000-8000-000000000001",
          }),
        },
      );
    });
    expect(
      await screen.findByText("Photo recovered. It is back in its spot gallery."),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Recover photo" }),
    ).not.toBeInTheDocument();
  });

  it("explains why moderation and investigation holds block owner recovery", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        photos: [
          {
            ...recoverablePhoto,
            id: "33333333-3333-4333-8333-333333333333",
            moderationStatus: "hidden",
          },
          {
            ...recoverablePhoto,
            id: "44444444-4444-4444-8444-444444444444",
            hasActiveHold: true,
          },
        ],
      }),
    }) as jest.Mock;

    render(<CommunityPhotoRecovery />);

    expect(
      await screen.findByText(
        "This photo must pass moderation before it can be recovered.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Recovery is paused during an investigation."),
    ).toBeInTheDocument();
    for (const button of screen.getAllByRole("button", {
      name: "Recover photo",
    })) {
      expect(button).toBeDisabled();
    }
  });

  it("stays hidden when rollout reads are disabled for the current user", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({
        error: "feature disabled",
        code: "feature_disabled",
        retryable: false,
      }),
    }) as jest.Mock;

    const { container } = render(<CommunityPhotoRecovery />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/community-photos/mine?status=removed",
        { cache: "no-store" },
      );
    });
    await waitFor(() => {
      expect(container).toBeEmptyDOMElement();
    });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Removed spot photos" }),
    ).not.toBeInTheDocument();
  });
});
