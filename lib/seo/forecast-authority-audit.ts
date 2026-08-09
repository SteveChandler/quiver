import {
  evaluateBeachForecastIndexability,
  type IndexabilityReason,
} from "./indexability";
import {
  evaluateBeachEditorialIntegrity,
  type EditorialIntegrityBeach,
} from "./editorial-integrity";
import { buildBeachUrl } from "@/lib/utils/beach-url-utils";
import type { ForecastIndexabilitySnapshot } from "./forecast-indexability";

export interface ForecastAuthorityAuditBeach extends EditorialIntegrityBeach {
  slug: string | null;
  country: string | null;
  lat: number | null;
  lon: number | null;
  timezone?: string | null;
}

export interface ForecastAuthorityAuditFailure {
  id: string;
  name: string | null;
  canonicalPath: string;
  indexabilityReason: IndexabilityReason;
  editorialQuarantined: boolean;
  editorialReasons: string[];
  metadataMissing: boolean;
}

export interface ForecastAuthorityAuditReport {
  generatedAt: string;
  forecastQuerySucceeded: boolean;
  eligibleSpots: Array<{
    id: string;
    name: string | null;
    city: string | null;
    state: string | null;
    country: string | null;
    canonicalPath: string;
  }>;
  summary: {
    totalBeachRecords: number;
    totalCanonicalSpotPages: number;
    forecastEligible: number;
    forecastIneligible: number;
    missingForecast: number;
    incompleteForecast: number;
    staleForecast: number;
    badLocationIdentity: number;
    quarantinedEditorial: number;
    missingMetadata: number;
    canonicalConflicts: number;
    sitemapEntries: number | null;
    missingSitemapEntries: number | null;
  };
  reasonCounts: Partial<Record<IndexabilityReason, number>>;
  canonicalConflicts: Array<{
    canonicalPath: string;
    beachIds: string[];
    beachNames: Array<string | null>;
  }>;
  missingSitemapEntries: Array<{
    id: string;
    name: string | null;
    canonicalPath: string;
  }>;
  failures: ForecastAuthorityAuditFailure[];
}

const EMPTY_FORECAST_SNAPSHOT: ForecastIndexabilitySnapshot = {
  forecastAvailable: false,
  selectedStateComplete: false,
  forecastFresh: false,
  forecastValidAt: null,
  sourceDataUpdatedAt: null,
  primaryDataSource: null,
  isStale: false,
};

function hasText(value: string | null | undefined): boolean {
  return Boolean(value?.trim());
}

function hasValidCoordinates(beach: ForecastAuthorityAuditBeach): boolean {
  return Number.isFinite(beach.lat) && Number.isFinite(beach.lon);
}

export function buildAuditCanonicalPath(beach: ForecastAuthorityAuditBeach): string {
  if (!beach.slug || !beach.city || !beach.state || !beach.country) {
    return `/beach/${beach.slug || beach.id}`;
  }

  return buildBeachUrl(beach);
}

export function isAuditCanonicalIdentityValid(
  beach: ForecastAuthorityAuditBeach,
  canonicalPath = buildAuditCanonicalPath(beach),
): boolean {
  return Boolean(
    hasText(beach.slug) &&
      hasText(beach.city) &&
      hasText(beach.state) &&
      hasText(beach.country) &&
      hasValidCoordinates(beach) &&
      canonicalPath !== "/" &&
      !canonicalPath.startsWith("/beach/"),
  );
}

function isMetadataMissing(beach: ForecastAuthorityAuditBeach): boolean {
  return !hasText(beach.name) || !hasText(beach.city) || !hasText(beach.state);
}

function incrementReason(
  counts: Partial<Record<IndexabilityReason, number>>,
  reason: IndexabilityReason,
): void {
  counts[reason] = (counts[reason] ?? 0) + 1;
}

export function buildForecastAuthorityAudit(
  beaches: ForecastAuthorityAuditBeach[],
  snapshots: ReadonlyMap<string, ForecastIndexabilitySnapshot>,
  options: {
    generatedAt?: string;
    forecastQuerySucceeded?: boolean;
    sitemapPaths?: Iterable<string>;
  } = {},
): ForecastAuthorityAuditReport {
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  const forecastQuerySucceeded = options.forecastQuerySucceeded ?? true;
  const reasonCounts: Partial<Record<IndexabilityReason, number>> = {};
  const failures: ForecastAuthorityAuditFailure[] = [];
  const canonicalGroups = new Map<string, ForecastAuthorityAuditBeach[]>();
  const missingSitemapEntries: ForecastAuthorityAuditReport["missingSitemapEntries"] = [];
  const sitemapPaths = options.sitemapPaths ? new Set(options.sitemapPaths) : null;

  let totalCanonicalSpotPages = 0;
  let forecastEligible = 0;
  let quarantinedEditorial = 0;
  let missingMetadata = 0;
  const eligibleSpots: ForecastAuthorityAuditReport["eligibleSpots"] = [];

  for (const beach of beaches) {
    const canonicalPath = buildAuditCanonicalPath(beach);
    const canonicalValid = isAuditCanonicalIdentityValid(beach, canonicalPath);
    const snapshot = snapshots.get(beach.id) ?? EMPTY_FORECAST_SNAPSHOT;
    const editorial = evaluateBeachEditorialIntegrity(beach);
    const metadataMissing = isMetadataMissing(beach);

    if (canonicalValid) totalCanonicalSpotPages += 1;
    if (editorial.quarantined) quarantinedEditorial += 1;
    if (metadataMissing) missingMetadata += 1;
    incrementReason(
      reasonCounts,
      canonicalValid
        ? evaluateBeachForecastIndexability({
            canonicalValid: true,
            forecastAvailable: snapshot.forecastAvailable,
            selectedStateComplete: snapshot.selectedStateComplete,
            forecastFresh: snapshot.forecastFresh,
          }).reason
        : "invalid-canonical",
    );

    const decision = evaluateBeachForecastIndexability({
      canonicalValid,
      forecastAvailable: snapshot.forecastAvailable,
      selectedStateComplete: snapshot.selectedStateComplete,
      forecastFresh: snapshot.forecastFresh,
    });

    if (decision.indexable) {
      forecastEligible += 1;
      eligibleSpots.push({
        id: beach.id,
        name: beach.name,
        city: beach.city,
        state: beach.state,
        country: beach.country,
        canonicalPath,
      });
      if (sitemapPaths && !sitemapPaths.has(canonicalPath)) {
        missingSitemapEntries.push({ id: beach.id, name: beach.name, canonicalPath });
      }
    }

    if (canonicalValid) {
      const group = canonicalGroups.get(canonicalPath) ?? [];
      group.push(beach);
      canonicalGroups.set(canonicalPath, group);
    }

    if (
      !decision.indexable ||
      editorial.quarantined ||
      metadataMissing
    ) {
      failures.push({
        id: beach.id,
        name: beach.name,
        canonicalPath,
        indexabilityReason: decision.reason,
        editorialQuarantined: editorial.quarantined,
        editorialReasons: editorial.reasons,
        metadataMissing,
      });
    }
  }

  const canonicalConflicts = [...canonicalGroups.entries()]
    .filter(([, group]) => group.length > 1)
    .map(([canonicalPath, group]) => ({
      canonicalPath,
      beachIds: group.map((beach) => beach.id),
      beachNames: group.map((beach) => beach.name),
    }));

  for (const conflict of canonicalConflicts) {
    for (const beachId of conflict.beachIds) {
      const failure = failures.find((candidate) => candidate.id === beachId);
      if (failure) continue;
      const beach = beaches.find((candidate) => candidate.id === beachId);
      if (!beach) continue;
      const snapshot = snapshots.get(beach.id) ?? EMPTY_FORECAST_SNAPSHOT;
      const decision = evaluateBeachForecastIndexability({
        canonicalValid: true,
        forecastAvailable: snapshot.forecastAvailable,
        selectedStateComplete: snapshot.selectedStateComplete,
        forecastFresh: snapshot.forecastFresh,
      });
      failures.push({
        id: beach.id,
        name: beach.name,
        canonicalPath: conflict.canonicalPath,
        indexabilityReason: decision.reason,
        editorialQuarantined: false,
        editorialReasons: [],
        metadataMissing: false,
      });
    }
  }

  return {
    generatedAt,
    forecastQuerySucceeded,
    eligibleSpots,
    summary: {
      totalBeachRecords: beaches.length,
      totalCanonicalSpotPages,
      forecastEligible,
      forecastIneligible: beaches.length - forecastEligible,
      missingForecast: reasonCounts["forecast-missing"] ?? 0,
      incompleteForecast: reasonCounts["forecast-incomplete"] ?? 0,
      staleForecast: reasonCounts["forecast-stale"] ?? 0,
      badLocationIdentity: reasonCounts["invalid-canonical"] ?? 0,
      quarantinedEditorial,
      missingMetadata,
      canonicalConflicts: canonicalConflicts.reduce(
        (count, conflict) => count + conflict.beachIds.length,
        0,
      ),
      sitemapEntries: sitemapPaths ? sitemapPaths.size : null,
      missingSitemapEntries: sitemapPaths ? missingSitemapEntries.length : null,
    },
    reasonCounts,
    canonicalConflicts,
    missingSitemapEntries,
    failures,
  };
}
