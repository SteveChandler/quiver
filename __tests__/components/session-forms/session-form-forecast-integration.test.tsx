import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRouter, useSearchParams } from "next/navigation";
import { SessionForm } from "@/components/session-forms/SessionForm";
import { useAuth } from "@/context/auth-context";
import { useSessionForm } from "@/hooks/use-session-form";
import { useForecastCalibration } from "@/hooks/use-forecast-calibration";
import * as sessionActions from "@/actions/session-actions";
import * as forecastActions from "@/actions/forecast-actions";

// Mock Supabase client first to prevent RealtimeClient issues
jest.mock("@/lib/supabase/client", () => ({
  createClient: jest.fn(() => ({
    auth: {
      getUser: jest.fn(),
      onAuthStateChange: jest.fn(),
    },
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    storage: {
      from: jest.fn().mockReturnThis(),
      upload: jest.fn(),
      remove: jest.fn(),
      getPublicUrl: jest.fn(),
    },
  })),
}));

// Mock Next.js navigation
const mockPush = jest.fn();
const mockRouter = {
  push: mockPush,
  replace: jest.fn(),
  back: jest.fn(),
  forward: jest.fn(),
  refresh: jest.fn(),
  prefetch: jest.fn(),
};

// Mock dependencies
jest.mock("next/navigation", () => ({
  useRouter: jest.fn(() => mockRouter),
  useSearchParams: jest.fn(),
  usePathname: jest.fn(),
}));
jest.mock("@/context/auth-context");
jest.mock("@/hooks/use-session-form");
jest.mock("@/hooks/use-forecast-calibration");
jest.mock("@/actions/session-actions");
jest.mock("@/actions/forecast-actions");
jest.mock("@/actions/session-media-actions");
jest.mock("sonner", () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

const mockUser = {
  id: "user-1",
  email: "test@example.com",
};

const mockFormState = {
  selectedBeach: "Test Beach",
  selectedBeachId: "beach-1",
  selectedDate: "2024-01-15",
  selectedTime: "10:00",
  notes: "",
  overallRating: "",
  duration: "2h",
  waveQuality: "4",
  crowdLevel: "2",
  parkingEase: "5",
  waterTemp: "68°F",
};

const mockCreatedSession = {
  id: "session-1",
  user_id: "user-1",
  beach_id: "beach-1",
  arrival_time: "2024-01-15T10:00:00Z",
  status: "completed",
  rating: 4,
  duration_minutes: 120,
  wave_quality: 4,
  crowd_level: 2,
  parking_ease: 5,
  water_temp: "68°F",
  notes: "",
  created_at: "2024-01-15T09:00:00Z",
  updated_at: "2024-01-15T12:30:00Z",
};

const mockForecast = {
  id: "forecast-1",
  beach_id: "beach-1",
  valid_time: "2024-01-15T10:00:00Z",
  wave_height: "4-6 ft",
  wind_speed: "8 mph",
  wind_direction: "NW",
  confidence_score: 85,
  data_source: "NOAA_NWS",
  created_at: "2024-01-15T08:00:00Z",
  updated_at: "2024-01-15T08:00:00Z",
};

describe("SessionForm Forecast Integration", () => {
  const mockUpdateField = jest.fn();
  const mockSubmitForecastFeedback = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    // Router is already mocked globally
    mockPush.mockClear();

    // Mock search params
    (useSearchParams as jest.Mock).mockReturnValue({
      get: jest.fn().mockReturnValue(null),
    });

    // Mock auth
    (useAuth as jest.Mock).mockReturnValue({
      user: mockUser,
    });

    // Mock session form hook
    (useSessionForm as jest.Mock).mockReturnValue({
      mode: "log",
      setMode: jest.fn(),
      loading: false,
      setLoading: jest.fn(),
      formState: mockFormState,
      updateField: mockUpdateField,
      refreshBoards: jest.fn(),
      boards: [],
      resetForm: jest.fn(),
    });

    // Mock forecast calibration hook
    (useForecastCalibration as jest.Mock).mockReturnValue({
      submitForecastFeedback: mockSubmitForecastFeedback,
      beachAccuracy: null,
      sessionSnapshots: [],
      loading: false,
    });

    // Mock session actions
    (sessionActions.createLoggedSession as jest.Mock).mockResolvedValue(
      mockCreatedSession
    );

    // Mock forecast actions
    (forecastActions.getForecastForDate as jest.Mock).mockResolvedValue({
      success: true,
      data: mockForecast,
    });
  });

  it("shows forecast feedback prompt after successful session logging", async () => {
    const user = userEvent.setup();

    render(<SessionForm initialMode="log" />);

    // Simulate form submission
    const form = screen.getByTestId("session-planning-form");
    fireEvent.submit(form);

    // Wait for session creation and forecast loading
    await waitFor(() => {
      expect(sessionActions.createLoggedSession).toHaveBeenCalled();
    });

    // Should show success message and feedback prompt
    await waitFor(() => {
      expect(
        screen.getByText(/session logged successfully/i)
      ).toBeInTheDocument();
      expect(screen.getByText("Help Improve Forecasts")).toBeInTheDocument();
    });
  });

  it("loads forecast data for the session date and beach", async () => {
    render(<SessionForm initialMode="log" />);

    // Simulate form submission
    const form = screen.getByTestId("session-planning-form");
    fireEvent.submit(form);

    await waitFor(() => {
      expect(forecastActions.getForecastForDate).toHaveBeenCalledWith(
        "beach-1",
        "2024-01-15"
      );
    });
  });

  it("handles forecast feedback submission", async () => {
    const user = userEvent.setup();
    mockSubmitForecastFeedback.mockResolvedValue(undefined);

    render(<SessionForm initialMode="log" />);

    // Submit form to create session
    const form = screen.getByTestId("session-planning-form");
    fireEvent.submit(form);

    // Wait for feedback prompt to appear
    await waitFor(() => {
      expect(screen.getByText("Help Improve Forecasts")).toBeInTheDocument();
    });

    // Open feedback dialog
    const shareButton = screen.getByRole("button", { name: /share feedback/i });
    await user.click(shareButton);

    // Fill out feedback form
    await waitFor(() => {
      expect(screen.getByRole("combobox")).toBeInTheDocument();
    });

    const windSelect = screen.getByRole("combobox");
    await user.click(windSelect);
    await user.click(screen.getByText("Glassy (0-2 mph)"));

    // Submit feedback
    const submitButton = screen.getByRole("button", {
      name: /submit feedback/i,
    });
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockSubmitForecastFeedback).toHaveBeenCalledWith(
        mockCreatedSession,
        mockForecast,
        expect.objectContaining({
          windCondition: "glassy",
          windSpeed: 1,
          waveHeight: 3,
          overallAccuracy: 3,
        })
      );
    });
  });

  it("allows skipping forecast feedback", async () => {
    const user = userEvent.setup();

    render(<SessionForm initialMode="log" />);

    // Submit form to create session
    const form = screen.getByTestId("session-planning-form");
    fireEvent.submit(form);

    // Wait for feedback prompt
    await waitFor(() => {
      expect(screen.getByText("Help Improve Forecasts")).toBeInTheDocument();
    });

    // Skip feedback
    const skipButton = screen.getByRole("button", { name: /skip/i });
    await user.click(skipButton);

    // Should proceed to redirect
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/profile");
    });
  });

  it("handles forecast loading errors gracefully", async () => {
    (forecastActions.getForecastForDate as jest.Mock).mockRejectedValue(
      new Error("Forecast not found")
    );

    render(<SessionForm initialMode="log" />);

    // Submit form
    const form = screen.getByTestId("session-planning-form");
    fireEvent.submit(form);

    // Should still show feedback prompt even without forecast
    await waitFor(() => {
      expect(screen.getByText("Help Improve Forecasts")).toBeInTheDocument();
    });
  });

  it("doesn't show forecast feedback for planned sessions", async () => {
    (useSessionForm as jest.Mock).mockReturnValue({
      mode: "plan",
      setMode: jest.fn(),
      loading: false,
      setLoading: jest.fn(),
      formState: mockFormState,
      updateField: mockUpdateField,
      refreshBoards: jest.fn(),
      boards: [],
      resetForm: jest.fn(),
    });

    render(<SessionForm initialMode="plan" />);

    // Submit form
    const form = screen.getByTestId("session-planning-form");
    fireEvent.submit(form);

    // Should not show feedback prompt for planned sessions
    await waitFor(() => {
      expect(
        screen.queryByText("Help Improve Forecasts")
      ).not.toBeInTheDocument();
    });
  });

  it("redirects after feedback completion", async () => {
    const user = userEvent.setup();
    mockSubmitForecastFeedback.mockResolvedValue(undefined);

    render(<SessionForm initialMode="log" />);

    // Submit form and complete feedback flow
    const form = screen.getByTestId("session-planning-form");
    fireEvent.submit(form);

    await waitFor(() => {
      expect(screen.getByText("Help Improve Forecasts")).toBeInTheDocument();
    });

    // Skip feedback to trigger redirect
    const skipButton = screen.getByRole("button", { name: /skip/i });
    await user.click(skipButton);

    // Should redirect after a delay
    await waitFor(
      () => {
        expect(mockPush).toHaveBeenCalledWith("/profile");
      },
      { timeout: 3000 }
    );
  });

  it("handles forecast feedback submission errors", async () => {
    const user = userEvent.setup();
    mockSubmitForecastFeedback.mockRejectedValue(
      new Error("Submission failed")
    );

    render(<SessionForm initialMode="log" />);

    // Submit form
    const form = screen.getByTestId("session-planning-form");
    fireEvent.submit(form);

    await waitFor(() => {
      expect(screen.getByText("Help Improve Forecasts")).toBeInTheDocument();
    });

    // Open and submit feedback
    const shareButton = screen.getByRole("button", { name: /share feedback/i });
    await user.click(shareButton);

    await waitFor(() => {
      expect(screen.getByRole("combobox")).toBeInTheDocument();
    });

    const windSelect = screen.getByRole("combobox");
    await user.click(windSelect);
    await user.click(screen.getByText("Glassy (0-2 mph)"));

    const submitButton = screen.getByRole("button", {
      name: /submit feedback/i,
    });
    await user.click(submitButton);

    // Should handle error gracefully and allow user to continue
    await waitFor(
      () => {
        expect(mockPush).toHaveBeenCalledWith("/profile");
      },
      { timeout: 3000 }
    );
  });

  it("passes correct session and forecast data to feedback form", async () => {
    render(<SessionForm initialMode="log" />);

    // Submit form
    const form = screen.getByTestId("session-planning-form");
    fireEvent.submit(form);

    await waitFor(() => {
      expect(useForecastCalibration).toHaveBeenCalledWith({
        sessionId: "session-1",
        beachId: "beach-1",
      });
    });
  });
});
