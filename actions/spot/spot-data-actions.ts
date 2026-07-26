"use server";

import { withDatabaseOperation } from "@/lib/server-action-utils";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSpotBySlug } from "@/lib/data/surf-spots";
import {
  transformBeachToSpotData,
  transformStaticSpotToSpotData,
  mergeSpotData,
  type SpotPageData,
} from "@/lib/utils/spot-data-transformer";
import { createContextLogger } from "@/lib/logger";
import {
  getResolvedSpotPhotos,
  type ResolvedSpotPhoto,
} from "@/lib/community-photos";
import type { Beach } from "@/types/database";

const log = createContextLogger("SpotDataActions");

/**
 * Featured photo data structure
 */
export type SpotFeaturedPhoto = ResolvedSpotPhoto;

interface CuratedSpotPhotoRow {
  id: string;
  image_url: string;
  thumb_url: string | null;
  attribution_html: string | null;
  title: string | null;
  creator_name: string | null;
  fetched_at: string | null;
}

function toResolvedCuratedPhoto(row: CuratedSpotPhotoRow): ResolvedSpotPhoto {
  return {
    id: row.id,
    source: "curated",
    visibility: "public",
    imageUrl: row.image_url,
    thumbUrl: row.thumb_url,
    width: null,
    height: null,
    attributionHtml: row.attribution_html,
    attribution: null,
    title: row.title,
    creatorName: row.creator_name,
    community: null,
    createdAt: row.fetched_at ?? new Date(0).toISOString(),
  };
}

/**
 * Internal function to get beach by slug without throwing on no results.
 * Uses .limit(1) instead of .single() to avoid errors when no rows found.
 */
async function getBeachBySlugSafe(slug: string): Promise<Beach | null> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("beaches")
      .select("*")
      .eq("slug", slug.trim().toLowerCase())
      .limit(1);

    if (error || !data || data.length === 0) {
      return null;
    }

    return data[0] as Beach;
  } catch (error) {
    log.warn("Error fetching beach by slug", { slug, error });
    return null;
  }
}

/**
 * Return type for getSpotDataBySlug including DB location status
 */
export interface SpotDataResult {
  data: SpotPageData | null;
  /** True when DB record has both city AND state (determines redirect/canonical logic) */
  dbHasLocation: boolean;
}

/**
 * Fetches spot data by slug, trying database first with static fallback.
 * Returns merged data combining database info (id, coordinates) with
 * static content (history, advice, FAQs) for the richest result.
 *
 * The `dbHasLocation` flag indicates whether the DB record has complete
 * location data (city AND state), which determines whether the page should
 * redirect to hierarchical URLs and how canonical URLs are set.
 */
export async function getSpotDataBySlug(
  slug: string
): Promise<SpotDataResult> {
  // Normalize slug
  const normalizedSlug = slug.trim().toLowerCase();

  // Try database first using our safe version that doesn't throw
  let dbData: SpotPageData | null = null;
  const beach = await getBeachBySlugSafe(normalizedSlug);

  // Check if DB has complete location data (both city AND state must be present and non-empty)
  const dbHasLocation = !!(
    beach?.city &&
    beach?.state &&
    beach.city.trim() !== '' &&
    beach.state.trim() !== ''
  );

  if (beach) {
    dbData = transformBeachToSpotData(beach);
  }

  // Try static data as fallback/supplement
  const staticSpot = getSpotBySlug(normalizedSlug);
  const staticData = staticSpot
    ? transformStaticSpotToSpotData(staticSpot)
    : null;

  // Merge both sources for the richest data
  return {
    data: mergeSpotData(dbData, staticData),
    dbHasLocation,
  };
}

/**
 * Fetches the featured photo for a spot/beach.
 * Uses the beach_photos_featured view which returns one featured photo per beach.
 */
export async function getSpotFeaturedPhoto(
  beachId: string
): Promise<SpotFeaturedPhoto | null> {
  const photos = await getSpotGalleryPhotos(beachId, 1);
  return photos[0] ?? null;
}

/**
 * Fetches multiple photos for a spot's gallery.
 * Uses beach_photos table with approval filter.
 */
export async function getSpotGalleryPhotos(
  beachId: string,
  limit: number = 6
): Promise<SpotFeaturedPhoto[]> {
  const curated = await withDatabaseOperation<ResolvedSpotPhoto[]>(async (supabase) => {
    const { data, error } = await supabase
      .from("beach_photos")
      .select(
        "id, image_url, thumb_url, attribution_html, title, creator_name, fetched_at",
      )
      .eq("beach_id", beachId)
      .eq("approved", true)
      .is("deleted_at", null)
      .order("fetched_at", { ascending: false })
      .limit(limit);

    if (error || !data) {
      return { data: [], error: null };
    }

    return {
      data: (data as CuratedSpotPhotoRow[]).map(toResolvedCuratedPhoto),
      error: null,
    };
  }).then((result) => result.data ?? []);

  try {
    return await getResolvedSpotPhotos({
      target: { type: "beach", id: beachId },
      curated,
      limit,
    });
  } catch (error) {
    log.warn("Community photo resolution failed; using curated photos", {
      error,
    });
    return curated.slice(0, limit);
  }
}
