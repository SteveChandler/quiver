import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ForecastTab } from "@/components/home-screen/forecast-tab";
import type { Beach, Profile } from "@/types/database";

// Mocks
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

// Stub out BeachIntelSection to avoid invoking intel data hooks
jest.mock("@/components/intel/beach-intel-section", () => ({
  BeachIntelSection: () => <div data-testid="beach-intel-section" />,
}));

// Mock tooltip to always render content synchronously for test determinism
jest.mock("@/components/ui/tooltip", () => ({
  TooltipProvider: ({ children }: any) => <div>{children}</div>,
  Tooltip: ({ children }: any) => <div>{children}</div>,
  TooltipTrigger: ({ children }: any) => <span>{children}</span>,
  TooltipContent: ({ children }: any) => <div role="tooltip">{children}</div>,
}));

jest.mock("@/hooks/use-data-fetcher", () => ({
  useDataFetcher: jest.fn(),
}));

jest.mock("@/hooks/use-forecast-calibration", () => ({
  useForecastCalibration: () => ({
    beachAccuracy: {
      overall_accuracy_score: 80,
    },
    getConfidenceLevel: () => ({
      level: "Medium Trust",
      color: "text-yellow-600",
      bg: "bg-yellow-50",
      icon: () => null,
    }),
    accuracyStats: { totalSessions: 10 },
  }),
}));

const { useDataFetcher } = jest.requireMock("@/hooks/use-data-fetcher");

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

describe("ForecastTab wave height normalization", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders calibrated face height with explanatory tooltip content", async () => {
    (useDataFetcher as jest.Mock).mockReturnValue({
      data: {
        wave_height: "4.2 ft",
        wind_speed: "5 mph",
        water_temp: "68°F",
        confidence_score: 90,
        beach_id: mockDefaultBeach.id,
        forecast_date: "2025-08-14",
        forecast_time: "09:00",
      },
      loading: false,
      error: null,
      refetch: jest.fn(),
    });

    render(
      <ForecastTab profile={mockProfile} defaultBeach={mockDefaultBeach} />
    );

    // The value should render
    const value = await screen.findByText("4.2 ft");
    expect(value).toBeInTheDocument();

    // Tooltip content is rendered by mocked Tooltip implementation
    expect(screen.getByText(/Face Height \(Calibrated\)/i)).toBeInTheDocument();
  });

  it("shows placeholder when wave height is missing", async () => {
    (useDataFetcher as jest.Mock).mockReturnValue({
      data: {
        wave_height: null,
        wind_speed: "5 mph",
        water_temp: "68°F",
        confidence_score: 50,
        beach_id: mockDefaultBeach.id,
        forecast_date: "2025-08-14",
        forecast_time: "09:00",
      },
      loading: false,
      error: null,
      refetch: jest.fn(),
    });

    render(
      <ForecastTab profile={mockProfile} defaultBeach={mockDefaultBeach} />
    );

    expect(await screen.findByText("--")).toBeInTheDocument();
  });
});
