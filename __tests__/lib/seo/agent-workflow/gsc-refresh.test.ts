import { createEmptyDashboard, upsertSeoEntry } from "@/lib/seo/agent-workflow/dashboard";
import { analyzeGscRefresh } from "@/lib/seo/agent-workflow/gsc-refresh";
import type {
  GscRefreshInput,
  SeoDashboardEntry,
} from "@/lib/seo/agent-workflow/types";

const NOW = "2026-05-17T12:00:00.000Z";

describe("SEO workflow GSC refresh", () => {
  it("flags decayed pages, low CTR pages, and sitemap URLs missing from GSC", () => {
    const dashboard = upsertSeoEntry(
      createEmptyDashboard(NOW),
      entry("/learn/how-to-read-surf-conditions", "how to read surf conditions"),
      NOW,
    );

    const recommendations = analyzeGscRefresh(
      {
        prior7d: [{
          page: "https://www.quiversurf.app/learn/how-to-read-surf-conditions",
          clicks: 10,
          impressions: 400,
        }],
        last7d: [{
          page: "https://www.quiversurf.app/learn/how-to-read-surf-conditions",
          clicks: 4,
          impressions: 180,
        }],
        last28d: [{
          page: "https://www.quiversurf.app/vs/surfline",
          clicks: 0,
          impressions: 800,
          ctr: 0,
          position: 8,
        }],
        sitemapPaths: [
          "/learn/how-to-read-surf-conditions",
          "/missing-from-gsc",
        ],
      },
      dashboard,
      NOW,
    );

    expect(recommendations.map((item) => item.id)).toEqual([
      "gsc-decay-learn-how-to-read-surf-conditions",
      "gsc-low-ctr-vs-surfline",
      "gsc-missing-learn-how-to-read-surf-conditions",
      "gsc-missing-missing-from-gsc",
    ]);
    expect(recommendations[0]?.targetKeyword).toBe("how to read surf conditions");
  });

  it("canonicalizes legacy beach rows into the unique sitemap beach path", () => {
    const dashboard = upsertSeoEntry(
      createEmptyDashboard(NOW),
      entry("/ca/ventura/c-street-ventura-ca", "c street surf report"),
      NOW,
    );

    const recommendations = analyzeGscRefresh(
      {
        prior7d: [],
        last7d: [],
        last28d: [
          {
            page: "https://www.quiversurf.app/beach/c-street-ventura-ca",
            clicks: 0,
            impressions: 641,
            ctr: 0,
            position: 8.5,
          },
        ],
        sitemapPaths: ["/ca/ventura/c-street-ventura-ca"],
      },
      dashboard,
      NOW,
    );

    expect(recommendations).toHaveLength(1);
    expect(recommendations[0]).toMatchObject({
      id: "gsc-low-ctr-ca-ventura-c-street-ventura-ca",
      canonicalPath: "/ca/ventura/c-street-ventura-ca",
      targetKeyword: "c street surf report",
    });
    expect(recommendations[0]?.evidence).toContain(
      "rawPaths=/beach/c-street-ventura-ca -> /ca/ventura/c-street-ventura-ca",
    );
  });

  it("promotes GSC URL Inspection exclusions to high-priority indexing investigations", () => {
    const recommendations = analyzeGscRefresh(
      {
        prior7d: [],
        last7d: [],
        last28d: [],
        sitemapPaths: ["/beaches/mexico"],
        indexing: {
          generatedAt: NOW,
          watchlistPath: "docs/seo/gsc-indexing-watchlist.json",
          results: [{
            canonicalPath: "/beaches/mexico",
            label: "Mexico location hub",
            verdict: "NEUTRAL",
            coverageState: "Discovered - currently not indexed",
            indexingState: "PASS",
            robotsTxtState: "ALLOWED",
            pageFetchState: "SUCCESSFUL",
            sitemap: ["https://www.quiversurf.app/sitemap.xml"],
          }, {
            canonicalPath: "/mexico/baja-california/rosarito/el-morro",
            coverageState: "URL is unknown to Google",
          }],
        },
      },
      createEmptyDashboard(NOW),
      NOW,
    );

    expect(recommendations).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: "gsc-indexing-beaches-mexico",
        source: "gsc-indexing",
        priority: "high",
        canonicalPath: "/beaches/mexico",
        summary: "Google indexing investigation: Discovered - currently not indexed.",
      }),
      expect.objectContaining({
        id: "gsc-indexing-mexico-baja-california-rosarito-el-morro",
        summary: "Google indexing investigation: URL is unknown to Google.",
      }),
    ]));
  });

  it("merges legacy and canonical GSC rows before calculating CTR", () => {
    const recommendations = analyzeGscRefresh(
      {
        prior7d: [],
        last7d: [],
        last28d: [
          {
            page: "https://www.quiversurf.app/beach/c-street-ventura-ca",
            clicks: 0,
            impressions: 300,
            ctr: 0,
            position: 10,
          },
          {
            page: "https://www.quiversurf.app/ca/ventura/c-street-ventura-ca",
            clicks: 1,
            impressions: 500,
            ctr: 0.002,
            position: 8,
          },
        ],
        sitemapPaths: ["/ca/ventura/c-street-ventura-ca"],
      },
      createEmptyDashboard(NOW),
      NOW,
    );

    const lowCtr = recommendations.find((item) =>
      item.id === "gsc-low-ctr-ca-ventura-c-street-ventura-ca",
    );

    expect(lowCtr?.evidence).toEqual(expect.arrayContaining([
      "28d=1 clicks/800 impressions",
      "ctr=0.13%",
      "avgPosition=8.8",
      "rawPaths=/beach/c-street-ventura-ca, /ca/ventura/c-street-ventura-ca -> /ca/ventura/c-street-ventura-ca",
    ]));
  });

  it("emits active CTR cohorts as monitor-only recommendations even without impressions", () => {
    const recommendations = analyzeGscRefresh(
      {
        prior7d: [],
        last7d: [],
        last28d: [],
        sitemapPaths: [],
        ctrWatchlist: [{
          canonicalPath: "/surf-report/newport-beach-today",
          label: "Newport Beach surf-report owner",
          monitorUntil: "2026-07-26",
          reason: "New owner route needs a fully post-change window.",
        }],
      },
      createEmptyDashboard(NOW),
      "2026-07-17T12:00:00.000Z",
    );

    expect(recommendations).toEqual([expect.objectContaining({
      id: "gsc-ctr-monitor-surf-report-newport-beach-today",
      priority: "low",
      canonicalPath: "/surf-report/newport-beach-today",
      targetKeyword: "Newport Beach surf-report owner",
      summary: "CTR monitor: retain the current page treatment and observe the next 28-day GSC window.",
      evidence: expect.arrayContaining([
        "28d=0 clicks/0 impressions",
        "monitorUntil=2026-07-26",
      ]),
    })]);
  });

  it("uses the GSC data-through date to keep the monitor hold active", () => {
    const recommendations = analyzeGscRefresh(
      monitoredCtrInput("2026-07-24"),
      createEmptyDashboard(NOW),
      "2026-07-27T12:00:00.000Z",
    );

    expect(recommendations.map((item) => item.id)).toEqual([
      "gsc-ctr-monitor-best-time-to-surf-la-jolla",
    ]);
  });

  it("resumes decay and CTR candidates after GSC data passes the monitor cutoff", () => {
    const recommendations = analyzeGscRefresh(
      monitoredCtrInput("2026-07-27"),
      createEmptyDashboard(NOW),
      "2026-07-30T12:00:00.000Z",
    );

    expect(recommendations.map((item) => item.id)).toEqual([
      "gsc-decay-best-time-to-surf-la-jolla",
      "gsc-low-ctr-best-time-to-surf-la-jolla",
    ]);
  });

  it("fails closed when a CTR monitor cutoff is malformed", () => {
    const recommendations = analyzeGscRefresh(
      monitoredCtrInput("2026-07-27", "not-a-date"),
      createEmptyDashboard(NOW),
      "2026-07-30T12:00:00.000Z",
    );

    expect(recommendations.map((item) => item.id)).toEqual([
      "gsc-ctr-monitor-best-time-to-surf-la-jolla",
    ]);
  });
});

function monitoredCtrInput(
  dataThrough?: string,
  monitorUntil = "2026-07-26",
): GscRefreshInput {
  return {
    prior7d: [{
      page: "/best-time-to-surf/la-jolla",
      clicks: 10,
      impressions: 500,
    }],
    last7d: [{
      page: "/best-time-to-surf/la-jolla",
      clicks: 1,
      impressions: 100,
    }],
    last28d: [{
      page: "/best-time-to-surf/la-jolla",
      clicks: 0,
      impressions: 800,
      ctr: 0,
      position: 8,
    }],
    sitemapPaths: ["/best-time-to-surf/la-jolla"],
    ...(dataThrough ? { dataThrough } : {}),
    ctrWatchlist: [{
      canonicalPath: "/best-time-to-surf/la-jolla",
      label: "La Jolla best-time page",
      monitorUntil,
      reason: "June 29 CTR treatment needs one fully post-change 28-day GSC window.",
    }],
  };
}

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
