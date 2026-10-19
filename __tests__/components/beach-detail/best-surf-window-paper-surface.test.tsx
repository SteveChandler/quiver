import { render, screen } from "@testing-library/react";
import { BestSurfWindow } from "@/components/beach-detail/best-surf-window";
import { UnifiedSurfCard } from "@/components/beach-detail/unified-surf-card";
import { useDataFetcher } from "@/hooks/use-data-fetcher";
import { useMagicHour } from "@/hooks/use-magic-hour";
import { findNextBestWindow } from "@/lib/utils/morning-intel-utils";
import { getWindowStatus } from "@/lib/utils/window-status";
import type { EnhancedForecastEntity } from "@/types/forecast";
import type { SurfCallResult } from "@/lib/utils/surf-call-logic";

jest.mock("@/hooks/use-data-fetcher");
jest.mock("@/hooks/use-magic-hour");
jest.mock("@/lib/utils/morning-intel-utils");
jest.mock("@/lib/utils/window-status");
jest.mock("next/navigation", () => ({
  usePathname: jest.fn(() => "/ca/carlsbad/terramar-point"),
}));
jest.mock("@/components/share/share-sheet", () => ({
  ShareSheet: () => null,
}));
jest.mock("@/lib/utils/timezone-utils", () => ({
  DEFAULT_TIMEZONE: "America/Los_Angeles",
  resolveBeachTimezone: jest.fn((tz?: string | null) => tz || "America/Los_Angeles"),
  getLocalDateString: jest.fn(() => "2024-01-15"),
}));

/**
 * The beach page paints these cards on cream paper (zine.css forces
 * `.bg-card` to #F4EBD8), but body carries `.theme-retro-dark`, so:
 *   - globals.css remaps these light-theme text/background utilities to
 *     dark-stage colours with !important (white headings, lime times, pale
 *     blue sublines, navy tiles), and
 *   - every `dark:` utility is live (tailwind darkMode selector).
 * Neither survives on paper, so the card must ink itself with arbitrary
 * paper hexes or with palette shades the remap leaves alone.
 */
const DARK_THEME_REMAPPED: RegExp[] = [
  /(^|\s)dark:/,
  /(^|\s)text-(gray|slate)-(300|400|500|600|700|800|900)(\s|\/|$)/,
  /(^|\s)text-blue-(500|600|700|800|900)(\s|\/|$)/,
  /(^|\s)text-sky-(500|600|700)(\s|\/|$)/,
  /(^|\s)text-(green|emerald)-(500|600)(\s|\/|$)/,
  /(^|\s)text-(amber|orange|red|teal|purple|rose)-(600|700)(\s|\/|$)/,
  /(^|\s)text-cyan-(600|700|800)(\s|\/|$)/,
  /(^|\s)text-yellow-(400|500)(\s|\/|$)/,
  /(^|\s)bg-white\/[89]\d(\s|$)/,
  /(^|\s)bg-(gray|slate)-(1\d\d|5\d?)(\s|\/|$)/,
];

function remappedIn(el: Element): string[] {
  const cls = el.getAttribute("class") ?? "";
  return DARK_THEME_REMAPPED.flatMap((re) => {
    const match = cls.match(re);
    return match ? [`${el.tagName.toLowerCase()}: ${match[0].trim()}`] : [];
  });
}

function darkThemeClasses(root: Element): string[] {
  return [...root.querySelectorAll("[class]")].flatMap(remappedIn);
}

const mockUseDataFetcher = useDataFetcher as jest.Mock;
const mockUseMagicHour = useMagicHour as jest.Mock;
const mockFindNextBestWindow = findNextBestWindow as jest.Mock;
const mockGetWindowStatus = getWindowStatus as jest.Mock;

const intel = {
  id: "intel-1",
  beach_id: "b",
  forecast_date: "2024-01-15",
  best_window_start: "06:00:00",
  best_window_end: "09:00:00",
  best_window_description: "Clean offshore winds with rising swell",
  surf_min_ft: 3,
  surf_max_ft: 5,
  surf_description: "Chest to head high",
  wind_speed_mph: 5,
  wind_direction_text: "NE",
  wind_quality: "Offshore",
  tide_height_ft: 2.5,
  tide_time: "07:30:00",
  tide_optimal_range: "2-4 ft",
  confidence: "High",
  conditions_score: 8.5,
  recommendation: "Perfect morning session with offshore winds",
  generated_at: "2024-01-15T05:00:00Z",
  raw_intel_data: {},
};

const forecasts = [
  {
    id: "1",
    beach_id: "b",
    forecast_at: "2024-01-15T20:00:00Z",
    forecast_date: "2024-01-15",
    forecast_time: "12:00:00",
    wind_speed: 5,
    wind_direction: 45,
    wave_period: 12,
    swell_1_period: 14,
    tide_height: 2.5,
  },
] as unknown as EnhancedForecastEntity[];

const boardPick = {
  boardName: "Twin pin",
  boardType: "twin",
  reason: "Twin pin: an all-rounder for 3-4 ft",
};

const props = {
  beachId: "b",
  beachName: "Terramar Point",
  beachTimezone: "America/Los_Angeles",
  forecasts,
  boardPick,
  windows: [
    {
      start: "2024-01-15T17:00:00Z",
      end: "2024-01-15T22:00:00Z",
      avgScore: 88,
      peakScore: 92,
      character: { label: "Lined up — clean wind, good tide", category: "medium-clean" },
      reasons: ["Clean wind"],
    },
    {
      start: "2024-01-15T14:00:00Z",
      end: "2024-01-15T16:00:00Z",
      avgScore: 60,
      character: { label: "Soft and small", category: "small-weak" },
    },
  ],
  relativeContext: {
    isBestOfWeek: true,
    trend: "improving" as const,
    incomingSwell: { date: "2024-01-18T00:00:00Z", description: "NW swell" },
  },
};

describe("BestSurfWindow on the cream paper surface", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseMagicHour.mockReturnValue({
      magicHour: {
        found: true,
        peakTime: new Date("2024-01-15T23:30:00Z"),
        windowStart: "3:00 PM",
        windowEnd: "4:00 PM",
        confidence: 0.85,
        windQuality: "perfect",
        swellMatch: true,
        tideInRange: true,
      },
      isLoading: false,
      error: null,
    });
    mockFindNextBestWindow.mockReturnValue({
      startTime: "15:00:00",
      endTime: "18:00:00",
      description: "Excellent conditions",
      conditions: "Light winds, quality swell",
    });
    mockGetWindowStatus.mockReturnValue({ status: "upcoming", message: "Starts in 1 hour" });
  });

  it("flags the dark-theme utilities it guards against", () => {
    const probe = document.createElement("div");
    probe.innerHTML =
      '<h4 class="text-blue-900 dark:text-blue-100"></h4><p class="text-green-600"></p>';
    expect(darkThemeClasses(probe)).toEqual([
      "h4: dark:",
      "h4: text-blue-900",
      "p: text-green-600",
    ]);
  });

  it("uses no dark-theme utilities in the no-intel best-window card", () => {
    mockUseDataFetcher.mockReturnValue({
      data: null,
      loading: false,
      error: new Error("no intel"),
      refetch: jest.fn(),
    });

    const { container } = render(<BestSurfWindow {...props} />);

    expect(screen.getByText("Most Favorable Window")).toBeInTheDocument();
    expect(screen.getByText(/Grab your Twin pin/)).toBeInTheDocument();
    expect(screen.getByText("Magic Hour")).toBeInTheDocument();
    expect(darkThemeClasses(container)).toEqual([]);
  });

  it.each(["upcoming", "current", "passed"] as const)(
    "uses no dark-theme utilities in the %s daily-intel card",
    (status) => {
      mockGetWindowStatus.mockReturnValue({ status, message: "msg" });
      mockUseDataFetcher.mockReturnValue({
        data: intel,
        loading: false,
        error: null,
        refetch: jest.fn(),
      });

      const { container } = render(<BestSurfWindow {...props} />);

      expect(screen.getByText("Surf")).toBeInTheDocument();
      expect(darkThemeClasses(container)).toEqual([]);
    }
  );

  it("uses no dark-theme utilities when there is no next window and no Magic Hour", () => {
    mockGetWindowStatus.mockReturnValue({ status: "passed", message: "Window has passed" });
    mockFindNextBestWindow.mockReturnValue(null);
    mockUseMagicHour.mockReturnValue({ magicHour: null, isLoading: true, error: null });
    mockUseDataFetcher.mockReturnValue({
      data: intel,
      loading: false,
      error: null,
      refetch: jest.fn(),
    });

    const { container } = render(<BestSurfWindow {...props} />);

    expect(screen.getByText("Current Conditions")).toBeInTheDocument();
    expect(darkThemeClasses(container)).toEqual([]);
  });
});

describe("UnifiedSurfCard callouts on the cream paper surface", () => {
  const surfCall: SurfCallResult = {
    verdict: "YES",
    bestWindowStart: "2024-01-15T16:00:00Z",
    bestWindowEnd: "2024-01-15T19:00:00Z",
    windowMinutes: 180,
    shortWindow: true,
    waveHeight: "3-4 ft",
    windDescription: "Light offshore",
    windSpeed: "5 mph",
    windCompass: "NE",
    windType: "offshore",
    tideDescription: "Rising",
    tidePhase: "rising",
    tideHeight: null,
    nextTideType: "high",
    nextTideAt: "2024-01-15T20:00:00Z",
    whySentence: "Clean offshore wind lines up a quality swell.",
    forecastConfidence: 70,
    lowForecastConfidence: true,
    score: 80,
    peakTime: "2024-01-15T17:00:00Z",
    trendTags: ["Winds Building", "Tide Filling In", "Tide Draining", "Clean Swell"],
    updatedAt: "2024-01-15T15:00:00Z",
    isCalibrated: true,
    rideableWavesPerHour: null,
    dominantBeatIntervalS: null,
    cautions: ["Watch for a crowded peak"],
  };

  it("inks the chips, tags, board pick and cautions without dark-theme utilities", () => {
    render(
      <UnifiedSurfCard
        surfCall={surfCall}
        beachTimezone="America/Los_Angeles"
        beachName="Terramar Point"
        boardPick={boardPick}
        relativeContext={props.relativeContext}
      />
    );

    const callouts = [
      screen.getByText("Best conditions this week"),
      screen.getByText(/Swell incoming/),
      screen.getByText(/Grab your Twin pin/),
      screen.getByText("Twin pin: an all-rounder for 3-4 ft"),
      screen.getByText("Short window"),
      screen.getByText("Winds Building"),
      screen.getByText("Tide Filling In"),
      screen.getByText("Tide Draining"),
      screen.getByText("Clean Swell"),
      screen.getByText("Watch for a crowded peak"),
      screen.getByText(/Low Confidence/),
    ];
    // Chips and callouts carry their wash on the element or its parent.
    const found = callouts.flatMap((el) => [
      ...remappedIn(el),
      ...(el.parentElement ? remappedIn(el.parentElement) : []),
    ]);

    expect(found).toEqual([]);
  });
});
