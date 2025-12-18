/**
 * Regression tests for CO-OPS timestamp timezone drift.
 *
 * CO-OPS timestamps are returned as "YYYY-MM-DD HH:mm" without a timezone suffix.
 * We request `time_zone=gmt` and parse timestamps explicitly as UTC.
 */

import { NOAACOOPSService } from "@/lib/services/noaa-coops-service";

// Mock fetch to avoid real API calls
global.fetch = jest.fn();

describe("NOAACOOPSService CO-OPS timestamp parsing (UTC)", () => {
  let service: NOAACOOPSService;

  beforeEach(() => {
    service = new NOAACOOPSService();
    jest.clearAllMocks();
  });

  it("requests CO-OPS predictions and water level in GMT", async () => {
    // Provide different shapes per endpoint; service uses Promise.allSettled.
    (global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (url.includes("mdapi/prod/webapi/stations/")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ stations: [{ name: "Test Station" }] }),
        });
      }

      if (url.includes("product=water_level")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: [{ v: "3.2" }] }),
        });
      }

      if (url.includes("product=predictions")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              predictions: [
                { t: "2025-12-10 06:30", v: "5.2", type: "H" },
                { t: "2025-12-10 12:30", v: "0.8", type: "L" },
              ],
            }),
        });
      }

      return Promise.resolve({ ok: false, status: 500, statusText: "Unexpected" });
    });

    service.clearCache();
    await service.fetchCOOPSData("9410230", 1);

    const calls = (global.fetch as jest.Mock).mock.calls.map((c: any[]) => c[0]);
    const predictionsCall = calls.find((u: string) => u.includes("product=predictions"));
    const waterLevelCall = calls.find((u: string) => u.includes("product=water_level"));

    expect(predictionsCall).toBeTruthy();
    expect(predictionsCall).toContain("time_zone=gmt");

    expect(waterLevelCall).toBeTruthy();
    expect(waterLevelCall).toContain("time_zone=gmt");
  });

  it("parses GMT prediction timestamps as UTC epoch seconds", async () => {
    (global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (url.includes("mdapi/prod/webapi/stations/")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ stations: [{ name: "Test Station" }] }),
        });
      }

      if (url.includes("product=water_level")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: [{ v: "3.2" }] }),
        });
      }

      if (url.includes("product=predictions")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              predictions: [
                { t: "2025-12-10 06:30", v: "5.2", type: "H" },
                { t: "2025-12-10 12:30", v: "0.8", type: "L" },
              ],
            }),
        });
      }

      return Promise.resolve({ ok: false, status: 500, statusText: "Unexpected" });
    });

    service.clearCache();
    const result = await service.fetchCOOPSData("9410230", 1);

    expect(result).not.toBeNull();
    expect(result?.tides.length).toBe(2);

    const expectedFirst = Math.floor(Date.UTC(2025, 11, 10, 6, 30, 0) / 1000);
    const expectedSecond = Math.floor(Date.UTC(2025, 11, 10, 12, 30, 0) / 1000);

    expect(result?.tides[0].time).toBe(expectedFirst);
    expect(result?.tides[1].time).toBe(expectedSecond);
  });

  it("interpolates tide height consistently using the parsed timestamps", () => {
    // Simple synthetic tide curve: 0ft at 00:00 UTC, 4ft at 04:00 UTC.
    const tides = [
      { time: Math.floor(Date.UTC(2025, 0, 1, 0, 0, 0) / 1000), height: 0, name: "Low Tide", type: "low" as const },
      { time: Math.floor(Date.UTC(2025, 0, 1, 4, 0, 0) / 1000), height: 4, name: "High Tide", type: "high" as const },
    ];

    const atTwoHours = new Date(Date.UTC(2025, 0, 1, 2, 0, 0));
    expect(service.getTideHeightAtTime(tides as any, atTwoHours)).toBe(2);
  });
});

