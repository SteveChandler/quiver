import * as Sentry from "@sentry/nextjs";
import { unstable_cache } from "next/cache";

import {
  FORECAST_INDEXABILITY_REVALIDATE_SECONDS,
  fingerprintBeachIds,
  getCachedForecastIndexabilitySnapshots,
} from "@/lib/seo/forecast-indexability-cache";
import {
  ForecastIndexabilityUnavailableError,
  evaluateBeachPageIndexability,
  forecastCoverageFor,
  getForecastIndexabilityForBeaches,
  type ForecastIndexabilitySnapshot,
} from "@/lib/seo/forecast-indexability";

jest.mock("@sentry/nextjs", () => ({ captureException: jest.fn() }));

jest.mock("next/cache", () => ({
  unstable_cache: jest.fn((fn: unknown) => fn),
}));

jest.mock("@/lib/seo/forecast-indexability", () => ({
  ...jest.requireActual("@/lib/seo/forecast-indexability"),
  getForecastIndexabilityForBeaches: jest.fn(),
}));

const REPORT_WINDOW_MS = 5 * 60 * 1000;
// The Sentry report window is module state; each test starts an hour after the
// last so an earlier test's report does not suppress this one's.
let clockMs = Date.parse("2026-11-11T00:00:00.000Z");
let spies: jest.SpyInstance[] = [];

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
    clockMs += 60 * 60 * 1000;
    spies = [
      jest.spyOn(Date, "now").mockImplementation(() => clockMs),
      jest.spyOn(console, "error").mockImplementation(() => undefined),
    ];
    (getForecastIndexabilityForBeaches as jest.Mock).mockResolvedValue(
      new Map([["beach-1", snapshot]]),
    );
  });

  it("reads through unstable_cache on the sub-page revalidate window", async () => {
    const result = await getCachedForecastIndexabilitySnapshots([
      { id: "beach-1", timezone: "America/Los_Angeles" },
    ]);

    expect(result).toBeInstanceOf(Map);
    expect((result as ReadonlyMap<string, ForecastIndexabilitySnapshot>).get("beach-1")).toEqual(snapshot);
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

  afterEach(() => {
    for (const spy of spies) spy.mockRestore();
  });

  it("gives noindex for a beach with no forecast rows", async () => {
    (getForecastIndexabilityForBeaches as jest.Mock).mockResolvedValue(new Map());

    const result = await getCachedForecastIndexabilitySnapshots([{ id: "beach-2" }]);

    expect(result).toBeInstanceOf(Map);
    const snapshots = result as ReadonlyMap<string, ForecastIndexabilitySnapshot>;
    expect(evaluateBeachPageIndexability(snapshots.get("beach-2"), true)).toEqual({
      indexable: false,
      reason: "forecast-missing",
    });
  });

  it("keeps a beach indexable when the coverage read fails", async () => {
    const failure = new ForecastIndexabilityUnavailableError("coverage query failed", "timeout");
    (getForecastIndexabilityForBeaches as jest.Mock).mockRejectedValue(failure);

    const result = await getCachedForecastIndexabilitySnapshots([{ id: "never-read" }]);

    expect(evaluateBeachPageIndexability(forecastCoverageFor(result, "never-read"), true).indexable).toBe(true);
    expect(evaluateBeachPageIndexability(forecastCoverageFor(result, "never-read"), false).indexable).toBe(false);
    expect(Sentry.captureException).toHaveBeenCalledWith(
      failure,
      expect.objectContaining({ level: "warning" }),
    );
  });

  it("keeps the last known state of each beach when a later read fails", async () => {
    const stale = { ...snapshot, forecastFresh: false, isStale: true };
    const missing = { ...snapshot, forecastAvailable: false, selectedStateComplete: false, forecastFresh: false };
    (getForecastIndexabilityForBeaches as jest.Mock).mockResolvedValueOnce(
      new Map([["lg-stale", stale], ["lg-missing", missing]]),
    );
    await getCachedForecastIndexabilitySnapshots([{ id: "lg-stale" }, { id: "lg-missing" }]);
    (getForecastIndexabilityForBeaches as jest.Mock).mockRejectedValue(
      new ForecastIndexabilityUnavailableError("coverage query failed", "timeout"),
    );

    const result = await getCachedForecastIndexabilitySnapshots([
      { id: "lg-stale" },
      { id: "lg-missing" },
      { id: "lg-never-read" },
    ]);

    expect(evaluateBeachPageIndexability(forecastCoverageFor(result, "lg-stale"), true)).toEqual({
      indexable: false,
      reason: "forecast-stale",
    });
    expect(evaluateBeachPageIndexability(forecastCoverageFor(result, "lg-missing"), true)).toEqual({
      indexable: false,
      reason: "forecast-missing",
    });
    expect(evaluateBeachPageIndexability(forecastCoverageFor(result, "lg-never-read"), true)).toEqual({
      indexable: true,
      reason: "forecast-coverage-unknown",
    });
  });

  it("does not store a failed read in the data cache; the next call reads again", async () => {
    // A cache double that, like unstable_cache, keeps what the loader resolves
    // per key and serves it on the next call.
    const stored = new Map<string, unknown>();
    (unstable_cache as jest.Mock).mockImplementation(
      (loader: () => Promise<unknown>, keyParts: string[]) => async () => {
        const key = keyParts.join("|");
        if (stored.has(key)) return stored.get(key);
        const value = await loader();
        stored.set(key, value);
        return value;
      },
    );
    try {
      (getForecastIndexabilityForBeaches as jest.Mock)
        .mockRejectedValueOnce(new ForecastIndexabilityUnavailableError("coverage query failed", "timeout"))
        .mockResolvedValueOnce(new Map([["cache-beach", snapshot]]));

      const failed = await getCachedForecastIndexabilitySnapshots([{ id: "cache-beach" }]);
      expect(forecastCoverageFor(failed, "cache-beach")).toBe("forecast-coverage-unknown");
      expect(stored.size).toBe(0);

      const next = await getCachedForecastIndexabilitySnapshots([{ id: "cache-beach" }]);
      expect(getForecastIndexabilityForBeaches).toHaveBeenCalledTimes(2);
      expect(forecastCoverageFor(next, "cache-beach")).toEqual(snapshot);
      expect(stored.size).toBe(1);
    } finally {
      (unstable_cache as jest.Mock).mockImplementation((fn: unknown) => fn);
    }
  });

  it("reports repeated coverage failures to Sentry once per five minutes", async () => {
    const failure = new ForecastIndexabilityUnavailableError("coverage query failed", "timeout");
    (getForecastIndexabilityForBeaches as jest.Mock).mockRejectedValue(failure);

    await getCachedForecastIndexabilitySnapshots([{ id: "beach-1" }]);
    clockMs += REPORT_WINDOW_MS - 1;
    await getCachedForecastIndexabilitySnapshots([{ id: "beach-1" }]);
    expect(Sentry.captureException).toHaveBeenCalledTimes(1);

    clockMs += 1;
    await getCachedForecastIndexabilitySnapshots([{ id: "beach-1" }]);
    expect(Sentry.captureException).toHaveBeenCalledTimes(2);
  });

  it("lets an unrelated error through", async () => {
    (getForecastIndexabilityForBeaches as jest.Mock).mockRejectedValue(new TypeError("boom"));

    await expect(getCachedForecastIndexabilitySnapshots([{ id: "beach-1" }])).rejects.toThrow("boom");
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });
});
