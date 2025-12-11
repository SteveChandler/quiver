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
import type { Beach } from "@/types/database";

/**
 * Featured photo data structure
 */
export interface SpotFeaturedPhoto {
  imageUrl: string;
  thumbUrl: string | null;
  attributionHtml: string | null;
  title: string | null;
  creatorName: string | null;
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
    console.log(`[getBeachBySlugSafe] Error fetching beach: ${error}`);
    return null;
  }
}

/**
 * Fetches spot data by slug, trying database first with static fallback.
 * Returns merged data combining database info (id, coordinates) with
 * static content (history, advice, FAQs) for the richest result.
 */
export async function getSpotDataBySlug(
  slug: string
): Promise<SpotPageData | null> {
  // Normalize slug
  const normalizedSlug = slug.trim().toLowerCase();

  // Try database first using our safe version that doesn't throw
  let dbData: SpotPageData | null = null;
  const beach = await getBeachBySlugSafe(normalizedSlug);
  if (beach) {
    dbData = transformBeachToSpotData(beach);
  }

  // Try static data as fallback/supplement
  const staticSpot = getSpotBySlug(normalizedSlug);
  const staticData = staticSpot
    ? transformStaticSpotToSpotData(staticSpot)
    : null;

  // Merge both sources for the richest data
  return mergeSpotData(dbData, staticData);
}

/**
 * Fetches the featured photo for a spot/beach.
 * Uses the beach_photos_featured view which returns one featured photo per beach.
 */
export async function getSpotFeaturedPhoto(
  beachId: string
): Promise<SpotFeaturedPhoto | null> {
  return withDatabaseOperation<SpotFeaturedPhoto | null>(async (supabase) => {
    // Query the beach_photos_featured view
    const { data, error } = await supabase
      .from("beach_photos_featured")
      .select("image_url, thumb_url, attribution_html, title, creator_name")
      .eq("beach_id", beachId)
      .maybeSingle();

    if (error || !data) {
      // No featured photo found, try getting the latest approved photo
      const { data: fallbackData, error: fallbackError } = await supabase
        .from("beach_photos")
        .select("image_url, thumb_url, attribution_html, title, creator_name")
        .eq("beach_id", beachId)
        .eq("approved", true)
        .order("fetched_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (fallbackError || !fallbackData) {
        return { data: null, error: null };
      }

      return {
        data: {
          imageUrl: fallbackData.image_url,
          thumbUrl: fallbackData.thumb_url,
          attributionHtml: fallbackData.attribution_html,
          title: fallbackData.title,
          creatorName: fallbackData.creator_name,
        },
        error: null,
      };
    }

    return {
      data: {
        imageUrl: data.image_url,
        thumbUrl: data.thumb_url,
        attributionHtml: data.attribution_html,
        title: data.title,
        creatorName: data.creator_name,
      },
      error: null,
    };
  }).then((result) => result.data ?? null);
}

/**
 * Fetches multiple photos for a spot's gallery.
 * Uses beach_photos table with approval filter.
 */
export async function getSpotGalleryPhotos(
  beachId: string,
  limit: number = 6
): Promise<SpotFeaturedPhoto[]> {
  return withDatabaseOperation<SpotFeaturedPhoto[]>(async (supabase) => {
    const { data, error } = await supabase
      .from("beach_photos")
      .select("image_url, thumb_url, attribution_html, title, creator_name")
      .eq("beach_id", beachId)
      .eq("approved", true)
      .order("fetched_at", { ascending: false })
      .limit(limit);

    if (error || !data) {
      return { data: [], error: null };
    }

    return {
      data: data.map((row) => ({
        imageUrl: row.image_url,
        thumbUrl: row.thumb_url,
        attributionHtml: row.attribution_html,
        title: row.title,
        creatorName: row.creator_name,
      })),
      error: null,
    };
  }).then((result) => result.data ?? []);
}
