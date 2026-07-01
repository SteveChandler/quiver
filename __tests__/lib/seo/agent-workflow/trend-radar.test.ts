import { createEmptyDashboard, upsertSeoEntry } from "@/lib/seo/agent-workflow/dashboard";
import {
  buildTrendRadarReport,
  parseManualTrendImportText,
} from "@/lib/seo/agent-workflow/trend-radar";
import type { SeoDashboardEntry } from "@/lib/seo/agent-workflow/types";

const NOW = "2026-06-30T12:00:00.000Z";

describe("SEO workflow trend radar", () => {
  it("turns GSC query deltas and manual Trends rows into review-only candidates", () => {
    const dashboard = upsertSeoEntry(
      createEmptyDashboard(NOW),
      entry("/learn/best-tide-for-surfing", "best tide for surfing"),
      NOW,
    );

    const report = buildTrendRadarReport({
      generatedAt: NOW,
      dashboard,
      gsc: {
        currentQueries: [
          { query: "el nino surf forecast", clicks: 9, impressions: 320, position: 7.4 },
          { query: "best tide for surfing", clicks: 2, impressions: 170, position: 9.1 },
          { query: "world cup schedule", clicks: 0, impressions: 800, position: 4 },
        ],
        priorQueries: [
          { query: "el nino surf forecast", clicks: 0, impressions: 12, position: 41 },
          { query: "best tide for surfing", clicks: 1, impressions: 65, position: 13.5 },
        ],
      },
      manualTrends: [{
        query: "El Niño surf",
        region: "US-CA",
        traffic: 2400,
        source: "google-trends-rss",
        url: "https://trends.google.com/trending/rss",
      }],
    });

    expect(report.generatedAt).toBe(NOW);
    expect(report.candidates.map((candidate) => candidate.query)).toEqual([
      "el nino surf forecast",
      "best tide for surfing",
    ]);

    expect(report.candidates[0]).toMatchObject({
      action: "new-guide",
      canonicalPath: "/learn/el-nino-surf-impact",
      priority: "high",
      sources: ["gsc-query", "manual-trends"],
      relatedQueries: ["el nino surf forecast", "El Niño surf"],
    });
    expect(report.candidates[0]?.evidence).toEqual(expect.arrayContaining([
      "gscCurrent=9 clicks/320 impressions",
      "gscPrior=0 clicks/12 impressions",
      "gscImpressionDelta=+308",
      "manualTrend=2400 traffic in US-CA",
    ]));

    expect(report.candidates[1]).toMatchObject({
      action: "refresh",
      canonicalPath: "/learn/best-tide-for-surfing",
      priority: "medium",
    });

    expect(report.ignored).toEqual([{
      query: "world cup schedule",
      reason: "not surf/ocean relevant",
      sources: ["gsc-query"],
    }]);
    expect(report.guardrails).toContain("Report-only output; do not publish pages directly from trend candidates.");
    expect(report.guardrails).toContain("DataForSEO is intentionally excluded from this radar.");
  });

  it("parses manual Google Trends CSV and RSS exports", () => {
    const csvRows = parseManualTrendImportText(
      [
        "query,traffic,region,url",
        "\"El Niño surf\",2.4K+,US-CA,https://example.com/el-nino",
        "hurricane swell,900,US-FL,https://example.com/hurricane",
      ].join("\n"),
      "manual-trends.csv",
    );

    expect(csvRows).toEqual([
      {
        query: "El Niño surf",
        traffic: 2400,
        region: "US-CA",
        source: "google-trends-csv",
        url: "https://example.com/el-nino",
      },
      {
        query: "hurricane swell",
        traffic: 900,
        region: "US-FL",
        source: "google-trends-csv",
        url: "https://example.com/hurricane",
      },
    ]);

    const rssRows = parseManualTrendImportText(
      [
        "<rss><channel>",
        "<item>",
        "<title>water temp surfing</title>",
        "<ht:approx_traffic>1K+</ht:approx_traffic>",
        "<ht:news_item_url>https://example.com/water-temp</ht:news_item_url>",
        "</item>",
        "</channel></rss>",
      ].join(""),
      "trending.xml",
    );

    expect(rssRows).toEqual([{
      query: "water temp surfing",
      traffic: 1000,
      source: "google-trends-rss",
      url: "https://example.com/water-temp",
    }]);
  });

  it("maps known Quiver intent query families to existing route patterns", () => {
    const report = buildTrendRadarReport({
      generatedAt: NOW,
      dashboard: createEmptyDashboard(NOW),
      gsc: {
        currentQueries: [{
          query: "huntington beach water temp",
          clicks: 11,
          impressions: 1040,
          position: 4.2,
        }],
        priorQueries: [{
          query: "huntington beach water temp",
          clicks: 5,
          impressions: 794,
          position: 5.1,
        }],
      },
    });

    expect(report.candidates[0]).toMatchObject({
      action: "refresh",
      canonicalPath: "/water-temp/huntington-beach",
    });
    expect(report.candidates[0]?.evidence).toContain("existingRouteFamily=water-temp");
  });
});

function entry(canonicalPath: string, targetKeyword: string): SeoDashboardEntry {
  return {
    id: `entry-${canonicalPath}`,
    canonicalPath,
    pageType: "learn",
    targetKeyword,
    status: "covered",
    cluster: {
      primaryKeyword: targetKeyword,
      secondarySemantics: [],
      intendedHeadings: [],
      linkedUrls: [],
    },
    recommendations: [],
  };
}
