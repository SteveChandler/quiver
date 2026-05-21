import fs from "node:fs";
import path from "node:path";

import { resolveSeoAuditRoot } from "./audit-paths";
import { normalizeKeyword, normalizeSeoPath } from "./dashboard";
import type { SeoDashboard, SeoPriority, SeoRecommendation } from "./types";

const PRIORITY_ORDER: Record<SeoPriority, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export function mergeSeoRecommendations(
  recommendations: SeoRecommendation[],
): SeoRecommendation[] {
  const byId = new Map<string, SeoRecommendation>();
  for (const recommendation of recommendations) {
    byId.set(recommendation.id, recommendation);
  }

  return [...byId.values()].sort((a, b) => {
    const priorityDelta = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
    return priorityDelta === 0 ? a.canonicalPath.localeCompare(b.canonicalPath) : priorityDelta;
  });
}

export function renderSeoRecommendationReport(
  dashboard: SeoDashboard,
  recommendations: SeoRecommendation[],
  generatedAt: string,
): string {
  const merged = mergeSeoRecommendations(resolveRecommendationsWithDashboard(dashboard, recommendations));
  const openRecommendations = merged.filter((item) => item.status === "open");
  const inactiveRecommendations = merged.filter((item) => item.status !== "open");
  const byPriority = groupByPriority(openRecommendations);
  const openProposals = dashboard.proposals.filter((proposal) => proposal.status === "open");

  return [
    `# Quiver SEO Workflow Report - ${generatedAt.slice(0, 10)}`,
    "",
    "Report-only output. Publishing, migrations, commits, pushes, and production changes require separate approval.",
    "",
    "## Summary",
    "",
    `- Dashboard entries: ${dashboard.entries.length}`,
    `- Open keyword proposals: ${openProposals.length}`,
    `- Open recommendations: ${openRecommendations.length}`,
    `- Resolved or blocked recommendations: ${inactiveRecommendations.length}`,
    "",
    "## Priority Recommendations",
    "",
    ...renderPrioritySection("Critical", byPriority.critical),
    ...renderPrioritySection("High", byPriority.high),
    ...renderPrioritySection("Medium", byPriority.medium),
    ...renderPrioritySection("Low", byPriority.low),
    "## Resolved Or Blocked",
    "",
    ...renderInactiveRows(inactiveRecommendations),
    "## Open Keyword Queue",
    "",
    ...renderProposalRows(openProposals),
    "## Review Guardrails",
    "",
    "- Drafts belong under `tools/content-pipeline/output/seo-drafts/` for manual review.",
    "- Do not publish generated content directly from this workflow.",
    "- Keep citations to trusted sources for factual claims, favoring NOAA, NDBC, CDIP, NWS, `.gov`, and `.edu`.",
    "- Check competing internal URLs before accepting a new target keyword.",
    "",
  ].join("\n");
}

export function resolveRecommendationsWithDashboard(
  dashboard: SeoDashboard,
  recommendations: SeoRecommendation[],
): SeoRecommendation[] {
  const activeProposalByKey = new Map(
    dashboard.proposals
      .filter((proposal) => proposal.status === "open" || proposal.status === "accepted")
      .map((proposal) => [
        proposalKey(proposal.canonicalPath, proposal.targetKeyword),
        proposal.status,
      ]),
  );

  return recommendations.map((recommendation) => {
    if (
      recommendation.status !== "open" ||
      recommendation.source !== "ahrefs-audit" ||
      !recommendation.targetKeyword
    ) {
      return recommendation;
    }

    const proposalStatus = activeProposalByKey.get(
      proposalKey(recommendation.canonicalPath, recommendation.targetKeyword),
    );

    if (!proposalStatus) {
      return recommendation;
    }

    return {
      ...recommendation,
      status: "resolved",
      summary: proposalStatus === "accepted"
        ? "Ahrefs keyword opportunity has an accepted implementation path."
        : "Ahrefs keyword opportunity is already in the keyword bank review queue.",
      evidence: [
        ...recommendation.evidence,
        `dashboardProposal=${proposalStatus === "accepted" ? "accepted" : "queued"}`,
      ],
    };
  });
}

export function writeSeoRecommendationReport(
  dashboard: SeoDashboard,
  recommendations: SeoRecommendation[],
  generatedAt: string,
  rootDir = process.cwd(),
): string {
  const date = generatedAt.slice(0, 10);
  const outputDir = path.join(resolveSeoAuditRoot(rootDir), date);
  const outputPath = path.join(outputDir, "SEO-WORKFLOW-REPORT.md");

  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(
    outputPath,
    renderSeoRecommendationReport(dashboard, recommendations, generatedAt),
  );

  return outputPath;
}

function groupByPriority(recommendations: SeoRecommendation[]): Record<SeoPriority, SeoRecommendation[]> {
  return {
    critical: recommendations.filter((item) => item.priority === "critical"),
    high: recommendations.filter((item) => item.priority === "high"),
    medium: recommendations.filter((item) => item.priority === "medium"),
    low: recommendations.filter((item) => item.priority === "low"),
  };
}

function renderPrioritySection(label: string, items: SeoRecommendation[]): string[] {
  if (items.length === 0) return [`### ${label}`, "", "- None.", ""];

  return [
    `### ${label}`,
    "",
    ...items.flatMap((item) => [
      `- \`${item.canonicalPath}\` - ${item.summary}`,
      `  Evidence: ${item.evidence.join("; ") || "none"}`,
    ]),
    "",
  ];
}

function renderInactiveRows(items: SeoRecommendation[]): string[] {
  if (items.length === 0) return ["- None.", ""];

  return [
    ...items.map((item) =>
      `- \`${item.canonicalPath}\` - ${item.status}: ${item.summary}`,
    ),
    "",
  ];
}

function renderProposalRows(openProposals: SeoDashboard["proposals"]): string[] {
  if (openProposals.length === 0) return ["- None.", ""];

  return [
    ...openProposals.map((proposal) =>
      `- \`${proposal.canonicalPath}\` targets "${proposal.targetKeyword}" (${proposal.pageType}); competing URLs: ${proposal.competingUrls.length || 0}`,
    ),
    "",
  ];
}

function proposalKey(canonicalPath: string, targetKeyword: string): string {
  return `${normalizeSeoPath(canonicalPath)}\u0000${normalizeKeyword(targetKeyword)}`;
}
