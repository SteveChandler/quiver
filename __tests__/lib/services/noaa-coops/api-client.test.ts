export {};
let client: typeof import("@/lib/services/noaa-coops/api-client");
let fetchAllStationData: typeof client.fetchAllStationData;
let fetchWaterTemperature: typeof client.fetchWaterTemperature;
beforeEach(() => {
  jest.resetModules();
  client = require("@/lib/services/noaa-coops/api-client");
  ({ fetchAllStationData, fetchWaterTemperature } = client);
});

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

describe("California sea-level offset", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("raises California predictions by 1.5 ft and leaves other stations alone", async () => {
    const predictions = { predictions: [{ t: "2026-11-01 20:48", v: "4.924", type: "H" }] };
    const station = { stations: [{ name: "Test Station" }] };
    for (const stationId of ["9410230", "9435380"]) {
      mockFetch
        .mockResolvedValueOnce({ ok: true, json: async () => predictions })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [] }) })
        .mockResolvedValueOnce({ ok: true, json: async () => station });
    }

    const california = await fetchAllStationData("9410230", 1);
    const oregon = await fetchAllStationData("9435380", 1);

    expect(california.tideData.map((t) => t.height)).toEqual([6.424]);
    expect(oregon.tideData.map((t) => t.height)).toEqual([4.924]);
  });

  it("raises a subordinate station whose reference station is in California, whatever its id", async () => {
    const predictions = { predictions: [{ t: "2026-11-15 20:42", v: "3.816", type: "H" }] };
    const station = { stations: [{ name: "Test Station" }] };
    // TWC0427 Los Patos -> 9410660 LA; 9435385 Yaquina USCG -> 9419750 Crescent City.
    for (let i = 0; i < 2; i++) {
      mockFetch
        .mockResolvedValueOnce({ ok: true, json: async () => predictions })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [] }) })
        .mockResolvedValueOnce({ ok: true, json: async () => station });
    }

    const losPatos = await fetchAllStationData("TWC0427", 1);
    const yaquina = await fetchAllStationData("9435385", 1);

    expect(losPatos.tideData.map((t) => t.height)).toEqual([5.316]);
    expect(yaquina.tideData.map((t) => t.height)).toEqual([5.316]);
  });
});


it("identifies every legacy datagetter product through the shared request path", async () => {
  mockFetch.mockReset().mockImplementation(async () => ({
    ok: true, json: async () => ({ predictions: [], data: [], stations: [{ name: "Test" }] }),
  }));
  await fetchAllStationData("test", 1);
  await fetchWaterTemperature("test");
  const requests = mockFetch.mock.calls.filter(([url]) => String(url).includes("datagetter"));
  expect(requests).toHaveLength(3);
  expect(new URL(client.buildPredictionsUrl("test", "20261115", "20261116")).searchParams.get("application")).toBe("Quiver");
  for (const [url, init] of requests) {
    expect(new URL(url).searchParams.get("application")).toBe("Quiver");
    expect(new Headers(init.headers).get("User-Agent")).toBe("Quiver/1.0 (+https://quiversurf.app)");
  }
});
