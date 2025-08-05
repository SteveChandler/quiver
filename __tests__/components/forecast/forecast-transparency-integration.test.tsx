import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { ForecastTransparencyWrapper } from "@/components/forecast/forecast-transparency-wrapper";
import { EnhancedForecast } from "@/types/forecast";

// Mock components
jest.mock("@/components/forecast/forecast-data-source-indicator", () => ({
  ForecastDataSourceIndicator: ({ dataSource, confidenceScore }: any) => (
    <div data-testid="data-source-indicator">
      Source: {dataSource} | Confidence: {confidenceScore}%
    </div>
  ),
}));

jest.mock("@/components/forecast/confidence-score-explanation", () => ({
  ConfidenceScoreExplanation: ({ score, userFriendlyText }: any) => (
    <div data-testid="confidence-explanation">
      Score: {score}% | {userFriendlyText}
    </div>
  ),
}));

jest.mock("@/components/forecast/forecast-fallback-messaging", () => ({
  ForecastFallbackMessaging: ({ fallbackType, originalLocation }: any) => (
    <div data-testid="fallback-messaging">
      Fallback: {fallbackType} for {originalLocation}
    </div>
  ),
}));

const mockHighConfidenceForecast: EnhancedForecast = {
  id: "forecast-1",
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
    cdip_data: {
      station_id: "100",
      wave_height: 5.2,
      dominant_period: 12.5,
      timestamp: "2025-01-15T08:00:00Z",
    },
  },
};

const mockFallbackForecast: EnhancedForecast = {
  id: "forecast-2",
  beach_id: "beach-2",
  forecast_date: "2025-01-15",
  forecast_time: "12:00:00",
  wave_height: "2-4 ft",
  confidence_score: 45,
  data_source: "FALLBACK",
  created_at: "2025-01-15T08:00:00Z",
  updated_at: "2025-01-15T08:00:00Z",
  raw_forecast: {
    data_sources: ["FALLBACK"],
    fallback_info: {
      original_location: "Malibu",
      fallback_location: "Huntington Beach",
      distance: 45.2,
    },
  },
};

describe("ForecastTransparencyWrapper", () => {
  describe("High Quality Forecasts", () => {
    it("should display confidence and data source for high quality forecast", () => {
      render(
        <ForecastTransparencyWrapper
          forecast={mockHighConfidenceForecast}
          beachName="Trestles"
          showDataSource={true}
          showConfidence={true}
        >
          <div data-testid="forecast-content">Wave Height: 4-6 ft</div>
        </ForecastTransparencyWrapper>
      );

      expect(screen.getByTestId("forecast-content")).toBeInTheDocument();
      expect(screen.getByTestId("data-source-indicator")).toBeInTheDocument();
      expect(screen.getByTestId("confidence-explanation")).toBeInTheDocument();
      expect(screen.getByText(/Source: CDIP/)).toBeInTheDocument();
      expect(screen.getByText(/Confidence: 87%/)).toBeInTheDocument();
    });

    it("should not show fallback messaging for high quality forecast", () => {
      render(
        <ForecastTransparencyWrapper
          forecast={mockHighConfidenceForecast}
          beachName="Trestles"
          showFallbackInfo={true}
        >
          <div>Forecast Content</div>
        </ForecastTransparencyWrapper>
      );

      expect(
        screen.queryByTestId("fallback-messaging")
      ).not.toBeInTheDocument();
    });
  });

  describe("Fallback Forecasts", () => {
    it("should display fallback messaging for low confidence forecast", () => {
      render(
        <ForecastTransparencyWrapper
          forecast={mockFallbackForecast}
          beachName="Malibu"
          showFallbackInfo={true}
          showConfidence={true}
        >
          <div data-testid="forecast-content">Wave Height: 2-4 ft</div>
        </ForecastTransparencyWrapper>
      );

      expect(screen.getByTestId("fallback-messaging")).toBeInTheDocument();
      expect(screen.getByTestId("confidence-explanation")).toBeInTheDocument();
      expect(
        screen.getByText(/Fallback: nearest_beach for Malibu/)
      ).toBeInTheDocument();
      expect(screen.getByText(/Score: 45%/)).toBeInTheDocument();
    });

    it("should show appropriate warning styling for fallback data", () => {
      render(
        <ForecastTransparencyWrapper
          forecast={mockFallbackForecast}
          beachName="Malibu"
          showDataSource={true}
        >
          <div>Forecast Content</div>
        </ForecastTransparencyWrapper>
      );

      const wrapper = screen.getByTestId("transparency-wrapper");
      expect(wrapper).toHaveClass("border-yellow-200");
    });
  });

  describe("Configuration Options", () => {
    it("should respect showDataSource prop", () => {
      render(
        <ForecastTransparencyWrapper
          forecast={mockHighConfidenceForecast}
          beachName="Trestles"
          showDataSource={false}
          showConfidence={true}
        >
          <div>Forecast Content</div>
        </ForecastTransparencyWrapper>
      );

      expect(
        screen.queryByTestId("data-source-indicator")
      ).not.toBeInTheDocument();
      expect(screen.getByTestId("confidence-explanation")).toBeInTheDocument();
    });

    it("should respect showConfidence prop", () => {
      render(
        <ForecastTransparencyWrapper
          forecast={mockHighConfidenceForecast}
          beachName="Trestles"
          showDataSource={true}
          showConfidence={false}
        >
          <div>Forecast Content</div>
        </ForecastTransparencyWrapper>
      );

      expect(screen.getByTestId("data-source-indicator")).toBeInTheDocument();
      expect(
        screen.queryByTestId("confidence-explanation")
      ).not.toBeInTheDocument();
    });

    it("should respect compact mode", () => {
      render(
        <ForecastTransparencyWrapper
          forecast={mockHighConfidenceForecast}
          beachName="Trestles"
          compact={true}
          showDataSource={true}
          showConfidence={true}
        >
          <div>Forecast Content</div>
        </ForecastTransparencyWrapper>
      );

      const wrapper = screen.getByTestId("transparency-wrapper");
      expect(wrapper).toHaveClass("compact");
    });
  });

  describe("Data Processing", () => {
    it("should extract data sources from raw forecast", () => {
      const forecastWithMultipleSources = {
        ...mockHighConfidenceForecast,
        raw_forecast: {
          data_sources: ["CDIP", "NOAA_NWS", "NOAA_COOPS"],
          cdip_data: { station_id: "100" },
        },
      };

      render(
        <ForecastTransparencyWrapper
          forecast={forecastWithMultipleSources}
          beachName="Trestles"
          showDataSource={true}
        >
          <div>Forecast Content</div>
        </ForecastTransparencyWrapper>
      );

      // Should pass multiple data sources to the indicator
      expect(screen.getByTestId("data-source-indicator")).toBeInTheDocument();
    });

    it("should determine fallback type from forecast data", () => {
      const forecastWithBuoyFallback = {
        ...mockFallbackForecast,
        raw_forecast: {
          data_sources: ["NOAA_BUOY"],
          fallback_info: {
            type: "nearest_buoy",
            original_location: "Cardiff",
            fallback_location: "Scripps Pier Buoy",
            distance: 2.1,
          },
        },
      };

      render(
        <ForecastTransparencyWrapper
          forecast={forecastWithBuoyFallback}
          beachName="Cardiff"
          showFallbackInfo={true}
        >
          <div>Forecast Content</div>
        </ForecastTransparencyWrapper>
      );

      expect(
        screen.getByText(/Fallback: nearest_buoy for Cardiff/)
      ).toBeInTheDocument();
    });
  });

  describe("Loading States", () => {
    it("should show loading state when forecast is being fetched", () => {
      render(
        <ForecastTransparencyWrapper
          forecast={null}
          beachName="Trestles"
          isLoading={true}
        >
          <div>Forecast Content</div>
        </ForecastTransparencyWrapper>
      );

      expect(screen.getByTestId("transparency-loading")).toBeInTheDocument();
      expect(screen.getByText(/Loading forecast data.../)).toBeInTheDocument();
    });

    it("should show error state when forecast fetch fails", () => {
      render(
        <ForecastTransparencyWrapper
          forecast={null}
          beachName="Trestles"
          error="Failed to load forecast data"
        >
          <div>Forecast Content</div>
        </ForecastTransparencyWrapper>
      );

      expect(screen.getByTestId("transparency-error")).toBeInTheDocument();
      expect(
        screen.getByText(/Failed to load forecast data/)
      ).toBeInTheDocument();
    });
  });

  describe("User Interaction", () => {
    it("should handle refresh action", async () => {
      const mockRefresh = jest.fn();

      render(
        <ForecastTransparencyWrapper
          forecast={mockFallbackForecast}
          beachName="Malibu"
          onRefresh={mockRefresh}
          showDataSource={true}
        >
          <div>Forecast Content</div>
        </ForecastTransparencyWrapper>
      );

      const refreshButton = screen.getByRole("button", {
        name: /Refresh forecast/,
      });
      refreshButton.click();

      await waitFor(() => {
        expect(mockRefresh).toHaveBeenCalledWith("beach-2");
      });
    });

    it("should handle feedback submission", async () => {
      const mockFeedback = jest.fn();

      render(
        <ForecastTransparencyWrapper
          forecast={mockHighConfidenceForecast}
          beachName="Trestles"
          onFeedback={mockFeedback}
          showFeedbackOption={true}
        >
          <div>Forecast Content</div>
        </ForecastTransparencyWrapper>
      );

      const feedbackButton = screen.getByRole("button", {
        name: /Rate forecast accuracy/,
      });
      feedbackButton.click();

      expect(screen.getByTestId("forecast-feedback-modal")).toBeInTheDocument();
    });
  });

  describe("Accessibility", () => {
    it("should have proper ARIA labels", () => {
      render(
        <ForecastTransparencyWrapper
          forecast={mockHighConfidenceForecast}
          beachName="Trestles"
          showDataSource={true}
          showConfidence={true}
        >
          <div>Forecast Content</div>
        </ForecastTransparencyWrapper>
      );

      const wrapper = screen.getByTestId("transparency-wrapper");
      expect(wrapper).toHaveAttribute(
        "aria-label",
        "Forecast transparency information for Trestles"
      );
    });

    it("should support screen readers with descriptive content", () => {
      render(
        <ForecastTransparencyWrapper
          forecast={mockFallbackForecast}
          beachName="Malibu"
          showFallbackInfo={true}
        >
          <div>Forecast Content</div>
        </ForecastTransparencyWrapper>
      );

      expect(
        screen.getByRole("region", { name: /Forecast data transparency/ })
      ).toBeInTheDocument();
    });
  });

  describe("Integration with Existing Components", () => {
    it("should integrate with EnhancedForecastCard", () => {
      const { container } = render(
        <ForecastTransparencyWrapper
          forecast={mockHighConfidenceForecast}
          beachName="Trestles"
          showDataSource={true}
          showConfidence={true}
          integrated={true}
        >
          <div className="forecast-card">
            <h3>Today's Forecast</h3>
            <div>Wave Height: 4-6 ft</div>
          </div>
        </ForecastTransparencyWrapper>
      );

      // Should maintain existing card styling while adding transparency info
      expect(container.querySelector(".forecast-card")).toBeInTheDocument();
      expect(screen.getByTestId("data-source-indicator")).toBeInTheDocument();
    });

    it("should work with ForecastPreview components", () => {
      render(
        <ForecastTransparencyWrapper
          forecast={mockHighConfidenceForecast}
          beachName="Trestles"
          variant="preview"
          showDataSource={true}
          compact={true}
        >
          <div className="forecast-preview">
            <span>4-6ft</span>
          </div>
        </ForecastTransparencyWrapper>
      );

      const wrapper = screen.getByTestId("transparency-wrapper");
      expect(wrapper).toHaveClass("preview-variant");
    });
  });
});
