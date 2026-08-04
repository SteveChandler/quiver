import type { ImgHTMLAttributes } from "react";
import { render, screen } from "@testing-library/react";
import { notFound } from "next/navigation";
import CustomSpotDetailPage, {
  generateMetadata,
} from "@/app/custom-spots/[id]/page";
import { getEnhancedBeachForecasts } from "@/actions/forecast-actions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { fetchPointMarineForecast } from "@/lib/services/point-marine-forecast/service";
import { fetchCustomSpotAtmosphericForecast } from "@/lib/services/custom-spot-atmospheric-forecast";

const getResolvedSpotPhotos = jest.fn();

jest.mock("@/lib/community-photos", () => ({
  getResolvedSpotPhotos: (...args: unknown[]) => getResolvedSpotPhotos(...args),
}));

jest.mock("@/actions/forecast-actions", () => ({
  getEnhancedBeachForecasts: jest.fn(),
}));

jest.mock("@/lib/services/point-marine-forecast/service", () => ({
  fetchPointMarineForecast: jest.fn(),
}));

jest.mock("@/lib/services/custom-spot-atmospheric-forecast", () => ({
  fetchCustomSpotAtmosphericForecast: jest.fn(),
}));

jest.mock("next/image", () => ({
  __esModule: true,
  default: ({
    alt = "",
    fill: _fill,
    unoptimized: _unoptimized,
    priority: _priority,
    ...props
  }: ImgHTMLAttributes<HTMLImageElement> & {
    fill?: boolean;
    unoptimized?: boolean;
    priority?: boolean;
  }) => (
    <img
      alt={alt}
      data-unoptimized={_unoptimized ? "true" : undefined}
      {...props}
    />
  ),
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
  MultiDayForecastTable: ({
    forecasts,
    beachTimezone,
  }: { forecasts: unknown[]; beachTimezone?: string | null }) => (
    <div data-testid="forecast-table" data-timezone={beachTimezone ?? ""}>
      {forecasts.length} forecasts
    </div>
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

const farSpot = {
  ...publicSpot,
  id: "spot-far",
  nearest_beach_distance_mi: 40,
};

const crossTimezoneSpot = {
  ...farSpot,
  id: "spot-cross-timezone",
  lat: 40.7128,
  lon: -74.006,
};

const nearestBeach = {
  id: "beach-1",
  name: "Ocean Beach",
  city: "San Diego",
  state: "CA",
  country: "USA",
  slug: "ocean-beach",
  lat: 32.75,
  lon: -117.25,
  timezone: "America/Los_Angeles",
  break_type: "beach",
};

const beachPhoto = {
  image_url: "https://images.unsplash.com/photo-spot.jpg",
  thumb_url: "https://images.unsplash.com/photo-spot-thumb.jpg",
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

const pointForecast = {
  schemaVersion: 1 as const,
  source: "open_meteo" as const,
  sourceModel: "ncep_gfswave016" as const,
  requestedPoint: { lat: 32.75, lon: -117.25 },
  sampledPoint: { lat: 32.785, lon: -117.25 },
  sampleResolution: "offshore_shifted" as const,
  modelRunAt: null,
  fetchedAt: "2026-07-31T12:00:00.000Z",
  stale: false,
  rows: [{
    forecastAt: "2026-07-31T12:00:00.000Z",
    total: { heightM: 1.2, periodS: 13, directionDeg: 270 },
    swell1: { heightM: 0.9, periodS: 15, directionDeg: 260 },
    swell2: null,
    swell3: null,
    windWave: { heightM: 0.3, periodS: 6, directionDeg: 280 },
  }],
};

const mockSupabase = {
  from: jest.fn(),
  auth: {
    getUser: jest.fn(async () => ({
      data: { user: { id: "user-1" } },
      error: null,
    })),
  },
};
const tableResults = new Map<string, unknown>();

function createQueryChain(data: unknown): any {
  const chain: any = {
    select: jest.fn(() => chain),
    eq: jest.fn(() => chain),
    is: jest.fn(() => chain),
    order: jest.fn(() => chain),
    limit: jest.fn(() => chain),
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
    (fetchPointMarineForecast as jest.Mock).mockResolvedValue(pointForecast);
    (fetchCustomSpotAtmosphericForecast as jest.Mock).mockResolvedValue({
      windSpeed: "8 mph",
      windDirection: "NW",
      windDirectionDeg: 315,
      temperatureF: 70,
      summary: "Clear",
      fetchedAt: "2026-07-31T12:00:00.000Z",
    });
    getResolvedSpotPhotos.mockResolvedValue([]);
  });

  it("renders a public custom spot with borrowed forecast data", async () => {
    mockTableSingle("custom_spots", publicSpot);
    mockTableSingle("beaches", nearestBeach);
    mockTableSingle("beach_photos", beachPhoto);

    const page = await CustomSpotDetailPage({
      params: Promise.resolve({ id: "spot-public" }),
    });

    render(page);

    expect(
      screen.getByRole("heading", { name: "Public Peak" }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("custom-spot-zine-surface")).toBeInTheDocument();
    expect(screen.getByAltText("Ocean Beach surf zone")).toHaveAttribute(
      "src",
      beachPhoto.thumb_url,
    );
    expect(
      screen.getByAltText("Ocean Beach surf zone"),
    ).not.toHaveAttribute("data-unoptimized");
    expect(screen.getByText("Borrowed from Ocean Beach")).toBeInTheDocument();
    expect(screen.getByText(/Forecast borrowed from Ocean Beach/i)).toBeInTheDocument();
    expect(screen.getByTestId("custom-spot-forecast-table")).toHaveClass(
      "zine-forecast-table",
    );
    expect(screen.getByTestId("conditions-ticker")).toHaveTextContent(
      "Public Peak",
    );
    expect(screen.getByTestId("forecast-table")).toHaveTextContent(
      "1 forecasts",
    );
    expect(getEnhancedBeachForecasts).toHaveBeenCalledWith("beach-1", 10);
  });

  it("prefers an eligible custom-spot community photo with safe attribution", async () => {
    mockTableSingle("custom_spots", publicSpot);
    mockTableSingle("beaches", nearestBeach);
    mockTableSingle("beach_photos", beachPhoto);
    getResolvedSpotPhotos.mockResolvedValue([
      {
        id: "community-1",
        source: "community",
        imageUrl: "/api/community-photos/community-1/image",
        thumbUrl: null,
        title: "Clean morning",
        creatorName: "Jo",
        attributionHtml: null,
        attribution: {
          kind: "profile",
          displayName: "<strong>Jo</strong>",
          profileId: "profile-1",
        },
        community: {
          voteScore: 0.4,
          upvotes: 8,
          downvotes: 2,
          viewerVote: null,
          canVote: false,
          canReport: false,
          canRemove: false,
          isPinned: false,
        },
        createdAt: "2026-07-25T12:00:00.000Z",
      },
    ]);

    const page = await CustomSpotDetailPage({
      params: Promise.resolve({ id: "spot-public" }),
    });
    render(page);

    expect(screen.getByAltText("Public Peak surf zone")).toHaveAttribute(
      "src",
      "/api/community-photos/community-1/image",
    );
    expect(
      screen.getAllByRole("link", { name: "<strong>Jo</strong>" }),
    ).toHaveLength(2);
    screen
      .getAllByRole("link", { name: "<strong>Jo</strong>" })
      .forEach((link) =>
        expect(link).toHaveAttribute("href", "/profile/profile-1"),
      );
    expect(document.querySelector("strong")).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Spot photos" }),
    ).toBeInTheDocument();
    expect(getResolvedSpotPhotos).toHaveBeenCalledWith({
      target: { type: "custom_spot", id: "spot-public" },
      curated: [],
      viewerId: "user-1",
      limit: 6,
    });
  });

  it("renders point-derived marine forecast copy without borrowed-forecast labeling", async () => {
    mockTableSingle("custom_spots", farSpot);
    mockTableSingle("beaches", nearestBeach);

    const page = await CustomSpotDetailPage({
      params: Promise.resolve({ id: "spot-far" }),
    });
    render(page);

    expect(screen.getAllByText("Point forecast").length).toBeGreaterThan(0);
    expect(screen.getByTestId("custom-spot-forecast-source")).toHaveTextContent(
      "Marine model sampled at a nearby offshore model cell.",
    );
    expect(screen.queryByText("Borrowed forecast")).not.toBeInTheDocument();
    expect(screen.queryByText(/Forecast borrowed from/i)).not.toBeInTheDocument();
    expect(fetchPointMarineForecast).toHaveBeenCalledWith({
      lat: farSpot.lat,
      lon: farSpot.lon,
      days: 10,
    });
  });

  it("passes the custom spot coordinate timezone to the forecast table", async () => {
    mockTableSingle("custom_spots", crossTimezoneSpot);
    mockTableSingle("beaches", nearestBeach);

    const page = await CustomSpotDetailPage({
      params: Promise.resolve({ id: "spot-cross-timezone" }),
    });
    render(page);

    expect(screen.getByTestId("forecast-table")).toHaveAttribute(
      "data-timezone",
      "America/New_York",
    );
  });

  it("keeps atmospheric-only fallback explicit without linking to a borrowed forecast", async () => {
    mockTableSingle("custom_spots", farSpot);
    mockTableSingle("beaches", nearestBeach);
    (fetchPointMarineForecast as jest.Mock).mockRejectedValueOnce(
      new Error("point forecast unavailable"),
    );
    (fetchCustomSpotAtmosphericForecast as jest.Mock).mockResolvedValueOnce({
      forecastAt: "2026-07-31T12:00:00.000Z",
      windSpeed: "8 mph",
      windDirection: "NW",
      windDirectionDeg: 315,
      temperatureF: 70,
      summary: "Clear",
      fetchedAt: "2026-07-31T12:00:00.000Z",
    });

    const page = await CustomSpotDetailPage({
      params: Promise.resolve({ id: "spot-far" }),
    });
    render(page);

    expect(screen.getAllByText("Weather-only").length).toBeGreaterThan(0);
    expect(screen.getByTestId("custom-spot-forecast-source")).toHaveTextContent(
      "NOAA weather and wind are available; complete marine swell data is unavailable.",
    );
    expect(screen.queryByText("Full forecast")).not.toBeInTheDocument();
    expect(screen.queryByText(/Forecast borrowed from/i)).not.toBeInTheDocument();
  });

  it("labels a missing point and atmospheric forecast as unavailable", async () => {
    mockTableSingle("custom_spots", farSpot);
    mockTableSingle("beaches", nearestBeach);
    (fetchPointMarineForecast as jest.Mock).mockRejectedValueOnce(
      new Error("point forecast unavailable"),
    );
    (fetchCustomSpotAtmosphericForecast as jest.Mock).mockResolvedValueOnce({
      forecastAt: null,
      windSpeed: null,
      windDirection: null,
      windDirectionDeg: null,
      temperatureF: null,
      summary: null,
      fetchedAt: "2026-07-31T12:00:00.000Z",
    });

    const page = await CustomSpotDetailPage({
      params: Promise.resolve({ id: "spot-far" }),
    });
    render(page);

    expect(screen.getAllByText("Forecast unavailable").length).toBeGreaterThan(0);
    expect(screen.getByTestId("custom-spot-forecast-source")).toHaveTextContent(
      "No complete marine forecast is available for Public Peak.",
    );
    expect(screen.queryByText(/Atmospheric forecast/i)).not.toBeInTheDocument();
  });

  it("bypasses image optimization for owner-private community photo URLs", async () => {
    mockTableSingle("custom_spots", privateSpot);
    mockTableSingle("beaches", nearestBeach);
    mockTableSingle("beach_photos", beachPhoto);
    getResolvedSpotPhotos.mockResolvedValue([
      {
        id: "community-private",
        source: "community",
        visibility: "private",
        imageUrl: "/api/community-photos/community-private/image",
        thumbUrl: "/api/community-photos/community-private/image",
        width: 1200,
        height: 900,
        title: null,
        creatorName: null,
        attributionHtml: null,
        attribution: null,
        community: {
          voteScore: 0,
          upvotes: 0,
          downvotes: 0,
          viewerVote: null,
          canVote: false,
          canReport: false,
          canRemove: true,
          isPinned: false,
        },
        createdAt: "2026-07-25T12:00:00.000Z",
      },
    ]);

    const page = await CustomSpotDetailPage({
      params: Promise.resolve({ id: "spot-private" }),
    });
    render(page);

    const privateCommunityImages = screen
      .getAllByRole("img")
      .filter(
        (image) =>
          image.getAttribute("src") ===
          "/api/community-photos/community-private/image",
      );
    expect(privateCommunityImages).toHaveLength(2);
    privateCommunityImages.forEach((image) => {
      expect(image).toHaveAttribute("data-unoptimized", "true");
    });
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
