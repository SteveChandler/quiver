import type { Metadata } from "next";

import { isGscPerformanceProtected } from "./gsc-performance-protection";
import { normalizeSeoPath } from "./agent-workflow/dashboard";
import { slugifyAscii } from "@/lib/utils/text-utils";

export interface EditorialSource {
  url: string;
  publisher: string;
  retrievedAt: string;
}

export interface BeachIndexabilityInput {
  seoIndexable: boolean | null | undefined;
  seoReviewedAt: string | null | undefined;
  seoSources: EditorialSource[] | null | undefined;
  description: string | null | undefined;
  crowdTips?: string | null;
  waveTips?: string | null;
  bestConditionsProse?: string | null;
}

export interface BeachEditorialRecord extends Omit<BeachIndexabilityInput, "seoSources"> {
  editorial_sources?: EditorialSource[] | string | null;
}

export interface BeachEditorialDatabaseRecord {
  seo_indexable?: boolean | null;
  editorial_reviewed_at?: string | null;
  editorial_sources?: EditorialSource[] | string | null;
  description?: string | null;
  crowd_tips?: string | null;
  wave_tips?: string | null;
  best_conditions_prose?: string | null;
}

export interface CityIntentEditorialInput {
  seoIndexable: boolean | null | undefined;
  seoReviewedAt: string | null | undefined;
  seoSources: EditorialSource[] | null | undefined;
  description: string[] | null | undefined;
  intent: string | null | undefined;
  intro?: string | null;
  localGuidance?: string | null;
}

export interface CityEditorialDatabaseRecord {
  seo_indexable?: boolean | null;
  editorial_reviewed_at?: string | null;
  editorial_sources?: EditorialSource[] | string | null;
  description?: string[] | null;
  intent?: string | null;
  seo_intro?: string | null;
  seo_local_guidance?: string | null;
}

export type EditorialQualityReason =
  | "missing-review"
  | "missing-sources"
  | "missing-local-content"
  | "missing-intent-editorial";

export type IndexabilityReason =
  | "editorial-approved"
  | "gsc-protected"
  | "editorial-rejected"
  | "insufficient-data"
  | "unproven";

export interface EditorialQualityResult {
  approved: boolean;
  rejected: boolean;
  reason: EditorialQualityReason | null;
}

export interface IndexabilityContext {
  canonicalPath: string;
  editorialApproved: boolean;
  editorialRejected: boolean;
  dataRich: boolean;
  performanceProtected: boolean;
}

export interface IndexabilityDecision {
  indexable: boolean;
  reason: IndexabilityReason;
}

function hasText(value: string | null | undefined): boolean {
  return Boolean(value?.trim());
}

function hasSources(sources: EditorialSource[] | null | undefined): boolean {
  return Boolean(
    sources?.some(
      (source) =>
        hasText(source.url) &&
        hasText(source.publisher) &&
        hasText(source.retrievedAt),
    ),
  );
}

export function parseEditorialSources(value: unknown): EditorialSource[] {
  if (Array.isArray(value)) return value as EditorialSource[];
  if (typeof value !== "string") return [];

  try {
    const sources = JSON.parse(value) as unknown;
    return Array.isArray(sources) ? sources as EditorialSource[] : [];
  } catch {
    return [];
  }
}

export function toBeachEditorialInput(
  beach: BeachEditorialDatabaseRecord,
): BeachIndexabilityInput {
  return {
    seoIndexable: beach.seo_indexable,
    seoReviewedAt: beach.editorial_reviewed_at,
    seoSources: parseEditorialSources(beach.editorial_sources),
    description: beach.description,
    crowdTips: beach.crowd_tips,
    waveTips: beach.wave_tips,
    bestConditionsProse: beach.best_conditions_prose,
  };
}

export function toCityEditorialInput(
  editorial: CityEditorialDatabaseRecord | null | undefined,
): CityIntentEditorialInput | null {
  if (!editorial) return null;

  return {
    seoIndexable: editorial.seo_indexable,
    seoReviewedAt: editorial.editorial_reviewed_at,
    seoSources: parseEditorialSources(editorial.editorial_sources),
    description: editorial.description,
    intent: editorial.intent,
    intro: editorial.seo_intro,
    localGuidance: editorial.seo_local_guidance,
  };
}

export function cityEditorialKey(
  country: string,
  state: string,
  city: string,
  intent: string | null,
): string {
  return [
    slugifyAscii(country),
    slugifyAscii(state),
    slugifyAscii(city),
    intent ?? "general",
  ].join("/");
}

export function hasBeachSubstantiveContent(
  input: Pick<
    BeachIndexabilityInput,
    "description" | "crowdTips" | "waveTips" | "bestConditionsProse"
  >,
): boolean {
  return (
    hasText(input.description) &&
    [input.crowdTips, input.waveTips, input.bestConditionsProse].some(hasText)
  );
}

export function evaluateBeachEditorialQuality(
  input: BeachIndexabilityInput,
): EditorialQualityResult {
  const rejected = Boolean(
    input.seoReviewedAt && input.seoIndexable === false,
  );

  if (!input.seoReviewedAt || input.seoIndexable !== true) {
    return { approved: false, rejected, reason: "missing-review" };
  }

  if (!hasSources(input.seoSources)) {
    return { approved: false, rejected: false, reason: "missing-sources" };
  }

  if (!hasBeachSubstantiveContent(input)) {
    return {
      approved: false,
      rejected: false,
      reason: "missing-local-content",
    };
  }

  return { approved: true, rejected: false, reason: null };
}

export function evaluateCityEditorialQuality(
  input: CityIntentEditorialInput | null,
  expectedIntent: string | null,
): EditorialQualityResult {
  if (!input) {
    return { approved: false, rejected: false, reason: "missing-review" };
  }

  const rejected = Boolean(
    input.seoReviewedAt && input.seoIndexable === false,
  );
  if (!input.seoReviewedAt || input.seoIndexable !== true) {
    return { approved: false, rejected, reason: "missing-review" };
  }

  if (!hasSources(input.seoSources)) {
    return { approved: false, rejected: false, reason: "missing-sources" };
  }

  const intentMatches = expectedIntent === null
    ? input.intent === null || input.intent === "general"
    : input.intent === expectedIntent;
  if (!intentMatches) {
    return {
      approved: false,
      rejected: false,
      reason: "missing-intent-editorial",
    };
  }

  if (
    !input.description?.some(hasText) ||
    !hasText(input.intro) ||
    !hasText(input.localGuidance)
  ) {
    return {
      approved: false,
      rejected: false,
      reason: "missing-local-content",
    };
  }

  return { approved: true, rejected: false, reason: null };
}

export function resolveIndexability(
  context: IndexabilityContext,
): IndexabilityDecision {
  if (!context.dataRich) {
    return { indexable: false, reason: "insufficient-data" };
  }

  if (context.editorialRejected) {
    return { indexable: false, reason: "editorial-rejected" };
  }

  if (context.editorialApproved) {
    return { indexable: true, reason: "editorial-approved" };
  }

  if (context.performanceProtected) {
    return { indexable: true, reason: "gsc-protected" };
  }

  return { indexable: false, reason: "unproven" };
}

export function evaluateBeachIndexability(
  input: BeachIndexabilityInput,
  canonicalPath = "/",
): IndexabilityDecision {
  const editorial = evaluateBeachEditorialQuality(input);
  return resolveIndexability({
    canonicalPath: normalizeSeoPath(canonicalPath),
    editorialApproved: editorial.approved,
    editorialRejected: editorial.rejected,
    dataRich: hasBeachSubstantiveContent(input),
    performanceProtected: isGscPerformanceProtected(canonicalPath),
  });
}

export function evaluateCityEditorialIndexability(
  input: CityIntentEditorialInput | null,
  expectedIntent: string | null,
  canonicalPath = "/",
  dataRich = true,
): IndexabilityDecision {
  const editorial = evaluateCityEditorialQuality(input, expectedIntent);
  return resolveIndexability({
    canonicalPath: normalizeSeoPath(canonicalPath),
    editorialApproved: editorial.approved,
    editorialRejected: editorial.rejected,
    dataRich,
    performanceProtected: isGscPerformanceProtected(canonicalPath),
  });
}

export function isBeachEligibleForIndexing(
  beach: BeachEditorialRecord,
  canonicalPath = "/",
): boolean {
  return evaluateBeachIndexability(
    {
      seoIndexable: beach.seoIndexable,
      seoReviewedAt: beach.seoReviewedAt,
      seoSources: parseEditorialSources(beach.editorial_sources),
      description: beach.description,
      crowdTips: beach.crowdTips,
      waveTips: beach.waveTips,
      bestConditionsProse: beach.bestConditionsProse,
    },
    canonicalPath,
  ).indexable;
}

export function isBeachDatabaseRecordEligible(
  beach: BeachEditorialDatabaseRecord,
  canonicalPath = "/",
): boolean {
  return evaluateBeachIndexability(
    toBeachEditorialInput(beach),
    canonicalPath,
  ).indexable;
}

export function applyIndexabilityToMetadata<T extends Metadata>(
  metadata: T,
  decision: IndexabilityDecision,
): T | (T & { robots: Metadata["robots"] }) {
  if (decision.indexable) return metadata;

  return {
    ...metadata,
    robots: {
      index: false,
      follow: true,
      googleBot: {
        index: false,
        follow: true,
      },
    },
  };
}
