import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { LandingConditionsTicker } from "@/components/landing-page/landing-conditions-ticker";

jest.mock("@/actions/forecast/get-top-beaches-now", () => ({
  getTopBeachesNow: jest.fn(),
}));

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

import { getTopBeachesNow } from "@/actions/forecast/get-top-beaches-now";
import { getEnhancedBeachForecasts } from "@/actions/forecast-actions";
import { getCurrentForecast } from "@/lib/utils/current-forecast-utils";

const mockGetTopBeaches = getTopBeachesNow as jest.MockedFunction<
  typeof getTopBeachesNow
>;
const mockGetForecasts = getEnhancedBeachForecasts as jest.MockedFunction<
  typeof getEnhancedBeachForecasts
>;
const mockGetCurrent = getCurrentForecast as jest.MockedFunction<
  typeof getCurrentForecast
>;

const makeForecast = (overrides: Record<string, unknown> = {}) => ({
  id: "f1",
  beach_id: "beach-1",
  forecast_at: "2026-02-18T08:00:00Z",
  forecast_date: "2026-02-18",
  forecast_time: "08:00",
  wave_height: "5-7ft",
  wave_period: "16s",
  wave_direction: "W",
  wind_speed: "3 mph",
  wind_direction: "E",
  water_temp: "61\u00B0F",
  tide_status: "Rising",
  tide_height: "4.0ft",
  confidence_score: 90,
  data_source: "NOAA_NWS",
  created_at: "2026-02-18T00:00:00Z",
  updated_at: "2026-02-18T00:00:00Z",
  metadata: { primarySource: "NOAA_NWS", allSources: ["NOAA_NWS"], confidenceScore: 90, lastUpdated: "2026-02-18T00:00:00Z" },
  ...overrides,
});

describe("LandingConditionsTicker", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("shows loading skeleton initially", () => {
    mockGetTopBeaches.mockReturnValue(new Promise(() => {})); // never resolves
    render(<LandingConditionsTicker />);
    expect(
      screen.getByTestId("conditions-ticker-skeleton")
    ).toBeInTheDocument();
  });

  it("renders conditions for top beach", async () => {
    mockGetTopBeaches.mockResolvedValue([
      {
        beachId: "beach-1",
        beachName: "Blacks Beach",
        score: 95,
      } as any,
    ]);

    const forecast = makeForecast();
    mockGetForecasts.mockResolvedValue({ success: true, data: [forecast] });
    mockGetCurrent.mockReturnValue(forecast);

    render(<LandingConditionsTicker />);

    await waitFor(() => {
      expect(screen.getAllByText("5-7ft").length).toBeGreaterThan(0);
    });
    expect(screen.getAllByText("61\u00B0F").length).toBeGreaterThan(0);
    expect(screen.getByText(/Blacks Beach/)).toBeInTheDocument();
  });

  it("returns null when no top beaches available", async () => {
    mockGetTopBeaches.mockResolvedValue([]);

    const { container } = render(<LandingConditionsTicker />);

    await waitFor(() => {
      expect(
        container.querySelector("[data-testid='conditions-ticker-skeleton']")
      ).not.toBeInTheDocument();
    });
    expect(container.firstChild).toBeNull();
  });

  it("returns null when forecast fetch fails", async () => {
    mockGetTopBeaches.mockResolvedValue([
      { beachId: "beach-1", beachName: "Trestles", score: 90 } as any,
    ]);
    mockGetForecasts.mockResolvedValue({ success: false, error: "Failed to fetch" } as any);

    const { container } = render(<LandingConditionsTicker />);

    await waitFor(() => {
      expect(
        container.querySelector("[data-testid='conditions-ticker-skeleton']")
      ).not.toBeInTheDocument();
    });
    expect(container.firstChild).toBeNull();
  });

  it("uses light theme", async () => {
    mockGetTopBeaches.mockResolvedValue([
      { beachId: "beach-1", beachName: "Trestles", score: 90 } as any,
    ]);
    const forecast = makeForecast({ wave_height: "3ft", water_temp: null });
    mockGetForecasts.mockResolvedValue({ success: true, data: [forecast] });
    mockGetCurrent.mockReturnValue(forecast);

    render(<LandingConditionsTicker />);

    await waitFor(() => {
      expect(screen.getAllByText("3ft").length).toBeGreaterThan(0);
    });
    const region = screen.getByRole("region");
    expect(region.className).toContain("bg-white");
  });
});
