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
    expect(report).toContain("Product-fit competitor keyword opportunities by volume");
    expect(report).not.toContain("DataForSEO is not configured");
  });

  it("prioritizes product-led opportunities over commodity fact queries", () => {
    const report = renderWeeklySeoReport({
      generatedAt: "2026-05-20T12:00:00Z",
      recommendations: [],
      missing: [],
      gsc: {
        generatedAt: "2026-05-20T12:00:00Z",
        siteUrl: "https://www.quiversurf.app",
        dateRanges: {
          last7d: { start: "2026-05-13", end: "2026-05-20" },
          prior7d: { start: "2026-05-06", end: "2026-05-12" },
          last28d: { start: "2026-04-22", end: "2026-05-20" },
        },
        last7d: [],
        prior7d: [],
        last28d: [],
        sitemapPaths: [],
        topQueries: [],
        topPages: [{
          page: "/water-temp/huntington-beach",
          clicks: 20,
          impressions: 4000,
          position: 7,
        }, {
          page: "/best-time-to-surf/cocoa-beach",
          clicks: 2,
          impressions: 442,
          position: 6.4,
        }, {
          page: "/dawn-patrol/san-francisco",
          clicks: 2,
          impressions: 55,
          position: 9,
        }],
        byDevice: [],
        byCountry: [],
      },
      dataforseo: {
        generatedAt: "2026-05-20T12:00:00Z",
        googleRankings: [],
        asoRankings: [{
          keyword: "surf session",
          platform: "ios",
          location: "United States",
          depth: 100,
          quiverRank: null,
          topCompetitors: [{ app: "Surfmore", rank: 1 }],
        }],
        competitorKeywords: [{
          competitor: "Lazy Surfer",
          domain: "lazysurfer.app",
          keyword: "history of surfing",
          rank: 66,
          searchVolume: 14800,
        }, {
          competitor: "Swellify",
          domain: "swellify.app",
          keyword: "swell period",
          rank: 8,
          searchVolume: 1200,
        }],
        missing: [],
      },
    });

    expect(report).toContain("## Product-Led SEO Opportunities");
    expect(report).toContain("Best-time planning: `/best-time-to-surf/cocoa-beach`");
    expect(report).toContain("Dawn patrol planning: `/dawn-patrol/san-francisco`");
    expect(report).toContain('ASO product wedge: "surf session"');
    expect(report).toContain('Competitor-inspired content: "swell period"');
    expect(report).toContain("## Do Not Chase");
    expect(report).toContain("Commodity fact page: `/water-temp/huntington-beach`");
    expect(report).toContain('Low-fit competitor keyword: "history of surfing"');
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
