import {
  createEmptyDashboard,
  findDuplicateTargetKeywords,
  findKeywordCannibalization,
  mergeStatus,
  normalizeSeoPath,
  parseSeoDashboard,
  upsertSeoEntry,
} from "@/lib/seo/agent-workflow/dashboard";
import type { SeoDashboardEntry } from "@/lib/seo/agent-workflow/types";

const NOW = "2026-05-17T12:00:00.000Z";

describe("SEO workflow dashboard", () => {
  it("normalizes URLs into canonical paths", () => {
    expect(normalizeSeoPath("https://www.quiversurf.app/Learn/Foo/?x=1#top"))
      .toBe("/learn/foo");
    expect(normalizeSeoPath("map")).toBe("/map");
    expect(normalizeSeoPath("/")).toBe("/");
  });

  it("validates the tracked dashboard shape", () => {
    const dashboard = parseSeoDashboard({
      version: 1,
      site: "https://www.quiversurf.app",
      updatedAt: NOW,
      entries: [],
      proposals: [],
    });

    expect(dashboard.version).toBe(1);
    expect(dashboard.entries).toEqual([]);
  });

  it("preserves blocked status and refresh-needed status across upserts", () => {
    expect(mergeStatus("blocked", "covered")).toBe("blocked");
    expect(mergeStatus("covered", "refresh-needed")).toBe("refresh-needed");
    expect(mergeStatus("refresh-needed", "covered")).toBe("refresh-needed");
  });

  it("finds duplicate keywords and cannibalizing entries", () => {
    let dashboard = createEmptyDashboard(NOW);
    dashboard = upsertSeoEntry(dashboard, entry("/learn/a", "surf forecast"), NOW);
    dashboard = upsertSeoEntry(dashboard, entry("/learn/b", "Surf   Forecast"), NOW);

    const duplicates = findDuplicateTargetKeywords(dashboard);
    const cannibalization = findKeywordCannibalization(
      dashboard,
      "surf forecast",
      "/learn/a",
    );

    expect(duplicates.get("surf forecast")).toHaveLength(2);
    expect(cannibalization.map((item) => item.canonicalPath)).toEqual(["/learn/b"]);
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
