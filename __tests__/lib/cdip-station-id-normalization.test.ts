import { CDIPService } from "@/lib/services/cdip";

jest.mock("@/lib/utils/rate-limiter", () => ({
  CDIPRateLimiter: {
    canMakeRequest: jest.fn(() => true),
    recordRequest: jest.fn(),
    getTimeUntilReset: jest.fn(() => 0),
  },
}));

const fetchCDIPData = jest.fn();

jest.mock("@/lib/utils/api-retry", () => ({
  apiClient: {
    fetchCDIPData: (...args: any[]) => fetchCDIPData(...args),
  },
}));

jest.mock("@/lib/constants/cdip-stations", () => ({
  CDIP_STATIONS: {
    "67": {
      id: "67",
      name: "San Pedro South",
      latitude: 33.618,
      longitude: -118.318,
      deployDepth: 880,
      hullType: "3-meter discus buoy",
      parameters: ["wave", "weather"],
    },
  },
  SOCAL_PRIMARY_STATIONS: ["67"],
  CDIP_API_CONFIG: {
    baseUrl: "http://erddap.cdip.ucsd.edu/erddap/tabledap/wave_agg.json",
    endpoints: {
      waveData:
        '?station_id,time,waveHs,waveTp,waveTa,waveDp&waveFlagPrimary=1&time>max(time)-1days&station_id="{stationId}"',
      metadata:
        '?station_id,metaStationName,latitude,longitude&station_id="{stationId}"&distinct()',
    },
  },
  DATA_QUALITY_THRESHOLDS: {
    waveHeight: { min: 0.1, max: 15.0, typical_max: 8.0 },
    wavePeriod: { min: 2.0, max: 30.0, swell_min: 8.0 },
    waveDirection: { min: 0, max: 360 },
    dataFreshness: { excellent: 30, good: 120, acceptable: 360, stale: 720 },
  },
  getStationConfig: (stationId: string) =>
    stationId === "67"
      ? {
          id: "67",
          name: "San Pedro South",
          latitude: 33.618,
          longitude: -118.318,
          deployDepth: 880,
          hullType: "3-meter discus buoy",
          parameters: ["wave", "weather"],
        }
      : null,
  getStationCoverageRadius: () => 50,
}));

describe("CDIPService - station id normalization for ERDDAP", () => {
  beforeEach(() => {
    fetchCDIPData.mockReset();
  });

  it("pads 1–2 digit station ids to 3 digits when calling ERDDAP (e.g. 67 -> 067)", async () => {
    fetchCDIPData.mockResolvedValue({
      ok: true,
      json: async () => ({
        table: {
          columnNames: ["station_id", "time", "waveHs", "waveTp", "waveTa", "waveDp"],
          rows: [[67, "2026-01-01T00:00:00Z", 1.0, 10.0, 9.0, 180]],
        },
      }),
    });

    const service = new CDIPService();
    const result = await service.fetchBuoyData("67");

    expect(result).not.toBeNull();
    expect(fetchCDIPData).toHaveBeenCalledTimes(1);
    expect(fetchCDIPData.mock.calls[0]?.[0]).toContain('station_id="067"');
  });
});


