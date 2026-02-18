import { render, screen, waitFor } from "@testing-library/react";
import { HomeConditionsTicker } from "@/components/home-screen/home-conditions-ticker";

// Mock dependencies
jest.mock("@/actions/forecast-actions", () => ({
  getEnhancedBeachForecasts: jest.fn(),
}));

jest.mock("@/lib/utils/current-forecast-utils", () => ({
  getCurrentForecast: jest.fn(),
}));

jest.mock("@/components/ui/animated-wave-icon", () => ({
  AnimatedWaveIcon: () => <span data-testid="wave-icon" />,
}));

jest.mock("@/hooks/use-reduced-motion", () => ({
  useReducedMotion: () => false,
}));

import { getEnhancedBeachForecasts } from "@/actions/forecast-actions";
import { getCurrentForecast } from "@/lib/utils/current-forecast-utils";

const mockGetForecasts = getEnhancedBeachForecasts as jest.MockedFunction<typeof getEnhancedBeachForecasts>;
const mockGetCurrent = getCurrentForecast as jest.MockedFunction<typeof getCurrentForecast>;

describe("HomeConditionsTicker", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("shows loading skeleton initially", () => {
    mockGetForecasts.mockReturnValue(new Promise(() => {})); // never resolves
    render(<HomeConditionsTicker beachId="beach-1" beachName="Blacks Beach" />);
    expect(screen.getByTestId("conditions-ticker-skeleton")).toBeInTheDocument();
  });

  it("renders conditions when forecast data loads", async () => {
    const forecast = {
      id: "f1",
      beach_id: "beach-1",
      forecast_at: "2026-02-18T08:00:00Z",
      forecast_date: "2026-02-18",
      forecast_time: "08:00",
      wave_height: "4-6ft",
      wave_period: "14s",
      wave_direction: "W",
      wind_speed: "5 mph",
      wind_direction: "NE",
      water_temp: "60°F",
      tide_status: "Falling",
      tide_height: "2.1ft",
      confidence_score: 80,
      data_source: "NOAA_NWS",
      created_at: "2026-02-18T00:00:00Z",
      updated_at: "2026-02-18T00:00:00Z",
      metadata: { primarySource: "NOAA_NWS", allSources: ["NOAA_NWS"], confidenceScore: 80, lastUpdated: "2026-02-18T00:00:00Z" },
    };
    mockGetForecasts.mockResolvedValue({ success: true, data: [forecast] });
    mockGetCurrent.mockReturnValue(forecast);

    render(<HomeConditionsTicker beachId="beach-1" beachName="Blacks Beach" />);

    await waitFor(() => {
      expect(screen.getByText("4-6ft")).toBeInTheDocument();
    });
    expect(screen.getByText("60°F")).toBeInTheDocument();
    expect(screen.getByRole("region")).toHaveAttribute("aria-label", "Blacks Beach current conditions");
  });

  it("returns null when no forecast data available", async () => {
    mockGetForecasts.mockResolvedValue({ success: true, data: [] });

    const { container } = render(<HomeConditionsTicker beachId="beach-1" />);

    await waitFor(() => {
      expect(container.querySelector("[data-testid='conditions-ticker-skeleton']")).not.toBeInTheDocument();
    });
    expect(container.firstChild).toBeNull();
  });

  it("uses dark theme", async () => {
    const forecast = {
      id: "f1",
      beach_id: "beach-1",
      forecast_at: "2026-02-18T08:00:00Z",
      forecast_date: "2026-02-18",
      forecast_time: "08:00",
      wave_height: "3ft",
      water_temp: null,
      confidence_score: 80,
      data_source: "NOAA_NWS",
      created_at: "2026-02-18T00:00:00Z",
      updated_at: "2026-02-18T00:00:00Z",
      metadata: { primarySource: "NOAA_NWS", allSources: ["NOAA_NWS"], confidenceScore: 80, lastUpdated: "2026-02-18T00:00:00Z" },
    };
    mockGetForecasts.mockResolvedValue({ success: true, data: [forecast] });
    mockGetCurrent.mockReturnValue(forecast);

    render(<HomeConditionsTicker beachId="beach-1" />);

    await waitFor(() => {
      expect(screen.getByText("3ft")).toBeInTheDocument();
    });
    const region = screen.getByRole("region");
    expect(region.className).toContain("bg-[#2a2a2a]");
  });
});
