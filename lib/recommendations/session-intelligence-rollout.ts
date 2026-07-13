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

export interface SessionIntelligenceSurfacePolicy {
  surface: SessionIntelligenceSeoSurface;
  fullBestSurfWindows: boolean;
  handoffOnly: boolean;
  basicAnswerPublic: boolean;
  sourceHints: SurfWindowSourceSupportHints;
}

export const PHASE_18_SESSION_INTELLIGENCE_ALLOWLIST = {
  waterTempCityPaths: [
    "/water-temp/huntington-beach",
    "/water-temp/santa-cruz",
    "/water-temp/santa-monica",
    "/water-temp/kailua-kona",
  ],
  waterTempBeachPaths: [
    "/ca/del-mar/del-mar/water-temp",
    "/nj/long-branch/long-branch-long-branch-nj/water-temp",
  ],
  spotPaths: [
    "/ca/malibu/malibu-surfrider-first-point-malibu-ca",
    "/ca/san-diego/blacks",
    "/ca/la-jolla/blacks",
  ],
  bestTimeCityPaths: [
    "/best-time-to-surf/la-jolla",
    "/best-time-to-surf/westport",
    "/best-time-to-surf/cocoa-beach",
  ],
} as const;

function normalizePath(path: string): string {
  const pathname = path.split(/[?#]/)[0] ?? path;
  const withoutTrailingSlash =
    pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  return withoutTrailingSlash.toLowerCase();
}

function pathSet(values: readonly string[]): Set<string> {
  return new Set(values.map(normalizePath));
}

const waterTempPaths = pathSet([
  ...PHASE_18_SESSION_INTELLIGENCE_ALLOWLIST.waterTempCityPaths,
  ...PHASE_18_SESSION_INTELLIGENCE_ALLOWLIST.waterTempBeachPaths,
]);
const spotPaths = pathSet(PHASE_18_SESSION_INTELLIGENCE_ALLOWLIST.spotPaths);
const bestTimePaths = pathSet(
  PHASE_18_SESSION_INTELLIGENCE_ALLOWLIST.bestTimeCityPaths
);

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

export function isPhase18WaterTempPath(path: string): boolean {
  return waterTempPaths.has(normalizePath(path));
}

export function isPhase18SpotPath(path: string): boolean {
  return spotPaths.has(normalizePath(path));
}

export function isPhase18BestTimePath(path: string): boolean {
  return bestTimePaths.has(normalizePath(path));
}

export function requiresPublicBasicAnswer(
  surface: SessionIntelligenceSeoSurface
): boolean {
  return getSessionIntelligenceSurfacePolicy(surface).basicAnswerPublic;
}

export function canRenderBestSurfWindowsForSurface(
  surface: SessionIntelligenceSeoSurface,
  path?: string
): boolean {
  const policy = getSessionIntelligenceSurfacePolicy(surface);
  if (!policy.fullBestSurfWindows) return false;
  if (surface !== "spot") return policy.fullBestSurfWindows;
  return path ? isPhase18SpotPath(path) : false;
}
