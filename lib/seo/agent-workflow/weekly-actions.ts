import type {
  AeoCitationInput,
  CompetitorComparisonSignal,
  CompetitorIntelligenceInput,
  CompetitorDelta,
  SeoPriority,
  SeoRecommendation,
  StoreSnapshotInput,
  WeeklyActionItem,
  WeeklySeoReportInput,
} from "./types";

const PRIORITY_SCORE: Record<Extract<SeoPriority, "critical" | "high" | "medium">, number> = {
  critical: 300,
  high: 200,
  medium: 100,
};
const COMPLETED_COMPARISON_RESPONSE_KEYS = new Set([
  // Only the reviewed June 28 snapshot is complete; later reports remain actionable.
  "lazy surfer\u000020260628T235143Z",
]);

interface WeeklyActionQueueResult {
  actions: WeeklyActionItem[];
  totalOpenRecommendations: number;
  fallbackNote?: string;
}

interface ActionCandidate extends WeeklyActionItem {
  score: number;
}

export function synthesizeWeeklyActionQueue(input: WeeklySeoReportInput): WeeklyActionQueueResult {
  const openRecommendations = input.recommendations.filter((item) => item.status === "open");
  const seoCandidates = buildSeoActionCandidates(openRecommendations);
  const asoCandidates = buildAsoActionCandidates(input.store);
  const competitorCandidates = buildCompetitorActionCandidates(
    input.store?.competitorDeltas ?? [],
    input.competitor,
  );
  const aeoCandidates = buildAeoActionCandidates(input.aeo);

  const nonSeoCandidates = [...asoCandidates, ...competitorCandidates, ...aeoCandidates];
  const rankedSeoCandidates = rankCandidates(seoCandidates);
  const rankedMixedCandidates = rankCandidates([...seoCandidates, ...nonSeoCandidates]);

  let actions = rankedMixedCandidates.slice(0, 5).map(stripCandidate);

  if (actions.length < 3) {
    actions = rankCandidates([
      ...rankedMixedCandidates,
      ...rankedSeoCandidates,
    ]).slice(0, 5).map(stripCandidate);
  }

  const hasMixedAction = actions.some((item) => item.source !== "seo");
  const fallbackNote = !hasMixedAction && (
    asoCandidates.length === 0 &&
    competitorCandidates.length === 0 &&
    aeoCandidates.length === 0
  )
    ? "ASO, competitor, and AEO inputs did not meet the confidence gate this week, so the action queue falls back to SEO-only items."
    : undefined;

  return {
    actions,
    totalOpenRecommendations: openRecommendations.length,
    fallbackNote,
  };
}

function buildSeoActionCandidates(recommendations: SeoRecommendation[]): ActionCandidate[] {
  const grouped = new Map<string, SeoRecommendation[]>();

  for (const recommendation of recommendations) {
    if (!isEligibleSeoRecommendation(recommendation)) continue;
    const current = grouped.get(recommendation.canonicalPath) ?? [];
    current.push(recommendation);
    grouped.set(recommendation.canonicalPath, current);
  }

  return [...grouped.entries()]
    .map(([canonicalPath, group]) => buildSeoActionCandidate(canonicalPath, group))
    .filter(isDefined);
}

function buildSeoActionCandidate(
  canonicalPath: string,
  recommendations: SeoRecommendation[],
): ActionCandidate | null {
  const highestPriority = maxPriority(recommendations);
  if (!highestPriority) return null;

  const hasTechnical = recommendations.some((item) =>
    item.source === "vercel-analytics" ||
    item.source === "technical-audit",
  );
  const hasIndexingInvestigation = recommendations.some((item) => item.source === "gsc-indexing");
  const hasCtrSignal = recommendations.some((item) =>
    item.source === "gsc-decay" && /CTR candidate/i.test(item.summary),
  ) || recommendations.some((item) => item.source === "metadata-audit");
  const hasRefreshSignal = recommendations.some((item) =>
    item.source === "gsc-decay" && /Refresh candidate/i.test(item.summary),
  );
  const hasBehaviorSignal = recommendations.some((item) => item.source === "posthog-behavior");
  const isCommodityPage = isCommodityFactPage(canonicalPath);

  if (isCommodityPage && !hasTechnical && !hasIndexingInvestigation) return null;

  const category = hasTechnical
    ? "technical-fix"
    : hasIndexingInvestigation
      ? "indexing-investigation"
    : hasCtrSignal && hasRefreshSignal
      ? "content-refresh"
      : hasCtrSignal
        ? "ctr-improvement"
        : hasRefreshSignal
          ? "content-refresh"
          : hasBehaviorSignal
            ? "internal-linking"
            : "content-refresh";

  const evidence = collectEvidence(recommendations);
  if (evidence.length === 0) return null;

  const title = seoActionTitle(category, canonicalPath, hasCtrSignal && hasRefreshSignal);
  const nextStep = seoActionNextStep(category, canonicalPath, hasCtrSignal && hasRefreshSignal);
  const whyNow = seoActionWhyNow(category, recommendations);
  const confidence = evidence.length >= 2 ? "high" : "medium";
  const impressionScore = parseHighestImpressionCount(recommendations);
  const indexingInvestigationScore = hasIndexingInvestigation
    ? 30
    : 0;

  return {
    source: "seo",
    category,
    priority: highestPriority,
    title,
    ownerSurface: canonicalPath,
    nextStep,
    evidence,
    confidence,
    whyNow,
    score: PRIORITY_SCORE[highestPriority] + Math.min(Math.floor(impressionScore / 100), 60) + (isProductLedPath(canonicalPath) ? 15 : 0) + indexingInvestigationScore,
  };
}

function buildAsoActionCandidates(store?: StoreSnapshotInput): ActionCandidate[] {
  if (!store) return [];

  return store.listings
    .filter((listing) => listing.app === "Quiver" && (listing.metadataDrift?.length ?? 0) > 0)
    .map((listing) => {
      const evidence = [
        ...(listing.metadataDrift ?? []).slice(0, 2),
        listing.version ? `version=${listing.version}` : "",
      ].filter(Boolean);

      return {
        source: "aso" as const,
        category: "listing-copy" as const,
        priority: "high" as const,
        title: "Resolve Quiver App Store listing drift",
        ownerSurface: `App Store listing: ${listing.app} (${listing.platform})`,
        nextStep: "Review the live Quiver App Store title/copy against the Brand Vault listing doc and update the source of truth so the intended title is explicit this week.",
        evidence,
        confidence: "high" as const,
        whyNow: "The live listing and the maintained listing strategy are out of sync.",
        score: PRIORITY_SCORE.high + 40,
      };
    });
}

function buildCompetitorActionCandidates(
  deltas: CompetitorDelta[],
  competitor?: CompetitorIntelligenceInput,
): ActionCandidate[] {
  return [
    ...deltas.map((delta) => buildCompetitorActionCandidate(delta)),
    ...buildComparisonSignalCandidates(
      competitor?.comparisonSignals ?? [],
      competitor?.runId,
    ),
  ]
    .filter(isDefined);
}

function buildCompetitorActionCandidate(delta: CompetitorDelta): ActionCandidate | null {
  const summary = delta.summary.trim();
  const normalized = summary.toLowerCase();

  if (/unchanged|no verified|no version change/.test(normalized)) return null;

  if (/manual app store ui check confirms|manually confirmed|possible pricing\/merchandising delta|until a manual app store ui check confirms/.test(normalized)) {
    const competitor = detectCompetitorName(summary) ?? "Competitor";
    const pricePoint = extractRelevantPrice(summary) ?? "pricing";
    return {
      source: "competitor",
      category: "pricing-verification",
      priority: "high",
      title: `Verify ${competitor} ${pricePoint} pricing evidence`,
      ownerSurface: `Competitor watch: ${competitor} pricing`,
      nextStep: `Check the current ${competitor} App Store UI and confirm whether ${pricePoint} is a current plan, a historical string, or a scrape artifact.`,
      evidence: [summary],
      confidence: "high",
      whyNow: "A possible competitor pricing change appeared in the latest structured competitor report and is decisionable this week.",
      score: PRIORITY_SCORE.high + 30,
    };
  }

  if (/comparison page|frames quiver as a close competitor|attacks on platform coverage/.test(normalized)) {
    const competitor = detectCompetitorName(summary) ?? "Competitor";
    if (isCompletedComparisonResponse(competitor, delta.runId)) return null;
    return {
      source: "competitor",
      category: "competitor-monitoring",
      priority: "medium",
      title: `Review ${competitor} comparison-page messaging`,
      ownerSurface: `Competitor watch: ${competitor} comparison SEO`,
      nextStep: `Review the latest ${competitor} comparison-page claims and decide whether Quiver needs a factual response page or updated comparison messaging.`,
      evidence: [summary],
      confidence: "medium",
      whyNow: "A competitor is publishing head-to-head messaging that may influence branded and comparison-intent searches.",
      score: PRIORITY_SCORE.medium + 20,
    };
  }

  return null;
}

function buildComparisonSignalCandidates(
  signals: CompetitorComparisonSignal[],
  runId?: string,
): ActionCandidate[] {
  return signals
    .map((signal) => {
      if (!/comparison page|compare\/quiver\.html|attacks on/i.test(signal.summary)) return null;
      if (isCompletedComparisonResponse(signal.competitor, runId)) return null;

      return {
        source: "competitor" as const,
        category: "comparison-response" as const,
        priority: "high" as const,
        title: `Respond to ${signal.competitor} comparison-page claims`,
        ownerSurface: `Competitor watch: ${signal.competitor} comparison page`,
        nextStep: `Review the current ${signal.competitor} comparison-page copy and decide whether Quiver needs a factual response page, proof update, or pricing/platform clarification.`,
        evidence: [signal.summary],
        confidence: "high" as const,
        whyNow: "A competitor is publishing direct Quiver comparison messaging that can shape branded, alternative, and AI-citation queries.",
        score: PRIORITY_SCORE.high + 45,
      };
    })
    .filter(isDefined);
}

function isCompletedComparisonResponse(competitor: string, runId: string | undefined): boolean {
  if (!runId) return false;
  return COMPLETED_COMPARISON_RESPONSE_KEYS.has(
    `${competitor.trim().toLowerCase()}\u0000${runId}`,
  );
}

function buildAeoActionCandidates(aeo?: AeoCitationInput): ActionCandidate[] {
  if (!aeo) return [];

  const missingLlms = aeo.llmsFiles.filter((file) => !file.exists);
  if (missingLlms.length > 0) {
    return [{
      source: "aeo",
      category: "citation-readiness",
      priority: "high",
      title: "Restore Quiver llms citation surfaces",
      ownerSurface: "AEO / llms surfaces",
      nextStep: "Restore the missing llms inventory files and verify they reflect Quiver’s current forecast, comparison, and proof pages.",
      evidence: missingLlms.map((file) => `${file.path} missing`),
      confidence: "high",
      whyNow: "The report can see missing llms inventory files directly, so citation readiness is partially degraded until they return.",
      score: PRIORITY_SCORE.high + 35,
    }];
  }

  const engineMap = new Map(aeo.engines.map((engine) => [engine.engine.toLowerCase(), engine]));
  const searchVisible = (engineMap.get("chatgpt")?.citations ?? 0) + (engineMap.get("perplexity")?.citations ?? 0);
  const searchAbsent = (engineMap.get("googleaioverviews")?.citations ?? 0) + (engineMap.get("gemini")?.citations ?? 0);
  const citationDomains = aeo.citationDomains.map((domain) => domain.domain);

  if (searchVisible > 0 && searchAbsent === 0) {
    return [{
      source: "aeo",
      category: "citation-readiness",
      priority: "medium",
      title: "Build citation coverage beyond ChatGPT and Perplexity",
      ownerSurface: "AEO / citation footprint",
      nextStep: "Use Quiver’s best proof pages and comparison pages to target Google AI Overviews and Gemini, not just existing ChatGPT/Perplexity citation surfaces.",
      evidence: [
        ...aeo.engines.slice(0, 4).map((engine) => `${engine.engine}=${engine.citations}/${engine.pages}`),
        citationDomains.length > 0 ? `citationDomains=${citationDomains.join(",")}` : "citationDomains=none",
      ],
      confidence: "medium",
      whyNow: "Citation visibility exists on some engines, but the current footprint is still thin or absent on Google AI and Gemini surfaces.",
      score: PRIORITY_SCORE.medium + 25,
    }];
  }

  return [];
}

function rankCandidates(candidates: ActionCandidate[]): ActionCandidate[] {
  return [...new Map(candidates.map((candidate) => [
    `${candidate.source}\u0000${candidate.category}\u0000${candidate.ownerSurface}\u0000${candidate.title}`,
    candidate,
  ])).values()]
    .sort((a, b) => b.score - a.score || a.ownerSurface.localeCompare(b.ownerSurface));
}

function stripCandidate(candidate: ActionCandidate): WeeklyActionItem {
  const { score: _score, ...action } = candidate;
  return action;
}

function isEligibleSeoRecommendation(recommendation: SeoRecommendation): boolean {
  if (recommendation.priority === "low") return false;
  if (recommendation.source === "ahrefs-audit") return false;
  if (recommendation.source === "gsc-decay" && /Indexing candidate/i.test(recommendation.summary)) return false;
  return true;
}

function collectEvidence(recommendations: SeoRecommendation[]): string[] {
  const evidence = recommendations.flatMap((item) => item.evidence);
  const preferred = evidence.filter((item) =>
    !/^strategy=/.test(item) &&
    !/^crossCheck=no matching/.test(item) &&
    !/^rawPaths=/.test(item),
  );
  const rawPaths = evidence.filter((item) => /^rawPaths=/.test(item));

  return [...new Set([...preferred, ...rawPaths])].slice(0, 3);
}

function parseHighestImpressionCount(recommendations: SeoRecommendation[]): number {
  let highest = 0;

  for (const evidence of recommendations.flatMap((item) => item.evidence)) {
    const match = evidence.match(/(\d+)\s+impressions/i) ?? evidence.match(/\/(\d+)\s+impressions/i);
    if (!match) continue;
    highest = Math.max(highest, Number(match[1] ?? 0));
  }

  return highest;
}

function seoActionTitle(
  category: WeeklyActionItem["category"],
  canonicalPath: string,
  combinedIntent: boolean,
): string {
  switch (category) {
    case "indexing-investigation":
      return `Investigate Google indexing for \`${canonicalPath}\``;
    case "technical-fix":
      return `Fix technical SEO blockers on \`${canonicalPath}\``;
    case "ctr-improvement":
      return `Improve SERP CTR for \`${canonicalPath}\``;
    case "internal-linking":
      return `Strengthen click-through paths from \`${canonicalPath}\``;
    case "content-refresh":
      return combinedIntent
        ? `Refresh and repackage \`${canonicalPath}\` for better CTR`
        : `Refresh decision content on \`${canonicalPath}\``;
    default:
      return `Improve \`${canonicalPath}\``;
  }
}

function seoActionNextStep(
  category: WeeklyActionItem["category"],
  canonicalPath: string,
  combinedIntent: boolean,
): string {
  switch (category) {
    case "indexing-investigation":
      return `Verify the live response, canonical, robots directives, sitemap membership, and internal links for ${canonicalPath}; request reindexing or ship a fix only if that investigation identifies a cause.`;
    case "technical-fix":
      return `Investigate the reported performance or crawl issue on ${canonicalPath} and ship the underlying template or rendering fix before further content work.`;
    case "ctr-improvement":
      return `Rewrite the title, meta description, and opening copy on ${canonicalPath} to better match the query intent already earning impressions.`;
    case "internal-linking":
      return `Add clearer next-step CTAs and related-page links on ${canonicalPath} so more search visitors continue deeper into Quiver flows.`;
    case "content-refresh":
      return combinedIntent
        ? `Update the title/meta plus the core timing, condition, and local-context sections on ${canonicalPath}, then add supporting internal links from adjacent planning pages.`
        : `Refresh ${canonicalPath} with sharper timing, condition, and local-context guidance so the page earns more trust and return clicks.`;
    default:
      return `Update ${canonicalPath} based on the strongest evidence in this week’s report.`;
  }
}

function seoActionWhyNow(
  category: WeeklyActionItem["category"],
  recommendations: SeoRecommendation[],
): string {
  if (category === "indexing-investigation") return "URL Inspection confirms an exclusion state, but does not identify its root cause.";
  if (category === "technical-fix") return "Technical issues can suppress performance and rankings regardless of content quality.";
  if (recommendations.some((item) => /Refresh candidate/i.test(item.summary)) &&
    recommendations.some((item) => /CTR candidate/i.test(item.summary))) {
    return "The page is already visible in search but is underperforming on both click-through and momentum.";
  }
  if (category === "ctr-improvement") return "The page is already generating meaningful impressions, so copy changes can convert existing demand quickly.";
  if (category === "internal-linking") return "Search traffic is arriving, but the page is not reliably moving users deeper into Quiver.";
  return "The page has meaningful demand signals and a clear optimization move this week.";
}

function isCommodityFactPage(path: string): boolean {
  return /(water-temp|\/tides$|\/water-temp$|water temperature|ocean temp)/i.test(path);
}

function isProductLedPath(path: string): boolean {
  return /\/(best-time-to-surf|dawn-patrol|longboard)\//i.test(path);
}

function maxPriority(recommendations: SeoRecommendation[]): Extract<SeoPriority, "critical" | "high" | "medium"> | null {
  if (recommendations.some((item) => item.priority === "critical")) return "critical";
  if (recommendations.some((item) => item.priority === "high")) return "high";
  if (recommendations.some((item) => item.priority === "medium")) return "medium";
  return null;
}

function detectCompetitorName(summary: string): string | null {
  const match = summary.match(/^(Swellify|Lazy Surfer|Swell Scope|Duune|Get Surf Report)\b/i);
  return match?.[1] ?? null;
}

function extractRelevantPrice(summary: string): string | null {
  const showingMatch = summary.match(/showing\s+(`?\$[0-9]+(?:\.[0-9]{2})?`?)/i);
  if (showingMatch?.[1]) {
    return showingMatch[1].replace(/`/g, "");
  }

  return summary.match(/\$[0-9]+(?:\.[0-9]{2})?/)?.[0] ?? null;
}

function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}
