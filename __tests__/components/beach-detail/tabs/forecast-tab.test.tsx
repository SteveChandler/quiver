/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { ForecastTab } from "@/components/beach-detail/tabs/forecast-tab";
import type { Beach } from "@/types/database";
import type { EnhancedForecastEntity } from "@/types/forecast";
import type { SurfCallResult } from "@/lib/utils/surf-call-logic";

// Mock ALL child components as simple divs with data-testid
jest.mock("@/components/beach-detail/best-surf-window", () => ({
  BestSurfWindow: (props: any) => <div data-testid="best-surf-window" />,
}));
jest.mock("@/components/forecast/horizon-strip", () => ({
  HorizonStrip: (props: any) => (
    <div
      data-testid="horizon-strip"
      data-days={JSON.stringify(props.days?.length)}
      data-gate-from={
        props.publicGateFromIndex === undefined
          ? undefined
          : String(props.publicGateFromIndex)
      }
    />
  ),
}));
jest.mock("@/components/ui/public-content-gate", () => ({
  PublicContentGate: ({ children, ...props }: any) => (
    <div data-testid="public-gate" data-source={props.source}>
      {children}
    </div>
  ),
}));
jest.mock("@/components/beach-detail/tide-conditions-card", () => ({
  TideConditionsCard: () => <div data-testid="tide-conditions-card" />,
}));
jest.mock("@/components/beach-detail/tide-alert", () => ({
  TideAlertBadge: () => <div data-testid="tide-alert" />,
}));
jest.mock("@/components/beach-detail/embed-code-modal", () => ({
  EmbedCodeButton: () => <div data-testid="embed-code" />,
}));
jest.mock("@/components/beach-detail/unified-surf-card", () => ({
  UnifiedSurfCard: () => <div data-testid="unified-surf-card" />,
}));
jest.mock("@/components/beach-detail/tide-status-strip", () => ({
  TideStatusStrip: (props: any) => <div data-testid="tide-status-strip" />,
}));
jest.mock("@/components/beach-detail/tide-chart-section", () => ({
  TideChartSection: (props: any) => <div data-testid="tide-chart-section" />,
}));

// Mock dynamic imports
jest.mock("next/dynamic", () => (fn: any) => {
  const Component = (props: any) => <div data-testid="dynamic-component" {...props} />;
  Component.displayName = "DynamicMock";
  return Component;
});

// Mock hooks
jest.mock("@/hooks/use-dynamic-tide", () => ({
  useDynamicTide: jest.fn(() => ({
    currentDirection: "rising",
    minutesToDirectionChange: 120,
    minutesUntil: 60,
    nextTide: { type: "high", height: 5.2, time: Date.now() / 1000 + 3600 },
  })),
}));
jest.mock("@/hooks/use-sun-times", () => ({
  useSunTimes: jest.fn(() => ({
    sunrise: new Date("2026-02-10T06:30:00"),
    sunset: new Date("2026-02-10T17:30:00"),
  })),
}));
const mockUseAuth = jest.fn(() => ({ user: null as { id: string } | null }));
jest.mock("@/context/auth-context", () => ({
  useAuth: () => mockUseAuth(),
}));

// Mock useTrackEvent hook
const mockTrackEvent = jest.fn();
jest.mock("@/hooks/use-track-event", () => ({
  useTrackEvent: () => ({ track: mockTrackEvent }),
}));

// Mock utilities
jest.mock("@/lib/analytics", () => ({
  track: jest.fn(),
}));
jest.mock("@/lib/utils/text-utils", () => ({
  slugify: jest.fn((s) => s.toLowerCase().replace(/\s+/g, "-")),
}));
jest.mock("@/lib/utils/timezone-utils", () => ({
  resolveBeachTimezone: jest.fn(() => "America/Los_Angeles"),
  getLocalDateString: jest.fn(() => "2026-02-10"),
  getLocalHour: jest.fn((date: Date) => date.getUTCHours()),
}));
jest.mock("@/lib/utils/horizon-strip-utils", () => ({
  aggregateDayForecasts: jest.fn(() => []),
}));
jest.mock("@/lib/surf/tide-direction", () => ({
  getTideAlert: jest.fn(() => null),
}));
jest.mock("@/lib/utils/date-time", () => ({
  formatTimeInBeachTimezone: jest.fn(() => "7:00 AM"),
}));

// Mock Tabs components — TabsTrigger threads onValueChange from Tabs via context
jest.mock("@/components/ui/tabs", () => {
  const React = require("react") as typeof import("react");
  const Ctx = React.createContext<((v: string) => void) | undefined>(undefined);
  return {
    Tabs: ({ children, value, onValueChange, ...props }: any) => (
      <Ctx.Provider value={onValueChange}>
        <div data-testid="tabs" data-value={value} {...props}>
          {children}
        </div>
      </Ctx.Provider>
    ),
    TabsContent: ({ children, value, ...props }: any) => (
      <div data-testid={`tab-content-${value}`} {...props}>
        {children}
      </div>
    ),
    TabsList: ({ children }: any) => <div data-testid="tabs-list">{children}</div>,
    TabsTrigger: ({ children, value }: any) => {
      const onValueChange = React.useContext(Ctx);
      return (
        <button
          data-testid={`tab-trigger-${value}`}
          onClick={() => onValueChange?.(value)}
        >
          {children}
        </button>
      );
    },
  };
});

// Import mocked dependencies
import { track } from "@/lib/analytics";
import { aggregateDayForecasts } from "@/lib/utils/horizon-strip-utils";

// Mock beach + forecast factories
const mockBeach: Beach = {
  id: "beach-1",
  name: "Test Beach",
  slug: "test-beach",
  city: "San Diego",
  state: "CA",
  center_lat: 32.8,
  center_lng: -117.2,
  preferred_tide_direction: null,
  best_conditions_prose: "Best at mid to high tide",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  address: "123 Beach St",
  description: "Test beach description",
  amenities: [],
  parking_info: "Free parking",
  access_info: "Public access",
  hazards: [],
  best_season: "Summer",
  crowd_level: "Moderate",
  skill_level: "Intermediate",
  google_maps_url: null,
  photo_url: null,
  has_camera: false,
  is_featured: false,
  is_premium: false,
  average_rating: null,
  total_reviews: 0,
  county: "San Diego County",
  region: "Southern California",
  country: "USA",
  timezone: "America/Los_Angeles",
  lat: 32.8,
  lng: -117.2,
  popularity_score: null,
  seo_title: null,
  seo_description: null,
  seo_keywords: null,
  breaks: [],
} as any;

const mockForecast: EnhancedForecastEntity = {
  id: "f1",
  beach_id: "beach-1",
  forecast_at: "2026-02-10T12:00Z",
  forecast_date: "2026-02-10",
  forecast_time: "12:00",
  wave_height: "4.5",
  wave_period: "12",
  wind_speed: "8",
  wind_direction: "NW",
  wave_direction: "SW",
  water_temp: "60",
  tide_height: "3.2",
  tide_status: "rising",
  swell_1_direction: "SSW",
  swell_1_period: "14",
  next_tide_type: "High Tide",
  next_tide_time: "14:30",
  next_tide_height: "5.2 ft",
  next_tide_at: null,
  created_at: "2026-02-10T00:00:00Z",
  updated_at: "2026-02-10T00:00:00Z",
  swell_1_height: "3.5",
  swell_2_height: null,
  swell_2_period: null,
  swell_2_direction: null,
  swell_3_height: null,
  swell_3_period: null,
  swell_3_direction: null,
  air_temp: "65",
  visibility: "10",
  cloud_cover: "20",
  precipitation_probability: "0",
  uv_index: "5",
  beach: mockBeach,
} as any;

describe("ForecastTab", () => {
  const defaultProps = {
    beach: mockBeach,
    forecasts: [mockForecast],
    currentForecast: mockForecast,
    beachTimezone: "America/Los_Angeles",
    surfCall: null,
    surfCallIsTomorrow: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockTrackEvent.mockClear();
    mockUseAuth.mockReturnValue({ user: null });
  });

  describe("Tab Rendering", () => {
    it("renders three sub-tab triggers: Today, Tides, Conditions", () => {
      render(<ForecastTab {...defaultProps} />);

      expect(screen.getByTestId("tab-trigger-today")).toBeInTheDocument();
      expect(screen.getByTestId("tab-trigger-tides")).toBeInTheDocument();
      expect(screen.getByTestId("tab-trigger-conditions")).toBeInTheDocument();

      expect(screen.getByTestId("tab-trigger-today")).toHaveTextContent("Today");
      expect(screen.getByTestId("tab-trigger-tides")).toHaveTextContent("Tides");
      expect(screen.getByTestId("tab-trigger-conditions")).toHaveTextContent("Conditions");
    });

    it("defaults to today tab when no defaultSubTab prop provided", () => {
      render(<ForecastTab {...defaultProps} />);

      const tabs = screen.getByTestId("tabs");
      expect(tabs).toHaveAttribute("data-value", "today");
    });

    it("respects defaultSubTab prop when conditions is passed", () => {
      render(<ForecastTab {...defaultProps} defaultSubTab="conditions" />);

      const tabs = screen.getByTestId("tabs");
      expect(tabs).toHaveAttribute("data-value", "conditions");
    });

    it("respects defaultSubTab prop when tides is passed", () => {
      render(<ForecastTab {...defaultProps} defaultSubTab="tides" />);

      const tabs = screen.getByTestId("tabs");
      expect(tabs).toHaveAttribute("data-value", "tides");
    });
  });

  describe("Today Tab Content", () => {
    it("renders Current Conditions section", () => {
      render(<ForecastTab {...defaultProps} />);

      expect(screen.getByText("Current Conditions")).toBeInTheDocument();
      expect(screen.getByText("Current conditions")).toBeInTheDocument();
      expect(screen.queryByText("Right now")).not.toBeInTheDocument();
    });

    it("labels stale display rows as forecasted conditions", () => {
      render(
        <ForecastTab
          {...defaultProps}
          forecastMetadata={{
            cached: true,
            stale: true,
            missing: false,
            displayStale: true,
            dataAge: "12h old",
            dataSource: "NOAA_NWS",
          }}
        />
      );

      expect(screen.getByTestId("stale-forecast-banner")).toBeInTheDocument();
      expect(screen.getByText("Forecasted Conditions")).toBeInTheDocument();
      expect(
        screen.getByText(/Forecast for 7:00 AM · model updated 12h old/)
      ).toBeInTheDocument();
      expect(screen.queryByText("Right now")).not.toBeInTheDocument();
    });

    it("hides BestSurfWindow for anonymous users", () => {
      mockUseAuth.mockReturnValue({ user: null });
      render(<ForecastTab {...defaultProps} />);

      expect(screen.queryByTestId("best-surf-window")).not.toBeInTheDocument();
    });

    it("renders BestSurfWindow for authenticated users", () => {
      mockUseAuth.mockReturnValue({ user: { id: "u1" } });
      render(<ForecastTab {...defaultProps} />);

      expect(screen.getByTestId("best-surf-window")).toBeInTheDocument();
    });

    it("omits the redundant no-window card for an authenticated NO call", () => {
      mockUseAuth.mockReturnValue({ user: { id: "u1" } });
      render(
        <ForecastTab
          {...defaultProps}
          surfCall={{
            verdict: "NO",
            bestWindowStart: null,
            bestWindowEnd: null,
          } as SurfCallResult}
        />,
      );

      expect(screen.queryByTestId("best-surf-window")).not.toBeInTheDocument();
    });

    it("displays current tide information", () => {
      render(<ForecastTab {...defaultProps} />);

      expect(screen.getByText("Tide")).toBeInTheDocument();
      expect(screen.getByText("Rising")).toBeInTheDocument();
    });

    it("displays wind information", () => {
      render(<ForecastTab {...defaultProps} />);

      expect(screen.getByText("Wind")).toBeInTheDocument();
      expect(screen.getAllByText("8").length).toBeGreaterThan(0);
      expect(screen.getAllByText("NW").length).toBeGreaterThan(0);
    });

    it("displays swell information", () => {
      render(<ForecastTab {...defaultProps} />);

      expect(screen.getByText("Swell")).toBeInTheDocument();
      // Swell pill now renders via WaveHeightDisplay (calibration honesty layer).
      // The numeric range is expanded internally (low → set waves) so we assert
      // the anchor testid rather than the literal input string.
      expect(screen.getByTestId("primary-wave-height")).toBeInTheDocument();
    });

  });

  describe("HorizonStrip Rendering", () => {
    it("renders dynamic N-Day Outlook section when forecasts exist", () => {
      const mockDaySummaries = [
        { date: "2026-02-10", waveHeight: 4.5 },
        { date: "2026-02-11", waveHeight: 5.0 },
      ];
      (aggregateDayForecasts as jest.Mock).mockReturnValue(mockDaySummaries);

      render(<ForecastTab {...defaultProps} />);

      expect(screen.getByText("2-Day Outlook")).toBeInTheDocument();
      expect(screen.getByText("Tap a day to view details")).toBeInTheDocument();
      expect(screen.getByTestId("horizon-strip")).toBeInTheDocument();
    });

    it("passes correct number of days to HorizonStrip", () => {
      const mockDaySummaries = [
        { date: "2026-02-10", waveHeight: 4.5 },
        { date: "2026-02-11", waveHeight: 5.0 },
        { date: "2026-02-12", waveHeight: 4.8 },
      ];
      (aggregateDayForecasts as jest.Mock).mockReturnValue(mockDaySummaries);

      render(<ForecastTab {...defaultProps} />);

      const horizonStrip = screen.getByTestId("horizon-strip");
      expect(horizonStrip).toHaveAttribute("data-days", "3");
    });

    it("does not render HorizonStrip when no forecasts", () => {
      render(<ForecastTab {...defaultProps} forecasts={[]} />);

      expect(screen.queryByTestId("horizon-strip")).not.toBeInTheDocument();
    });
  });

  describe("Anonymous-friendly forecast (gates removed 2026-04-28)", () => {
    it("passes all day summaries to HorizonStrip with no gate", () => {
      // Gates retired 2026-04-28: forecast-tab no longer passes
      // publicGateFromIndex. Every viewer sees the full N-day strip ungated.
      const mockDaySummaries = [
        { date: "2026-02-10", waveHeight: 4.5 },
        { date: "2026-02-11", waveHeight: 5.0 },
        { date: "2026-02-12", waveHeight: 4.8 },
        { date: "2026-02-13", waveHeight: 5.2 },
        { date: "2026-02-14", waveHeight: 4.9 },
      ];
      (aggregateDayForecasts as jest.Mock).mockReturnValue(mockDaySummaries);

      render(<ForecastTab {...defaultProps} />);

      const horizonStrip = screen.getByTestId("horizon-strip");
      expect(horizonStrip).toHaveAttribute("data-days", "5");
      expect(horizonStrip).not.toHaveAttribute("data-gate-from");
    });

    it("renders BestSurfWindow without PublicContentGate for authenticated users", () => {
      mockUseAuth.mockReturnValue({ user: { id: "u1" } });
      render(<ForecastTab {...defaultProps} />);

      expect(screen.queryByTestId("public-gate")).not.toBeInTheDocument();
      expect(screen.getByTestId("best-surf-window")).toBeInTheDocument();
    });
  });

  describe("Tab Switch Analytics", () => {
    it("tracks analytics when Today tab trigger is clicked", () => {
      render(<ForecastTab {...defaultProps} defaultSubTab="tides" />);

      const todayTrigger = screen.getByTestId("tab-trigger-today");
      fireEvent.click(todayTrigger);

      expect(mockTrackEvent).toHaveBeenCalledWith("forecast_interaction", {
        beachId: "beach-1",
        metadata: { action: "view_details", slot: "today" },
        debounceMs: 1000,
      });
    });

    it("tracks analytics when Tides tab trigger is clicked", () => {
      render(<ForecastTab {...defaultProps} />);

      const tidesTrigger = screen.getByTestId("tab-trigger-tides");
      fireEvent.click(tidesTrigger);

      expect(mockTrackEvent).toHaveBeenCalledWith("forecast_interaction", {
        beachId: "beach-1",
        metadata: { action: "view_details", slot: "tides" },
        debounceMs: 1000,
      });
    });

    it("tracks analytics when Conditions tab trigger is clicked", () => {
      render(<ForecastTab {...defaultProps} />);

      const conditionsTrigger = screen.getByTestId("tab-trigger-conditions");
      fireEvent.click(conditionsTrigger);

      expect(mockTrackEvent).toHaveBeenCalledWith("forecast_interaction", {
        beachId: "beach-1",
        metadata: { action: "view_details", slot: "conditions" },
        debounceMs: 1000,
      });
    });
  });

  describe("Tides Tab", () => {
    it("renders TideStatusStrip in Tides tab", () => {
      render(<ForecastTab {...defaultProps} defaultSubTab="tides" />);

      expect(screen.getByTestId("tide-status-strip")).toBeInTheDocument();
    });

    it("renders TideChartSection in Tides tab", () => {
      render(<ForecastTab {...defaultProps} defaultSubTab="tides" />);

      expect(screen.getByTestId("tide-chart-section")).toBeInTheDocument();
    });

    it("renders TideConditionsCard in Tides tab", () => {
      render(<ForecastTab {...defaultProps} defaultSubTab="tides" />);

      expect(screen.getByTestId("tide-conditions-card")).toBeInTheDocument();
    });

    it("renders EmbedCodeButton in Tides tab", () => {
      render(<ForecastTab {...defaultProps} defaultSubTab="tides" />);

      expect(screen.getByTestId("embed-code")).toBeInTheDocument();
    });

    it("renders TideAlertBadge in Tides tab when beach has preferred_tide_direction", () => {
      const beachWithPreferredTide = {
        ...mockBeach,
        preferred_tide_direction: "rising",
      };

      render(
        <ForecastTab
          {...defaultProps}
          beach={beachWithPreferredTide}
          defaultSubTab="tides"
        />
      );

      // TideAlertBadge appears in both Today tab and Tides tab
      const alerts = screen.getAllByTestId("tide-alert");
      expect(alerts.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("No Forecasts", () => {
    it("does not render HorizonStrip when forecasts is empty array", () => {
      render(<ForecastTab {...defaultProps} forecasts={[]} />);

      expect(screen.queryByTestId("horizon-strip")).not.toBeInTheDocument();
    });

    it("does not render N-Day Outlook heading when forecasts is empty", () => {
      render(<ForecastTab {...defaultProps} forecasts={[]} />);

      expect(screen.queryByText(/\d+-Day Outlook/)).not.toBeInTheDocument();
    });

    it("does not render Current Conditions when currentForecast is null", () => {
      render(<ForecastTab {...defaultProps} currentForecast={null} />);

      expect(screen.queryByText("Current Conditions")).not.toBeInTheDocument();
    });
  });

  describe("Tide Alert", () => {
    it("renders TideAlertBadge when beach has preferred_tide_direction", () => {
      const beachWithPreferredTide = {
        ...mockBeach,
        preferred_tide_direction: "rising",
      };

      render(
        <ForecastTab
          {...defaultProps}
          beach={beachWithPreferredTide}
        />
      );

      // TideAlertBadge appears in both Today tab and Tides tab
      const alerts = screen.getAllByTestId("tide-alert");
      expect(alerts.length).toBeGreaterThanOrEqual(1);
    });

    it("does not render TideAlertBadge when beach has no preferred_tide_direction", () => {
      render(<ForecastTab {...defaultProps} />);

      expect(screen.queryByTestId("tide-alert")).not.toBeInTheDocument();
    });
  });

  describe("Secondary Conditions", () => {
    it("displays swell direction in secondary conditions", () => {
      render(<ForecastTab {...defaultProps} />);

      expect(screen.getByText("Swell Direction")).toBeInTheDocument();
      expect(screen.getByText("SSW")).toBeInTheDocument();
    });

    it("displays water temperature in secondary conditions", () => {
      render(<ForecastTab {...defaultProps} />);

      expect(screen.getByText("Water Temp")).toBeInTheDocument();
      expect(screen.getByText("60°F")).toBeInTheDocument();
    });

    it("does not double-append °F when water_temp already includes unit", () => {
      const forecastWithUnit = {
        ...defaultProps.currentForecast!,
        water_temp: "57°F",
      };
      render(
        <ForecastTab
          {...defaultProps}
          currentForecast={forecastWithUnit}
        />
      );

      expect(screen.getByText("57°F")).toBeInTheDocument();
      expect(screen.queryByText("57°F°F")).not.toBeInTheDocument();
    });

    it("displays next tide in secondary conditions", () => {
      render(<ForecastTab {...defaultProps} />);

      const nextTideLabels = screen.getAllByText("Next Tide");
      expect(nextTideLabels.length).toBeGreaterThan(0);
    });

    it("displays daylight (sunrise/sunset) in secondary conditions", () => {
      render(<ForecastTab {...defaultProps} />);

      expect(screen.getByText("Daylight")).toBeInTheDocument();
    });
  });

});
