import {
  GSC_PROTECTION_POLICY_VERSION,
  buildGscProtectionSnapshot,
  classifyGscProtectedPageFamily,
  diffGscProtectionSnapshots,
  isGscPerformanceProtected,
  type GscProtectionSnapshot,
} from "@/lib/seo/gsc-performance-protection";
import type { GscExportInput } from "@/lib/seo/agent-workflow/types";

describe("GSC performance protection", () => {
  it.each([
    ["/ca/encinitas/swamis", "beach"],
    ["/ca/encinitas/swamis/tides", "beach-tides"],
    ["/ca/encinitas/swamis/water-temp", "beach-water-temp"],
    ["/best-time-to-surf/la-jolla", "best-time-city"],
    ["/beginner/santa-cruz", "city-intent"],
    ["/ca/san-diego", "city-location"],
    ["/beaches/usa/ca", "geographic-hub"],
    ["/longboard/ca", null],
    ["/support", null],
    ["/beach/swamis", null],
  ])("classifies supported page families for %s", (path, expected) => {
    expect(classifyGscProtectedPageFamily(path)).toBe(expected);
  });

  it("applies click and impression-position threshold boundaries", () => {
    const result = buildGscProtectionSnapshot(
      exportInput([
        row("/ca/encinitas/click-boundary", 1, 1, 99),
        row("/ca/encinitas/impression-boundary", 0, 100, 20),
        row("/ca/encinitas/weak-position", 0, 100, 20.01),
        row("/ca/encinitas/weak-impressions", 0, 99, 1),
        row("/learn/not-a-supported-family", 20, 10_000, 1),
      ]),
    );

    expect(result.entries.map((entry) => entry.canonicalPath)).toEqual([
      "/ca/encinitas/click-boundary",
      "/ca/encinitas/impression-boundary",
    ]);
  });

  it("canonicalizes, merges, deduplicates, and sorts rows deterministically", () => {
    const result = buildGscProtectionSnapshot(
      exportInput(
        [
          row("https://www.quiversurf.app/beach/swamis", 1, 10, 9),
          row("/ca/encinitas/swamis", 2, 90, 11),
          row("/best-time-to-surf/la-jolla", 1, 25, 8),
        ],
        ["/ca/encinitas/swamis"],
      ),
    );

    expect(result).toEqual({
      policyVersion: GSC_PROTECTION_POLICY_VERSION,
      window: { start: "2026-06-20", end: "2026-07-17" },
      thresholds: {
        minimumClicks: 1,
        minimumImpressions: 100,
        maximumAveragePosition: 20,
      },
      entries: [
        {
          canonicalPath: "/best-time-to-surf/la-jolla",
          pageFamily: "best-time-city",
          clicks: 1,
          impressions: 25,
          averagePosition: 8,
        },
        {
          canonicalPath: "/ca/encinitas/swamis",
          pageFamily: "beach",
          clicks: 3,
          impressions: 100,
          averagePosition: 10.8,
        },
      ],
    });
  });

  it("reports rolling additions and removals", () => {
    const previous = snapshot([
      "/ca/encinitas/swamis/tides",
      "/best-time-to-surf/la-jolla",
    ]);
    const next = snapshot([
      "/best-time-to-surf/la-jolla",
      "/water-temp/santa-cruz",
    ]);

    expect(diffGscProtectionSnapshots(previous, next)).toEqual({
      added: ["/water-temp/santa-cruz"],
      removed: ["/ca/encinitas/swamis/tides"],
    });
  });

  it("loads the checked-in reviewed snapshot for runtime decisions", () => {
    expect(
      isGscPerformanceProtected("/ca/encinitas/swamis/water-temp"),
    ).toBe(true);
    expect(isGscPerformanceProtected("/support")).toBe(false);
  });
});

function row(
  page: string,
  clicks: number,
  impressions: number,
  position: number,
) {
  return { page, clicks, impressions, position };
}

function exportInput(
  last28d: GscExportInput["last28d"],
  sitemapPaths: string[] = [],
): GscExportInput {
  return {
    generatedAt: "2026-07-20T15:04:03Z",
    siteUrl: "https://www.quiversurf.app",
    dateRanges: {
      last7d: { start: "2026-07-11", end: "2026-07-17" },
      prior7d: { start: "2026-07-04", end: "2026-07-10" },
      last28d: { start: "2026-06-20", end: "2026-07-17" },
    },
    last7d: [],
    prior7d: [],
    last28d,
    sitemapPaths,
    topQueries: [],
    topPages: [],
    byDevice: [],
    byCountry: [],
  };
}

function snapshot(paths: string[]): GscProtectionSnapshot {
  return {
    policyVersion: 1,
    window: { start: "2026-06-20", end: "2026-07-17" },
    thresholds: {
      minimumClicks: 1,
      minimumImpressions: 100,
      maximumAveragePosition: 20,
    },
    entries: paths.map((canonicalPath) => ({
      canonicalPath,
      pageFamily:
        classifyGscProtectedPageFamily(canonicalPath) ?? "city-intent",
      clicks: 1,
      impressions: 1,
      averagePosition: 1,
    })),
  };
}
