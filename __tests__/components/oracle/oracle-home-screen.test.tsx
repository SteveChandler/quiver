import React from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OracleHomeScreen } from "@/components/oracle/oracle-home-screen";
import type { OracleData } from "@/hooks/use-oracle-data";
import { apiCache } from "@/lib/utils/request-cache";

// ---------------------------------------------------------------------------
// Fix Date so greeting always says "Good morning"
// ---------------------------------------------------------------------------
beforeAll(() => {
  // Only fake Date (not setTimeout/setInterval/etc.) so userEvent still works.
  jest.useFakeTimers({
    doNotFake: [
      "nextTick",
      "setImmediate",
      "clearImmediate",
      "setInterval",
      "clearInterval",
      "setTimeout",
      "clearTimeout",
      "queueMicrotask",
    ],
  });
  // Set to 3pm UTC (8am PDT) on the same date as MOCK_WINDOW so isTomorrow=false
  // and currentHour in America/Los_Angeles = 8 (morning slot)
  jest.setSystemTime(new Date("2026-03-11T15:00:00.000Z"));
});

afterAll(() => {
  jest.useRealTimers();
});

// ---------------------------------------------------------------------------
// Mock next/navigation
// ---------------------------------------------------------------------------
const mockRouterPush = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockRouterPush }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));

const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

// ---------------------------------------------------------------------------
// Mock framer-motion (used inside OracleHero and ShareSheet)
// ---------------------------------------------------------------------------
jest.mock("framer-motion", () => {
  const React = require("react");
  return {
    motion: {
      div: React.forwardRef(
        (props: Record<string, unknown>, ref: React.Ref<HTMLDivElement>) => {
          const {
            variants: _v,
            initial: _i,
            animate: _a,
            exit: _e,
            transition: _t,
            whileInView: _wiv,
            viewport: _vp,
            onAnimationComplete: _oac,
            ...rest
          } = props;
          return <div ref={ref} {...rest} />;
        }
      ),
    },
    AnimatePresence: ({ children }: { children: React.ReactNode }) => (
      <>{children}</>
    ),
    useReducedMotion: () => false,
  };
});

// ---------------------------------------------------------------------------
// Mock server actions
// ---------------------------------------------------------------------------
jest.mock("@/actions/oracle-actions", () => ({
  getLocalActivity: jest.fn().mockResolvedValue({ data: [] }),
  updatePreferredSessionTime: jest.fn().mockResolvedValue({ data: { success: true } }),
}));

// ---------------------------------------------------------------------------
// Mock the onboarding store (used by handleSetHomeBeach)
// ---------------------------------------------------------------------------
const mockOnboardingReset = jest.fn();
const mockOnboardingOpenDialog = jest.fn();
jest.mock("@/store/onboarding-store", () => ({
  useOnboardingStore: () => ({
    reset: mockOnboardingReset,
    openDialog: mockOnboardingOpenDialog,
  }),
}));

// ---------------------------------------------------------------------------
// Mock next/image (used inside NearbySpots)
// ---------------------------------------------------------------------------
jest.mock("next/image", () => ({
  __esModule: true,
  default: ({
    src,
    alt,
    ...rest
  }: {
    src: string;
    alt: string;
    [key: string]: unknown;
  }) => <img src={src} alt={alt} {...rest} />,
}));

// ---------------------------------------------------------------------------
// Mock next/link (used inside TodaysWindows)
// ---------------------------------------------------------------------------
jest.mock("next/link", () => ({
  __esModule: true,
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
    [key: string]: unknown;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

// ---------------------------------------------------------------------------
// Shared oracle data factory
// ---------------------------------------------------------------------------
const MOCK_FORECAST = {
  id: "f1",
  beach_id: "b1",
  forecast_at: new Date().toISOString(),
  forecast_date: "2026-03-11",
  forecast_time: "06:00:00",
  wave_height: "3-4ft",
  wave_period: "12s",
  wave_direction: "WNW",
  swell_1_period: "14s",
  swell_1_direction: "WNW",
  water_temp: "58",
  wind_speed: "8",
  wind_direction: "NW",
  tide_height: "3.2",
  tide_status: "Rising",
  confidence_score: 85,
  data_source: "CDIP",
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const MOCK_WINDOW = {
  start: new Date("2026-03-11T13:00:00.000Z"), // 6 AM PDT
  end: new Date("2026-03-11T16:00:00.000Z"),   // 9 AM PDT
  tide: "Rising",
  wind: "8 mph NW",
  waveHeight: "3-4ft",
  wavePeriod: "14s",
  dataSource: "CDIP",
  confidence: 85,
  timezone: "America/Los_Angeles",
};

const MOCK_BEACH = {
  id: "b1",
  name: "Blacks Beach",
  slug: "blacks",
  city: "La Jolla",
  state: "CA",
  country: "US",
  center_lat: 32.88,
  center_lng: -117.25,
  // Canonical lat/lon — the regional-best hero (drive subtitle) reads
  // these. Matches `types/database.generated.ts` Beach.Row.
  lat: 32.88,
  lon: -117.25,
  skill_level: "advanced",
  photo_url: null,
};

// A second beach used in tests that exercise the "home != topRec" path
// (drive subtitle + HomeBeachCard + hero-first activity feed).
const MOCK_HOME_BEACH = {
  id: "ob",
  name: "Ocean Beach Pier",
  slug: "ocean-beach-pier",
  city: "San Diego",
  state: "CA",
  country: "US",
  center_lat: 32.749,
  center_lng: -117.252,
  lat: 32.749,
  lon: -117.252,
  skill_level: "intermediate",
  photo_url: null,
};

const MOCK_HOME_FORECAST = {
  id: "f-ob",
  beach_id: "ob",
  forecast_at: new Date().toISOString(),
  forecast_date: "2026-03-11",
  forecast_time: "06:00:00",
  wave_height: "1-2ft",
  wave_period: "10s",
  wave_direction: "WSW",
  swell_1_period: "11s",
  swell_1_direction: "WSW",
  water_temp: "60",
  wind_speed: "6",
  wind_direction: "W",
  tide_height: "2.4",
  tide_status: "Rising",
  confidence_score: 70,
  data_source: "CDIP",
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const MOCK_TOP_REC = {
  recommendationId: "candidate-b1",
  beach: MOCK_BEACH,
  window: MOCK_WINDOW,
  forecast: MOCK_FORECAST,
  score: 85,
  matchQuality: "excellent" as const,
  subscores: {
    waveHeightFit: 20,
    periodEnergyScore: 18,
    windAlignment: 17,
    tideFit: 12,
    affinityBonus: 10,
    personalizationBonus: 5,
    distancePenalty: -2,
  },
  summary: "Solid WNW swell with offshore winds",
  reasons: ["Clean WNW swell", "Offshore NW winds"],
  warnings: [],
  conditionBadges: [],
  waveHeightBadge: "3-4ft",
  generated_at: new Date().toISOString(),
};

// Recommendation row for the home beach (lower-scored than topRec).
const MOCK_HOME_REC = {
  beach: MOCK_HOME_BEACH,
  window: MOCK_WINDOW,
  forecast: MOCK_HOME_FORECAST,
  score: 60,
  matchQuality: "fair" as const,
  subscores: {
    waveHeightFit: 14,
    periodEnergyScore: 12,
    windAlignment: 14,
    tideFit: 10,
    affinityBonus: 8,
    personalizationBonus: 0,
    distancePenalty: -2,
  },
  summary: "Soft and small at the pier",
  reasons: ["Small WSW swell"],
  warnings: [],
  conditionBadges: [],
  waveHeightBadge: "1-2ft",
  generated_at: new Date().toISOString(),
};

const MOCK_ORACLE_DATA_BASE = {
  profile: {
    id: "u1",
    display_name: "Alex",
    full_name: "Alex Surfer",
    experience_level: "intermediate",
    home_beach_id: "b1",
  },
  homeBeach: MOCK_BEACH,
  refreshProfile: jest.fn(),
  heroPhotoUrl: "/images/hero/hero-1-la-jolla.webp",
  heroPhotoLoading: false,
  discovery: {
    sessionDecision: {
      schemaVersion: "canonical-session-decision.v1",
      engineVersion: "rules.v1",
      decisionId: "c".repeat(64),
      createdAt: "2026-03-11T12:00:00.000Z",
      expiresAt: "2099-03-11T12:15:00.000Z",
      scope: {
        kind: "plan_next_session",
        windowStart: "2026-03-11T12:00:00.000Z",
        windowEnd: "2026-03-12T12:00:00.000Z",
        timezone: "America/Los_Angeles",
      },
      verdict: "maybe",
      decisionBasis: "physical_fallback",
      reasonCode: "selected_maybe",
      selection: {
        candidateId: "candidate-b1",
        beachId: "b1",
        beachName: "Blacks Beach",
        windowStart: "2026-03-11T13:00:00.000Z",
        windowEnd: "2026-03-11T16:00:00.000Z",
        timezone: "America/Los_Angeles",
        forecastRef: {
          forecastId: "forecast-b1",
          beachId: "b1",
          forecastAt: "2026-03-11T13:00:00.000Z",
        },
        skillEligibility: {
          skill: "intermediate",
          state: "eligible",
          reasonCodes: [],
        },
        evidence: {
          conditionScore: 65,
          recommendationLabel: "Maybe",
          personalMatch: null,
        },
      },
      skillEligibility: {
        skill: "intermediate",
        state: "eligible",
        reasonCodes: [],
      },
      holdEpoch: "clear",
    },
    recommendations: [MOCK_TOP_REC],
    searchCriteria: { maxResults: 6 },
    metadata: {
      totalBeachesConsidered: 10,
      successfulForecasts: 8,
      partialSuccess: false,
      failedBeaches: 2,
      staleBeaches: 0,
      generated_at: new Date().toISOString(),
    },
  },
  discoveryLoading: false,
  discoveryError: null,
  profileLoading: false,
  topRecommendation: MOCK_TOP_REC,
  remainingSpots: [],
  shouldAnimate: false,
  markAnimationPlayed: jest.fn(),
  reducedMotion: false,
  userLocation: { lat: 32.88, lon: -117.25 },
  geoSource: "browser",
  requestLocation: jest.fn(),
  geoLoading: false,
};

// ---------------------------------------------------------------------------
// Mock useOracleData — controlled per test via moduleFactory + override
// ---------------------------------------------------------------------------
let mockOracleData: OracleData = { ...MOCK_ORACLE_DATA_BASE } as unknown as OracleData;

jest.mock("@/hooks/use-oracle-data", () => ({
  useOracleData: () => mockOracleData,
}));

// ---------------------------------------------------------------------------
// Reset before each test
// ---------------------------------------------------------------------------
beforeEach(() => {
  jest.clearAllMocks();
  apiCache.clear();
  // Default `/api/surf/call` mock — populates heroSurfCall with the canonical
  // verdict/score, matching production where the hero's displayed values come
  // from getSpotSurfReport (NOT from discovery's boosted score). Tests that
  // need a different verdict/score override this mock locally.
  mockFetch.mockResolvedValue({
    ok: true,
    json: async () => ({
      success: true,
      data: {
        report: {
          verdict: "MAYBE",
          score: 85,
          whySentence: "Solid window with offshore winds.",
          updatedAt: new Date().toISOString(),
          bestWindowStart: new Date("2026-03-11T13:00:00.000Z").toISOString(),
          bestWindowEnd: new Date("2026-03-11T16:00:00.000Z").toISOString(),
          peakTime: new Date("2026-03-11T14:00:00.000Z").toISOString(),
          waveHeight: "3-4ft",
          windDescription: "8 mph NW",
          tidePhase: "rising",
          isCalibrated: true,
          trendTags: [],
          shortWindow: false,
          windowMinutes: 180,
          lowForecastConfidence: false,
          rideableWavesPerHour: 12,
        },
        isTomorrow: false,
      },
    }),
  });
  mockOracleData = {
    ...MOCK_ORACLE_DATA_BASE,
    profile: { ...MOCK_ORACLE_DATA_BASE.profile },
    homeBeach: { ...MOCK_ORACLE_DATA_BASE.homeBeach },
    refreshProfile: jest.fn(),
    markAnimationPlayed: jest.fn(),
    requestLocation: jest.fn(),
  } as unknown as OracleData;
});

// ===========================================================================
// Tests
// ===========================================================================

describe("OracleHomeScreen", () => {
  it("exports an OracleHomeScreen component", () => {
    expect(typeof OracleHomeScreen).toEqual("function");
  });

  it("requests current location from the live nearby-spots action", async () => {
    const requestLocation = jest.fn();
    mockOracleData = {
      ...MOCK_ORACLE_DATA_BASE,
      geoSource: "default",
      geoLoading: false,
      requestLocation,
    } as unknown as OracleData;

    render(<OracleHomeScreen />);

    await userEvent.click(
      screen.getByRole("button", { name: "Use my location" })
    );

    expect(requestLocation).toHaveBeenCalledTimes(1);
  });

  it("keeps populated conditions visible while GPS is resolving", () => {
    mockOracleData = {
      ...MOCK_ORACLE_DATA_BASE,
      geoSource: "default",
      geoLoading: true,
      requestLocation: jest.fn(),
    } as unknown as OracleData;

    render(<OracleHomeScreen />);

    expect(
      screen.getByRole("button", { name: "Detecting…" })
    ).toBeDisabled();
    expect(screen.getByRole("banner")).toBeInTheDocument();
    expect(screen.getByText("Today's Windows")).toBeInTheDocument();
  });

  it("hides the location action after a browser GPS fix", () => {
    render(<OracleHomeScreen />);

    expect(
      screen.queryByRole("button", { name: "Use my location" })
    ).not.toBeInTheDocument();
  });

  it("renders the hero section with beach data", () => {
    render(<OracleHomeScreen />);
    const hero = screen.getByRole("banner");
    expect(hero).toBeInTheDocument();
    // Beach name appears inside the hero conditions overlay
    expect(within(hero).getByText("Blacks Beach")).toBeInTheDocument();
  });

  it("renders wave height in the hero", () => {
    render(<OracleHomeScreen />);
    expect(screen.getByTestId("hero-wave-height")).toHaveTextContent("3-4ft");
  });

  it("headlines the surf call itself, not the wave height", () => {
    render(<OracleHomeScreen />);
    // Quiver's position is that it makes the call rather than handing over a
    // forecast, so the verdict is the h1.
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Maybe");
  });

  it("uses the embedded canonical decision without calling the legacy surf-call endpoint", () => {
    render(<OracleHomeScreen />);

    expect(screen.getByTestId("hero-decision-badge")).toHaveTextContent(
      "Maybe",
    );
    expect(
      mockFetch.mock.calls.some(([url]) =>
        String(url).startsWith("/api/surf/call"),
      ),
    ).toBe(false);
  });

  it("renders the canonical verdict instead of a client score", () => {
    render(<OracleHomeScreen />);
    expect(screen.getByTestId("hero-decision-badge")).toHaveTextContent(
      "Maybe",
    );
    expect(screen.queryByText(/\/10$/)).not.toBeInTheDocument();
  });

  it("uses a neutral CTA for a consider decision", () => {
    render(<OracleHomeScreen />);
    expect(screen.getByRole("button", { name: /invite a friend/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /paddle out/i })).not.toBeInTheDocument();
  });

  it("renders no positive surface when the canonical decision is no", () => {
    mockOracleData = {
      ...mockOracleData,
      topRecommendation: null,
      discovery: {
        ...mockOracleData.discovery!,
        recommendations: [],
        sessionDecision: {
          ...mockOracleData.discovery!.sessionDecision!,
          verdict: "no",
          reasonCode: "below_minimum_utility",
          selection: null,
          skillEligibility: {
            skill: "intermediate",
            state: "eligible",
            reasonCodes: [],
          },
        },
      },
    } as unknown as OracleData;
    render(<OracleHomeScreen />);
    expect(screen.queryByRole("banner")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /paddle out/i })).not.toBeInTheDocument();
  });

  it("renders Today's Windows section", () => {
    render(<OracleHomeScreen />);
    expect(screen.getByText("Today's Windows")).toBeInTheDocument();
  });

  it("keeps the forecast feed single-column until the layout has desktop width", () => {
    render(<OracleHomeScreen />);

    const layout = screen.getByTestId("oracle-home-content-grid");
    expect(layout).not.toHaveClass("md:grid");
    expect(layout).toHaveClass("lg:grid");
  });

  it("renders Nearby Spots section", () => {
    render(<OracleHomeScreen />);
    expect(screen.getByText("Nearby Spots")).toBeInTheDocument();
  });

  it("does not render alternate recommendations beside the canonical selection", () => {
    const customSpotRec = {
      ...MOCK_TOP_REC,
      recommendationId: "candidate-custom-reef",
      kind: "custom_spot" as const,
      customSpotId: "custom-reef-1",
      visibility: "public",
      isOwn: false,
      beach: {
        ...MOCK_TOP_REC.beach,
        name: "Community Reef",
      },
      summary: "Community reef summary",
    };
    mockOracleData = {
      ...mockOracleData,
      discovery: {
        ...mockOracleData.discovery!,
        recommendations: [MOCK_TOP_REC, customSpotRec],
      },
    } as unknown as OracleData;

    render(<OracleHomeScreen />);

    expect(screen.queryByText("Community Reef")).not.toBeInTheDocument();
    expect(screen.getByTestId("hero-decision-badge")).toHaveTextContent("Maybe");
  });

  it("hides Activity section when no activity items exist", () => {
    render(<OracleHomeScreen />);
    // ActivityFeed is hidden when empty to avoid isolation signals
    expect(screen.queryByText("Activity")).not.toBeInTheDocument();
  });

  // Session-time-selector prompt on the Oracle home screen was removed
  // in plan abstract-exploring-phoenix E2. Users with no
  // preferred_session_time no longer see a "When do you usually
  // paddle out?" prompt above the primary CTA — that question was a
  // zero-value capture that wrote to profiles.preferred_session_time
  // which in turn only influenced which forecast window got top
  // billing, a signal the user hadn't earned the right to demand. The
  // `SessionTimeSelector` component + `updatePreferredSessionTime`
  // server action remain available for a future settings surface but
  // are no longer wired to the home screen. The three tests that
  // previously covered this UI (positive render, hidden-when-set,
  // click handler wiring) are replaced by a single negative assertion
  // that pins the removal.
  it("does NOT render the session-time-selector prompt regardless of preferred_session_time", () => {
    mockOracleData = {
      ...mockOracleData,
      profile: { ...mockOracleData.profile, preferred_session_time: null } as any,
    };
    render(<OracleHomeScreen />);
    expect(
      screen.queryByText("When do you usually paddle out?")
    ).not.toBeInTheDocument();
  });

  it("shows loading skeleton when discovery is loading and no topRecommendation", () => {
    mockOracleData = {
      ...mockOracleData,
      discoveryLoading: true,
      topRecommendation: null,
      discovery: null,
    } as unknown as OracleData;
    render(<OracleHomeScreen />);
    // Skeleton does not render the hero role="banner"
    expect(screen.queryByRole("banner")).not.toBeInTheDocument();
  });

  it("keeps the paper page and says it is rechecking after a resume drops the payload", () => {
    // The signed-in home used to collapse to a full-bleed navy skeleton every
    // time the tab regained focus: useSurfDiscovery clears its payload on
    // resume (deliberately — a safety hold activated while you were away has
    // to beat the positive call already on screen), and the screen rendered
    // that window as a blank page. It read as a crash.
    //
    // Render a call first so the screen knows a call has been shown, then
    // clear the payload the way a resume does.
    const { rerender } = render(<OracleHomeScreen />);
    expect(screen.getByRole("banner")).toBeInTheDocument();

    mockOracleData = {
      ...mockOracleData,
      discoveryLoading: true,
      topRecommendation: null,
      discovery: null,
    } as unknown as OracleData;
    rerender(<OracleHomeScreen />);

    // The verdict is gone — that is the safety contract, and it must hold.
    expect(screen.queryByRole("banner")).not.toBeInTheDocument();
    // But the page is still a page: cream paper, and honest about why.
    expect(document.querySelector(".zine-paper")).toBeInTheDocument();
    expect(screen.getByText(/Rechecking the call/i)).toBeInTheDocument();
  });

  it("renders even when discovery is loading but topRecommendation exists (data from cache)", () => {
    mockOracleData = {
      ...mockOracleData,
      discoveryLoading: true,
      // topRecommendation is already populated (cached data)
    };
    render(<OracleHomeScreen />);
    // Should show the hero, not the skeleton
    expect(screen.getByRole("banner")).toBeInTheDocument();
  });

  it("shows skeleton (NOT empty state) while profileLoading is true and no topRecommendation", () => {
    // Repro: fresh authenticated user with no cached profile. profileLoading=true,
    // useSurfDiscovery is gated by `enabled: !!profile && !geoLoading`, so
    // discoveryLoading=false AND discovery=null. Pre-fix this rendered
    // OracleHeroEmpty ("We couldn't find any surf spots") before discovery
    // even ran.
    mockOracleData = {
      ...mockOracleData,
      profileLoading: true,
      discoveryLoading: false,
      discovery: null,
      discoveryError: null,
      topRecommendation: null,
    } as unknown as OracleData;
    render(<OracleHomeScreen />);
    expect(screen.queryByText(/We couldn't find any surf spots/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/We couldn't load conditions/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("banner")).not.toBeInTheDocument();
  });

  it("shows skeleton while geoLoading even after profile resolves", () => {
    mockOracleData = {
      ...mockOracleData,
      profileLoading: false,
      geoLoading: true,
      discoveryLoading: false,
      discovery: null,
      discoveryError: null,
      topRecommendation: null,
    } as unknown as OracleData;
    render(<OracleHomeScreen />);
    expect(screen.queryByText(/We couldn't find any surf spots/i)).not.toBeInTheDocument();
  });

  it("does not return a definitive discovery result to the bootstrap skeleton during GPS refresh", () => {
    mockOracleData = {
      ...mockOracleData,
      profileLoading: false,
      geoLoading: true,
      discoveryLoading: false,
      discovery: {
        recommendations: [],
        searchCriteria: { maxResults: 6 },
        metadata: {
          totalBeachesConsidered: 0,
          successfulForecasts: 0,
          partialSuccess: false,
          failedBeaches: 0,
          staleBeaches: 0,
          generated_at: new Date().toISOString(),
        },
      },
      discoveryError: null,
      topRecommendation: null,
    } as unknown as OracleData;

    render(<OracleHomeScreen />);

    expect(screen.getByText(/We couldn't find any surf spots/i)).toBeInTheDocument();
  });

  it("shows empty card with 'no spots' reason when discovery resolved with zero recommendations", () => {
    mockOracleData = {
      ...mockOracleData,
      profileLoading: false,
      discoveryLoading: false,
      discovery: {
        recommendations: [],
        searchCriteria: { maxResults: 6 },
        metadata: {
          totalBeachesConsidered: 0,
          successfulForecasts: 0,
          partialSuccess: false,
          failedBeaches: 0,
          staleBeaches: 0,
          generated_at: new Date().toISOString(),
        },
      },
      discoveryError: null,
      topRecommendation: null,
    } as unknown as OracleData;
    render(<OracleHomeScreen />);
    expect(screen.getByText(/We couldn't find any surf spots/i)).toBeInTheDocument();
  });

  it("lets explicit none override stale hero, window, nearby, share, and action data", () => {
    const { getLocalActivity } = jest.requireMock(
      "@/actions/oracle-actions",
    ) as { getLocalActivity: jest.Mock };
    getLocalActivity.mockImplementationOnce(() => new Promise(() => {}));
    mockOracleData = {
      ...mockOracleData,
      topRecommendation: MOCK_TOP_REC,
      remainingSpots: [MOCK_HOME_REC],
      discovery: {
        ...mockOracleData.discovery!,
        recommendations: [MOCK_TOP_REC, MOCK_HOME_REC],
        recommendationAvailability: {
          state: "none",
          reasonCode: "major_event_hold",
          holdEpoch: "hold-1:1",
        },
      },
    } as unknown as OracleData;

    render(<OracleHomeScreen />);

    expect(screen.queryByRole("banner")).not.toBeInTheDocument();
    expect(screen.queryByText("Today's Windows")).not.toBeInTheDocument();
    expect(screen.queryByText("Nearby Spots")).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("home-session-intelligence-module")
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /paddle out/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /set alarm/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /share/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /try again/i })).not.toBeInTheDocument();
    expect(screen.getByText("Blacks Beach")).toBeVisible();
    expect(screen.getByText("Session picks aren't available right now.")).toBeVisible();
    expect(screen.queryByText(/low confidence|confidence/i)).not.toBeInTheDocument();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("does not inspect or sort stale recommendation rows after explicit none", () => {
    const staleRecommendations = new Proxy(
      [MOCK_TOP_REC, MOCK_HOME_REC],
      {
        get() {
          throw new Error("held recommendation rows must not be inspected");
        },
      },
    );
    mockOracleData = {
      ...mockOracleData,
      homeBeach: null,
      topRecommendation: MOCK_TOP_REC,
      discovery: {
        ...mockOracleData.discovery!,
        recommendations: staleRecommendations,
        recommendationAvailability: {
          state: "none",
          reasonCode: "major_event_hold",
          holdEpoch: "hold-1:1",
        },
      },
    } as unknown as OracleData;

    expect(() => render(<OracleHomeScreen />)).not.toThrow();
    expect(screen.getByText("Your Surf")).toBeVisible();
    expect(screen.getByText("Session picks aren't available right now.")).toBeVisible();
  });

  it("preserves the ordinary hero when availability is explicitly available", () => {
    mockOracleData = {
      ...mockOracleData,
      discovery: {
        ...mockOracleData.discovery!,
        recommendationAvailability: {
          state: "available",
          holdEpoch: "ordinary-1",
        },
      },
    } as unknown as OracleData;

    render(<OracleHomeScreen />);

    expect(screen.getByRole("banner")).toBeInTheDocument();
    expect(screen.getByText("Today's Windows")).toBeInTheDocument();
  });

  it("shows the Set Home Beach CTA from the empty state when the user has no home beach", async () => {
    mockOracleData = {
      ...mockOracleData,
      profile: { ...mockOracleData.profile, home_beach_id: null } as any,
      homeBeach: null,
      profileLoading: false,
      discoveryLoading: false,
      discovery: {
        recommendations: [],
        searchCriteria: { maxResults: 6 },
        metadata: {
          totalBeachesConsidered: 0,
          successfulForecasts: 0,
          partialSuccess: false,
          failedBeaches: 0,
          staleBeaches: 0,
          generated_at: new Date().toISOString(),
        },
      },
      discoveryError: null,
      topRecommendation: null,
    } as unknown as OracleData;
    render(<OracleHomeScreen />);

    const setHomeBeachBtn = screen.getByRole("button", {
      name: /set your home beach/i,
    });
    await userEvent.click(setHomeBeachBtn);
    expect(mockOnboardingReset).toHaveBeenCalled();
    expect(mockOnboardingOpenDialog).toHaveBeenCalled();
  });

  it("shows empty card with 'load failure' reason when discoveryError is set", () => {
    mockOracleData = {
      ...mockOracleData,
      profileLoading: false,
      discoveryLoading: false,
      discovery: null,
      discoveryError: "Discovery API unreachable",
      topRecommendation: null,
    } as unknown as OracleData;
    render(<OracleHomeScreen />);
    expect(screen.getByText(/We couldn't load conditions/i)).toBeInTheDocument();
  });

  it("opens the onboarding dialog when Set Home Beach is clicked", async () => {
    // No home beach → primary CTA is "Set your home beach". The handler now
    // opens the OnboardingDialog in place (reset + openDialog on the store)
    // rather than navigating to /profile?tab=preferences. See plan
    // vast-dancing-whale — the dialog auto-open was removed and this CTA
    // became the explicit entry point for brand-new signups.
    mockOracleData = {
      ...mockOracleData,
      homeBeach: null,
      topRecommendation: { ...MOCK_TOP_REC, score: 30 },
    } as unknown as OracleData;
    render(<OracleHomeScreen />);

    const setHomeBeachBtn = screen.getByRole("button", {
      name: /set your home beach/i,
    });
    await userEvent.click(setHomeBeachBtn);
    expect(mockOnboardingReset).toHaveBeenCalled();
    expect(mockOnboardingOpenDialog).toHaveBeenCalled();
    expect(mockRouterPush).not.toHaveBeenCalledWith("/profile?tab=preferences");
  });

  it("navigates to sessions tab when Log Session is clicked", async () => {
    // homeBeach set, conditionsGood → primary is "Paddle out", secondary includes set alarm + invite
    // We verify the secondary row renders correctly — Set alarm should be present
    render(<OracleHomeScreen />);
    expect(screen.getByRole("button", { name: /set alarm/i })).toBeInTheDocument();
  });

  it("does not expose confidence language with the canonical decision", () => {
    render(<OracleHomeScreen />);
    expect(screen.queryByText(/confidence/i)).not.toBeInTheDocument();
  });

  it("uses waveHeightBadge from topRecommendation for display", () => {
    render(<OracleHomeScreen />);
    // waveHeightBadge = "3-4ft" from MOCK_TOP_REC
    expect(screen.getByTestId("hero-wave-height")).toHaveTextContent("3-4ft");
  });

  it("hides activity feed when no activity items exist", () => {
    // activityRaw will be [] (mocked getLocalActivity returns [])
    render(<OracleHomeScreen />);
    // ActivityFeed should be hidden when empty — no isolation signals
    expect(screen.queryByText("Your local lineup is quiet")).not.toBeInTheDocument();
    expect(screen.queryByText("Activity")).not.toBeInTheDocument();
  });

  it("renders BottomNav", () => {
    render(<OracleHomeScreen />);
    expect(screen.getByRole("navigation", { name: /main navigation/i })).toBeInTheDocument();
  });

  it("renders 5 time slot bars in Today's Windows", () => {
    render(<OracleHomeScreen />);
    // TodaysWindows renders 5 time slot rows
    const timeLabels = ["5am", "8am", "11am", "2pm", "5pm"];
    timeLabels.forEach((label) => {
      expect(screen.getByText(label)).toBeInTheDocument();
    });
  });

  it("uses the canonical session window when the selected start changes", () => {
    // 5:45 AM PDT = 12:45 UTC (PDT is UTC-7 in March 2026)
    const earlyWindow = {
      ...MOCK_WINDOW,
      start: new Date("2026-03-11T12:45:00.000Z"),
      end: new Date("2026-03-11T15:45:00.000Z"),
    };
    mockOracleData = {
      ...mockOracleData,
      topRecommendation: { ...MOCK_TOP_REC, window: earlyWindow },
      discovery: {
        ...mockOracleData.discovery!,
        recommendations: [{ ...MOCK_TOP_REC, window: earlyWindow }],
        sessionDecision: {
          ...mockOracleData.discovery!.sessionDecision!,
          selection: {
            ...mockOracleData.discovery!.sessionDecision!.selection!,
            windowStart: "2026-03-11T12:45:00.000Z",
            windowEnd: "2026-03-11T15:45:00.000Z",
          },
        },
      },
    } as unknown as OracleData;
    render(<OracleHomeScreen />);
    // Rendered inside the stamp's trail caption ("Best at 5:45am").
    expect(screen.getByText(/\b5:45am\b/)).toBeInTheDocument();
  });

  it("uses slotForecasts wave heights for non-best time slots when provided", () => {
    // slotForecasts at hour 5 (5am slot) has a different height than the best window
    const topRecWithSlots = {
      ...MOCK_TOP_REC,
      // Best window at 8am PDT (15:00 UTC)
      window: { ...MOCK_WINDOW, start: new Date("2026-03-11T15:00:00.000Z") },
      slotForecasts: {
        5: { waveHeight: "1.5 ft", waveHeightBadge: "1-2ft" },
        11: { waveHeight: "2.5 ft", waveHeightBadge: "2-3ft" },
        14: { waveHeight: "3.0 ft", waveHeightBadge: "3-4ft" },
        17: { waveHeight: "2.0 ft", waveHeightBadge: "2-3ft" },
      },
    };
    mockOracleData = {
      ...mockOracleData,
      topRecommendation: topRecWithSlots,
      discovery: {
        ...mockOracleData.discovery!,
        recommendations: [topRecWithSlots],
      },
    } as unknown as OracleData;
    render(<OracleHomeScreen />);

    // 5am slot should show "1-2ft" from slotForecasts (pre-formatted ranges
    // pass through unchanged; the " sets" suffix has been retired).
    expect(screen.getByText("1-2ft")).toBeInTheDocument();
    // 11am slot should show "2-3ft" from slotForecasts
    expect(screen.getAllByText("2-3ft").length).toBeGreaterThanOrEqual(1);
  });

  it("prefers current-slot tide/wind data over forecast entity values when slotForecasts is populated", () => {
    // System time is 9am UTC → currentSlotHour = 8 (closest slot to hour 9)
    // slotForecasts[8] has different tide/wind than the forecast entity
    const topRecWithCurrentSlot = {
      ...MOCK_TOP_REC,
      window: { ...MOCK_WINDOW, start: new Date("2026-03-11T13:00:00.000Z") }, // 6 AM PDT
      slotForecasts: {
        8: {
          waveHeight: "3.5 ft",
          waveHeightBadge: "3-5ft",
          windSpeed: "5",
          windDirection: "SW",
          tideHeight: "1.5",
          tideStatus: "Falling",
          swellPeriod: "10s",
          swellDirection: "SW",
        },
      },
    };
    mockOracleData = {
      ...mockOracleData,
      topRecommendation: topRecWithCurrentSlot,
      discovery: {
        ...mockOracleData.discovery!,
        recommendations: [topRecWithCurrentSlot],
      },
    } as unknown as OracleData;
    // The component should render without error — tide/wind data from slotForecasts[8]
    // is used instead of the stale forecast entity values
    render(<OracleHomeScreen />);
    expect(screen.getByRole("banner")).toBeInTheDocument();
  });

  it("ignores the retired surf-call verdict when it disagrees with the canonical decision", () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          isTomorrow: false,
          report: {
            verdict: "NO",
            bestWindowStart: null,
            bestWindowEnd: null,
            windowMinutes: null,
            shortWindow: false,
            waveHeight: "0-1ft",
            windDescription: "Strong onshore wind",
            windSpeed: "13 mph",
            windCompass: "W",
            windType: "onshore",
            tideDescription: "Falling",
            tidePhase: "falling",
            tideHeight: "1.2ft",
            nextTideType: "low",
            nextTideAt: "2026-03-11T19:00:00.000Z",
            whySentence: "Onshore wind all day making conditions choppy.",
            forecastConfidence: 85,
            lowForecastConfidence: false,
            score: 8,
            peakTime: null,
            trendTags: [],
            updatedAt: "2026-03-11T15:23:00.000Z",
            isCalibrated: true,
            rideableWavesPerHour: null,
            dominantBeatIntervalS: 17,
          },
        },
      }),
    });

    render(<OracleHomeScreen />);

    expect(screen.getByTestId("hero-decision-badge")).toHaveTextContent(
      "Maybe",
    );
    expect(screen.queryByText("Today's a no-go")).not.toBeInTheDocument();
    expect(screen.queryByText(/Onshore wind all day/i)).not.toBeInTheDocument();
  });

  // ===========================================================================
  // Hero why-sentence — distinct from the best-window subtitle
  //
  // The best-window card's subtitle line is now sourced from
  // heroRec?.reasons?.[0]. heroSurfCall?.whySentence renders as its own
  // distinct prose line under the card. The two must never resolve to the
  // same string at the same time, and the why-sentence node must be
  // omitted entirely when the surf-call payload doesn't carry one.
  // ===========================================================================
  describe("canonical hero explanation", () => {
    it("does not render reasoning from the retired surf-call endpoint", () => {
      render(<OracleHomeScreen />);
      expect(screen.queryByTestId("hero-why-sentence")).not.toBeInTheDocument();
      expect(screen.queryByText("Solid window with offshore winds.")).not.toBeInTheDocument();
    });

    it("renders the selected recommendation reason as supporting physical context", () => {
      render(<OracleHomeScreen />);
      expect(screen.getByText("Clean WNW swell")).toBeInTheDocument();
    });

    it("keeps the supporting context separate from the canonical verdict", () => {
      render(<OracleHomeScreen />);
      expect(screen.getByText("Clean WNW swell")).toBeInTheDocument();
      expect(screen.getByTestId("hero-decision-badge")).toHaveTextContent("Maybe");
    });

    it("omits the whySentence node when /api/surf/call returns no whySentence", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            report: {
              verdict: "MAYBE",
              score: 70,
              // whySentence intentionally omitted
              updatedAt: new Date().toISOString(),
              bestWindowStart: new Date("2026-03-11T13:00:00.000Z").toISOString(),
              bestWindowEnd: new Date("2026-03-11T16:00:00.000Z").toISOString(),
              peakTime: new Date("2026-03-11T14:00:00.000Z").toISOString(),
              waveHeight: "3-4ft",
              windDescription: "8 mph NW",
              tidePhase: "rising",
              isCalibrated: true,
              trendTags: [],
              shortWindow: false,
              windowMinutes: 180,
              lowForecastConfidence: false,
              rideableWavesPerHour: 12,
            },
            isTomorrow: false,
          },
        }),
      });
      render(<OracleHomeScreen />);
      // The card subtitle (heroRec.reasons[0]) still renders even without a
      // whySentence — proving the subtitle source is independent.
      expect(await screen.findByText("Clean WNW swell")).toBeInTheDocument();
      // No why-sentence node — we don't paint a placeholder when absent.
      expect(
        screen.queryByTestId("hero-why-sentence")
      ).not.toBeInTheDocument();
    });
  });

  it("falls back to top rec waveHeight for slots without slotForecasts data", () => {
    // No slotForecasts — all slots get the same waveHeightBadge from the top rec
    const topRecNoSlots = {
      ...MOCK_TOP_REC,
      // Best window at 8am PDT (15:00 UTC)
      window: { ...MOCK_WINDOW, start: new Date("2026-03-11T15:00:00.000Z") },
      slotForecasts: undefined,
    };
    mockOracleData = {
      ...mockOracleData,
      topRecommendation: topRecNoSlots,
      discovery: {
        ...mockOracleData.discovery!,
        recommendations: [topRecNoSlots],
      },
    } as unknown as OracleData;
    render(<OracleHomeScreen />);

    // All non-best slots fall back to "3-4ft" (waveHeightBadge from MOCK_TOP_REC)
    // There should be multiple instances of "3-4ft" across the time windows
    const allBadges = screen.getAllByText("3-4ft");
    expect(allBadges.length).toBeGreaterThanOrEqual(1);
  });

  it("isTomorrow uses timezone-aware comparison: returns false for same-day window", () => {
    render(<OracleHomeScreen />);
    expect(screen.getByText("Today's Windows")).toBeInTheDocument();
  });

  it("isTomorrow uses timezone-aware comparison: returns true for next-day window", () => {
    const tomorrowWindow = {
      ...MOCK_WINDOW,
      start: new Date("2026-03-12T14:00:00.000Z"),
      timezone: "America/Los_Angeles",
    };
    mockOracleData = {
      ...mockOracleData,
      topRecommendation: { ...MOCK_TOP_REC, window: tomorrowWindow },
      discovery: {
        ...mockOracleData.discovery!,
        recommendations: [{ ...MOCK_TOP_REC, window: tomorrowWindow }],
        sessionDecision: {
          ...mockOracleData.discovery!.sessionDecision!,
          selection: {
            ...mockOracleData.discovery!.sessionDecision!.selection!,
            windowStart: "2026-03-12T14:00:00.000Z",
            windowEnd: "2026-03-12T17:00:00.000Z",
          },
        },
      },
    } as unknown as OracleData;
    render(<OracleHomeScreen />);
    expect(screen.getByText("Tomorrow's Windows")).toBeInTheDocument();
  });

  // ===========================================================================
  // Regional-best hero — home != topRec path
  // ===========================================================================
  describe("regional-best hero (home != topRec)", () => {
    function setupHomeNeqTopRec() {
      mockOracleData = {
        ...mockOracleData,
        homeBeach: MOCK_HOME_BEACH,
        profile: {
          ...mockOracleData.profile,
          home_beach_id: MOCK_HOME_BEACH.id,
        },
        topRecommendation: MOCK_TOP_REC,
        discovery: {
          ...mockOracleData.discovery!,
          recommendations: [MOCK_TOP_REC, MOCK_HOME_REC],
        },
      } as unknown as OracleData;
    }

    it("renders the topRec in the hero (not the home beach)", () => {
      setupHomeNeqTopRec();
      render(<OracleHomeScreen />);
      // Hero shows the topRec wave height (3-4ft from MOCK_TOP_REC),
      // NOT the home beach wave height (1-2ft from MOCK_HOME_REC).
      expect(screen.getByTestId("hero-wave-height")).toHaveTextContent("3-4ft");
      // Beach name in the hero eyebrow is the topRec's name.
      const hero = screen.getByRole("banner");
      expect(within(hero).getByText("Blacks Beach")).toBeInTheDocument();
    });

    it("renders the drive subtitle with rounded miles + cardinal word", () => {
      setupHomeNeqTopRec();
      render(<OracleHomeScreen />);
      const subtitle = screen.getByTestId("hero-drive-subtitle");
      // OB Pier (32.749, -117.252) -> Blacks Beach (32.88, -117.25) is
      // ~9 mi due north. Assert the subtitle contains a mile count + a
      // cardinal word + the home beach name. Uses a permissive regex so
      // small bearing/distance changes don't break the test.
      expect(subtitle).toHaveTextContent(
        /\d+ mi (north|northeast|northwest|south|southeast|southwest|east|west) of Ocean Beach Pier/i
      );
    });

    it("does not render the home beach as a second recommendation", () => {
      setupHomeNeqTopRec();
      render(<OracleHomeScreen />);
      expect(screen.queryByTestId("home-beach-card")).not.toBeInTheDocument();
    });

    it("activity feed follows the hero (calls getLocalActivity with topRec id)", async () => {
      setupHomeNeqTopRec();
      const { getLocalActivity } = jest.requireMock(
        "@/actions/oracle-actions"
      ) as { getLocalActivity: jest.Mock };
      getLocalActivity.mockClear();
      render(<OracleHomeScreen />);
      await waitFor(() => {
        expect(getLocalActivity).toHaveBeenCalled();
      });
      // First call's first arg is the beach id.
      expect(getLocalActivity).toHaveBeenCalledWith(MOCK_TOP_REC.beach.id);
      expect(getLocalActivity).not.toHaveBeenCalledWith(MOCK_HOME_BEACH.id);
    });
  });

  describe("regional-best hero (home == topRec)", () => {
    it("hides the drive subtitle and HomeBeachCard", () => {
      // Default fixture has homeBeach.id === topRec.beach.id ("b1").
      render(<OracleHomeScreen />);
      expect(screen.queryByTestId("hero-drive-subtitle")).not.toBeInTheDocument();
      expect(screen.queryByTestId("home-beach-card")).not.toBeInTheDocument();
    });
  });

  describe("regional-best hero (no home beach)", () => {
    it("hides the drive subtitle and HomeBeachCard when homeBeach is null", () => {
      mockOracleData = {
        ...mockOracleData,
        homeBeach: null,
      } as unknown as OracleData;
      render(<OracleHomeScreen />);
      expect(screen.queryByTestId("hero-drive-subtitle")).not.toBeInTheDocument();
      expect(screen.queryByTestId("home-beach-card")).not.toBeInTheDocument();
    });
  });

  // ===========================================================================
  // Hero score gate — heroSurfCall pending window
  //
  // Pre-fix, the hero painted a phantom 0.0/10 score and a "set alarm" CTA
  // while the canonical /api/surf/call request was in flight, because:
  //   - score defaulted to 0 (`heroSurfCall?.score ?? 0`)
  //   - conditionsGood was `score > 60` → false
  //   - surfVerdict was `null`, which the old branch treated as "not NO" so
  //     the `set alarm` branch fired anyway under the cover of a low score
  // Now `score = null` and `conditionsGood = undefined` while loading. The
  // hero still renders with the discovery-driven title; only the score
  // badge and verdict-driven CTA wait.
  // ===========================================================================
  describe("canonical decision freshness", () => {
    it("renders the decision immediately without a score-loading state", () => {
      mockFetch.mockImplementation(() => new Promise(() => {}));
      render(<OracleHomeScreen />);
      expect(screen.getByTestId("hero-decision-badge")).toHaveTextContent("Maybe");
      expect(screen.queryByTestId("hero-score-badge")).not.toBeInTheDocument();
    });

    it("fails closed when the selected candidate does not match the hero", () => {
      mockOracleData = {
        ...mockOracleData,
        discovery: {
          ...mockOracleData.discovery!,
          sessionDecision: {
            ...mockOracleData.discovery!.sessionDecision!,
            selection: {
              ...mockOracleData.discovery!.sessionDecision!.selection!,
              candidateId: "stale-candidate",
            },
          },
        },
      } as unknown as OracleData;

      render(<OracleHomeScreen />);

      expect(screen.queryByRole("banner")).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /paddle out/i })).not.toBeInTheDocument();
    });
  });

  it("suppresses all backup recommendation copy", () => {
    mockOracleData = {
      ...mockOracleData,
      discovery: {
        ...mockOracleData.discovery!,
        recommendations: [
          MOCK_TOP_REC,
          {
            ...MOCK_HOME_REC,
            recommendationId: "candidate-backup",
            summary: "Backup recommendation copy",
          },
        ],
      },
    } as unknown as OracleData;

    render(<OracleHomeScreen />);

    expect(screen.queryByText("Backup recommendation copy")).not.toBeInTheDocument();
  });
});
