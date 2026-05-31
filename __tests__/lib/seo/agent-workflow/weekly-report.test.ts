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
    expect(report).toContain("## Coverage Notes");
    expect(report).toContain("DataForSEO is not configured");
    expect(report).toContain("no automated Google SERP scraping is performed");
    expect(report).toContain("Skipped source: POSTHOG_PROJECT_ID");
    expect(report).not.toContain("## Missing Data / Limits");
  });

  it("does not list optional Ahrefs enrichment as missing", () => {
    const report = renderWeeklySeoReport({
      generatedAt: "2026-05-20T12:00:00Z",
      recommendations: [],
      missing: [],
    });

    expect(report).not.toContain("AHREFS-ENRICHMENT.json");
  });

  it("renders SEO metadata audit coverage and issues", () => {
    const report = renderWeeklySeoReport({
      generatedAt: "2026-05-20T12:00:00Z",
      recommendations: [],
      missing: [],
      metadata: {
        generatedAt: "2026-05-20T12:00:00Z",
        checkedPages: 25,
        issues: [{
          path: "/surf-cams/hawaii",
          title: "Hawaii Cams",
          titleLength: 11,
          metaDescription: "Short description.",
          metaDescriptionLength: 18,
          priority: "high",
          problems: ["title length 11 outside 30-60"],
        }],
        recommendations: [{
          id: "metadata-audit-surf-cams-hawaii",
          createdAt: "2026-05-20T12:00:00Z",
          source: "metadata-audit",
          priority: "high",
          canonicalPath: "/surf-cams/hawaii",
          summary: "SEO metadata quality gates failed.",
          evidence: ["title length 11 outside 30-60"],
          status: "open",
        }],
      },
    });

    expect(report).toContain("## SEO Metadata");
    expect(report).toContain("SEO metadata audit checked 25 indexable pages and found 1 issue.");
    expect(report).toContain("HIGH: `/surf-cams/hawaii` - SEO metadata quality gates failed.");
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
          searchVolume: 90,
          url: "https://www.swell-scope.com/",
        }],
        missing: [],
      },
    });

    expect(report).toContain("DataForSEO Google rank checks: 1/1");
    expect(report).toContain("DataForSEO ASO rank checks: 1/1");
    expect(report).toContain("DataForSEO is enabled");
    expect(report).toContain("DataForSEO Labs competitor keyword rows: 1 rows across 1 competitors");
    expect(report).not.toContain("DataForSEO is not configured");
  });

  it("renders manual backlink import coverage without calling it missing data", () => {
    const report = renderWeeklySeoReport({
      generatedAt: "2026-05-20T12:00:00Z",
      recommendations: [],
      missing: [],
      backlink: {
        generatedAt: "2026-05-20T12:00:00Z",
        referrers: [{ referrer: "reddit.com", visits: 3 }],
        embedReferrers: [{ referrer: "surf-school.example", visits: 2 }],
        outreachStatuses: [{ target: "Surf School", status: "backlink-confirmed" }],
        manualExports: [{
          source: "ahrefs-webmaster-tools",
          path: "/tmp/AHREFS-WEBMASTER-TOOLS.csv",
          rows: 3,
          uniqueReferringDomains: 2,
          sampleReferringDomains: ["surf-school.example", "tourism.example"],
          topTargetUrls: [{ url: "https://www.quiversurf.app/map", links: 2 }],
        }],
        competitorDeltas: [],
        missing: [],
      },
    });

    expect(report).toContain("Manual backlink exports imported: 1 file / 3 rows / 2 referring-domain observations");
    expect(report).toContain("Manual backlink sample domains: surf-school.example, tourism.example");
    expect(report).toContain("No paid full backlink index is configured");
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
