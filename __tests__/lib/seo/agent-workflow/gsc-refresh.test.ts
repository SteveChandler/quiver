import { createEmptyDashboard, upsertSeoEntry } from "@/lib/seo/agent-workflow/dashboard";
import { analyzeGscRefresh } from "@/lib/seo/agent-workflow/gsc-refresh";
import type { SeoDashboardEntry } from "@/lib/seo/agent-workflow/types";

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
