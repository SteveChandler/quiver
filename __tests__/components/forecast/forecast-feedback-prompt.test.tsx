import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ForecastFeedbackPrompt } from "@/components/forecast/forecast-feedback-prompt";
import type { Session, Forecast } from "@/types/database";

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

describe("ForecastFeedbackPrompt", () => {
  const mockOnSubmitFeedback = jest.fn();
  const mockOnDismiss = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const renderPrompt = (props = {}) => {
    return render(
      <ForecastFeedbackPrompt
        session={mockSession}
        forecast={mockForecast}
        onSubmitFeedback={mockOnSubmitFeedback}
        onDismiss={mockOnDismiss}
        {...props}
      />
    );
  };

  it("renders the prompt card correctly", () => {
    renderPrompt();

    expect(screen.getByText("Help Improve Forecasts")).toBeInTheDocument();
    expect(
      screen.getByText(/How did the forecast compare to actual conditions/)
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /share feedback/i })
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /skip/i })).toBeInTheDocument();
  });

  it("displays session date correctly", () => {
    renderPrompt();

    const sessionDate = new Date(mockSession.arrival_time).toLocaleDateString();
    expect(screen.getByText(new RegExp(sessionDate))).toBeInTheDocument();
  });

  it("shows recent session indicator for fresh sessions", () => {
    // Create a session from yesterday
    const recentSession = {
      ...mockSession,
      arrival_time: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    };

    renderPrompt({ session: recentSession });

    expect(
      screen.getByText(
        "Perfect timing! Recent sessions provide the best feedback."
      )
    ).toBeInTheDocument();
  });

  it("does not show recent session indicator for old sessions", () => {
    // Create a session from a week ago
    const oldSession = {
      ...mockSession,
      arrival_time: new Date(
        Date.now() - 7 * 24 * 60 * 60 * 1000
      ).toISOString(),
    };

    renderPrompt({ session: oldSession });

    expect(
      screen.queryByText(
        "Perfect timing! Recent sessions provide the best feedback."
      )
    ).not.toBeInTheDocument();
  });

  it("opens feedback dialog when share feedback button is clicked", async () => {
    const user = userEvent.setup();
    renderPrompt();

    const shareButton = screen.getByRole("button", { name: /share feedback/i });
    await user.click(shareButton);

    // Should open dialog with the feedback form
    await waitFor(() => {
      expect(screen.getByText(/Forecast Feedback for/)).toBeInTheDocument();
      expect(screen.getByText("Actual Wave Height")).toBeInTheDocument();
    });
  });

  it("calls onDismiss when skip button is clicked", async () => {
    const user = userEvent.setup();
    renderPrompt();

    const skipButton = screen.getByRole("button", { name: /skip/i });
    await user.click(skipButton);

    expect(mockOnDismiss).toHaveBeenCalled();
  });

  it("calls onDismiss when dismiss button is clicked", async () => {
    const user = userEvent.setup();
    renderPrompt();

    const dismissButton = screen.getByRole("button", { name: /close/i });
    await user.click(dismissButton);

    expect(mockOnDismiss).toHaveBeenCalled();
  });

  it("shows success state after feedback submission", async () => {
    const user = userEvent.setup();

    // Mock successful submission
    mockOnSubmitFeedback.mockResolvedValue(undefined);

    renderPrompt();

    // Open dialog and submit feedback
    const shareButton = screen.getByRole("button", { name: /share feedback/i });
    await user.click(shareButton);

    // Wait for dialog to open and form to be available
    await waitFor(() => {
      expect(screen.getByRole("combobox")).toBeInTheDocument();
    });

    // Select wind condition to enable submit
    const windSelect = screen.getByRole("combobox");
    await user.click(windSelect);
    await user.click(screen.getByText("Glassy (0-2 mph)"));

    // Submit the form
    const submitButton = screen.getByRole("button", {
      name: /submit feedback/i,
    });
    await user.click(submitButton);

    // Should show success state
    await waitFor(() => {
      expect(
        screen.getByText("Thank you for your feedback!")
      ).toBeInTheDocument();
      expect(
        screen.getByText(
          "Your input helps improve forecasts for the entire community."
        )
      ).toBeInTheDocument();
    });
  });

  it("handles feedback submission errors gracefully", async () => {
    const user = userEvent.setup();

    // Mock failed submission
    mockOnSubmitFeedback.mockRejectedValue(new Error("Network error"));

    renderPrompt();

    // Open dialog and submit feedback
    const shareButton = screen.getByRole("button", { name: /share feedback/i });
    await user.click(shareButton);

    await waitFor(() => {
      expect(screen.getByRole("combobox")).toBeInTheDocument();
    });

    // Select wind condition and submit
    const windSelect = screen.getByRole("combobox");
    await user.click(windSelect);
    await user.click(screen.getByText("Glassy (0-2 mph)"));

    const submitButton = screen.getByRole("button", {
      name: /submit feedback/i,
    });
    await user.click(submitButton);

    // Should still proceed (error handled in hook)
    await waitFor(() => {
      expect(
        screen.getByText("Thank you for your feedback!")
      ).toBeInTheDocument();
    });
  });

  it("displays motivational stats correctly", () => {
    renderPrompt();

    expect(screen.getByText("Accuracy")).toBeInTheDocument();
    expect(screen.getByText("Community")).toBeInTheDocument();
    expect(screen.getByText("Quality")).toBeInTheDocument();
    expect(screen.getByText("Help improve")).toBeInTheDocument();
    expect(screen.getByText("Join effort")).toBeInTheDocument();
    expect(screen.getByText("Better forecasts")).toBeInTheDocument();
  });

  it("shows educational messaging", () => {
    renderPrompt();

    expect(screen.getByText("Why feedback matters:")).toBeInTheDocument();
    expect(
      screen.getByText(/Your input creates a community-driven forecast/)
    ).toBeInTheDocument();
  });

  it("works without forecast data", () => {
    renderPrompt({ forecast: null });

    expect(screen.getByText("Help Improve Forecasts")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /share feedback/i })
    ).toBeInTheDocument();
  });

  it("can auto-show the dialog", async () => {
    renderPrompt({ autoShow: true });

    // Dialog should be open automatically
    await waitFor(() => {
      expect(screen.getByText(/Forecast Feedback for/)).toBeInTheDocument();
    });
  });

  it("displays optional badge", () => {
    renderPrompt();

    expect(screen.getByText("Optional")).toBeInTheDocument();
  });

  it("includes session date in dialog title", async () => {
    const user = userEvent.setup();
    renderPrompt();

    const shareButton = screen.getByRole("button", { name: /share feedback/i });
    await user.click(shareButton);

    const sessionDate = new Date(mockSession.arrival_time).toLocaleDateString();
    await waitFor(() => {
      expect(
        screen.getByText(`Forecast Feedback for ${sessionDate}`)
      ).toBeInTheDocument();
    });
  });

  it("includes helpful description in dialog", async () => {
    const user = userEvent.setup();
    renderPrompt();

    const shareButton = screen.getByRole("button", { name: /share feedback/i });
    await user.click(shareButton);

    await waitFor(() => {
      expect(
        screen.getByText(
          /Compare how the forecast matched your actual experience/
        )
      ).toBeInTheDocument();
    });
  });
});
