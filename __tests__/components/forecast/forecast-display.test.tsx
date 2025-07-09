import { render, screen } from "@testing-library/react";
import { ForecastDisplay } from "@/components/forecast/forecast-display";
import { EnhancedForecast } from "@/types/database";

// Mock the MultiDayForecastTable component
jest.mock("@/components/forecast/multi-day-forecast-table", () => ({
  MultiDayForecastTable: ({ forecasts }: { forecasts: EnhancedForecast[] }) => (
    <div data-testid="multi-day-forecast-table">
      <table>
        <tbody>
          {forecasts.map((forecast, index) => (
            <tr key={index}>
              <td>{forecast.wave_height}</td>
              <td>{forecast.wave_period}</td>
              <td>{forecast.tide_status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ),
}));

// Mock the ForecastDataTransparency component
jest.mock("@/components/ui/forecast-data-transparency", () => ({
  ForecastDataTransparency: ({
    forecasts,
  }: {
    forecasts: EnhancedForecast[];
  }) => (
    <div data-testid="forecast-data-transparency">
      Data transparency for {forecasts.length} forecasts
    </div>
  ),
}));

describe("ForecastDisplay", () => {
  const mockForecasts: EnhancedForecast[] = [
    {
      id: "forecast-1",
      forecast_date: "2024-01-15",
      forecast_time: "06:00:00",
      wave_height: "3-4 ft",
      wave_period: "12s",
      wave_direction: "WSW",
      swell_1_height: "2.5 ft",
      swell_1_period: "14s",
      swell_1_direction: "W",
      swell_2_height: "1.5 ft",
      swell_2_period: "8s",
      swell_2_direction: "SW",
      wind_wave_height: "1.0 ft",
      wind_wave_period: "4s",
      wind_wave_direction: "NW",
      water_temp: "68°F",
      air_temperature: "72°F",
      wind_speed: "8 mph",
      wind_direction: "W",
      tide_status: "Rising",
      tide_height: "3.2 ft",
      next_tide_time: "18:45",
      next_tide_type: "High Tide",
      next_tide_height: "4.1 ft",
      current_speed: "0.5 knots",
      current_direction: "NE",
      weather_condition: "Partly Cloudy",
      confidence_score: 85,
      created_at: "2024-01-15T10:00:00Z",
      updated_at: "2024-01-15T10:00:00Z",
      beach_id: "beach-1",
    },
    {
      id: "forecast-2",
      forecast_date: "2024-01-16",
      forecast_time: "06:00:00",
      wave_height: "2-3 ft",
      wave_period: "8s",
      wave_direction: "SW",
      swell_1_height: "2.0 ft",
      swell_1_period: "10s",
      swell_1_direction: "SW",
      swell_2_height: "1.0 ft",
      swell_2_period: "6s",
      swell_2_direction: "S",
      wind_wave_height: "0.8 ft",
      wind_wave_period: "3s",
      wind_wave_direction: "W",
      water_temp: "67°F",
      air_temperature: "70°F",
      wind_speed: "12 mph",
      wind_direction: "W",
      tide_status: "Falling",
      tide_height: "2.8 ft",
      next_tide_time: "14:15",
      next_tide_type: "Low Tide",
      next_tide_height: "0.9 ft",
      current_speed: "0.8 knots",
      current_direction: "W",
      weather_condition: "Overcast",
      confidence_score: 75,
      created_at: "2024-01-15T10:00:00Z",
      updated_at: "2024-01-15T10:00:00Z",
      beach_id: "beach-1",
    },
  ];

  const mockBeach = {
    id: "beach-1",
    name: "Ocean Beach",
    coordinates: { latitude: 32.7507, longitude: -117.254 },
    county: "San Diego",
    state: "CA",
    country: "USA",
    timezone: "America/Los_Angeles",
  };

  describe("rendering", () => {
    it("should render with forecast data", () => {
      render(
        <ForecastDisplay
          forecasts={mockForecasts}
          beach={mockBeach}
          loading={false}
          error={null}
        />
      );

      expect(screen.getByText("Ocean Beach")).toBeInTheDocument();
      expect(screen.getByText("10-Day Surf Forecast")).toBeInTheDocument();
      expect(
        screen.getByTestId("multi-day-forecast-table")
      ).toBeInTheDocument();
      expect(
        screen.getByTestId("forecast-data-transparency")
      ).toBeInTheDocument();
    });

    it("should show loading state", () => {
      render(
        <ForecastDisplay
          forecasts={[]}
          beach={mockBeach}
          loading={true}
          error={null}
        />
      );

      expect(screen.getByText("Loading forecasts...")).toBeInTheDocument();
      expect(
        screen.queryByTestId("multi-day-forecast-table")
      ).not.toBeInTheDocument();
    });

    it("should show error state", () => {
      render(
        <ForecastDisplay
          forecasts={[]}
          beach={mockBeach}
          loading={false}
          error="Failed to load forecasts"
        />
      );

      expect(screen.getByText("Error loading forecasts")).toBeInTheDocument();
      expect(screen.getByText("Failed to load forecasts")).toBeInTheDocument();
      expect(
        screen.queryByTestId("multi-day-forecast-table")
      ).not.toBeInTheDocument();
    });

    it("should show no data message when no forecasts", () => {
      render(
        <ForecastDisplay
          forecasts={[]}
          beach={mockBeach}
          loading={false}
          error={null}
        />
      );

      expect(
        screen.getByText("No forecast data available")
      ).toBeInTheDocument();
      expect(
        screen.queryByTestId("multi-day-forecast-table")
      ).not.toBeInTheDocument();
    });
  });

  describe("header", () => {
    it("should display beach name and forecast title", () => {
      render(
        <ForecastDisplay
          forecasts={mockForecasts}
          beach={mockBeach}
          loading={false}
          error={null}
        />
      );

      expect(screen.getByText("Ocean Beach")).toBeInTheDocument();
      expect(screen.getByText("10-Day Surf Forecast")).toBeInTheDocument();
    });

    it("should handle beach with no name", () => {
      const beachWithoutName = {
        ...mockBeach,
        name: "",
      };

      render(
        <ForecastDisplay
          forecasts={mockForecasts}
          beach={beachWithoutName}
          loading={false}
          error={null}
        />
      );

      expect(screen.getByText("10-Day Surf Forecast")).toBeInTheDocument();
    });

    it("should handle null beach", () => {
      render(
        <ForecastDisplay
          forecasts={mockForecasts}
          beach={null}
          loading={false}
          error={null}
        />
      );

      expect(screen.getByText("10-Day Surf Forecast")).toBeInTheDocument();
    });
  });

  describe("forecast data", () => {
    it("should pass forecasts to MultiDayForecastTable", () => {
      render(
        <ForecastDisplay
          forecasts={mockForecasts}
          beach={mockBeach}
          loading={false}
          error={null}
        />
      );

      const table = screen.getByTestId("multi-day-forecast-table");
      expect(table).toBeInTheDocument();

      // Check that mock data is rendered
      expect(screen.getByText("3-4 ft")).toBeInTheDocument();
      expect(screen.getByText("12s")).toBeInTheDocument();
      expect(screen.getByText("Rising")).toBeInTheDocument();
    });

    it("should pass forecasts to ForecastDataTransparency", () => {
      render(
        <ForecastDisplay
          forecasts={mockForecasts}
          beach={mockBeach}
          loading={false}
          error={null}
        />
      );

      expect(
        screen.getByText("Data transparency for 2 forecasts")
      ).toBeInTheDocument();
    });
  });

  describe("layout", () => {
    it("should have proper spacing between components", () => {
      const { container } = render(
        <ForecastDisplay
          forecasts={mockForecasts}
          beach={mockBeach}
          loading={false}
          error={null}
        />
      );

      const mainContainer = container.querySelector(".space-y-6");
      expect(mainContainer).toBeInTheDocument();
    });

    it("should have centered layout", () => {
      const { container } = render(
        <ForecastDisplay
          forecasts={mockForecasts}
          beach={mockBeach}
          loading={false}
          error={null}
        />
      );

      const centerContainer = container.querySelector(".mx-auto");
      expect(centerContainer).toBeInTheDocument();
    });
  });

  describe("responsive design", () => {
    it("should have responsive container", () => {
      const { container } = render(
        <ForecastDisplay
          forecasts={mockForecasts}
          beach={mockBeach}
          loading={false}
          error={null}
        />
      );

      const responsiveContainer = container.querySelector(".max-w-6xl");
      expect(responsiveContainer).toBeInTheDocument();
    });

    it("should have responsive padding", () => {
      const { container } = render(
        <ForecastDisplay
          forecasts={mockForecasts}
          beach={mockBeach}
          loading={false}
          error={null}
        />
      );

      const paddingContainer = container.querySelector(".px-4");
      expect(paddingContainer).toBeInTheDocument();
    });
  });

  describe("accessibility", () => {
    it("should have proper heading structure", () => {
      render(
        <ForecastDisplay
          forecasts={mockForecasts}
          beach={mockBeach}
          loading={false}
          error={null}
        />
      );

      const heading = screen.getByRole("heading", { level: 2 });
      expect(heading).toBeInTheDocument();
      expect(heading).toHaveTextContent("Ocean Beach");
    });

    it("should have proper heading hierarchy", () => {
      render(
        <ForecastDisplay
          forecasts={mockForecasts}
          beach={mockBeach}
          loading={false}
          error={null}
        />
      );

      const mainHeading = screen.getByRole("heading", { level: 2 });
      expect(mainHeading).toBeInTheDocument();

      const subHeading = screen.getByRole("heading", { level: 3 });
      expect(subHeading).toBeInTheDocument();
      expect(subHeading).toHaveTextContent("10-Day Surf Forecast");
    });
  });

  describe("error handling", () => {
    it("should handle different error types", () => {
      const { rerender } = render(
        <ForecastDisplay
          forecasts={[]}
          beach={mockBeach}
          loading={false}
          error="Network error"
        />
      );

      expect(screen.getByText("Network error")).toBeInTheDocument();

      rerender(
        <ForecastDisplay
          forecasts={[]}
          beach={mockBeach}
          loading={false}
          error="API rate limit exceeded"
        />
      );

      expect(screen.getByText("API rate limit exceeded")).toBeInTheDocument();
    });

    it("should handle error with null beach", () => {
      render(
        <ForecastDisplay
          forecasts={[]}
          beach={null}
          loading={false}
          error="Failed to load"
        />
      );

      expect(screen.getByText("Error loading forecasts")).toBeInTheDocument();
      expect(screen.getByText("Failed to load")).toBeInTheDocument();
    });
  });

  describe("loading states", () => {
    it("should show loading with beach name", () => {
      render(
        <ForecastDisplay
          forecasts={[]}
          beach={mockBeach}
          loading={true}
          error={null}
        />
      );

      expect(screen.getByText("Ocean Beach")).toBeInTheDocument();
      expect(screen.getByText("Loading forecasts...")).toBeInTheDocument();
    });

    it("should show loading without beach name", () => {
      render(
        <ForecastDisplay
          forecasts={[]}
          beach={null}
          loading={true}
          error={null}
        />
      );

      expect(screen.getByText("Loading forecasts...")).toBeInTheDocument();
    });
  });

  describe("edge cases", () => {
    it("should handle empty forecasts array gracefully", () => {
      render(
        <ForecastDisplay
          forecasts={[]}
          beach={mockBeach}
          loading={false}
          error={null}
        />
      );

      expect(
        screen.getByText("No forecast data available")
      ).toBeInTheDocument();
      expect(
        screen.queryByTestId("multi-day-forecast-table")
      ).not.toBeInTheDocument();
    });

    it("should handle forecasts with missing data", () => {
      const incompleteForecasts = [
        {
          ...mockForecasts[0],
          wave_height: null,
          wave_period: null,
          tide_status: null,
        },
      ];

      render(
        <ForecastDisplay
          forecasts={incompleteForecasts}
          beach={mockBeach}
          loading={false}
          error={null}
        />
      );

      expect(
        screen.getByTestId("multi-day-forecast-table")
      ).toBeInTheDocument();
      expect(
        screen.getByTestId("forecast-data-transparency")
      ).toBeInTheDocument();
    });

    it("should handle both loading and error states", () => {
      render(
        <ForecastDisplay
          forecasts={[]}
          beach={mockBeach}
          loading={true}
          error="Some error"
        />
      );

      // Loading should take precedence
      expect(screen.getByText("Loading forecasts...")).toBeInTheDocument();
      expect(
        screen.queryByText("Error loading forecasts")
      ).not.toBeInTheDocument();
    });
  });
});
