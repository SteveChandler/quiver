import fs from "node:fs";
import path from "node:path";
import { parse as parseCsv } from "csv-parse/sync";

import type {
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
    competitorDeltas?: string[];
    missing?: string[];
  },
): BacklinkProxyInput {
  return {
    generatedAt,
    referrers: options.vercel?.referrers ?? [],
    embedReferrers: options.embedReferrers ?? [],
    outreachStatuses: parseOutreachStatuses(options.outreachMarkdown ?? ""),
    manualExports: options.manualExports ?? [],
    competitorDeltas: options.competitorDeltas ?? [],
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

function parseManualBacklinkExport(filePath: string): ManualBacklinkExport {
  const raw = fs.readFileSync(filePath, "utf8");
  const records = parseManualBacklinkRecords(filePath, raw);
  const rows = records.map(normalizeManualBacklinkRecord);
  const referringDomainCounts = countValues(rows.map((row) => row.sourceDomain).filter(Boolean));
  const targetUrlCounts = countValues(rows.map((row) => row.targetUrl).filter(Boolean));

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
  };
}

function isManualBacklinkExportFile(filePath: string): boolean {
  const name = path.basename(filePath).toLowerCase();
  if (!/\.(csv|json)$/.test(name)) return false;
  if (name === "backlink-proxy.json") return false;
  return [
    "ahrefs",
    "moz",
    "link-explorer",
    "link_explorer",
    "gsc-links",
    "search-console-links",
    "google-search-console-links",
    "manual-backlinks",
    "backlinks",
    "referring-domains",
  ].some((token) => name.includes(token));
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

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
