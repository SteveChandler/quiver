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

export type IndexabilityReason =
  | "missing-review"
  | "missing-sources"
  | "missing-local-content"
  | "missing-intent-editorial";

export interface IndexabilityResult {
  indexable: boolean;
  reason: IndexabilityReason | null;
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

export function isBeachEligibleForIndexing(beach: BeachEditorialRecord): boolean {
  return evaluateBeachIndexability({
    seoIndexable: beach.seoIndexable,
    seoReviewedAt: beach.seoReviewedAt,
    seoSources: parseEditorialSources(beach.editorial_sources),
    description: beach.description,
    crowdTips: beach.crowdTips,
    waveTips: beach.waveTips,
    bestConditionsProse: beach.bestConditionsProse,
  }).indexable;
}

export function isBeachDatabaseRecordEligible(
  beach: BeachEditorialDatabaseRecord,
): boolean {
  return evaluateBeachIndexability({
    seoIndexable: beach.seo_indexable,
    seoReviewedAt: beach.editorial_reviewed_at,
    seoSources: parseEditorialSources(beach.editorial_sources),
    description: beach.description,
    crowdTips: beach.crowd_tips,
    waveTips: beach.wave_tips,
    bestConditionsProse: beach.best_conditions_prose,
  }).indexable;
}

export function evaluateBeachIndexability(
  input: BeachIndexabilityInput,
): IndexabilityResult {
  if (!input.seoIndexable || !input.seoReviewedAt) {
    return { indexable: false, reason: "missing-review" };
  }

  if (!hasSources(input.seoSources)) {
    return { indexable: false, reason: "missing-sources" };
  }

  if (
    !hasText(input.description) ||
    ![input.crowdTips, input.waveTips, input.bestConditionsProse].some(hasText)
  ) {
    return { indexable: false, reason: "missing-local-content" };
  }

  return { indexable: true, reason: null };
}

export function evaluateCityEditorialIndexability(
  input: CityIntentEditorialInput,
  expectedIntent: string | null,
): IndexabilityResult {
  if (!input.seoIndexable || !input.seoReviewedAt) {
    return { indexable: false, reason: "missing-review" };
  }

  if (!hasSources(input.seoSources)) {
    return { indexable: false, reason: "missing-sources" };
  }

  const intentMatches = expectedIntent === null
    ? input.intent === null || input.intent === "general"
    : input.intent === expectedIntent;
  if (!intentMatches) {
    return { indexable: false, reason: "missing-intent-editorial" };
  }

  if (
    !input.description?.some(hasText) ||
    !hasText(input.intro) ||
    !hasText(input.localGuidance)
  ) {
    return { indexable: false, reason: "missing-local-content" };
  }

  return { indexable: true, reason: null };
}
