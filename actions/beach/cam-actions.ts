"use server";

import { createPublicReadClient } from "@/lib/supabase/server";
import { getRegionForBeach } from "@/lib/data/cam-regions";
import { unstable_cache } from "next/cache";

export interface CamBeach {
  id: string;
  name: string;
  slug: string;
  city: string;
  state: string;
  camera_url: string;
  thumbnail_url: string | null;
}

export interface CamBeachWithRegion extends CamBeach {
  regionSlug: string;
}

/**
 * Get the camera URL for a single beach, if one exists.
 * Used for VideoObject structured data on beach pages.
 */
export async function getBeachCameraUrl(
  beachId: string
): Promise<string | null> {
  const supabase = createPublicReadClient();
  const { data } = await supabase
    .from("beach_sources")
    .select("camera_url")
    .eq("beach_id", beachId)
    .not("camera_url", "is", null)
    .neq("camera_url", "")
    .limit(1)
    .single();

  return data?.camera_url ?? null;
}

/**
 * Fetch all beaches that have a camera_url in beach_sources.
 * Results are cached for 1 hour since camera URLs change infrequently.
 */
export const getBeachesWithCameras = unstable_cache(
  async (): Promise<CamBeachWithRegion[]> => {
    const supabase = createPublicReadClient();

    const { data, error } = await supabase
      .from("beach_sources")
      .select(
        `
        camera_url,
        thumbnail_url,
        beaches!inner (
          id,
          name,
          slug,
          city,
          state
        )
      `
      )
      .not("camera_url", "is", null)
      .neq("camera_url", "");

    if (error) {
      console.error("Failed to fetch beaches with cameras:", error.message);
      return [];
    }

    if (!data) return [];

    const results: CamBeachWithRegion[] = [];

    for (const row of data) {
      const beach = (row as any).beaches;
      if (!beach?.slug || !beach?.city || !beach?.state) continue;

      results.push({
        id: beach.id,
        name: beach.name,
        slug: beach.slug,
        city: beach.city,
        state: beach.state,
        camera_url: row.camera_url!,
        thumbnail_url: row.thumbnail_url ?? null,
        regionSlug: getRegionForBeach(beach.state, beach.city),
      });
    }

    // Sort by state, then city, then name
    results.sort((a, b) => {
      if (a.state !== b.state) return a.state.localeCompare(b.state);
      if (a.city !== b.city) return a.city.localeCompare(b.city);
      return a.name.localeCompare(b.name);
    });

    return results;
  },
  ["beaches-with-cameras"],
  { revalidate: 3600 }
);
