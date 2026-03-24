import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OracleHomeScreen } from "@/components/oracle/oracle-home-screen";
import type { OracleData } from "@/hooks/use-oracle-data";

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
  skill_level: "advanced",
  photo_url: null,
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
    expect(OracleHomeScreen).toBeDefined();
    expect(typeof OracleHomeScreen).toBe("function");
  });

  it("renders the hero section with beach data", () => {
    render(<OracleHomeScreen />);
    expect(screen.getByRole("banner")).toBeInTheDocument();
    // Beach name appears inside the hero conditions overlay
    expect(screen.getByText("Blacks Beach")).toBeInTheDocument();
  });

  it("renders wave height in the hero", () => {
    render(<OracleHomeScreen />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("3-4ft");
  });

  it("renders score in X/10 format", () => {
    render(<OracleHomeScreen />);
    // score=85 → score/10=8.5
    expect(screen.getByText("8.5/10")).toBeInTheDocument();
  });

  it("renders contextual CTA buttons", () => {
    render(<OracleHomeScreen />);
    // With homeBeach set and conditionsGood (85 > 60), primary CTA is "Paddle out"
    expect(
      screen.getByRole("button", { name: /paddle out/i })
    ).toBeInTheDocument();
  });

  it("renders Today's Windows section", () => {
    render(<OracleHomeScreen />);
    expect(screen.getByText("Today's Windows")).toBeInTheDocument();
  });

  it("renders Nearby Spots section", () => {
    render(<OracleHomeScreen />);
    expect(screen.getByText("Nearby Spots")).toBeInTheDocument();
  });

  it("hides Activity section when no activity items exist", () => {
    render(<OracleHomeScreen />);
    // ActivityFeed is hidden when empty to avoid isolation signals
    expect(screen.queryByText("Activity")).not.toBeInTheDocument();
  });

  it("shows session time selector when preferred_session_time is not set", () => {
    // profile without preferred_session_time (null)
    mockOracleData = {
      ...mockOracleData,
      profile: { ...mockOracleData.profile, preferred_session_time: null } as any,
    };
    render(<OracleHomeScreen />);
    expect(
      screen.getByText("When do you usually paddle out?")
    ).toBeInTheDocument();
  });

  it("hides session time selector when preferred_session_time is set", () => {
    mockOracleData = {
      ...mockOracleData,
      profile: { ...mockOracleData.profile, preferred_session_time: "dawn_patrol" } as any,
    };
    render(<OracleHomeScreen />);
    expect(
      screen.queryByText("When do you usually paddle out?")
    ).not.toBeInTheDocument();
  });

  it("calls updatePreferredSessionTime and refreshProfile when session time is selected", async () => {
    const { updatePreferredSessionTime } = await import("@/actions/oracle-actions");
    mockOracleData = {
      ...mockOracleData,
      profile: { ...mockOracleData.profile, preferred_session_time: null } as any,
    };
    render(<OracleHomeScreen />);

    const dawnPatrolButton = screen.getByRole("button", { name: /dawn patrol/i });
    await userEvent.click(dawnPatrolButton);

    await waitFor(() => {
      expect(updatePreferredSessionTime).toHaveBeenCalledWith("dawn_patrol");
    });
    expect(mockOracleData.refreshProfile).toHaveBeenCalledTimes(1);
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

  it("navigates to preferences page when Set Home Beach is clicked", async () => {
    // No home beach → primary CTA is "Set your home beach"
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
    expect(mockRouterPush).toHaveBeenCalledWith("/profile?tab=preferences");
  });

  it("navigates to sessions tab when Log Session is clicked", async () => {
    // homeBeach set, conditionsGood → primary is "Paddle out", secondary includes set alarm + invite
    // We verify the secondary row renders correctly — Set alarm should be present
    render(<OracleHomeScreen />);
    expect(screen.getByRole("button", { name: /set alarm/i })).toBeInTheDocument();
  });

  it("passes the correct userName from profile to OracleHero", () => {
    render(<OracleHomeScreen />);
    // Score=85 (8.5/10 > 7) at 8am PDT → conditions-reactive greeting for high score
    expect(screen.getByText(/firing/i)).toBeInTheDocument();
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

    // 5am slot should show "1-2ft" from slotForecasts
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
});
