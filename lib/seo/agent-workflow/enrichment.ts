import {
  makeSeoId,
  normalizeSeoPath,
} from "./dashboard";
import type {
  AhrefsKeywordOpportunity,
  AhrefsSeoIssue,
  PostHogSeoPageMetric,
  SeoEnrichmentContext,
  SeoEnrichmentInput,
  SeoRecommendation,
  VercelSeoPageMetric,
} from "./types";

export function analyzeSeoEnrichment(
  input: SeoEnrichmentInput,
  now: string,
  context: SeoEnrichmentContext = {},
): SeoRecommendation[] {
  if (input.source === "vercel") {
    return analyzeVercelPages((input.pages ?? []) as VercelSeoPageMetric[], now);
  }
  if (input.source === "posthog") {
    return analyzePostHogPages((input.pages ?? []) as PostHogSeoPageMetric[], now);
  }

  return [
    ...analyzeAhrefsIssues(input.issues ?? [], now),
    ...analyzeAhrefsKeywords(input.keywordOpportunities ?? [], now, context),
  ].sort((a, b) => a.id.localeCompare(b.id));
}

function analyzeVercelPages(
  pages: VercelSeoPageMetric[],
  now: string,
): SeoRecommendation[] {
  return pages.flatMap((page) => {
    const canonicalPath = normalizeSeoPath(page.path);
    const recommendations: SeoRecommendation[] = [];

    if (typeof page.p75LcpMs === "number" && page.p75LcpMs > 4000) {
      recommendations.push({
        id: makeSeoId("vercel-lcp", canonicalPath),
        createdAt: now,
        source: "vercel-analytics",
        priority: page.p75LcpMs > 6000 ? "high" : "medium",
        canonicalPath,
        summary: "Vercel Speed Insights shows slow p75 LCP on an SEO page.",
        evidence: [`p75LcpMs=${page.p75LcpMs}`, trafficEvidence(page)],
        status: "open",
      });
    }

    if (typeof page.p75InpMs === "number" && page.p75InpMs > 200) {
      recommendations.push({
        id: makeSeoId("vercel-inp", canonicalPath),
        createdAt: now,
        source: "vercel-analytics",
        priority: page.p75InpMs > 500 ? "high" : "medium",
        canonicalPath,
        summary: "Vercel Speed Insights shows poor p75 INP on an SEO page.",
        evidence: [`p75InpMs=${page.p75InpMs}`, trafficEvidence(page)],
        status: "open",
      });
    }

    if (typeof page.cls === "number" && page.cls > 0.1) {
      recommendations.push({
        id: makeSeoId("vercel-cls", canonicalPath),
        createdAt: now,
        source: "vercel-analytics",
        priority: page.cls > 0.25 ? "high" : "medium",
        canonicalPath,
        summary: "Vercel Speed Insights shows layout shift above the SEO threshold.",
        evidence: [`cls=${page.cls}`, trafficEvidence(page)],
        status: "open",
      });
    }

    return recommendations;
  }).sort((a, b) => a.id.localeCompare(b.id));
}

function analyzePostHogPages(
  pages: PostHogSeoPageMetric[],
  now: string,
): SeoRecommendation[] {
  return pages.flatMap((page) => {
    const canonicalPath = normalizeSeoPath(page.path);
    const landingSessions = page.landingSessions ?? 0;
    const recommendations: SeoRecommendation[] = [];

    if (
      landingSessions >= 25 &&
      typeof page.multiPageRate === "number" &&
      page.multiPageRate < 0.1
    ) {
      recommendations.push({
        id: makeSeoId("posthog-clickaround", canonicalPath),
        createdAt: now,
        source: "posthog-behavior",
        priority: landingSessions >= 100 ? "high" : "medium",
        canonicalPath,
        summary: "PostHog shows weak click-around from an SEO landing page.",
        evidence: [
          `landingSessions=${landingSessions}`,
          `multiPageRate=${formatRate(page.multiPageRate)}`,
        ],
        status: "open",
      });
    }

    if (
      landingSessions >= 25 &&
      Array.isArray(page.topNextPaths) &&
      page.topNextPaths.length === 0
    ) {
      recommendations.push({
        id: makeSeoId("posthog-related-paths", canonicalPath),
        createdAt: now,
        source: "posthog-behavior",
        priority: "medium",
        canonicalPath,
        summary: "PostHog shows this SEO landing page rarely drives a second page.",
        evidence: [`landingSessions=${landingSessions}`, "topNextPaths=none"],
        status: "open",
      });
    }

    if (
      landingSessions >= 25 &&
      typeof page.landingSignupRate === "number" &&
      page.landingSignupRate >= 0.05
    ) {
      recommendations.push({
        id: makeSeoId("posthog-high-value", canonicalPath),
        createdAt: now,
        source: "posthog-behavior",
        priority: "low",
        canonicalPath,
        summary: "PostHog shows this SEO page converts; protect and expand internal links to it.",
        evidence: [
          `landingSessions=${landingSessions}`,
          `landingSignupRate=${formatRate(page.landingSignupRate)}`,
        ],
        status: "open",
      });
    }

    return recommendations;
  }).sort((a, b) => a.id.localeCompare(b.id));
}

function analyzeAhrefsIssues(
  issues: AhrefsSeoIssue[],
  now: string,
): SeoRecommendation[] {
  return issues.map((issue) => {
    const canonicalPath = normalizeSeoPath(issue.path);
    const isDismissedStrategyNote = issue.type === "spam-referring-domains";
    return {
      id: makeSeoId(`ahrefs-${issue.type}`, canonicalPath),
      createdAt: now,
      source: "ahrefs-audit",
      priority: isDismissedStrategyNote ? "low" : issue.priority ?? "medium",
      canonicalPath,
      summary: issue.summary,
      evidence: issue.evidence ?? [issue.type],
      status: isDismissedStrategyNote ? "dismissed" : "open",
    };
  });
}

function analyzeAhrefsKeywords(
  opportunities: AhrefsKeywordOpportunity[],
  now: string,
  context: SeoEnrichmentContext,
): SeoRecommendation[] {
  return opportunities.map((opportunity) => {
    const canonicalPath = normalizeSeoPath(opportunity.path);
    const volume = opportunity.volume ?? 0;
    const difficulty = opportunity.difficulty ?? 100;
    const isNoChasePage = isNoChaseAhrefsKeywordPath(canonicalPath);
    const crossCheck = getAhrefsKeywordCrossCheck(canonicalPath, context);
    const isValidated = crossCheck.validated;

    return {
      id: makeSeoId(`ahrefs-keyword-${opportunity.keyword}`, canonicalPath),
      createdAt: now,
      source: "ahrefs-audit",
      priority: isNoChasePage || !isValidated
        ? "low"
        : volume >= 100 && difficulty <= 40 ? "high" : "medium",
      canonicalPath,
      targetKeyword: opportunity.keyword,
      summary: isNoChasePage
        ? "Ahrefs keyword opportunity is intentionally blocked by Quiver SEO strategy."
        : isValidated
          ? "Ahrefs keyword opportunity should feed the keyword bank review queue."
          : "Ahrefs keyword opportunity needs GSC, Vercel, or PostHog validation before content work.",
      evidence: [
        `keyword=${opportunity.keyword}`,
        `volume=${volume}`,
        `difficulty=${difficulty}`,
        opportunity.reason ?? "Ahrefs opportunity export",
        ...crossCheck.evidence,
        ...(isNoChasePage ? ["strategy=do not chase tide or water-temp pages"] : []),
      ],
      status: isNoChasePage ? "dismissed" : "open",
    };
  });
}

function isNoChaseAhrefsKeywordPath(canonicalPath: string): boolean {
  const segments = canonicalPath.split("/").filter(Boolean);
  return segments[0] === "tide" ||
    segments[0] === "water-temp" ||
    segments.includes("water-temp");
}

function getAhrefsKeywordCrossCheck(
  canonicalPath: string,
  context: SeoEnrichmentContext,
): { evidence: string[]; validated: boolean } {
  const evidence: string[] = [];
  const gscRows = uniqueGscRows([
    ...(context.gsc?.last28d ?? []),
    ...(context.gsc?.topPages ?? []),
  ]).filter((row) => normalizeSeoPath(row.page) === canonicalPath);
  const gscClicks = sum(gscRows.map((row) => row.clicks));
  const gscImpressions = sum(gscRows.map((row) => row.impressions));
  if (gscClicks > 0 || gscImpressions > 0) {
    evidence.push(`crossCheck=gscImpressions=${gscImpressions},gscClicks=${gscClicks}`);
  }

  const vercelVisits = sum((context.vercel?.pages ?? [])
    .filter((page) => normalizeSeoPath(page.path) === canonicalPath)
    .map((page) => page.visits ?? 0));
  if (vercelVisits > 0) {
    evidence.push(`crossCheck=vercelVisits=${vercelVisits}`);
  }

  const posthogLandingSessions = sum((context.posthog?.pages ?? [])
    .filter((page) => normalizeSeoPath(page.path) === canonicalPath)
    .map((page) => page.landingSessions ?? 0));
  if (posthogLandingSessions > 0) {
    evidence.push(`crossCheck=posthogLandingSessions=${posthogLandingSessions}`);
  }

  const validated = evidence.length > 0;
  if (!validated) {
    evidence.push("crossCheck=no matching GSC, Vercel, or PostHog demand");
  }

  return { evidence, validated };
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function uniqueGscRows<T extends { page: string; clicks: number; impressions: number }>(
  rows: T[],
): T[] {
  return [...new Map(rows.map((row) => [
    `${normalizeSeoPath(row.page)}\u0000${row.clicks}\u0000${row.impressions}`,
    row,
  ])).values()];
}

function trafficEvidence(page: VercelSeoPageMetric): string {
  const visits = page.visits ?? 0;
  const previous = page.previousVisits;
  if (typeof previous !== "number") return `visits=${visits}`;
  return `visits=${visits}; previousVisits=${previous}`;
}

function formatRate(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}
