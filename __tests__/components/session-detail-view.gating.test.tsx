import React from "react";
import { render, screen } from "@testing-library/react";
import { SessionDetailView } from "@/components/session-detail-view";
import { useAuth } from "@/context/auth-context";
import type { SessionWithDetails } from "@/types/database";

jest.mock("@/context/auth-context", () => ({
  useAuth: jest.fn(() => ({
    user: null,
    isLoading: false,
    session: null,
    isAuthenticated: false,
    signIn: jest.fn(),
    signUp: jest.fn(),
    signOut: jest.fn(),
    refreshSession: jest.fn(),
  })),
}));

jest.mock("@/components/app-store/native-app-funnel-cta", () => ({
  NativeAppFunnelCta: ({
    androidLabel,
    platform,
    source,
    surface,
  }: {
    androidLabel?: React.ReactNode;
    platform: string;
    source: string;
    surface: string;
  }) => (
    <a
      data-platform={platform}
      data-source={source}
      data-surface={surface}
      href={platform === "android" ? "/android-beta" : "/download"}
    >
      {platform === "android" ? androidLabel : "Get Quiver"}
    </a>
  ),
}));

jest.mock("@/lib/analytics/web-context", () => ({
  getFirstTouchPlatform: jest.fn(() => "android"),
}));

jest.mock("next/dynamic", () => jest.fn(() => () => null));

jest.mock("@/components/map-image", () => ({
  MapImage: () => null,
}));

jest.mock("@/components/session-comments", () => ({
  SessionComments: () => null,
}));

jest.mock("@/components/session/forecast-comparison", () => ({
  ForecastComparison: () => null,
}));

jest.mock("@/lib/utils/session-utils", () => ({
  getSessionMapImageUrl: jest.fn(() => "/session-map.jpg"),
}));

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock("next/link", () => {
  return ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>;
});

describe("SessionDetailView (gating)", () => {
  it("shows a shared-session app fallback when logged out", async () => {
    render(
      <SessionDetailView
        id="session-1"
        sharedPreview={{
          rating: 4,
          title: "Sam's session at Ocean Beach",
          subtitle: "4/5 stars · Jul 3, 2026 · Logged session",
          imageUrl: "https://cdn.quiversurf.app/session.jpg",
        }}
      />,
    );

    expect(screen.getByText("Shared session")).toBeInTheDocument();
    expect(screen.getByText("Sam's session at Ocean Beach")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sign in to view on web" })).toHaveAttribute(
      "href",
      "/auth/sign-in?redirectTo=%2Fsessions%2Fsession-1",
    );
    const appCta = await screen.findByRole("link", { name: "Get the Android beta" });
    expect(appCta).toHaveAttribute("href", "/android-beta");
    expect(appCta).toHaveAttribute("data-platform", "android");
    expect(appCta).toHaveAttribute("data-source", "session_share");
    expect(appCta).toHaveAttribute("data-surface", "session_detail_fallback");
    expect(screen.getByRole("link", { name: "Download options" })).toHaveAttribute(
      "href",
      "/download",
    );
  });

  it("gives the destructive session action an accessible name", async () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: { id: "user-1" },
      isLoading: false,
    });

    const session = {
      id: "session-1",
      user_id: "user-1",
      beach: null,
      beach_name: "Test Beach",
      arrival_time: "2026-08-13T08:00:00.000Z",
      rating: 4,
      tide_height_ft: null,
      tide_status: null,
      description: null,
      board: null,
      duration_minutes: null,
      wave_height_ft: null,
      water_temp: null,
      crowd_level: null,
      forecast_snapshot: null,
    } as unknown as SessionWithDetails;

    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { session } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [] }),
      });

    render(<SessionDetailView id="session-1" />);

    const deleteButton = await screen.findByRole("button", {
      name: "Delete session",
    });

    expect(deleteButton).toBeInTheDocument();
    expect(deleteButton.querySelector("svg")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
  });
});

describe("shared session preview image", () => {
  it("describes the preview instead of marking it decorative", () => {
    // The shared-session preview IS the primary content of this view, so an
    // empty alt hides it entirely from screen readers.
    const src = require("fs").readFileSync(
      require("path").join(process.cwd(), "components/session-detail-view.tsx"),
      "utf8"
    );
    const previewImg = src.slice(src.indexOf("sharedPreview.imageUrl"));
    const altMatch = previewImg.slice(0, 400).match(/alt=\{?([^\n]*)/);
    expect(altMatch).not.toBeNull();
    expect(altMatch![1]).not.toMatch(/^""/);
    expect(previewImg.slice(0, 400)).toMatch(/Shared session|Shared surf session/);
  });
});
