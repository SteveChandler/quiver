import {
  buildForecastIndexabilitySnapshot,
  evaluateBeachPageIndexability,
  isBeachSubPageIndexable,
  type ForecastCoverageRow,
  type ForecastIndexabilitySnapshot,
} from "@/lib/seo/forecast-indexability";
import { evaluateBeachForecastIndexability } from "@/lib/seo/indexability";

function row(overrides: Partial<ForecastCoverageRow> = {}): ForecastCoverageRow {
  return {
    beach_id: "beach-1",
    forecast_at: "2026-08-08T19:00:00.000Z",
    wave_height: "3 ft",
    updated_at: "2026-08-08T16:00:00.000Z",
    data_source: "NOAA_NWS",
    ...overrides,
  };
}

describe("forecast indexability contract", () => {
  it("approves a complete fresh forecast independently of editorial approval", () => {
    const snapshot = buildForecastIndexabilitySnapshot(
      [row()],
      new Date("2026-08-08T18:30:00.000Z"),
    );

    expect(snapshot).toMatchObject({
      forecastAvailable: true,
      selectedStateComplete: true,
      forecastFresh: true,
      primaryDataSource: "NOAA_NWS",
    });
    expect(
      evaluateBeachForecastIndexability({
        canonicalValid: true,
        forecastAvailable: snapshot.forecastAvailable,
        selectedStateComplete: snapshot.selectedStateComplete,
        forecastFresh: snapshot.forecastFresh,
      }),
    ).toEqual({ indexable: true, reason: "forecast-approved" });
  });

  it("withholds missing, incomplete, and stale states with explicit reasons", () => {
    expect(
      evaluateBeachForecastIndexability({
        canonicalValid: true,
        forecastAvailable: false,
        selectedStateComplete: false,
        forecastFresh: false,
      }),
    ).toEqual({ indexable: false, reason: "forecast-missing" });

    expect(
      evaluateBeachForecastIndexability({
        canonicalValid: true,
        forecastAvailable: true,
        selectedStateComplete: false,
        forecastFresh: false,
      }),
    ).toEqual({ indexable: false, reason: "forecast-incomplete" });

    expect(
      evaluateBeachForecastIndexability({
        canonicalValid: true,
        forecastAvailable: true,
        selectedStateComplete: true,
        forecastFresh: false,
      }),
    ).toEqual({ indexable: false, reason: "forecast-stale" });
  });

  it("marks a complete but stale row as stale using its source threshold", () => {
    const snapshot = buildForecastIndexabilitySnapshot(
      [row({ updated_at: "2026-08-07T00:00:00.000Z", data_source: "CDIP" })],
      new Date("2026-08-08T18:30:00.000Z"),
    );

    expect(snapshot).toMatchObject({
      forecastAvailable: true,
      selectedStateComplete: true,
      forecastFresh: false,
      isStale: true,
    });
  });

  it("evaluates the today row before an extended-horizon row", () => {
    const snapshot = buildForecastIndexabilitySnapshot(
      [
        row({ forecast_at: "2026-08-08T19:00:00.000Z" }),
        row({
          forecast_at: "2026-08-11T18:00:00.000Z",
          updated_at: "2026-08-07T00:00:00.000Z",
          data_source: "OPEN_METEO",
        }),
      ],
      new Date("2026-08-08T18:30:00.000Z"),
    );

    expect(snapshot).toMatchObject({
      forecastFresh: true,
      forecastValidAt: "2026-08-08T19:00:00.000Z",
      primaryDataSource: "NOAA_NWS",
    });
  });

  it("skips an expired today row and selects the next current or tomorrow row", () => {
    const snapshot = buildForecastIndexabilitySnapshot(
      [
        row({ forecast_at: "2026-08-08T06:00:00.000Z" }),
        row({ forecast_at: "2026-08-09T15:00:00.000Z" }),
      ],
      new Date("2026-08-08T18:30:00.000Z"),
    );

    expect(snapshot).toMatchObject({
      selectedStateComplete: true,
      forecastValidAt: "2026-08-09T15:00:00.000Z",
    });
  });

  it("falls back to tomorrow when today has no complete row", () => {
    const snapshot = buildForecastIndexabilitySnapshot(
      [
        row({
          forecast_at: "2026-08-09T18:00:00.000Z",
          data_source: "OPEN_METEO",
          updated_at: "2026-08-08T12:00:00.000Z",
        }),
        row({
          forecast_at: "2026-08-11T18:00:00.000Z",
          data_source: "OPEN_METEO",
          updated_at: "2026-08-08T12:00:00.000Z",
        }),
      ],
      new Date("2026-08-08T18:30:00.000Z"),
    );

    expect(snapshot).toMatchObject({
      selectedStateComplete: true,
      forecastFresh: true,
      forecastValidAt: "2026-08-09T18:00:00.000Z",
      primaryDataSource: "OPEN_METEO",
    });
  });

  it("does not treat a complete row outside the near-term window as selected", () => {
    const snapshot = buildForecastIndexabilitySnapshot(
      [row({ forecast_at: "2026-08-11T18:00:00.000Z" })],
      new Date("2026-08-08T18:30:00.000Z"),
    );

    expect(snapshot).toMatchObject({
      forecastAvailable: true,
      selectedStateComplete: false,
      forecastFresh: false,
      forecastValidAt: null,
    });
  });
});

describe("isBeachSubPageIndexable", () => {
  const fresh: ForecastIndexabilitySnapshot = {
    forecastAvailable: true,
    selectedStateComplete: true,
    forecastFresh: true,
    forecastValidAt: "2026-08-09T18:00:00.000Z",
    sourceDataUpdatedAt: "2026-08-09T17:00:00.000Z",
    primaryDataSource: "NOAA_WAVEWATCH",
    isStale: false,
  };

  it("indexes a tides sub-page when the forecast contract passes and tide data exists", () => {
    expect(
      isBeachSubPageIndexable(fresh, "/ca/la-jolla/windansea/tides", {
        hasSubPageData: true,
      }),
    ).toBe(true);
  });

  it("does not index when the sub-page has no data of its own", () => {
    expect(
      isBeachSubPageIndexable(fresh, "/ca/la-jolla/windansea/tides", {
        hasSubPageData: false,
      }),
    ).toBe(false);
  });

  it("does not index when the forecast is stale", () => {
    expect(
      isBeachSubPageIndexable(
        { ...fresh, forecastFresh: false },
        "/ca/la-jolla/windansea/tides",
        { hasSubPageData: true },
      ),
    ).toBe(false);
  });

  it("does not index a legacy /beach/ canonical", () => {
    expect(
      isBeachSubPageIndexable(fresh, "/beach/windansea/tides", {
        hasSubPageData: true,
      }),
    ).toBe(false);
  });

  it("returns false when there is no snapshot", () => {
    expect(
      isBeachSubPageIndexable(undefined, "/ca/la-jolla/windansea/tides", {
        hasSubPageData: true,
      }),
    ).toBe(false);
  });
});

describe("evaluateBeachPageIndexability", () => {
  const fresh: ForecastIndexabilitySnapshot = {
    forecastAvailable: true,
    selectedStateComplete: true,
    forecastFresh: true,
    forecastValidAt: "2026-08-08T18:00:00.000Z",
    sourceDataUpdatedAt: "2026-08-08T16:00:00.000Z",
    primaryDataSource: "NOAA_NWS",
    isStale: false,
  };

  it("indexes the beach page from a fresh snapshot on its canonical path", () => {
    expect(evaluateBeachPageIndexability(fresh, true)).toEqual({
      indexable: true,
      reason: "forecast-approved",
    });
  });

  it("reports forecast-missing when there is no snapshot", () => {
    expect(evaluateBeachPageIndexability(undefined, true)).toEqual({
      indexable: false,
      reason: "forecast-missing",
    });
  });

  it("withholds stale and incomplete snapshots and invalid canonicals", () => {
    expect(
      evaluateBeachPageIndexability({ ...fresh, forecastFresh: false, isStale: true }, true).reason,
    ).toBe("forecast-stale");
    expect(
      evaluateBeachPageIndexability({ ...fresh, selectedStateComplete: false }, true).reason,
    ).toBe("forecast-incomplete");
    expect(
      evaluateBeachPageIndexability(fresh, false).reason,
    ).toBe("invalid-canonical");
  });
});
