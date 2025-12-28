import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { AuthAwareLandingWrapper } from "@/components/landing-page/auth-aware-landing-wrapper";
import { useAuth } from "@/context/auth-context";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

jest.mock("next/navigation", () => ({
  useRouter: jest.fn(),
  useSearchParams: jest.fn(),
}));

jest.mock("@/context/auth-context", () => ({
  useAuth: jest.fn(),
}));

jest.mock("@/lib/isStandaloneApp", () => ({
  isStandaloneApp: jest.fn(() => false),
}));

jest.mock("@/lib/utils/performance-utils", () => ({
  PerformanceUtils: {
    trackWebVitals: jest.fn(() => undefined),
    preloadCriticalResources: jest.fn(() => undefined),
    monitorMemoryUsage: jest.fn(() => undefined),
  },
}));

jest.mock("sonner", () => ({
  toast: {
    success: jest.fn(),
  },
}));

// Keep the wrapper test focused: mock the heavy landing sections.
jest.mock("@/components/home-screen", () => ({
  HomeScreen: () => <div data-testid="home-screen" />,
}));
jest.mock("@/components/landing-page/navbar", () => ({
  Navbar: () => <div data-testid="navbar" />,
}));
jest.mock("@/components/landing-page/hero-section", () => ({
  HeroSection: () => <div data-testid="hero-section" />,
}));
jest.mock("@/components/landing-page/surf-highlights-section", () => ({
  SurfHighlightsSection: () => <div data-testid="surf-highlights" />,
}));
jest.mock("@/components/landing-page/upgrade-session-section", () => ({
  UpgradeSessionSection: () => <div data-testid="upgrade-session" />,
}));
jest.mock("@/components/landing-page/activities-section", () => ({
  ActivitiesSection: () => <div data-testid="activities" />,
}));
jest.mock("@/components/landing-page/forecast-section", () => ({
  ForecastSection: () => <div data-testid="forecast" />,
}));
jest.mock("@/components/landing-page/cta-section", () => ({
  CTASection: () => <div data-testid="cta" />,
}));

describe("AuthAwareLandingWrapper post-signup confirm email", () => {
  const replace = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue({ replace });
  });

  it("bypasses auth loading screen, shows toast, and cleans URL when signup=confirm-email", async () => {
    (useAuth as jest.Mock).mockReturnValue({ user: null, isLoading: true });
    (useSearchParams as jest.Mock).mockReturnValue(
      new URLSearchParams("?signup=confirm-email")
    );

    render(<AuthAwareLandingWrapper />);

    // Should not show the global auth loader text for this case.
    expect(
      screen.queryByText(/checking authentication/i)
    ).not.toBeInTheDocument();

    // Should render unauth landing sections even while auth is initializing.
    expect(screen.getByTestId("navbar")).toBeInTheDocument();
    expect(screen.getByTestId("hero-section")).toBeInTheDocument();

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith(
        "Confirm your signup in your email",
        expect.objectContaining({
          description: expect.stringMatching(/confirmation link/i),
        })
      );
    });

    expect(replace).toHaveBeenCalledWith("/");
  });
});


