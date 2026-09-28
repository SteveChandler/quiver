import { fetchOpenMeteoData, fetchNOAAPointData } from "@/lib/services/noaa-wavewatch/api-client";

describe("fetchOpenMeteoData", () => {
  const originalFetch = global.fetch;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn(async () => ({
      ok: true,
      json: async () => ({ hourly: { time: [] } }),
    }));
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  function requestedParams(): URLSearchParams {
    const url = fetchMock.mock.calls[0]?.[0];
    expect(typeof url).toBe("string");
    return new URL(url as string).searchParams;
  }

  it("uses the reviewed NOAA point without shifting again and caches by sampled point", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ properties: { gridId: "MHX" } }) });
    await fetchNOAAPointData(35.22, -75.63, [35.17, -75.61]);
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.weather.gov/points/35.17,-75.61");
    await fetchNOAAPointData(35.22, -75.63, [35.17, -75.61]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await fetchNOAAPointData(35.22, -75.63, [35.16, -75.61]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0]).toBe("https://api.weather.gov/points/35.16,-75.61");
    await fetchNOAAPointData(35.22, -75.63);
    expect(fetchMock.mock.calls[2][0]).toBe("https://api.weather.gov/points/35.22,-75.58");
    expect(await fetchNOAAPointData(35.22, -75.63, [NaN, -75.61])).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("defaults display Open-Meteo fetches to UTC timestamps", async () => {
    await fetchOpenMeteoData(32.7, -117.3, 8);

    const params = requestedParams();
    expect(params.get("timezone")).toBe("UTC");
    expect(params.has("models")).toBe(false);
    expect(params.has("timeformat")).toBe(false);
  });

  it("passes model, timeformat, timezone, and abort signal as explicit options", async () => {
    const controller = new AbortController();

    await fetchOpenMeteoData(32.7, -117.3, 8, {
      model: "ncep_gfswave016",
      timeformat: "unixtime",
      timezone: "America/Los_Angeles",
      signal: controller.signal,
    });

    const params = requestedParams();
    expect(params.get("models")).toBe("ncep_gfswave016");
    expect(params.get("timeformat")).toBe("unixtime");
    expect(params.get("timezone")).toBe("America/Los_Angeles");
    expect(fetchMock.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({ signal: controller.signal }),
    );
  });
});
