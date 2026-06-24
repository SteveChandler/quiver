import type { CompetitorDelta, StoreListingSnapshot, StoreSnapshotInput } from "./types";

export interface StoreTarget {
  app: string;
  platform: StoreListingSnapshot["platform"];
  url: string;
}

export interface AppStoreLookupResult {
  trackName?: string;
  version?: string;
  currentVersionReleaseDate?: string;
  averageUserRating?: number;
  userRatingCount?: number;
  formattedPrice?: string;
}

export function parseAppStoreLookup(
  raw: unknown,
  app: string,
  url: string,
): StoreListingSnapshot {
  const result = firstLookupResult(raw);
  return {
    app,
    platform: "ios",
    url,
    title: stringOrUndefined(result?.trackName),
    version: stringOrUndefined(result?.version),
    releaseDate: stringOrUndefined(result?.currentVersionReleaseDate),
    rating: numberOrUndefined(result?.averageUserRating),
    ratingCount: numberOrUndefined(result?.userRatingCount),
    priceEvidence: [stringOrUndefined(result?.formattedPrice)].filter(isString),
  };
}

export function extractPriceEvidence(text: string): string[] {
  const matches = text.match(/\$[0-9]+(?:\.[0-9]{2})?(?:\s?[-–]\s?\$[0-9]+(?:\.[0-9]{2})?)?/g) ?? [];
  return [...new Set(matches)].sort();
}

export function compareListingMetadata(
  expected: string,
  snapshot: StoreListingSnapshot,
): string[] {
  const drift: string[] = [];
  if (snapshot.title && !expected.includes(snapshot.title)) {
    drift.push(`Unexpected live title: ${snapshot.title}`);
  }
  for (const price of snapshot.priceEvidence) {
    if (price !== "Free" && !expected.includes(price)) {
      drift.push(`Live price evidence not found in listing doc: ${price}`);
    }
  }
  return drift;
}

export function buildStoreSnapshot(
  generatedAt: string,
  listings: StoreListingSnapshot[],
  competitorDeltas: CompetitorDelta[] = [],
  missing: string[] = [],
): StoreSnapshotInput {
  return { generatedAt, listings, competitorDeltas, missing };
}

function firstLookupResult(raw: unknown): AppStoreLookupResult | null {
  if (!isRecord(raw) || !Array.isArray(raw.results)) return null;
  const first = raw.results[0];
  return isRecord(first) ? first as AppStoreLookupResult : null;
}

function stringOrUndefined(raw: unknown): string | undefined {
  return typeof raw === "string" && raw.trim().length > 0 ? raw : undefined;
}

function numberOrUndefined(raw: unknown): number | undefined {
  return typeof raw === "number" && Number.isFinite(raw) ? raw : undefined;
}

function isString(value: string | undefined): value is string {
  return typeof value === "string";
}

function isRecord(raw: unknown): raw is Record<string, unknown> {
  return typeof raw === "object" && raw !== null && !Array.isArray(raw);
}
