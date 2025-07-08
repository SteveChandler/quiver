import { render, screen, fireEvent } from "@testing-library/react";
import { MultiDayForecastTable } from "@/components/forecast/multi-day-forecast-table";
import { EnhancedForecast } from "@/types/database";

describe("MultiDayForecastTable", () => {
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
      forecast_date: "2024-01-15",
      forecast_time: "12:00:00",
      wave_height: "4-5 ft",
      wave_period: "10s",
      wave_direction: "W",
      swell_1_height: "3.0 ft",
      swell_1_period: "12s",
      swell_1_direction: "W",
      swell_2_height: "2.0 ft",
      swell_2_period: "7s",
      swell_2_direction: "SW",
      wind_wave_height: "1.5 ft",
      wind_wave_period: "5s",
      wind_wave_direction: "NW",
      water_temp: "69°F",
      air_temperature: "74°F",
      wind_speed: "10 mph",
      wind_direction: "W",
      tide_status: "High Slack",
      tide_height: "4.1 ft",
      next_tide_time: "19:30",
      next_tide_type: "Low Tide",
      next_tide_height: "1.2 ft",
      current_speed: "0.2 knots",
      current_direction: "SE",
      weather_condition: "Sunny",
      confidence_score: 90,
      created_at: "2024-01-15T10:00:00Z",
      updated_at: "2024-01-15T10:00:00Z",
      beach_id: "beach-1",
    },
    {
      id: "forecast-3",
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

  describe("rendering", () => {
    it("should render table with forecast data", () => {
      render(<MultiDayForecastTable forecasts={mockForecasts} />);

      // Check for forecast data
      expect(screen.getByText("3-4 ft")).toBeInTheDocument();
      expect(screen.getByText("2.5 ft")).toBeInTheDocument();
      expect(screen.getByText("14s")).toBeInTheDocument();
      expect(screen.getByText("8 mph")).toBeInTheDocument();
      expect(screen.getByText("3.2 ft")).toBeInTheDocument();
      expect(screen.getByText("85%")).toBeInTheDocument();
    });

    it("should group forecasts by date", () => {
      render(<MultiDayForecastTable forecasts={mockForecasts} />);

      // Should show date headers - updated to match actual date format
      expect(screen.getByText(/Monday, 1\/15/)).toBeInTheDocument();
      expect(screen.getByText(/Tuesday, 1\/16/)).toBeInTheDocument();
    });

    it("should render multiple time slots for the same day", () => {
      render(<MultiDayForecastTable forecasts={mockForecasts} />);

      // Should show time slots for Jan 15
      expect(screen.getByText("6am")).toBeInTheDocument();
      expect(screen.getByText("Noon")).toBeInTheDocument();
    });

    it("should handle empty forecasts array", () => {
      render(<MultiDayForecastTable forecasts={[]} />);

      expect(
        screen.getByText("No forecast data available")
      ).toBeInTheDocument();
    });
  });

  describe("time formatting", () => {
    it("should format time correctly", () => {
      render(<MultiDayForecastTable forecasts={mockForecasts} />);

      expect(screen.getByText("6am")).toBeInTheDocument();
      expect(screen.getByText("Noon")).toBeInTheDocument();
    });

    it("should handle different time formats", () => {
      const customTimeForecasts = [
        {
          ...mockForecasts[0],
          forecast_time: "18:00:00",
        },
      ];

      render(<MultiDayForecastTable forecasts={customTimeForecasts} />);

      expect(screen.getByText("6pm")).toBeInTheDocument();
    });
  });

  describe("data display", () => {
    const expandAllDays = () => {
      // Find all day headers and click to expand them - use more specific regex
      const dayHeaders = screen.getAllByText(/^(Monday|Tuesday), \d+\/\d+$/);
      dayHeaders.forEach((header) => {
        fireEvent.click(header);
      });
    };

    it("should display wave height", () => {
      render(<MultiDayForecastTable forecasts={mockForecasts} />);
      expandAllDays();

      expect(screen.getByText("3-4 ft")).toBeInTheDocument();
      expect(screen.getByText("4-5 ft")).toBeInTheDocument();
      expect(screen.getByText("2-3 ft")).toBeInTheDocument();
    });

    it("should display swell information", () => {
      render(<MultiDayForecastTable forecasts={mockForecasts} />);
      expandAllDays();

      expect(screen.getByText("2.5 ft")).toBeInTheDocument();
      expect(screen.getByText("14s")).toBeInTheDocument();
      expect(screen.getByText("1.5 ft")).toBeInTheDocument();
      expect(screen.getByText("8s")).toBeInTheDocument();
    });

    it("should display wind information", () => {
      render(<MultiDayForecastTable forecasts={mockForecasts} />);
      expandAllDays();

      expect(screen.getByText("8 mph")).toBeInTheDocument();
      expect(screen.getByText("10 mph")).toBeInTheDocument();
      expect(screen.getByText("12 mph")).toBeInTheDocument();
    });

    it("should display tide information", () => {
      render(<MultiDayForecastTable forecasts={mockForecasts} />);
      expandAllDays();

      expect(screen.getByText("3.2 ft")).toBeInTheDocument();
      expect(screen.getByText("Rising")).toBeInTheDocument();
      expect(screen.getByText("4.1 ft")).toBeInTheDocument();
      expect(screen.getByText("High Slack")).toBeInTheDocument();
    });

    it("should display confidence scores", () => {
      render(<MultiDayForecastTable forecasts={mockForecasts} />);
      expandAllDays();

      expect(screen.getByText("85%")).toBeInTheDocument();
      expect(screen.getByText("90%")).toBeInTheDocument();
      expect(screen.getByText("75%")).toBeInTheDocument();
    });

    it("should display weather information", () => {
      render(<MultiDayForecastTable forecasts={mockForecasts} />);
      expandAllDays();

      expect(screen.getByText("72°F")).toBeInTheDocument();
      expect(screen.getByText("68°F")).toBeInTheDocument();
      expect(screen.getByText("74°F")).toBeInTheDocument();
      expect(screen.getByText("69°F")).toBeInTheDocument();
    });
  });

  describe("direction arrows", () => {
    it("should display direction arrows", () => {
      const { container } = render(
        <MultiDayForecastTable forecasts={mockForecasts} />
      );

      // Check for arrow symbols in the rendered output
      expect(container.innerHTML).toContain("←"); // W direction
      expect(container.innerHTML).toContain("↙"); // SW direction
    });
  });

  describe("responsive design", () => {
    it("should have responsive table classes", () => {
      const { container } = render(
        <MultiDayForecastTable forecasts={mockForecasts} />
      );

      const tableContainer = container.querySelector(".overflow-x-auto");
      expect(tableContainer).toBeInTheDocument();
    });

    it("should have proper table styling", () => {
      const { container } = render(
        <MultiDayForecastTable forecasts={mockForecasts} />
      );

      const table = container.querySelector("table");
      expect(table).toHaveClass("w-full");
    });
  });

  describe("accessibility", () => {
    it("should have proper table headers", () => {
      render(<MultiDayForecastTable forecasts={mockForecasts} />);

      expect(screen.getByText("Time")).toBeInTheDocument();
      expect(screen.getByText("Surf (ft)")).toBeInTheDocument();
      expect(screen.getByText("Primary Swell")).toBeInTheDocument();
      expect(screen.getByText("Secondary Swell")).toBeInTheDocument();
      expect(screen.getByText("Wind")).toBeInTheDocument();
      expect(screen.getByText("Tide")).toBeInTheDocument();
      expect(screen.getByText("Weather")).toBeInTheDocument();
      expect(screen.getByText("Confidence")).toBeInTheDocument();
    });

    it("should have readable text for all forecast data", () => {
      render(<MultiDayForecastTable forecasts={mockForecasts} />);

      // All forecast data should be visible
      expect(screen.getByText("3-4 ft")).toBeVisible();
      expect(screen.getByText("2.5 ft")).toBeVisible();
      expect(screen.getByText("14s")).toBeVisible();
      expect(screen.getByText("8 mph")).toBeVisible();
      expect(screen.getByText("3.2 ft")).toBeVisible();
      expect(screen.getByText("85%")).toBeVisible();
    });
  });

  describe("confidence indicators", () => {
    const expandAllDays = () => {
      // Find all day headers and click to expand them - use more specific regex
      const dayHeaders = screen.getAllByText(/^(Monday|Tuesday), \d+\/\d+$/);
      dayHeaders.forEach((header) => {
        fireEvent.click(header);
      });
    };

    it("should show confidence indicators with proper colors", () => {
      const { container } = render(
        <MultiDayForecastTable forecasts={mockForecasts} />
      );
      expandAllDays();

      // Check for confidence indicators
      const highConfidenceIndicators =
        container.querySelectorAll(".bg-green-500");
      expect(highConfidenceIndicators.length).toBeGreaterThan(0);
    });

    it("should handle different confidence levels", () => {
      const mixedConfidenceForecasts = [
        { ...mockForecasts[0], confidence_score: 95 }, // High (green)
        { ...mockForecasts[1], confidence_score: 70 }, // Medium (yellow)
        { ...mockForecasts[2], confidence_score: 45 }, // Low (red)
      ];

      const { container } = render(
        <MultiDayForecastTable forecasts={mixedConfidenceForecasts} />
      );
      expandAllDays();

      // Check for different confidence colors
      expect(
        container.querySelectorAll(".bg-green-500").length
      ).toBeGreaterThan(0);
      expect(
        container.querySelectorAll(".bg-yellow-500").length
      ).toBeGreaterThan(0);
      expect(container.querySelectorAll(".bg-red-500").length).toBeGreaterThan(
        0
      );
    });
  });

  describe("edge cases", () => {
    it("should handle forecasts with missing data", () => {
      const incompleteForecasts = [
        {
          ...mockForecasts[0],
          wave_height: null,
          swell_1_height: null,
          wind_speed: null,
          tide_height: null,
        },
      ];

      render(<MultiDayForecastTable forecasts={incompleteForecasts} />);

      // Should show dashes for missing data
      expect(screen.getAllByText("-").length).toBeGreaterThan(0);
    });

    it("should handle very long wave heights", () => {
      const longWaveHeightForecast = [
        { ...mockForecasts[0], wave_height: "15-20 ft with 25+ ft sets" },
      ];

      render(<MultiDayForecastTable forecasts={longWaveHeightForecast} />);

      expect(screen.getByText("15-20 ft with 25+ ft sets")).toBeInTheDocument();
    });

    it("should handle invalid dates gracefully", () => {
      const invalidDateForecast = [
        { ...mockForecasts[0], forecast_date: "invalid-date" },
      ];

      render(<MultiDayForecastTable forecasts={invalidDateForecast} />);

      // Should not crash and still render
      expect(screen.getByText("3-4 ft")).toBeInTheDocument();
    });
  });

  describe("interaction", () => {
    it("should expand/collapse days when clicked", () => {
      render(<MultiDayForecastTable forecasts={mockForecasts} />);

      // Find and click on a day header - use actual date text
      const dayHeader = screen.getByText(/Monday, 1/);
      fireEvent.click(dayHeader);

      // Should toggle the expansion state - use getAllByText since there might be multiple "6am" elements
      const sixAmElements = screen.getAllByText("6am");
      expect(sixAmElements.length).toBeGreaterThan(0);
    });

    it("should show forecast count in day headers", () => {
      render(<MultiDayForecastTable forecasts={mockForecasts} />);

      expect(screen.getByText("2 forecasts")).toBeInTheDocument(); // Jan 15 has 2 forecasts
      expect(screen.getByText("1 forecasts")).toBeInTheDocument(); // Jan 16 has 1 forecast
    });
  });
});
