import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CheckInForm } from "@/components/ui/check-in-form";
import { submitCheckIn } from "@/actions/check-in-actions";
import { useToast } from "@/hooks/use-toast";

// Mock dependencies
vi.mock("@/actions/check-in-actions");
vi.mock("@/hooks/use-toast");

const mockToast = vi.fn();
const mockSubmitCheckIn = vi.mocked(submitCheckIn);
const mockUseToast = vi.mocked(useToast);

beforeEach(() => {
  vi.clearAllMocks();
  mockUseToast.mockReturnValue({ toast: mockToast });
});

describe("CheckInForm", () => {
  const defaultProps = {
    beachId: "beach-123",
    beachName: "Ocean Beach",
    onSuccess: vi.fn(),
    onCancel: vi.fn(),
  };

  it("renders form with all required fields", () => {
    render(<CheckInForm {...defaultProps} />);

    expect(screen.getByText("Submit Conditions")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Report current surf conditions at Ocean Beach to help the community"
      )
    ).toBeInTheDocument();

    // Check for main sections
    expect(screen.getByText("Surf Conditions")).toBeInTheDocument();
    expect(screen.getByText("Community Info")).toBeInTheDocument();
    expect(
      screen.getByText("Was today's forecast accurate?")
    ).toBeInTheDocument();

    // Check for form fields
    expect(screen.getByLabelText(/Wave Height/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Water Temp/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Wind Speed/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Wind Direction/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Crowd Level/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Vibe/)).toBeInTheDocument();

    // Check for forecast accuracy buttons
    expect(screen.getByText("Yes")).toBeInTheDocument();
    expect(screen.getByText("Kinda")).toBeInTheDocument();
    expect(screen.getByText("No")).toBeInTheDocument();
  });

  it("validates required forecast accuracy rating", async () => {
    const user = userEvent.setup();
    render(<CheckInForm {...defaultProps} />);

    const submitButton = screen.getByText("Submit Check-In");
    await user.click(submitButton);

    // Form should not submit without forecast accuracy rating being explicitly selected
    expect(mockSubmitCheckIn).not.toHaveBeenCalled();
  });

  it("submits form with valid data", async () => {
    const user = userEvent.setup();
    mockSubmitCheckIn.mockResolvedValueOnce({
      id: "checkin-123",
      user_id: "user-123",
      beach_id: "beach-123",
    } as any);

    render(<CheckInForm {...defaultProps} />);

    // Fill in wave height
    const waveHeightInput = screen.getByLabelText(/Wave Height/);
    await user.type(waveHeightInput, "3.5");

    // Fill in wind speed
    const windSpeedInput = screen.getByLabelText(/Wind Speed/);
    await user.type(windSpeedInput, "10");

    // Select wind direction
    const windDirectionSelect = screen.getByDisplayValue("Select direction");
    await user.click(windDirectionSelect);
    await user.click(screen.getByText("Offshore"));

    // Fill in water temperature
    const waterTempInput = screen.getByLabelText(/Water Temp/);
    await user.type(waterTempInput, "68");

    // Set crowd level using slider (default is already 3)

    // Add vibe notes
    const vibeTextarea = screen.getByLabelText(/Vibe/);
    await user.type(vibeTextarea, "super fun and glassy");

    // Select forecast accuracy - click "Yes" button
    const accurateButton = screen.getByRole("button", { name: /Yes/ });
    await user.click(accurateButton);

    // Submit form
    const submitButton = screen.getByText("Submit Check-In");
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockSubmitCheckIn).toHaveBeenCalledWith("beach-123", {
        wave_height: 3.5,
        wind_speed: 10,
        wind_direction: "OFFSHORE",
        water_temp: 68,
        crowd_level: 3,
        vibe: "super fun and glassy",
        forecast_accuracy_rating: "accurate",
      });
    });

    expect(mockToast).toHaveBeenCalledWith({
      title: "Check-in submitted!",
      description:
        "Thanks for helping the surf community with real-time conditions.",
    });

    expect(defaultProps.onSuccess).toHaveBeenCalled();
  });

  it("handles submission errors gracefully", async () => {
    const user = userEvent.setup();
    mockSubmitCheckIn.mockRejectedValueOnce(new Error("Submission failed"));

    render(<CheckInForm {...defaultProps} />);

    // Select forecast accuracy (minimum required)
    const accurateButton = screen.getByRole("button", { name: /Yes/ });
    await user.click(accurateButton);

    // Submit form
    const submitButton = screen.getByText("Submit Check-In");
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        title: "Failed to submit check-in",
        description:
          "Please try again. Make sure you're connected to the internet.",
        variant: "destructive",
      });
    });

    expect(defaultProps.onSuccess).not.toHaveBeenCalled();
  });

  it("shows loading state during submission", async () => {
    const user = userEvent.setup();
    // Mock a delayed response
    mockSubmitCheckIn.mockImplementation(
      () => new Promise((resolve) => setTimeout(resolve, 100))
    );

    render(<CheckInForm {...defaultProps} />);

    // Select forecast accuracy
    const accurateButton = screen.getByRole("button", { name: /Yes/ });
    await user.click(accurateButton);

    // Submit form
    const submitButton = screen.getByText("Submit Check-In");
    await user.click(submitButton);

    // Check loading state
    expect(screen.getByText("Submitting...")).toBeInTheDocument();
    expect(submitButton).toBeDisabled();
  });

  it("calls onCancel when cancel button is clicked", async () => {
    const user = userEvent.setup();
    render(<CheckInForm {...defaultProps} />);

    const cancelButton = screen.getByText("Cancel");
    await user.click(cancelButton);

    expect(defaultProps.onCancel).toHaveBeenCalled();
  });

  it("updates crowd level slider correctly", async () => {
    const user = userEvent.setup();
    render(<CheckInForm {...defaultProps} />);

    // The slider should show "Moderate" by default (level 3)
    expect(screen.getByText("Moderate")).toBeInTheDocument();

    // Find and interact with the slider
    const slider = screen.getByRole("slider");

    // Change slider value - this is approximate since slider interaction can be complex
    fireEvent.change(slider, { target: { value: "5" } });

    // Should show "Packed" for level 5
    await waitFor(() => {
      expect(screen.getByText("Packed")).toBeInTheDocument();
    });
  });

  it("validates numeric inputs correctly", async () => {
    const user = userEvent.setup();
    render(<CheckInForm {...defaultProps} />);

    // Test wave height validation
    const waveHeightInput = screen.getByLabelText(/Wave Height/);
    await user.type(waveHeightInput, "60"); // Above max of 50

    // Test water temp validation
    const waterTempInput = screen.getByLabelText(/Water Temp/);
    await user.type(waterTempInput, "20"); // Below min of 32

    // Select forecast accuracy
    const accurateButton = screen.getByRole("button", { name: /Yes/ });
    await user.click(accurateButton);

    // Try to submit - should show validation errors
    const submitButton = screen.getByText("Submit Check-In");
    await user.click(submitButton);

    // Form validation should prevent submission
    expect(mockSubmitCheckIn).not.toHaveBeenCalled();
  });

  it("highlights selected forecast accuracy option", async () => {
    const user = userEvent.setup();
    render(<CheckInForm {...defaultProps} />);

    const accurateButton = screen.getByRole("button", { name: /Yes/ });
    await user.click(accurateButton);

    // Check if the button has selected styling (this depends on implementation)
    expect(accurateButton).toHaveClass("border-blue-500");
  });

  it("handles missing optional props gracefully", () => {
    const minimalProps = {
      beachId: "beach-123",
      beachName: "Test Beach",
    };

    render(<CheckInForm {...minimalProps} />);

    expect(screen.getByText("Submit Conditions")).toBeInTheDocument();
    expect(screen.queryByText("Cancel")).not.toBeInTheDocument();
  });
});
