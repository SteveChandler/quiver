import React from "react";
import { act, render, screen } from "@testing-library/react";
import { HomeScreen } from "@/components/home-screen";
import { useGeolocation } from "@/hooks/use-geolocation";
import { useSurfDiscovery } from "@/hooks/use-surf-discovery";
import { useTimeSlotPrefetch } from "@/hooks/use-time-slot-prefetch";

const mockRouterReplace = jest.fn();
const mockRouterPush = jest.fn();
let mockSurfDiscoveryResult: {
  discovery: Record<string, unknown> | null;
  loading: boolean;
  error: string | null;
} = {
  discovery: { recommendations: [] },
  loading: false,
  error: null,
};

type HomeDiscoveryWindow = Window & {
  __quiverHomeDiscoveryRequestCount?: number;
};

type PerformanceWithOptionalMark = Omit<Performance, "mark"> & {
  mark?: Performance["mark"];
};

function getHomeDiscoveryWindow(): HomeDiscoveryWindow {
  return window as HomeDiscoveryWindow;
}

jest.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({
    push: mockRouterPush,
    replace: mockRouterReplace,
  }),
  useSearchParams: () => new URLSearchParams(),
}));

jest.mock("next/dynamic", () => {
  return function dynamicMock() {
    return function DynamicComponentMock() {
      return <div data-testid="dynamic-section" />;
    };
  };
});

jest.mock("framer-motion", () => ({
  motion: {
    div: ({
      children,
      initial: _initial,
      animate: _animate,
      variants: _variants,
      ...props
    }: React.HTMLAttributes<HTMLDivElement> & {
      initial?: unknown;
      animate?: unknown;
      variants?: unknown;
    }) => (
      <div {...props}>{children}</div>
    ),
    section: ({
      children,
      variants: _variants,
      ...props
    }: React.HTMLAttributes<HTMLElement> & { variants?: unknown }) => (
      <section {...props}>{children}</section>
    ),
  },
}));

jest.mock("@/context/auth-context", () => ({
  useAuth: () => ({ user: { id: "user-1" } }),
}));

jest.mock("@/hooks/use-cached-profile", () => ({
  useCachedProfile: () => ({
    profile: {
      id: "profile-1",
      full_name: "Steven",
      notif_forecast_alerts: false,
    },
    homeBeach: {
      id: "beach-1",
      name: "Blacks Beach",
      city: "San Diego",
      lat: 32.88,
      lon: -117.25,
    },
    refreshProfile: jest.fn(),
  }),
}));

jest.mock("@/hooks/use-geolocation", () => ({
  useGeolocation: jest.fn(() => ({
    coords: null,
    loading: false,
    error: null,
    requestLocation: jest.fn(),
    source: "default",
    usingDefaultLocation: true,
  })),
}));

jest.mock("@/context/location-context", () => ({
  useLocationSafe: () => null,
}));

jest.mock("@/hooks/use-surf-discovery", () => ({
  useSurfDiscovery: jest.fn(() => mockSurfDiscoveryResult),
}));

jest.mock("@/hooks/use-time-slot-prefetch", () => ({
  useTimeSlotPrefetch: jest.fn(),
}));

jest.mock("@/hooks/use-data-fetcher", () => ({
  useDataFetcher: jest.fn(() => ({
    data: null,
    loading: false,
    error: null,
    refetch: jest.fn(),
  })),
}));

jest.mock("@/hooks/use-reminder-handler", () => ({
  useReminderHandler: () => ({
    enableReminder: jest.fn(async () => ({ success: true })),
  }),
}));

jest.mock("@/hooks/use-reduced-motion", () => ({
  useReducedMotion: () => true,
}));

jest.mock("@/hooks/use-track-event", () => ({
  useTrackEvent: () => ({ track: jest.fn() }),
}));

jest.mock("@/lib/analytics", () => ({
  track: jest.fn(),
}));

jest.mock("sonner", () => ({
  toast: { error: jest.fn() },
}));

jest.mock("@/actions/dashboard-actions", () => ({
  getProfileStrength: jest.fn(),
}));

jest.mock("@/actions/personalization-actions", () => ({
  getPersonalizationStatus: jest.fn(),
}));

jest.mock("@/lib/gamification/gamification-actions", () => ({
  getUserXPStatus: jest.fn(),
}));

jest.mock("@/hooks/use-personalization-milestones", () => ({
  usePersonalizationMilestones: jest.fn(),
}));

jest.mock("@/components/home-screen/greeting-section", () => ({
  GreetingSection: () => <div data-testid="greeting-section" />,
}));

jest.mock("@/components/home-screen/use-time-of-day", () => ({
  useTimeOfDay: () => ({ timeOfDay: "morning" }),
}));

jest.mock("@/components/home-screen/hero-recommendation", () => ({
  HeroRecommendation: ({ recommendation }: { recommendation: { beach: { name: string } } | null }) => (
    <div data-testid="hero-recommendation">
      {recommendation?.beach.name ?? "No recommendation"}
    </div>
  ),
}));

jest.mock("@/components/home-screen/primary-actions", () => ({
  PrimaryActions: () => <div data-testid="primary-actions" />,
}));

jest.mock("@/lib/share/share-data-builder", () => ({
  buildSurfCallShareData: jest.fn(() => ({
    imageUrl: "https://example.com/share.png",
    beachName: "Stale Positive Beach",
    title: "Go surf",
    text: "Best window now",
  })),
}));

jest.mock("@/lib/utils/beach-url-utils", () => ({
  buildBeachUrlWithTab: jest.fn(() => "/beach/test?tab=forecast"),
}));

jest.mock("@/lib/data/forecast-regions", () => ({
  getForecastRegionForCity: jest.fn(() => "san-diego"),
}));

jest.mock("@/components/home-screen/top-spots-carousel", () => ({
  TopSpotsCarousel: ({ spots }: { spots: Array<{ beach: { name: string } }> }) => (
    <div data-testid="top-spots-carousel">
      {spots.map((spot) => spot.beach.name).join(",")}
    </div>
  ),
}));

jest.mock("@/components/home-screen/time-slot-selector", () => ({
  TimeSlotSelector: () => <div data-testid="time-slot-selector" />,
}));

jest.mock("@/components/home-screen/bottom-nav", () => ({
  BottomNav: () => <nav data-testid="bottom-nav" />,
}));

jest.mock("@/components/home-screen/forecast-outlook-card", () => ({
  ForecastOutlookCard: () => <div data-testid="forecast-outlook-card" />,
}));

jest.mock("@/components/home-screen/home-conditions-ticker", () => ({
  HomeConditionsTicker: () => <div data-testid="home-conditions-ticker" />,
}));

jest.mock("@/components/home-screen/session-intelligence-module", () => ({
  SessionIntelligenceModule: ({
    recommendations,
    recommendationAvailability,
  }: {
    recommendations: unknown[];
    recommendationAvailability?: { state: string };
  }) => (
    <div
      data-testid="session-intelligence-module"
      data-recommendation-count={recommendations.length}
      data-availability={recommendationAvailability?.state ?? "absent"}
    />
  ),
}));

jest.mock("@/components/home-screen/first-session-cta", () => ({
  buildQuickLogUrl: jest.fn(() => "/sessions/new?mode=log&quick=true"),
}));

describe("HomeScreen discovery request instrumentation", () => {
  const markMock = jest.fn();
  const originalPerformanceMark = (performance as PerformanceWithOptionalMark)
    .mark;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSurfDiscoveryResult = {
      discovery: { recommendations: [] },
      loading: false,
      error: null,
    };
    delete getHomeDiscoveryWindow().__quiverHomeDiscoveryRequestCount;
    Object.defineProperty(performance, "mark", {
      configurable: true,
      value: markMock,
    });
  });

  afterEach(() => {
    Object.defineProperty(performance, "mark", {
      configurable: true,
      value: originalPerformanceMark,
    });
  });

  it("avoids mount GPS and counts the primary discovery request", () => {
    render(<HomeScreen />);

    expect(useGeolocation).toHaveBeenCalledWith(
      expect.objectContaining({
        autoRequest: false,
        enablePolling: true,
        pollingIntervalMs: 5 * 60 * 1000,
        minDistanceChangeMeters: 1000,
        monitoringContext: "home",
      }),
    );

    const discoveryOptions = (useSurfDiscovery as jest.Mock).mock.calls[0][0];

    act(() => {
      discoveryOptions.onRequest();
    });

    expect(getHomeDiscoveryWindow().__quiverHomeDiscoveryRequestCount).toBe(1);
    expect(markMock).toHaveBeenCalledWith(
      "quiver:home:discovery-request:1:primary",
    );
  });

  it("lets explicit none win before hero, top spots, share, actions, and local window rebuilding", () => {
    const stalePositive = {
      beach: {
        id: "stale-beach",
        name: "Stale Positive Beach",
        slug: "stale-positive",
        city: "San Diego",
        state: "CA",
        photo_url: "https://example.com/stale.jpg",
      },
      window: {
        start: new Date("2026-07-20T16:00:00.000Z"),
        end: new Date("2026-07-20T18:00:00.000Z"),
        timezone: "America/Los_Angeles",
      },
      score: 92,
    };
    mockSurfDiscoveryResult = {
      discovery: {
        recommendations: [stalePositive],
        recommendationAvailability: {
          state: "none",
          reasonCode: "major_event_hold",
          holdEpoch: "hold-1:1",
        },
      },
      loading: false,
      error: null,
    };

    const { buildSurfCallShareData } = jest.requireMock(
      "@/lib/share/share-data-builder",
    ) as { buildSurfCallShareData: jest.Mock };
    const { useTimeSlotPrefetch } = jest.requireMock(
      "@/hooks/use-time-slot-prefetch",
    ) as { useTimeSlotPrefetch: jest.Mock };

    render(<HomeScreen />);

    expect(screen.queryByTestId("hero-recommendation")).not.toBeInTheDocument();
    expect(screen.queryByTestId("time-slot-selector")).not.toBeInTheDocument();
    expect(screen.queryByTestId("top-spots-carousel")).not.toBeInTheDocument();
    expect(screen.queryByTestId("primary-actions")).not.toBeInTheDocument();
    expect(screen.queryByTestId("fallback-actions")).not.toBeInTheDocument();
    expect(buildSurfCallShareData).not.toHaveBeenCalled();
    expect(screen.getByTestId("recommendation-unavailable-state")).toHaveTextContent(
      "Session picks aren't available right now."
    );

    const sessionIntelligence = screen.getByTestId("session-intelligence-module");
    expect(sessionIntelligence).toHaveAttribute("data-recommendation-count", "0");
    expect(sessionIntelligence).toHaveAttribute("data-availability", "none");
    expect(useTimeSlotPrefetch).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: false }),
    );

    expect(screen.getByTestId("home-conditions-ticker")).toBeInTheDocument();
    expect(screen.getByTestId("forecast-outlook-card")).toBeInTheDocument();
    expect(screen.queryByText(/low confidence|confidence/i)).not.toBeInTheDocument();
  });
});
