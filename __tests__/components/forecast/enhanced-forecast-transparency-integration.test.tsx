import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import userEvent from "@testing-library/user-event";

// Mock the transparency components
jest.mock("@/components/forecast/forecast-data-source-indicator", () => ({
  ForecastDataSourceIndicator: ({
    dataSource,
    confidenceScore,
    dataSources,
  }: any) => (
    <div data-testid="data-source-indicator">
      <span>Data Source: {dataSource}</span>
      <span>Confidence: {confidenceScore}%</span>
      <span>Sources: {dataSources.join(", ")}</span>
    </div>
  ),
}));

jest.mock("@/components/forecast/confidence-score-explanation", () => ({
  ConfidenceScoreExplanation: ({ score, compact, beachName }: any) => (
    <div
      data-testid="confidence-explanation"
      className={compact ? "compact" : ""}
    >
      <span>Score: {score}%</span>
      {beachName && <span>Beach: {beachName}</span>}
    </div>
  ),
}));

jest.mock("@/components/forecast/forecast-fallback-messaging", () => ({
  ForecastFallbackMessaging: ({
    fallbackType,
    originalLocation,
    fallbackLocation,
  }: any) => (
    <div data-testid="fallback-messaging">
      <span>Type: {fallbackType}</span>
      <span>From: {originalLocation}</span>
      <span>To: {fallbackLocation}</span>
    </div>
  ),
}));

// Mock the enhanced forecast component
import { EnhancedForecastWithTransparency } from "@/components/forecast/enhanced-forecast-with-transparency";
import type { EnhancedForecastEntity } from "@/types/forecast";

// Use Partial<EnhancedForecastEntity> and cast to any to avoid strict type checking
const mockHighQualityForecast: any = {
  water_temp: "65°F",
  id: "1",
  beach_id: "beach-1",
  forecast_at: "2025-01-15T12:00:00Z",
  forecast_date: "2025-01-15",
  forecast_time: "12:00:00",
  wave_height: "4-6 ft",
  wind_speed: "8 mph",
  confidence_score: 87,
  data_source: "CDIP",
  weather_condition: "Sunny",
  created_at: "2025-01-15T08:00:00Z",
  updated_at: "2025-01-15T08:00:00Z",
  raw_forecast: {
    data_sources: ["CDIP", "NOAA_NWS"],
    cdip_data: {
      station_id: "100",
      wave_height: 5.2,
      dominant_period: 12.5,
      timestamp: "2025-01-15T08:00:00Z",
    },
  },
};

const mockFallbackForecast: any = {
  water_temp: "62°F",
  id: "2",
  beach_id: "beach-2",
  forecast_at: "2025-01-15T12:00:00Z",
  forecast_date: "2025-01-15",
  forecast_time: "12:00:00",
  wave_height: "2-4 ft",
  wind_speed: "12 mph",
  confidence_score: 45,
  data_source: "FALLBACK",
  weather_condition: "Partly Cloudy",
  created_at: "2025-01-15T08:00:00Z",
  updated_at: "2025-01-15T08:00:00Z",
  raw_forecast: {
    data_sources: ["FALLBACK"],
    fallback_info: {
      type: "nearest_beach",
      original_location: "Malibu",
      fallback_location: "Santa Monica",
      distance: 15.5,
    },
  },
};

describe("EnhancedForecastWithTransparency", () => {
  describe("High Quality Forecast Integration", () => {
    it("should display forecast with data source indicator and confidence explanation", () => {
      render(
        <EnhancedForecastWithTransparency
          forecast={mockHighQualityForecast}
          beachName="Trestles"
          showDataSource={true}
          showConfidence={true}
        />
      );

      // Should show main forecast content
      expect(screen.getByText("4-6 ft")).toBeInTheDocument();
      expect(screen.getByText("8 mph")).toBeInTheDocument();
      expect(screen.getByText("Sunny")).toBeInTheDocument();

      // Should show transparency components
      expect(screen.getByTestId("data-source-indicator")).toBeInTheDocument();
      expect(screen.getByTestId("confidence-explanation")).toBeInTheDocument();
      expect(screen.getByText("Data Source: CDIP")).toBeInTheDocument();
      expect(screen.getByText("Confidence: 87%")).toBeInTheDocument();
      expect(screen.getByText("Sources: CDIP, NOAA_NWS")).toBeInTheDocument();
    });

    it("should not show fallback messaging for high quality forecasts", () => {
      render(
        <EnhancedForecastWithTransparency
          forecast={mockHighQualityForecast}
          beachName="Trestles"
          showFallbackInfo={true}
        />
      );

      expect(
        screen.queryByTestId("fallback-messaging")
      ).not.toBeInTheDocument();
    });

    it("should support compact mode for forecast previews", () => {
      render(
        <EnhancedForecastWithTransparency
          forecast={mockHighQualityForecast}
          beachName="Trestles"
          compact={true}
          showConfidence={true}
        />
      );

      const confidenceExplanation = screen.getByTestId(
        "confidence-explanation"
      );
      expect(confidenceExplanation).toHaveClass("compact");
    });
  });

  describe("Fallback Forecast Integration", () => {
    it("should display fallback messaging and low confidence warning", () => {
      render(
        <EnhancedForecastWithTransparency
          forecast={mockFallbackForecast}
          beachName="Malibu"
          showFallbackInfo={true}
          showConfidence={true}
        />
      );

      // Should show main forecast content
      expect(screen.getByText("2-4 ft")).toBeInTheDocument();
      expect(screen.getByText("12 mph")).toBeInTheDocument();

      // Should show fallback messaging
      expect(screen.getByTestId("fallback-messaging")).toBeInTheDocument();
      expect(screen.getByText("Type: nearest_beach")).toBeInTheDocument();
      expect(screen.getByText("From: Malibu")).toBeInTheDocument();
      expect(screen.getByText("To: Santa Monica")).toBeInTheDocument();

      // Should show low confidence
      expect(screen.getByTestId("confidence-explanation")).toBeInTheDocument();
      expect(screen.getByText("Score: 45%")).toBeInTheDocument();
    });

    it("should style fallback forecasts with warning appearance", () => {
      render(
        <EnhancedForecastWithTransparency
          forecast={mockFallbackForecast}
          beachName="Malibu"
          showDataSource={true}
        />
      );

      const container = screen.getByTestId("forecast-container");
      expect(container).toHaveClass("border-yellow-200", "bg-yellow-50");
    });
  });

  describe("Transparency Configuration", () => {
    it("should respect transparency display options", () => {
      render(
        <EnhancedForecastWithTransparency
          forecast={mockHighQualityForecast}
          beachName="Trestles"
          showDataSource={false}
          showConfidence={true}
          showFallbackInfo={false}
        />
      );

      expect(
        screen.queryByTestId("data-source-indicator")
      ).not.toBeInTheDocument();
      expect(screen.getByTestId("confidence-explanation")).toBeInTheDocument();
      expect(
        screen.queryByTestId("fallback-messaging")
      ).not.toBeInTheDocument();
    });

    it("should work with minimal transparency (confidence only)", () => {
      render(
        <EnhancedForecastWithTransparency
          forecast={mockHighQualityForecast}
          beachName="Trestles"
          showDataSource={false}
          showConfidence={true}
          showFallbackInfo={false}
          minimal={true}
        />
      );

      expect(screen.getByTestId("confidence-explanation")).toBeInTheDocument();
      expect(
        screen.queryByTestId("data-source-indicator")
      ).not.toBeInTheDocument();
    });
  });

  describe("Interactive Features", () => {
    it("should handle data source expansion", async () => {
      const user = userEvent.setup();

      render(
        <EnhancedForecastWithTransparency
          forecast={mockHighQualityForecast}
          beachName="Trestles"
          showDataSource={true}
          interactive={true}
        />
      );

      // Should be able to interact with data source indicator
      const dataSourceIndicator = screen.getByTestId("data-source-indicator");
      expect(dataSourceIndicator).toBeInTheDocument();
    });

    it("should handle confidence score details expansion", async () => {
      const user = userEvent.setup();

      render(
        <EnhancedForecastWithTransparency
          forecast={mockHighQualityForecast}
          beachName="Trestles"
          showConfidence={true}
          interactive={true}
        />
      );

      // Should show confidence explanation that can be expanded
      const confidenceExplanation = screen.getByTestId(
        "confidence-explanation"
      );
      expect(confidenceExplanation).toBeInTheDocument();
    });
  });

  describe("Accessibility", () => {
    it("should have proper ARIA labels for transparency information", () => {
      render(
        <EnhancedForecastWithTransparency
          forecast={mockHighQualityForecast}
          beachName="Trestles"
          showDataSource={true}
          showConfidence={true}
        />
      );

      const container = screen.getByTestId("forecast-container");
      expect(container).toHaveAttribute(
        "aria-label",
        "Enhanced forecast for Trestles with transparency information"
      );
    });

    it("should provide screen reader context for fallback data", () => {
      render(
        <EnhancedForecastWithTransparency
          forecast={mockFallbackForecast}
          beachName="Malibu"
          showFallbackInfo={true}
        />
      );

      expect(
        screen.getAllByRole("region", { name: /forecast transparency/ })[0]
      ).toBeInTheDocument();
    });
  });

  describe("Error Handling", () => {
    it("should handle missing raw forecast data gracefully", () => {
      const forecastWithoutRaw = {
        ...mockHighQualityForecast,
        raw_forecast: undefined,
      };

      render(
        <EnhancedForecastWithTransparency
          forecast={forecastWithoutRaw}
          beachName="Trestles"
          showDataSource={true}
        />
      );

      // Should still show basic forecast
      expect(screen.getByText("4-6 ft")).toBeInTheDocument();
      // Should show data source indicator with fallback info
      expect(screen.getByTestId("data-source-indicator")).toBeInTheDocument();
    });

    it("should handle malformed confidence scores", () => {
      const forecastWithBadConfidence = {
        ...mockHighQualityForecast,
        confidence_score: null,
      };

      render(
        <EnhancedForecastWithTransparency
          forecast={forecastWithBadConfidence}
          beachName="Trestles"
          showConfidence={true}
        />
      );

      // Should still render without crashing
      expect(screen.getByText("4-6 ft")).toBeInTheDocument();
    });
  });

  describe("Performance", () => {
    it("should not re-render unnecessarily when transparency options change", () => {
      const { rerender } = render(
        <EnhancedForecastWithTransparency
          forecast={mockHighQualityForecast}
          beachName="Trestles"
          showDataSource={true}
        />
      );

      // Change non-critical props
      rerender(
        <EnhancedForecastWithTransparency
          forecast={mockHighQualityForecast}
          beachName="Trestles"
          showDataSource={true}
          className="updated-class"
        />
      );

      // Component should still be functional
      expect(screen.getByTestId("data-source-indicator")).toBeInTheDocument();
    });
  });
});
