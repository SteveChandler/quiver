import { fetchOpenMeteoData, fetchNOAAPointData } from "@/lib/services/noaa-wavewatch/api-client";
import { expectConsoleWarnings } from "@/__tests__/setup/test-utils";

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
  describe("retries", () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
      expectConsoleWarnings([/Open-Meteo (fetch failed|returned \d+).*; retrying/]);
    });

    async function runWithTimers<T>(promise: Promise<T>): Promise<T> {
      await jest.runAllTimersAsync();
      return promise;
    }

    it("retries a network failure and returns the recovered data", async () => {
      fetchMock
        .mockRejectedValueOnce(new TypeError("fetch failed"))
        .mockResolvedValueOnce({ ok: true, json: async () => ({ hourly: { time: ["t0"] } }) });

      const data = await runWithTimers(fetchOpenMeteoData(23.0, -109.7, 8));

      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(data).toEqual({ hourly: { time: ["t0"] } });
    });

    it("retries 5xx and 429 responses", async () => {
      fetchMock
        .mockResolvedValueOnce({ ok: false, status: 503, statusText: "Unavailable" })
        .mockResolvedValueOnce({ ok: false, status: 429, statusText: "Too Many Requests" })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ hourly: { time: ["t0"] } }) });

      const data = await runWithTimers(fetchOpenMeteoData(23.0, -109.7, 8));

      expect(fetchMock).toHaveBeenCalledTimes(3);
      expect(data).toEqual({ hourly: { time: ["t0"] } });
    });

    it("gives up after three attempts and returns null", async () => {
      fetchMock.mockRejectedValue(new TypeError("fetch failed"));

      const data = await runWithTimers(fetchOpenMeteoData(23.0, -109.7, 8));

      expect(fetchMock).toHaveBeenCalledTimes(3);
      expect(data).toBeNull();
    });

    it("does not retry a 4xx response", async () => {
      fetchMock.mockResolvedValue({ ok: false, status: 400, statusText: "Bad Request" });

      const data = await runWithTimers(fetchOpenMeteoData(23.0, -109.7, 8));

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(data).toBeNull();
    });

    it("stops waiting and returns null when aborted during backoff", async () => {
      const controller = new AbortController();
      fetchMock.mockRejectedValue(new TypeError("fetch failed"));

      const pending = fetchOpenMeteoData(23.0, -109.7, 8, { signal: controller.signal });
      await jest.advanceTimersByTimeAsync(0);
      controller.abort();

      expect(await pending).toBeNull();
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("cancels the body of a retried error response", async () => {
      const cancel = jest.fn(async () => undefined);
      fetchMock
        .mockResolvedValueOnce({ ok: false, status: 502, statusText: "Bad Gateway", body: { cancel } })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ hourly: { time: [] } }) });

      await runWithTimers(fetchOpenMeteoData(23.0, -109.7, 8));

      expect(cancel).toHaveBeenCalledTimes(1);
    });

    it("does not retry once the caller aborts", async () => {
      const controller = new AbortController();
      fetchMock.mockImplementation(async () => {
        controller.abort();
        throw Object.assign(new Error("aborted"), { name: "AbortError" });
      });

      const data = await runWithTimers(
        fetchOpenMeteoData(23.0, -109.7, 8, { signal: controller.signal }),
      );

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(data).toBeNull();
    });
  });
});
