import snapshot from "./gsc-performance-protection.v1.json";
import { normalizeSeoPath } from "./agent-workflow/dashboard";
import {
  buildLegacyCanonicalPathMap,
  mergeGscRowsByCanonicalPath,
} from "./agent-workflow/gsc-refresh";
import type { GscExportInput } from "./agent-workflow/types";

export const GSC_PROTECTION_POLICY_VERSION = 1;
export const GSC_PROTECTION_THRESHOLDS = {
  minimumClicks: 1,
  minimumImpressions: 100,
  maximumAveragePosition: 20,
} as const;

export type GscProtectedPageFamily =
  | "beach"
  | "beach-tides"
  | "beach-water-temp"
  | "best-time-city"
  | "city-intent"
  | "city-location"
  | "geographic-hub";

export interface GscProtectionEntry {
  canonicalPath: string;
  pageFamily: GscProtectedPageFamily;
  clicks: number;
  impressions: number;
  averagePosition: number | null;
}

export interface GscProtectionSnapshot {
  policyVersion: number;
  window: {
    start: string;
    end: string;
  };
  thresholds: {
    minimumClicks: number;
    minimumImpressions: number;
    maximumAveragePosition: number;
  };
  entries: GscProtectionEntry[];
}

export interface GscProtectionDiff {
  added: string[];
  removed: string[];
}

const STATE_SLUGS = new Set([
  "al", "ca", "ct", "de", "fl", "ga", "hi", "la", "ma", "md", "me",
  "ms", "nc", "nh", "nj", "ny", "or", "pr", "ri", "sc", "tx", "va",
  "wa",
]);
const CITY_INTENTS = new Set([
  "beginner",
  "dawn-patrol",
  "least-crowded",
  "longboard",
  "sunset",
  "tide",
  "water-temp",
]);

export function classifyGscProtectedPageFamily(
  value: string,
): GscProtectedPageFamily | null {
  const canonicalPath = normalizeSeoPath(value);
  const segments = canonicalPath.split("/").filter(Boolean);
  const [first, second, third, fourth] = segments;

  if (
    segments.length === 4 &&
    first &&
    STATE_SLUGS.has(first) &&
    (fourth === "tides" || fourth === "water-temp")
  ) {
    return fourth === "tides" ? "beach-tides" : "beach-water-temp";
  }

  if (segments.length === 3 && first && STATE_SLUGS.has(first)) {
    return "beach";
  }

  if (segments.length === 4 && first === "mexico") {
    return "beach";
  }

  if (segments.length === 2 && first === "best-time-to-surf" && second) {
    return "best-time-city";
  }

  if (
    segments.length === 2 &&
    first &&
    second &&
    CITY_INTENTS.has(first) &&
    !STATE_SLUGS.has(second)
  ) {
    return "city-intent";
  }

  if (segments.length === 2 && first && STATE_SLUGS.has(first) && second) {
    return "city-location";
  }

  if (
    segments.length === 3 &&
    first === "mexico" &&
    second &&
    third
  ) {
    return "city-location";
  }

  if (
    (segments.length === 3 && first === "beaches" && second === "usa" && third) ||
    (segments.length >= 2 && segments.length <= 3 && first === "beaches" && second === "mexico")
  ) {
    return "geographic-hub";
  }

  return null;
}

export function buildGscProtectionSnapshot(
  input: GscExportInput,
): GscProtectionSnapshot {
  const legacyCanonicalPathMap = buildLegacyCanonicalPathMap(input.sitemapPaths);
  const mergedRows = mergeGscRowsByCanonicalPath(
    input.last28d,
    legacyCanonicalPathMap,
  );
  const entries = [...mergedRows.values()]
    .flatMap((row): GscProtectionEntry[] => {
      const pageFamily = classifyGscProtectedPageFamily(row.page);
      if (!pageFamily || !qualifiesForGscProtection(row)) return [];

      return [{
        canonicalPath: row.page,
        pageFamily,
        clicks: row.clicks,
        impressions: row.impressions,
        averagePosition:
          typeof row.position === "number"
            ? roundAveragePosition(row.position)
            : null,
      }];
    })
    .sort((left, right) =>
      left.canonicalPath.localeCompare(right.canonicalPath),
    );

  return {
    policyVersion: GSC_PROTECTION_POLICY_VERSION,
    window: { ...input.dateRanges.last28d },
    thresholds: { ...GSC_PROTECTION_THRESHOLDS },
    entries,
  };
}

export function diffGscProtectionSnapshots(
  previous: Pick<GscProtectionSnapshot, "entries"> | null,
  next: Pick<GscProtectionSnapshot, "entries">,
): GscProtectionDiff {
  const previousPaths = new Set(
    previous?.entries.map((entry) => normalizeSeoPath(entry.canonicalPath)) ??
      [],
  );
  const nextPaths = new Set(
    next.entries.map((entry) => normalizeSeoPath(entry.canonicalPath)),
  );

  return {
    added: [...nextPaths]
      .filter((path) => !previousPaths.has(path))
      .sort(),
    removed: [...previousPaths]
      .filter((path) => !nextPaths.has(path))
      .sort(),
  };
}

export function isGscPerformanceProtected(value: string): boolean {
  return PROTECTED_PATHS.has(normalizeSeoPath(value));
}

function qualifiesForGscProtection(row: {
  clicks: number;
  impressions: number;
  position?: number;
}): boolean {
  if (row.clicks >= GSC_PROTECTION_THRESHOLDS.minimumClicks) return true;

  return (
    row.impressions >= GSC_PROTECTION_THRESHOLDS.minimumImpressions &&
    typeof row.position === "number" &&
    row.position <= GSC_PROTECTION_THRESHOLDS.maximumAveragePosition
  );
}

function roundAveragePosition(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

const PROTECTED_PATHS = new Set(
  (snapshot as GscProtectionSnapshot).entries.map((entry) =>
    normalizeSeoPath(entry.canonicalPath),
  ),
);
