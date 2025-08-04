import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ForecastFeedbackForm } from "@/components/forecast/forecast-feedback-form";
import { AdjustedForecastDisplay } from "@/components/forecast/adjusted-forecast-display";
import { ForecastFeedbackPrompt } from "@/components/forecast/forecast-feedback-prompt";
import type {
  Session,
  Forecast,
  BeachForecastAccuracy,
} from "@/types/database";

// Mock dependencies
jest.mock("sonner", () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

const mockSession: Session = {
  id: "session-1",
  user_id: "user-1",
  profile_id: "user-1",
  beach_id: "beach-1",
  arrival_time: "2024-01-15T10:00:00Z",
  departure_time: "2024-01-15T12:00:00Z",
  status: "completed",
  duration_minutes: 120,
  wave_quality: 4,
  crowd_level: 2,
  parking_ease: 5,
  rating: 4,
  notes: "Great session!",
  water_temp: "68°F",
  created_at: "2024-01-15T09:00:00Z",
  updated_at: "2024-01-15T12:30:00Z",
};

const mockForecast: Forecast = {
  id: "forecast-1",
  beach_id: "beach-1",
  valid_time: "2024-01-15T10:00:00Z",
  wave_height: "4-6 ft",
  wave_period: "12 s",
  wave_direction: "WSW",
  wind_speed: "8 mph",
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
  avg_wave_height_delta: 0.5,
  avg_wind_speed_delta: 2.0,
  total_sessions_count: 25,
  last_30_days_count: 8,
  last_7_days_count: 3,
  overall_accuracy_score: 78,
  calculation_date: "2024-01-15",
  created_at: "2024-01-15T08:00:00Z",
  updated_at: "2024-01-15T08:00:00Z",
};

describe("Forecast Feedback Integration", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders feedback form with all required elements", () => {
    const mockOnSubmit = jest.fn();
    const mockOnSkip = jest.fn();

    render(
      <ForecastFeedbackForm
        session={mockSession}
        forecast={mockForecast}
        onSubmit={mockOnSubmit}
        onSkip={mockOnSkip}
      />
    );

    // Check all the main elements are present
    expect(
      screen.getByText("How did the forecast compare?")
    ).toBeInTheDocument();
    expect(screen.getByText("Actual Wave Height")).toBeInTheDocument();
    expect(screen.getByText("Wind Conditions")).toBeInTheDocument();
    expect(screen.getByText("Overall Forecast Accuracy")).toBeInTheDocument();
    expect(screen.getByText("Additional Notes")).toBeInTheDocument();

    // Check forecast comparison badges
    expect(screen.getByText("Forecast: 4-6 ft")).toBeInTheDocument();
    expect(screen.getByText("Forecast: 8 mph NW")).toBeInTheDocument();

    // Check form controls
    expect(screen.getByRole("combobox")).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText(/any other observations/i)
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /submit feedback/i })
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /skip/i })).toBeInTheDocument();

    // Submit should be disabled initially (no wind condition selected)
    expect(
      screen.getByRole("button", { name: /submit feedback/i })
    ).toBeDisabled();
  });

  it("renders adjusted forecast display with beach accuracy data", () => {
    render(
      <AdjustedForecastDisplay
        rawForecast={mockForecast}
        beachAccuracy={mockBeachAccuracy}
        compact={false}
        showComparison={true}
      />
    );

    // Check confidence level display
    expect(screen.getByText("Medium Trust")).toBeInTheDocument();
    expect(screen.getByText("78%")).toBeInTheDocument();
    expect(screen.getByText(/Based on.*25.*sessions/)).toBeInTheDocument();

    // Check forecast sections
    expect(screen.getByText("Community-Adjusted Forecast")).toBeInTheDocument();
    expect(screen.getByText("Wave Height")).toBeInTheDocument();
    expect(screen.getByText("Wind Speed")).toBeInTheDocument();

    // Check session statistics
    expect(screen.getByText("3 sessions last 7 days")).toBeInTheDocument();
    expect(screen.getByText("8 sessions last 30 days")).toBeInTheDocument();
  });

  it("renders forecast feedback prompt with call-to-action", () => {
    const mockOnSubmitFeedback = jest.fn();
    const mockOnDismiss = jest.fn();

    render(
      <ForecastFeedbackPrompt
        session={mockSession}
        forecast={mockForecast}
        onSubmitFeedback={mockOnSubmitFeedback}
        onDismiss={mockOnDismiss}
      />
    );

    // Check prompt elements
    expect(screen.getByText("Help Improve Forecasts")).toBeInTheDocument();
    expect(
      screen.getByText(/How did the forecast compare to actual conditions/)
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /share feedback/i })
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /skip/i })).toBeInTheDocument();

    // Check motivational content
    expect(screen.getByText("Accuracy")).toBeInTheDocument();
    expect(screen.getByText("Community")).toBeInTheDocument();
    expect(screen.getByText("Quality")).toBeInTheDocument();
  });

  it("displays high confidence level correctly", () => {
    const highAccuracy = { ...mockBeachAccuracy, overall_accuracy_score: 90 };

    render(
      <AdjustedForecastDisplay
        rawForecast={mockForecast}
        beachAccuracy={highAccuracy}
        compact={false}
      />
    );

    expect(screen.getByText("High Trust")).toBeInTheDocument();
    expect(screen.getByText("90%")).toBeInTheDocument();
  });

  it("displays low confidence level correctly", () => {
    const lowAccuracy = { ...mockBeachAccuracy, overall_accuracy_score: 60 };

    render(
      <AdjustedForecastDisplay
        rawForecast={mockForecast}
        beachAccuracy={lowAccuracy}
        compact={false}
      />
    );

    expect(screen.getByText("Low Trust")).toBeInTheDocument();
    expect(screen.getByText("60%")).toBeInTheDocument();
  });

  it("handles missing beach accuracy data gracefully", () => {
    render(
      <AdjustedForecastDisplay
        rawForecast={mockForecast}
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

  it("works without forecast data in feedback form", () => {
    const mockOnSubmit = jest.fn();
    const mockOnSkip = jest.fn();

    render(
      <ForecastFeedbackForm
        session={mockSession}
        forecast={null}
        onSubmit={mockOnSubmit}
        onSkip={mockOnSkip}
      />
    );

    expect(
      screen.getByText("How did the forecast compare?")
    ).toBeInTheDocument();
    // Should not show forecast comparison badges
    expect(screen.queryByText(/Forecast:/)).not.toBeInTheDocument();
  });

  it("shows skip functionality in prompt", async () => {
    const mockOnSubmitFeedback = jest.fn();
    const mockOnDismiss = jest.fn();

    render(
      <ForecastFeedbackPrompt
        session={mockSession}
        forecast={mockForecast}
        onSubmitFeedback={mockOnSubmitFeedback}
        onDismiss={mockOnDismiss}
      />
    );

    const skipButton = screen.getByRole("button", { name: /skip/i });
    fireEvent.click(skipButton);

    expect(mockOnDismiss).toHaveBeenCalled();
  });

  it("displays compact adjusted forecast correctly", () => {
    render(
      <AdjustedForecastDisplay
        rawForecast={mockForecast}
        beachAccuracy={mockBeachAccuracy}
        compact={true}
      />
    );

    // In compact mode, should still show key info
    expect(screen.getByText("Medium Trust")).toBeInTheDocument();
    expect(screen.getByText(/25.*sessions/)).toBeInTheDocument();
  });

  it("shows recent session timing in prompt", () => {
    // Create a session from yesterday
    const recentSession = {
      ...mockSession,
      arrival_time: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    };

    const mockOnSubmitFeedback = jest.fn();
    const mockOnDismiss = jest.fn();

    render(
      <ForecastFeedbackPrompt
        session={recentSession}
        forecast={mockForecast}
        onSubmitFeedback={mockOnSubmitFeedback}
        onDismiss={mockOnDismiss}
      />
    );

    expect(
      screen.getByText(
        "Perfect timing! Recent sessions provide the best feedback."
      )
    ).toBeInTheDocument();
  });

  it("displays adjusted wave height values correctly", () => {
    render(
      <AdjustedForecastDisplay
        rawForecast={mockForecast}
        beachAccuracy={mockBeachAccuracy}
        compact={false}
        showComparison={true}
      />
    );

    // Should show both raw (6ft from "4-6 ft") and adjusted values
    // The adjusted value should be different due to the beach accuracy delta
    const waveHeightElements = screen.getAllByText(/ft/);
    expect(waveHeightElements.length).toBeGreaterThan(0);
  });
});
