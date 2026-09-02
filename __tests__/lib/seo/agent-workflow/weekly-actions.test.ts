import { synthesizeWeeklyActionQueue } from "@/lib/seo/agent-workflow/weekly-actions";
import type { WeeklySeoReportInput } from "@/lib/seo/agent-workflow/types";

function makeInput(overrides: Partial<WeeklySeoReportInput> = {}): WeeklySeoReportInput {
  return {
    generatedAt: "2026-06-20T12:00:00Z",
    recommendations: [],
    missing: [],
    ...overrides,
  };
}

describe("SEO workflow weekly action queue", () => {
  it("keeps Google exclusions in the weekly queue as investigations, not asserted fixes", () => {
    const queue = synthesizeWeeklyActionQueue(makeInput({
      recommendations: [{
        id: "gsc-indexing-beaches-mexico",
        createdAt: "2026-07-14T12:00:00Z",
        source: "gsc-indexing",
        priority: "high",
        canonicalPath: "/beaches/mexico",
        summary: "Google indexing investigation: Discovered - currently not indexed.",
        evidence: ["coverageState=Discovered - currently not indexed"],
        status: "open",
      }],
    }));

    expect(queue.actions).toEqual(expect.arrayContaining([
      expect.objectContaining({
        category: "indexing-investigation",
        title: "Investigate Google indexing for `/beaches/mexico`",
        nextStep: expect.not.stringContaining("ship the underlying"),
      }),
    ]));
  });

  it("keeps indexing investigations for commodity fact pages", () => {
    const queue = synthesizeWeeklyActionQueue(makeInput({
      recommendations: [{
        id: "gsc-indexing-ocean-beach-water-temp",
        createdAt: "2026-06-20T12:00:00Z",
        source: "gsc-indexing",
        priority: "high",
        canonicalPath: "/ca/san-diego/ocean-beach/water-temp",
        summary: "Google indexing investigation: Crawled - currently not indexed.",
        evidence: ["coverageState=Crawled - currently not indexed"],
        status: "open",
      }],
    }));

    expect(queue.actions[0]).toMatchObject({
      category: "indexing-investigation",
      ownerSurface: "/ca/san-diego/ocean-beach/water-temp",
    });
  });

  it("returns a mixed-signal queue when SEO, ASO, and competitor items all pass the confidence gate", () => {
    const queue = synthesizeWeeklyActionQueue(makeInput({
      recommendations: [{
        id: "gsc-low-ctr-la-jolla",
        createdAt: "2026-06-20T12:00:00Z",
        source: "gsc-decay",
        priority: "high",
        canonicalPath: "/best-time-to-surf/la-jolla",
        summary: "CTR candidate: page has meaningful impressions but weak clicks.",
        evidence: ["28d=0 clicks/975 impressions", "ctr=0.00%", "avgPosition=10.4"],
        status: "open",
      }, {
        id: "gsc-refresh-newport",
        createdAt: "2026-06-20T12:00:00Z",
        source: "gsc-decay",
        priority: "high",
        canonicalPath: "/best-time-to-surf/newport-beach",
        summary: "Refresh candidate: page lost at least 50% of prior-week search traction.",
        evidence: ["prior7d=7 clicks/640 impressions", "last7d=2 clicks/210 impressions"],
        status: "open",
      }],
      store: {
        generatedAt: "2026-06-20T12:00:00Z",
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
    }));

    expect(queue.actions).toHaveLength(4);
    expect(queue.actions.map((item) => item.source)).toEqual(["aso", "competitor", "seo", "seo"]);
    expect(queue.fallbackNote).toBeUndefined();
  });

  it("promotes competitor comparison pages and AEO gaps into non-SEO actions", () => {
    const queue = synthesizeWeeklyActionQueue(makeInput({
      competitor: {
        generatedAt: "2026-06-20T12:00:00Z",
        runId: "20260628T235143Z",
        technicalSurfaces: [],
        materialDeltas: [],
        comparisonSignals: [{
          competitor: "Swellify",
          summary: "The Quiver comparison page is live in captured HTML and includes structured comparison copy around Android support and data-source transparency.",
          url: "https://swellify.app/compare/quiver.html",
        }],
      },
      aeo: {
        generatedAt: "2026-06-20T12:00:00Z",
        aiReferrers: [{ referrer: "perplexity.ai", visits: 3 }],
        engines: [
          { engine: "chatgpt", citations: 53, pages: 26 },
          { engine: "perplexity", citations: 7, pages: 3 },
          { engine: "googleAiOverviews", citations: 0, pages: 0 },
          { engine: "gemini", citations: 0, pages: 0 },
        ],
        citationDomains: [{ domain: "grokipedia.com", links: 1, domainRating: 77 }],
        llmsFiles: [
          { path: "public/llms.txt", exists: true, lines: 10, bytes: 100 },
          { path: "public/llms-full.txt", exists: true, lines: 40, bytes: 400 },
        ],
      },
    }));

    expect(queue.actions).toEqual(expect.arrayContaining([
      expect.objectContaining({
        source: "competitor",
        category: "comparison-response",
      }),
      expect.objectContaining({
        source: "aeo",
        category: "citation-readiness",
      }),
    ]));
  });

  it("keeps the completed Lazy Surfer comparison in monitoring without re-adding it to the action queue", () => {
    const queue = synthesizeWeeklyActionQueue(makeInput({
      competitor: {
        generatedAt: "2026-06-20T12:00:00Z",
        runId: "20260628T235143Z",
        technicalSurfaces: [],
        materialDeltas: [],
        comparisonSignals: [{
          competitor: "Lazy Surfer",
          summary: "The Quiver comparison page is live in captured HTML and includes structured comparison copy around Android support and data-source transparency.",
          url: "https://lazysurfer.app/compare/quiver.html",
        }],
      },
    }));

    expect(queue.actions).not.toEqual(expect.arrayContaining([
      expect.objectContaining({
        source: "competitor",
        category: "comparison-response",
        title: "Respond to Lazy Surfer comparison-page claims",
      }),
    ]));
  });

  it("adds a new Lazy Surfer comparison action from a later report", () => {
    const queue = synthesizeWeeklyActionQueue(makeInput({
      competitor: {
        generatedAt: "2026-07-17T12:00:00Z",
        runId: "20260717T120000Z",
        technicalSurfaces: [],
        materialDeltas: [],
        comparisonSignals: [{
          competitor: "Lazy Surfer",
          summary: "The Quiver comparison page added new claims about forecast accuracy.",
          url: "https://lazysurfer.app/compare/quiver.html",
        }],
      },
    }));

    expect(queue.actions).toEqual(expect.arrayContaining([
      expect.objectContaining({
        source: "competitor",
        category: "comparison-response",
        title: "Respond to Lazy Surfer comparison-page claims",
      }),
    ]));
  });

  it("excludes low-signal competitor deltas that only say nothing changed", () => {
    const queue = synthesizeWeeklyActionQueue(makeInput({
      store: {
        generatedAt: "2026-06-20T12:00:00Z",
        listings: [],
        competitorDeltas: [{
          source: "competitor-report",
          runId: "20260620T202412Z",
          summary: "Duune SEO/store is unchanged: version `1.0.17` on `2026-05-18`, same IAP evidence band.",
        }],
      },
    }));

    expect(queue.actions).toEqual([]);
  });

  it("creates an ASO action when Quiver listing drift exists", () => {
    const queue = synthesizeWeeklyActionQueue(makeInput({
      store: {
        generatedAt: "2026-06-20T12:00:00Z",
        listings: [{
          app: "Quiver",
          platform: "ios",
          url: "https://apps.apple.com/us/app/surf-forecast-quiver/id6759300320",
          title: "Surf Forecast: Quiver",
          version: "1.0.1",
          priceEvidence: ["Free"],
          metadataDrift: ["Unexpected live title: Surf Forecast: Quiver"],
        }],
        competitorDeltas: [],
      },
    }));

    expect(queue.actions).toEqual([
      expect.objectContaining({
        source: "aso",
        category: "listing-copy",
        title: "Resolve Quiver App Store listing drift",
      }),
    ]);
  });

  it("collapses duplicate SEO recommendations on the same path into one action", () => {
    const queue = synthesizeWeeklyActionQueue(makeInput({
      recommendations: [{
        id: "gsc-low-ctr-newport",
        createdAt: "2026-06-20T12:00:00Z",
        source: "gsc-decay",
        priority: "high",
        canonicalPath: "/best-time-to-surf/newport-beach",
        summary: "CTR candidate: page has meaningful impressions but weak clicks.",
        evidence: ["28d=7 clicks/2486 impressions", "ctr=0.28%", "avgPosition=10.3"],
        status: "open",
      }, {
        id: "gsc-refresh-newport",
        createdAt: "2026-06-20T12:00:00Z",
        source: "gsc-decay",
        priority: "high",
        canonicalPath: "/best-time-to-surf/newport-beach",
        summary: "Refresh candidate: page lost at least 50% of prior-week search traction.",
        evidence: ["prior7d=11 clicks/900 impressions", "last7d=4 clicks/360 impressions"],
        status: "open",
      }],
    }));

    expect(queue.actions).toHaveLength(1);
    expect(queue.actions[0]).toMatchObject({
      ownerSurface: "/best-time-to-surf/newport-beach",
      category: "content-refresh",
    });
  });

  it("falls back to SEO-only actions and explains why when ASO and competitor inputs fail the gate", () => {
    const queue = synthesizeWeeklyActionQueue(makeInput({
      recommendations: [{
        id: "gsc-low-ctr-la-jolla",
        createdAt: "2026-06-20T12:00:00Z",
        source: "gsc-decay",
        priority: "high",
        canonicalPath: "/best-time-to-surf/la-jolla",
        summary: "CTR candidate: page has meaningful impressions but weak clicks.",
        evidence: ["28d=0 clicks/975 impressions", "ctr=0.00%"],
        status: "open",
      }],
      store: {
        generatedAt: "2026-06-20T12:00:00Z",
        listings: [],
        competitorDeltas: [{
          source: "competitor-report",
          runId: "20260620T202412Z",
          summary: "Get Surf Report direct SEO probe remains `503`; no verified robots/sitemap recovery.",
        }],
      },
    }));

    expect(queue.actions).toEqual([
      expect.objectContaining({
        source: "seo",
        ownerSurface: "/best-time-to-surf/la-jolla",
      }),
    ]);
    expect(queue.fallbackNote).toBe("ASO, competitor, and AEO inputs did not meet the confidence gate this week, so the action queue falls back to SEO-only items.");
  });
});
