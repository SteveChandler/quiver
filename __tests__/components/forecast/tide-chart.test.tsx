import React from "react";
import { render } from "@testing-library/react";
import { TideChart } from "@/components/forecast/tide-chart";
import type { EnhancedForecastEntity } from "@/types/forecast";

// Mock tide forecast data
const mockTideForecasts: EnhancedForecastEntity[] = [
  {
    id: "forecast-1",
    beach_id: "beach-1",
    forecast_date: "2024-01-15",
    forecast_time: "06:00",
    wave_height: "3.2 ft",
    wave_period: "12.4s",
    wave_direction: "W",
    swell_1_height: "2.8 ft",
    swell_1_period: "11.2s",
    swell_1_direction: "WNW",
    swell_2_height: "1.1 ft",
    swell_2_period: "8.3s",
    swell_2_direction: "WSW",
    wind_wave_height: "0.8 ft",
    wind_wave_period: "4.2s",
    wind_wave_direction: "W",
    water_temp: "65°F",
    air_temperature: "72°F",
    wind_speed: "12 mph",
    wind_direction: "W",
    tide_status: "Rising",
    tide_height: "3.2 ft",
    next_tide_time: "09:15",
    next_tide_type: "High Tide",
    next_tide_height: "5.1 ft",
    current_speed: "1.2 knots",
    current_direction: "NE",
    weather_condition: "Partly Cloudy",
    confidence_score: 85,
    data_source: "NOAA_NWS",
    created_at: "2024-01-15T00:00:00Z",
    updated_at: "2024-01-15T00:00:00Z",
  },
  {
    id: "forecast-2",
    beach_id: "beach-1",
    forecast_date: "2024-01-15",
    forecast_time: "12:00",
    wave_height: "3.8 ft",
    wave_period: "13.1s",
    wave_direction: "WNW",
    swell_1_height: "3.2 ft",
    swell_1_period: "12.8s",
    swell_1_direction: "WNW",
    swell_2_height: "1.3 ft",
    swell_2_period: "8.8s",
    swell_2_direction: "WSW",
    wind_wave_height: "0.9 ft",
    wind_wave_period: "4.8s",
    wind_wave_direction: "W",
    water_temp: "66°F",
    air_temperature: "75°F",
    wind_speed: "15 mph",
    wind_direction: "W",
    tide_status: "Falling",
    tide_height: "2.8 ft",
    next_tide_time: "15:30",
    next_tide_type: "Low Tide",
    next_tide_height: "0.9 ft",
    current_speed: "0.8 knots",
    current_direction: "SW",
    weather_condition: "Mostly Sunny",
    confidence_score: 82,
    data_source: "NOAA_NWS",
    created_at: "2024-01-15T00:00:00Z",
    updated_at: "2024-01-15T00:00:00Z",
  },
  {
    id: "forecast-3",
    beach_id: "beach-1",
    forecast_date: "2024-01-16",
    forecast_time: "06:00",
    wave_height: "2.9 ft",
    wave_period: "11.8s",
    wave_direction: "W",
    swell_1_height: "2.5 ft",
    swell_1_period: "11.1s",
    swell_1_direction: "W",
    swell_2_height: "1.0 ft",
    swell_2_period: "7.9s",
    swell_2_direction: "WSW",
    wind_wave_height: "0.7 ft",
    wind_wave_period: "3.9s",
    wind_wave_direction: "WNW",
    water_temp: "64°F",
    air_temperature: "69°F",
    wind_speed: "10 mph",
    wind_direction: "WNW",
    tide_status: "Rising",
    tide_height: "2.1 ft",
    next_tide_time: "09:45",
    next_tide_type: "High Tide",
    next_tide_height: "4.8 ft",
    current_speed: "1.1 knots",
    current_direction: "NE",
    weather_condition: "Cloudy",
    confidence_score: 78,
    data_source: "NOAA_NWS",
    created_at: "2024-01-15T00:00:00Z",
    updated_at: "2024-01-15T00:00:00Z",
  },
];

describe("TideChart Component", () => {
  describe("Rendering", () => {
    it("should render tide chart with forecast data", () => {
      const { container, getByText } = render(
        <TideChart forecasts={mockTideForecasts} />
      );

      // Check that it's wrapped in a Card
      expect(
        container.querySelector('[class*="rounded-lg"][class*="border"]')
      ).toBeTruthy();

      // Check for the Card title
      expect(getByText("Tides")).toBeTruthy();

      // Check that the SVG chart is rendered
      const svgElement = container.querySelector("svg");
      expect(svgElement).toBeTruthy();

      // Check for tide chart elements
      expect(container).toMatchSnapshot();
    });

    it("should show no data message when no forecasts provided", () => {
      const { getByText } = render(<TideChart forecasts={[]} />);

      expect(getByText("Tides")).toBeTruthy();
      expect(getByText("No tide data available")).toBeTruthy();
    });

    it("should show no data message when forecasts have no tide data", () => {
      const forecastsWithoutTides = mockTideForecasts.map((forecast) => ({
        ...forecast,
        next_tide_time: "Unknown",
        next_tide_type: "Unknown",
        next_tide_height: "Unknown",
      }));

      const { getByText } = render(
        <TideChart forecasts={forecastsWithoutTides} />
      );

      expect(getByText("No tide data available")).toBeTruthy();
    });
  });

  describe("Data Processing", () => {
    it("should extract tide events from forecast data", () => {
      const { container } = render(<TideChart forecasts={mockTideForecasts} />);

      // Should have tide height labels (some may be hidden due to spacing optimization)
      const containerText = container.textContent;
      expect(containerText).toContain("5.1ft"); // High tide height
      expect(containerText).toContain("0.9ft"); // Low tide height
      expect(containerText).toContain("4.8ft"); // Another high tide
    });

    it("should render as a connected line graph", () => {
      const { container } = render(<TideChart forecasts={mockTideForecasts} />);

      // Should have a connected line (SVG path)
      const lineElement = container.querySelector(
        "path[stroke='#3B82F6'][stroke-width='3']"
      );
      expect(lineElement).toBeTruthy();

      // Should have area fill under the line
      const areaElement = container.querySelector(
        "path[fill='url(#tideGradient)']"
      );
      expect(areaElement).toBeTruthy();

      // Should have tide point circles (updated radius)
      const circles = container.querySelectorAll("circle[r='4']");
      expect(circles.length).toBeGreaterThan(0);

      // Should have proper gradient definition
      const gradient = container.querySelector("linearGradient#tideGradient");
      expect(gradient).toBeTruthy();
    });

    it("should group tides by day", () => {
      // Use current dates for Today/Tomorrow testing
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const todayString = today.toISOString().split("T")[0];
      const tomorrowString = tomorrow.toISOString().split("T")[0];

      const dynamicForecasts = [
        {
          ...mockTideForecasts[0],
          forecast_date: todayString,
          next_tide_time: "09:15",
          next_tide_type: "High Tide",
          next_tide_height: "5.1 ft",
        },
        {
          ...mockTideForecasts[1],
          forecast_date: tomorrowString,
          next_tide_time: "10:30",
          next_tide_type: "Low Tide",
          next_tide_height: "0.8 ft",
        },
      ];

      const { container } = render(<TideChart forecasts={dynamicForecasts} />);

      // Should show day labels
      expect(container.textContent).toContain("Today");
      expect(container.textContent).toContain("Tomorrow");
    });

    it("should handle different tide time formats", () => {
      const forecastsWithDifferentTimeFormats = [
        {
          ...mockTideForecasts[0],
          next_tide_time: "9:15 AM",
          next_tide_type: "High Tide",
        },
        {
          ...mockTideForecasts[1],
          next_tide_time: "15:30",
          next_tide_type: "Low Tide",
        },
      ];

      const { container } = render(
        <TideChart forecasts={forecastsWithDifferentTimeFormats} />
      );

      // Should render without errors
      expect(container.querySelector("svg")).toBeTruthy();
    });
  });

  describe("Visual Elements", () => {
    it("should render Card structure with title", () => {
      const { getByText } = render(<TideChart forecasts={mockTideForecasts} />);

      // Check for card title (legend was removed)
      expect(getByText("Tides")).toBeTruthy();
    });

    it("should apply custom className to Card wrapper", () => {
      const { container } = render(
        <TideChart forecasts={mockTideForecasts} className="custom-class" />
      );

      // Check that custom class is applied to the Card component
      const cardElement = container.querySelector(".custom-class");
      expect(cardElement).toBeTruthy();
    });

    it("should use color coding for high and low tides", () => {
      const { container } = render(<TideChart forecasts={mockTideForecasts} />);

      // Check for circles with different colors based on tide height
      // Green shades for positive tides: #10B981 (high positive), #059669 (low positive)
      // Red shades for negative tides: #EF4444 (high negative), #DC2626 (low negative)
      const greenCircles = container.querySelectorAll(
        "circle[fill='#10B981'], circle[fill='#059669']"
      );
      const redCircles = container.querySelectorAll(
        "circle[fill='#EF4444'], circle[fill='#DC2626']"
      );

      // Should have some colored circles (positive or negative tides)
      const totalColoredCircles =
        (greenCircles?.length || 0) + (redCircles?.length || 0);
      expect(totalColoredCircles).toBeGreaterThan(0);
    });
  });

  describe("Error Handling", () => {
    it("should handle malformed tide data gracefully", () => {
      const malformedForecasts = [
        {
          ...mockTideForecasts[0],
          next_tide_time: "invalid-time",
          next_tide_height: "not-a-number",
        },
      ];

      const { container } = render(
        <TideChart forecasts={malformedForecasts} />
      );

      // Should render without crashing
      expect(container).toBeTruthy();
    });

    it("should handle null and undefined tide values", () => {
      const nullTideForecasts = [
        {
          ...mockTideForecasts[0],
          next_tide_time: null,
          next_tide_type: null,
          next_tide_height: null,
        },
      ];

      const { container } = render(
        <TideChart forecasts={nullTideForecasts as any} />
      );

      // Should show no data message
      expect(container.textContent).toContain("No tide data available");
    });
  });

  describe("Label Optimization", () => {
    it("should handle label collision prevention", () => {
      // Create many overlapping tide events to test label optimization
      const overlappingForecasts = Array.from({ length: 10 }, (_, i) => ({
        ...mockTideForecasts[0],
        id: `forecast-${i}`,
        next_tide_time: `${8 + i}:${15 + i}`,
        next_tide_type: i % 2 === 0 ? "High Tide" : "Low Tide",
        next_tide_height: `${3.0 + i * 0.1} ft`,
      }));

      const { container } = render(
        <TideChart forecasts={overlappingForecasts} />
      );

      // Should render without errors and show some labels (not all due to spacing)
      expect(container.querySelector("svg")).toBeTruthy();

      // Should have at least some tide height labels
      const labels = container.querySelectorAll(
        "text[class*='text-xs'][class*='font-semibold']"
      );
      expect(labels.length).toBeGreaterThan(0);
    });
  });
});
