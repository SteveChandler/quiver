import { learnArticles } from "@/lib/data/learn-articles";
import { INDEXABLE_SEO_FUNNEL_PAGES } from "@/lib/seo/funnel-pages";

import {
  findKeywordCannibalization,
  makeSeoId,
  normalizeKeyword,
  normalizeSeoPath,
  upsertSeoEntry,
  upsertSeoProposal,
} from "./dashboard";
import type { SeoDashboard, SeoDashboardEntry, SeoProposal } from "./types";

const SEED_QUEUE = [
  {
    targetKeyword: "surf conditions near me",
    pageType: "map",
    canonicalPath: "/map",
    reason: "Primary local-discovery intent from Quiver product marketing context.",
  },
  {
    targetKeyword: "free surfline alternative",
    pageType: "comparison",
    canonicalPath: "/vs/surfline",
    reason: "Comparison intent with high brand fit and existing comparison page.",
  },
  {
    targetKeyword: "beginner surf spots california",
    pageType: "programmatic-intent",
    canonicalPath: "/beginner/california",
    reason: "High-fit beginner long-tail topic that should be checked against current route coverage.",
  },
] as const;

export function buildKeywordBankDashboard(
  dashboard: SeoDashboard,
  now: string,
  options: { productMarketingContext?: string | null } = {},
): SeoDashboard {
  let next = dashboard;
  const contextNote = options.productMarketingContext
    ? "Derived from Quiver product-marketing context and existing route inventory."
    : "Derived from existing route inventory; product-marketing context was unavailable.";

  for (const entry of buildLearnEntries()) {
    next = upsertSeoEntry(next, entry, now);
  }

  for (const entry of buildFunnelEntries()) {
    next = upsertSeoEntry(next, entry, now);
  }

  for (const queued of SEED_QUEUE) {
    const competitors = findKeywordCannibalization(next, queued.targetKeyword)
      .map((entry) => entry.canonicalPath);
    const proposal: SeoProposal = {
      id: makeSeoId("proposal", `${queued.canonicalPath}-${queued.targetKeyword}`),
      createdAt: now,
      source: "keyword-research",
      priority: competitors.length > 0 ? "low" : "medium",
      targetKeyword: queued.targetKeyword,
      pageType: queued.pageType,
      canonicalPath: queued.canonicalPath,
      reason: `${queued.reason} ${contextNote}`,
      competingUrls: competitors,
      status: "open",
    };
    next = upsertSeoProposal(next, proposal, now);
  }

  return next;
}

export function buildLearnEntries(): SeoDashboardEntry[] {
  return learnArticles.map((article) => {
    const canonicalPath = `/learn/${article.slug}`;
    const primaryKeyword = article.keywords[0] ?? article.title;
    return {
      id: makeSeoId("learn", canonicalPath),
      canonicalPath,
      pageType: "learn",
      targetKeyword: primaryKeyword,
      status: "covered",
      cluster: {
        primaryKeyword,
        secondarySemantics: article.keywords.slice(1),
        intendedHeadings: article.sections.map((section) => section.heading),
        linkedUrls: article.relatedLinks.map((link) => link.href),
      },
      recommendations: [],
    };
  });
}

export function buildFunnelEntries(): SeoDashboardEntry[] {
  return INDEXABLE_SEO_FUNNEL_PAGES.map((page) => {
    const canonicalPath = normalizeSeoPath(page.path);
    const primaryKeyword = inferPrimaryKeyword(page.h1 || page.title);

    return {
      id: makeSeoId(page.type, canonicalPath),
      canonicalPath,
      pageType: page.type,
      targetKeyword: primaryKeyword,
      status: "covered",
      cluster: {
        primaryKeyword,
        secondarySemantics: [
          page.locationName,
          page.eyebrow,
          ...page.faqs.map((faq) => faq.question),
        ].map(normalizeKeyword),
        intendedHeadings: [page.h1, ...page.sections.map((section) => section.heading)],
        linkedUrls: [
          page.primaryCta.href,
          page.secondaryCta?.href,
          ...page.internalLinks.map((link) => link.href),
          ...page.nearbySpots.map((link) => link.href),
        ].filter((href): href is string => typeof href === "string"),
      },
      recommendations: [],
    };
  });
}

function inferPrimaryKeyword(value: string): string {
  return normalizeKeyword(
    value
      .replace(/\s+\|\s+quiver$/i, "")
      .replace(/\s+-\s+quiver$/i, ""),
  );
}
