import type {
  NativeFunnelMetric,
  PostHogExportInput,
  PostHogSeoPageMetric,
} from "./types";

export interface PostHogWebEventRow {
  event: string;
  timestamp: string;
  sessionKey: string | null;
  path: string | null;
}

export interface PostHogWebRow {
  path: string;
  landingSessions: number;
  multiPageRate?: number;
  landingSignupRate?: number;
  assistedSignupRate?: number;
  topNextPaths?: Array<{ path: string; count: number }>;
  topExitPaths?: Array<{ path: string; count: number }>;
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
      landingSessions: row.landingSessions,
      multiPageRate: row.multiPageRate,
      landingSignupRate: row.landingSignupRate,
      assistedSignupRate: row.assistedSignupRate,
      topNextPaths: row.topNextPaths,
      topExitPaths: row.topExitPaths,
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

export function parsePostHogWebEvents(raw: unknown): PostHogWebEventRow[] {
  return parseHogqlRows(raw).map((row) => ({
    event: stringOrFallback(row[0], "unknown"),
    timestamp: stringOrFallback(row[1], ""),
    sessionKey: nullableString(row[2]),
    path: nullableString(row[3]),
  }));
}

export function computePostHogWebRows(rawRows: PostHogWebEventRow[]): PostHogWebRow[] {
  const bySession = new Map<string, PostHogWebEventRow[]>();
  const assistedSignupCounts = new Map<string, number>();

  for (const row of rawRows) {
    if (!row.sessionKey) continue;
    const existing = bySession.get(row.sessionKey) ?? [];
    existing.push(row);
    bySession.set(row.sessionKey, existing);
  }

  const byLanding = new Map<string, LandingStats>();

  for (const sessionRows of bySession.values()) {
    const ordered = sessionRows
      .slice()
      .sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
    const pageSequence = dedupeSequentialPaths(
      ordered
        .filter((row) => row.event === "page_view" && row.path)
        .map((row) => row.path as string),
    );

    if (pageSequence.length === 0) continue;

    const landingPath = pageSequence[0];
    const signupIndexes = ordered
      .map((row, index) => ({ row, index }))
      .filter(({ row }) => row.event === "signup_success")
      .map(({ index }) => index);
    const firstSignupIndex = signupIndexes.length > 0 ? signupIndexes[0] : null;
    const pagesBeforeSignup = firstSignupIndex === null
      ? new Set<string>()
      : new Set(
          ordered
            .slice(0, firstSignupIndex + 1)
            .filter((row) => row.event === "page_view" && row.path)
            .map((row) => row.path as string),
        );

    const stats = byLanding.get(landingPath) ?? createLandingStats();
    stats.landingSessions += 1;

    if (pageSequence.length > 1) {
      stats.multiPageSessions += 1;
      incrementPathCount(stats.nextPaths, pageSequence[1]);
    }

    incrementPathCount(stats.exitPaths, pageSequence[pageSequence.length - 1]);

    if (firstSignupIndex !== null) {
      stats.landingSignupSessions += 1;
    }

    for (const path of pagesBeforeSignup) {
      assistedSignupCounts.set(path, (assistedSignupCounts.get(path) ?? 0) + 1);
    }

    byLanding.set(landingPath, stats);
  }

  return [...byLanding.entries()]
    .map(([path, stats]) => ({
      path,
      landingSessions: stats.landingSessions,
      multiPageRate: optionalRatio(stats.multiPageSessions, stats.landingSessions),
      landingSignupRate: optionalRatio(stats.landingSignupSessions, stats.landingSessions),
      assistedSignupRate: optionalRatio(assistedSignupCounts.get(path) ?? 0, stats.landingSessions),
      topNextPaths: topPathCounts(stats.nextPaths),
      topExitPaths: topPathCounts(stats.exitPaths),
    }))
    .sort((a, b) => {
      if (b.landingSessions !== a.landingSessions) return b.landingSessions - a.landingSessions;
      return a.path.localeCompare(b.path);
    })
    .slice(0, 100);
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

interface LandingStats {
  landingSessions: number;
  multiPageSessions: number;
  landingSignupSessions: number;
  nextPaths: Map<string, number>;
  exitPaths: Map<string, number>;
}

function createLandingStats(): LandingStats {
  return {
    landingSessions: 0,
    multiPageSessions: 0,
    landingSignupSessions: 0,
    nextPaths: new Map<string, number>(),
    exitPaths: new Map<string, number>(),
  };
}

function dedupeSequentialPaths(paths: string[]): string[] {
  const deduped: string[] = [];

  for (const path of paths) {
    if (deduped[deduped.length - 1] === path) continue;
    deduped.push(path);
  }

  return deduped;
}

function incrementPathCount(counts: Map<string, number>, path: string): void {
  counts.set(path, (counts.get(path) ?? 0) + 1);
}

function topPathCounts(counts: Map<string, number>): Array<{ path: string; count: number }> {
  return [...counts.entries()]
    .sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      return a[0].localeCompare(b[0]);
    })
    .slice(0, 3)
    .map(([path, count]) => ({ path, count }));
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

function optionalRatio(numerator: number, denominator: number): number | undefined {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) {
    return undefined;
  }
  const ratio = numerator / denominator;
  if (ratio < 0) return 0;
  if (ratio > 1) return 1;
  return ratio;
}

function numberOrZero(raw: unknown): number {
  return typeof raw === "number" && Number.isFinite(raw) ? raw : 0;
}

function stringOrFallback(raw: unknown, fallback: string): string {
  return typeof raw === "string" && raw.trim().length > 0 ? raw : fallback;
}

function nullableString(raw: unknown): string | null {
  return typeof raw === "string" && raw.trim().length > 0 ? raw : null;
}

function isRecord(raw: unknown): raw is Record<string, unknown> {
  return typeof raw === "object" && raw !== null && !Array.isArray(raw);
}
