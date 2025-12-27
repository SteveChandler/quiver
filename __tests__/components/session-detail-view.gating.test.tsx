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

jest.mock("@/components/ui/public-content-gate", () => ({
  PublicContentGate: ({
    ctaTitle,
    children,
  }: {
    ctaTitle: string;
    children: React.ReactNode;
  }) => (
    <div>
      <div>{ctaTitle}</div>
      <div>{children}</div>
    </div>
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
  it("shows an auth gate when logged out (instead of spinning forever)", () => {
    render(<SessionDetailView id="session-1" />);
    expect(
      screen.getByText("Log in to view session details")
    ).toBeInTheDocument();
  });
});


