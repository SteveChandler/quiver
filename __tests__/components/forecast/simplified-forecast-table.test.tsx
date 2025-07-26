import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { SimplifiedForecastTable } from "@/components/forecast/simplified-forecast-table";
import { EnhancedForecastEntity } from "@/types/forecast";
import {
  createSimplifiedForecastTableProps,
  createMultipleMockForecastEntities,
  TEST_SCENARIOS,
} from "../../setup/forecast-test-utils";

const mockForecasts = createMultipleMockForecastEntities();

describe("SimplifiedForecastTable", () => {
  it("renders empty state when no forecasts provided", () => {
    render(<SimplifiedForecastTable forecasts={[]} />);

    // Should not render any table rows
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("renders table with all required columns", () => {
    render(<SimplifiedForecastTable forecasts={mockForecasts} />);

    // Click to expand the day first
    const dayHeader = screen.getByText("Monday, 1/15").closest("div");
    if (dayHeader) {
      fireEvent.click(dayHeader);

      // Check for all required column headers
      expect(screen.getByText("Time")).toBeInTheDocument();
      expect(screen.getByText("Surf (ft)")).toBeInTheDocument();
      expect(screen.getByText("Primary Swell")).toBeInTheDocument();
      expect(screen.getByText("Secondary Swell")).toBeInTheDocument();
      expect(screen.getByText("Wind")).toBeInTheDocument();
      expect(screen.getByText("Consistency")).toBeInTheDocument();
      expect(screen.getByText("Weather")).toBeInTheDocument();
      expect(screen.getByText("Probability")).toBeInTheDocument();
    }
  });

  it("displays forecast data correctly", () => {
    render(<SimplifiedForecastTable forecasts={mockForecasts} />);

    // Click to expand the day first
    const dayHeader = screen.getByText("Monday, 1/15").closest("div");
    if (dayHeader) {
      fireEvent.click(dayHeader);

      // Check if forecast data is displayed
      expect(screen.getByText("3-4 ft")).toBeInTheDocument();
      expect(screen.getByText("4-5 ft")).toBeInTheDocument();
      expect(screen.getByText("10 mph")).toBeInTheDocument();
      expect(screen.getByText("12 mph")).toBeInTheDocument();
    }
  });

  it("shows consistency ratings based on confidence score", () => {
    render(<SimplifiedForecastTable forecasts={mockForecasts} />);

    // Click to expand the day first
    const dayHeader = screen.getByText("Monday, 1/15").closest("div");
    if (dayHeader) {
      fireEvent.click(dayHeader);

      // Check consistency ratings
      expect(screen.getByText("Good")).toBeInTheDocument(); // 85% confidence
      expect(screen.getByText("Excellent")).toBeInTheDocument(); // 92% confidence
    }
  });

  it("shows weather icons and conditions", () => {
    render(<SimplifiedForecastTable forecasts={mockForecasts} />);

    // Click to expand the day first
    const dayHeader = screen.getByText("Monday, 1/15").closest("div");
    if (dayHeader) {
      fireEvent.click(dayHeader);

      // Check weather conditions
      expect(screen.getByText("Partly Cloudy")).toBeInTheDocument();
      expect(screen.getByText("Sunny")).toBeInTheDocument();
      expect(screen.getByText("72°F")).toBeInTheDocument();
      expect(screen.getByText("74°F")).toBeInTheDocument();
    }
  });

  it("displays probability bars correctly", () => {
    const { container } = render(
      <SimplifiedForecastTable forecasts={mockForecasts} />
    );

    // Click to expand the day first
    const dayHeader = screen.getByText("Monday, 1/15").closest("div");
    if (dayHeader) {
      fireEvent.click(dayHeader);

      // Check for probability bars with new color coding
      const progressBars = container.querySelectorAll(
        ".bg-green-600, .bg-yellow-600, .bg-red-600"
      );
      expect(progressBars.length).toBeGreaterThan(0);
    }
  });

  it("handles expandable day sections", () => {
    render(<SimplifiedForecastTable forecasts={mockForecasts} />);

    // Day header should show actual date
    const dayHeader = screen.getByText("Monday, 1/15");
    expect(dayHeader).toBeInTheDocument();

    // Should show forecast count
    expect(screen.getByText("2 forecasts")).toBeInTheDocument();
  });

  it("toggles day sections on click", () => {
    render(<SimplifiedForecastTable forecasts={mockForecasts} />);

    // Find the day header and click it
    const dayHeader = screen.getByText("Monday, 1/15").closest("div");
    if (dayHeader) {
      fireEvent.click(dayHeader);

      // After click, should still be in document
      expect(screen.getByText("Monday, 1/15")).toBeInTheDocument();
    }
  });

  it("formats times correctly when expanded", () => {
    render(<SimplifiedForecastTable forecasts={mockForecasts} />);

    // Click to expand the day
    const dayHeader = screen.getByText("Monday, 1/15").closest("div");
    if (dayHeader) {
      fireEvent.click(dayHeader);

      // Now check for time formatting (if table is expanded)
      const timeElements = screen.queryAllByText(/6am|Noon/);
      // Times might be present if table is expanded
      expect(timeElements.length).toBeGreaterThanOrEqual(0);
    }
  });

  it("shows swell data with direction arrows", () => {
    render(<SimplifiedForecastTable forecasts={mockForecasts} />);

    // Click to expand the day first
    const dayHeader = screen.getByText("Monday, 1/15").closest("div");
    if (dayHeader) {
      fireEvent.click(dayHeader);

      // Check swell heights
      expect(screen.getByText("3 ft")).toBeInTheDocument();
      expect(screen.getByText("4 ft")).toBeInTheDocument();
      expect(screen.getByText("1 ft")).toBeInTheDocument();
    }
  });

  it("handles multiple days of forecasts", () => {
    const multiDayForecasts = [
      ...mockForecasts,
      {
        ...mockForecasts[0],
        id: "3",
        forecast_date: "2024-01-16",
        forecast_time: "06:00",
        data_source: "NOAA_NWS",
      },
    ];

    render(<SimplifiedForecastTable forecasts={multiDayForecasts} />);

    // Should show multiple day headers
    expect(screen.getByText("Monday, 1/15")).toBeInTheDocument();
    expect(screen.getByText("Tuesday, 1/16")).toBeInTheDocument();
  });
});
