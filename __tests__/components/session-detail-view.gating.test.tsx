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

jest.mock("@/components/app-store/ios-app-store-cta", () => ({
  IosAppStoreCta: ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) => (
    <a href="https://apps.apple.com/us/app/surf-forecast-quiver/id6759300320" className={className}>
      {children}
    </a>
  ),
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
  it("shows a shared-session app fallback when logged out", () => {
    render(
      <SessionDetailView
        id="session-1"
        sharedPreview={{
          beachName: "Ocean Beach",
          userName: "Sam",
          rating: 4,
          dateText: "Jul 3, 2026",
          title: "Sam's session at Ocean Beach",
          subtitle: "4/5 stars · Jul 3, 2026 · Logged session",
          imageUrl: "https://cdn.quiversurf.app/session.jpg",
          shareImageUrl: "https://www.quiversurf.app/api/og/session?beach=Ocean+Beach",
        }}
      />,
    );

    expect(screen.getByText("Shared session")).toBeInTheDocument();
    expect(screen.getByText("Sam's session at Ocean Beach")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open App Store" })).toHaveAttribute(
      "href",
      expect.stringContaining("apps.apple.com"),
    );
    expect(screen.getByRole("link", { name: "Download options" })).toHaveAttribute(
      "href",
      "/download",
    );
  });
});

