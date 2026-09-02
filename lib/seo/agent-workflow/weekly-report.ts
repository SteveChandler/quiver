import type {
  AeoCitationInput,
  BacklinkProxyInput,
  CompetitorDelta,
  CompetitorIntelligenceInput,
  DataForSeoExportInput,
  GscExportInput,
  OutreachDigestInput,
  OutreachRotationCategory,
  PostHogExportInput,
  SeoMetadataAuditInput,
  SeoPriority,
  SeoRecommendation,
  StoreSnapshotInput,
  VercelExportInput,
  WeeklyActionItem,
  WeeklySeoComparison,
  WeeklySeoReportInput,
} from "./types";
import {
  classifyCompetitorKeyword,
  filterRelevantCompetitorKeywordRows,
  isLowFitCompetitorKeyword,
} from "./competitor-keywords";
import { synthesizeWeeklyActionQueue } from "./weekly-actions";

const PRIORITY_ORDER: Record<SeoPriority, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

const PRODUCT_LED_COMPETITOR_CLUSTER_PRIORITY: Record<string, number> = {
  "forecast-report": 60,
  "spot-local": 50,
  "session-memory": 45,
  education: 40,
  "water-temp": 20,
  "competitor-brand": 10,
  other: 0,
};

export function renderWeeklySeoReport(input: WeeklySeoReportInput): string {
  const openRecommendations = input.recommendations
    .filter((item) => item.status === "open")
    .sort((a, b) => {
      const delta = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
      return delta === 0 ? a.canonicalPath.localeCompare(b.canonicalPath) : delta;
    });
  const actionQueue = synthesizeWeeklyActionQueue(input);

  return [
    `# Quiver Weekly SEO + ASO Report - ${input.auditDate ?? input.generatedAt.slice(0, 10)}`,
    "",
    "Report-only output. No publishing, migrations, commits, pushes, runtime page edits, or production mutations were performed.",
    "",
    "## Bottom Line",
    "",
    renderBottomLine(input, openRecommendations),
    "",
    "## Source Freshness",
    "",
    renderSourceFreshness(input.sourceFreshness),
    "",
    "## Week-over-Week Movement",
    "",
    renderWeekOverWeek(input.weekOverWeek),
    "",
    "## Web SEO",
    "",
    renderWebSeo(input.gsc, input.vercel),
    "",
    "## Keyword / Ranking Movement",
    "",
    renderKeywordMovement(input.gsc, input.dataforseo, openRecommendations),
    "",
    "## CTR Cohort Monitoring",
    "",
    renderCtrCohortMonitoring(openRecommendations),
    "",
    "## Product-Led SEO Opportunities",
    "",
    renderProductLedOpportunities(input.gsc, input.dataforseo),
    "",
    "## Do Not Chase",
    "",
    renderDoNotChase(input.gsc, input.dataforseo),
    "",
    "## SEO Metadata",
    "",
    renderMetadataAudit(input.metadata),
    "",
    "## Google Indexing Health",
    "",
    renderGoogleIndexingHealth(input.gsc),
    "",
    "## Technical Crawl Health",
    "",
    renderRecommendations(
      mergeTechnicalRecommendations(input.technical ?? [], input.recommendations),
      "No technical crawl issues in available inputs.",
    ),
    "",
    "## Backlink / Referrer Signals",
    "",
    renderBacklink(input.backlink),
    "",
    "## AI Citation / AEO Signals",
    "",
    renderAeo(input.aeo),
    "",
    "## Outreach Queue",
    "",
    renderOutreach(input.outreach),
    "",
    "## Competitor Technical Surfaces",
    "",
    renderCompetitorTechnicalSurfaces(input.competitor),
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
    renderCompetitorDeltas(input.store, input.competitor, input.dataforseo),
    "",
    "## Actions This Week",
    "",
    renderWeeklyActions(actionQueue.actions, actionQueue.fallbackNote),
    "",
    "## Execution Plan This Week",
    "",
    renderExecutionPlan(actionQueue.actions),
    "",
    "## Coverage Notes",
    "",
    renderCoverageNotes(input),
    "",
  ].join("\n");
}

export function buildWeeklySeoComparison(
  current: WeeklySeoReportInput,
  previous?: WeeklySeoReportInput,
  previousAuditDate?: string,
): WeeklySeoComparison | undefined {
  const metrics: WeeklySeoComparison["metrics"] = [];
  const currentGsc = current.gsc;

  if (currentGsc) {
    addMetric(
      metrics,
      "GSC clicks (last 7d vs prior 7d)",
      sum(currentGsc.last7d.map((row) => row.clicks)),
      sum(currentGsc.prior7d.map((row) => row.clicks)),
      "clicks",
    );
    addMetric(
      metrics,
      "GSC impressions (last 7d vs prior 7d)",
      sum(currentGsc.last7d.map((row) => row.impressions)),
      sum(currentGsc.prior7d.map((row) => row.impressions)),
      "impressions",
    );
  }

  if (current.vercel) {
    const currentVisits = sum(current.vercel.pages.map((page) => page.visits ?? 0));
    const previousVisits = sum(current.vercel.pages.map((page) => page.previousVisits ?? 0));
    if (currentVisits > 0 && previousVisits > 0) {
      addMetric(
        metrics,
        "Vercel SEO page visits",
        currentVisits,
        previousVisits,
        "visits",
      );
    }
  }

  if (previous?.gsc && currentGsc) {
    addMetric(
      metrics,
      "GSC clicks (28d vs prior report)",
      sum(currentGsc.last28d.map((row) => row.clicks)),
      sum(previous.gsc.last28d.map((row) => row.clicks)),
      "clicks",
    );
    addMetric(
      metrics,
      "GSC impressions (28d vs prior report)",
      sum(currentGsc.last28d.map((row) => row.impressions)),
      sum(previous.gsc.last28d.map((row) => row.impressions)),
      "impressions",
    );
  }

  if (previous?.vercel && current.vercel) {
    addMetric(
      metrics,
      "Vercel adjusted pageviews",
      current.vercel.adjustedPageViews,
      previous.vercel.adjustedPageViews,
      "pageviews",
    );
  }

  if (previous?.dataforseo && current.dataforseo) {
    addMetric(
      metrics,
      "DataForSEO Google top-100 checks",
      countTop100(current.dataforseo.googleRankings),
      countTop100(previous.dataforseo.googleRankings),
      "checks",
    );
    addMetric(
      metrics,
      "DataForSEO ASO top-100 checks",
      countTop100(current.dataforseo.asoRankings),
      countTop100(previous.dataforseo.asoRankings),
      "checks",
    );
  }

  if (metrics.length === 0) return undefined;
  return { previousAuditDate, metrics };
}

function addMetric(
  metrics: WeeklySeoComparison["metrics"],
  label: string,
  current: number,
  previous: number,
  unit: string,
): void {
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return;
  if (current === 0 && previous === 0) return;
  metrics.push({ label, current, previous, unit });
}

function countTop100(rows: Array<{ quiverRank: number | null }>): number {
  return rows.filter((row) => row.quiverRank !== null && row.quiverRank <= 100).length;
}

function renderSourceFreshness(
  freshness: WeeklySeoReportInput["sourceFreshness"],
): string {
  if (!freshness?.length) return "- Source freshness was not recorded for this run.";
  return [
    "- Freshness policy: FRESH = 0–1 days old; LAGGED = 2–3 days; STALE = more than 3 days; MISSING = no dated input.",
    ...freshness.map((source) =>
      `- ${source.source}: ${source.status.toUpperCase()}${source.observedAt ? ` (${source.observedAt})` : ""} — ${source.note}`,
    ),
  ].join("\n");
}

function renderWeekOverWeek(comparison?: WeeklySeoComparison): string {
  if (!comparison?.metrics.length) return "- No comparable prior-week metrics were available.";
  const rows = comparison.previousAuditDate
    ? [`- Comparison baseline: audit ${comparison.previousAuditDate}.`]
    : [];
  rows.push(...comparison.metrics.map((metric) => {
    const delta = metric.current - metric.previous;
    const percent = metric.previous === 0 ? "n/a" : `${formatSigned((delta / metric.previous) * 100, 1)}%`;
    return `- ${metric.label}: ${formatMetricNumber(metric.current)} ${metric.unit}; prior ${formatMetricNumber(metric.previous)}; change ${formatSigned(delta, 0)} (${percent}).`;
  }));
  if (comparison.missing?.length) {
    rows.push(...comparison.missing.map((item) => `- Comparison gap: ${item}`));
  }
  return rows.join("\n");
}

function mergeTechnicalRecommendations(
  technical: SeoRecommendation[],
  recommendations: SeoRecommendation[],
): SeoRecommendation[] {
  const ahrefsIssues = recommendations.filter((item) =>
    item.source === "ahrefs-audit" && !item.targetKeyword,
  );
  return [...new Map([...technical, ...ahrefsIssues].map((item) => [item.id, item])).values()];
}

function renderBottomLine(
  input: WeeklySeoReportInput,
  openRecommendations: SeoRecommendation[],
): string {
  const actionQueue = synthesizeWeeklyActionQueue(input);
  const parts = [
    `${openRecommendations.length} underlying recommendation${openRecommendations.length === 1 ? "" : "s"} from available sources, synthesized into ${actionQueue.actions.length} weekly action${actionQueue.actions.length === 1 ? "" : "s"}.`,
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
  if (input.competitor?.technicalSurfaces.length) {
    parts.push(`${input.competitor.technicalSurfaces.length} competitor technical surface${input.competitor.technicalSurfaces.length === 1 ? "" : "s"} reviewed.`);
  }
  if (input.dataforseo && isConfiguredDataForSeo(input.dataforseo)) {
    const dataForSeoStatus = input.dataforseo.status ?? "complete";
    const descriptor = dataForSeoStatus === "complete"
      ? "DataForSEO"
      : `DataForSEO ${dataForSeoStatus}`;
    parts.push(`${descriptor}: ${input.dataforseo.googleRankings.length} Google rank checks, ${input.dataforseo.asoRankings.length} ASO rank checks, ${input.dataforseo.competitorKeywords.length} competitor keyword rows.`);
  }
  if (input.aeo?.engines.length) {
    parts.push(`AEO engines tracked: ${input.aeo.engines.map((engine) => `${engine.engine}=${engine.citations}`).join(", ")}.`);
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
  // Non-keyword ahrefs-audit findings render under Technical Crawl Health via
  // mergeTechnicalRecommendations. Keeping them here too printed each one twice.
  const keywordRecs = recommendations.filter((item) =>
    item.source === "gsc-decay" ||
    (item.source === "ahrefs-audit" && Boolean(item.targetKeyword)),
  );
  const rows = [
    ...renderDataForSeoGoogleRanks(dataforseo),
    ...renderDataForSeoSerpFeatures(dataforseo),
    ...renderDataForSeoKeywordMetrics(dataforseo),
    ...keywordRecs.slice(0, 8).map((item) =>
      `- ${item.priority.toUpperCase()}: \`${item.canonicalPath}\`${item.targetKeyword ? ` (${item.targetKeyword})` : ""} - ${item.summary}`,
    ),
  ];
  if (gsc?.topQueries.length) {
    rows.push(`- Highest-click GSC query: "${gsc.topQueries[0]?.query}" (${gsc.topQueries[0]?.clicks ?? 0} clicks).`);
  }
  return rows.length ? rows.join("\n") : "- No keyword movement available.";
}

function renderCtrCohortMonitoring(recommendations: SeoRecommendation[]): string {
  const monitors = recommendations
    .filter((item) => item.source === "gsc-decay" && /^CTR monitor:/i.test(item.summary))
    .sort((a, b) => a.canonicalPath.localeCompare(b.canonicalPath));

  if (monitors.length === 0) return "- No dedicated CTR cohorts are configured.";

  return monitors.map((item) => {
    const evidence = item.evidence
      .filter((entry) => /^(28d=|ctr=|avgPosition=|monitorUntil=|reason=)/.test(entry))
      .join("; ");
    return `- Monitor-only: \`${item.canonicalPath}\`${item.targetKeyword ? ` (${item.targetKeyword})` : ""} — ${evidence}`;
  }).join("\n");
}

function renderGoogleIndexingHealth(gsc?: GscExportInput): string {
  const indexing = gsc?.indexing;
  if (!indexing) {
    return "- GSC URL Inspection watchlist was unavailable; no direct Google crawl/index state was checked.";
  }

  const blockers = indexing.results.filter((item) => isGoogleIndexingBlocker(item.coverageState));
  const rows = [
    `- Read-only URL Inspection checked ${indexing.results.length} configured high-value URL${indexing.results.length === 1 ? "" : "s"}. This is a watchlist, not sitewide index coverage.`,
  ];

  if (blockers.length > 0) {
    rows.push(`- ${blockers.length} URL${blockers.length === 1 ? " requires" : "s require"} indexing investigation; URL Inspection reports exclusion state, not root cause:`);
    rows.push(...blockers.map((item) => {
      const details = [
        item.label,
        item.coverageState,
        item.lastCrawlTime ? `last crawl ${item.lastCrawlTime}` : "no crawl recorded",
        item.sitemap?.length ? "sitemap known" : "no sitemap reported",
      ].filter(Boolean).join("; ");
      return `  - HIGH: \`${item.canonicalPath}\` — ${details}.`;
    }));
  } else if (indexing.results.length > 0) {
    rows.push("- No configured URLs were reported as unknown to Google or discovered/crawled but currently not indexed.");
  }

  if (indexing.missing?.length) {
    rows.push(...indexing.missing.map((item) => `- URL Inspection gap: ${item}`));
  }
  const individualErrors = indexing.results
    .filter((item) => item.error)
    .map((item) => `- URL Inspection gap for \`${item.canonicalPath}\`: ${item.error}`);
  rows.push(...individualErrors);
  return rows.join("\n");
}

function isGoogleIndexingBlocker(coverageState: string | undefined): boolean {
  return /^(discovered|crawled) - currently not indexed$/i.test(coverageState ?? "") ||
    /^url is unknown to google$/i.test(coverageState ?? "");
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
  const spamRows = sum(backlink.manualExports.map((item) => item.spamRows ?? 0));
  const nonSpamRows = sum(backlink.manualExports.map((item) => item.nonSpamRows ?? 0));
  const dofollowLinks = sum(backlink.manualExports.map((item) => item.dofollowLinks ?? 0));
  const sampleDomains = backlink.manualExports.flatMap((item) => item.sampleReferringDomains ?? []);
  const citationDomains = backlink.manualExports.flatMap((item) => item.topCitationDomains ?? []);
  const topManualDomains = [...new Set(sampleDomains)].slice(0, 8);
  const topCitationDomains = [...new Map(citationDomains.map((row) => [row.domain, row])).values()]
    .sort((a, b) => b.links - a.links || (b.domainRating ?? 0) - (a.domainRating ?? 0))
    .slice(0, 6);
  const rows = [
    `- Vercel referrer domains/labels: ${backlink.referrers.length}.`,
    `- Embed referrer domains: ${backlink.embedReferrers.length}.`,
    `- Outreach rows parsed: ${backlink.outreachStatuses.length}.`,
    `- Manual backlink exports imported: ${backlink.manualExports.length} file${backlink.manualExports.length === 1 ? "" : "s"} / ${manualRows} row${manualRows === 1 ? "" : "s"} / ${manualDomains} referring-domain observations.`,
    manualRows > 0
      ? `- Manual backlink quality mix: ${nonSpamRows} non-spam rows, ${spamRows} spam-labeled rows, ${dofollowLinks} dofollow links.`
      : "- Manual backlink quality mix: no imported manual backlink rows.",
    topCitationDomains.length
      ? `- Top likely citation/backlink domains: ${topCitationDomains.map((row) => `${row.domain}${row.domainRating ? ` (DR ${row.domainRating})` : ""}`).join(", ")}.`
      : "- Top likely citation/backlink domains: none surfaced from manual exports.",
    topManualDomains.length
      ? `- Manual backlink sample domains: ${topManualDomains.join(", ")}.`
      : "- Manual backlink sample domains: none imported.",
  ];

  const narrative = backlink.narrativeTargets;
  if (narrative) {
    rows.push(`- Backlink target report (${narrative.reportDate || "date n/a"}): ${narrative.confirmed.length} confirmed, ${narrative.unverified.length} unverified target${narrative.confirmed.length + narrative.unverified.length === 1 ? "" : "s"}.`);
    const topTargets = narrative.confirmed.slice(0, 5).map((target) => target.target);
    if (topTargets.length) {
      rows.push(`- Confirmed replacement-link targets: ${topTargets.join(", ")}.`);
    }
  }

  return rows.join("\n");
}

function renderAeo(aeo?: AeoCitationInput): string {
  if (!aeo) return "- AEO / citation export unavailable.";

  const rows: string[] = [];
  const aiReferrers = aeo.aiReferrers
    .slice()
    .sort((a, b) => b.visits - a.visits)
    .slice(0, 6);
  const engines = aeo.engines
    .slice()
    .sort((a, b) => b.citations - a.citations)
    .slice(0, 8);
  const llmsFiles = aeo.llmsFiles.map((file) =>
    `${file.path.replace(/^.*\/public\//, "")}: ${file.exists ? `${file.lines} lines` : "missing"}`);

  const baseline = aeo.narrativeBaseline;
  if (baseline) {
    const overall = baseline.overall
      ? `${(baseline.overall.rate * 100).toFixed(1)}% (${baseline.overall.cited}/${baseline.overall.total})`
      : "n/a";
    rows.push(`- Citation baseline (${baseline.reportDate || "date n/a"}): ${overall} of tracked AEO queries cite Quiver${baseline.status ? ` [${baseline.status}]` : ""}.`);
    if (baseline.segments.length) {
      rows.push(`- Baseline by segment: ${baseline.segments.map((segment) => `${segment.segment} ${(segment.rate * 100).toFixed(0)}% (${segment.cited}/${segment.total})`).join("; ")}.`);
    }
  } else {
    rows.push("- Citation baseline: no aeo-citation-tracking report found; run a live 30-query audit to establish one.");
  }

  rows.push(`- llms inventory: ${llmsFiles.join(", ")}.`);
  rows.push(aiReferrers.length
    ? `- AI referrers seen in Vercel: ${aiReferrers.map((row) => `${row.referrer}=${row.visits}`).join(", ")}.`
    : "- AI referrers seen in Vercel: none in the current export.");
  rows.push(engines.length
    ? `- Ahrefs AI citation snapshot: ${engines.map((engine) => `${engine.engine}=${engine.citations} citations/${engine.pages} pages`).join(", ")}.`
    : "- Ahrefs AI citation snapshot unavailable.");
  rows.push(aeo.citationDomains.length
    ? `- Likely citation domains: ${aeo.citationDomains.map((row) => `${row.domain}${row.domainRating ? ` (DR ${row.domainRating})` : ""}`).join(", ")}.`
    : "- Likely citation domains: none identified from the available Ahrefs snapshot.");

  return rows.join("\n");
}

function renderOutreach(outreach?: OutreachDigestInput): string {
  if (!outreach) return "- Outreach digest unavailable.";

  const counts = Object.entries(outreach.statusCounts)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([status, count]) => `${status}=${count}`)
    .join(", ");
  const rows = [
    `- Rotation week ${outreach.rotationWeek}: ${rotationLabel(outreach.rotationCategory)}.`,
    `- Tracker queue (${outreach.totalRows} target row${outreach.totalRows === 1 ? "" : "s"}): ${counts || "no status rows parsed"}.`,
  ];

  if (outreach.candidates.length === 0) {
    rows.push("- No queued targets in this week's rotation category; nothing to draft.");
  } else {
    rows.push(`- Draft candidates ready for review (${outreach.candidates.length}):`);
    for (const candidate of outreach.candidates) {
      const contact = candidate.requiresContactResearch
        ? "contact research required"
        : candidate.contact ?? candidate.website ?? "contact unavailable";
      rows.push(`  - ${candidate.target} (${contact}) - subject: "${candidate.subject}"`);
    }
    const researchCount = outreach.candidates.filter((candidate) => candidate.requiresContactResearch).length;
    if (researchCount > 0) {
      rows.push(`- ${researchCount} candidate${researchCount === 1 ? "" : "s"} ${researchCount === 1 ? "requires" : "require"} contact research before Gmail drafting.`);
    }
    rows.push("- Live action: research missing contacts, create Gmail drafts only after verifying a direct email, and then set matching tracker rows to `drafted` (live runs only; never sent).");
  }

  return rows.join("\n");
}

function rotationLabel(category: OutreachRotationCategory): string {
  switch (category) {
    case "surf-schools":
      return "surf schools";
    case "surf-bloggers":
      return "surf bloggers & micro-influencers";
    case "coastal-businesses":
      return "coastal businesses (hotels, tourism, shops)";
    case "publications":
      return "publication / data-story pitches";
    default:
      return category;
  }
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
  const rows = posthog.nativeFunnels.map((funnel) => {
    const events = Object.entries(funnel.events)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([event, count]) => `${event}=${count}`)
      .join(", ");
    return `- ${funnel.platform}: ${events || "no events"}`;
  });
  return [
    "- Directional native event counts; these are not unique users or conversion rates.",
    ...rows,
  ].join("\n");
}

function renderCompetitorDeltas(
  store?: StoreSnapshotInput,
  competitor?: CompetitorIntelligenceInput,
  dataforseo?: DataForSeoExportInput,
): string {
  const deltas = [
    ...renderStructuredCompetitorMaterialDeltas(competitor?.materialDeltas ?? [], competitor?.runId),
    ...renderStructuredCompetitorDeltas(store?.competitorDeltas ?? []),
    ...renderCompetitorKeywordCoverage(dataforseo),
  ];
  const deduped = [...new Set(deltas)];
  return deduped.length ? deduped.map((delta) => `- ${delta}`).join("\n") : "- No competitor deltas in available inputs.";
}

function renderCompetitorTechnicalSurfaces(competitor?: CompetitorIntelligenceInput): string {
  if (!competitor || competitor.technicalSurfaces.length === 0) {
    return "- Competitor technical-surface export unavailable.";
  }

  return competitor.technicalSurfaces.map((surface) => {
    const statusParts = [
      typeof surface.robotsStatus === "number" ? `robots ${surface.robotsStatus}` : null,
      typeof surface.sitemapStatus === "number" ? `sitemap ${surface.sitemapStatus}` : null,
      typeof surface.sitemapCount === "number" ? `${surface.sitemapCount.toLocaleString()} sitemap URLs` : null,
      surface.schemaSupport === "present"
        ? "raw HTML schema markers present"
        : surface.schemaSupport === "missing"
          ? "no raw HTML schema markers"
          : null,
    ].filter(Boolean);
    const note = surface.notes[0] ? ` ${surface.notes[0]}` : "";
    return `- ${surface.competitor}: ${statusParts.join("; ") || "no structured technical summary"}.${
      note ? ` Note: ${note}` : ""
    }`;
  }).join("\n");
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

function renderWeeklyActions(
  items: WeeklyActionItem[],
  fallbackNote?: string,
): string {
  const rows = items.map((item) => {
    const evidence = item.evidence.slice(0, 3).join("; ");
    return [
      `- ${item.priority.toUpperCase()} [${item.source.toUpperCase()}] ${item.title}`,
      `  Next: ${item.nextStep} Evidence: ${evidence}. Why now: ${item.whyNow}`,
    ].join("\n");
  });

  if (fallbackNote) rows.push(`- Note: ${fallbackNote}`);

  return rows.length > 0
    ? rows.join("\n")
    : "- No high-confidence weekly actions from available inputs.";
}

function renderExecutionPlan(items: WeeklyActionItem[]): string {
  if (items.length === 0) {
    return "- No execution plan generated because there are no weekly actions.";
  }

  const rows = items.slice(0, 5).map((item, index) =>
    `${index + 1}. ${executionPhaseLabel(index, item.source)}: [${item.source.toUpperCase()}] ${item.title}. Deliverable: ${item.nextStep}`,
  );

  rows.push(`${rows.length + 1}. End of week: rerun the weekly SEO + ASO report and compare CTR, rank, competitor, and ASO deltas against this baseline.`);
  return rows.join("\n");
}

function executionPhaseLabel(index: number, source: WeeklyActionItem["source"]): string {
  if (index === 0) return "Day 1";
  if (source === "competitor" || source === "aeo" || source === "aso") return "Day 2";
  if (index <= 2) return "Day 3";
  if (index === 3) return "Day 4";
  return "Day 5";
}

function renderCoverageNotes(input: WeeklySeoReportInput): string {
  const missing = [
    ...input.missing,
    ...(input.vercel?.missing ?? []),
    ...(input.posthog?.missing ?? []),
    ...(input.store?.missing ?? []),
    ...(input.dataforseo?.missing ?? []),
    ...(input.backlink?.missing ?? []),
    ...(input.competitor?.missing ?? []),
    ...(input.aeo?.missing ?? []),
    ...(input.outreach?.missing ?? []),
  ];
  const hasDataForSeo = isConfiguredDataForSeo(input.dataforseo) &&
    ((input.dataforseo?.googleRankings.length ?? 0) > 0 ||
      (input.dataforseo?.asoRankings.length ?? 0) > 0 ||
      (input.dataforseo?.competitorKeywords.length ?? 0) > 0);
  const manualExportCount = input.backlink?.manualExports.length ?? 0;
  const manualRows = sum(input.backlink?.manualExports.map((item) => item.rows) ?? []);
  const manualDomains = sum(input.backlink?.manualExports.map((item) => item.uniqueReferringDomains ?? 0) ?? []);
  const competitorCount = new Set(input.dataforseo?.competitorKeywords.map((row) => row.competitor) ?? []).size;
  const rows = [
    !input.dataforseo || isMissingDataForSeoConfig(input.dataforseo)
      ? "- DataForSEO is not configured, so rank tracking is limited to GSC average position and public store/search snapshots."
      : isConfiguredDataForSeo(input.dataforseo) && (input.dataforseo?.status ?? "complete") !== "complete"
        ? `- DataForSEO is configured but ${input.dataforseo?.status ?? "partial"}; completed phases: ${(input.dataforseo?.completedPhases ?? []).join(", ") || "none"}; failed phases: ${(input.dataforseo?.failedPhases ?? []).join(", ") || "none"}.`
        : hasDataForSeo
          ? "- DataForSEO is enabled for tracked Google SERP, ASO, and competitor keyword snapshots. Backlinks API is intentionally disabled."
          : "- DataForSEO is configured but returned no completed ranking, ASO, or competitor rows in this run.",
    input.backlink
      ? `- Backlink coverage uses free/provided sources: Vercel referrers, widget embed referrers, outreach tracker rows, and ${manualExportCount} manual export file${manualExportCount === 1 ? "" : "s"} (${manualRows} rows, ${manualDomains} referring-domain observations). No paid full backlink index is configured.`
      : "- Backlink coverage uses free/provided sources when available: Vercel referrers, widget embeds, outreach rows, and manual CSV/JSON exports. No paid full backlink index is configured.",
    input.store?.competitorDeltas.length
      ? `- Competitor deltas use the latest structured competitor report snapshot (${input.store.competitorDeltas[0]?.runId ?? "unknown run"}), not freeform automation memory.`
      : "- Competitor deltas are unavailable unless a structured competitor report snapshot is present.",
    input.competitor?.technicalSurfaces.length
      ? `- Competitor technical surfaces are parsed from the latest competitor deep-dive run (${input.competitor.runId ?? "unknown run"}), then summarized into this weekly report.`
      : "- Competitor technical surfaces are unavailable unless the latest competitor deep-dive report is present.",
    input.aeo?.engines.length || input.aeo?.aiReferrers.length || input.aeo?.llmsFiles.length
      ? "- AEO coverage combines llms inventory, AI referrer traffic, Ahrefs AI citation snapshots, and the latest citation-tracking baseline when present. Live proxy audits are fallback only; they are not a true multi-engine AI-answer citation measurement."
      : "- AEO coverage is unavailable unless llms files, AI referrers, or Ahrefs citation snapshots are present.",
    input.outreach
      ? `- Outreach coverage reads docs/seo/outreach-tracker.md: week-${input.outreach.rotationWeek} rotation, ${input.outreach.candidates.length} draft candidate${input.outreach.candidates.length === 1 ? "" : "s"} proposed. Gmail drafting runs only in live mode and never sends.`
      : "- Outreach coverage is unavailable unless docs/seo/outreach-tracker.md is present.",
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

function isMissingDataForSeoConfig(dataforseo?: DataForSeoExportInput): boolean {
  const missing = dataforseo?.missing ?? [];
  return missing.includes("DATAFORSEO_DISABLED_BY_CONFIG") ||
    missing.includes("DATAFORSEO_LOGIN") ||
    missing.includes("DATAFORSEO_PASSWORD");
}

function isConfiguredDataForSeo(dataforseo?: DataForSeoExportInput): boolean {
  return !!dataforseo && !isMissingDataForSeoConfig(dataforseo);
}

function renderStructuredCompetitorDeltas(deltas: CompetitorDelta[]): string[] {
  return [...new Map(deltas.map((delta) => [
    `${delta.runId}\u0000${delta.summary}`,
    `Structured competitor report (${delta.runId}): ${sanitizeDeltaSummary(delta.summary)}`,
  ])).values()];
}

function renderStructuredCompetitorMaterialDeltas(
  deltas: string[],
  runId?: string,
): string[] {
  return deltas.map((summary) =>
    `Structured competitor report (${runId ?? "unknown run"}): ${sanitizeDeltaSummary(summary)}`);
}

function sanitizeDeltaSummary(summary: string): string {
  return summary.replace(/^-+\s*/, "").trim();
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

function renderDataForSeoSerpFeatures(dataforseo?: DataForSeoExportInput): string[] {
  return (dataforseo?.googleRankings ?? [])
    .filter((rank) => (rank.serpFeatures?.length ?? 0) > 0)
    .slice()
    .sort((a, b) => featurePressureScore(b) - featurePressureScore(a))
    .slice(0, 5)
    .map((rank) => {
      const features = (rank.serpFeatures ?? [])
        .slice(0, 4)
        .map((feature) => feature.type)
        .join(", ");
      return `- SERP feature pressure: "${rank.keyword}" has ${features}.`;
    });
}

function renderDataForSeoKeywordMetrics(dataforseo?: DataForSeoExportInput): string[] {
  return (dataforseo?.keywordMetrics ?? [])
    .slice()
    .sort((a, b) => (b.searchVolume ?? 0) - (a.searchVolume ?? 0))
    .slice(0, 6)
    .map((metric) => {
      const volume = metric.searchVolume ?? "n/a";
      const intent = metric.intent?.main ?? "n/a";
      const monthlyTrend = formatSignedPercent(metric.trend?.monthly);
      return `- DataForSEO keyword metrics: "${metric.keyword}" vol ${volume}, intent ${intent}, trend monthly ${monthlyTrend}.`;
    });
}

function renderDataForSeoAsoRanks(dataforseo?: DataForSeoExportInput): string[] {
  if (!dataforseo || dataforseo.asoRankings.length === 0) return [];
  const ambiguousRanks = dataforseo.asoRankings.filter((rank) => isAmbiguousAsoBrandKeyword(rank.keyword));
  const cleanRanks = dataforseo.asoRankings.filter((rank) => !isAmbiguousAsoBrandKeyword(rank.keyword));
  const found = cleanRanks.filter((rank) => rank.quiverRank !== null);
  return [
    `- DataForSEO ASO rank checks: ${found.length}/${cleanRanks.length} clean tracked store searches found Quiver in the top ${cleanRanks[0]?.depth ?? dataforseo.asoRankings[0]?.depth ?? 100}.`,
    ...cleanRanks
      .slice()
      .sort((a, b) => (a.quiverRank ?? 999) - (b.quiverRank ?? 999))
      .slice(0, 8)
      .map((rank) => {
        const quiver = rank.quiverRank === null ? "not top 100" : `rank ${rank.quiverRank}`;
        const leader = rank.topCompetitors[0]?.app ? `; leader=${rank.topCompetitors[0]?.app}` : "";
        return `- DataForSEO ${rank.platform}: "${rank.keyword}" - Quiver ${quiver}${leader}.`;
      }),
    ...ambiguousRanks.map((rank) => {
      const leader = rank.topCompetitors[0]?.app ?? "unknown";
      return `- Ambiguous ASO keyword excluded: "${rank.keyword}"; top result=${leader}.`;
    }),
  ];
}

function renderCompetitorKeywordCoverage(dataforseo?: DataForSeoExportInput): string[] {
  const rawRows = dataforseo?.competitorKeywords ?? [];
  if (rawRows.length === 0) return [];
  const rows = filterRelevantCompetitorKeywordRows(rawRows);
  if (rows.length === 0) {
    return [`DataForSEO Labs actionable competitor keyword rows: 0 rows from ${rawRows.length} raw rows after surf/app/forecast intent filtering.`];
  }

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
  const productFitRows = rows.filter((row) => isProductLedKeyword(row.keyword));
  const actionableRows = rows;
  const keywordRows = productFitRows.length
    ? productFitRows
    : actionableRows.length
      ? actionableRows
      : rows;
  const keywordLabel = productFitRows.length
    ? "Product-fit competitor keyword opportunities by volume"
    : actionableRows.length
      ? "Top actionable competitor keyword opportunities by volume"
      : "Top competitor keywords by volume";
  const topKeywords = keywordRows
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
    `DataForSEO Labs actionable competitor keyword rows: ${rows.length} rows from ${rawRows.length} raw rows across ${byCompetitor.size} competitors (${competitorSummary}).`,
    topKeywords ? `${keywordLabel}: ${topKeywords}.` : "",
    clusterSummary ? `Competitor keyword clusters: ${clusterSummary}.` : "",
    topPages ? `Competitor ranking pages with the broadest keyword footprint: ${topPages}.` : "",
  ].filter((row) => row.length > 0);
}

function renderProductLedOpportunities(
  gsc: GscExportInput | undefined,
  dataforseo: DataForSeoExportInput | undefined,
): string {
  const rows = [
    ...productLedGscPages(gsc).map((page) =>
      `- ${productLedLabel(page.page)}: \`${page.page}\` - ${page.impressions} impressions, ${page.clicks} clicks, avg position ${formatNumber(page.position)}. Improve the page around judgment, timing, local conditions, and app/session CTAs.`,
    ),
    ...productLedAsoKeywords(dataforseo).map((rank) => {
      const quiver = rank.quiverRank === null ? "not top 100" : `rank ${rank.quiverRank}`;
      const leader = rank.topCompetitors[0]?.app ? `; leader=${rank.topCompetitors[0].app}` : "";
      return `- ASO product wedge: "${rank.keyword}" (${rank.platform}) - Quiver ${quiver}${leader}.`;
    }),
    ...productLedCompetitorKeywords(dataforseo).map((row) =>
      `- Competitor-inspired content: "${row.keyword}" (${row.competitor}, vol ${row.searchVolume ?? "n/a"}, rank ${row.rank ?? "n/a"}) - use as education that leads into Quiver forecast/session workflows.`,
    ),
  ];

  return rows.length
    ? rows.slice(0, 12).join("\n")
    : "- No product-led SEO opportunities in available inputs.";
}

function renderDoNotChase(
  gsc: GscExportInput | undefined,
  dataforseo: DataForSeoExportInput | undefined,
): string {
  const gscRows = (gsc?.topPages ?? [])
    .filter((page) => isCommodityFactPhrase(page.page))
    .slice()
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 5)
    .map((page) =>
      `- Commodity fact page: \`${page.page}\` - ${page.impressions} impressions but answer is mostly a fact box unless paired with surf timing/context.`,
    );
  const competitorRows = (dataforseo?.competitorKeywords ?? [])
    .filter((row) => isLowFitCompetitorKeyword(row.keyword))
    .slice()
    .sort((a, b) => (b.searchVolume ?? 0) - (a.searchVolume ?? 0))
    .slice(0, 5)
    .map((row) =>
      `- Low-fit competitor keyword: "${row.keyword}" (${row.competitor}, vol ${row.searchVolume ?? "n/a"}) - informational/trivia traffic, weak product intent.`,
    );
  const rows = [...gscRows, ...competitorRows];

  return rows.length
    ? rows.join("\n")
    : "- No obvious commodity fact or low-fit trivia targets in available inputs.";
}

function productLedGscPages(gsc?: GscExportInput): GscExportInput["topPages"] {
  return (gsc?.topPages ?? [])
    .filter((page) => isProductLedSeoPath(page.page))
    .slice()
    .sort((a, b) => {
      const productDelta = productLedScore(b.page) - productLedScore(a.page);
      if (productDelta !== 0) return productDelta;
      return b.impressions - a.impressions;
    })
    .slice(0, 8);
}

function productLedAsoKeywords(dataforseo?: DataForSeoExportInput): DataForSeoExportInput["asoRankings"] {
  return (dataforseo?.asoRankings ?? [])
    .filter((rank) => !isAmbiguousAsoBrandKeyword(rank.keyword))
    .filter((rank) => isProductLedKeyword(rank.keyword))
    .slice()
    .sort((a, b) => {
      const delta = productLedScore(b.keyword) - productLedScore(a.keyword);
      if (delta !== 0) return delta;
      return (a.quiverRank ?? 999) - (b.quiverRank ?? 999);
    })
    .slice(0, 6);
}

function productLedCompetitorKeywords(dataforseo?: DataForSeoExportInput): DataForSeoExportInput["competitorKeywords"] {
  return filterRelevantCompetitorKeywordRows(dataforseo?.competitorKeywords ?? [])
    .filter((row) => isProductLedKeyword(row.keyword))
    .slice()
    .sort((a, b) => {
      const clusterDelta = productLedCompetitorClusterPriority(b.keyword) - productLedCompetitorClusterPriority(a.keyword);
      if (clusterDelta !== 0) return clusterDelta;
      const volumeDelta = (b.searchVolume ?? 0) - (a.searchVolume ?? 0);
      if (volumeDelta !== 0) return volumeDelta;
      const fitDelta = productLedScore(b.keyword) - productLedScore(a.keyword);
      if (fitDelta !== 0) return fitDelta;
      return a.keyword.localeCompare(b.keyword);
    })
    .slice(0, 6);
}

function productLedCompetitorClusterPriority(keyword: string): number {
  const cluster = classifyCompetitorKeyword(keyword);
  return PRODUCT_LED_COMPETITOR_CLUSTER_PRIORITY[cluster] ?? PRODUCT_LED_COMPETITOR_CLUSTER_PRIORITY.other ?? 0;
}

function productLedLabel(path: string): string {
  if (/dawn-patrol/i.test(path)) return "Dawn patrol planning";
  if (/best-time-to-surf/i.test(path)) return "Best-time planning";
  if (/longboard/i.test(path)) return "Board-fit planning";
  return "Local surf decision";
}

function isProductLedSeoPath(path: string): boolean {
  return /\/(best-time-to-surf|dawn-patrol|longboard)\//i.test(path) ||
    /\/[a-z]{2}\/[^/]+\/[^/]+$/i.test(path);
}

function isProductLedKeyword(keyword: string): boolean {
  return /(best time to surf|best tide|best wind|dawn patrol|surf session|surf journal|session log|surf tracker|custom spot|custom surf forecast|how to read.*surf forecast|swell period|wave period|swell height|surf height|wave height|wind swell|ground swell|beginner surf spots|surf forecast app|surf report app|surfline alternative|personal surf forecast)/i.test(keyword);
}

function isCommodityFactPhrase(value: string): boolean {
  return /(water-temp|water temp|water temperature|ocean temp|ocean temperature|tide-chart|\/tides$)/i.test(value);
}

function productLedScore(value: string): number {
  const text = value.toLowerCase();
  let score = 0;
  if (/(best-time-to-surf|best time to surf|best tide|best wind)/.test(text)) score += 5;
  if (/(dawn-patrol|dawn patrol)/.test(text)) score += 5;
  if (/(session|journal|tracker|log)/.test(text)) score += 4;
  if (/(custom spot|custom surf forecast|personal surf forecast)/.test(text)) score += 4;
  if (/(how to read|swell period|wave period|swell height|surf height|wave height|wind swell|ground swell)/.test(text)) score += 3;
  if (/(longboard|board-fit|board)/.test(text)) score += 3;
  if (/(water temp|water-temp|ocean temp|tide-chart|\/tides$|history|origin|invented)/.test(text)) score -= 5;
  return score;
}

function isAmbiguousAsoBrandKeyword(keyword: string): boolean {
  return keyword.trim().toLowerCase() === "quiver";
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function formatMetricNumber(value: number): string {
  return Number.isInteger(value) ? value.toLocaleString("en-US") : value.toFixed(1);
}

function formatSigned(value: number, decimals: number): string {
  const rounded = decimals === 0
    ? Math.abs(Math.round(value)).toLocaleString("en-US")
    : Math.abs(value).toFixed(decimals);
  return `${value >= 0 ? "+" : "-"}${rounded}`;
}

function formatNumber(value: number | undefined): string {
  return typeof value === "number" && Number.isFinite(value) ? value.toFixed(1) : "n/a";
}

function formatSignedPercent(value: number | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "n/a";
  return `${value >= 0 ? "+" : ""}${value}%`;
}

function featurePressureScore(rank: DataForSeoExportInput["googleRankings"][number]): number {
  return (rank.serpFeatures ?? []).reduce((total, feature) => {
    if (/ai_overview|featured_snippet/i.test(feature.type)) return total + 5;
    if (/people_also_ask|local_pack|images|video/i.test(feature.type)) return total + 3;
    return total + 1;
  }, 0);
}
