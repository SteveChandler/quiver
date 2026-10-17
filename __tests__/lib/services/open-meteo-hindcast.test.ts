import { fetchOpenMeteoHindcastDay, hindcastToConditionsRow } from "@/lib/services/open-meteo-hindcast";
import { expectConsoleWarnings } from "@/__tests__/setup/test-utils";

const times = Array.from({ length: 24 }, (_, hour) => `2026-10-02T${String(hour).padStart(2, "0")}:00`);

describe("fetchOpenMeteoHindcastDay", () => {
  afterEach(() => jest.restoreAllMocks());

  it("joins 24 UTC marine and wind hours and maps the forecast row units", async () => {
    const fetchImpl = jest.fn(async (url: string, _init: RequestInit) => {
      if (new URL(url).hostname === "marine-api.open-meteo.com") {
        return { ok: true, json: async () => ({ hourly: { time: times, wave_height: times.map(() => 1.5), swell_wave_height: times.map(() => 1.2), swell_wave_period: times.map(() => 14), swell_wave_direction: times.map(() => 275) } }) };
      }
      return { ok: true, json: async () => ({ hourly: { time: times, wind_speed_10m: times.map(() => 8), wind_direction_10m: times.map(() => 315) } }) };
    });

    const hours = await fetchOpenMeteoHindcastDay(32.7, -117.2, "2026-10-02", fetchImpl as unknown as typeof fetch);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    const urls = fetchImpl.mock.calls.map(([url]) => new URL(url));
    expect(urls.map((url) => url.hostname)).toEqual(["marine-api.open-meteo.com", "historical-forecast-api.open-meteo.com"]);
    expect(urls.map((url) => url.searchParams.get("hourly"))).toEqual([
      "wave_height,swell_wave_height,swell_wave_period,swell_wave_direction",
      "wind_speed_10m,wind_direction_10m",
    ]);
    expect(urls[1].searchParams.get("wind_speed_unit")).toBe("mph");
    for (const url of urls) {
      expect(url.searchParams.get("latitude")).toBe("32.7");
      expect(url.searchParams.get("longitude")).toBe("-117.2");
      expect(url.searchParams.get("start_date")).toBe("2026-10-02");
      expect(url.searchParams.get("end_date")).toBe("2026-10-02");
      expect(url.searchParams.get("timezone")).toBe("UTC");
    }
    expect(fetchImpl.mock.calls.map(([, init]) => init.signal)).toEqual([expect.any(AbortSignal), expect.any(AbortSignal)]);
    expect(hours).toHaveLength(24);
    expect(hours?.[7]).toEqual({ at: "2026-10-02T07:00:00.000Z", waveHeightM: 1.5, swellHeightM: 1.2, swellPeriodS: 14, swellDirectionDeg: 275, windSpeedMph: 8, windDirectionDeg: 315 });
    expect(hindcastToConditionsRow(hours![7])).toMatchObject({ forecast_at: "2026-10-02T07:00:00.000Z", swell_height_om: 1.2, swell_period_om: 14, swell_direction_om: 275, wind_speed: "8", wind_direction_deg: 315 });
  });

  it("returns null on a failed response", async () => {
    const warn = jest.spyOn(console, "warn");
    const fetchImpl = jest.fn(async () => ({ ok: false, status: 500 }));
    await expect(fetchOpenMeteoHindcastDay(32.7, -117.2, "2026-10-02", fetchImpl as unknown as typeof fetch)).resolves.toBeNull();
    expectConsoleWarnings([/\[open-meteo-hindcast\] HTTP failure/]);
    expect(warn).toHaveBeenCalledWith("[open-meteo-hindcast] HTTP failure", { marineStatus: 500, windStatus: 500 });
  });

  it.each(["network", "parse"])("warns and returns null on a %s failure", async (failure) => {
    const warn = jest.spyOn(console, "warn");
    const error = new Error("Upstream request failed");
    const fetchImpl = jest.fn(async () => {
      if (failure === "network") throw error;
      return { ok: true, json: async () => { throw error; } };
    });

    await expect(fetchOpenMeteoHindcastDay(32.7, -117.2, "2026-10-02", fetchImpl as unknown as typeof fetch)).resolves.toBeNull();
    expectConsoleWarnings([/\[open-meteo-hindcast\] Request or parse failure/]);
    expect(warn).toHaveBeenCalledWith("[open-meteo-hindcast] Request or parse failure", error);
  });

  it("returns null when both hourly arrays are missing", async () => {
    const fetchImpl = jest.fn(async () => ({ ok: true, json: async () => ({}) }));
    await expect(fetchOpenMeteoHindcastDay(32.7, -117.2, "2026-10-02", fetchImpl as unknown as typeof fetch)).resolves.toBeNull();
  });
});
