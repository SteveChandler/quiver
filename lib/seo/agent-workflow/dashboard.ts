import fs from "node:fs";
import path from "node:path";

import {
  SEO_DASHBOARD_VERSION,
  SEO_RECOMMENDATION_SOURCE_VALUES,
  SEO_STATUS_VALUES,
  type SeoDashboard,
  type SeoDashboardEntry,
  type SeoProposal,
  type SeoRecommendation,
  type SeoRecommendationSource,
  type SeoStatus,
} from "./types";

export const DEFAULT_SEO_DASHBOARD_PATH = path.join(
  process.cwd(),
  "docs/seo/seo-dashboard.json",
);

const STATUS_SET = new Set<string>(SEO_STATUS_VALUES);
const SOURCE_SET = new Set<string>(SEO_RECOMMENDATION_SOURCE_VALUES);

export function normalizeSeoPath(value: string): string {
  const parsed = value.startsWith("http://") || value.startsWith("https://")
    ? new URL(value)
    : new URL(value.startsWith("/") ? value : `/${value}`, "https://www.quiversurf.app");

  const normalized = parsed.pathname.replace(/\/{2,}/g, "/").replace(/\/$/, "");
  return normalized === "" ? "/" : normalized.toLowerCase();
}

export function normalizeKeyword(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

export function makeSeoId(prefix: string, value: string): string {
  const slug = `${prefix}-${normalizeSeoPath(value)}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "seo-entry-root";
}

export function parseSeoDashboard(raw: unknown): SeoDashboard {
  if (!isRecord(raw)) throw new Error("SEO dashboard must be an object");
  if (raw.version !== SEO_DASHBOARD_VERSION) {
    throw new Error(`Unsupported SEO dashboard version: ${String(raw.version)}`);
  }
  if (typeof raw.site !== "string") throw new Error("SEO dashboard site is required");
  if (typeof raw.updatedAt !== "string") {
    throw new Error("SEO dashboard updatedAt is required");
  }
  if (!Array.isArray(raw.entries)) throw new Error("SEO dashboard entries must be an array");
  if (!Array.isArray(raw.proposals)) {
    throw new Error("SEO dashboard proposals must be an array");
  }

  return {
    version: SEO_DASHBOARD_VERSION,
    site: raw.site,
    updatedAt: raw.updatedAt,
    entries: raw.entries.map(parseEntry),
    proposals: raw.proposals.map(parseProposal),
  };
}

export function readSeoDashboard(filePath = DEFAULT_SEO_DASHBOARD_PATH): SeoDashboard {
  return parseSeoDashboard(JSON.parse(fs.readFileSync(filePath, "utf8")));
}

export function writeSeoDashboard(
  dashboard: SeoDashboard,
  filePath = DEFAULT_SEO_DASHBOARD_PATH,
): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(sortDashboard(dashboard), null, 2)}\n`);
}

export function sortDashboard(dashboard: SeoDashboard): SeoDashboard {
  return {
    ...dashboard,
    entries: [...dashboard.entries].sort((a, b) =>
      a.canonicalPath.localeCompare(b.canonicalPath),
    ),
    proposals: [...dashboard.proposals].sort((a, b) =>
      a.targetKeyword.localeCompare(b.targetKeyword),
    ),
  };
}

export function createEmptyDashboard(now: string): SeoDashboard {
  return {
    version: SEO_DASHBOARD_VERSION,
    site: "https://www.quiversurf.app",
    updatedAt: now,
    entries: [],
    proposals: [],
  };
}

export function upsertSeoEntry(
  dashboard: SeoDashboard,
  entry: SeoDashboardEntry,
  now: string,
): SeoDashboard {
  const normalizedEntry = normalizeEntry(entry);
  const existingIndex = dashboard.entries.findIndex(
    (item) => item.canonicalPath === normalizedEntry.canonicalPath,
  );
  const entries = [...dashboard.entries];

  if (existingIndex === -1) {
    entries.push(normalizedEntry);
  } else {
    entries[existingIndex] = mergeEntry(entries[existingIndex], normalizedEntry);
  }

  return sortDashboard({ ...dashboard, updatedAt: now, entries });
}

export function upsertSeoProposal(
  dashboard: SeoDashboard,
  proposal: SeoProposal,
  now: string,
): SeoDashboard {
  const normalizedProposal: SeoProposal = {
    ...proposal,
    targetKeyword: normalizeKeyword(proposal.targetKeyword),
    canonicalPath: normalizeSeoPath(proposal.canonicalPath),
    competingUrls: uniqueSorted(proposal.competingUrls.map(normalizeSeoPath)),
  };
  const existingIndex = dashboard.proposals.findIndex(
    (item) =>
      normalizeKeyword(item.targetKeyword) === normalizedProposal.targetKeyword &&
      normalizeSeoPath(item.canonicalPath) === normalizedProposal.canonicalPath,
  );
  const proposals = [...dashboard.proposals];

  if (existingIndex === -1) {
    proposals.push(normalizedProposal);
  } else {
    proposals[existingIndex] = {
      ...proposals[existingIndex],
      ...normalizedProposal,
      status: proposals[existingIndex].status === "accepted"
        ? "accepted"
        : normalizedProposal.status,
    };
  }

  return sortDashboard({ ...dashboard, updatedAt: now, proposals });
}

export function findKeywordCannibalization(
  dashboard: SeoDashboard,
  targetKeyword: string,
  currentPath?: string,
): SeoDashboardEntry[] {
  const keyword = normalizeKeyword(targetKeyword);
  const pathToSkip = currentPath ? normalizeSeoPath(currentPath) : null;

  return dashboard.entries.filter((entry) => {
    if (pathToSkip && entry.canonicalPath === pathToSkip) return false;
    return normalizeKeyword(entry.targetKeyword) === keyword ||
      normalizeKeyword(entry.cluster.primaryKeyword) === keyword;
  });
}

export function findDuplicateTargetKeywords(
  dashboard: SeoDashboard,
): Map<string, SeoDashboardEntry[]> {
  const groups = new Map<string, SeoDashboardEntry[]>();
  for (const entry of dashboard.entries) {
    const keyword = normalizeKeyword(entry.targetKeyword);
    groups.set(keyword, [...(groups.get(keyword) ?? []), entry]);
  }

  for (const [keyword, entries] of groups) {
    if (entries.length < 2) groups.delete(keyword);
  }

  return groups;
}

function mergeEntry(
  existing: SeoDashboardEntry,
  incoming: SeoDashboardEntry,
): SeoDashboardEntry {
  return normalizeEntry({
    ...existing,
    ...incoming,
    status: mergeStatus(existing.status, incoming.status),
    cluster: {
      primaryKeyword: incoming.cluster.primaryKeyword || existing.cluster.primaryKeyword,
      secondarySemantics: uniqueSorted([
        ...existing.cluster.secondarySemantics,
        ...incoming.cluster.secondarySemantics,
      ]),
      intendedHeadings: uniqueSorted([
        ...existing.cluster.intendedHeadings,
        ...incoming.cluster.intendedHeadings,
      ]),
      linkedUrls: uniqueSorted([
        ...existing.cluster.linkedUrls,
        ...incoming.cluster.linkedUrls,
      ].map(normalizeSeoPath)),
    },
    recommendations: mergeRecommendations(
      existing.recommendations,
      incoming.recommendations,
    ),
  });
}

export function mergeStatus(existing: SeoStatus, incoming: SeoStatus): SeoStatus {
  if (incoming === "blocked") return "blocked";
  if (existing === "blocked") return "blocked";
  if (incoming === "refresh-needed") return "refresh-needed";
  if (existing === "refresh-needed" && incoming === "covered") {
    return "refresh-needed";
  }
  return incoming;
}

function parseEntry(raw: unknown): SeoDashboardEntry {
  if (!isRecord(raw)) throw new Error("SEO dashboard entry must be an object");
  if (typeof raw.id !== "string") throw new Error("SEO dashboard entry id is required");
  if (typeof raw.canonicalPath !== "string") {
    throw new Error(`SEO dashboard entry ${raw.id} canonicalPath is required`);
  }
  if (typeof raw.pageType !== "string") {
    throw new Error(`SEO dashboard entry ${raw.id} pageType is required`);
  }
  if (typeof raw.targetKeyword !== "string") {
    throw new Error(`SEO dashboard entry ${raw.id} targetKeyword is required`);
  }
  if (typeof raw.status !== "string" || !STATUS_SET.has(raw.status)) {
    throw new Error(`SEO dashboard entry ${raw.id} status is invalid`);
  }
  if (!isRecord(raw.cluster)) {
    throw new Error(`SEO dashboard entry ${raw.id} cluster is required`);
  }
  if (!Array.isArray(raw.recommendations)) {
    throw new Error(`SEO dashboard entry ${raw.id} recommendations must be an array`);
  }

  return normalizeEntry({
    id: raw.id,
    canonicalPath: raw.canonicalPath,
    pageType: raw.pageType,
    targetKeyword: raw.targetKeyword,
    status: raw.status as SeoStatus,
    cluster: {
      primaryKeyword: stringValue(raw.cluster.primaryKeyword),
      secondarySemantics: stringArray(raw.cluster.secondarySemantics),
      intendedHeadings: stringArray(raw.cluster.intendedHeadings),
      linkedUrls: stringArray(raw.cluster.linkedUrls).map(normalizeSeoPath),
    },
    recommendations: raw.recommendations.map(parseRecommendation),
  });
}

function parseProposal(raw: unknown): SeoProposal {
  if (!isRecord(raw)) throw new Error("SEO dashboard proposal must be an object");
  if (typeof raw.id !== "string") throw new Error("SEO dashboard proposal id is required");
  if (typeof raw.createdAt !== "string") {
    throw new Error(`SEO dashboard proposal ${raw.id} createdAt is required`);
  }
  if (typeof raw.source !== "string" || !SOURCE_SET.has(raw.source)) {
    throw new Error(`SEO dashboard proposal ${raw.id} source is invalid`);
  }

  return {
    id: raw.id,
    createdAt: raw.createdAt,
    source: raw.source as SeoRecommendationSource,
    priority: raw.priority === "critical" || raw.priority === "high" ||
      raw.priority === "medium" || raw.priority === "low"
      ? raw.priority
      : "medium",
    targetKeyword: stringValue(raw.targetKeyword),
    pageType: stringValue(raw.pageType),
    canonicalPath: normalizeSeoPath(stringValue(raw.canonicalPath)),
    reason: stringValue(raw.reason),
    competingUrls: stringArray(raw.competingUrls).map(normalizeSeoPath),
    status: raw.status === "accepted" || raw.status === "dismissed" ? raw.status : "open",
  };
}

function parseRecommendation(raw: unknown): SeoRecommendation {
  if (!isRecord(raw)) throw new Error("SEO recommendation must be an object");
  if (typeof raw.id !== "string") throw new Error("SEO recommendation id is required");
  if (typeof raw.source !== "string" || !SOURCE_SET.has(raw.source)) {
    throw new Error(`SEO recommendation ${raw.id} source is invalid`);
  }

  return {
    id: raw.id,
    createdAt: stringValue(raw.createdAt),
    source: raw.source as SeoRecommendationSource,
    priority: raw.priority === "critical" || raw.priority === "high" ||
      raw.priority === "medium" || raw.priority === "low"
      ? raw.priority
      : "medium",
    canonicalPath: normalizeSeoPath(stringValue(raw.canonicalPath)),
    targetKeyword: typeof raw.targetKeyword === "string"
      ? normalizeKeyword(raw.targetKeyword)
      : undefined,
    summary: stringValue(raw.summary),
    evidence: stringArray(raw.evidence),
    status: raw.status === "resolved" || raw.status === "dismissed" ? raw.status : "open",
  };
}

function normalizeEntry(entry: SeoDashboardEntry): SeoDashboardEntry {
  const canonicalPath = normalizeSeoPath(entry.canonicalPath);
  return {
    ...entry,
    id: entry.id || makeSeoId(entry.pageType, canonicalPath),
    canonicalPath,
    targetKeyword: normalizeKeyword(entry.targetKeyword),
    cluster: {
      primaryKeyword: normalizeKeyword(entry.cluster.primaryKeyword || entry.targetKeyword),
      secondarySemantics: uniqueSorted(entry.cluster.secondarySemantics.map(normalizeKeyword)),
      intendedHeadings: uniqueSorted(entry.cluster.intendedHeadings.map((item) => item.trim())),
      linkedUrls: uniqueSorted(entry.cluster.linkedUrls.map(normalizeSeoPath)),
    },
    recommendations: entry.recommendations.map(parseRecommendation),
  };
}

function mergeRecommendations(
  existing: SeoRecommendation[],
  incoming: SeoRecommendation[],
): SeoRecommendation[] {
  const byId = new Map<string, SeoRecommendation>();
  for (const item of existing) byId.set(item.id, item);
  for (const item of incoming) byId.set(item.id, item);
  return [...byId.values()].sort((a, b) => a.id.localeCompare(b.id));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}
