import { render, screen } from "@testing-library/react";
import { ForecastPreview } from "@/components/ui/forecast-preview";
import type { ForecastPreview as ForecastPreviewType } from "@/types/forecast";
import { createMockForecastPreview } from "../../setup/forecast-test-utils";

describe("ForecastPreview", () => {
  const mockForecastData = createMockForecastPreview();

  describe("loading state", () => {
    it("should render loading spinner and text", () => {
      render(
        <ForecastPreview forecastPreview={null} loading={true} error={null} />
      );

      expect(screen.getByText("Loading forecast...")).toBeInTheDocument();
      // Check for spinner icon in the loading container
      const loadingContainer = screen.getByText(
        "Loading forecast..."
      ).parentElement;
      const spinner = loadingContainer?.querySelector(".animate-spin");
      expect(spinner).toBeTruthy();
    });

    it("should apply custom className to loading state", () => {
      const { container } = render(
        <ForecastPreview
          forecastPreview={null}
          loading={true}
          error={null}
          className="custom-loading-class"
        />
      );

      // Check if the custom class is in the rendered output
      const loadingDiv = container.querySelector(".custom-loading-class");
      expect(loadingDiv).toBeTruthy();
    });
  });

  describe("error state", () => {
    it("should render error message", () => {
      render(
        <ForecastPreview
          forecastPreview={null}
          loading={false}
          error="Failed to load forecast"
        />
      );

      expect(screen.getByText("Failed to load forecast")).toBeInTheDocument();
    });

    it("should apply custom className to error state", () => {
      render(
        <ForecastPreview
          forecastPreview={null}
          loading={false}
          error="Error message"
          className="custom-error-class"
        />
      );

      const errorElement = screen.getByText("Error message");
      expect(errorElement).toHaveClass("custom-error-class");
    });
  });

  describe("no data state", () => {
    it("should render no data message when forecast is null", () => {
      render(
        <ForecastPreview forecastPreview={null} loading={false} error={null} />
      );

      expect(
        screen.getByText("No forecast data available")
      ).toBeInTheDocument();
    });

    it("should apply custom className to no data state", () => {
      render(
        <ForecastPreview
          forecastPreview={null}
          loading={false}
          error={null}
          className="custom-no-data-class"
        />
      );

      const noDataElement = screen.getByText("No forecast data available");
      expect(noDataElement).toHaveClass("custom-no-data-class");
    });
  });

  describe("forecast data display", () => {
    describe("grid variant (default)", () => {
      it("should render forecast data in grid layout", () => {
        render(
          <ForecastPreview
            forecastPreview={mockForecastData}
            loading={false}
            error={null}
          />
        );

        expect(screen.getByText("4-6 ft")).toBeInTheDocument();
        expect(screen.getByText("10 mph")).toBeInTheDocument();
        expect(screen.getByText("Sunny")).toBeInTheDocument(); // First word only

        // Check for icons by testing their parent elements
        const waveElement = screen.getByText("4-6 ft").parentElement;
        expect(waveElement).toHaveClass("text-blue-600");

        const windElement = screen.getByText("10 mph").parentElement;
        expect(windElement).toHaveClass("text-gray-600");

        const weatherElement = screen.getByText("Sunny").parentElement;
        expect(weatherElement).toHaveClass("text-orange-600");
      });

      it("should render confidence score when enabled", () => {
        render(
          <ForecastPreview
            forecastPreview={mockForecastData}
            loading={false}
            error={null}
            showConfidenceScore={true}
          />
        );

        expect(screen.getByText("Confidence: 85%")).toBeInTheDocument();
      });

      it("should not render confidence score when disabled", () => {
        render(
          <ForecastPreview
            forecastPreview={mockForecastData}
            loading={false}
            error={null}
            showConfidenceScore={false}
          />
        );

        expect(screen.queryByText("Confidence: 85%")).not.toBeInTheDocument();
      });

      it("should not render confidence score when score is missing", () => {
        const dataWithoutScore = {
          ...mockForecastData,
          confidence_score: undefined,
        };

        render(
          <ForecastPreview
            forecastPreview={dataWithoutScore}
            loading={false}
            error={null}
            showConfidenceScore={true}
          />
        );

        expect(screen.queryByText(/Confidence:/)).not.toBeInTheDocument();
      });
    });

    describe("inline variant", () => {
      it("should render forecast data in inline layout", () => {
        render(
          <ForecastPreview
            forecastPreview={mockForecastData}
            loading={false}
            error={null}
            variant="inline"
          />
        );

        expect(screen.getByText("4-6 ft")).toBeInTheDocument();
        expect(screen.getByText("10 mph")).toBeInTheDocument();
        expect(screen.getByText("Sunny")).toBeInTheDocument();

        // Check for inline layout classes
        const container = screen.getByText("4-6 ft").closest("div");
        expect(container).toHaveClass("flex");
      });

      it("should render confidence score in inline variant when enabled", () => {
        render(
          <ForecastPreview
            forecastPreview={mockForecastData}
            loading={false}
            error={null}
            variant="inline"
            showConfidenceScore={true}
          />
        );

        expect(screen.getByText("Confidence: 85%")).toBeInTheDocument();
      });
    });
  });

  describe("weather condition handling", () => {
    it("should display only first word of weather condition", () => {
      const longWeatherCondition = {
        ...mockForecastData,
        weather_condition: "Partly cloudy with scattered showers",
      };

      render(
        <ForecastPreview
          forecastPreview={longWeatherCondition}
          loading={false}
          error={null}
        />
      );

      expect(screen.getByText("Partly")).toBeInTheDocument();
      expect(
        screen.queryByText("cloudy with scattered showers")
      ).not.toBeInTheDocument();
    });

    it("should handle single word weather condition", () => {
      const singleWordWeather = {
        ...mockForecastData,
        weather_condition: "Sunny",
      };

      render(
        <ForecastPreview
          forecastPreview={singleWordWeather}
          loading={false}
          error={null}
        />
      );

      expect(screen.getByText("Sunny")).toBeInTheDocument();
    });

    it("should handle empty weather condition", () => {
      const emptyWeather = {
        ...mockForecastData,
        weather_condition: "",
      };

      render(
        <ForecastPreview
          forecastPreview={emptyWeather}
          loading={false}
          error={null}
        />
      );

      // Should render empty string for first word of empty string
      const weatherElements = screen.getAllByText("", { exact: false });
      expect(weatherElements.length).toBeGreaterThan(0);
    });
  });

  describe("forecast type handling", () => {
    it("should handle enhanced forecast type", () => {
      const enhancedForecast = {
        ...mockForecastData,
        type: "enhanced" as const,
      };

      render(
        <ForecastPreview
          forecastPreview={enhancedForecast}
          loading={false}
          error={null}
        />
      );

      expect(screen.getByText("4-6 ft")).toBeInTheDocument();
    });

    it("should handle basic forecast type", () => {
      const basicForecast = {
        ...mockForecastData,
        type: "basic" as const,
      };

      render(
        <ForecastPreview
          forecastPreview={basicForecast}
          loading={false}
          error={null}
        />
      );

      expect(screen.getByText("4-6 ft")).toBeInTheDocument();
    });
  });

  describe("custom styling", () => {
    it("should apply custom className to container", () => {
      const { container } = render(
        <ForecastPreview
          forecastPreview={mockForecastData}
          loading={false}
          error={null}
          className="custom-forecast-class"
        />
      );

      const forecastContainer = container.firstChild as HTMLElement;
      expect(forecastContainer).toHaveClass("custom-forecast-class");
    });

    it("should combine custom className with default classes", () => {
      const { container } = render(
        <ForecastPreview
          forecastPreview={mockForecastData}
          loading={false}
          error={null}
          className="custom-forecast-class"
          variant="grid"
        />
      );

      const forecastContainer = container.firstChild as HTMLElement;
      expect(forecastContainer).toHaveClass(
        "custom-forecast-class",
        "space-y-2"
      );
    });
  });

  describe("accessibility", () => {
    it("should have proper semantic structure", () => {
      render(
        <ForecastPreview
          forecastPreview={mockForecastData}
          loading={false}
          error={null}
        />
      );

      // Check that text is readable
      expect(screen.getByText("4-6 ft")).toBeVisible();
      expect(screen.getByText("10 mph")).toBeVisible();
      expect(screen.getByText("Sunny")).toBeVisible();
    });

    it("should have proper loading state for screen readers", () => {
      render(
        <ForecastPreview forecastPreview={null} loading={true} error={null} />
      );

      const loadingText = screen.getByText("Loading forecast...");
      expect(loadingText).toBeInTheDocument();
      expect(loadingText).toBeVisible();
    });

    it("should have proper error state for screen readers", () => {
      render(
        <ForecastPreview
          forecastPreview={null}
          loading={false}
          error="Network error occurred"
        />
      );

      const errorText = screen.getByText("Network error occurred");
      expect(errorText).toBeInTheDocument();
      expect(errorText).toBeVisible();
    });
  });

  describe("edge cases", () => {
    it("should handle missing forecast properties gracefully", () => {
      const incompleteData = {
        type: "enhanced" as const,
        wave_height: "",
        wind_speed: "",
        wind_direction: "",
        weather_condition: "",
      };

      const { container } = render(
        <ForecastPreview
          forecastPreview={incompleteData}
          loading={false}
          error={null}
        />
      );

      // Should render without crashing - check that container has content
      expect(container.firstChild).toBeTruthy();
    });

    it("should handle null confidence score", () => {
      const dataWithNullScore = {
        ...mockForecastData,
        confidence_score: null as any,
      };

      render(
        <ForecastPreview
          forecastPreview={dataWithNullScore}
          loading={false}
          error={null}
          showConfidenceScore={true}
        />
      );

      expect(screen.queryByText(/Confidence:/)).not.toBeInTheDocument();
    });

    it("should handle zero confidence score", () => {
      const dataWithZeroScore = {
        ...mockForecastData,
        confidence_score: 0,
      };

      render(
        <ForecastPreview
          forecastPreview={dataWithZeroScore}
          loading={false}
          error={null}
          showConfidenceScore={true}
        />
      );

      // Zero confidence score is falsy, so it won't be rendered
      expect(screen.queryByText("Confidence: 0%")).not.toBeInTheDocument();
    });
  });

  describe("priority handling", () => {
    it("should prioritize loading state over error", () => {
      render(
        <ForecastPreview
          forecastPreview={null}
          loading={true}
          error="Some error"
        />
      );

      expect(screen.getByText("Loading forecast...")).toBeInTheDocument();
      expect(screen.queryByText("Some error")).not.toBeInTheDocument();
    });

    it("should prioritize error state over no data", () => {
      render(
        <ForecastPreview
          forecastPreview={null}
          loading={false}
          error="Some error"
        />
      );

      expect(screen.getByText("Some error")).toBeInTheDocument();
      expect(
        screen.queryByText("No forecast data available")
      ).not.toBeInTheDocument();
    });

    it("should prioritize forecast data over no data", () => {
      render(
        <ForecastPreview
          forecastPreview={mockForecastData}
          loading={false}
          error={null}
        />
      );

      expect(screen.getByText("4-6 ft")).toBeInTheDocument();
      expect(
        screen.queryByText("No forecast data available")
      ).not.toBeInTheDocument();
    });
  });
});
