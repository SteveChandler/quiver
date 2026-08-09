import {
  fetchAllStationData,
  fetchWaterTemperature,
} from "@/lib/services/noaa-coops/api-client";

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe("fetchWaterTemperature", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("returns tempC and observedAt from valid CO-OPS response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        metadata: { id: "8720218", name: "Mayport" },
        data: [
          { t: "2026-03-23 14:00", v: "17.6", f: "0,0,0" },
          { t: "2026-03-23 15:12", v: "17.8", f: "0,0,0" },
        ],
      }),
    });

    const result = await fetchWaterTemperature("8720218");

    expect(result).not.toBeNull();
    expect(result!.tempC).toBeCloseTo(17.8);
    expect(result!.observedAt).toBe("2026-03-23T15:12Z");
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("product=water_temperature"),
      expect.any(Object)
    );
  });

  it("returns null when station has no water temp data", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        error: { message: "No data was found." },
      }),
    });

    const result = await fetchWaterTemperature("8720587");
    expect(result).toBeNull();
  });

  it("returns null when data array is empty", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        metadata: { id: "8720218" },
        data: [],
      }),
    });

    const result = await fetchWaterTemperature("8720218");
    expect(result).toBeNull();
  });

  it("returns null on HTTP error", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

    const result = await fetchWaterTemperature("8720218");
    expect(result).toBeNull();
  });

  it("returns null on network failure", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    const result = await fetchWaterTemperature("8720218");
    expect(result).toBeNull();
  });

  it("returns null when temperature value is non-numeric", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        metadata: { id: "8720218" },
        data: [{ t: "2026-03-23 15:12", v: "", f: "0,0,0" }],
      }),
    });

    const result = await fetchWaterTemperature("8720218");
    expect(result).toBeNull();
  });

  it("uses metric units and GMT timezone", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [] }),
    });

    await fetchWaterTemperature("8720218");

    const calledUrl = mockFetch.mock.calls[0][0] as string;
    expect(calledUrl).toContain("units=metric");
    expect(calledUrl).toContain("time_zone=gmt");
    expect(calledUrl).toContain("range=24");
  });
});

describe("fetchAllStationData", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("returns no tide data instead of fabricating synthetic predictions when NOAA fails", async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: false, status: 503, statusText: "Unavailable", text: async () => "down" })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ stations: [{ name: "Test Station" }] }) });

    const result = await fetchAllStationData("9410230", 2);

    expect(result.tideData).toEqual([]);
    expect(result.stationInfo).toEqual({ name: "Test Station" });
  });
});
