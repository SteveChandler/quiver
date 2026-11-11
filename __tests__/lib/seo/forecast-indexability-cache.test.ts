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

    const result = await getCachedForecastIndexabilitySnapshots([{ id: "beach-1" }]);

    expect(evaluateBeachPageIndexability(forecastCoverageFor(result, "beach-1"), true).indexable).toBe(true);
    expect(evaluateBeachPageIndexability(forecastCoverageFor(result, "beach-1"), false).indexable).toBe(false);
    expect(Sentry.captureException).toHaveBeenCalledWith(
      failure,
      expect.objectContaining({ level: "warning" }),
    );
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
