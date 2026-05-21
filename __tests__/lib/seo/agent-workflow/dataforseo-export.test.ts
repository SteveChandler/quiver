import {
  buildMissingDataForSeoExport,
  parseAsoRanking,
  parseCompetitorRankedKeywords,
  parseGoogleSerpRanking,
} from "@/lib/seo/agent-workflow/dataforseo-export";

describe("SEO workflow DataForSEO export", () => {
  it("parses Google SERP rankings for Quiver and competitors", () => {
    const ranking = parseGoogleSerpRanking(
      {
        tasks: [{
          result: [{
            items: [
              { type: "organic", domain: "surfline.com", url: "https://www.surfline.com", title: "Surfline", rank_absolute: 1 },
              { type: "organic", domain: "www.quiversurf.app", url: "https://www.quiversurf.app/", title: "Quiver", rank_absolute: 4 },
            ],
          }],
        }],
      },
      {
        keyword: "surf forecast app",
        location: "United States",
        locationCode: 2840,
        languageCode: "en",
        device: "mobile",
        depth: 100,
      },
      "quiversurf.app",
    );

    expect(ranking.quiverRank).toBe(4);
    expect(ranking.quiverUrl).toBe("https://www.quiversurf.app/");
    expect(ranking.topCompetitors[0]?.domain).toBe("surfline.com");
  });

  it("parses ASO rankings for iOS and Android app searches", () => {
    const ranking = parseAsoRanking(
      {
        tasks: [{
          result: [{
            items: [
              { title: "Lazy Surfer", app_id: "1450887020", rank_absolute: 1 },
              { title: "Quiver", app_id: "6759300320", rank_absolute: 8 },
            ],
          }],
        }],
      },
      {
        keyword: "surf forecast",
        platform: "ios",
        location: "United States",
        depth: 100,
      },
      "6759300320",
    );

    expect(ranking.quiverRank).toBe(8);
    expect(ranking.topCompetitors[0]).toEqual({
      app: "Lazy Surfer",
      appId: "1450887020",
      rank: 1,
    });
  });

  it("parses competitor ranked keywords", () => {
    const rows = parseCompetitorRankedKeywords(
      {
        tasks: [{
          result: [{
            items: [{
              keyword_data: {
                keyword: "custom surf forecast",
                keyword_info: { search_volume: 90 },
              },
              ranked_serp_element: {
                serp_item: {
                  url: "https://www.swell-scope.com/",
                  rank_absolute: 6,
                },
              },
              etv: 3.2,
            }],
          }],
        }],
      },
      { name: "Swell Scope", domain: "swell-scope.com" },
    );

    expect(rows).toEqual([{
      competitor: "Swell Scope",
      domain: "swell-scope.com",
      keyword: "custom surf forecast",
      url: "https://www.swell-scope.com/",
      rank: 6,
      searchVolume: 90,
      estimatedTraffic: 3.2,
    }]);
  });

  it("builds a missing-credentials export", () => {
    expect(buildMissingDataForSeoExport("2026-05-20T12:00:00Z", ["DATAFORSEO_LOGIN"])).toEqual({
      generatedAt: "2026-05-20T12:00:00Z",
      googleRankings: [],
      asoRankings: [],
      competitorKeywords: [],
      missing: ["DATAFORSEO_LOGIN"],
    });
  });
});
