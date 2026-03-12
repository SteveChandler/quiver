import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

// Mock the transparency components in compact mode
jest.mock("@/components/forecast/forecast-data-source-indicator", () => ({
  ForecastDataSourceIndicator: ({
    dataSource,
    confidenceScore,
    compact,
  }: any) => (
    <div data-testid="compact-data-source" className={compact ? "compact" : ""}>
      <span>{dataSource}</span>
      <span>{confidenceScore}%</span>
    </div>
  ),
}));

jest.mock("@/components/forecast/confidence-score-explanation", () => ({
  ConfidenceScoreExplanation: ({ score, compact }: any) => (
    <div data-testid="compact-confidence" className={compact ? "compact" : ""}>
      <span>{score}%</span>
    </div>
  ),
}));

// Phase 2C: ForecastPreviewWithTransparency merged into ForecastPreview
import { ForecastPreview } from "@/components/ui/forecast-preview";

const mockForecastPreview = {
  wave_height: "4-6 ft",
  wind_speed: "8 mph",
  weather_condition: "Sunny",
  confidence_score: 85,
  data_source: "CDIP",
  data_sources: ["CDIP", "NOAA_NWS"],
};

const mockFallbackPreview = {
  wave_height: "2-4 ft",
  wind_speed: "15 mph",
  weather_condition: "Cloudy",
  confidence_score: 42,
  data_source: "FALLBACK",
  data_sources: ["FALLBACK"],
  fallback_info: {
    type: "nearest_beach",
    distance: 12.5,
  },
};

describe("ForecastPreview (transparency integration)", () => {
  describe("Grid Variant with Transparency", () => {
    it("should display forecast preview with compact transparency indicators", () => {
      render(
        <ForecastPreview
          forecastPreview={mockForecastPreview}
          loading={false}
          error={null}
          variant="grid"
          showTransparency={true}
        />
      );

      // Should show main forecast data
      expect(screen.getByText("4-6 ft")).toBeInTheDocument();
      expect(screen.getByText("8 mph")).toBeInTheDocument();
      expect(screen.getByText("Sunny")).toBeInTheDocument();

      // Should show compact transparency indicators
      expect(screen.getByTestId("compact-data-source")).toBeInTheDocument();
      expect(screen.getByTestId("compact-confidence")).toBeInTheDocument();

      // Should be in compact mode
      expect(screen.getByTestId("compact-data-source")).toHaveClass("compact");
      expect(screen.getByTestId("compact-confidence")).toHaveClass("compact");
    });

    it("should show confidence score badge for high quality forecasts", () => {
      render(
        <ForecastPreview
          forecastPreview={mockForecastPreview}
          loading={false}
          error={null}
          variant="grid"
          showConfidenceScore={true}
        />
      );

      expect(screen.getByText("85%")).toBeInTheDocument();
      const confidenceBadge = screen.getByTestId("confidence-badge");
      expect(confidenceBadge).toHaveClass("bg-green-100", "text-green-700");
    });

    it("should show warning styling for low confidence forecasts", () => {
      render(
        <ForecastPreview
          forecastPreview={mockFallbackPreview}
          loading={false}
          error={null}
          variant="grid"
          showConfidenceScore={true}
        />
      );

      expect(screen.getByText("42%")).toBeInTheDocument();
      const confidenceBadge = screen.getByTestId("confidence-badge");
      expect(confidenceBadge).toHaveClass("bg-red-100", "text-red-700");
    });
  });

  describe("Inline Variant with Transparency", () => {
    it("should display compact transparency in inline layout", () => {
      render(
        <ForecastPreview
          forecastPreview={mockForecastPreview}
          loading={false}
          error={null}
          variant="inline"
          showTransparency={true}
        />
      );

      // Should show forecast data in inline format
      expect(screen.getByText("4-6 ft")).toBeInTheDocument();
      expect(screen.getByText("8 mph")).toBeInTheDocument();

      // Should show compact transparency indicators
      expect(screen.getByTestId("compact-data-source")).toBeInTheDocument();
      expect(screen.getByTestId("compact-confidence")).toBeInTheDocument();

      // Container should have inline layout content
      const container = screen.getByTestId("forecast-preview-container");
      expect(container).toBeInTheDocument();

      // Content should be in inline format
      expect(screen.getByText("4-6 ft")).toBeInTheDocument();
      expect(screen.getByText("8 mph")).toBeInTheDocument();
    });

    it("should prioritize confidence score in limited space", () => {
      render(
        <ForecastPreview
          forecastPreview={mockForecastPreview}
          loading={false}
          error={null}
          variant="inline"
          showTransparency={true}
          minimal={true}
        />
      );

      // Should show confidence but not full data source indicator
      expect(screen.getByTestId("compact-confidence")).toBeInTheDocument();
      expect(
        screen.queryByTestId("compact-data-source")
      ).not.toBeInTheDocument();
    });
  });

  describe("Transparency Options", () => {
    it("should respect showTransparency=false", () => {
      render(
        <ForecastPreview
          forecastPreview={mockForecastPreview}
          loading={false}
          error={null}
          variant="grid"
          showTransparency={false}
        />
      );

      expect(
        screen.queryByTestId("compact-data-source")
      ).not.toBeInTheDocument();
      expect(
        screen.queryByTestId("compact-confidence")
      ).not.toBeInTheDocument();
    });

    it("should show only confidence when showConfidenceScore=true but showTransparency=false", () => {
      render(
        <ForecastPreview
          forecastPreview={mockForecastPreview}
          loading={false}
          error={null}
          variant="grid"
          showTransparency={false}
          showConfidenceScore={true}
        />
      );

      expect(screen.getByTestId("confidence-badge")).toBeInTheDocument();
      expect(
        screen.queryByTestId("compact-data-source")
      ).not.toBeInTheDocument();
    });
  });

  describe("Fallback Data Indicators", () => {
    it("should show fallback indicator for fallback forecasts", () => {
      render(
        <ForecastPreview
          forecastPreview={mockFallbackPreview}
          loading={false}
          error={null}
          variant="grid"
          showTransparency={true}
        />
      );

      // Should show fallback data source
      expect(screen.getByText("FALLBACK")).toBeInTheDocument();

      // Container should have fallback styling
      const container = screen.getByTestId("forecast-preview-container");
      expect(container).toHaveClass("border-yellow-200");
    });

    it("should show distance indicator for nearby fallbacks", () => {
      render(
        <ForecastPreview
          forecastPreview={mockFallbackPreview}
          loading={false}
          error={null}
          variant="grid"
          showTransparency={true}
          showDistance={true}
        />
      );

      expect(screen.getByText("~12.5 mi")).toBeInTheDocument();
      expect(screen.getByTestId("distance-indicator")).toBeInTheDocument();
    });
  });

  describe("Loading and Error States", () => {
    it("should show transparency loading state", () => {
      render(
        <ForecastPreview
          forecastPreview={null}
          loading={true}
          error={null}
          variant="grid"
          showTransparency={true}
        />
      );

      expect(screen.getByTestId("transparency-loading")).toBeInTheDocument();
      expect(screen.getByText(/Loading transparency data/)).toBeInTheDocument();
    });

    it("should handle transparency data errors gracefully", () => {
      render(
        <ForecastPreview
          forecastPreview={null}
          loading={false}
          error="Failed to load transparency data"
          variant="grid"
          showTransparency={true}
        />
      );

      // Should show error message (text is split across elements)
      expect(
        screen.getByText(/Failed to load transparency data/)
      ).toBeInTheDocument();

      // Should show error state for transparency
      expect(screen.getByTestId("transparency-error")).toBeInTheDocument();
    });
  });

  describe("Responsive Design", () => {
    it("should adapt transparency indicators for mobile", () => {
      render(
        <ForecastPreview
          forecastPreview={mockForecastPreview}
          loading={false}
          error={null}
          variant="grid"
          showTransparency={true}
          mobile={true}
        />
      );

      const container = screen.getByTestId("forecast-preview-container");
      expect(container).toHaveClass("mobile-compact");
    });

    it("should hide secondary transparency info on very small screens", () => {
      render(
        <ForecastPreview
          forecastPreview={mockForecastPreview}
          loading={false}
          error={null}
          variant="inline"
          showTransparency={true}
          extraCompact={true}
        />
      );

      // Should only show confidence score
      expect(screen.getByTestId("compact-confidence")).toBeInTheDocument();
      expect(
        screen.queryByTestId("compact-data-source")
      ).not.toBeInTheDocument();
    });
  });

  describe("Accessibility", () => {
    it("should have proper ARIA labels for transparency indicators", () => {
      render(
        <ForecastPreview
          forecastPreview={mockForecastPreview}
          loading={false}
          error={null}
          variant="grid"
          showTransparency={true}
        />
      );

      const container = screen.getByTestId("forecast-preview-container");
      expect(container).toHaveAttribute(
        "aria-label",
        "Forecast preview with transparency information"
      );
    });

    it("should provide screen reader context for low confidence", () => {
      render(
        <ForecastPreview
          forecastPreview={mockFallbackPreview}
          loading={false}
          error={null}
          variant="grid"
          showTransparency={true}
        />
      );

      expect(
        screen.getByLabelText(/Low confidence forecast/)
      ).toBeInTheDocument();
    });
  });

  describe("Integration with Existing Components", () => {
    it("should work as drop-in replacement for ForecastPreview", () => {
      const { container } = render(
        <ForecastPreview
          forecastPreview={mockForecastPreview}
          loading={false}
          error={null}
          variant="grid"
          showTransparency={false}
          className="existing-forecast-preview"
        />
      );

      // Should maintain existing styling
      expect(container.firstChild).toHaveClass("existing-forecast-preview");

      // Should show standard forecast data
      expect(screen.getByText("4-6 ft")).toBeInTheDocument();
      expect(screen.getByText("8 mph")).toBeInTheDocument();
    });

    it("should support all existing ForecastPreview props", () => {
      render(
        <ForecastPreview
          forecastPreview={mockForecastPreview}
          loading={false}
          error={null}
          variant="grid"
          showConfidenceScore={true}
          className="custom-class"
          showTransparency={true}
          // Legacy support passthrough
          legacy_prop_support={true}
        />
      );

      expect(
        screen.getByTestId("forecast-preview-container")
      ).toBeInTheDocument();
    });
  });
});
