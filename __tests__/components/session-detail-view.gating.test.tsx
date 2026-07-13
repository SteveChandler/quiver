import React from "react";
import { render, screen } from "@testing-library/react";
import { SessionDetailView } from "@/components/session-detail-view";

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
});
