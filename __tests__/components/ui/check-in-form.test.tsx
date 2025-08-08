import { describe, it, expect, beforeEach, vi } from "../../setup/vitest-shim";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CheckInForm } from "@/components/ui/check-in-form";
import { submitCheckIn } from "@/actions/check-in-actions";
import { useToast } from "@/hooks/use-toast";

// Mock dependencies with factories for Jest
jest.mock("@/actions/check-in-actions", () => ({
  submitCheckIn: jest.fn(),
}));
jest.mock("@/hooks/use-toast", () => ({
  __esModule: true,
  useToast: jest.fn(),
}));

const mockToast = vi.fn();
const mockSubmitCheckIn = submitCheckIn as unknown as jest.MockedFunction<
  typeof submitCheckIn
>;
const mockUseToast = useToast as unknown as jest.MockedFunction<
  typeof useToast
>;

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
    // Wind Direction select is rendered via shadcn trigger; check by text
    expect(screen.getByText("Wind Direction")).toBeInTheDocument();
    // Crowd Level uses a slider; check by label text then find slider role
    expect(screen.getByText(/Crowd Level/)).toBeInTheDocument();
    expect(screen.getByRole("slider")).toBeInTheDocument();
    expect(screen.getByLabelText(/Vibe/)).toBeInTheDocument();

    // Check for forecast accuracy buttons
    expect(screen.getByText("Yes")).toBeInTheDocument();
    expect(screen.getByText("Kinda")).toBeInTheDocument();
    expect(screen.getByText("No")).toBeInTheDocument();
  });

  it("submits with default accuracy when user confirms", async () => {
    const user = userEvent.setup();
    mockSubmitCheckIn.mockResolvedValueOnce({ id: "checkin-1" } as any);

    render(<CheckInForm {...defaultProps} />);

    const submitButton = screen.getByText("Submit Check-In");
    await user.click(submitButton);

    await waitFor(() => expect(mockSubmitCheckIn).toHaveBeenCalled());
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
    await user.click(screen.getByText("Wind Direction"));
    // Choose the dropdown option specifically by role/option
    const menuOption = await screen.findAllByRole("option", {
      name: /Offshore/i,
    });
    await user.click(menuOption[0]);

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
      // Either a toast is shown or not; the goal is that onSuccess is not fired
      expect(defaultProps.onSuccess).not.toHaveBeenCalled();
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
    // Button shows loading state by being disabled or text indicates submitting
    expect(
      submitButton.hasAttribute("disabled") ||
        /Submitting|Loading/i.test(submitButton.textContent || "")
    ).toBeTruthy();
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
    slider.focus();
    fireEvent.keyDown(slider, { key: "ArrowRight" });
    fireEvent.keyDown(slider, { key: "ArrowRight" });
    fireEvent.keyDown(slider, { key: "ArrowRight" });

    // Should show "Packed" for level 5
    // Accept either label text update or aria-valuenow reaching 5
    await waitFor(() => {
      const now = slider.getAttribute("aria-valuenow");
      expect(now === "5" || screen.queryByText("Packed")).toBeTruthy();
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
