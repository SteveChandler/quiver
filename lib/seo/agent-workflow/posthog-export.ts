import type { NativeFunnelMetric, PostHogExportInput, PostHogSeoPageMetric } from "./types";

export interface PostHogWebRow {
  path: string;
  visitors: number;
  multiPageRate?: number;
  signupRate?: number;
  relatedPathCtr?: number;
}

export interface PostHogNativeRow {
  platform: "native-ios" | "native-android" | "unknown";
  event: string;
  count: number;
}

export function buildPostHogExport(
  webRows: PostHogWebRow[],
  nativeRows: PostHogNativeRow[],
  generatedAt: string,
  dateRange: { from: string; to: string },
  missing: string[] = [],
): PostHogExportInput {
  return {
    generatedAt,
    dateRange,
    pages: webRows.map((row) => ({
      path: row.path,
      visitors: row.visitors,
      multiPageRate: row.multiPageRate,
      signupRate: row.signupRate,
      relatedPathCtr: row.relatedPathCtr,
    })),
    nativeFunnels: groupNativeRows(nativeRows),
    missing,
  };
}

export function parseHogqlRows(raw: unknown): unknown[][] {
  if (!isRecord(raw)) return [];
  if (Array.isArray(raw.results)) return raw.results.filter(Array.isArray);
  if (isRecord(raw.data) && Array.isArray(raw.data.results)) {
    return raw.data.results.filter(Array.isArray);
  }
  return [];
}

export function parsePostHogWebRows(raw: unknown): PostHogWebRow[] {
  return parseHogqlRows(raw).map((row) => ({
    path: stringOrFallback(row[0], "/"),
    visitors: numberOrZero(row[1]),
    multiPageRate: optionalRatio(row[2]),
    signupRate: optionalRatio(row[3]),
    relatedPathCtr: optionalRatio(row[4]),
  }));
}

export function parsePostHogNativeRows(raw: unknown): PostHogNativeRow[] {
  return parseHogqlRows(raw).map((row) => ({
    platform: parsePlatform(row[0]),
    event: stringOrFallback(row[1], "unknown"),
    count: numberOrZero(row[2]),
  }));
}

export function toPostHogSeoPages(exportInput: PostHogExportInput): PostHogSeoPageMetric[] {
  return exportInput.pages;
}

function groupNativeRows(rows: PostHogNativeRow[]): NativeFunnelMetric[] {
  const byPlatform = new Map<NativeFunnelMetric["platform"], Record<string, number>>();
  for (const row of rows) {
    const events = byPlatform.get(row.platform) ?? {};
    events[row.event] = (events[row.event] ?? 0) + row.count;
    byPlatform.set(row.platform, events);
  }

  return [...byPlatform.entries()]
    .map(([platform, events]) => ({ platform, events }))
    .sort((a, b) => a.platform.localeCompare(b.platform));
}

function parsePlatform(raw: unknown): PostHogNativeRow["platform"] {
  if (raw === "native-ios" || raw === "native-android") return raw;
  return "unknown";
}

function optionalRatio(raw: unknown): number | undefined {
  if (typeof raw !== "number" || !Number.isFinite(raw)) return undefined;
  if (raw < 0) return 0;
  if (raw > 1) return 1;
  return raw;
}

function numberOrZero(raw: unknown): number {
  return typeof raw === "number" && Number.isFinite(raw) ? raw : 0;
}

function stringOrFallback(raw: unknown, fallback: string): string {
  return typeof raw === "string" && raw.trim().length > 0 ? raw : fallback;
}

function isRecord(raw: unknown): raw is Record<string, unknown> {
  return typeof raw === "object" && raw !== null && !Array.isArray(raw);
}
