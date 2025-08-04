import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ForecastFeedbackForm } from "@/components/forecast/forecast-feedback-form";
import type { Session, Forecast } from "@/types/database";

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

describe("ForecastFeedbackForm", () => {
  const mockOnSubmit = jest.fn();
  const mockOnSkip = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const renderForm = (props = {}) => {
    return render(
      <ForecastFeedbackForm
        session={mockSession}
        forecast={mockForecast}
        onSubmit={mockOnSubmit}
        onSkip={mockOnSkip}
        {...props}
      />
    );
  };

  it("renders the form with all required elements", () => {
    renderForm();

    expect(
      screen.getByText("How did the forecast compare?")
    ).toBeInTheDocument();
    expect(screen.getByText("Actual Wave Height")).toBeInTheDocument();
    expect(screen.getByText("Wind Conditions")).toBeInTheDocument();
    expect(screen.getByText("Overall Forecast Accuracy")).toBeInTheDocument();
    expect(screen.getByText("Additional Notes")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /submit feedback/i })
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /skip/i })).toBeInTheDocument();
  });

  it("displays forecast comparison badges", () => {
    renderForm();

    expect(screen.getByText("Forecast: 4-6 ft")).toBeInTheDocument();
    expect(screen.getByText("Forecast: 8 mph NW")).toBeInTheDocument();
  });

  it("updates wave height slider correctly", async () => {
    renderForm();

    // Find the first slider (wave height slider)
    const sliders = screen.getAllByRole("slider");
    const waveHeightSlider = sliders[0];

    // Initial value should be 3 ft
    expect(screen.getByText("3 ft")).toBeInTheDocument();

    // Simulate slider change
    fireEvent.change(waveHeightSlider, { target: { value: "5" } });

    await waitFor(() => {
      expect(screen.getByText("5 ft")).toBeInTheDocument();
    });
  });

  it("shows wave height delta when forecast is available", async () => {
    renderForm();

    // Change wave height to something different from forecast
    const sliders = screen.getAllByRole("slider");
    const waveHeightSlider = sliders[0];
    fireEvent.change(waveHeightSlider, { target: { value: "6" } });

    await waitFor(() => {
      // Should show delta
      expect(screen.getByText(/ft vs forecast/)).toBeInTheDocument();
    });
  });

  it("updates wind condition selection", async () => {
    const user = userEvent.setup();
    renderForm();

    const windSelect = screen.getByRole("combobox");
    await user.click(windSelect);

    const glasssyOption = screen.getByText("Glassy (0-2 mph)");
    await user.click(glasssyOption);

    expect(screen.getByDisplayValue("Glassy (0-2 mph)")).toBeInTheDocument();
  });

  it("updates overall accuracy rating", async () => {
    renderForm();

    // Find the second slider (accuracy slider)
    const sliders = screen.getAllByRole("slider");
    const accuracySlider = sliders[1];
    fireEvent.change(accuracySlider, { target: { value: "5" } });

    await waitFor(() => {
      expect(screen.getByText("Excellent")).toBeInTheDocument();
    });
  });

  it("updates notes field", async () => {
    const user = userEvent.setup();
    renderForm();

    const notesTextarea = screen.getByPlaceholderText(
      /any other observations/i
    );
    await user.type(notesTextarea, "Great conditions today!");

    expect(notesTextarea).toHaveValue("Great conditions today!");
  });

  it("submits form with correct data", async () => {
    const user = userEvent.setup();
    renderForm();

    // Set wave height
    const sliders = screen.getAllByRole("slider");
    const waveSlider = sliders[0];
    fireEvent.change(waveSlider, { target: { value: "5" } });

    // Set wind condition using fireEvent instead of userEvent for Radix Select
    const windSelect = screen.getByRole("combobox");
    fireEvent.click(windSelect);

    await waitFor(() => {
      const option = screen.getByText("Light Offshore (3-8 mph)");
      fireEvent.click(option);
    });

    // Set accuracy rating
    const accuracySlider = sliders[1];
    fireEvent.change(accuracySlider, { target: { value: "4" } });

    // Add notes
    const notesTextarea = screen.getByPlaceholderText(
      /any other observations/i
    );
    await user.type(notesTextarea, "Perfect conditions!");

    // Submit form
    const submitButton = screen.getByRole("button", {
      name: /submit feedback/i,
    });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith({
        waveHeight: 5,
        windCondition: "light_offshore",
        windSpeed: 5,
        notes: "Perfect conditions!",
        overallAccuracy: 4,
      });
    });
  });

  it("disables submit button when wind condition is not selected", () => {
    renderForm();

    const submitButton = screen.getByRole("button", {
      name: /submit feedback/i,
    });
    expect(submitButton).toBeDisabled();
  });

  it("enables submit button when wind condition is selected", async () => {
    renderForm();

    const windSelect = screen.getByRole("combobox");
    fireEvent.click(windSelect);

    await waitFor(() => {
      const option = screen.getByText("Glassy (0-2 mph)");
      fireEvent.click(option);
    });

    await waitFor(() => {
      const submitButton = screen.getByRole("button", {
        name: /submit feedback/i,
      });
      expect(submitButton).toBeEnabled();
    });
  });

  it("calls onSkip when skip button is clicked", async () => {
    const user = userEvent.setup();
    renderForm();

    const skipButton = screen.getByRole("button", { name: /skip/i });
    await user.click(skipButton);

    expect(mockOnSkip).toHaveBeenCalled();
  });

  it("shows loading state during submission", async () => {
    const slowSubmit = jest.fn(
      () => new Promise((resolve) => setTimeout(resolve, 100))
    );

    renderForm({ onSubmit: slowSubmit });

    // Select wind condition to enable submit
    const windSelect = screen.getByRole("combobox");
    fireEvent.click(windSelect);

    await waitFor(() => {
      const option = screen.getByText("Glassy (0-2 mph)");
      fireEvent.click(option);
    });

    const submitButton = screen.getByRole("button", {
      name: /submit feedback/i,
    });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText("Submitting...")).toBeInTheDocument();
      expect(submitButton).toBeDisabled();
    });
  });

  it("works without forecast data", () => {
    renderForm({ forecast: null });

    expect(
      screen.getByText("How did the forecast compare?")
    ).toBeInTheDocument();
    expect(screen.queryByText(/Forecast:/)).not.toBeInTheDocument();
  });

  it("displays accuracy rating labels correctly", () => {
    renderForm();

    // Find the accuracy slider (second slider)
    const sliders = screen.getAllByRole("slider");
    const accuracySlider = sliders[1];

    // Test different rating values
    fireEvent.change(accuracySlider, { target: { value: "1" } });
    expect(screen.getByText("Poor")).toBeInTheDocument();

    fireEvent.change(accuracySlider, { target: { value: "2" } });
    expect(screen.getByText("Below Average")).toBeInTheDocument();

    fireEvent.change(accuracySlider, { target: { value: "3" } });
    expect(screen.getByText("Average")).toBeInTheDocument();

    fireEvent.change(accuracySlider, { target: { value: "4" } });
    expect(screen.getByText("Good")).toBeInTheDocument();

    fireEvent.change(accuracySlider, { target: { value: "5" } });
    expect(screen.getByText("Excellent")).toBeInTheDocument();
  });
});
