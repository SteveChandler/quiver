import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import userEvent from "@testing-library/user-event";

// Mock the transparency components
jest.mock("@/components/forecast/forecast-data-source-indicator", () => ({
  ForecastDataSourceIndicator: ({
    dataSource,
    confidenceScore,
    dataSources,
  }: any) => (
    <div data-testid="detailed-data-source-indicator">
      <span>Source: {dataSource}</span>
      <span>Confidence: {confidenceScore}%</span>
      <span>Sources: {dataSources.join(", ")}</span>
    </div>
  ),
}));

jest.mock("@/components/forecast/confidence-score-explanation", () => ({
  ConfidenceScoreExplanation: ({ score, beachName }: any) => (
    <div data-testid="detailed-confidence-explanation">
      <span>Score: {score}%</span>
      {beachName && <span>Beach: {beachName}</span>}
    </div>
  ),
}));

jest.mock("@/components/forecast/forecast-fallback-messaging", () => ({
  ForecastFallbackMessaging: ({ fallbackType, originalLocation }: any) => (
    <div data-testid="detailed-fallback-messaging">
      <span>Type: {fallbackType}</span>
      <span>Original: {originalLocation}</span>
    </div>
  ),
}));

// Mock the MultiDayForecastTable
jest.mock("@/components/forecast/forecast-table", () => ({
  MultiDayForecastTable: ({ forecasts }: any) => (
    <div data-testid="multi-day-forecast-table">
      <span>Forecast table with {forecasts.length} forecasts</span>
    </div>
  ),
}));

import { ForecastDisplayWithTransparency } from "@/components/forecast/forecast-display-with-transparency";

const mockBeach = {
  id: "beach-1",
  name: "Trestles",
  coordinates: { latitude: 33.3894, longitude: -117.5547 },
  county: "Orange County",
  state: "California",
  country: "USA",
  timezone: "America/Los_Angeles",
};

const mockHighQualityForecasts = [
  {
    id: "1",
    beach_id: "beach-1",
    forecast_date: "2025-01-15",
    forecast_time: "12:00:00",
    wave_height: "4-6 ft",
    confidence_score: 87,
    data_source: "CDIP",
    created_at: "2025-01-15T08:00:00Z",
    updated_at: "2025-01-15T08:00:00Z",
    raw_forecast: {
      data_sources: ["CDIP", "NOAA_NWS"],
    },
  },
  {
    id: "2",
    beach_id: "beach-1",
    forecast_date: "2025-01-16",
    forecast_time: "12:00:00",
    wave_height: "3-5 ft",
    confidence_score: 82,
    data_source: "CDIP",
    created_at: "2025-01-15T08:00:00Z",
    updated_at: "2025-01-15T08:00:00Z",
    raw_forecast: {
      data_sources: ["CDIP", "NOAA_NWS"],
    },
  },
];

const mockMixedQualityForecasts = [
  {
    id: "1",
    beach_id: "beach-1",
    forecast_date: "2025-01-15",
    forecast_time: "12:00:00",
    wave_height: "4-6 ft",
    confidence_score: 87,
    data_source: "CDIP",
    created_at: "2025-01-15T08:00:00Z",
    updated_at: "2025-01-15T08:00:00Z",
    raw_forecast: {
      data_sources: ["CDIP", "NOAA_NWS"],
    },
  },
  {
    id: "2",
    beach_id: "beach-1",
    forecast_date: "2025-01-16",
    forecast_time: "12:00:00",
    wave_height: "2-4 ft",
    confidence_score: 42,
    data_source: "FALLBACK",
    created_at: "2025-01-15T08:00:00Z",
    updated_at: "2025-01-15T08:00:00Z",
    raw_forecast: {
      data_sources: ["FALLBACK"],
      fallback_info: {
        type: "nearest_beach",
        original_location: "Trestles",
        fallback_location: "San Onofre",
        distance: 3.2,
      },
    },
  },
];

describe("ForecastDisplayWithTransparency", () => {
  describe("High Quality Forecast Display", () => {
    it("should display detailed forecast with comprehensive transparency", () => {
      render(
        <ForecastDisplayWithTransparency
          forecasts={mockHighQualityForecasts}
          beach={mockBeach}
          loading={false}
          error={null}
          showTransparency={true}
        />
      );

      // Should show beach name and forecast title
      expect(screen.getByText("Trestles")).toBeInTheDocument();
      expect(screen.getByText("10-Day Surf Forecast")).toBeInTheDocument();

      // Should show multi-day forecast table
      expect(
        screen.getByTestId("multi-day-forecast-table")
      ).toBeInTheDocument();
      expect(
        screen.getByText("Forecast table with 2 forecasts")
      ).toBeInTheDocument();

      // Should show transparency components
      expect(
        screen.getByTestId("detailed-data-source-indicator")
      ).toBeInTheDocument();
      expect(
        screen.getByTestId("detailed-confidence-explanation")
      ).toBeInTheDocument();
      expect(screen.getByText("Source: CDIP")).toBeInTheDocument();
      expect(screen.getByText("Confidence: 87%")).toBeInTheDocument();
    });

    it("should display forecast quality summary for multiple days", () => {
      render(
        <ForecastDisplayWithTransparency
          forecasts={mockHighQualityForecasts}
          beach={mockBeach}
          loading={false}
          error={null}
          showTransparency={true}
          showQualitySummary={true}
        />
      );

      expect(
        screen.getByTestId("forecast-quality-summary")
      ).toBeInTheDocument();
      expect(screen.getByText(/High quality data/)).toBeInTheDocument();
      expect(screen.getByText(/100% high confidence/)).toBeInTheDocument();
    });

    it("should allow toggling between transparency modes", async () => {
      const user = userEvent.setup();

      render(
        <ForecastDisplayWithTransparency
          forecasts={mockHighQualityForecasts}
          beach={mockBeach}
          loading={false}
          error={null}
          showTransparency={true}
          allowToggleTransparency={true}
        />
      );

      const toggleButton = screen.getByRole("button", {
        name: /Toggle transparency/,
      });
      await user.click(toggleButton);

      await waitFor(() => {
        expect(
          screen.queryByTestId("detailed-data-source-indicator")
        ).not.toBeInTheDocument();
      });
    });
  });

  describe("Mixed Quality Forecast Display", () => {
    it("should display mixed quality warning with fallback messaging", () => {
      render(
        <ForecastDisplayWithTransparency
          forecasts={mockMixedQualityForecasts}
          beach={mockBeach}
          loading={false}
          error={null}
          showTransparency={true}
          showFallbackInfo={true}
        />
      );

      // Should show primary data source
      expect(
        screen.getByTestId("detailed-data-source-indicator")
      ).toBeInTheDocument();
      expect(screen.getByText("Source: CDIP")).toBeInTheDocument();

      // Should show fallback messaging for mixed data
      expect(
        screen.getByTestId("detailed-fallback-messaging")
      ).toBeInTheDocument();
      expect(screen.getByText("Type: nearest_beach")).toBeInTheDocument();
      expect(screen.getByText("Original: Trestles")).toBeInTheDocument();
    });

    it("should highlight data quality variations across days", () => {
      render(
        <ForecastDisplayWithTransparency
          forecasts={mockMixedQualityForecasts}
          beach={mockBeach}
          loading={false}
          error={null}
          showTransparency={true}
          highlightQualityVariations={true}
        />
      );

      expect(
        screen.getByTestId("quality-variation-warning")
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Data quality varies by day/)
      ).toBeInTheDocument();
    });

    it("should show detailed breakdown per day when expanded", async () => {
      const user = userEvent.setup();

      render(
        <ForecastDisplayWithTransparency
          forecasts={mockMixedQualityForecasts}
          beach={mockBeach}
          loading={false}
          error={null}
          showTransparency={true}
          expandableByDay={true}
        />
      );

      const expandButton = screen.getByRole("button", {
        name: /Show daily breakdown/,
      });
      await user.click(expandButton);

      expect(
        screen.getByTestId("daily-transparency-breakdown")
      ).toBeInTheDocument();
      
      // Look for dates in the breakdown - first verify the structure exists
      const breakdown = screen.getByTestId("daily-transparency-breakdown");
      expect(breakdown).toBeInTheDocument();
      
      // Test that we have confidence indicators in the breakdown
      expect(screen.getByText(/High confidence/)).toBeInTheDocument();
      expect(screen.getByText(/Low confidence/)).toBeInTheDocument();
      
      // Test that dates are present (flexible to handle different date formats)
      const dateElements = breakdown.querySelectorAll('span');
      const hasDatePattern = Array.from(dateElements).some(el => 
        el.textContent && /\w+ \d+:/.test(el.textContent)
      );
      expect(hasDatePattern).toBe(true);
    });
  });

  describe("Loading and Error States", () => {
    it("should show loading state with transparency placeholder", () => {
      render(
        <ForecastDisplayWithTransparency
          forecasts={[]}
          beach={mockBeach}
          loading={true}
          error={null}
          showTransparency={true}
        />
      );

      expect(screen.getByText("Loading forecasts...")).toBeInTheDocument();
      expect(
        screen.getByTestId("transparency-loading-skeleton")
      ).toBeInTheDocument();
    });

    it("should show error state with transparency unavailable message", () => {
      render(
        <ForecastDisplayWithTransparency
          forecasts={[]}
          beach={mockBeach}
          loading={false}
          error="Failed to load forecast data"
          showTransparency={true}
        />
      );

      expect(screen.getByText("Error loading forecasts")).toBeInTheDocument();
      expect(
        screen.getByText("Failed to load forecast data")
      ).toBeInTheDocument();
      expect(
        screen.getByTestId("transparency-error-state")
      ).toBeInTheDocument();
    });

    it("should handle missing beach gracefully", () => {
      render(
        <ForecastDisplayWithTransparency
          forecasts={mockHighQualityForecasts}
          beach={null}
          loading={false}
          error={null}
          showTransparency={true}
        />
      );

      // Should still show forecast data without beach-specific info
      expect(
        screen.getByTestId("multi-day-forecast-table")
      ).toBeInTheDocument();
      expect(
        screen.getByTestId("detailed-data-source-indicator")
      ).toBeInTheDocument();
    });
  });

  describe("Accessibility and Navigation", () => {
    it("should provide proper ARIA labels for transparency sections", () => {
      render(
        <ForecastDisplayWithTransparency
          forecasts={mockHighQualityForecasts}
          beach={mockBeach}
          loading={false}
          error={null}
          showTransparency={true}
        />
      );

      const transparencySection = screen.getByRole("region", {
        name: /forecast transparency/,
      });
      expect(transparencySection).toBeInTheDocument();

      const forecastSection = screen.getByRole("region", {
        name: /10-day forecast/,
      });
      expect(forecastSection).toBeInTheDocument();
    });

    it("should support keyboard navigation through transparency controls", async () => {
      const user = userEvent.setup();

      render(
        <ForecastDisplayWithTransparency
          forecasts={mockHighQualityForecasts}
          beach={mockBeach}
          loading={false}
          error={null}
          showTransparency={true}
          allowToggleTransparency={true}
        />
      );

      const toggleButton = screen.getByRole("button", {
        name: /Toggle transparency/,
      });

      // Should be focusable
      toggleButton.focus();
      expect(toggleButton).toHaveFocus();

      // Should activate with keyboard
      await user.keyboard("{Enter}");

      await waitFor(() => {
        expect(
          screen.queryByTestId("detailed-data-source-indicator")
        ).not.toBeInTheDocument();
      });
    });

    it("should announce changes to screen readers", () => {
      render(
        <ForecastDisplayWithTransparency
          forecasts={mockMixedQualityForecasts}
          beach={mockBeach}
          loading={false}
          error={null}
          showTransparency={true}
        />
      );

      const announcement = screen.getByRole("status", {
        name: /forecast quality/,
      });
      expect(announcement).toBeInTheDocument();
      expect(announcement).toHaveTextContent(
        /Mixed data quality - some forecasts use fallback data/
      );
    });
  });

  describe("Responsive Design", () => {
    it("should adapt transparency display for mobile", () => {
      render(
        <ForecastDisplayWithTransparency
          forecasts={mockHighQualityForecasts}
          beach={mockBeach}
          loading={false}
          error={null}
          showTransparency={true}
          mobile={true}
        />
      );

      const container = screen.getByTestId("forecast-display-container");
      expect(container).toHaveClass("mobile-optimized");
    });

    it("should collapse transparency details on small screens", () => {
      render(
        <ForecastDisplayWithTransparency
          forecasts={mockHighQualityForecasts}
          beach={mockBeach}
          loading={false}
          error={null}
          showTransparency={true}
          compact={true}
        />
      );

      // Should show essential info but hide detailed breakdowns
      expect(
        screen.getByTestId("detailed-confidence-explanation")
      ).toBeInTheDocument();
      expect(
        screen.queryByTestId("detailed-source-breakdown")
      ).not.toBeInTheDocument();
    });
  });

  describe("Integration with Existing Features", () => {
    it("should maintain compatibility with existing ForecastDisplay props", () => {
      const { container } = render(
        <ForecastDisplayWithTransparency
          forecasts={mockHighQualityForecasts}
          beach={mockBeach}
          loading={false}
          error={null}
          showTransparency={false}
          className="existing-forecast-display"
        />
      );

      // Should maintain existing styling
      expect(container.firstChild).toHaveClass("existing-forecast-display");

      // Should show standard forecast without transparency
      expect(
        screen.getByTestId("multi-day-forecast-table")
      ).toBeInTheDocument();
      expect(
        screen.queryByTestId("detailed-data-source-indicator")
      ).not.toBeInTheDocument();
    });

    it("should work as drop-in replacement for ForecastDisplay", () => {
      render(
        <ForecastDisplayWithTransparency
          forecasts={mockHighQualityForecasts}
          beach={mockBeach}
          loading={false}
          error={null}
          // No transparency props - should behave like original
        />
      );

      // Should show basic forecast display
      expect(screen.getByText("Trestles")).toBeInTheDocument();
      expect(screen.getByText("10-Day Surf Forecast")).toBeInTheDocument();
      expect(
        screen.getByTestId("multi-day-forecast-table")
      ).toBeInTheDocument();
    });

    it("should integrate with URL parameters for transparency settings", () => {
      // Mock URL with transparency parameter
      Object.defineProperty(window, "location", {
        value: {
          search: "?transparency=detailed&quality=expanded",
        },
        writable: true,
      });

      render(
        <ForecastDisplayWithTransparency
          forecasts={mockMixedQualityForecasts}
          beach={mockBeach}
          loading={false}
          error={null}
          parseUrlParams={true}
        />
      );

      // Should parse URL params and show detailed transparency
      expect(
        screen.getByTestId("detailed-data-source-indicator")
      ).toBeInTheDocument();
      expect(
        screen.getByTestId("detailed-confidence-explanation")
      ).toBeInTheDocument();
    });
  });
});
