import { analyzeSeoEnrichment } from "@/lib/seo/agent-workflow/enrichment";

const NOW = "2026-05-17T12:00:00.000Z";

describe("SEO workflow enrichment", () => {
  it("turns Vercel performance exports into page recommendations", () => {
    const recommendations = analyzeSeoEnrichment(
      {
        source: "vercel",
        pages: [{
          path: "/learn/foo",
          visits: 120,
          previousVisits: 80,
          p75LcpMs: 6500,
          p75InpMs: 250,
          cls: 0.12,
        }],
      },
      NOW,
    );

    expect(recommendations.map((item) => item.id)).toEqual([
      "vercel-cls-learn-foo",
      "vercel-inp-learn-foo",
      "vercel-lcp-learn-foo",
    ]);
    expect(recommendations.find((item) => item.id.includes("lcp"))?.priority)
      .toBe("high");
  });

  it("turns PostHog behavior exports into product-value recommendations", () => {
    const recommendations = analyzeSeoEnrichment(
      {
        source: "posthog",
        pages: [{
          path: "/beginner/san-diego",
          landingSessions: 100,
          multiPageRate: 0.05,
          topNextPaths: [],
          landingSignupRate: 0.08,
          assistedSignupRate: 0.12,
        }],
      },
      NOW,
    );

    expect(recommendations.map((item) => item.id)).toEqual([
      "posthog-clickaround-beginner-san-diego",
      "posthog-high-value-beginner-san-diego",
      "posthog-related-paths-beginner-san-diego",
    ]);
  });

  it("turns Ahrefs issues and keyword opportunities into recommendations", () => {
    const recommendations = analyzeSeoEnrichment(
      {
        source: "ahrefs",
        issues: [{
          path: "/vs/surfline",
          type: "broken-inbound-link",
          priority: "high",
          summary: "Broken inbound link target found.",
          evidence: ["source=https://example.com"],
        }],
        keywordOpportunities: [{
          path: "/beginner/california",
          keyword: "beginner surf spots california",
          volume: 250,
          difficulty: 28,
          reason: "Ranking gap.",
        }],
      },
      NOW,
      {
        gsc: {
          last28d: [{
            page: "/beginner/california",
            clicks: 4,
            impressions: 120,
          }],
        },
      },
    );

    expect(recommendations.map((item) => item.source)).toEqual([
      "ahrefs-audit",
      "ahrefs-audit",
    ]);
    expect(recommendations.find((item) => item.targetKeyword)?.priority).toBe("high");
    expect(recommendations.find((item) => item.targetKeyword)?.evidence)
      .toContain("crossCheck=gscImpressions=120,gscClicks=4");
  });

  it("keeps unvalidated Ahrefs keyword opportunities out of high-priority content work", () => {
    const recommendations = analyzeSeoEnrichment(
      {
        source: "ahrefs",
        keywordOpportunities: [{
          path: "/best-time-to-surf/la-jolla",
          keyword: "la jolla surf report",
          volume: 250,
          difficulty: 12,
          reason: "Ahrefs organic keyword snapshot.",
        }],
      },
      NOW,
      {
        gsc: {
          last28d: [{
            page: "/best-time-to-surf/westport",
            clicks: 7,
            impressions: 245,
          }],
        },
        vercel: {
          pages: [{ path: "/map", visits: 39 }],
        },
        posthog: {
          pages: [{ path: "/forecast/santa-cruz", landingSessions: 11 }],
        },
      },
    );

    expect(recommendations).toHaveLength(1);
    expect(recommendations[0]).toMatchObject({
      priority: "low",
      status: "open",
      summary: "Ahrefs keyword opportunity needs GSC, Vercel, or PostHog validation before content work.",
    });
    expect(recommendations[0].evidence).toContain("crossCheck=no matching GSC, Vercel, or PostHog demand");
  });

  it("blocks Ahrefs tide and water-temp opportunities from active chasing", () => {
    const recommendations = analyzeSeoEnrichment(
      {
        source: "ahrefs",
        issues: [{
          path: "/",
          type: "spam-referring-domains",
          summary: "Spam referring domains dominate the export.",
        }],
        keywordOpportunities: [
          {
            path: "/tide/santa-cruz",
            keyword: "low tide santa cruz",
            volume: 1000,
            difficulty: 5,
          },
          {
            path: "/water-temp/huntington-beach",
            keyword: "water temperature huntington beach",
            volume: 350,
            difficulty: 0,
          },
          {
            path: "/me/scarborough/higgins-beach-scarborough-me/water-temp",
            keyword: "higgins beach water temp",
            volume: 60,
            difficulty: 2,
          },
        ],
      },
      NOW,
    );

    expect(recommendations).toHaveLength(4);
    expect(recommendations.every((item) => item.status === "dismissed")).toBe(true);
    expect(recommendations.map((item) => item.priority)).toEqual([
      "low",
      "low",
      "low",
      "low",
    ]);
  });
});
