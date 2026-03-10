import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HeroSection } from "@/components/landing-page/hero-section";

// Mock HeroCarousel (uses images and CSS that jest can't handle)
jest.mock("@/components/landing-page/hero-carousel", () => ({
  HeroCarousel: () => <div data-testid="hero-carousel" />,
}));

// Mock HeroMatchDemo (fetches data)
jest.mock("@/components/landing-page/hero-match-demo", () => ({
  HeroMatchDemo: () => <div data-testid="hero-match-demo">Match Demo</div>,
}));

// Mock UnifiedAuthModal
jest.mock("@/components/auth/unified-auth-modal", () => ({
  UnifiedAuthModal: ({
    isOpen,
    mode,
  }: {
    isOpen: boolean;
    mode: string;
  }) =>
    isOpen ? (
      <div data-testid="auth-modal" data-mode={mode}>
        Auth Modal
      </div>
    ) : null,
}));

// Mock analytics
jest.mock("@/lib/analytics/auth-events", () => ({
  trackAuthModalOpened: jest.fn(),
}));

// Mock CONTENT
jest.mock("@/lib/constants/features", () => ({
  CONTENT: {
    hero: {
      title: "Every beach, scored for you",
      subtitle: "Test subtitle",
      cta: "Get Your Match Score",
    },
  },
}));

describe("HeroSection", () => {
  it("renders the hero headline from CONTENT", () => {
    render(<HeroSection />);
    expect(
      screen.getByRole("heading", { name: /every beach, scored for you/i })
    ).toBeInTheDocument();
  });

  it("renders the HeroMatchDemo card", () => {
    render(<HeroSection />);
    expect(screen.getByTestId("hero-match-demo")).toBeInTheDocument();
  });

  it("renders the CTA button with correct text", () => {
    render(<HeroSection />);
    const cta = screen.getByRole("button", { name: /get your match score/i });
    expect(cta).toBeInTheDocument();
  });

  it("opens auth modal in signup mode when CTA is clicked", async () => {
    const user = userEvent.setup();
    render(<HeroSection />);

    const cta = screen.getByRole("button", { name: /get your match score/i });
    await user.click(cta);

    const modal = screen.getByTestId("auth-modal");
    expect(modal).toBeInTheDocument();
    expect(modal).toHaveAttribute("data-mode", "signup");
  });

  it("does not render a search bar", () => {
    render(<HeroSection />);
    // Search input should not exist — it moved to the navbar
    expect(screen.queryByPlaceholderText(/search by beach/i)).not.toBeInTheDocument();
  });
});
