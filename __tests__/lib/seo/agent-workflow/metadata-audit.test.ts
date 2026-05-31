import {
  analyzeSeoMetadataAudit,
} from "@/lib/seo/agent-workflow/metadata-audit";

describe("SEO metadata audit", () => {
  it("returns no recommendations when funnel metadata satisfies quality gates", () => {
    const result = analyzeSeoMetadataAudit(
      [
        {
          path: "/surf-report/malibu-today",
          title: "Malibu Surf Report & Forecast Today",
          metaDescription:
            "Current Malibu surf report and forecast: live wave height, wind, tide, board call, crowd note, and backup spots before you drive.",
        },
      ],
      "2026-05-25T12:00:00Z",
    );

    expect(result.checkedPages).toBe(1);
    expect(result.issues).toEqual([]);
    expect(result.recommendations).toEqual([]);
  });

  it("flags title, description, and duplicate metadata problems", () => {
    const result = analyzeSeoMetadataAudit(
      [
        {
          path: "/surf-cams/hawaii",
          title: "Hawaii Cams",
          metaDescription: "Short description.",
        },
        {
          path: "/surf-cams/florida",
          title: "Hawaii Cams",
          metaDescription: "Short description.",
        },
      ],
      "2026-05-25T12:00:00Z",
    );

    expect(result.checkedPages).toBe(2);
    expect(result.issues.map((issue) => issue.path)).toEqual([
      "/surf-cams/hawaii",
      "/surf-cams/florida",
    ]);
    expect(result.issues[0]?.problems).toEqual(
      expect.arrayContaining([
        "title length 11 outside 30-60",
        "meta description length 18 outside 120-160",
        "duplicate title also used by /surf-cams/florida",
        "duplicate meta description also used by /surf-cams/florida",
      ]),
    );
    expect(result.recommendations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "metadata-audit-surf-cams-hawaii",
          source: "metadata-audit",
          priority: "high",
          canonicalPath: "/surf-cams/hawaii",
          status: "open",
        }),
      ]),
    );
  });
});
