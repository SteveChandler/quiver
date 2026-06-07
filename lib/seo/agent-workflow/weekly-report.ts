import type {
  BacklinkProxyInput,
  DataForSeoExportInput,
  GscExportInput,
  PostHogExportInput,
  SeoMetadataAuditInput,
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
    "## Qualified Web Demand",
    "",
    renderQualifiedWebDemand(input.vercel, input.posthog),
    "",
    "## Keyword / Ranking Movement",
    "",
    renderKeywordMovement(input.gsc, input.dataforseo, openRecommendations),
    "",
    "## SEO Metadata",
    "",
    renderMetadataAudit(input.metadata),
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
    renderCompetitorDeltas(input.store, input.backlink, input.dataforseo),
    "",
    "## Actions This Week",
    "",
    renderRecommendations(topActions, "No open actions from available inputs."),
    "",
    "## Coverage Notes",
    "",
    renderCoverageNotes(input),
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

function renderQualifiedWebDemand(
  vercel?: VercelExportInput,
  posthog?: PostHogExportInput,
): string {
  const rows: string[] = [];
  const qualifiedDemand = posthog?.qualifiedDemand;

  if (qualifiedDemand) {
    rows.push(
      `- Signup CTA: ${qualifiedDemand.signupCtaViews} views / ${qualifiedDemand.signupCtaClicks} clicks / ${qualifiedDemand.signupSuccesses} signups / ${qualifiedDemand.activatedSignups} activated signup${qualifiedDemand.activatedSignups === 1 ? "" : "s"}.`,
    );
  } else {
    rows.push("- Qualified signup and activation demand unavailable.");
  }

  const lowConfidenceSegments = vercel?.lowConfidenceSegments ?? [];
  if (lowConfidenceSegments.length > 0) {
    rows.push(
      `- Low-confidence Vercel segments: ${lowConfidenceSegments.map((segment) =>
        `${segment.segment}=${segment.visits}`
      ).join(", ")}.`,
    );
  } else if (vercel) {
    rows.push("- No low-confidence Vercel traffic segments were flagged.");
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

function renderMetadataAudit(metadata?: SeoMetadataAuditInput): string {
  if (!metadata) return "- SEO metadata audit unavailable.";
  const issueLabel = metadata.issues.length === 1 ? "issue" : "issues";
  const rows = [
    `- SEO metadata audit checked ${metadata.checkedPages} indexable pages and found ${metadata.issues.length} ${issueLabel}.`,
  ];
  if (metadata.issues.length > 0) {
    rows.push(renderRecommendations(
      metadata.recommendations.slice(0, 8),
      "No SEO metadata quality issues found.",
    ));
  }
  return rows.join("\n");
}

function renderBacklink(backlink?: BacklinkProxyInput): string {
  if (!backlink) return "- Backlink proxy export unavailable.";
  const manualRows = sum(backlink.manualExports.map((item) => item.rows));
  const manualDomains = sum(backlink.manualExports.map((item) => item.uniqueReferringDomains ?? 0));
  const sampleDomains = backlink.manualExports.flatMap((item) => item.sampleReferringDomains ?? []);
  const topManualDomains = [...new Set(sampleDomains)].slice(0, 8);
  return [
    `- Vercel referrer domains/labels: ${backlink.referrers.length}.`,
    `- Embed referrer domains: ${backlink.embedReferrers.length}.`,
    `- Outreach rows parsed: ${backlink.outreachStatuses.length}.`,
    `- Manual backlink exports imported: ${backlink.manualExports.length} file${backlink.manualExports.length === 1 ? "" : "s"} / ${manualRows} row${manualRows === 1 ? "" : "s"} / ${manualDomains} referring-domain observations.`,
    topManualDomains.length
      ? `- Manual backlink sample domains: ${topManualDomains.join(", ")}.`
      : "- Manual backlink sample domains: none imported.",
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
  dataforseo?: DataForSeoExportInput,
): string {
  const deltas = [
    ...(store?.competitorDeltas ?? []),
    ...(backlink?.competitorDeltas ?? []),
    ...renderCompetitorKeywordCoverage(dataforseo),
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

function renderCoverageNotes(input: WeeklySeoReportInput): string {
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
  const manualExportCount = input.backlink?.manualExports.length ?? 0;
  const manualRows = sum(input.backlink?.manualExports.map((item) => item.rows) ?? []);
  const manualDomains = sum(input.backlink?.manualExports.map((item) => item.uniqueReferringDomains ?? 0) ?? []);
  const competitorCount = new Set(input.dataforseo?.competitorKeywords.map((row) => row.competitor) ?? []).size;
  const rows = [
    hasDataForSeo
      ? "- DataForSEO is enabled for tracked Google SERP, ASO, and competitor keyword snapshots. Backlinks API is intentionally disabled."
      : "- DataForSEO is not configured, so rank tracking is limited to GSC average position and public store/search snapshots.",
    input.backlink
      ? `- Backlink coverage uses free/provided sources: Vercel referrers, widget embed referrers, outreach tracker rows, and ${manualExportCount} manual export file${manualExportCount === 1 ? "" : "s"} (${manualRows} rows, ${manualDomains} referring-domain observations). No paid full backlink index is configured.`
      : "- Backlink coverage uses free/provided sources when available: Vercel referrers, widget embeds, outreach rows, and manual CSV/JSON exports. No paid full backlink index is configured.",
    manualExportCount > 0
      ? "- Manual backlink imports are included when matching Ahrefs Webmaster Tools, Moz Link Explorer, GSC links, or manual backlink CSV/JSON files are present in the audit folder or `docs/seo/backlink-reports/`."
      : "- Manual backlink imports: no matching Ahrefs Webmaster Tools, Moz Link Explorer, GSC links, or manual backlink CSV/JSON files were found in this audit folder or `docs/seo/backlink-reports/`.",
    hasDataForSeo
      ? `- Competitor keyword coverage uses DataForSEO Labs for ${competitorCount} configured competitors. It is a provider-index snapshot, not a complete hidden keyword database.`
      : "- Competitor keyword coverage is limited to public pages/store metadata and explicit exports.",
    "- Google SERP collection: no automated Google SERP scraping is performed; tracked rank checks use DataForSEO API when configured and GSC average position otherwise.",
    ...[...new Set(missing)].map((item) => `- Skipped source: ${item}`),
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

function renderCompetitorKeywordCoverage(dataforseo?: DataForSeoExportInput): string[] {
  const rows = dataforseo?.competitorKeywords ?? [];
  if (rows.length === 0) return [];

  const byCompetitor = new Map<string, { rows: number; volume: number }>();
  const byPage = new Map<string, { rows: number; volume: number; competitors: Set<string> }>();
  const byCluster = new Map<string, { rows: number; volume: number }>();

  for (const row of rows) {
    const competitor = byCompetitor.get(row.competitor) ?? { rows: 0, volume: 0 };
    competitor.rows += 1;
    competitor.volume += row.searchVolume ?? 0;
    byCompetitor.set(row.competitor, competitor);

    const clusterName = classifyCompetitorKeyword(row.keyword);
    const cluster = byCluster.get(clusterName) ?? { rows: 0, volume: 0 };
    cluster.rows += 1;
    cluster.volume += row.searchVolume ?? 0;
    byCluster.set(clusterName, cluster);

    if (row.url) {
      const page = byPage.get(row.url) ?? { rows: 0, volume: 0, competitors: new Set<string>() };
      page.rows += 1;
      page.volume += row.searchVolume ?? 0;
      page.competitors.add(row.competitor);
      byPage.set(row.url, page);
    }
  }

  const competitorSummary = [...byCompetitor.entries()]
    .sort((a, b) => b[1].rows - a[1].rows || b[1].volume - a[1].volume)
    .map(([competitor, value]) => `${competitor}=${value.rows}`)
    .join(", ");
  const actionableRows = rows.filter((row) => isActionableCompetitorKeyword(row.keyword));
  const topKeywords = (actionableRows.length ? actionableRows : rows)
    .slice()
    .sort((a, b) => (b.searchVolume ?? 0) - (a.searchVolume ?? 0))
    .slice(0, 5)
    .map((row) => `"${row.keyword}" (${row.competitor}, vol ${row.searchVolume ?? "n/a"}, rank ${row.rank ?? "n/a"})`)
    .join("; ");
  const clusterSummary = [...byCluster.entries()]
    .sort((a, b) => b[1].volume - a[1].volume || b[1].rows - a[1].rows)
    .slice(0, 6)
    .map(([cluster, value]) => `${cluster}=${value.rows} rows/${value.volume} volume`)
    .join(", ");
  const topPages = [...byPage.entries()]
    .sort((a, b) => b[1].rows - a[1].rows || b[1].volume - a[1].volume)
    .slice(0, 5)
    .map(([url, value]) => `${url} (${value.rows} rows, ${value.volume} volume)`)
    .join("; ");

  return [
    `DataForSEO Labs competitor keyword rows: ${rows.length} rows across ${byCompetitor.size} competitors (${competitorSummary}).`,
    topKeywords ? `Top actionable competitor keyword opportunities by volume: ${topKeywords}.` : "",
    clusterSummary ? `Competitor keyword clusters: ${clusterSummary}.` : "",
    topPages ? `Competitor ranking pages with the broadest keyword footprint: ${topPages}.` : "",
  ].filter((row) => row.length > 0);
}

function classifyCompetitorKeyword(keyword: string): string {
  const value = keyword.toLowerCase();
  if (/(surfline|lazy surfer|swellify|swell scope|swellscope|duune|surf radar|magicseaweed|msw)/.test(value)) {
    return "competitor-brand";
  }
  if (/(water temp|water temperature|ocean temp|sea temperature)/.test(value)) {
    return "water-temp";
  }
  if (/(forecast|report|conditions|wave|swell|tide|wind|buoy)/.test(value)) {
    return "forecast-report";
  }
  if (/(beginner|learn|how to|what is|why|when|best time|history|origin)/.test(value)) {
    return "education";
  }
  if (/(session|journal|tracker|log|dawn patrol|board)/.test(value)) {
    return "session-memory";
  }
  if (/(beach|pier|point|cove|break|tamarack|malibu|scripps|tourmaline|huntington|rincon|kona|santa cruz|newport|la jolla)/.test(value)) {
    return "spot-local";
  }
  return "other";
}

function isActionableCompetitorKeyword(keyword: string): boolean {
  if (/(surfline|lazy surfer|swellify|swell scope|swellscope|duune|surf radar|magicseaweed|msw)/i.test(keyword)) {
    return false;
  }
  if (/^(surf|surfing|surfs)$/i.test(keyword.trim())) {
    return false;
  }
  return /(surf forecast|surf report|forecast|report|conditions|swell|wave forecast|tide|wind|buoy|water temp|water temperature|ocean temp|sea temp|how to read|beginner surf|best time to surf|dawn patrol|surf session|surf journal|surf tracker|surfboard|surf board|learn surf)/i.test(keyword);
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}
