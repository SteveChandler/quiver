import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

import { ShareSheet } from "@/components/share/share-sheet";
import { track } from "@/lib/analytics";
import { shareImage } from "@/lib/share/share-image";
import { getVisitorId } from "@/lib/utils/visitor-id";

jest.mock("framer-motion", () => ({
  motion: {
    div: ({
      children,
      initial: _initial,
      animate: _animate,
      transition: _transition,
      whileTap: _whileTap,
      ...props
    }: React.HTMLAttributes<HTMLDivElement> & {
      initial?: unknown;
      animate?: unknown;
      transition?: unknown;
      whileTap?: unknown;
    }) => <div {...props}>{children}</div>,
    button: ({
      children,
      initial: _initial,
      animate: _animate,
      transition: _transition,
      whileTap: _whileTap,
      ...props
    }: React.ButtonHTMLAttributes<HTMLButtonElement> & {
      initial?: unknown;
      animate?: unknown;
      transition?: unknown;
      whileTap?: unknown;
    }) => <button {...props}>{children}</button>,
  },
  useReducedMotion: () => true,
}));

jest.mock("@/components/ui/sheet", () => ({
  Sheet: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
    open ? <div>{children}</div> : null,
  SheetContent: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  SheetHeader: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  SheetTitle: ({ children }: { children: React.ReactNode }) => (
    <h2>{children}</h2>
  ),
  SheetDescription: ({ children }: { children: React.ReactNode }) => (
    <p>{children}</p>
  ),
}));

jest.mock("@/lib/share/share-image", () => ({
  shareImage: jest.fn(() => Promise.resolve()),
  fetchImageAsBlob: jest.fn(() => Promise.resolve(new Blob(["image"]))),
  downloadImage: jest.fn(),
  copyToClipboard: jest.fn(() => Promise.resolve()),
  ShareImageError: class ShareImageError extends Error {
    code: string;

    constructor(message: string, code: string) {
      super(message);
      this.code = code;
    }
  },
}));

jest.mock("@/lib/analytics", () => ({
  track: jest.fn(),
}));

jest.mock("@/lib/utils/visitor-id", () => ({
  getVisitorId: jest.fn(() => "12345678-1234-1234-1234-123456789012"),
}));

describe("ShareSheet", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn(() =>
      Promise.resolve({ ok: true } as Response)
    ) as jest.Mock;
    Object.defineProperty(window, "innerWidth", { value: 390, writable: true });
  });

  it("posts canonical share_completed events with anonymous visitor context", async () => {
    render(
      <ShareSheet
        open
        onOpenChange={jest.fn()}
        imageUrl="/api/og/session?id=session-1"
        type="session"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /more/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/events",
        expect.objectContaining({
          method: "POST",
          body: expect.any(String),
          keepalive: true,
        }),
      );
    });

    expect(shareImage).toHaveBeenCalled();
    expect(track).toHaveBeenCalledWith("share_completed", {
      type: "session",
    });
    expect(getVisitorId).toHaveBeenCalled();

    const body = JSON.parse(
      ((global.fetch as jest.Mock).mock.calls[0][1] as RequestInit)
        .body as string,
    );
    expect(body).toMatchObject({
      eventType: "share_completed",
      metadata: {
        content_type: "session",
        method: "native_share",
      },
      sessionId: "12345678-1234-1234-1234-123456789012",
      viewportWidth: 390,
    });
  });
});
