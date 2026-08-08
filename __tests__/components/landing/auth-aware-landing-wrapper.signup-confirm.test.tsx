import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { AuthAwareLandingWrapper } from "@/components/landing-page/auth-aware-landing-wrapper";
import { useAuth } from "@/context/auth-context";
import { useRouter, useSearchParams } from "next/navigation";

jest.mock("next/navigation", () => ({
  useRouter: jest.fn(),
  useSearchParams: jest.fn(),
  usePathname: jest.fn(() => "/"),
}));

jest.mock("@/context/auth-context", () => ({
  useAuth: jest.fn(),
}));

jest.mock("@/lib/utils/performance-utils", () => ({
  PerformanceUtils: {
    trackWebVitals: jest.fn(() => undefined),
    preloadCriticalResources: jest.fn(() => undefined),
    monitorMemoryUsage: jest.fn(() => undefined),
  },
}));

// Keep the wrapper test focused: mock the heavy landing sections.
jest.mock("@/components/oracle/oracle-home-screen", () => ({
  OracleHomeScreen: () => <div data-testid="home-screen" />,
}));
jest.mock("@/components/landing-page/hero-section", () => ({
  HeroSection: ({
    initialPlatform,
    appFirst,
  }: {
    initialPlatform?: string;
    appFirst?: boolean;
  }) => (
    <div
      data-testid="hero-section"
      data-platform={initialPlatform}
      data-app-first={String(appFirst)}
    />
  ),
}));
jest.mock(
  "@/components/landing-page/field-guide/quiver-field-guide-landing",
  () => ({
    QuiverFieldGuideLanding: ({
      platform,
      appFirst,
    }: {
      platform?: string;
      appFirst?: boolean;
    }) => (
      <div
        data-testid="quiver-field-guide-landing"
        data-platform={platform}
        data-app-first={String(appFirst)}
      />
    ),
  }),
);
jest.mock("@/components/landing-page/navbar", () => ({
  Navbar: ({ position }: { position?: string }) => (
    <nav data-position={position} data-testid="landing-navbar" />
  ),
}));
jest.mock("@/components/landing-page/surf-highlights-section", () => ({
  SurfHighlightsSection: () => <div data-testid="surf-highlights" />,
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
jest.mock("@/components/landing-page/landing-interactive-sections", () => ({
  LandingInteractiveSections: ({
    initialPlatform,
    appFirst,
  }: {
    initialPlatform?: string;
    appFirst?: boolean;
  }) => (
    <div
      data-testid="landing-interactive-sections"
      data-platform={initialPlatform}
      data-app-first={String(appFirst)}
    />
  ),
}));
jest.mock("@/components/landing-page/landing-conditions-ticker", () => ({
  LandingConditionsTicker: () => <div data-testid="landing-conditions-ticker" />,
}));

describe("AuthAwareLandingWrapper post-signup confirm email", () => {
  const replace = jest.fn();
  // eslint-disable-next-line no-restricted-properties -- test needs to mock window.location
  const originalLocation = window.location;

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue({ replace });
    // Default: no query params
    (useSearchParams as jest.Mock).mockReturnValue(new URLSearchParams());
    // Reset mock location before each test
    delete (window as any).location;
    (window as any).location = { ...originalLocation, href: "http://localhost/" };
  });

  afterEach(() => {
    // Restore original location
    (window as any).location = originalLocation;
  });

  it("bypasses auth loading screen, shows modal, and cleans URL when signup=confirm-email", async () => {
    (useAuth as jest.Mock).mockReturnValue({ user: null, isLoading: true });
    // The component uses useSearchParams() to reactively detect URL changes
    const mockSearchParams = new URLSearchParams("?signup=confirm-email");
    (useSearchParams as jest.Mock).mockReturnValue(mockSearchParams);

    render(<AuthAwareLandingWrapper />);

    // Should not show the global auth loader text for this case.
    expect(
      screen.queryByText(/checking authentication/i)
    ).not.toBeInTheDocument();

    // Should render unauth landing sections even while auth is initializing.
    expect(screen.getByTestId("landing-navbar")).toHaveAttribute(
      "data-position",
      "static"
    );
    expect(screen.getByTestId("quiver-field-guide-landing")).toBeInTheDocument();

    // Should show the email confirmation modal
    await waitFor(() => {
      expect(screen.getByText("Check your email")).toBeInTheDocument();
    });
    expect(screen.getByText(/confirmation link/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Got it" })).toBeInTheDocument();

    // Click "Got it" to dismiss modal and clean URL
    fireEvent.click(screen.getByRole("button", { name: "Got it" }));
    expect(replace).toHaveBeenCalledWith("/");
  });

  it("shows modal when signup param is added via soft navigation after mount", async () => {
    (useAuth as jest.Mock).mockReturnValue({ user: null, isLoading: false });

    // Start with no query params
    const initialParams = new URLSearchParams();
    (useSearchParams as jest.Mock).mockReturnValue(initialParams);

    const { rerender } = render(<AuthAwareLandingWrapper />);

    // Modal should not be visible yet
    expect(screen.queryByText("Check your email")).not.toBeInTheDocument();

    // Simulate soft navigation adding query param (like after modal signup)
    const updatedParams = new URLSearchParams("?signup=confirm-email");
    (useSearchParams as jest.Mock).mockReturnValue(updatedParams);
    rerender(<AuthAwareLandingWrapper />);

    await waitFor(() => {
      expect(screen.getByText("Check your email")).toBeInTheDocument();
    });
  });

  it("shows modal only once on component re-render", async () => {
    (useAuth as jest.Mock).mockReturnValue({ user: null, isLoading: false });
    const mockSearchParams = new URLSearchParams("?signup=confirm-email");
    (useSearchParams as jest.Mock).mockReturnValue(mockSearchParams);

    const { rerender } = render(<AuthAwareLandingWrapper />);

    await waitFor(() => {
      expect(screen.getByText("Check your email")).toBeInTheDocument();
    });

    // Re-render the component (simulating state change or parent re-render)
    rerender(<AuthAwareLandingWrapper />);

    // Modal should still be visible (only one instance)
    expect(screen.getByText("Check your email")).toBeInTheDocument();
    expect(screen.getAllByText("Check your email")).toHaveLength(1);
  });

  it("preserves other query parameters when cleaning signup param", async () => {
    (useAuth as jest.Mock).mockReturnValue({ user: null, isLoading: false });
    const mockSearchParams = new URLSearchParams(
      "?signup=confirm-email&utm_source=email&utm_campaign=welcome&ref=twitter"
    );
    (useSearchParams as jest.Mock).mockReturnValue(mockSearchParams);

    render(<AuthAwareLandingWrapper />);

    await waitFor(() => {
      expect(screen.getByText("Check your email")).toBeInTheDocument();
    });

    // Click "Got it" to dismiss and trigger URL cleanup
    fireEvent.click(screen.getByRole("button", { name: "Got it" }));

    // URL should preserve UTM params but remove signup param
    expect(replace).toHaveBeenCalledWith(
      expect.stringContaining("utm_source=email")
    );
    expect(replace).toHaveBeenCalledWith(
      expect.stringContaining("utm_campaign=welcome")
    );
    expect(replace).toHaveBeenCalledWith(
      expect.stringContaining("ref=twitter")
    );
    expect(replace).toHaveBeenCalledWith(
      expect.not.stringContaining("signup=confirm-email")
    );
  });

  it("shows modal before redirecting in PWA standalone mode", async () => {
    (useAuth as jest.Mock).mockReturnValue({ user: null, isLoading: false });
    const mockSearchParams = new URLSearchParams("?signup=confirm-email");
    (useSearchParams as jest.Mock).mockReturnValue(mockSearchParams);

    render(<AuthAwareLandingWrapper />);

    // Should show modal (not redirect to /auth/sign-in because signup confirmation takes priority)
    await waitFor(() => {
      expect(screen.getByText("Check your email")).toBeInTheDocument();
    });

    // URL should NOT be cleaned yet (modal is still open)
    expect(replace).not.toHaveBeenCalledWith("/auth/sign-in");

    // Click "Got it" to dismiss modal and clean URL
    fireEvent.click(screen.getByRole("button", { name: "Got it" }));
    expect(replace).toHaveBeenCalledWith("/");
  });

  it("handles auth state change while showing signup confirmation modal", async () => {
    const mockSearchParams = new URLSearchParams("?signup=confirm-email");
    (useSearchParams as jest.Mock).mockReturnValue(mockSearchParams);
    (useAuth as jest.Mock).mockReturnValue({ user: null, isLoading: true });

    const { rerender } = render(<AuthAwareLandingWrapper />);

    await waitFor(() => {
      expect(screen.getByText("Check your email")).toBeInTheDocument();
    });

    // Simulate auth completing and user becoming authenticated
    const mockUser = { id: "123", email: "test@example.com" };
    (useAuth as jest.Mock).mockReturnValue({ user: mockUser, isLoading: false });
    rerender(<AuthAwareLandingWrapper />);

    // Should transition to HomeScreen (wait for dynamic import to resolve)
    await waitFor(() => {
      expect(screen.getByTestId("home-screen")).toBeInTheDocument();
    });
  });

  // --- Regression Tests ---

  it("renders landing page without modal when no signup param is present", () => {
    (useAuth as jest.Mock).mockReturnValue({ user: null, isLoading: false });
    (useSearchParams as jest.Mock).mockReturnValue(new URLSearchParams());

    render(<AuthAwareLandingWrapper />);

    // Should render landing page
    expect(screen.getByTestId("landing-navbar")).toBeInTheDocument();
    expect(screen.getByTestId("quiver-field-guide-landing")).toBeInTheDocument();

    // Should NOT show modal
    expect(screen.queryByText("Check your email")).not.toBeInTheDocument();

    // Should NOT call replace (no URL cleanup needed)
    expect(replace).not.toHaveBeenCalled();
  });

  it("threads app-first platform props to the guest field guide", () => {
    (useAuth as jest.Mock).mockReturnValue({ user: null, isLoading: false });
    (useSearchParams as jest.Mock).mockReturnValue(new URLSearchParams());

    // Platform is resolved from the client's own user agent after mount —
    // reading it from the request server-side forced the whole route to render
    // dynamically. `initialPlatform` is only the pre-hydration default now, so
    // the browser's UA is the value that must reach the field guide.
    const realUa = window.navigator.userAgent;
    Object.defineProperty(window.navigator, "userAgent", {
      value:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1",
      configurable: true,
    });

    try {
      render(<AuthAwareLandingWrapper appFirst />);

      expect(screen.getByTestId("quiver-field-guide-landing")).toHaveAttribute(
        "data-platform",
        "ios",
      );
    } finally {
      Object.defineProperty(window.navigator, "userAgent", {
        value: realUa,
        configurable: true,
      });
    }
    expect(screen.getByTestId("quiver-field-guide-landing")).toHaveAttribute(
      "data-app-first",
      "true",
    );
  });

  it("renders HomeScreen immediately for authenticated users", async () => {
    const mockUser = { id: "123", email: "test@example.com" };
    (useAuth as jest.Mock).mockReturnValue({ user: mockUser, isLoading: false });
    (useSearchParams as jest.Mock).mockReturnValue(new URLSearchParams());

    render(<AuthAwareLandingWrapper />);

    // Should render HomeScreen
    await waitFor(() => {
      expect(screen.getByTestId("home-screen")).toBeInTheDocument();
    });

    // Should NOT show landing page elements
    expect(screen.queryByTestId("landing-navbar")).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("quiver-field-guide-landing"),
    ).not.toBeInTheDocument();

    // Should NOT show modal
    expect(screen.queryByText("Check your email")).not.toBeInTheDocument();
  });

  it("renders landing page in PWA mode when unauthenticated (no forced redirect)", () => {
    (useAuth as jest.Mock).mockReturnValue({ user: null, isLoading: false });
    (useSearchParams as jest.Mock).mockReturnValue(new URLSearchParams());

    render(<AuthAwareLandingWrapper />);

    // Should render landing page, not redirect to sign-in
    expect(screen.getByTestId("landing-navbar")).toBeInTheDocument();
    expect(screen.getByTestId("quiver-field-guide-landing")).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();

    // Should NOT show modal
    expect(screen.queryByText("Check your email")).not.toBeInTheDocument();
  });

  // --- Edge Case Tests ---

  it("does not show modal for invalid signup param values", () => {
    (useAuth as jest.Mock).mockReturnValue({ user: null, isLoading: false });
    // Use a different value than "confirm-email"
    const mockSearchParams = new URLSearchParams("?signup=invalid-value");
    (useSearchParams as jest.Mock).mockReturnValue(mockSearchParams);

    render(<AuthAwareLandingWrapper />);

    // Should render landing page
    expect(screen.getByTestId("landing-navbar")).toBeInTheDocument();

    // Should NOT show modal
    expect(screen.queryByText("Check your email")).not.toBeInTheDocument();

    // Should NOT clean URL
    expect(replace).not.toHaveBeenCalled();
  });

  it("shows modal even when auth resolves quickly (no loading state)", async () => {
    // Auth already resolved (isLoading: false) but signup param present
    (useAuth as jest.Mock).mockReturnValue({ user: null, isLoading: false });
    const mockSearchParams = new URLSearchParams("?signup=confirm-email");
    (useSearchParams as jest.Mock).mockReturnValue(mockSearchParams);

    render(<AuthAwareLandingWrapper />);

    // Should still show modal even though auth resolved immediately
    await waitFor(() => {
      expect(screen.getByText("Check your email")).toBeInTheDocument();
    });
    expect(screen.getByText(/confirmation link/i)).toBeInTheDocument();

    // Click "Got it" to clean URL
    fireEvent.click(screen.getByRole("button", { name: "Got it" }));
    expect(replace).toHaveBeenCalledWith("/");
  });
});
