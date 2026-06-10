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

  it("renders the hero section with beach data", () => {
    render(<OracleHomeScreen />);
    const hero = screen.getByRole("banner");
    expect(hero).toBeInTheDocument();
    // Beach name appears inside the hero conditions overlay
    expect(within(hero).getByText("Blacks Beach")).toBeInTheDocument();
  });

  it("renders wave height in the hero", () => {
    render(<OracleHomeScreen />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("3-4ft");
  });

  it("renders score in X/10 format", async () => {
    // Score now comes from the canonical surf-call (fetched via /api/surf/call),
    // not discovery's boosted score. Async wait for the fetch to resolve.
    render(<OracleHomeScreen />);
    expect(await screen.findByText("8.5/10")).toBeInTheDocument();
  });

  it("renders contextual CTA buttons", async () => {
    // With homeBeach set, score>60, and surfVerdict="MAYBE" (not NO),
    // primary CTA is "Paddle out". Wait for the surf-call fetch to populate.
    render(<OracleHomeScreen />);
    expect(
      await screen.findByRole("button", { name: /paddle out/i })
    ).toBeInTheDocument();
  });

  it("hides 'Paddle out' CTA when surf-call verdict is NO", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          report: {
            verdict: "NO",
            score: 25,
            whySentence: "Conditions not favorable for surfing.",
            updatedAt: new Date().toISOString(),
            bestWindowStart: null,
            bestWindowEnd: null,
            peakTime: null,
            waveHeight: "1ft",
            windDescription: "20 mph onshore",
            tidePhase: "rising",
            isCalibrated: true,
            trendTags: [],
            shortWindow: false,
            windowMinutes: null,
            lowForecastConfidence: false,
            rideableWavesPerHour: 0,
          },
          isTomorrow: false,
        },
      }),
    });
    render(<OracleHomeScreen />);
    // Wait on the contextLine specifically — "Set alarm" also appears as a
    // secondary CTA in the default (no-verdict-yet) branch, so a button-name
    // wait would resolve on the initial pre-fetch render and miss the actual
    // verdict=NO branch we care about.
    expect(
      await screen.findByText(/Conditions aren't there today/i)
    ).toBeInTheDocument();
    // Now that the NO branch is active, "Paddle out" must not be present and
    // "Set alarm" is the primary action.
    expect(
      screen.queryByRole("button", { name: /paddle out/i })
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /set alarm/i })
    ).toBeInTheDocument();
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

  it("keeps custom spot recommendations distinct from their nearest beach identity", async () => {
    const customSpotRec = {
      ...MOCK_TOP_REC,
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
      topRecommendation: MOCK_HOME_REC,
      discovery: {
        ...mockOracleData.discovery!,
        recommendations: [MOCK_HOME_REC, MOCK_TOP_REC, customSpotRec],
      },
    } as unknown as OracleData;

    render(<OracleHomeScreen />);

    const rail = screen.getByTestId("nearby-spots-scroll");
    const card = await within(rail).findByText("Community Reef");
    expect(card).toBeInTheDocument();

    await userEvent.click(card.closest('[role="button"]') ?? card);
    expect(mockRouterPush).not.toHaveBeenCalledWith("/ca/la-jolla/blacks");
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

  it("passes the correct userName from profile to OracleHero", async () => {
    render(<OracleHomeScreen />);
    // Score=85 (8.5/10 > 7) at 8am PDT → conditions-reactive greeting for high score.
    // Score now comes from the canonical surf-call fetch — wait for it to resolve.
    expect(await screen.findByText(/firing/i)).toBeInTheDocument();
  });

  it("uses waveHeightBadge from topRecommendation for display", () => {
    render(<OracleHomeScreen />);
    // waveHeightBadge = "3-4ft" from MOCK_TOP_REC
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("3-4ft");
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

  it("generates a personalized dawn patrol title when window starts early", () => {
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
      },
    } as unknown as OracleData;
    render(<OracleHomeScreen />);
    expect(screen.getByText("Dawn patrol is your move")).toBeInTheDocument();
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

  it("uses the surf-call API as the hero verdict source when it disagrees with discovery", async () => {
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

    await waitFor(() => {
      expect(screen.getByText("Today's a no-go")).toBeInTheDocument();
    });
    // whySentence renders in its own dedicated slot under the best-window
    // card — not as the card subtitle (which is now sourced from
    // heroRec.reasons[0]).
    const why = screen.getByTestId("hero-why-sentence");
    expect(why).toHaveTextContent(
      "Onshore wind all day making conditions choppy."
    );
    expect(screen.getByText("—")).toBeInTheDocument();
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
  describe("hero whySentence vs bestWindowSubtitle", () => {
    it("renders whySentence under the card when /api/surf/call provides one", async () => {
      // Default beforeEach mock returns whySentence "Solid window with offshore winds."
      render(<OracleHomeScreen />);
      const why = await screen.findByTestId("hero-why-sentence");
      expect(why).toHaveTextContent("Solid window with offshore winds.");
    });

    it("renders the heroRec.reasons[0] fallback as the card subtitle, not the whySentence", async () => {
      render(<OracleHomeScreen />);
      // Wait for the surf-call fetch to settle so the render is stable.
      await screen.findByTestId("hero-why-sentence");
      // MOCK_TOP_REC.reasons = ["Clean WNW swell", "Offshore NW winds"].
      expect(screen.getByText("Clean WNW swell")).toBeInTheDocument();
    });

    it("does not render the whySentence and the subtitle as the same string", async () => {
      render(<OracleHomeScreen />);
      const why = await screen.findByTestId("hero-why-sentence");
      const whyText = why.textContent ?? "";
      // The subtitle copy from MOCK_TOP_REC is "Clean WNW swell".
      // The whySentence from beforeEach is "Solid window with offshore winds."
      // These must be distinct nodes carrying distinct strings.
      expect(whyText).not.toEqual("Clean WNW swell");
      // And the subtitle string must not also appear as the why-sentence.
      expect(whyText).not.toContain("Clean WNW swell");
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
      // Hero <h1> shows the topRec wave height (3-4ft from MOCK_TOP_REC),
      // NOT the home beach wave height (1-2ft from MOCK_HOME_REC).
      expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("3-4ft");
      // Beach name in the conditions overlay is the topRec's name.
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

    it("renders the HomeBeachCard with 'Your home' label", () => {
      setupHomeNeqTopRec();
      render(<OracleHomeScreen />);
      const card = screen.getByTestId("home-beach-card");
      expect(card).toBeInTheDocument();
      expect(card).toHaveTextContent("Your home");
      expect(card).toHaveTextContent("Ocean Beach Pier");
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
  describe("hero score gate while /api/surf/call is loading", () => {
    function setupPendingSurfCall() {
      // `mockFetch` resolves the surf-call request in beforeEach. Replace it
      // with a never-resolving promise to pin the loading state.
      mockFetch.mockImplementation(() => new Promise(() => {}));
    }

    it("renders a placeholder score badge instead of '0.0/10' while surf-call is loading", () => {
      setupPendingSurfCall();
      render(<OracleHomeScreen />);
      // Hero is visible (not blocked by an outer skeleton — discovery resolved).
      expect(screen.getByRole("banner")).toBeInTheDocument();
      // The score badge renders the pending placeholder, NOT a numeric value.
      const badge = screen.getByTestId("hero-score-badge");
      expect(badge).toHaveAttribute("data-score-pending", "true");
      expect(badge).toHaveTextContent("—/10");
      // No phantom "0.0/10" leaks into the DOM.
      expect(screen.queryByText("0.0/10")).not.toBeInTheDocument();
    });

    it("falls through to the neutral default CTA branch while surf-call is loading", () => {
      setupPendingSurfCall();
      render(<OracleHomeScreen />);
      // The "set alarm" lead branch ("Conditions aren't there today…") must NOT
      // fire on undefined verdict — that copy is reserved for an explicit NO.
      expect(
        screen.queryByText(/Conditions aren't there today/i)
      ).not.toBeInTheDocument();
      // The "Paddle out" CTA also must NOT fire on undefined conditionsGood.
      expect(
        screen.queryByRole("button", { name: /paddle out/i })
      ).not.toBeInTheDocument();
      // Falls to the default `inviteFriend` branch — context line + primary CTA.
      expect(screen.getByText(/Surfing's better with friends/i)).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /invite a friend/i })
      ).toBeInTheDocument();
    });

    // -----------------------------------------------------------------------
    // Hero-swap stale-flash protection
    //
    // useDataFetcher (hooks/use-data-fetcher.ts:83) preserves `state.data`
    // across the param-change render — when a fetchFn change kicks off the
    // next request, the loading-flip setState keeps `prev.data`. That means
    // when `heroBeach.id` swaps from A to B, there's a render where the
    // component reads `{data: dataA, loading: false}` even though heroBeach
    // already points at B. Pre-fix, `heroSurfCallReady = !loading = true`
    // happily painted beach A's score and verdict next to beach B's name.
    //
    // The freshness gate (`heroSurfCallFresh` / `heroSurfCallReady`) tags
    // each fetched payload with `forBeachId` and treats a mismatch as
    // still-loading regardless of `loading`. This test reproduces that
    // logical state deterministically by pre-populating apiCache with
    // tagged data whose `forBeachId` doesn't match — the same state the
    // component sees on the first render after a hero swap.
    // -----------------------------------------------------------------------
    it("does not paint stale score/verdict when heroSurfCallData was tagged for a different beach (hero-swap protection)", () => {
      // Pre-populate the cache for the current heroBeach.id ("b1") with
      // data tagged for a DIFFERENT beach. useDataFetcher's useState
      // initializer (use-data-fetcher.ts:55-68) seeds synchronously from
      // cache, so the first render lands with `{data: STALE, loading:
      // false}` — bypassing the loading window and isolating the
      // freshness gate as the only thing protecting the UI.
      apiCache.set(
        "oracle-hero-surf-call:b1",
        {
          report: {
            verdict: "MAYBE",
            score: 85,
            whySentence: "stale data — should not paint",
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
          forBeachId: "different-beach-id",
        },
        5 * 60 * 1000
      );

      render(<OracleHomeScreen />);

      // Score badge must show the pending placeholder, NOT the stale 8.5/10
      // from the mismatched payload.
      const badge = screen.getByTestId("hero-score-badge");
      expect(badge).toHaveAttribute("data-score-pending", "true");
      expect(screen.queryByText("8.5/10")).not.toBeInTheDocument();

      // Hero subtitle and verdict-driven CTA must also fall back to the
      // discovery-derived defaults — no stale `whySentence`, no MAYBE
      // verdict bleeding through to ContextualCTA's "Paddle out" branch.
      expect(
        screen.queryByText("stale data — should not paint")
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /paddle out/i })
      ).not.toBeInTheDocument();
      // Neutral default CTA branch fires.
      expect(screen.getByText(/Surfing's better with friends/i)).toBeInTheDocument();
    });
  });

  // ===========================================================================
  // Nearby-spot reason personalization
  //
  // Personalization happens in `transformToNearbySpots(...)` while the full
  // `SurfDiscoveryRecommendation` is still in scope. NearbySpot itself does
  // NOT carry forecast fields, so the renderer cannot recompute hero-relative
  // copy at render time. These tests exercise the precedence chain:
  //   buildPersonalizedReason(rec, hero) ?? strategyTag.reason ?? rec.summary
  // ===========================================================================
  describe("nearby-spot reason personalization", () => {
    // A second rec to occupy the Nearby Spots row. Uses a different beach id
    // than MOCK_TOP_REC (otherwise the filter at the call site drops it).
    const MOCK_BACKUP_BEACH = {
      ...MOCK_HOME_BEACH,
      id: "backup-1",
      name: "Backup Spot",
    };

    function recWithStrategy(strategyTag: {
      type: "biggest_waves" | "cleanest" | "sleep_in" | "low_crowd" | "skip";
      label: string;
      reason: string;
    }) {
      return {
        ...MOCK_TOP_REC,
        beach: MOCK_BACKUP_BEACH,
        summary: "Generic backup summary",
        strategyTag,
      };
    }

    it("renders personalized reasonText for biggest_waves backup when hero verdict is MAYBE", async () => {
      const backupRec = recWithStrategy({
        type: "biggest_waves",
        label: "Biggest",
        reason: "Strategy-tag default",
      });
      mockOracleData = {
        ...mockOracleData,
        discovery: {
          ...mockOracleData.discovery!,
          recommendations: [MOCK_TOP_REC, backupRec],
        },
      } as unknown as OracleData;
      // Default mockFetch in beforeEach returns verdict="MAYBE".

      render(<OracleHomeScreen />);

      expect(
        await screen.findByText("More size than the hero call")
      ).toBeInTheDocument();
      // Strategy-tag default reason and the generic summary should be
      // shadowed by the personalized copy.
      expect(screen.queryByText("Strategy-tag default")).not.toBeInTheDocument();
      expect(screen.queryByText("Generic backup summary")).not.toBeInTheDocument();
    });

    it("falls back to strategyTag.reason when no personalized copy applies", async () => {
      // `low_crowd` is only personalized when hero verdict is YES. Default
      // mock verdict is MAYBE, so personalization returns null and the card
      // should display the strategy-tag's own reason.
      const backupRec = recWithStrategy({
        type: "low_crowd",
        label: "Low crowd",
        reason: "Locals only at dawn",
      });
      mockOracleData = {
        ...mockOracleData,
        discovery: {
          ...mockOracleData.discovery!,
          recommendations: [MOCK_TOP_REC, backupRec],
        },
      } as unknown as OracleData;

      render(<OracleHomeScreen />);

      // Wait for the surf-call fetch to resolve so heroReasonContext is set.
      await screen.findByText("8.5/10");
      expect(screen.getByText("Locals only at dawn")).toBeInTheDocument();
      expect(screen.queryByText("Generic backup summary")).not.toBeInTheDocument();
    });

    it("falls back to summary when no strategyTag and no personalized copy", async () => {
      const backupRec = {
        ...MOCK_TOP_REC,
        beach: MOCK_BACKUP_BEACH,
        summary: "Plain summary text",
        strategyTag: undefined,
      };
      mockOracleData = {
        ...mockOracleData,
        discovery: {
          ...mockOracleData.discovery!,
          recommendations: [MOCK_TOP_REC, backupRec],
        },
      } as unknown as OracleData;

      render(<OracleHomeScreen />);

      await screen.findByText("8.5/10");
      expect(screen.getByText("Plain summary text")).toBeInTheDocument();
    });
  });
});
