import * as Sentry from "@sentry/nextjs";
import { unstable_cache } from "next/cache";

import {
  FORECAST_INDEXABILITY_REVALIDATE_SECONDS,
  fingerprintBeachIds,
  getCachedForecastIndexabilitySnapshots,
} from "@/lib/seo/forecast-indexability-cache";
import {
  ForecastIndexabilityUnavailableError,
  getForecastIndexabilityForBeaches,
  type ForecastIndexabilitySnapshot,
} from "@/lib/seo/forecast-indexability";

jest.mock("@sentry/nextjs", () => ({ captureException: jest.fn() }));

jest.mock("next/cache", () => ({
  unstable_cache: jest.fn((fn: unknown) => fn),
}));

jest.mock("@/lib/seo/forecast-indexability", () => {
  const actual = jest.requireActual("@/lib/seo/forecast-indexability");
  return {
    ForecastIndexabilityUnavailableError: actual.ForecastIndexabilityUnavailableError,
    getForecastIndexabilityForBeaches: jest.fn(),
  };
});

const snapshot: ForecastIndexabilitySnapshot = {
  forecastAvailable: true,
  selectedStateComplete: true,
  forecastFresh: true,
  forecastValidAt: "2026-09-01T18:00:00.000Z",
  sourceDataUpdatedAt: "2026-09-01T16:00:00.000Z",
  primaryDataSource: "NOAA_NWS",
  isStale: false,
};

describe("getCachedForecastIndexabilitySnapshots", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getForecastIndexabilityForBeaches as jest.Mock).mockResolvedValue(
      new Map([["beach-1", snapshot]]),
    );
  });

  it("reads through unstable_cache on the sub-page revalidate window", async () => {
    const result = await getCachedForecastIndexabilitySnapshots([
      { id: "beach-1", timezone: "America/Los_Angeles" },
    ]);

    expect(result).toBeInstanceOf(Map);
    expect(result.get("beach-1")).toEqual(snapshot);
    expect(unstable_cache).toHaveBeenCalledWith(
      expect.any(Function),
      ["forecast-indexability-snapshots", fingerprintBeachIds(["beach-1"])],
      { revalidate: FORECAST_INDEXABILITY_REVALIDATE_SECONDS },
    );
    expect(FORECAST_INDEXABILITY_REVALIDATE_SECONDS).toBe(3600);
  });

  it("keys the cache by the beach-id set regardless of order", () => {
    expect(fingerprintBeachIds(["b", "a"])).toBe(fingerprintBeachIds(["a", "b"]));
    expect(fingerprintBeachIds(["a"])).not.toBe(fingerprintBeachIds(["a", "b"]));
  });

  it("returns an empty map when no snapshots exist", async () => {
    (getForecastIndexabilityForBeaches as jest.Mock).mockResolvedValue(new Map());

    const result = await getCachedForecastIndexabilitySnapshots([{ id: "beach-2" }]);

    expect(result.size).toBe(0);
  });

  it("reports a coverage read failure and returns an empty map without caching it", async () => {
    const consoleError = jest.spyOn(console, "error").mockImplementation(() => undefined);
    const failure = new ForecastIndexabilityUnavailableError("coverage query failed", "timeout");
    (getForecastIndexabilityForBeaches as jest.Mock).mockRejectedValue(failure);

    const result = await getCachedForecastIndexabilitySnapshots([{ id: "beach-1" }]);

    expect(result.size).toBe(0);
    expect(Sentry.captureException).toHaveBeenCalledWith(failure, expect.anything());
    consoleError.mockRestore();
  });

  it("lets an unrelated error through", async () => {
    (getForecastIndexabilityForBeaches as jest.Mock).mockRejectedValue(new TypeError("boom"));

    await expect(getCachedForecastIndexabilitySnapshots([{ id: "beach-1" }])).rejects.toThrow("boom");
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });
});
