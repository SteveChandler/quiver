/** @jest-environment node */
import { fetchBulkForecast } from "@/components/map/map-beach-loader";
import { forecastCache } from "@/lib/utils/request-cache";

describe("map forecast recovery", () => {
  const originalFetch = global.fetch;
  beforeEach(() => { forecastCache.clear(); jest.useFakeTimers(); });
  afterEach(() => { global.fetch = originalFetch; jest.useRealTimers(); forecastCache.clear(); });

  it("reuses a successful response without consuming its body or crossing auth scopes", async () => {
    global.fetch = jest.fn(async () => new Response('{"value":1}'));
    expect(await (await fetchBulkForecast("/test", undefined)).json()).toEqual({ value: 1 });
    expect(await (await fetchBulkForecast("/test", undefined)).json()).toEqual({ value: 1 });
    expect(global.fetch).toHaveBeenCalledTimes(1);
    await fetchBulkForecast("/test", undefined, () => "user-token");
    expect(global.fetch).toHaveBeenCalledTimes(2);
    jest.advanceTimersByTime(60_001);
    await fetchBulkForecast("/test", undefined);
    expect(global.fetch).toHaveBeenCalledTimes(3);
  });

  it("honors Retry-After, retries once and does not cache throttling", async () => {
    global.fetch = jest.fn()
      .mockResolvedValueOnce(new Response("", { status: 429, headers: { "Retry-After": "2" } }))
      .mockResolvedValue(new Response('{}'));
    const pending = fetchBulkForecast("/test", undefined);
    await jest.advanceTimersByTimeAsync(1999);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(1);
    expect((await pending).status).toBe(200);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it("cancels a cooldown on region change without another request", async () => {
    global.fetch = jest.fn().mockResolvedValue(new Response("", { status: 429, headers: { "Retry-After": "60" } }));
    const controller = new AbortController();
    const pending = fetchBulkForecast("/test", controller.signal);
    const assertion = expect(pending).rejects.toMatchObject({ name: "AbortError" });
    await jest.advanceTimersByTimeAsync(1);
    controller.abort();
    await assertion;
    await jest.advanceTimersByTimeAsync(60_000);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});
