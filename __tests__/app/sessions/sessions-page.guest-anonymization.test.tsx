import React from "react";
import { render, screen } from "@testing-library/react";

import SessionsPage from "@/app/sessions/page";

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

jest.mock("@/hooks/use-data-fetcher", () => ({
  useDataFetcher: jest.fn(() => ({
    data: [
      {
        id: "session-1",
        beachName: "Ocean Beach",
        createdAt: "2025-01-01T10:00:00.000Z",
        authorName: "Rob",
        authorAvatar: "/rob.jpg",
        rating: 5,
        likesCount: 2,
      },
    ],
    loading: false,
    error: null,
    retry: jest.fn(),
  })),
}));

jest.mock("@/components/ui/public-content-gate", () => ({
  PublicContentGate: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

jest.mock("@/lib/analytics", () => ({
  trackPublicPageView: jest.fn(),
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

jest.mock("next/image", () => {
  return function MockedImage(props: any) {
     
    return <img alt={props.alt} src={props.src} />;
  };
});

describe("/sessions (guest anonymization)", () => {
  it("does not show the author name for logged-out visitors", () => {
    render(<SessionsPage />);
    expect(screen.queryByText("Rob")).not.toBeInTheDocument();
    expect(screen.getByText("Surfer")).toBeInTheDocument();
    expect(screen.getAllByText(/Ocean Beach/i).length).toBeGreaterThan(0);
  });
});


