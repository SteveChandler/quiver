import { EnhancedForecastService } from "@/lib/services/enhanced-forecast-service";

const mockFetchCachedTides = jest.fn();
const mockFetchCOOPSData = jest.fn();
const mockGetStationForLocation = jest.fn();
const mockGetNearestTideStation = jest.fn();

jest.mock("@/lib/services/noaa-coops", () => ({
  NOAACOOPSService: jest.fn().mockImplementation(() => ({
    fetchCachedTides: (...args: unknown[]) => mockFetchCachedTides(...args),
    fetchCOOPSData: (...args: unknown[]) => mockFetchCOOPSData(...args),
    getStationForLocation: (...args: unknown[]) => mockGetStationForLocation(...args),
  })),
}));

jest.mock("@/lib/services/noaa-tide-service", () => ({
  ...jest.requireActual("@/lib/services/noaa-tide-service"),
  getNearestTideStation: (...args: unknown[]) => mockGetNearestTideStation(...args),
}));

jest.mock("@/lib/services/cdip", () => ({
  CDIPService: jest.fn().mockImplementation(() => ({})),
}));

jest.mock("@/lib/services/noaa-wavewatch", () => ({
  NOAAWaveWatchService: jest.fn().mockImplementation(() => ({})),
}));

jest.mock("@/lib/services/forecast/storage-service", () => ({
  ForecastStorageService: jest.fn().mockImplementation(() => ({})),
}));

type TidalFallbackService = {
  fetchTidalDataWithRetry: (beach: unknown) => Promise<unknown>;
};

function fetchTides(beach: { id: string; name: string; lat: number | null; lon: number | null }) {
  const service = new EnhancedForecastService() as unknown as TidalFallbackService;
  return service.fetchTidalDataWithRetry(beach);
}

describe("EnhancedForecastService tide fallback", () => {
  beforeEach(() => {
    mockFetchCachedTides.mockReset().mockResolvedValue(null);
    mockFetchCOOPSData.mockReset().mockResolvedValue({ station_id: "stub", station_name: "stub", tides: [{ time: 1 }], water_level: null });
    // The name resolver's answer for "Scorpion Bay (San Juanico)": San Juan, Puerto Rico.
    mockGetStationForLocation.mockReset().mockReturnValue("9755371");
    mockGetNearestTideStation.mockReset();
  });

  it("returns no tides when no NOAA station is within range, instead of a name-matched one", async () => {
    mockGetNearestTideStation.mockResolvedValue(null);

    const tides = await fetchTides({ id: "scorpion-bay", name: "Scorpion Bay (San Juanico)", lat: 26.2424, lon: -112.4789 });

    expect(tides).toBeNull();
    expect(mockGetNearestTideStation).toHaveBeenCalledWith(26.2424, -112.4789);
    expect(mockFetchCOOPSData).not.toHaveBeenCalled();
  });

  it("fetches the same station the tide cron would assign", async () => {
    mockGetNearestTideStation.mockResolvedValue({ id: "8651370", name: "Duck, NC", lat: 36.18, lon: -75.75 });

    await fetchTides({ id: "new-nc-beach", name: "3rd Street", lat: 36.03, lon: -75.67 });

    expect(mockFetchCOOPSData).toHaveBeenCalledWith("8651370", expect.any(Number));
    expect(mockGetStationForLocation).not.toHaveBeenCalled();
  });

  it("uses cached tides without resolving a station", async () => {
    const cached = { station_id: "cached_del-mar", station_name: "Cached Tide Data", tides: [{ time: 1 }], water_level: null };
    mockFetchCachedTides.mockResolvedValue(cached);

    const tides = await fetchTides({ id: "del-mar", name: "Del Mar", lat: 32.96, lon: -117.27 });

    expect(tides).toBe(cached);
    expect(mockGetNearestTideStation).not.toHaveBeenCalled();
  });

  it("returns no tides for a beach without coordinates", async () => {
    const tides = await fetchTides({ id: "no-pin", name: "Rincon De Baja", lat: null, lon: null });

    expect(tides).toBeNull();
    expect(mockFetchCOOPSData).not.toHaveBeenCalled();
  });
});
