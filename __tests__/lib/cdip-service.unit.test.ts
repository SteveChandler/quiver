import { CDIPService } from "@/lib/services/cdip-service";

// Mock the rate limiter to control request flow
jest.mock("@/lib/utils/rate-limiter", () => ({
  CDIPRateLimiter: {
    canMakeRequest: jest.fn(() => true),
    recordRequest: jest.fn(),
    getTimeUntilReset: jest.fn(() => 0),
  },
}));

describe("CDIPService (unit)", () => {
  let service: CDIPService;

  beforeEach(() => {
    service = new CDIPService();
    jest.clearAllMocks();
  });

  it("fetchBuoyData transforms raw data and caches result", async () => {
    // Spy on the private fetch method to return deterministic data
    const fetchSpy = jest
      // @ts-expect-error access private method in test
      .spyOn(CDIPService.prototype, "fetchCDIPRawData")
      .mockResolvedValue({
        stationId: "100",
        dataSource: "CDIP",
        timestamp: new Date().toISOString(),
        data: [
          // [timestamp, waveHeight(ft), period(s), direction(deg)]
          ["2024-01-15T21:00:00Z", 4.2, 12, 220],
          ["2024-01-15T20:00:00Z", 3.8, 10, 215],
        ],
        metadata: {
          station_name: "Torrey Pines Outer",
          location: { lat: 32.921, lon: -117.39 },
          parameters: ["wave"],
          units: { waveHeight: "ft", period: "s", direction: "deg" },
        },
      });

    const result = await service.fetchBuoyData("100");

    expect(result).not.toBeNull();
    expect(result!.stationId).toBe("100");
    expect(result!.stationName).toContain("Torrey Pines");
    expect(result!.data).toHaveLength(2);
    expect(result!.data[0]).toMatchObject({
      significantWaveHeight: 4.2,
      peakWavePeriod: 12,
      peakWaveDirection: 220,
    });

    // Second call should use cache, not refetch
    const second = await service.fetchBuoyData("100");
    expect(second).not.toBeNull();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("returns null when raw fetch returns null", async () => {
    // @ts-expect-error access private method in test
    jest
      .spyOn(CDIPService.prototype, "fetchCDIPRawData")
      .mockResolvedValue(null);
    const result = await service.fetchBuoyData("100");
    expect(result).toBeNull();
  });

  it("respects rate limiting and returns null", async () => {
    const { CDIPRateLimiter } = require("@/lib/utils/rate-limiter");
    CDIPRateLimiter.canMakeRequest.mockReturnValueOnce(false);
    const result = await service.fetchBuoyData("100");
    expect(result).toBeNull();
  });

  it("getNearestStation returns a valid station id within radius", async () => {
    const station = await service.getNearestStation(32.9, -117.4, 200);
    expect(station).toBeTruthy();
    // One of the configured stations should be nearest (implementation-dependent)
    expect([
      "100",
      "67",
      "191",
      "46236",
      "71",
      "46225",
      "46221",
      "157",
    ]).toContain(station);
  });
});
