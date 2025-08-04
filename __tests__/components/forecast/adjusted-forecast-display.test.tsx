import React from "react";
import { render, screen } from "@testing-library/react";
import { AdjustedForecastDisplay } from "@/components/forecast/adjusted-forecast-display";
import type { Forecast, BeachForecastAccuracy } from "@/types/database";

const mockRawForecast: Forecast = {
  id: "forecast-1",
  beach_id: "beach-1",
  valid_time: "2024-01-15T10:00:00Z",
  wave_height: "6 ft",
  wave_period: "12 s",
  wave_direction: "WSW",
  wind_speed: "10 mph",
  wind_direction: "NW",
  water_temp: "67°F",
  air_temperature: "72°F",
  confidence_score: 85,
  data_source: "NOAA_NWS",
  created_at: "2024-01-15T08:00:00Z",
  updated_at: "2024-01-15T08:00:00Z",
};

const mockBeachAccuracy: BeachForecastAccuracy = {
  id: "accuracy-1",
  beach_id: "beach-1",
  avg_wave_height_delta: 1.0, // Forecast typically 1ft too high
  avg_wind_speed_delta: 3.0, // Forecast typically 3mph too high
  total_sessions_count: 25,
  last_30_days_count: 8,
  last_7_days_count: 3,
  overall_accuracy_score: 78,
  calculation_date: "2024-01-15",
  created_at: "2024-01-15T08:00:00Z",
  updated_at: "2024-01-15T08:00:00Z",
};

describe("AdjustedForecastDisplay", () => {
  it("renders compact version correctly", () => {
    render(
      <AdjustedForecastDisplay
        rawForecast={mockRawForecast}
        beachAccuracy={mockBeachAccuracy}
        compact={true}
      />
    );

    expect(screen.getByText("Medium Trust")).toBeInTheDocument();
    expect(screen.getByText("25 sessions")).toBeInTheDocument();
  });

  it("shows adjusted wave height based on historical data", () => {
    render(
      <AdjustedForecastDisplay
        rawForecast={mockRawForecast}
        beachAccuracy={mockBeachAccuracy}
        compact={true}
      />
    );

    // Raw forecast: 6ft, adjusted should be lower due to positive delta
    expect(screen.getByText("6ft")).toBeInTheDocument(); // Raw value (crossed out)
    expect(screen.getByText("5.5ft")).toBeInTheDocument(); // Adjusted value
  });

  it("shows adjusted wind speed based on historical data", () => {
    render(
      <AdjustedForecastDisplay
        rawForecast={mockRawForecast}
        beachAccuracy={mockBeachAccuracy}
        compact={true}
      />
    );

    // Raw forecast: 10mph, adjusted should be lower
    expect(screen.getByText("10")).toBeInTheDocument(); // Raw value (crossed out)
    expect(screen.getByText("8 mph")).toBeInTheDocument(); // Adjusted value
  });

  it("displays correct confidence level for high accuracy", () => {
    const highAccuracy = { ...mockBeachAccuracy, overall_accuracy_score: 90 };

    render(
      <AdjustedForecastDisplay
        rawForecast={mockRawForecast}
        beachAccuracy={highAccuracy}
        compact={false}
      />
    );

    expect(screen.getByText("High Trust")).toBeInTheDocument();
  });

  it("displays correct confidence level for low accuracy", () => {
    const lowAccuracy = { ...mockBeachAccuracy, overall_accuracy_score: 60 };

    render(
      <AdjustedForecastDisplay
        rawForecast={mockRawForecast}
        beachAccuracy={lowAccuracy}
        compact={false}
      />
    );

    expect(screen.getByText("Low Trust")).toBeInTheDocument();
  });

  it("renders full version with comparison details", () => {
    render(
      <AdjustedForecastDisplay
        rawForecast={mockRawForecast}
        beachAccuracy={mockBeachAccuracy}
        compact={false}
        showComparison={true}
      />
    );

    expect(screen.getByText("Community-Adjusted Forecast")).toBeInTheDocument();
    expect(screen.getByText("Wave Height")).toBeInTheDocument();
    expect(screen.getByText("Wind Speed")).toBeInTheDocument();
    expect(screen.getByText("Raw Forecast")).toBeInTheDocument();
    expect(screen.getByText("Community Adjusted")).toBeInTheDocument();
  });

  it("shows delta badges for significant adjustments", () => {
    render(
      <AdjustedForecastDisplay
        rawForecast={mockRawForecast}
        beachAccuracy={mockBeachAccuracy}
        compact={false}
        showComparison={true}
      />
    );

    // Should show delta badges for wave height and wind adjustments
    expect(screen.getByText(/↓.*ft/)).toBeInTheDocument(); // Wave height delta
    expect(screen.getByText(/↓.*mph/)).toBeInTheDocument(); // Wind speed delta
  });

  it("displays session statistics", () => {
    render(
      <AdjustedForecastDisplay
        rawForecast={mockRawForecast}
        beachAccuracy={mockBeachAccuracy}
        compact={false}
      />
    );

    expect(screen.getByText("3 sessions last 7 days")).toBeInTheDocument();
    expect(screen.getByText("8 sessions last 30 days")).toBeInTheDocument();
  });

  it("handles forecast without adjustments", () => {
    const noAdjustmentAccuracy = {
      ...mockBeachAccuracy,
      avg_wave_height_delta: 0.05, // Very small delta
      avg_wind_speed_delta: 0.5, // Very small delta
    };

    render(
      <AdjustedForecastDisplay
        rawForecast={mockRawForecast}
        beachAccuracy={noAdjustmentAccuracy}
        compact={false}
        showComparison={true}
      />
    );

    // Should show "Confirmed" instead of adjustments
    expect(screen.getByText("Confirmed")).toBeInTheDocument();
  });

  it("renders without beach accuracy data", () => {
    render(
      <AdjustedForecastDisplay
        rawForecast={mockRawForecast}
        beachAccuracy={null}
        compact={false}
      />
    );

    expect(
      screen.getByText("No community data available yet for this beach.")
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Log a session and provide feedback to help build the community forecast!"
      )
    ).toBeInTheDocument();
  });

  it("applies custom className", () => {
    const { container } = render(
      <AdjustedForecastDisplay
        rawForecast={mockRawForecast}
        beachAccuracy={mockBeachAccuracy}
        className="custom-class"
        compact={false}
      />
    );

    expect(container.firstChild).toHaveClass("custom-class");
  });

  it("handles missing wave height in forecast", () => {
    const forecastWithoutWaveHeight = { ...mockRawForecast, wave_height: null };

    render(
      <AdjustedForecastDisplay
        rawForecast={forecastWithoutWaveHeight}
        beachAccuracy={mockBeachAccuracy}
        compact={true}
      />
    );

    // Should still render without errors
    expect(screen.getByText("Medium Trust")).toBeInTheDocument();
  });

  it("handles missing wind speed in forecast", () => {
    const forecastWithoutWindSpeed = { ...mockRawForecast, wind_speed: null };

    render(
      <AdjustedForecastDisplay
        rawForecast={forecastWithoutWindSpeed}
        beachAccuracy={mockBeachAccuracy}
        compact={true}
      />
    );

    // Should still render without errors
    expect(screen.getByText("Medium Trust")).toBeInTheDocument();
  });

  it("shows accuracy percentage correctly", () => {
    render(
      <AdjustedForecastDisplay
        rawForecast={mockRawForecast}
        beachAccuracy={mockBeachAccuracy}
        compact={false}
      />
    );

    expect(screen.getByText("78%")).toBeInTheDocument();
  });

  it("displays tooltip information", () => {
    render(
      <AdjustedForecastDisplay
        rawForecast={mockRawForecast}
        beachAccuracy={mockBeachAccuracy}
        compact={false}
      />
    );

    // The tooltip trigger should be present
    const tooltipTrigger = screen.getByRole("button", { name: /info/i });
    expect(tooltipTrigger).toBeInTheDocument();
  });
});
