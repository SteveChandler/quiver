import fs from "node:fs";
import path from "node:path";
import { parse as parseCsv } from "csv-parse/sync";

import type {
  BacklinkNarrativeReport,
  BacklinkNarrativeTarget,
  BacklinkProxyInput,
  ManualBacklinkExport,
  VercelExportInput,
  VercelReferrerMetric,
} from "./types";

const OUTREACH_STATUS_VALUES = new Set([
  "queued",
  "drafted",
  "sent",
  "follow-up",
  "responded",
  "embed-live",
  "declined",
  "backlink-confirmed",
]);

export function buildBacklinkProxy(
  generatedAt: string,
  options: {
    vercel?: VercelExportInput;
    embedReferrers?: VercelReferrerMetric[];
    outreachMarkdown?: string;
    manualExports?: ManualBacklinkExport[];
    narrativeTargets?: BacklinkNarrativeReport;
    missing?: string[];
  },
): BacklinkProxyInput {
  return {
    generatedAt,
    referrers: options.vercel?.referrers ?? [],
    embedReferrers: options.embedReferrers ?? [],
    outreachStatuses: parseOutreachStatuses(options.outreachMarkdown ?? ""),
    manualExports: options.manualExports ?? [],
    narrativeTargets: options.narrativeTargets,
    missing: options.missing ?? [],
  };
}

export function discoverManualBacklinkExportFiles(
  directories: string[],
  explicitPaths: string[] = [],
): string[] {
  const files = new Set<string>();
  for (const filePath of explicitPaths) {
    if (filePath) files.add(path.resolve(filePath));
  }

  for (const directory of directories) {
    if (!fs.existsSync(directory)) continue;
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (!entry.isFile()) continue;
      const filePath = path.join(directory, entry.name);
      if (isManualBacklinkExportFile(filePath)) files.add(filePath);
    }
  }

  return [...files].filter((filePath) => fs.existsSync(filePath)).sort();
}

export function discoverManualBacklinkExports(
  paths: string[],
  missing: string[] = [],
): BacklinkProxyInput["manualExports"] {
  return paths
    .filter((filePath) => fs.existsSync(filePath))
    .map((filePath) => {
      try {
        return parseManualBacklinkExport(filePath);
      } catch (error) {
        missing.push(`Manual backlink export ${filePath}: ${errorMessage(error)}`);
        return null;
      }
    })
    .filter(isDefined);
}

export function parseOutreachStatuses(markdown: string): Array<{ target: string; status: string }> {
  return markdown
    .split(/\r?\n/)
    .filter((line) => line.trim().startsWith("|") && !line.includes("---"))
    .map((line) => line.split("|").map((cell) => cell.trim()).filter(Boolean))
    .filter((cells) => cells.length >= 2 && !/^target$/i.test(cells[0] ?? ""))
    .filter((cells) => !OUTREACH_STATUS_VALUES.has((cells[0] ?? "").replace(/`/g, "")))
    .map((cells) => {
      const status = cells.find((cell) => OUTREACH_STATUS_VALUES.has(cell.replace(/`/g, "")));
      return { target: cells[0] ?? "", status: status ?? "" };
    })
    .filter((row) => row.target.length > 0 && row.status.length > 0);
}

export function discoverLatestBacklinkReport(dir: string): string | null {
  if (!fs.existsSync(dir)) return null;
  const files = fs.readdirSync(dir)
    .filter((name) => /^\d{4}-\d{2}-\d{2}\.md$/.test(name))
    .sort();
  const last = files.at(-1);
  return last ? path.join(dir, last) : null;
}

export function parseBacklinkReport(
  markdown: string,
  reportPath = "",
): BacklinkNarrativeReport {
  const dateFromHeading = markdown
    .match(/#\s*Weekly Backlink Scan\s*-\s*(\d{4}-\d{2}-\d{2})/i)?.[1];
  const dateFromPath = path.basename(reportPath).match(/(\d{4}-\d{2}-\d{2})/)?.[1];
  const reportDate = dateFromHeading ?? dateFromPath ?? "";

  const confirmed: BacklinkNarrativeTarget[] = [];
  const unverified: BacklinkNarrativeTarget[] = [];
  let section: "confirmed" | "unverified" | null = null;
  let header: string[] | null = null;

  for (const line of markdown.split(/\r?\n/)) {
    const heading = line.match(/^#{2,3}\s+(.*)$/);
    if (heading) {
      const text = (heading[1] ?? "").toLowerCase();
      section = /confirmed target/.test(text)
        ? "confirmed"
        : /unverified target/.test(text)
          ? "unverified"
          : null;
      header = null;
      continue;
    }

    if (!line.trim().startsWith("|")) {
      header = null;
      continue;
    }
    if (!section) continue;

    const cells = line.trim().replace(/^\|/, "").replace(/\|$/, "")
      .split("|")
      .map((cell) => cell.trim());
    if (cells.every((cell) => /^:?-{2,}:?$/.test(cell) || cell === "")) {
      continue;
    }
    if (!header) {
      header = cells.map(normalizeHeader);
      continue;
    }

    const cols = header;
    const target = cells[0] ?? "";
    if (!target || /^target$/i.test(target)) continue;
    const get = (name: string): string => {
      const index = cols.indexOf(name);
      return index >= 0 ? (cells[index] ?? "").trim() : "";
    };
    const row: BacklinkNarrativeTarget = {
      target,
      sourceUrl: get("sourceurl") || undefined,
      status: get("status") || section,
      nextAction: get("nextaction") || undefined,
    };
    (section === "confirmed" ? confirmed : unverified).push(row);
  }

  return { reportDate, reportPath, confirmed, unverified };
}

function parseManualBacklinkExport(filePath: string): ManualBacklinkExport {
  const raw = fs.readFileSync(filePath, "utf8");
  const records = parseManualBacklinkRecords(filePath, raw);
  const rows = records.map(normalizeManualBacklinkRecord);
  const referringDomainCounts = countValues(rows.map((row) => row.sourceDomain).filter(Boolean));
  const targetUrlCounts = countValues(rows.map((row) => row.targetUrl).filter(Boolean));
  const nonSpamCounts = countValues(rows.filter((row) => !row.spam).map((row) => row.sourceDomain).filter(Boolean));
  const citationCounts = countValues(rows
    .filter((row) => !row.spam && row.dofollowLinks > 0)
    .map((row) => row.sourceDomain)
    .filter(Boolean));
  const ratingByDomain = new Map<string, number>();

  for (const row of rows) {
    if (!row.sourceDomain || typeof row.domainRating !== "number") continue;
    const current = ratingByDomain.get(row.sourceDomain) ?? 0;
    ratingByDomain.set(row.sourceDomain, Math.max(current, row.domainRating));
  }

  return {
    path: filePath,
    source: inferManualExportSource(filePath),
    rows: records.length,
    uniqueReferringDomains: referringDomainCounts.size,
    sampleReferringDomains: topCounts(referringDomainCounts, 10).map((row) => row.value),
    topTargetUrls: topCounts(targetUrlCounts, 8).map((row) => ({
      url: row.value,
      links: row.count,
    })),
    spamRows: rows.filter((row) => row.spam).length,
    nonSpamRows: rows.filter((row) => !row.spam).length,
    dofollowLinks: rows.reduce((total, row) => total + row.dofollowLinks, 0),
    topNonSpamDomains: topCounts(nonSpamCounts, 8).map((row) => ({
      domain: row.value,
      links: row.count,
      domainRating: ratingByDomain.get(row.value),
    })),
    topCitationDomains: topCounts(citationCounts, 8).map((row) => ({
      domain: row.value,
      links: row.count,
      domainRating: ratingByDomain.get(row.value),
    })),
  };
}

function parseManualBacklinkRecords(filePath: string, raw: string): Array<Record<string, unknown>> {
  if (filePath.toLowerCase().endsWith(".json")) {
    const parsed = JSON.parse(raw) as unknown;
    const rows = Array.isArray(parsed)
      ? parsed
      : isRecord(parsed)
        ? firstArrayValue(parsed, ["rows", "links", "backlinks", "data", "items", "results"])
        : [];
    return rows.filter(isRecord);
  }

  return parseCsv(raw, {
    bom: true,
    columns: true,
    relax_column_count: true,
    skip_empty_lines: true,
    trim: true,
  }) as Array<Record<string, unknown>>;
}

function normalizeManualBacklinkRecord(record: Record<string, unknown>): {
  sourceDomain: string;
  sourceUrl: string;
  targetUrl: string;
  spam: boolean;
  dofollowLinks: number;
  domainRating?: number;
} {
  const sourceUrl = fieldValue(record, [
    "referring page url",
    "referring page",
    "source url",
    "source page",
    "source",
    "linking page",
    "linking page url",
    "backlink url",
    "from",
    "url from",
  ]);
  const targetUrl = fieldValue(record, [
    "target url",
    "target",
    "link url",
    "linked url",
    "destination url",
    "landing page",
    "to",
    "url to",
  ]);
  const explicitDomain = fieldValue(record, [
    "referring domain",
    "source domain",
    "domain",
    "root domain",
    "from domain",
  ]);

  return {
    sourceDomain: normalizeDomain(explicitDomain) || normalizeDomain(sourceUrl),
    sourceUrl,
    targetUrl,
    spam: booleanValue(record, [
      "spam",
      "is spam",
      "spam labeled",
    ]),
    dofollowLinks: numericFieldValue(record, [
      "dofollow links",
      "dofollow",
      "follow links",
    ]) ?? 0,
    domainRating: numericFieldValue(record, [
      "domain rating",
      "dr",
      "domain authority",
    ]),
  };
}

// Exact stems, not substrings: a substring match swallowed AHREFS-ENRICHMENT.json
// (Ahrefs Site Audit findings) and reported a referring domain named "ahrefs-audit".
// Non-standard filenames still load via --manual / BACKLINK_MANUAL_EXPORT_PATHS,
// which bypass this scan entirely.
const MANUAL_BACKLINK_EXPORT_STEMS = new Set([
  "ahrefs",
  "ahrefs-webmaster-tools",
  "moz",
  "moz-link-explorer",
  "link-explorer",
  "gsc-links",
  "search-console-links",
  "google-search-console-links",
  "manual-backlinks",
  "backlinks",
  "referring-domains",
]);

function isManualBacklinkExportFile(filePath: string): boolean {
  const name = path.basename(filePath).toLowerCase();
  const stem = name.match(/^(.+)\.(?:csv|json)$/)?.[1];
  if (!stem) return false;
  return MANUAL_BACKLINK_EXPORT_STEMS.has(stem.replace(/_/g, "-"));
}

function inferManualExportSource(filePath: string): string {
  const name = path.basename(filePath).toLowerCase();
  if (name.includes("ahrefs")) return "ahrefs-webmaster-tools";
  if (name.includes("moz") || name.includes("link-explorer")) return "moz-link-explorer";
  if (name.includes("gsc") || name.includes("search-console") || name.includes("google")) {
    return "google-search-console-links";
  }
  return "manual";
}

function fieldValue(record: Record<string, unknown>, keys: string[]): string {
  const normalized = new Map(
    Object.entries(record).map(([key, value]) => [normalizeHeader(key), stringValue(value)]),
  );
  for (const key of keys) {
    const value = normalized.get(normalizeHeader(key));
    if (value) return value;
  }
  return "";
}

function numericFieldValue(record: Record<string, unknown>, keys: string[]): number | undefined {
  const normalized = new Map(
    Object.entries(record).map(([key, value]) => [normalizeHeader(key), numberValue(value)]),
  );
  for (const key of keys) {
    const value = normalized.get(normalizeHeader(key));
    if (typeof value === "number") return value;
  }
  return undefined;
}

function booleanValue(record: Record<string, unknown>, keys: string[]): boolean {
  const normalized = new Map(
    Object.entries(record).map(([key, value]) => [normalizeHeader(key), booleanFieldValue(value)]),
  );
  for (const key of keys) {
    const value = normalized.get(normalizeHeader(key));
    if (typeof value === "boolean") return value;
  }
  return false;
}

function normalizeHeader(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function normalizeDomain(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const firstToken = trimmed.split(/[\s,]+/)[0] ?? "";
  try {
    const url = new URL(firstToken.includes("://") ? firstToken : `https://${firstToken}`);
    return url.hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

function countValues(values: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return counts;
}

function topCounts(counts: Map<string, number>, limit: number): Array<{ value: string; count: number }> {
  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value))
    .slice(0, limit);
}

function firstArrayValue(record: Record<string, unknown>, keys: string[]): unknown[] {
  for (const key of keys) {
    const value = record[key];
    if (Array.isArray(value)) return value;
  }
  return [];
}

function stringValue(value: unknown): string {
  return typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
}

function numberValue(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return undefined;
  const normalized = value.replace(/,/g, "").trim();
  if (!normalized) return undefined;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function booleanFieldValue(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value;
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().toLowerCase();
  if (normalized === "true" || normalized === "yes") return true;
  if (normalized === "false" || normalized === "no") return false;
  return undefined;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
