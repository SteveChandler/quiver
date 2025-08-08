import { render, screen } from "@testing-library/react";
import { ForecastDisplay } from "@/components/forecast/forecast-display";
import { BeachesEnhancedForecast } from "@/components/beaches-enhanced-forecast";
import { EnhancedForecast } from "@/types/database";

// Mock the MultiDayForecastTable component
jest.mock("@/components/forecast/forecast-table", () => ({
  MultiDayForecastTable: ({ forecasts }: { forecasts: EnhancedForecast[] }) => (
    <div data-testid="multi-day-forecast-table">
      <table>
        <thead>
          <tr>
            <th>Time</th>
            <th>Surf (ft)</th>
            <th>Primary Swell</th>
            <th>Secondary Swell</th>
            <th>Wind</th>
            <th>Tide</th>
            <th>Weather</th>
            <th>Confidence</th>
          </tr>
        </thead>
        <tbody>
          {forecasts.map((forecast, index) => (
            <tr key={index}>
              <td>{forecast.forecast_time?.replace(":00:00", "am/pm")}</td>
              <td>{forecast.wave_height}</td>
              <td>{forecast.swell_1_height}</td>
              <td>{forecast.swell_2_height}</td>
              <td>{forecast.wind_speed}</td>
              <td>{forecast.tide_height}</td>
              <td>{forecast.weather_description}</td>
              <td>{forecast.confidence_score}%</td>
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
    overallConfidence,
  }: {
    overallConfidence: number;
  }) => (
    <div data-testid="forecast-data-transparency">
      <span>Overall Confidence: {overallConfidence}%</span>
      <span>Data Quality</span>
    </div>
  ),
}));

describe("Enhanced Forecast Components", () => {
  const mockEnhancedForecasts: EnhancedForecast[] = [
    {
      id: "forecast-1",
      forecast_date: "2024-01-15",
      forecast_time: "06:00:00",
      wave_height: "4-6 ft",
      wave_period: "12s",
      wave_direction: "WSW",
      swell_1_height: "3.5 ft",
      swell_1_period: "14s",
      swell_1_direction: "W",
      swell_2_height: "2.1 ft",
      swell_2_period: "9s",
      swell_2_direction: "SW",
      wind_speed: "8 mph",
      wind_direction: "W",
      tide_height: "3.2 ft",
      tide_status: "Rising",
      weather_description: "Partly Cloudy",
      air_temp: "72°F",
      water_temp: "68°F",
      confidence_score: 85,
    },
    {
      id: "forecast-2",
      forecast_date: "2024-01-15",
      forecast_time: "12:00:00",
      wave_height: "5-7 ft",
      wave_period: "11s",
      wave_direction: "W",
      swell_1_height: "4.0 ft",
      swell_1_period: "12s",
      swell_1_direction: "W",
      swell_2_height: "2.5 ft",
      swell_2_period: "8s",
      swell_2_direction: "SW",
      wind_speed: "10 mph",
      wind_direction: "W",
      tide_height: "4.1 ft",
      tide_status: "High Slack",
      weather_description: "Partly Cloudy",
      air_temp: "74°F",
      water_temp: "69°F",
      confidence_score: 90,
    },
  ];

  const mockBeach = {
    id: "beach-1",
    name: "Ocean Beach",
    coordinates: { latitude: 32.7553, longitude: -117.2547 },
    county: "San Diego",
    state: "California",
    country: "US",
    timezone: "America/Los_Angeles",
  };

  describe("ForecastDisplay Component", () => {
    it("should render with enhanced forecasts", () => {
      render(
        <ForecastDisplay
          forecasts={mockEnhancedForecasts}
          beach={mockBeach}
          loading={false}
          error={null}
        />
      );

      // Should render the forecast display
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

      expect(screen.getByText("Failed to load forecasts")).toBeInTheDocument();
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
    });

    it("should display beach name in header", () => {
      render(
        <ForecastDisplay
          forecasts={mockEnhancedForecasts}
          beach={mockBeach}
          loading={false}
          error={null}
        />
      );

      expect(screen.getByText("Ocean Beach")).toBeInTheDocument();
    });

    it("should group forecasts by date", () => {
      render(
        <ForecastDisplay
          forecasts={mockEnhancedForecasts}
          beach={mockBeach}
          loading={false}
          error={null}
        />
      );

      // Should pass forecasts to MultiDayForecastTable
      expect(
        screen.getByTestId("multi-day-forecast-table")
      ).toBeInTheDocument();
    });
  });

  describe("BeachesEnhancedForecast Component", () => {
    it("should render with beach data", () => {
      render(
        <BeachesEnhancedForecast
          beachId={mockBeach.id}
          beachName={mockBeach.name}
        />
      );

      // Should show loading state initially (component makes API calls)
      expect(
        screen.getByText("Loading enhanced forecasts...")
      ).toBeInTheDocument();
    });

    it("should handle missing beach data", () => {
      render(<BeachesEnhancedForecast />);

      // Should show placeholder message
      expect(
        screen.getByText("Please select a beach to view enhanced forecasts")
      ).toBeInTheDocument();
    });

    it("should have proper layout structure", () => {
      const { container } = render(<BeachesEnhancedForecast />);

      // Should have proper card layout
      expect(container.querySelector(".rounded-lg")).toBeInTheDocument();
    });
  });

  describe("Table-Based Forecast Display", () => {
    it("should display forecast data in table format", () => {
      render(
        <ForecastDisplay
          forecasts={mockEnhancedForecasts}
          beach={mockBeach}
          loading={false}
          error={null}
        />
      );

      // Should render table with forecasts
      expect(
        screen.getByTestId("multi-day-forecast-table")
      ).toBeInTheDocument();
      expect(screen.getByText("4-6 ft")).toBeInTheDocument();
      expect(screen.getByText("5-7 ft")).toBeInTheDocument();
    });

    it("should handle different confidence levels", () => {
      render(
        <ForecastDisplay
          forecasts={mockEnhancedForecasts}
          beach={mockBeach}
          loading={false}
          error={null}
        />
      );

      // Should display confidence scores
      expect(
        screen.getByTestId("forecast-data-transparency")
      ).toBeInTheDocument();
    });
  });
});
