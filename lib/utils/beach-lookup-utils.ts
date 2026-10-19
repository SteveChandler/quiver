import { cache } from "react";
import { getBeachByIdFromDb, getBeachesBySlugFromDb } from "@/lib/services/beach-query-service";
import type { Beach } from "@/types/database";
import { nullsLast } from "@/lib/utils/nullable-display-utils";

/**
 * Selects the best beach candidate from a list using deterministic sorting.
 * Prefers: coordinates > review_count > created_at > id
 */
function selectBestCandidate(candidates: Beach[]): Beach | null {
  if (candidates.length === 0) return null;
  return [...candidates].sort((a, b) => {
    const aHasCoords = Number(Boolean(a.lat && a.lon));
    const bHasCoords = Number(Boolean(b.lat && b.lon));
    if (aHasCoords !== bHasCoords) return bHasCoords - aHasCoords;

    const reviewCompare = nullsLast((beach: Beach) => beach.review_count, 'desc')(a, b);
    if (reviewCompare !== 0) return reviewCompare;

    const aCreated = a.created_at ? Date.parse(a.created_at) : 0;
    const bCreated = b.created_at ? Date.parse(b.created_at) : 0;
    if (aCreated !== bCreated) return bCreated - aCreated;

    return String(a.id).localeCompare(String(b.id));
  })[0] ?? null;
}

/**
 * Cached beach lookup by slug with fallback to ID.
 * React's cache() deduplicates this call between generateMetadata and page component.
 */
export const getBeachBySlugOrId = cache(async (slug: string): Promise<Beach | null> => {
  // Try slug lookup first
  const bySlugResult = await getBeachesBySlugFromDb(slug);
  // A failed query is not a missing beach. Returning null here made callers
  // call notFound(), and ISR cached that 404 for real beaches until the next
  // revalidation. Throwing keeps the last good page (or returns a 500).
  if (!bySlugResult.success) {
    throw new Error(`Beach lookup failed for slug "${slug}": ${bySlugResult.error ?? "unknown error"}`);
  }
  const candidates = bySlugResult.data ?? [];

  if (candidates.length > 0) {
    return selectBestCandidate(candidates);
  }

  // Fallback: treat slug as an ID for back-compat
  const byIdResult = await getBeachByIdFromDb(slug);
  if (byIdResult.success && byIdResult.data) {
    return byIdResult.data;
  }

  return null;
});
