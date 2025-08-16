import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRouter } from "next/navigation";
import { ForecastTab } from "@/components/home-screen/forecast-tab";
import { useDataFetcher } from "@/hooks/use-data-fetcher";
import { useForecastCalibration } from "@/hooks/use-forecast-calibration";
import * as useIntelDataModule from "@/hooks/use-intel-data";
import type { Profile, Beach, Forecast } from "@/types/database";

jest.mock("next/navigation", () => ({
  useRouter: jest.fn(() => ({ push: jest.fn() })),
}));
jest.mock("@/hooks/use-data-fetcher");
jest.mock("@/hooks/use-forecast-calibration");
jest.mock("@/hooks/use-intel-data");

const mockProfile: Profile = {
  id: "user-1",
  email: "test@example.com",
  full_name: "Test User",
  avatar_url: null,
  location: "San Diego, CA",
  bio: null,
  instagram_handle: null,
  favorite_spot: "beach-1",
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
};

const mockDefaultBeach: Beach = {
  id: "beach-1",
  name: "Test Beach",
  city: "San Diego",
  state: "CA",
  country: "USA",
  latitude: 32.7157,
  longitude: -117.1611,
  description: "A test beach",
  amenities: [],
  hazards: [],
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
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

const mockBeachAccuracy = {
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

describe("ForecastTab", () => {
  const mockPush = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    (useRouter as jest.Mock).mockReturnValue({
      push: mockPush,
    });

    (useDataFetcher as jest.Mock).mockReturnValue({
      data: mockForecast,
      loading: false,
      error: null,
    });

    // Provide minimal intel hook shape to avoid runtime errors in BeachIntelSection
    (useIntelDataModule.useIntelData as unknown as jest.Mock).mockReturnValue({
      data: { posts: [] },
      loading: false,
      error: null,
      hasData: false,
      refetch: jest.fn(),
      updateFilters: jest.fn(),
    });

    (useForecastCalibration as jest.Mock).mockReturnValue({
      beachAccuracy: mockBeachAccuracy,
      getConfidenceLevel: jest.fn((score) => {
        if (!score)
          return {
            level: "Unknown",
            color: "text-gray-500",
            bg: "bg-gray-100",
          };
        if (score >= 85)
          return {
            level: "High Trust",
            color: "text-green-600",
            bg: "bg-green-50",
          };
        if (score >= 70)
          return {
            level: "Medium Trust",
            color: "text-yellow-600",
            bg: "bg-yellow-50",
          };
        return { level: "Low Trust", color: "text-red-600", bg: "bg-red-50" };
      }),
      accuracyStats: {
        overallScore: 78,
        totalSessions: 25,
        last30Days: 8,
        last7Days: 3,
      },
    });
  });

  it("renders forecast tab with beach and forecast data", () => {
    render(
      <ForecastTab profile={mockProfile} defaultBeach={mockDefaultBeach} />
    );
    expect(screen.getByText("Test Beach")).toBeInTheDocument();
    expect(screen.getByText("Today's Forecast")).toBeInTheDocument();
    expect(screen.getByText("4-6 ft")).toBeInTheDocument();
  });

  it("toggles adjusted forecast view", async () => {
    const user = userEvent.setup();
    render(
      <ForecastTab profile={mockProfile} defaultBeach={mockDefaultBeach} />
    );
    const toggleButton = screen.getByRole("button", { name: /show adjusted/i });
    await user.click(toggleButton);
    expect(
      screen.getByText(/Community-Adjusted Forecast/i)
    ).toBeInTheDocument();
  });
});
