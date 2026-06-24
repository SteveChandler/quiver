"use server";

import { createPublicReadClient } from "@/lib/supabase/server";
import { getRegionForBeach } from "@/lib/data/cam-regions";
import {
  dedupeCameraBeachesForDirectory,
  type CamDirectoryBeach,
} from "@/lib/media/cam-directory";
import { unstable_cache } from "next/cache";

export interface CamBeach {
  id: string;
  name: string;
  slug: string;
  city: string;
  state: string;
  camera_url: string;
  thumbnail_url: string | null;
  photo_url: string | null;
}

export interface CamBeachWithRegion extends CamBeach {
  regionSlug: string;
}

type CameraBeachResult = CamBeachWithRegion &
  CamDirectoryBeach & {
    cameraTitleHint: string | null;
  };

/**
 * Get the camera URL for a single beach, if one exists.
 * Used for VideoObject structured data on beach pages.
 */
export async function getBeachCameraUrl(
  beachId: string,
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
        youtube_stream_title_hint,
        beaches!inner (
          id,
          name,
          slug,
          city,
          state,
          lat,
          lon
        )
      `,
      )
      .not("camera_url", "is", null)
      .neq("camera_url", "");

    if (error) {
      console.error("Failed to fetch beaches with cameras:", error.message);
      return [];
    }

    if (!data) return [];

    const results: CameraBeachResult[] = [];

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
        photo_url: null,
        lat: beach.lat ?? null,
        lon: beach.lon ?? null,
        cameraTitleHint: row.youtube_stream_title_hint ?? null,
        regionSlug: getRegionForBeach(beach.state, beach.city),
      });
    }

    const dedupedResults = dedupeCameraBeachesForDirectory(results);

    const beachIds = dedupedResults.map((beach) => beach.id);
    if (beachIds.length > 0) {
      const { data: photos, error: photosError } = await supabase
        .from("beach_photos_featured")
        .select("beach_id, image_url, thumb_url")
        .in("beach_id", beachIds);

      if (photosError) {
        console.error(
          "Failed to fetch beach photos for cameras:",
          photosError.message,
        );
      } else if (photos) {
        const photoByBeachId = new Map<string, string>();

        for (const photo of photos) {
          const photoUrl = photo.thumb_url ?? photo.image_url;
          if (!photo.beach_id || !photoUrl) continue;

          photoByBeachId.set(photo.beach_id, photoUrl);
        }

        for (const beach of dedupedResults) {
          beach.photo_url = photoByBeachId.get(beach.id) ?? null;
        }
      }
    }

    // Sort by state, then city, then name
    dedupedResults.sort((a, b) => {
      if (a.state !== b.state) return a.state.localeCompare(b.state);
      if (a.city !== b.city) return a.city.localeCompare(b.city);
      return a.name.localeCompare(b.name);
    });

    return dedupedResults.map((beach) => ({
      id: beach.id,
      name: beach.name,
      slug: beach.slug,
      city: beach.city,
      state: beach.state,
      camera_url: beach.camera_url,
      thumbnail_url: beach.thumbnail_url,
      photo_url: beach.photo_url,
      regionSlug: beach.regionSlug,
    }));
  },
  ["beaches-with-unique-cameras"],
  { revalidate: 3600 },
);
