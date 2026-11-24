import { fetchGfsTailRows, gfsRowsFromHourly, regionOffshorePoint } from "@/lib/alerts/swell-events/gfs-tail";

// 2026-11-01 00:00Z, then hourly.
const T0 = Date.UTC(2026, 10, 1) / 1000;

function hourly(hours: number, values: Partial<Record<string, Array<number | null>>> = {}) {
  const fill = (value: number | null) => Array.from({ length: hours }, () => value);
  return {
    time: Array.from({ length: hours }, (_, index) => T0 + index * 3600),
    swell_wave_height: fill(1),
    swell_wave_period: fill(14),
    swell_wave_peak_period: fill(null),
    swell_wave_direction: fill(280),
    secondary_swell_wave_height: fill(0.5),
    secondary_swell_wave_period: fill(16),
    secondary_swell_wave_direction: fill(200),
    ...values,
  };
}

describe("regionOffshorePoint", () => {
  it("steps half a degree seaward from the region's centre along the beaches' mean facing", () => {
    const west = [
      { lat: 32.8, lon: -117.25, aspect_deg: 270 },
      { lat: 33.0, lon: -117.27, aspect_deg: 270 },
    ];
    const point = regionOffshorePoint(west)!;
    expect(point.lat).toBeCloseTo(32.9, 5);
    // 0.5° of distance west is 0.5 / cos(32.9°) degrees of longitude.
    expect(point.lon).toBeCloseTo(-117.26 - 0.5 / Math.cos((32.9 * Math.PI) / 180), 5);
  });

  it("averages facings as bearings, so 350° and 10° face north, not south", () => {
    const point = regionOffshorePoint([
      { lat: 21.6, lon: -158.1, aspect_deg: 350 },
      { lat: 21.6, lon: -158.1, aspect_deg: 10 },
    ])!;
    expect(point.lat).toBeCloseTo(22.1, 5);
    expect(point.lon).toBeCloseTo(-158.1, 5);
  });

  // Baja beaches carry a swell window but no facing; the window's centre points out to sea too.
  it("takes a beach's swell-window centre when it has no facing", () => {
    const point = regionOffshorePoint([
      { lat: 31.1, lon: -116.3, aspect_deg: null, swell_window_center_deg: 270 },
    ])!;
    expect(point.lat).toBeCloseTo(31.1, 5);
    expect(point.lon).toBeLessThan(-116.8);
  });

  it("is null without a beach that has a facing or a swell window", () => {
    expect(regionOffshorePoint([])).toBeNull();
    expect(regionOffshorePoint([{ lat: 32.8, lon: -117.25, aspect_deg: null, swell_window_center_deg: null }])).toBeNull();
  });
});

describe("gfsRowsFromHourly", () => {
  it("keeps every third UTC hour as a stored-forecast row in feet and seconds", () => {
    const rows = gfsRowsFromHourly(hourly(7))!;
    expect(rows.map((row) => row.forecast_at)).toEqual([
      "2026-11-01T00:00:00.000Z",
      "2026-11-01T03:00:00.000Z",
      "2026-11-01T06:00:00.000Z",
    ]);
    expect(rows[0]).toEqual({
      forecast_at: "2026-11-01T00:00:00.000Z",
      swell_1_height: "3.3 ft",
      swell_1_period: "14s",
      swell_1_direction: "280",
      swell_2_height: "1.6 ft",
      swell_2_period: "16s",
      swell_2_direction: "200",
      data_source: "OPEN_METEO",
    });
  });

  it("prefers the swell's peak period when the model gives one", () => {
    const rows = gfsRowsFromHourly(hourly(1, { swell_wave_peak_period: [15.5] }))!;
    expect(rows[0].swell_1_period).toBe("15.5s");
  });

  it("leaves a partition empty when its height is zero or missing", () => {
    const rows = gfsRowsFromHourly(hourly(4, {
      secondary_swell_wave_height: [0, null, 0.3, 0.3],
    }))!;
    expect(rows.map((row) => row.swell_2_height)).toEqual([null, "1.0 ft"]);
  });

  // A coastal 0.25° cell the model masks as land reads exactly 0 m every hour: not a flat ocean.
  it("is null when the primary swell is zero or missing at every hour", () => {
    expect(gfsRowsFromHourly(hourly(9, { swell_wave_height: Array(9).fill(0) }))).toBeNull();
    expect(gfsRowsFromHourly(hourly(9, { swell_wave_height: [0, null, 0, 0, 0, 0, 0, 0, 0] }))).toBeNull();
  });

  it("passes a small but real series through", () => {
    const rows = gfsRowsFromHourly(hourly(9, { swell_wave_height: [0, 0, 0, 0.1, 0, 0, 0, 0, 0] }));
    expect(rows).toHaveLength(3);
  });

  it("is null without hourly times", () => {
    expect(gfsRowsFromHourly(undefined)).toBeNull();
    expect(gfsRowsFromHourly({ time: [] })).toBeNull();
  });
});

describe("fetchGfsTailRows", () => {
  const originalFetch = global.fetch;
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    global.fetch = originalFetch;
    warnSpy.mockRestore();
  });

  it("asks GFS-Wave for 16 days plus 2 past days of swell partitions at the point, cached 3 h", async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ hourly: hourly(4) }) });
    global.fetch = fetchMock;

    const rows = await fetchGfsTailRows({ lat: 32.78, lon: -117.86 });

    const url = new URL(String(fetchMock.mock.calls[0][0]));
    expect(url.origin + url.pathname).toBe("https://marine-api.open-meteo.com/v1/marine");
    expect(url.searchParams.get("latitude")).toBe("32.78");
    expect(url.searchParams.get("longitude")).toBe("-117.86");
    expect(url.searchParams.get("models")).toBe("ncep_gfswave025");
    expect(url.searchParams.get("forecast_days")).toBe("16");
    expect(url.searchParams.get("past_days")).toBe("2");
    expect(url.searchParams.get("timeformat")).toBe("unixtime");
    // Ten variables or fewer count as one call on the API's rate limit.
    expect(url.searchParams.get("hourly")!.split(",").length).toBeLessThanOrEqual(10);
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ next: { revalidate: 10_800 } });
    expect(rows).toHaveLength(2);
  });

  it("returns null on an HTTP failure or a thrown fetch", async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 429 });
    await expect(fetchGfsTailRows({ lat: 32.78, lon: -117.86 })).resolves.toBeNull();
    global.fetch = jest.fn().mockRejectedValue(new Error("timeout"));
    await expect(fetchGfsTailRows({ lat: 32.78, lon: -117.86 })).resolves.toBeNull();
    expect(warnSpy).toHaveBeenCalledTimes(2);
  });
});
