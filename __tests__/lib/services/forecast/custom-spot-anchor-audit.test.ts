import {
  buildCustomSpotAnchorAudit,
  formatCustomSpotAnchorAuditMarkdown,
  type CustomSpotAnchorAuditBeach,
  type CustomSpotAnchorAuditCustomSpot,
  type CustomSpotAnchorAuditForecast,
} from "@/lib/services/forecast/custom-spot-anchor-audit";

const NOW = new Date("2026-07-02T12:00:00.000Z");

function spot(
  overrides: Partial<CustomSpotAnchorAuditCustomSpot> = {}
): CustomSpotAnchorAuditCustomSpot {
  return {
    id: "spot-1",
    userId: "user-1",
    name: "Private Beach",
    lat: 33.433,
    lon: -79.122,
    nearestBeachId: "beach-close",
    nearestBeachDistanceMi: 0.2,
    ...overrides,
  };
}

function beach(
  overrides: Partial<CustomSpotAnchorAuditBeach> = {}
): CustomSpotAnchorAuditBeach {
  return {
    id: "beach-close",
    name: "Close Forecast Beach",
    slug: "close-forecast-beach",
    lat: 33.433,
    lon: -79.122,
    ...overrides,
  };
}

function forecast(
  overrides: Partial<CustomSpotAnchorAuditForecast> = {}
): CustomSpotAnchorAuditForecast {
  return {
    beachId: "beach-close",
    updatedAt: "2026-07-02T08:00:00.000Z",
    dataSource: "CDIP",
    ...overrides,
  };
}

describe("buildCustomSpotAnchorAudit", () => {
  it("passes custom spots anchored to nearby beaches with fresh forecasts", () => {
    const audit = buildCustomSpotAnchorAudit({
      customSpots: [spot()],
      beaches: [beach()],
      forecasts: [forecast()],
      config: { now: NOW },
    });

    expect(audit.summary).toMatchObject({
      totalCustomSpots: 1,
      auditedCustomSpots: 1,
      critical: 0,
      watch: 0,
      pass: 1,
    });
    expect(audit.evaluations[0]).toMatchObject({
      status: "pass",
      currentAnchor: { id: "beach-close", distanceMi: 0 },
      forecast: { ageHours: 4, dataSource: "CDIP" },
    });
  });

  it("flags far anchors and surfaces a closer real forecast beach", () => {
    const audit = buildCustomSpotAnchorAudit({
      customSpots: [
        spot({
          nearestBeachId: "beach-far",
          nearestBeachDistanceMi: 60,
        }),
      ],
      beaches: [
        beach(),
        beach({
          id: "beach-far",
          name: "Far Forecast Beach",
          slug: "far-forecast-beach",
          lat: 34.2,
          lon: -79.9,
        }),
      ],
      forecasts: [forecast({ beachId: "beach-far" })],
      config: { now: NOW, maxAnchorDistanceMi: 30 },
    });

    expect(audit.summary.critical).toBe(1);
    expect(audit.evaluations[0]).toMatchObject({
      status: "critical",
      currentAnchor: { id: "beach-far" },
      closestAnchor: { id: "beach-close", distanceMi: 0 },
    });
    expect(audit.evaluations[0].reasons.map((reason) => reason.code)).toEqual([
      "anchor_too_far",
      "closer_anchor_available",
    ]);
  });

  it("flags missing and stale forecast rows for current anchors", () => {
    const staleAudit = buildCustomSpotAnchorAudit({
      customSpots: [spot()],
      beaches: [beach()],
      forecasts: [forecast({ updatedAt: "2026-06-30T08:00:00.000Z" })],
      config: { now: NOW, forecastFreshnessHours: 24 },
    });
    const missingAudit = buildCustomSpotAnchorAudit({
      customSpots: [spot()],
      beaches: [beach()],
      forecasts: [],
      config: { now: NOW },
    });

    expect(staleAudit.summary.critical).toBe(1);
    expect(staleAudit.evaluations[0].reasons.map((reason) => reason.code)).toEqual([
      "forecast_stale",
    ]);
    expect(missingAudit.summary.critical).toBe(1);
    expect(missingAudit.evaluations[0].reasons.map((reason) => reason.code)).toEqual([
      "forecast_missing",
    ]);
  });

  it("excludes mock or non-real profiles before scoring", () => {
    const audit = buildCustomSpotAnchorAudit({
      customSpots: [spot({ excluded: true, exclusionReason: "mock_profile" })],
      beaches: [beach()],
      forecasts: [forecast()],
      config: { now: NOW },
    });

    expect(audit.summary).toMatchObject({
      totalCustomSpots: 1,
      auditedCustomSpots: 0,
      excludedCustomSpots: 1,
      pass: 0,
      watch: 0,
      critical: 0,
    });
    expect(audit.evaluations).toEqual([]);
  });
});

describe("formatCustomSpotAnchorAuditMarkdown", () => {
  it("prints a compact no-issue report", () => {
    const audit = buildCustomSpotAnchorAudit({
      customSpots: [spot()],
      beaches: [beach()],
      forecasts: [forecast()],
      config: { now: NOW },
    });

    expect(formatCustomSpotAnchorAuditMarkdown(audit)).toContain(
      "No custom-spot anchor coverage issues found."
    );
  });
});
