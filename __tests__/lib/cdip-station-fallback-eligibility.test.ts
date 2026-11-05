import { CDIPService } from "@/lib/services/cdip";
import { CDIP_STATIONS, getStationConfig } from "@/lib/constants/cdip-stations";

jest.mock("@/lib/utils/rate-limiter", () => ({
  CDIPRateLimiter: {
    canMakeRequest: jest.fn(() => true),
    recordRequest: jest.fn(),
    getTimeUntilReset: jest.fn(() => 0),
  },
}));

jest.mock("@/lib/utils/api-retry", () => ({
  isCircuitBreakerOpenError: jest.fn(() => false),
  apiClient: { fetchCDIPData: jest.fn() },
}));

// Null-station beaches nearest to Topanga 103 (prod coordinates, Nov 2026).
const SANTA_MONICA_BAY: Array<[string, number, number]> = [
  ["Leo Carrillo State Beach", 34.0445, -118.9355],
  ["Point Dume", 34.0015, -118.8065],
  ["Latigo Point", 34.026051, -118.755821],
  ["Malibu Surfrider (First Point)", 34.0355, -118.6796],
  ["Will Rogers State Beach", 34.032394, -118.529787],
  ["Santa Monica Beach", 34.0085, -118.4985],
  ["Venice Beach", 33.992186, -118.481634],
  ["Dockweiler State Beach", 33.951935, -118.448689],
];

describe("CDIP station fallback eligibility", () => {
  const service = new CDIPService();

  it("serves 103 to beaches that name it explicitly", () => {
    expect(getStationConfig("103")?.name).toBe("Topanga Nearshore");
  });

  it.each(SANTA_MONICA_BAY)(
    "never picks explicit-only 103 as the nearest station for %s",
    async (_name, lat, lon) => {
      expect(await service.getNearestStation(lat, lon, 150)).not.toBe("103");
    },
  );

  it("never fails over to an explicit-only station", async () => {
    const [, lat, lon] = SANTA_MONICA_BAY[5];
    const nearest = await service.getNearestStation(lat, lon, 150);
    const failover = await service.getNearestStation(lat, lon, 150, [nearest ?? ""]);
    expect([nearest, failover]).not.toContain("103");
  });

  it("flags 103 as explicit-only", () => {
    expect(CDIP_STATIONS["103"].fallbackEligible).toBe(false);
  });
});
