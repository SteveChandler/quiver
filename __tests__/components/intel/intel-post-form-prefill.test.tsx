import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { IntelPostForm } from "@/components/intel/intel-post-form";
import { getEnhancedBeachForecasts } from "@/actions/forecast-actions";
import { createIntelPost } from "@/actions/intel-actions";
import { toast } from "sonner";

// Mock dependencies
jest.mock("@/actions/forecast-actions");
jest.mock("@/actions/intel-actions");
jest.mock("sonner");
jest.mock("next/image", () => ({
  __esModule: true,
  // eslint-disable-next-line jsx-a11y/alt-text -- mock component passes through all props
  default: (props: any) => <img {...props} />,
}));

const mockGetEnhancedBeachForecasts = getEnhancedBeachForecasts as jest.MockedFunction<
  typeof getEnhancedBeachForecasts
>;
const mockCreateIntelPost = createIntelPost as jest.MockedFunction<
  typeof createIntelPost
>;
const mockToast = toast as jest.Mocked<typeof toast>;

// Mock forecast data
const mockForecast = {
  id: "forecast-1",
  beach_id: "beach-123",
  forecast_at: `${new Date().toISOString().split("T")[0]}T12:00Z`,
  forecast_date: new Date().toISOString().split("T")[0],
  forecast_time: "12:00",
  wave_height: "4.5",
  wind_speed: "12",
  wind_direction: "NW",
  water_temp: "62",
  tide_height: "3.2",
  tide_status: "rising",
  swell_height: null,
  swell_period: null,
  swell_direction: null,
  conditions_score: null,
  conditions_summary: null,
  recommendation: null,
  weather_temp: null,
  weather_description: null,
  weather_icon: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  data_source: "test",
  next_tide_height: null,
  next_tide_time: null,
  next_tide_type: null,
  generated_at: null,
  generation_method: null,
  source_weights: null,
  confidence_score: 75,
  metadata: {
    primarySource: "test",
    allSources: ["test"],
    confidenceScore: 75,
    lastUpdated: new Date().toISOString(),
    isStaleData: false,
  },
};

const defaultProps = {
  isOpen: true,
  onClose: jest.fn(),
  onSuccess: jest.fn(),
  beachId: "beach-123",
  beachName: "Test Beach",
  initialLocation: { latitude: 32.7157, longitude: -117.1611 },
};

beforeEach(() => {
  jest.clearAllMocks();
  mockGetEnhancedBeachForecasts.mockResolvedValue({
    success: true,
    data: [mockForecast],
  });
  mockCreateIntelPost.mockResolvedValue({
    success: true,
    data: {} as any,
  });
});

describe("IntelPostForm Conditions Prefill", () => {
  it("prefills wave_height, wind_speed, wind_direction, water_temp when tag is conditions", async () => {
    render(<IntelPostForm {...defaultProps} variant="check-in" />);

    // Wait for forecast fetch and prefill
    await waitFor(() => {
      expect(mockGetEnhancedBeachForecasts).toHaveBeenCalledWith("beach-123", 2);
    });

    // Check that fields are prefilled
    await waitFor(() => {
      const waveHeightInput = screen.getByPlaceholderText("3.5") as HTMLInputElement;
      expect(waveHeightInput.value).toBe("4.5");
    });

    const windSpeedInput = screen.getByPlaceholderText("10") as HTMLInputElement;
    expect(windSpeedInput.value).toBe("12");

    const waterTempInput = screen.getByPlaceholderText("68") as HTMLInputElement;
    expect(waterTempInput.value).toBe("62");

    // Wind direction should be set - check the select trigger contains the value
    // Use getAllByText and check that at least one element with "Northwest" exists
    const northwestElements = screen.getAllByText("Northwest");
    expect(northwestElements.length).toBeGreaterThanOrEqual(1);
  });

  it("does not prefill when tag is not conditions", async () => {
    render(<IntelPostForm {...defaultProps} />);

    // Wait a moment for any async operations
    await act(async () => {
      await new Promise((r) => setTimeout(r, 100));
    });

    // Forecast should not be fetched for non-conditions tag
    expect(mockGetEnhancedBeachForecasts).not.toHaveBeenCalled();
  });

  it("does not overwrite user-edited fields on subsequent renders", async () => {
    render(<IntelPostForm {...defaultProps} variant="check-in" />);

    // Wait for prefill
    await waitFor(() => {
      expect(mockGetEnhancedBeachForecasts).toHaveBeenCalled();
    });

    await waitFor(() => {
      const waveHeightInput = screen.getByPlaceholderText("3.5") as HTMLInputElement;
      expect(waveHeightInput.value).toBe("4.5");
    });

    // User edits wave height
    const waveHeightInput = screen.getByPlaceholderText("3.5") as HTMLInputElement;
    fireEvent.change(waveHeightInput, { target: { value: "6.0" } });
    expect(waveHeightInput.value).toBe("6.0");

    // The user edit should persist (value should not be reset to 4.5)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 100));
    });

    expect(waveHeightInput.value).toBe("6.0");
  });

  it("shows empty fields when no forecast data available", async () => {
    mockGetEnhancedBeachForecasts.mockResolvedValue({
      success: true,
      data: [],
    });

    render(<IntelPostForm {...defaultProps} variant="check-in" />);

    await waitFor(() => {
      expect(mockGetEnhancedBeachForecasts).toHaveBeenCalled();
    });

    // Fields should remain empty (show placeholder)
    const waveHeightInput = screen.getByPlaceholderText("3.5") as HTMLInputElement;
    expect(waveHeightInput.value).toBe("");
  });

  it("does not fetch when beachId is not provided", async () => {
    render(
      <IntelPostForm
        {...defaultProps}
        beachId={undefined}
        variant="check-in"
      />
    );

    await act(async () => {
      await new Promise((r) => setTimeout(r, 100));
    });

    expect(mockGetEnhancedBeachForecasts).not.toHaveBeenCalled();
  });

  it("handles forecast fetch error gracefully", async () => {
    mockGetEnhancedBeachForecasts.mockRejectedValue(new Error("Network error"));

    render(<IntelPostForm {...defaultProps} variant="check-in" />);

    await waitFor(() => {
      expect(mockGetEnhancedBeachForecasts).toHaveBeenCalled();
    });

    // Form should still be usable - fields just won't be prefilled
    const waveHeightInput = screen.getByPlaceholderText("3.5") as HTMLInputElement;
    expect(waveHeightInput.value).toBe("");

    // User can still enter values manually
    fireEvent.change(waveHeightInput, { target: { value: "5.0" } });
    expect(waveHeightInput.value).toBe("5.0");
  });

  it("resets prefill state when modal closes and reopens", async () => {
    const { rerender, unmount } = render(<IntelPostForm {...defaultProps} variant="check-in" />);

    // Wait for prefill
    await waitFor(() => {
      expect(mockGetEnhancedBeachForecasts).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      const waveHeightInput = screen.getByPlaceholderText("3.5") as HTMLInputElement;
      expect(waveHeightInput.value).toBe("4.5");
    });

    // Close and unmount completely
    unmount();

    // Clear the mock to track new calls
    mockGetEnhancedBeachForecasts.mockClear();

    // Render a fresh instance (simulating reopening)
    render(<IntelPostForm {...defaultProps} variant="check-in" isOpen={true} />);

    // Should fetch again for the new instance
    await waitFor(() => {
      expect(mockGetEnhancedBeachForecasts).toHaveBeenCalledTimes(1);
    });

    // Fields should be prefilled again
    await waitFor(() => {
      const waveHeightInput = screen.getByPlaceholderText("3.5") as HTMLInputElement;
      expect(waveHeightInput.value).toBe("4.5");
    });
  });
});

