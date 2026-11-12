import { isBlockedCameraUrl } from "@/lib/media/camera-provider-policy";
import "server-only";

import { unstable_cache } from "next/cache";
import { createPublicReadClient, createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { getResolvedSpotPhotoMap, type ResolvedSpotPhoto } from "@/lib/community-photos";
import type { BeachAmenities } from "@/types/amenities";

// The beach detail page is force-dynamic, and RSC, prefetch and query-string
// requests bypass its 15-minute CDN cache. On Oct 29 2026 a crawler drove these
// per-beach reads to ~1,100 renders/hour against Postgres. These rows change
// rarely, so they are shared across requests. Errors throw, so a failed read is
// never cached.
const STATIC_READ_TTL_SECONDS = 3600;
// Community photos can be taken down by moderation; keep them no staler than
// the page's own CDN window.
const PHOTO_TTL_SECONDS = 900;
export const BEACH_DETAIL_STATIC_TAG = "beach-detail-static";

async function readBeachCameraUrl(beachId: string): Promise<string | null> {
  const { data, error } = await createPublicReadClient()
    .from("beach_sources")
    .select("camera_url")
    .eq("beach_id", beachId)
    .not("camera_url", "is", null)
    .neq("camera_url", "")
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return isBlockedCameraUrl(data?.camera_url) ? null : data?.camera_url ?? null;
}

async function readBeachAmenities(beachId: string): Promise<BeachAmenities | null> {
  const { data, error } = await createSupabaseServiceRoleClient()
    .from("mv_beach_amenities")
    .select("*")
    .eq("beach_id", beachId)
    .maybeSingle();
  if (error) throw error;
  return data as BeachAmenities | null;
}

async function readBeachFeaturedPhoto(beachId: string): Promise<ResolvedSpotPhoto | null> {
  const photos = await getResolvedSpotPhotoMap({
    targets: [{ type: "beach", id: beachId }],
    limitPerTarget: 1,
  });
  return photos.values().next().value?.[0] ?? null;
}

function cachedPerBeach<T>(
  name: string,
  read: (beachId: string) => Promise<T>,
  revalidate: number,
): (beachId: string) => Promise<T> {
  return (beachId: string): Promise<T> =>
    unstable_cache(read, [BEACH_DETAIL_STATIC_TAG, name], {
      revalidate,
      tags: [BEACH_DETAIL_STATIC_TAG, `${BEACH_DETAIL_STATIC_TAG}:${beachId}`],
    })(beachId);
}

export const getCachedBeachCameraUrl = cachedPerBeach(
  "camera-url-v2",
  readBeachCameraUrl,
  STATIC_READ_TTL_SECONDS,
);

export const getCachedBeachAmenities = cachedPerBeach(
  "amenities",
  readBeachAmenities,
  STATIC_READ_TTL_SECONDS,
);

export const getCachedBeachFeaturedPhoto = cachedPerBeach(
  "featured-photo",
  readBeachFeaturedPhoto,
  PHOTO_TTL_SECONDS,
);
