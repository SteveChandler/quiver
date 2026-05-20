import {
  makeSeoId,
  normalizeKeyword,
  normalizeSeoPath,
} from "./dashboard";
import type {
  GscPageRow,
  GscRefreshInput,
  SeoDashboard,
  SeoRecommendation,
} from "./types";

const LOW_CTR_IMPRESSIONS = 100;
const DECAY_MIN_PRIOR_IMPRESSIONS = 50;
const DECAY_DROP_RATIO = 0.5;

export interface MergedGscPageRow extends GscPageRow {
  rawPages: string[];
}

export function analyzeGscRefresh(
  input: GscRefreshInput,
  dashboard: SeoDashboard,
  now: string,
): SeoRecommendation[] {
  const recommendations: SeoRecommendation[] = [];
  const legacyCanonicalPathMap = buildLegacyCanonicalPathMap(input.sitemapPaths);
  const priorMap = mergeGscRowsByCanonicalPath(input.prior7d, legacyCanonicalPathMap);
  const lastMap = mergeGscRowsByCanonicalPath(input.last7d, legacyCanonicalPathMap);
  const last28Map = mergeGscRowsByCanonicalPath(input.last28d, legacyCanonicalPathMap);

  for (const [canonicalPath, prior] of priorMap) {
    const last = lastMap.get(canonicalPath) ?? emptyRow(canonicalPath);
    const impressionDrop = prior.impressions > 0
      ? (prior.impressions - last.impressions) / prior.impressions
      : 0;
    const clickDrop = prior.clicks > 0
      ? (prior.clicks - last.clicks) / prior.clicks
      : 0;

    if (
      prior.impressions >= DECAY_MIN_PRIOR_IMPRESSIONS &&
      (impressionDrop >= DECAY_DROP_RATIO || clickDrop >= DECAY_DROP_RATIO)
    ) {
      const evidence = [
        `prior7d=${prior.clicks} clicks/${prior.impressions} impressions`,
        `last7d=${last.clicks} clicks/${last.impressions} impressions`,
        ...rawPathEvidence(canonicalPath, prior, last),
      ];

      recommendations.push({
        id: makeSeoId("gsc-decay", canonicalPath),
        createdAt: now,
        source: "gsc-decay",
        priority: prior.clicks >= 5 || prior.impressions >= 250 ? "high" : "medium",
        canonicalPath,
        targetKeyword: dashboardKeyword(dashboard, canonicalPath),
        summary: "Refresh candidate: page lost at least 50% of prior-week search traction.",
        evidence,
        status: "open",
      });
    }
  }

  for (const [canonicalPath, row] of last28Map) {
    const ctr = getCtr(row);
    if (
      row.impressions >= LOW_CTR_IMPRESSIONS &&
      (row.clicks === 0 || ctr < 0.01) &&
      (row.position ?? 99) <= 20
    ) {
      const evidence = [
        `28d=${row.clicks} clicks/${row.impressions} impressions`,
        `ctr=${(ctr * 100).toFixed(2)}%`,
        `avgPosition=${(row.position ?? 0).toFixed(1)}`,
        ...rawPathEvidence(canonicalPath, row),
      ];

      recommendations.push({
        id: makeSeoId("gsc-low-ctr", canonicalPath),
        createdAt: now,
        source: "gsc-decay",
        priority: row.impressions >= 500 ? "high" : "medium",
        canonicalPath,
        targetKeyword: dashboardKeyword(dashboard, canonicalPath),
        summary: "CTR candidate: page has meaningful impressions but weak clicks.",
        evidence,
        status: "open",
      });
    }
  }

  const gscPaths = new Set(last28Map.keys());
  for (const sitemapPath of input.sitemapPaths.map(normalizeSeoPath)) {
    if (!gscPaths.has(sitemapPath)) {
      recommendations.push({
        id: makeSeoId("gsc-missing", sitemapPath),
        createdAt: now,
        source: "gsc-decay",
        priority: dashboardHasPath(dashboard, sitemapPath) ? "medium" : "low",
        canonicalPath: sitemapPath,
        targetKeyword: dashboardKeyword(dashboard, sitemapPath),
        summary: "Indexing candidate: sitemap URL has no GSC impressions in the 28-day window.",
        evidence: ["sitemap URL absent from 28-day GSC page rows"],
        status: "open",
      });
    }
  }

  return dedupeRecommendations(recommendations);
}

export function buildLegacyCanonicalPathMap(sitemapPaths: string[]): Map<string, string> {
  const pathsBySlug = new Map<string, string[]>();
  for (const path of sitemapPaths.map(normalizeSeoPath)) {
    if (path.startsWith("/beach/")) continue;

    const segments = path.split("/").filter(Boolean);
    const slug = segments[segments.length - 1];
    if (!slug || slug === "tides" || slug === "water-temp") continue;

    const candidates = pathsBySlug.get(slug) ?? [];
    candidates.push(path);
    pathsBySlug.set(slug, candidates);
  }

  const canonicalPathByLegacyPath = new Map<string, string>();
  for (const [slug, paths] of pathsBySlug) {
    if (paths.length === 1) {
      canonicalPathByLegacyPath.set(`/beach/${slug}`, paths[0]);
    }
  }

  return canonicalPathByLegacyPath;
}

export function canonicalizeGscPath(
  page: string,
  legacyCanonicalPathMap: Map<string, string>,
): string {
  const normalizedPath = normalizeSeoPath(page);
  return legacyCanonicalPathMap.get(normalizedPath) ?? normalizedPath;
}

export function mergeGscRowsByCanonicalPath(
  rows: GscPageRow[],
  legacyCanonicalPathMap: Map<string, string> = new Map(),
): Map<string, MergedGscPageRow> {
  interface Accumulator {
    page: string;
    clicks: number;
    impressions: number;
    positionWeight: number;
    positionTotal: number;
    rawPages: Set<string>;
  }

  const merged = new Map<string, Accumulator>();
  for (const row of rows) {
    const rawPath = normalizeSeoPath(row.page);
    const canonicalPath = canonicalizeGscPath(rawPath, legacyCanonicalPathMap);
    const current = merged.get(canonicalPath) ?? {
      page: canonicalPath,
      clicks: 0,
      impressions: 0,
      positionWeight: 0,
      positionTotal: 0,
      rawPages: new Set<string>(),
    };
    const positionWeight = row.impressions > 0 ? row.impressions : 1;

    current.clicks += row.clicks;
    current.impressions += row.impressions;
    current.rawPages.add(rawPath);
    if (typeof row.position === "number") {
      current.positionTotal += row.position * positionWeight;
      current.positionWeight += positionWeight;
    }

    merged.set(canonicalPath, current);
  }

  return new Map([...merged.entries()].map(([path, row]) => [
    path,
    {
      page: row.page,
      clicks: row.clicks,
      impressions: row.impressions,
      ctr: row.impressions > 0 ? row.clicks / row.impressions : 0,
      position: row.positionWeight > 0
        ? row.positionTotal / row.positionWeight
        : undefined,
      rawPages: [...row.rawPages].sort(),
    },
  ]));
}

function emptyRow(page: string): MergedGscPageRow {
  return { page, clicks: 0, impressions: 0, ctr: 0, position: 0, rawPages: [] };
}

function getCtr(row: GscPageRow): number {
  if (typeof row.ctr === "number") return row.ctr;
  return row.impressions > 0 ? row.clicks / row.impressions : 0;
}

function dashboardKeyword(
  dashboard: SeoDashboard,
  canonicalPath: string,
): string | undefined {
  const entry = dashboard.entries.find(
    (item) => item.canonicalPath === normalizeSeoPath(canonicalPath),
  );
  return entry ? normalizeKeyword(entry.targetKeyword) : undefined;
}

function dashboardHasPath(dashboard: SeoDashboard, canonicalPath: string): boolean {
  return dashboard.entries.some(
    (item) => item.canonicalPath === normalizeSeoPath(canonicalPath),
  );
}

function rawPathEvidence(
  canonicalPath: string,
  ...rows: MergedGscPageRow[]
): string[] {
  const rawPages = new Set<string>();
  for (const row of rows) {
    for (const page of row.rawPages) {
      rawPages.add(page);
    }
  }

  const rawPageList = [...rawPages].sort();
  if (
    rawPageList.length === 0 ||
    (rawPageList.length === 1 && rawPageList[0] === canonicalPath)
  ) {
    return [];
  }

  return [`rawPaths=${rawPageList.join(", ")} -> ${canonicalPath}`];
}

function dedupeRecommendations(
  recommendations: SeoRecommendation[],
): SeoRecommendation[] {
  return [...new Map(recommendations.map((item) => [item.id, item])).values()]
    .sort((a, b) => a.id.localeCompare(b.id));
}
