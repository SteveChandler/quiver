import { fetchOpenMeteoData } from "@/lib/services/noaa-wavewatch/api-client";

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
