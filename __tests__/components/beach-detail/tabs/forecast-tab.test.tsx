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
jest.mock("@/components/forecast/forecast-table", () => ({
  SimplifiedForecastTable: (props: any) => <div data-testid="forecast-table" />,
}));
jest.mock("@/components/forecast/tide-chart-enhanced", () => ({
  TideChartEnhanced: (props: any) => <div data-testid="tide-chart" />,
}));
jest.mock("@/components/forecast/horizon-strip", () => ({
  HorizonStrip: (props: any) => (
    <div
      data-testid="horizon-strip"
      data-days={JSON.stringify(props.days?.length)}
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
}));
jest.mock("@/lib/utils/tide-diagnostics-generator", () => ({
  generateTideDiagnosticsFromForecasts: jest.fn(() => null),
}));
jest.mock("@/lib/utils/horizon-strip-utils", () => ({
  aggregateDayForecasts: jest.fn(() => []),
}));
jest.mock("@/lib/surf/tide-direction", () => ({
  getTideAlert: jest.fn(() => null),
}));
jest.mock("@/lib/utils/date-utils", () => ({
  formatTimeInBeachTimezone: jest.fn(() => "7:00 AM"),
}));

// Mock Tabs components
jest.mock("@/components/ui/tabs", () => ({
  Tabs: ({ children, value, onValueChange, ...props }: any) => (
    <div data-testid="tabs" data-value={value} {...props}>
      {children}
    </div>
  ),
  TabsContent: ({ children, value, ...props }: any) => (
    <div data-testid={`tab-content-${value}`} {...props}>
      {children}
    </div>
  ),
  TabsList: ({ children }: any) => <div data-testid="tabs-list">{children}</div>,
  TabsTrigger: ({ children, value, onClick }: any) => (
    <button data-testid={`tab-trigger-${value}`} onClick={onClick}>
      {children}
    </button>
  ),
}));

// Mock UI components
jest.mock("@/components/ui/button", () => ({
  Button: ({ children, onClick, ...props }: any) => (
    <button onClick={onClick} {...props}>
      {children}
    </button>
  ),
}));
jest.mock("@/components/ui/collapsible", () => ({
  Collapsible: ({ children }: any) => <div>{children}</div>,
  CollapsibleContent: ({ children }: any) => <div>{children}</div>,
  CollapsibleTrigger: ({ children, asChild }: any) => <div>{children}</div>,
}));

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
    publicMode: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
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
      expect(screen.getByText("Right now")).toBeInTheDocument();
    });

    it("renders BestSurfWindow component", () => {
      render(<ForecastTab {...defaultProps} />);

      expect(screen.getByTestId("best-surf-window")).toBeInTheDocument();
    });

    it("renders 5-Day Outlook section when forecasts exist", () => {
      render(<ForecastTab {...defaultProps} />);

      expect(screen.getByText("5-Day Outlook")).toBeInTheDocument();
      expect(screen.getByText("Quick glance forecast")).toBeInTheDocument();
    });

    it("displays current tide information", () => {
      render(<ForecastTab {...defaultProps} />);

      expect(screen.getByText("Current Tide")).toBeInTheDocument();
      expect(screen.getByText("Rising")).toBeInTheDocument();
    });

    it("displays wind information", () => {
      render(<ForecastTab {...defaultProps} />);

      expect(screen.getByText("Wind")).toBeInTheDocument();
      // Wind speed "8" and direction "NW" appear in multiple places (hero card + 5-day outlook)
      expect(screen.getAllByText("8").length).toBeGreaterThan(0);
      expect(screen.getAllByText("NW").length).toBeGreaterThan(0);
    });

    it("displays swell information", () => {
      render(<ForecastTab {...defaultProps} />);

      expect(screen.getByText("Swell")).toBeInTheDocument();
      expect(screen.getByText("4.5 ft")).toBeInTheDocument();
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

  describe("Public Mode", () => {
    it("shows 3-Day Outlook instead of 5-Day Outlook in public mode", () => {
      render(<ForecastTab {...defaultProps} publicMode={true} />);

      expect(screen.getAllByText("3-Day Outlook").length).toBeGreaterThanOrEqual(1);
      expect(screen.queryByText("5-Day Outlook")).not.toBeInTheDocument();
    });

    it("gates BestSurfWindow behind PublicContentGate in public mode", () => {
      render(<ForecastTab {...defaultProps} publicMode={true} />);

      const publicGate = screen.getByTestId("public-gate");
      expect(publicGate).toBeInTheDocument();
      expect(publicGate).toHaveAttribute("data-source", "best-window-gate");
      expect(publicGate).toContainElement(screen.getByTestId("best-surf-window"));
    });

    it("does not gate BestSurfWindow in authenticated mode", () => {
      render(<ForecastTab {...defaultProps} publicMode={false} />);

      const publicGate = screen.queryByTestId("public-gate");
      const bestSurfWindow = screen.getByTestId("best-surf-window");

      if (publicGate) {
        expect(publicGate).not.toContainElement(bestSurfWindow);
      } else {
        expect(bestSurfWindow).toBeInTheDocument();
      }
    });

    it("shows lock message about full 12-day outlook when horizonDaySummaries.length > 3", () => {
      const mockDaySummaries = [
        { date: "2026-02-10", waveHeight: 4.5 },
        { date: "2026-02-11", waveHeight: 5.0 },
        { date: "2026-02-12", waveHeight: 4.8 },
        { date: "2026-02-13", waveHeight: 5.2 },
        { date: "2026-02-14", waveHeight: 4.9 },
      ];
      (aggregateDayForecasts as jest.Mock).mockReturnValue(mockDaySummaries);

      render(<ForecastTab {...defaultProps} publicMode={true} />);

      expect(screen.getByText(/Sign up to see the full 12-day outlook/i)).toBeInTheDocument();
    });

    it("does not show lock message when horizonDaySummaries.length <= 3", () => {
      const mockDaySummaries = [
        { date: "2026-02-10", waveHeight: 4.5 },
        { date: "2026-02-11", waveHeight: 5.0 },
        { date: "2026-02-12", waveHeight: 4.8 },
      ];
      (aggregateDayForecasts as jest.Mock).mockReturnValue(mockDaySummaries);

      render(<ForecastTab {...defaultProps} publicMode={true} />);

      expect(screen.queryByText(/Sign up to see the full 12-day outlook/i)).not.toBeInTheDocument();
    });

    it("does not show lock message in authenticated mode", () => {
      const mockDaySummaries = [
        { date: "2026-02-10", waveHeight: 4.5 },
        { date: "2026-02-11", waveHeight: 5.0 },
        { date: "2026-02-12", waveHeight: 4.8 },
        { date: "2026-02-13", waveHeight: 5.2 },
      ];
      (aggregateDayForecasts as jest.Mock).mockReturnValue(mockDaySummaries);

      render(<ForecastTab {...defaultProps} publicMode={false} />);

      expect(screen.queryByText(/Sign up to see the full 12-day outlook/i)).not.toBeInTheDocument();
    });
  });

  describe("Tab Switch Analytics", () => {
    it("tracks analytics when Today tab trigger is clicked", () => {
      render(<ForecastTab {...defaultProps} defaultSubTab="tides" />);

      const todayTrigger = screen.getByTestId("tab-trigger-today");
      fireEvent.click(todayTrigger);

      expect(track).toHaveBeenCalledWith("forecast_subtab_click", {
        beach_slug: "test-beach",
        tab: "today",
      });
    });

    it("tracks analytics when Tides tab trigger is clicked", () => {
      render(<ForecastTab {...defaultProps} />);

      const tidesTrigger = screen.getByTestId("tab-trigger-tides");
      fireEvent.click(tidesTrigger);

      expect(track).toHaveBeenCalledWith("forecast_subtab_click", {
        beach_slug: "test-beach",
        tab: "tides",
      });
    });

    it("tracks analytics when Conditions tab trigger is clicked", () => {
      render(<ForecastTab {...defaultProps} />);

      const conditionsTrigger = screen.getByTestId("tab-trigger-conditions");
      fireEvent.click(conditionsTrigger);

      expect(track).toHaveBeenCalledWith("forecast_subtab_click", {
        beach_slug: "test-beach",
        tab: "conditions",
      });
    });
  });

  describe("Tides Tab", () => {
    it("renders TideChartEnhanced in Tides tab", () => {
      render(<ForecastTab {...defaultProps} defaultSubTab="tides" />);

      expect(screen.getByTestId("tide-chart")).toBeInTheDocument();
    });

    it("renders TideConditionsCard in Tides tab", () => {
      render(<ForecastTab {...defaultProps} defaultSubTab="tides" />);

      expect(screen.getByTestId("tide-conditions-card")).toBeInTheDocument();
    });

    it("renders Tide Forecast heading in Tides tab", () => {
      render(<ForecastTab {...defaultProps} defaultSubTab="tides" />);

      expect(screen.getByText("Tide Forecast")).toBeInTheDocument();
    });

    it("renders EmbedCodeButton in Tides tab", () => {
      render(<ForecastTab {...defaultProps} defaultSubTab="tides" />);

      expect(screen.getByTestId("embed-code")).toBeInTheDocument();
    });
  });

  describe("No Forecasts", () => {
    it("does not render HorizonStrip when forecasts is empty array", () => {
      render(<ForecastTab {...defaultProps} forecasts={[]} />);

      expect(screen.queryByTestId("horizon-strip")).not.toBeInTheDocument();
    });

    it("does not render 5-Day Outlook section when forecasts is empty", () => {
      render(<ForecastTab {...defaultProps} forecasts={[]} />);

      expect(screen.queryByText("5-Day Outlook")).not.toBeInTheDocument();
      expect(screen.queryByText("3-Day Outlook")).not.toBeInTheDocument();
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

      expect(screen.getByTestId("tide-alert")).toBeInTheDocument();
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

  describe("Forecast Table", () => {
    it("renders SimplifiedForecastTable in collapsible section", () => {
      render(<ForecastTab {...defaultProps} />);

      expect(screen.getByTestId("forecast-table")).toBeInTheDocument();
    });

    it("shows correct label in collapsible trigger for authenticated mode", () => {
      render(<ForecastTab {...defaultProps} publicMode={false} />);

      expect(screen.getByText("View Detailed 5-Day Forecast")).toBeInTheDocument();
    });

    it("shows correct label in collapsible trigger for public mode", () => {
      render(<ForecastTab {...defaultProps} publicMode={true} />);

      expect(screen.getByText("View Detailed 3-Day Forecast")).toBeInTheDocument();
    });
  });
});
