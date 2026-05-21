import { createEmptyDashboard } from "@/lib/seo/agent-workflow/dashboard";
import { renderSeoDraftArtifact } from "@/lib/seo/agent-workflow/drafts";
import {
  mergeSeoRecommendations,
  renderSeoRecommendationReport,
} from "@/lib/seo/agent-workflow/recommend";
import type { SeoRecommendation } from "@/lib/seo/agent-workflow/types";

const NOW = "2026-05-17T12:00:00.000Z";

describe("SEO workflow recommendations", () => {
  it("dedupes recommendations and sorts by priority", () => {
    const low = rec("same", "low", "/b");
    const high = rec("high", "high", "/a");

    expect(mergeSeoRecommendations([low, high, rec("same", "critical", "/b")]))
      .toEqual([rec("same", "critical", "/b"), high]);
  });

  it("renders report-only guardrails without auto-publish instructions", () => {
    const report = renderSeoRecommendationReport(
      createEmptyDashboard(NOW),
      [rec("one", "high", "/learn/foo")],
      NOW,
    );

    expect(report).toContain("Report-only output");
    expect(report).toContain("manual review");
    expect(report).not.toContain("publish automatically");
  });

  it("resolves Ahrefs keyword recommendations already in the dashboard queue", () => {
    const dashboard = {
      ...createEmptyDashboard(NOW),
      proposals: [{
        id: "proposal-example",
        createdAt: NOW,
        source: "ahrefs-audit" as const,
        priority: "high" as const,
        targetKeyword: "belmar nj surf report",
        pageType: "surf-report",
        canonicalPath: "/nj/belmar",
        reason: "Ahrefs opportunity.",
        competingUrls: [],
        status: "open" as const,
      }],
    };
    const report = renderSeoRecommendationReport(
      dashboard,
      [{
        ...rec("ahrefs-keyword-belmar", "high", "/nj/belmar"),
        source: "ahrefs-audit",
        targetKeyword: "belmar nj surf report",
        summary: "Ahrefs keyword opportunity should feed the keyword bank review queue.",
      }],
      NOW,
    );

    expect(report).toContain("Open recommendations: 0");
    expect(report).toContain("resolved: Ahrefs keyword opportunity is already in the keyword bank review queue.");
  });

  it("renders staged draft metadata for manual approval", () => {
    const draft = renderSeoDraftArtifact({
      slug: "example-draft",
      title: "Example Draft",
      targetKeyword: "surf forecast example",
      pageType: "learn",
      competingInternalUrls: ["/learn/existing"],
      citations: [{ label: "NOAA", url: "https://www.noaa.gov/" }],
      requiredInternalLinks: ["/map", "/learn"],
    });

    expect(draft).toContain("status: review-queue");
    expect(draft).toContain("publishing: manual-approval-required");
    expect(draft).toContain("/learn/existing");
    expect(draft).toContain("https://www.noaa.gov/");
  });
});

function rec(
  id: string,
  priority: SeoRecommendation["priority"],
  canonicalPath: string,
): SeoRecommendation {
  return {
    id,
    createdAt: NOW,
    source: "technical-audit",
    priority,
    canonicalPath,
    summary: `${priority} issue`,
    evidence: [],
    status: "open",
  };
}
