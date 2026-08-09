import {
  buildForecastAuthorityAudit,
  type ForecastAuthorityAuditBeach,
} from "@/lib/seo/forecast-authority-audit";
import type { ForecastIndexabilitySnapshot } from "@/lib/seo/forecast-indexability";

function beach(
  id: string,
  overrides: Partial<ForecastAuthorityAuditBeach> = {},
): ForecastAuthorityAuditBeach {
  return {
    id,
    name: `Beach ${id}`,
    slug: `beach-${id}`,
    city: "Oceanside",
    state: "CA",
    country: "USA",
    lat: 33.2,
    lon: -117.3,
    description: null,
    wave_tips: null,
    crowd_tips: null,
    best_conditions_prose: null,
    ...overrides,
  };
}

function snapshot(
  overrides: Partial<ForecastIndexabilitySnapshot> = {},
): ForecastIndexabilitySnapshot {
  return {
    forecastAvailable: true,
    selectedStateComplete: true,
    forecastFresh: true,
    forecastValidAt: "2026-08-08T12:00:00.000Z",
    sourceDataUpdatedAt: "2026-08-08T10:00:00.000Z",
    primaryDataSource: "noaa",
    isStale: false,
    ...overrides,
  };
}

describe("buildForecastAuthorityAudit", () => {
  it("reports whole-inventory eligibility and quality counts", () => {
    const beaches = [
      beach("approved"),
      beach("missing", { slug: "missing-forecast" }),
      beach("stale"),
      beach("bad-location", { lat: null }),
      beach("contaminated", {
        description: "A Siuslaw River break outside Oregon.",
      }),
    ];
    const snapshots = new Map<string, ForecastIndexabilitySnapshot>([
      ["approved", snapshot()],
      ["missing", snapshot({ forecastAvailable: false, selectedStateComplete: false })],
      ["stale", snapshot({ forecastFresh: false, isStale: true })],
      ["bad-location", snapshot()],
      ["contaminated", snapshot()],
    ]);

    const report = buildForecastAuthorityAudit(beaches, snapshots, {
      generatedAt: "2026-08-08T12:00:00.000Z",
      sitemapPaths: ["/ca/oceanside/beach-approved"],
    });

    expect(report.summary).toMatchObject({
      totalBeachRecords: 5,
      totalCanonicalSpotPages: 4,
      forecastEligible: 2,
      forecastIneligible: 3,
      missingForecast: 1,
      staleForecast: 1,
      badLocationIdentity: 1,
      quarantinedEditorial: 1,
      missingSitemapEntries: 1,
    });
    expect(report.reasonCounts["forecast-approved"]).toBe(2);
    expect(report.failures).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "missing", indexabilityReason: "forecast-missing" }),
        expect.objectContaining({ id: "stale", indexabilityReason: "forecast-stale" }),
        expect.objectContaining({ id: "bad-location", indexabilityReason: "invalid-canonical" }),
      ]),
    );
  });

  it("detects duplicate canonical mappings", () => {
    const duplicateA = beach("duplicate-a");
    const duplicateB = beach("duplicate-b", { slug: duplicateA.slug });
    const report = buildForecastAuthorityAudit(
      [duplicateA, duplicateB],
      new Map([
        [duplicateA.id, snapshot()],
        [duplicateB.id, snapshot()],
      ]),
    );

    expect(report.summary.canonicalConflicts).toBe(2);
    expect(report.canonicalConflicts).toEqual([
      expect.objectContaining({
        canonicalPath: "/ca/oceanside/beach-duplicate-a",
        beachIds: ["duplicate-a", "duplicate-b"],
      }),
    ]);
  });
});
