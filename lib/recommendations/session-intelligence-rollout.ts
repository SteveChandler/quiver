import type { SurfWindowSourceSupportHints } from "@/lib/recommendations/surf-window-source-flags";

export type SessionIntelligenceSeoSurface =
  | "generic-intent"
  | "beginner"
  | "tide"
  | "water-temp"
  | "dawn-patrol"
  | "sunset"
  | "best-time"
  | "spot";

interface SessionIntelligenceSurfacePolicy {
  surface: SessionIntelligenceSeoSurface;
  fullBestSurfWindows: boolean;
  handoffOnly: boolean;
  basicAnswerPublic: boolean;
  sourceHints: SurfWindowSourceSupportHints;
}

function normalizePath(path: string): string {
  const pathname = path.split(/[?#]/)[0] ?? path;
  const withoutTrailingSlash =
    pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  return withoutTrailingSlash.toLowerCase();
}

function pathSet(values: readonly string[]): Set<string> {
  return new Set(values.map(normalizePath));
}
const bestTimePaths = pathSet([
  "/best-time-to-surf/la-jolla",
  "/best-time-to-surf/westport",
  "/best-time-to-surf/cocoa-beach",
]);

const surfacePolicies: Record<
  SessionIntelligenceSeoSurface,
  SessionIntelligenceSurfacePolicy
> = {
  "generic-intent": {
    surface: "generic-intent",
    fullBestSurfWindows: false,
    handoffOnly: true,
    basicAnswerPublic: true,
    sourceHints: {},
  },
  beginner: {
    surface: "beginner",
    fullBestSurfWindows: false,
    handoffOnly: true,
    basicAnswerPublic: true,
    sourceHints: {},
  },
  tide: {
    surface: "tide",
    fullBestSurfWindows: false,
    handoffOnly: true,
    basicAnswerPublic: true,
    sourceHints: {},
  },
  "water-temp": {
    surface: "water-temp",
    fullBestSurfWindows: false,
    handoffOnly: true,
    basicAnswerPublic: true,
    sourceHints: {},
  },
  "dawn-patrol": {
    surface: "dawn-patrol",
    fullBestSurfWindows: false,
    handoffOnly: true,
    basicAnswerPublic: true,
    sourceHints: {},
  },
  sunset: {
    surface: "sunset",
    fullBestSurfWindows: false,
    handoffOnly: true,
    basicAnswerPublic: true,
    sourceHints: {},
  },
  "best-time": {
    surface: "best-time",
    fullBestSurfWindows: false,
    handoffOnly: true,
    basicAnswerPublic: true,
    sourceHints: {},
  },
  spot: {
    surface: "spot",
    fullBestSurfWindows: true,
    handoffOnly: false,
    basicAnswerPublic: true,
    sourceHints: {},
  },
};

export function getSessionIntelligenceSurfacePolicy(
  surface: SessionIntelligenceSeoSurface
): SessionIntelligenceSurfacePolicy {
  return surfacePolicies[surface];
}

export function isPhase18BestTimePath(path: string): boolean {
  return bestTimePaths.has(normalizePath(path));
}
