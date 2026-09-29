import { EnhancedForecastService } from "@/lib/services/enhanced-forecast-service";

const mockGetStationForLocation = jest.fn();
const mockFetchWaterTemperature = jest.fn();

jest.mock("@/lib/services/noaa-coops", () => ({
  NOAACOOPSService: jest.fn().mockImplementation(() => ({
    getStationForLocation: (...args: unknown[]) => mockGetStationForLocation(...args),
  })),
}));

jest.mock("@/lib/services/noaa-coops/api-client", () => ({
  fetchWaterTemperature: (...args: unknown[]) => mockFetchWaterTemperature(...args),
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

type CoopsWaterTempService = {
  fetchCOOPSWaterTemp: (beach: unknown) => Promise<number | null>;
};

function fetchWaterTemp(beach: { id: string; name: string; lat: number | null; lon: number | null }) {
  const service = new EnhancedForecastService() as unknown as CoopsWaterTempService;
  return service.fetchCOOPSWaterTemp(beach);
}

describe("EnhancedForecastService CO-OPS water temperature", () => {
  beforeEach(() => {
    mockGetStationForLocation.mockReset();
    mockFetchWaterTemperature.mockReset().mockResolvedValue({ tempC: 20, observedAt: new Date().toISOString() });
  });

  it("rejects a station on another ocean", async () => {
    // San Juan, Puerto Rico is 4,800 km from Scorpion Bay (San Juanico), Baja.
    mockGetStationForLocation.mockReturnValue("9755371");

    const temp = await fetchWaterTemp({ id: "scorpion-bay", name: "Scorpion Bay (San Juanico)", lat: 26.2424, lon: -112.475 });

    expect(temp).toBeNull();
    expect(mockFetchWaterTemperature).not.toHaveBeenCalled();
  });

  it("rejects a station beyond the cap on the same coast", async () => {
    // San Diego (Broadway) is 740 km south of Ocean Beach SF.
    mockGetStationForLocation.mockReturnValue("9410170");

    const temp = await fetchWaterTemp({ id: "ob-sf", name: "Ocean Beach SF – Middle", lat: 37.7601, lon: -122.5123 });

    expect(temp).toBeNull();
    expect(mockFetchWaterTemperature).not.toHaveBeenCalled();
  });

  it("uses a nearby sensor station", async () => {
    mockGetStationForLocation.mockReturnValue("9410230");

    const temp = await fetchWaterTemp({ id: "windansea", name: "Windansea", lat: 32.8299, lon: -117.2823 });

    expect(temp).toBe(20);
    expect(mockFetchWaterTemperature).toHaveBeenCalledWith("9410230");
  });

  it("keeps a same-coast station past the 120 km tide rule", async () => {
    // Bob Hall Pier -> Port Isabel is 169 km; its reading tracks the nearest buoy to ~1°F,
    // where the latitude estimate that would replace it is ~13°F low in late September.
    mockGetStationForLocation.mockReturnValue("8779770");

    const temp = await fetchWaterTemp({ id: "bob-hall", name: "Bob Hall Pier", lat: 27.5821, lon: -97.2197 });

    expect(temp).toBe(20);
    expect(mockFetchWaterTemperature).toHaveBeenCalledWith("8779770");
  });

  it("rejects a station without known coordinates", async () => {
    mockGetStationForLocation.mockReturnValue("0000000");

    const temp = await fetchWaterTemp({ id: "windansea", name: "Windansea", lat: 32.8299, lon: -117.2823 });

    expect(temp).toBeNull();
    expect(mockFetchWaterTemperature).not.toHaveBeenCalled();
  });

  it("returns null for a beach without coordinates", async () => {
    const temp = await fetchWaterTemp({ id: "no-pin", name: "Rincon De Baja", lat: null, lon: null });

    expect(temp).toBeNull();
    expect(mockGetStationForLocation).not.toHaveBeenCalled();
    expect(mockFetchWaterTemperature).not.toHaveBeenCalled();
  });
});
