import { render, screen } from "@testing-library/react";
import { notFound } from "next/navigation";
import CustomSpotDetailPage, {
  generateMetadata,
} from "@/app/custom-spots/[id]/page";
import { getEnhancedBeachForecasts } from "@/actions/forecast-actions";
import { createSupabaseServerClient } from "@/lib/supabase/server";

jest.mock("@/actions/forecast-actions", () => ({
  getEnhancedBeachForecasts: jest.fn(),
}));

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: jest.fn(),
}));

jest.mock("@/components/conditions/conditions-ticker", () => ({
  ConditionsTicker: ({ beachName }: { beachName?: string }) => (
    <div data-testid="conditions-ticker">{beachName}</div>
  ),
}));

jest.mock("@/components/forecast/forecast-table", () => ({
  MultiDayForecastTable: ({ forecasts }: { forecasts: unknown[] }) => (
    <div data-testid="forecast-table">{forecasts.length} forecasts</div>
  ),
}));

const publicSpot = {
  id: "spot-public",
  name: "Public Peak",
  lat: 32.75,
  lon: -117.25,
  nearest_beach_id: "beach-1",
  visibility: "public",
  break_type: "reef",
  facing_direction_deg: 270,
  offshore_direction_deg: 90,
  swell_window_min_deg: 190,
  swell_window_max_deg: 260,
  nearest_beach_distance_mi: 1.2,
  user_id: "user-1",
  created_at: "2026-06-25T00:00:00.000Z",
  updated_at: "2026-06-25T00:00:00.000Z",
  deleted_at: null,
  exposure_level: null,
  fingerprint_confidence: null,
  fingerprint_updated_at: null,
};

const privateSpot = {
  ...publicSpot,
  id: "spot-private",
  visibility: "private",
};

const nearestBeach = {
  id: "beach-1",
  name: "Ocean Beach",
  lat: 32.75,
  lon: -117.25,
  timezone: "America/Los_Angeles",
  break_type: "beach",
};

const forecast = {
  id: "forecast-1",
  beach_id: "beach-1",
  forecast_at: "2026-06-25T15:00:00.000Z",
  forecast_date: "2026-06-25",
  forecast_time: "15:00:00",
  wave_height: "3-4 ft",
  wave_period: "12s",
  wave_direction: "WSW",
  swell_1_height: "3",
  swell_1_period: "12s",
  swell_1_direction: "WSW",
  wind_speed: "6 mph",
  wind_direction: "E",
  tide_height: "2 ft",
  tide_status: "Rising",
  water_temp: "64F",
  confidence_score: 82,
  data_source: "NOAA_NWS",
  updated_at: "2026-06-25T12:00:00.000Z",
};

const mockSupabase = {
  from: jest.fn(),
};
const tableResults = new Map<string, unknown>();

function createQueryChain(data: unknown): any {
  const chain: any = {
    select: jest.fn(() => chain),
    eq: jest.fn(() => chain),
    is: jest.fn(() => chain),
    maybeSingle: jest.fn(async () => ({ data, error: null })),
  };
  return chain;
}

function mockTableSingle(table: string, data: unknown): void {
  tableResults.set(table, data);
}

describe("/custom-spots/[id] page", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    tableResults.clear();
    mockSupabase.from.mockImplementation((table: string) =>
      createQueryChain(tableResults.get(table) ?? null),
    );
    (createSupabaseServerClient as jest.Mock).mockResolvedValue(mockSupabase);
    (getEnhancedBeachForecasts as jest.Mock).mockResolvedValue({
      success: true,
      data: [forecast],
    });
  });

  it("renders a public custom spot with borrowed forecast data", async () => {
    mockTableSingle("custom_spots", publicSpot);
    mockTableSingle("beaches", nearestBeach);

    const page = await CustomSpotDetailPage({
      params: Promise.resolve({ id: "spot-public" }),
    });

    render(page);

    expect(
      screen.getByRole("heading", { name: "Public Peak" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Forecast borrowed from Ocean Beach/i)).toBeInTheDocument();
    expect(screen.getByTestId("conditions-ticker")).toHaveTextContent(
      "Public Peak",
    );
    expect(screen.getByTestId("forecast-table")).toHaveTextContent(
      "1 forecasts",
    );
    expect(getEnhancedBeachForecasts).toHaveBeenCalledWith("beach-1", 10);
  });

  it("returns a true 404 when RLS hides or misses the custom spot", async () => {
    mockTableSingle("custom_spots", null);

    await expect(
      CustomSpotDetailPage({
        params: Promise.resolve({ id: "missing-or-private" }),
      }),
    ).rejects.toMatchObject({ digest: "NEXT_NOT_FOUND" });

    expect(notFound).toHaveBeenCalled();
    expect(getEnhancedBeachForecasts).not.toHaveBeenCalled();
  });

  it("noindexes private custom spots when the viewer can access metadata", async () => {
    mockTableSingle("custom_spots", privateSpot);

    const metadata = await generateMetadata({
      params: Promise.resolve({ id: "spot-private" }),
    });

    expect((metadata.robots as any)?.index).toBe(false);
    expect((metadata.robots as any)?.follow).toBe(false);
    expect((metadata.robots as any)?.googleBot?.index).toBe(false);
    expect((metadata.robots as any)?.googleBot?.follow).toBe(false);
  });
});
