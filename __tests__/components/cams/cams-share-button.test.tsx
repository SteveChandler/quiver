import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

import { CamsShareButton } from "@/components/cams/cams-share-button";
import { track } from "@/lib/analytics";
import { getVisitorId } from "@/lib/utils/visitor-id";

jest.mock("@/lib/analytics", () => ({
  track: jest.fn(),
}));

jest.mock("@/lib/utils/visitor-id", () => ({
  getVisitorId: jest.fn(() => "12345678-1234-1234-1234-123456789012"),
}));

describe("CamsShareButton", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn(() => Promise.resolve({ ok: true } as Response)) as jest.Mock;
    Object.defineProperty(window, "innerWidth", { value: 390, writable: true });
    window.history.pushState({}, "", "/cams");
    Object.defineProperty(navigator, "share", {
      value: jest.fn(() => Promise.resolve()),
      configurable: true,
    });
  });

  it("posts canonical cam_share events with anonymous visitor context", async () => {
    render(<CamsShareButton />);

    fireEvent.click(screen.getByRole("button", { name: /share this page/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/events",
        expect.objectContaining({
          method: "POST",
          body: expect.any(String),
          keepalive: true,
        })
      );
    });

    expect(track).toHaveBeenCalledWith("cam_share", {
      method: "native_share",
    });
    expect(getVisitorId).toHaveBeenCalled();

    const body = JSON.parse(
      ((global.fetch as jest.Mock).mock.calls[0][1] as RequestInit).body as string
    );
    expect(body).toMatchObject({
      eventType: "cam_share",
      metadata: {
        content_type: "cam",
        method: "native_share",
      },
      sessionId: "12345678-1234-1234-1234-123456789012",
      viewportWidth: 390,
    });
  });
});
