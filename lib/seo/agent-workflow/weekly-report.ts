import type {
  BacklinkProxyInput,
  DataForSeoExportInput,
  GscExportInput,
  PostHogExportInput,
  SeoPriority,
  SeoRecommendation,
  StoreSnapshotInput,
  VercelExportInput,
  WeeklySeoReportInput,
} from "./types";

const PRIORITY_ORDER: Record<SeoPriority, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export function renderWeeklySeoReport(input: WeeklySeoReportInput): string {
  const openRecommendations = input.recommendations
    .filter((item) => item.status === "open")
    .sort((a, b) => {
      const delta = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
      return delta === 0 ? a.canonicalPath.localeCompare(b.canonicalPath) : delta;
    });
  const topActions = openRecommendations.slice(0, 8);

  return [
    `# Quiver Weekly SEO + ASO Report - ${input.generatedAt.slice(0, 10)}`,
    "",
    "Report-only output. No publishing, migrations, commits, pushes, runtime page edits, or production mutations were performed.",
    "",
    "## Bottom Line",
    "",
    renderBottomLine(input, openRecommendations),
    "",
    "## Web SEO",
    "",
    renderWebSeo(input.gsc, input.vercel),
    "",
    "## Keyword / Ranking Movement",
    "",
    renderKeywordMovement(input.gsc, input.dataforseo, openRecommendations),
    "",
    "## Technical Crawl Health",
    "",
    renderRecommendations(input.technical ?? [], "No technical crawl issues in available inputs."),
    "",
    "## Backlink / Referrer Signals",
    "",
    renderBacklink(input.backlink),
    "",
    "## Native ASO",
    "",
    renderStore(input.store, input.dataforseo),
    "",
    "## Native Funnel",
    "",
    renderNativeFunnel(input.posthog),
    "",
    "## Competitor Deltas",
    "",
    renderCompetitorDeltas(input.store, input.backlink),
    "",
    "## Actions This Week",
    "",
    renderRecommendations(topActions, "No open actions from available inputs."),
    "",
    "## Missing Data / Limits",
    "",
    renderLimits(input),
    "",
  ].join("\n");
}

function renderBottomLine(
  input: WeeklySeoReportInput,
  openRecommendations: SeoRecommendation[],
): string {
  const parts = [
    `${openRecommendations.length} open recommendation${openRecommendations.length === 1 ? "" : "s"} from available sources.`,
  ];
  if (input.gsc) {
    const clicks = sum(input.gsc.last28d.map((row) => row.clicks));
    const impressions = sum(input.gsc.last28d.map((row) => row.impressions));
    parts.push(`GSC 28d: ${clicks} clicks / ${impressions} impressions.`);
  }
  if (input.vercel) {
    parts.push(`Vercel 7d adjusted pageviews: ${input.vercel.adjustedPageViews}.`);
  }
  if (input.store) {
    parts.push(`${input.store.listings.length} store listing snapshot${input.store.listings.length === 1 ? "" : "s"} checked.`);
  }
  if (input.dataforseo && input.dataforseo.missing?.length === 0) {
    parts.push(`DataForSEO: ${input.dataforseo.googleRankings.length} Google rank checks, ${input.dataforseo.asoRankings.length} ASO rank checks, ${input.dataforseo.competitorKeywords.length} competitor keyword rows.`);
  }
  return `- ${parts.join(" ")}`;
}

function renderWebSeo(gsc?: GscExportInput, vercel?: VercelExportInput): string {
  const rows: string[] = [];
  if (gsc) {
    rows.push(`- GSC last 28d window: ${gsc.dateRanges.last28d.start} to ${gsc.dateRanges.last28d.end}.`);
    rows.push(`- Top query: ${gsc.topQueries[0]?.query ?? "none available"}.`);
    rows.push(`- Sitemap URLs sampled: ${gsc.sitemapPaths.length}.`);
  } else {
    rows.push("- GSC export unavailable.");
  }
  if (vercel) {
    rows.push(`- Vercel raw pageviews: ${vercel.rawPageViews}; adjusted pageviews: ${vercel.adjustedPageViews}; bot-path views removed: ${vercel.botPageViews}.`);
    rows.push(`- Top page: ${vercel.pages[0]?.path ?? "none available"}.`);
    rows.push(`- Top referrer: ${vercel.referrers[0]?.referrer ?? "none available"}.`);
  } else {
    rows.push("- Vercel export unavailable.");
  }
  return rows.join("\n");
}

function renderKeywordMovement(
  gsc: GscExportInput | undefined,
  dataforseo: DataForSeoExportInput | undefined,
  recommendations: SeoRecommendation[],
): string {
  const keywordRecs = recommendations.filter((item) =>
    item.source === "gsc-decay" || item.source === "ahrefs-audit",
  );
  const rows = [
    ...renderDataForSeoGoogleRanks(dataforseo),
    ...keywordRecs.slice(0, 8).map((item) =>
      `- ${item.priority.toUpperCase()}: \`${item.canonicalPath}\`${item.targetKeyword ? ` (${item.targetKeyword})` : ""} - ${item.summary}`,
    ),
  ];
  if (gsc?.topQueries.length) {
    rows.push(`- Highest-click GSC query: "${gsc.topQueries[0]?.query}" (${gsc.topQueries[0]?.clicks ?? 0} clicks).`);
  }
  return rows.length ? rows.join("\n") : "- No keyword movement available.";
}

function renderBacklink(backlink?: BacklinkProxyInput): string {
  if (!backlink) return "- Backlink proxy export unavailable.";
  return [
    `- Vercel referrer domains/labels: ${backlink.referrers.length}.`,
    `- Embed referrer domains: ${backlink.embedReferrers.length}.`,
    `- Outreach rows parsed: ${backlink.outreachStatuses.length}.`,
    `- Manual backlink exports found: ${backlink.manualExports.length}.`,
  ].join("\n");
}

function renderStore(store?: StoreSnapshotInput, dataforseo?: DataForSeoExportInput): string {
  const rows: string[] = [];
  if (!store) {
    rows.push("- Store snapshot unavailable.");
  } else if (store.listings.length === 0) {
    rows.push("- No store listings were captured.");
  } else {
    rows.push(...store.listings.map((listing) => {
      const rating = listing.rating ? `${listing.rating.toFixed(1)} rating` : "rating n/a";
      const count = typeof listing.ratingCount === "number" ? `${listing.ratingCount} ratings` : "rating count n/a";
      const drift = listing.metadataDrift?.length ? ` Drift: ${listing.metadataDrift.join("; ")}` : "";
      return `- ${listing.app} ${listing.platform}: ${listing.version ?? "version n/a"}; ${rating}; ${count}.${drift}`;
    }));
  }
  rows.push(...renderDataForSeoAsoRanks(dataforseo));
  return rows.join("\n");
}

function renderNativeFunnel(posthog?: PostHogExportInput): string {
  if (!posthog) return "- PostHog native export unavailable.";
  if (posthog.nativeFunnels.length === 0) return "- No native funnel rows in available PostHog export.";
  return posthog.nativeFunnels.map((funnel) => {
    const events = Object.entries(funnel.events)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([event, count]) => `${event}=${count}`)
      .join(", ");
    return `- ${funnel.platform}: ${events || "no events"}`;
  }).join("\n");
}

function renderCompetitorDeltas(
  store?: StoreSnapshotInput,
  backlink?: BacklinkProxyInput,
): string {
  const deltas = [
    ...(store?.competitorDeltas ?? []),
    ...(backlink?.competitorDeltas ?? []),
  ];
  return deltas.length ? deltas.map((delta) => `- ${delta}`).join("\n") : "- No competitor deltas in available inputs.";
}

function renderRecommendations(items: SeoRecommendation[], fallback: string): string {
  if (items.length === 0) return `- ${fallback}`;
  return items.map((item) => {
    const rawPathEvidence = item.evidence.find((evidence) =>
      evidence.startsWith("rawPaths="),
    );
    return `- ${item.priority.toUpperCase()}: \`${item.canonicalPath}\` - ${item.summary}${rawPathEvidence ? ` (${rawPathEvidence})` : ""}`;
  }).join("\n");
}

function renderLimits(input: WeeklySeoReportInput): string {
  const missing = [
    ...input.missing,
    ...(input.vercel?.missing ?? []),
    ...(input.posthog?.missing ?? []),
    ...(input.store?.missing ?? []),
    ...(input.dataforseo?.missing ?? []),
    ...(input.backlink?.missing ?? []),
  ];
  const hasDataForSeo = !!input.dataforseo &&
    (input.dataforseo.googleRankings.length > 0 ||
      input.dataforseo.asoRankings.length > 0 ||
      input.dataforseo.competitorKeywords.length > 0);
  const rows = [
    hasDataForSeo
      ? "- Paid SERP/API source: DataForSEO is enabled for tracked Google SERP, ASO, and competitor keyword snapshots; Backlinks API is intentionally disabled."
      : "- No paid SERP API is configured, so rank tracking is limited to GSC average position and any sampled store/search snapshots.",
    "- No full backlink index is available; backlink coverage is a proxy from referrers, embeds, outreach/manual exports, and competitor deltas.",
    hasDataForSeo
      ? "- Competitor keyword coverage uses DataForSEO Labs for the configured competitor set; it is not a complete hidden keyword database."
      : "- No hidden competitor keyword database is available; competitor insight is limited to public pages/store metadata and explicit exports.",
    "- No automated Google SERP scraping is performed.",
    ...[...new Set(missing)].map((item) => `- Missing/skipped: ${item}`),
  ];
  return rows.join("\n");
}

function renderDataForSeoGoogleRanks(dataforseo?: DataForSeoExportInput): string[] {
  if (!dataforseo || dataforseo.googleRankings.length === 0) return [];
  const found = dataforseo.googleRankings.filter((rank) => rank.quiverRank !== null);
  const rows = [
    `- DataForSEO Google rank checks: ${found.length}/${dataforseo.googleRankings.length} tracked keyword/location checks found Quiver in the top ${dataforseo.googleRankings[0]?.depth ?? 100}.`,
  ];
  rows.push(...dataforseo.googleRankings
    .slice()
    .sort((a, b) => (a.quiverRank ?? 999) - (b.quiverRank ?? 999))
    .slice(0, 8)
    .map((rank) => {
      const quiver = rank.quiverRank === null ? "not top 100" : `rank ${rank.quiverRank}`;
      const leader = rank.topCompetitors[0]?.domain ? `; leader=${rank.topCompetitors[0]?.domain}` : "";
      return `- DataForSEO: "${rank.keyword}" (${rank.location}) - Quiver ${quiver}${leader}.`;
    }));
  return rows;
}

function renderDataForSeoAsoRanks(dataforseo?: DataForSeoExportInput): string[] {
  if (!dataforseo || dataforseo.asoRankings.length === 0) return [];
  const found = dataforseo.asoRankings.filter((rank) => rank.quiverRank !== null);
  return [
    `- DataForSEO ASO rank checks: ${found.length}/${dataforseo.asoRankings.length} tracked store searches found Quiver in the top ${dataforseo.asoRankings[0]?.depth ?? 100}.`,
    ...dataforseo.asoRankings
      .slice()
      .sort((a, b) => (a.quiverRank ?? 999) - (b.quiverRank ?? 999))
      .slice(0, 8)
      .map((rank) => {
        const quiver = rank.quiverRank === null ? "not top 100" : `rank ${rank.quiverRank}`;
        const leader = rank.topCompetitors[0]?.app ? `; leader=${rank.topCompetitors[0]?.app}` : "";
        return `- DataForSEO ${rank.platform}: "${rank.keyword}" - Quiver ${quiver}${leader}.`;
      }),
  ];
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}
