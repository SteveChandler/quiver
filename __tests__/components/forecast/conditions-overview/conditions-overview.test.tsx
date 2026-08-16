import { render, screen } from "@testing-library/react";
import { ConditionsOverview } from "@/components/forecast/conditions-overview/conditions-overview";
import type { DaySummary } from "@/lib/utils/horizon-strip-utils";
import type { EnrichedDaySummary } from "@/lib/utils/enriched-day-summary";
import type { EnhancedForecastEntity } from "@/types/forecast";
import type { Beach } from "@/types/database";

// Mock child components
jest.mock("@/components/forecast/conditions-overview/best-day-hero", () => ({
  BestDayHero: ({ bestDay, otherGoodDays }: any) => (
    <div data-testid="best-day-hero">
      <div data-testid="best-day-score">{bestDay.score}</div>
      <div data-testid="best-day-date">{bestDay.fullDate}</div>
      <div data-testid="other-good-days-count">{otherGoodDays.length}</div>
    </div>
  ),
}));

jest.mock("@/components/forecast/conditions-overview/explore-more-links", () => ({
  ExploreMoreLinks: ({ beach }: any) => (
    <div data-testid="explore-more-links">
      Explore links for {beach.name}
    </div>
  ),
}));

// Mock next/dynamic to return a simple component
jest.mock("next/dynamic", () => ({
  __esModule: true,
  default: (fn: any) => {
    const Component = ({ days }: any) => (
      <div data-testid="outlook-bar-chart">
        Chart with {days.length} days
      </div>
    );
    Component.displayName = "OutlookBarChart";
    return Component;
  },
}));

// Mock enrichDaySummaries utility
const mockEnrichDaySummaries = jest.fn();
jest.mock("@/lib/utils/enriched-day-summary", () => ({
  enrichDaySummaries: (
    days: DaySummary[],
    forecasts: EnhancedForecastEntity[],
    windOffshoreDeg?: number | null,
    beachTimezone?: string | null,
  ) => mockEnrichDaySummaries(
    days,
    forecasts,
    windOffshoreDeg,
    beachTimezone,
  ),
}));

function createMockDay(overrides: Partial<EnrichedDaySummary> = {}): EnrichedDaySummary {
  return {
    fullDate: "2026-02-10",
    dayName: "Mon",
    date: "Feb 10",
    score: 70,
    tier: "good",
    minHeight: 3,
    maxHeight: 5,
    period: 12,
    bestTime: "08:00",
    windConditions: "offshore",
    bestTimeSlot: "morning",
    windSpeed: "5 mph",
    isToday: false,
    ...overrides,
  };
}

function createMockBeach(overrides: Partial<Beach> = {}): Beach {
  return {
    id: "beach-1",
    name: "Blacks Beach",
    state: "CA",
    city: "San Diego",
    center_lat: 32.8868,
    center_lng: -117.2509,
    ...overrides,
  } as Beach;
}

const mockForecasts: EnhancedForecastEntity[] = [];

function createMockForecast(
  overrides: Partial<EnhancedForecastEntity> = {}
): EnhancedForecastEntity {
  return {
    id: "forecast-1",
    beach_id: "beach-1",
    forecast_at: "2026-05-12T15:00:00Z",
    forecast_date: "2026-05-12",
    forecast_time: "15:00:00",
    wave_height: "4",
    wave_period: "12",
    wave_direction: "W",
    swell_1_height: "3 ft",
    swell_1_period: "14s",
    swell_1_direction: "W",
    swell_2_height: "1 ft",
    swell_2_period: "10s",
    swell_2_direction: "SSW",
    wind_wave_height: "2 ft",
    wind_wave_period: "6s",
    wind_wave_direction: "NW",
    wind_speed: "8 mph",
    wind_direction: "NW",
    tide_height: "3.2 ft",
    tide_status: "rising",
    weather_condition: "Partly cloudy",
    air_temperature: "61°F",
    water_temp: "57°F",
    confidence_score: 74,
    data_source: "NOAA_NWS",
    created_at: "2026-02-10T00:00:00Z",
    updated_at: "2026-02-10T00:00:00Z",
    ...overrides,
  };
}

describe("ConditionsOverview", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-05-12T18:00:00Z"));
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("renders empty state when no forecast data available", () => {
    mockEnrichDaySummaries.mockReturnValue([]);

    const beach = createMockBeach();
    render(
      <ConditionsOverview
        horizonDaySummaries={[]}
        forecasts={mockForecasts}
        beach={beach}
      />
    );

    expect(screen.getByText("No forecast data available")).toBeInTheDocument();
    expect(screen.queryByTestId("best-day-hero")).not.toBeInTheDocument();
  });

  it("selects best day with highest score in normal mode", () => {
    const enrichedDays = [
      createMockDay({ fullDate: "2026-02-10", score: 70 }),
      createMockDay({ fullDate: "2026-02-11", score: 85 }),
      createMockDay({ fullDate: "2026-02-12", score: 60 }),
    ];
    mockEnrichDaySummaries.mockReturnValue(enrichedDays);

    const beach = createMockBeach({
      timezone: "America/Los_Angeles",
    });
    render(
      <ConditionsOverview
        horizonDaySummaries={[]}
        forecasts={mockForecasts}
        beach={beach}
      />
    );

    expect(screen.getByTestId("best-day-score")).toHaveTextContent("85");
    expect(screen.getByTestId("best-day-date")).toHaveTextContent("2026-02-11");
    expect(mockEnrichDaySummaries).toHaveBeenCalledWith(
      [],
      mockForecasts,
      undefined,
      "America/Los_Angeles",
    );
  });

  // GOOD is >= 70, aligned to the go/no-go threshold so a label can never
  // contradict the call beside it. 65 is FAIR and no longer qualifies.
  it("filters otherGoodDays to only include days with score >= 70", () => {
    const enrichedDays = [
      createMockDay({ fullDate: "2026-02-10", score: 85 }), // best
      createMockDay({ fullDate: "2026-02-11", score: 75 }), // good
      createMockDay({ fullDate: "2026-02-12", score: 70 }), // good, on the boundary
      createMockDay({ fullDate: "2026-02-13", score: 65 }), // FAIR — excluded
      createMockDay({ fullDate: "2026-02-14", score: 40 }), // excluded
    ];
    mockEnrichDaySummaries.mockReturnValue(enrichedDays);

    const beach = createMockBeach();
    render(
      <ConditionsOverview
        horizonDaySummaries={[]}
        forecasts={mockForecasts}
        beach={beach}
      />
    );

    // otherGoodDays should have 2 days (75 and 70)
    expect(screen.getByTestId("other-good-days-count")).toHaveTextContent("2");
  });

  it("limits otherGoodDays to maximum of 4 days", () => {
    const enrichedDays = [
      createMockDay({ fullDate: "2026-02-10", score: 90 }), // best
      createMockDay({ fullDate: "2026-02-11", score: 85 }),
      createMockDay({ fullDate: "2026-02-12", score: 80 }),
      createMockDay({ fullDate: "2026-02-13", score: 75 }),
      createMockDay({ fullDate: "2026-02-14", score: 70 }),
      createMockDay({ fullDate: "2026-02-15", score: 65 }),
      createMockDay({ fullDate: "2026-02-16", score: 60 }),
    ];
    mockEnrichDaySummaries.mockReturnValue(enrichedDays);

    const beach = createMockBeach();
    render(
      <ConditionsOverview
        horizonDaySummaries={[]}
        forecasts={mockForecasts}
        beach={beach}
      />
    );

    // Should limit to top 4 (scores 85, 80, 75, 70)
    expect(screen.getByTestId("other-good-days-count")).toHaveTextContent("4");
  });

  it("returns top 3 days when all scores are below 60", () => {
    const enrichedDays = [
      createMockDay({ fullDate: "2026-02-10", score: 55 }), // best
      createMockDay({ fullDate: "2026-02-11", score: 50 }),
      createMockDay({ fullDate: "2026-02-12", score: 45 }),
      createMockDay({ fullDate: "2026-02-13", score: 40 }),
      createMockDay({ fullDate: "2026-02-14", score: 35 }),
    ];
    mockEnrichDaySummaries.mockReturnValue(enrichedDays);

    const beach = createMockBeach();
    render(
      <ConditionsOverview
        horizonDaySummaries={[]}
        forecasts={mockForecasts}
        beach={beach}
      />
    );

    // When all below 60, take top 3 (scores 50, 45, 40)
    expect(screen.getByTestId("other-good-days-count")).toHaveTextContent("3");
  });

  it("renders OutlookBarChart for every viewer (no gate)", () => {
    const enrichedDays = [
      createMockDay({ fullDate: "2026-02-10", score: 70 }),
      createMockDay({ fullDate: "2026-02-11", score: 80 }),
    ];
    mockEnrichDaySummaries.mockReturnValue(enrichedDays);

    const beach = createMockBeach();
    render(
      <ConditionsOverview
        horizonDaySummaries={[]}
        forecasts={mockForecasts}
        beach={beach}
      />
    );

    expect(screen.getByTestId("outlook-bar-chart")).toBeInTheDocument();
  });

  it("always renders ExploreMoreLinks", () => {
    const enrichedDays = [createMockDay({ fullDate: "2026-02-10", score: 70 })];
    mockEnrichDaySummaries.mockReturnValue(enrichedDays);

    const beach = createMockBeach({ name: "Blacks Beach" });
    render(
      <ConditionsOverview
        horizonDaySummaries={[]}
        forecasts={mockForecasts}
        beach={beach}
      />
    );

    expect(screen.getByTestId("explore-more-links")).toBeInTheDocument();
    expect(screen.getByText(/Blacks Beach/)).toBeInTheDocument();
  });

  it("renders chart with correct number of days", () => {
    const enrichedDays = [
      createMockDay({ fullDate: "2026-02-10", score: 70 }),
      createMockDay({ fullDate: "2026-02-11", score: 75 }),
      createMockDay({ fullDate: "2026-02-12", score: 80 }),
    ];
    mockEnrichDaySummaries.mockReturnValue(enrichedDays);

    const beach = createMockBeach();
    render(
      <ConditionsOverview
        horizonDaySummaries={[]}
        forecasts={mockForecasts}
        beach={beach}
      />
    );

    expect(screen.getByTestId("outlook-bar-chart")).toHaveTextContent(
      "Chart with 3 days"
    );
  });

  it("renders detailed forecast rows below the outlook chart", () => {
    const enrichedDays = [createMockDay({ fullDate: "2026-02-10", score: 70 })];
    mockEnrichDaySummaries.mockReturnValue(enrichedDays);

    const beach = createMockBeach();
    render(
      <ConditionsOverview
        horizonDaySummaries={[]}
        forecasts={[createMockForecast()]}
        beach={beach}
        beachTimezone="America/Los_Angeles"
      />
    );

    expect(screen.getByTestId("outlook-bar-chart")).toBeInTheDocument();
    expect(screen.getByTestId("detailed-forecast-table")).toBeInTheDocument();
    expect(screen.getByText("Full Forecast")).toBeInTheDocument();
    expect(screen.getByText("Today, Tue, May 12")).toBeInTheDocument();
    expect(screen.getByText("Partly cloudy 61°F")).toBeInTheDocument();
    expect(screen.getByText("NOAA NWS")).toBeInTheDocument();
  });
});
