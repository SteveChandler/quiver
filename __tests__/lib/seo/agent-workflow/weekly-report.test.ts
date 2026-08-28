import {
  buildWeeklySeoComparison,
  renderWeeklySeoReport,
} from "@/lib/seo/agent-workflow/weekly-report";

function extractSection(report: string, heading: string): string {
  const start = report.indexOf(heading);
  if (start === -1) return "";

  const nextHeading = report.indexOf("\n## ", start + heading.length);
  return nextHeading === -1 ? report.slice(start) : report.slice(start, nextHeading);
}

describe("SEO workflow weekly report", () => {
  it("renders source freshness, week-over-week movement, and Ahrefs issues under technical health", () => {
    const report = renderWeeklySeoReport({
      generatedAt: "2026-08-10T12:00:00Z",
      auditDate: "2026-08-10",
      recommendations: [{
        id: "ahrefs-missing-alt-text-root",
        createdAt: "2026-08-10T12:00:00Z",
        source: "ahrefs-audit",
        priority: "medium",
        canonicalPath: "/",
        summary: "Ahrefs found missing alt text on 299 crawled URLs.",
        evidence: ["affectedUrls=299"],
        status: "open",
      }],
      sourceFreshness: [{
        source: "Competitor deep-dive",
        observedAt: "2026-07-27",
        status: "stale",
        note: "run date 2026-07-27 (14 days old)",
      }],
      weekOverWeek: {
        previousAuditDate: "2026-08-03",
        metrics: [{
          label: "GSC clicks (28d vs prior report)",
          current: 998,
          previous: 1034,
          unit: "clicks",
        }],
      },
      technical: [],
      missing: [],
    });

    expect(report).toContain("## Source Freshness");
    expect(report).toContain("Competitor deep-dive: STALE (2026-07-27)");
    expect(report).toContain("## Week-over-Week Movement");
    expect(report).toContain("GSC clicks (28d vs prior report): 998 clicks; prior 1,034; change -36 (-3.5%).");
    expect(extractSection(report, "## Technical Crawl Health")).toContain(
      "MEDIUM: `/` - Ahrefs found missing alt text on 299 crawled URLs.",
    );
    expect(report).not.toContain("No technical crawl issues in available inputs.");
  });

  // Site-audit findings previously matched both the technical merge and the
  // keyword-movement filter, so every one of them printed twice in the report.
  it("routes each ahrefs-audit finding to exactly one section", () => {
    const base = {
      createdAt: "2026-08-10T12:00:00Z",
      source: "ahrefs-audit" as const,
      priority: "medium" as const,
      canonicalPath: "/",
      evidence: [],
      status: "open" as const,
    };
    const report = renderWeeklySeoReport({
      generatedAt: "2026-08-10T12:00:00Z",
      auditDate: "2026-08-10",
      recommendations: [
        { ...base, id: "ahrefs-noindex-sitemap", summary: "SITE_AUDIT_FINDING" },
        {
          ...base,
          id: "ahrefs-keyword-gap",
          summary: "KEYWORD_FINDING",
          targetKeyword: "surf report san diego",
        },
      ],
      technical: [],
      missing: [],
    });

    const technicalSection = extractSection(report, "## Technical Crawl Health");
    const keywordSection = extractSection(report, "## Keyword / Ranking Movement");

    // A finding with no target keyword belongs to technical health only.
    expect(technicalSection).toContain("SITE_AUDIT_FINDING");
    expect(keywordSection).not.toContain("SITE_AUDIT_FINDING");

    // A keyword-targeted finding belongs to ranking movement only.
    expect(keywordSection).toContain("KEYWORD_FINDING");
    expect(technicalSection).not.toContain("KEYWORD_FINDING");

    // Belt and braces: neither summary appears more than once in the whole report.
    expect(report.split("SITE_AUDIT_FINDING").length - 1).toBe(1);
    expect(report.split("KEYWORD_FINDING").length - 1).toBe(1);
  });

  it("builds seven-day week-over-week metrics from the current GSC export", () => {
    const comparison = buildWeeklySeoComparison({
      generatedAt: "2026-08-10T12:00:00Z",
      recommendations: [],
      missing: [],
      gsc: {
        generatedAt: "2026-08-10T12:00:00Z",
        siteUrl: "https://www.quiversurf.app/",
        dateRanges: {
          last7d: { start: "2026-08-04", end: "2026-08-10" },
          prior7d: { start: "2026-07-28", end: "2026-08-03" },
          last28d: { start: "2026-07-14", end: "2026-08-10" },
        },
        last7d: [{ page: "/", clicks: 12, impressions: 120 }],
        prior7d: [{ page: "/", clicks: 8, impressions: 100 }],
        last28d: [],
        sitemapPaths: [],
        topQueries: [],
        topPages: [],
        byDevice: [],
        byCountry: [],
      },
    });

    expect(comparison?.metrics).toEqual(expect.arrayContaining([
      { label: "GSC clicks (last 7d vs prior 7d)", current: 12, previous: 8, unit: "clicks" },
      { label: "GSC impressions (last 7d vs prior 7d)", current: 120, previous: 100, unit: "impressions" },
    ]));
  });

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
    expect(report).toContain("## CTR Cohort Monitoring");
    expect(report).toContain("## Google Indexing Health");
    expect(report).toContain("## AI Citation / AEO Signals");
    expect(report).toContain("## Outreach Queue");
    expect(report).toContain("## Competitor Technical Surfaces");
    expect(report).toContain("## Native ASO");
    expect(report).toContain("## Execution Plan This Week");
    expect(report).toContain("## Coverage Notes");
    expect(report).toContain("DataForSEO is not configured");
    expect(report).toContain("no automated Google SERP scraping is performed");
    expect(report).toContain("Skipped source: POSTHOG_PROJECT_ID");
    expect(report).not.toContain("## Missing Data / Limits");
  });

  it("renders verified Google crawl and indexing blockers separately from GSC performance data", () => {
    const report = renderWeeklySeoReport({
      generatedAt: "2026-07-14T12:00:00Z",
      recommendations: [],
      missing: [],
      gsc: {
        generatedAt: "2026-07-14T12:00:00Z",
        siteUrl: "https://www.quiversurf.app/",
        dateRanges: {
          last7d: { start: "2026-07-05", end: "2026-07-11" },
          prior7d: { start: "2026-06-28", end: "2026-07-04" },
          last28d: { start: "2026-06-14", end: "2026-07-11" },
        },
        last7d: [],
        prior7d: [],
        last28d: [],
        sitemapPaths: [],
        topQueries: [],
        topPages: [],
        byDevice: [],
        byCountry: [],
        indexing: {
          generatedAt: "2026-07-14T12:00:00Z",
          watchlistPath: "docs/seo/gsc-indexing-watchlist.json",
          results: [{
            canonicalPath: "/beaches/mexico",
            label: "Mexico location hub",
            coverageState: "Discovered - currently not indexed",
          }, {
            canonicalPath: "/mexico/baja-california/rosarito/el-morro",
            coverageState: "URL is unknown to Google",
          }],
        },
      },
    });

    const indexing = extractSection(report, "## Google Indexing Health");
    expect(indexing).toContain("Read-only URL Inspection checked 2 configured high-value URLs");
    expect(indexing).toContain("HIGH: `/beaches/mexico`");
    expect(indexing).toContain("Discovered - currently not indexed");
    expect(indexing).toContain("URL is unknown to Google");
  });

  it("renders CTR cohorts as monitoring evidence instead of weekly actions", () => {
    const report = renderWeeklySeoReport({
      generatedAt: "2026-07-14T12:00:00Z",
      recommendations: [{
        id: "gsc-ctr-monitor-surf-report-newport-beach-today",
        createdAt: "2026-07-14T12:00:00Z",
        source: "gsc-decay",
        priority: "low",
        canonicalPath: "/surf-report/newport-beach-today",
        targetKeyword: "Newport Beach surf-report owner",
        summary: "CTR monitor: retain the current page treatment and observe the next 28-day GSC window.",
        evidence: [
          "28d=0 clicks/9 impressions",
          "ctr=0.00%",
          "avgPosition=11.0",
          "monitorUntil=2026-07-26",
          "reason=New owner route needs a fully post-change window.",
        ],
        status: "open",
      }],
      missing: [],
    });

    const monitoring = extractSection(report, "## CTR Cohort Monitoring");
    const actions = extractSection(report, "## Actions This Week");
    expect(monitoring).toContain("Monitor-only: `/surf-report/newport-beach-today` (Newport Beach surf-report owner)");
    expect(monitoring).toContain("28d=0 clicks/9 impressions");
    expect(actions).not.toContain("newport-beach-today");
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
          serpFeatures: [
            { type: "ai_overview", rank: 1 },
            { type: "people_also_ask", rank: 2 },
          ],
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
        keywordMetrics: [{
          keyword: "surf forecast app",
          location: "United States",
          locationCode: 2840,
          languageCode: "en",
          searchVolume: 720,
          competitionLevel: "LOW",
          trend: { monthly: 8, quarterly: 3, yearly: 24 },
          intent: { main: "commercial", foreign: ["informational"] },
        }],
        missing: [],
      },
    });

    expect(report).toContain("DataForSEO Google rank checks: 1/1");
    expect(report).toContain('SERP feature pressure: "surf forecast app" has ai_overview, people_also_ask');
    expect(report).toContain('DataForSEO keyword metrics: "surf forecast app" vol 720, intent commercial, trend monthly +8%');
    expect(report).toContain("DataForSEO ASO rank checks: 1/1");
    expect(report).toContain("DataForSEO is enabled");
    expect(report).toContain("DataForSEO Labs actionable competitor keyword rows: 1 rows from 1 raw rows across 1 competitors");
    expect(report).toContain("Product-fit competitor keyword opportunities by volume");
    expect(report).not.toContain("DataForSEO is not configured");
  });

  it("renders AEO and competitor technical sections when structured inputs are available", () => {
    const report = renderWeeklySeoReport({
      generatedAt: "2026-06-28T12:00:00Z",
      recommendations: [],
      missing: [],
      aeo: {
        generatedAt: "2026-06-28T12:00:00Z",
        aiReferrers: [{ referrer: "perplexity.ai", visits: 3 }],
        engines: [
          { engine: "chatgpt", citations: 53, pages: 26 },
          { engine: "perplexity", citations: 7, pages: 3 },
        ],
        citationDomains: [{ domain: "grokipedia.com", links: 1, domainRating: 77 }],
        llmsFiles: [
          { path: "/repo/public/llms.txt", exists: true, lines: 10, bytes: 100 },
          { path: "/repo/public/llms-full.txt", exists: true, lines: 40, bytes: 400 },
        ],
      },
      competitor: {
        generatedAt: "2026-06-28T12:00:00Z",
        runId: "20260628T235143Z",
        technicalSurfaces: [{
          competitor: "Swellify",
          robotsStatus: 200,
          sitemapStatus: 200,
          sitemapCount: 507,
          schemaSupport: "missing",
          notes: ["SEO footprint unchanged: robots `200`, sitemap `200`, `507` URLs, no raw-HTML schema markers."],
        }],
        comparisonSignals: [{
          competitor: "Lazy Surfer",
          summary: "Comparison page is live.",
          url: "https://lazysurfer.app/compare/quiver.html",
        }],
        materialDeltas: ["Lazy Surfer comparison page confirmed."],
      },
    });

    expect(report).toContain("llms inventory:");
    expect(report).toContain("AI referrers seen in Vercel: perplexity.ai=3");
    expect(report).toContain("Ahrefs AI citation snapshot: chatgpt=53 citations/26 pages, perplexity=7 citations/3 pages");
    expect(report).toContain("Swellify: robots 200; sitemap 200; 507 sitemap URLs; no raw HTML schema markers.");
    expect(report).toContain("Structured competitor report (20260628T235143Z): Lazy Surfer comparison page confirmed.");
    expect(report).toContain("AEO coverage combines llms inventory, AI referrer traffic, Ahrefs AI citation snapshots, and the latest citation-tracking baseline when present.");
  });

  it("renders partial DataForSEO coverage distinctly from missing config", () => {
    const report = renderWeeklySeoReport({
      generatedAt: "2026-07-08T12:00:00Z",
      recommendations: [],
      missing: [],
      dataforseo: {
        generatedAt: "2026-07-08T12:00:00Z",
        status: "timed_out",
        completedPhases: ["googleRankings"],
        failedPhases: ["asoRankings"],
        deadlineReached: true,
        watchlistMode: "live",
        googleRankings: [{
          keyword: "surf forecast app",
          location: "United States",
          locationCode: 2840,
          languageCode: "en",
          device: "mobile",
          depth: 100,
          quiverRank: 7,
          topCompetitors: [],
        }],
        asoRankings: [],
        competitorKeywords: [],
        keywordMetrics: [],
        missing: ["DataForSEO deadline reached during asoRankings"],
      },
    });

    expect(report).toContain("DataForSEO timed_out: 1 Google rank checks, 0 ASO rank checks, 0 competitor keyword rows.");
    expect(report).toContain("DataForSEO is configured but timed_out; completed phases: googleRankings; failed phases: asoRankings.");
    expect(report).not.toContain("DataForSEO is not configured");
  });

  it("renders AEO citation baseline and backlink target reports", () => {
    const report = renderWeeklySeoReport({
      generatedAt: "2026-07-06T12:00:00Z",
      recommendations: [],
      missing: [],
      aeo: {
        generatedAt: "2026-07-06T12:00:00Z",
        aiReferrers: [],
        engines: [],
        citationDomains: [],
        llmsFiles: [{ path: "/repo/public/llms.txt", exists: true, lines: 79, bytes: 100 }],
        narrativeBaseline: {
          reportDate: "2026-06-15",
          reportPath: "docs/seo/reports/aeo-citation-tracking/2026-06-15.md",
          status: "user-provided pending validation",
          overall: { segment: "All queries", cited: 5, total: 30, rate: 0.167 },
          segments: [{ segment: "Informational queries", cited: 2, total: 20, rate: 0.1 }],
        },
      },
      backlink: {
        generatedAt: "2026-07-06T12:00:00Z",
        referrers: [],
        embedReferrers: [],
        outreachStatuses: [],
        manualExports: [],
        narrativeTargets: {
          reportDate: "2026-06-15",
          reportPath: "docs/seo/backlink-reports/2026-06-15.md",
          confirmed: [{ target: "UMass Lowell", status: "confirmed" }],
          unverified: [{ target: "Surfrider Central Texas", status: "unverified" }],
        },
      },
    });

    expect(report).toContain("Citation baseline (2026-06-15): 16.7% (5/30) of tracked AEO queries cite Quiver [user-provided pending validation].");
    expect(report).toContain("Baseline by segment: Informational queries 10% (2/20).");
    expect(report).toContain("Backlink target report (2026-06-15): 1 confirmed, 1 unverified targets.");
    expect(report).toContain("Confirmed replacement-link targets: UMass Lowell.");
  });

  it("renders the outreach queue digest", () => {
    const report = renderWeeklySeoReport({
      generatedAt: "2026-07-06T12:00:00Z",
      recommendations: [],
      missing: [],
      outreach: {
        generatedAt: "2026-07-06T12:00:00Z",
        reportDate: "2026-07-06",
        rotationWeek: 1,
        rotationCategory: "surf-schools",
        statusCounts: { queued: 4, sent: 1 },
        totalRows: 5,
        candidates: [{
          target: "Surf Diva",
          category: "surf-schools",
          website: "surfdiva.com",
          requiresContactResearch: false,
          nearestBeach: "La Jolla",
          subject: "Free ML surf forecasts for your La Jolla crew",
          body: "Hi Surf Diva team,",
        }],
      },
    });

    expect(report).toContain("## Outreach Queue");
    expect(report).toContain("Rotation week 1: surf schools.");
    expect(report).toContain('Surf Diva (surfdiva.com) - subject: "Free ML surf forecasts for your La Jolla crew"');
    expect(report).toContain("Live action: research missing contacts, create Gmail drafts only after verifying a direct email");
    expect(report).toContain("Outreach coverage reads docs/seo/outreach-tracker.md: week-1 rotation, 1 draft candidate proposed.");
  });

  it("reports candidates that require contact research before Gmail drafting", () => {
    const report = renderWeeklySeoReport({
      generatedAt: "2026-07-06T12:00:00Z",
      recommendations: [],
      missing: [],
      outreach: {
        generatedAt: "2026-07-06T12:00:00Z",
        reportDate: "2026-07-06",
        rotationWeek: 1,
        rotationCategory: "surf-schools",
        statusCounts: { queued: 2 },
        totalRows: 2,
        candidates: [{
          target: "North Shore Surf Girls",
          category: "surf-schools",
          website: "northshoresurfgirls.com",
          contact: "808-637-2977",
          requiresContactResearch: true,
          subject: "Free ML surf forecasts",
          body: "Hi North Shore Surf Girls team,",
        }],
        missing: [],
      },
    });

    expect(report).toContain(
      "1 candidate requires contact research before Gmail drafting.",
    );
    expect(report).toContain("North Shore Surf Girls (contact research required)");
    expect(report).not.toContain("No queued targets in this week's rotation category; nothing to draft.");
  });

  it("turns weekly actions into an ordered execution plan", () => {
    const report = renderWeeklySeoReport({
      generatedAt: "2026-06-29T12:00:00Z",
      recommendations: [{
        id: "gsc-best-time-la-jolla",
        createdAt: "2026-06-29T12:00:00Z",
        source: "gsc-decay",
        priority: "high",
        canonicalPath: "/best-time-to-surf/la-jolla",
        summary: "CTR candidate: page has meaningful impressions but weak clicks.",
        evidence: ["28d=2 clicks/5857 impressions", "ctr=0.03%"],
        status: "open",
      }],
      missing: [],
      store: {
        generatedAt: "2026-06-29T12:00:00Z",
        listings: [{
          app: "Quiver",
          platform: "ios",
          url: "https://apps.apple.com/us/app/quiver/id6759300320",
          title: "Surf Forecast: Quiver",
          version: "1.0.1",
          priceEvidence: [],
          metadataDrift: ["Unexpected live title: Surf Forecast: Quiver"],
        }],
        competitorDeltas: [],
      },
      competitor: {
        generatedAt: "2026-06-29T12:00:00Z",
        runId: "20260628T235143Z",
        technicalSurfaces: [],
        comparisonSignals: [{
          competitor: "Lazy Surfer",
          summary: "Comparison page is live at compare/quiver.html and attacks on platform coverage.",
        }],
        materialDeltas: [],
        missing: [],
      },
    });

    expect(report).toContain("## Execution Plan This Week");
    expect(report).toContain("1. Day 1:");
    expect(report).not.toContain("Respond to Lazy Surfer comparison-page claims.");
    expect(report).toContain("2. Day 2: [ASO] Resolve Quiver App Store listing drift.");
    expect(report).toContain("End of week: rerun the weekly SEO + ASO report");
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

  it("filters low-intent competitor keyword noise before summarizing opportunities", () => {
    const report = renderWeeklySeoReport({
      generatedAt: "2026-05-20T12:00:00Z",
      recommendations: [],
      missing: [],
      dataforseo: {
        generatedAt: "2026-05-20T12:00:00Z",
        googleRankings: [],
        asoRankings: [],
        competitorKeywords: [{
          competitor: "Surfline",
          domain: "surfline.com",
          keyword: "moana",
          rank: 3,
          searchVolume: 200000,
        }, {
          competitor: "Surfline",
          domain: "surfline.com",
          keyword: "winter weather warning",
          rank: 6,
          searchVolume: 110000,
        }, {
          competitor: "Surfline",
          domain: "surfline.com",
          keyword: "juno email",
          rank: 7,
          searchVolume: 90000,
        }, {
          competitor: "Swellify",
          domain: "swellify.app",
          keyword: "wave period",
          rank: 4,
          searchVolume: 1200,
        }],
        missing: [],
      },
    });

    expect(report).toContain("DataForSEO Labs actionable competitor keyword rows: 1 rows from 4 raw rows");
    expect(report).toContain('"wave period"');
    expect(report).not.toContain("moana");
    expect(report).not.toContain("winter weather warning");
    expect(report).not.toContain("juno email");
  });

  it("uses volume within product-led competitor topic clusters before fit-score tie breaks", () => {
    const report = renderWeeklySeoReport({
      generatedAt: "2026-05-20T12:00:00Z",
      recommendations: [],
      missing: [],
      dataforseo: {
        generatedAt: "2026-05-20T12:00:00Z",
        googleRankings: [],
        asoRankings: [],
        competitorKeywords: [{
          competitor: "Lazy Surfer",
          domain: "lazysurfer.app",
          keyword: "best tide for surfing",
          rank: 7,
          searchVolume: 90,
        }, {
          competitor: "Swellify",
          domain: "swellify.app",
          keyword: "wave period",
          rank: 4,
          searchVolume: 1200,
        }],
        missing: [],
      },
    });

    const productLedSection = extractSection(report, "## Product-Led SEO Opportunities");
    const wavePeriodIndex = productLedSection.indexOf('Competitor-inspired content: "wave period"');
    const bestTideIndex = productLedSection.indexOf('Competitor-inspired content: "best tide for surfing"');

    expect(wavePeriodIndex).toBeGreaterThan(-1);
    expect(bestTideIndex).toBeGreaterThan(-1);
    expect(wavePeriodIndex).toBeLessThan(bestTideIndex);
  });

  it("filters noisy competitor rows before using them for topic selection", () => {
    const report = renderWeeklySeoReport({
      generatedAt: "2026-05-20T12:00:00Z",
      recommendations: [],
      missing: [],
      dataforseo: {
        generatedAt: "2026-05-20T12:00:00Z",
        googleRankings: [],
        asoRankings: [],
        competitorKeywords: [{
          competitor: "Lazy Surfer",
          domain: "lazysurfer.app",
          keyword: "best tide for surf fishing",
          rank: 86,
          searchVolume: 12000,
          url: "https://lazysurfer.app/blog/how-to-shred-surf-using-the-tides/",
        }, {
          competitor: "Swellify",
          domain: "swellify.app",
          keyword: "what is a good swell period for boating",
          rank: 12,
          searchVolume: 8000,
          url: "https://www.swellify.app/learn/fundamentals/swell-period",
        }, {
          competitor: "Swellify",
          domain: "swellify.app",
          keyword: "wave period",
          rank: 4,
          searchVolume: 1200,
          url: "https://www.swellify.app/learn/fundamentals/swell-period",
        }],
        missing: [],
      },
    });

    const productLedSection = extractSection(report, "## Product-Led SEO Opportunities");

    expect(productLedSection).toContain('Competitor-inspired content: "wave period"');
    expect(productLedSection).not.toContain("best tide for surf fishing");
    expect(productLedSection).not.toContain("what is a good swell period for boating");
    expect(report).toContain('Low-fit competitor keyword: "best tide for surf fishing"');
    expect(report).toContain('Low-fit competitor keyword: "what is a good swell period for boating"');
  });

  it("excludes ambiguous ASO keyword 'quiver' from clean brand-health rank counts", () => {
    const report = renderWeeklySeoReport({
      generatedAt: "2026-05-20T12:00:00Z",
      recommendations: [],
      missing: [],
      dataforseo: {
        generatedAt: "2026-05-20T12:00:00Z",
        googleRankings: [],
        asoRankings: [{
          keyword: "quiver",
          platform: "ios",
          location: "United States",
          depth: 100,
          quiverRank: null,
          topCompetitors: [{ app: "Quiver: Intimacy Fitness", appId: "123", rank: 1 }],
        }, {
          keyword: "quiver surf app",
          platform: "ios",
          location: "United States",
          depth: 100,
          quiverRank: 2,
          topCompetitors: [{ app: "Surfline", appId: "456", rank: 1 }],
        }],
        competitorKeywords: [],
        missing: [],
      },
    });

    expect(report).toContain("DataForSEO ASO rank checks: 1/1 clean tracked store searches found Quiver");
    expect(report).toContain('Ambiguous ASO keyword excluded: "quiver"; top result=Quiver: Intimacy Fitness.');
    expect(report).toContain('DataForSEO ios: "quiver surf app" - Quiver rank 2');
  });

  it("does not label low-fit-only competitor keywords as product-fit", () => {
    const report = renderWeeklySeoReport({
      generatedAt: "2026-05-20T12:00:00Z",
      recommendations: [],
      missing: [],
      dataforseo: {
        generatedAt: "2026-05-20T12:00:00Z",
        googleRankings: [],
        asoRankings: [],
        competitorKeywords: [{
          competitor: "Lazy Surfer",
          domain: "lazysurfer.app",
          keyword: "history of surfing",
          rank: 4,
          searchVolume: 14800,
        }],
        missing: [],
      },
    });

    expect(report).not.toContain("Product-fit competitor keyword opportunities");
    expect(report).toContain("DataForSEO Labs actionable competitor keyword rows: 0 rows from 1 raw rows after surf/app/forecast intent filtering.");
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
        missing: [],
      },
    });

    expect(report).toContain("Manual backlink exports imported: 1 file / 3 rows / 2 referring-domain observations");
    expect(report).toContain("Manual backlink sample domains: surf-school.example, tourism.example");
    expect(report).toContain("No paid full backlink index is configured");
  });

  it("renders structured competitor deltas without leaking raw bullet formatting", () => {
    const report = renderWeeklySeoReport({
      generatedAt: "2026-05-20T12:00:00Z",
      recommendations: [],
      missing: [],
      store: {
        generatedAt: "2026-05-20T12:00:00Z",
        listings: [],
        competitorDeltas: [{
          source: "competitor-report",
          runId: "20260620T202412Z",
          summary: "- Swellify IAP evidence now includes $4.99 alongside prior prices.",
        }, {
          source: "competitor-report",
          runId: "20260620T202412Z",
          summary: "Swellify IAP evidence now includes $4.99 alongside prior prices.",
        }],
      },
    });

    expect(report).toContain(
      "Structured competitor report (20260620T202412Z): Swellify IAP evidence now includes $4.99 alongside prior prices.",
    );
    expect(report).not.toContain("- - Swellify");
    expect(report).toContain(
      "Competitor deltas use the latest structured competitor report snapshot (20260620T202412Z), not freeform automation memory.",
    );
  });

  it("renders a concise mixed-signal weekly action queue instead of raw recommendation slices", () => {
    const report = renderWeeklySeoReport({
      generatedAt: "2026-05-20T12:00:00Z",
      recommendations: [{
        id: "gsc-low-ctr-la-jolla",
        createdAt: "2026-05-20T12:00:00Z",
        source: "gsc-decay",
        priority: "high",
        canonicalPath: "/best-time-to-surf/la-jolla",
        summary: "CTR candidate: page has meaningful impressions but weak clicks.",
        evidence: ["28d=0 clicks/975 impressions", "ctr=0.00%", "avgPosition=10.4"],
        status: "open",
      }],
      missing: [],
      store: {
        generatedAt: "2026-05-20T12:00:00Z",
        listings: [{
          app: "Quiver",
          platform: "ios",
          url: "https://apps.apple.com/us/app/surf-forecast-quiver/id6759300320",
          title: "Surf Forecast: Quiver",
          version: "1.0.1",
          priceEvidence: ["Free"],
          metadataDrift: ["Unexpected live title: Surf Forecast: Quiver"],
        }],
        competitorDeltas: [{
          source: "competitor-report",
          runId: "20260620T202412Z",
          summary: "Swellify IAP evidence changed from the remembered June 15 summary (`$5.99`, `$39.99`) to script evidence showing `$4.99`, `$5.99`, and `$39.99`. Treat as possible pricing/merchandising delta until a manual App Store UI check confirms whether `$4.99` is current or historical.",
        }],
      },
    });

    expect(report).toContain("underlying recommendation");
    expect(report).toContain("synthesized into 3 weekly actions");
    expect(report).toContain("- HIGH [ASO] Resolve Quiver App Store listing drift");
    expect(report).toContain("- HIGH [COMPETITOR] Verify Swellify $4.99 pricing evidence");
    expect(report).toContain("- HIGH [SEO] Improve SERP CTR for `/best-time-to-surf/la-jolla`");
    expect(report).not.toContain("`/best-time-to-surf/newport-beach` - Refresh candidate");
  });

  it("notes when weekly actions fall back to SEO-only items", () => {
    const report = renderWeeklySeoReport({
      generatedAt: "2026-05-20T12:00:00Z",
      recommendations: [{
        id: "gsc-low-ctr-la-jolla",
        createdAt: "2026-05-20T12:00:00Z",
        source: "gsc-decay",
        priority: "high",
        canonicalPath: "/best-time-to-surf/la-jolla",
        summary: "CTR candidate: page has meaningful impressions but weak clicks.",
        evidence: ["28d=0 clicks/975 impressions", "ctr=0.00%"],
        status: "open",
      }],
      missing: [],
      store: {
        generatedAt: "2026-05-20T12:00:00Z",
        listings: [],
        competitorDeltas: [{
          source: "competitor-report",
          runId: "20260620T202412Z",
          summary: "Duune SEO/store is unchanged: version `1.0.17` on `2026-05-18`, same IAP evidence band.",
        }],
      },
    });

    expect(report).toContain("Note: ASO, competitor, and AEO inputs did not meet the confidence gate this week, so the action queue falls back to SEO-only items.");
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
