import { renderWeeklySeoReport } from "@/lib/seo/agent-workflow/weekly-report";

describe("SEO workflow weekly report", () => {
  it("renders required sections and free-data limitations with partial inputs", () => {
    const report = renderWeeklySeoReport({
      generatedAt: "2026-05-20T12:00:00Z",
      recommendations: [{
        id: "gsc-low-ctr-learn",
        createdAt: "2026-05-20T12:00:00Z",
        source: "gsc-decay",
        priority: "high",
        canonicalPath: "/learn/foo",
        summary: "CTR candidate.",
        evidence: ["ctr=0.5%"],
        status: "open",
      }],
      missing: ["POSTHOG_PROJECT_ID"],
    });

    expect(report).toContain("## Bottom Line");
    expect(report).toContain("## Web SEO");
    expect(report).toContain("## Native ASO");
    expect(report).toContain("No paid SERP API is configured");
    expect(report).toContain("No automated Google SERP scraping is performed");
    expect(report).toContain("Missing/skipped: POSTHOG_PROJECT_ID");
  });

  it("does not list optional Ahrefs enrichment as missing", () => {
    const report = renderWeeklySeoReport({
      generatedAt: "2026-05-20T12:00:00Z",
      recommendations: [],
      missing: [],
    });

    expect(report).not.toContain("AHREFS-ENRICHMENT.json");
  });

  it("renders DataForSEO rank and ASO coverage when available", () => {
    const report = renderWeeklySeoReport({
      generatedAt: "2026-05-20T12:00:00Z",
      recommendations: [],
      missing: [],
      dataforseo: {
        generatedAt: "2026-05-20T12:00:00Z",
        googleRankings: [{
          keyword: "surf forecast app",
          location: "United States",
          locationCode: 2840,
          languageCode: "en",
          device: "mobile",
          depth: 100,
          quiverRank: 7,
          quiverUrl: "https://www.quiversurf.app/",
          topCompetitors: [{ domain: "surfline.com", rank: 1 }],
        }],
        asoRankings: [{
          keyword: "surf forecast",
          platform: "ios",
          location: "United States",
          depth: 100,
          quiverRank: 12,
          topCompetitors: [{ app: "Lazy Surfer", appId: "1450887020", rank: 1 }],
        }],
        competitorKeywords: [{
          competitor: "Swell Scope",
          domain: "swell-scope.com",
          keyword: "custom surf forecast",
          rank: 6,
        }],
        missing: [],
      },
    });

    expect(report).toContain("DataForSEO Google rank checks: 1/1");
    expect(report).toContain("DataForSEO ASO rank checks: 1/1");
    expect(report).toContain("Paid SERP/API source: DataForSEO is enabled");
    expect(report).not.toContain("No paid SERP API is configured");
  });

  it("renders canonical action paths while retaining legacy raw-path evidence", () => {
    const report = renderWeeklySeoReport({
      generatedAt: "2026-05-20T12:00:00Z",
      recommendations: [{
        id: "gsc-low-ctr-ca-ventura-c-street-ventura-ca",
        createdAt: "2026-05-20T12:00:00Z",
        source: "gsc-decay",
        priority: "high",
        canonicalPath: "/ca/ventura/c-street-ventura-ca",
        summary: "CTR candidate.",
        evidence: [
          "28d=0 clicks/641 impressions",
          "rawPaths=/beach/c-street-ventura-ca -> /ca/ventura/c-street-ventura-ca",
        ],
        status: "open",
      }],
      missing: [],
    });

    expect(report).toContain("`/ca/ventura/c-street-ventura-ca`");
    expect(report).toContain(
      "rawPaths=/beach/c-street-ventura-ca -> /ca/ventura/c-street-ventura-ca",
    );
  });
});
