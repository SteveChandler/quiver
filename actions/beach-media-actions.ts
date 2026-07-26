"use server";

import { getSpotGalleryPhotos } from "@/actions/spot/spot-data-actions";
import { DEFAULT_BEACH_PHOTOS_LIMIT } from "@/lib/constants/featured-beaches-config";
import type {
  CommunityPhotoAttribution,
  ResolvedSpotPhoto,
} from "@/lib/community-photos";

export interface BestBeachPhoto {
  id: string;
  created_at: string;
  public_url: string;
  source: ResolvedSpotPhoto["source"];
  title: string | null;
  creatorName: string | null;
  attributionHtml: string | null;
  attribution: CommunityPhotoAttribution | null;
  community: ResolvedSpotPhoto["community"];
}

interface BestBeachPhotosResult {
  success: boolean;
  data: BestBeachPhoto[];
  error?: string;
}

function cleanThumbnailUrl(url: string | null): string | null {
  if (!url) return null;
  return url.replace(/\?format=json$/i, "");
}

function toBestBeachPhoto(photo: ResolvedSpotPhoto): BestBeachPhoto {
  return {
    id: photo.id,
    created_at: photo.createdAt,
    public_url: cleanThumbnailUrl(photo.thumbUrl) ?? photo.imageUrl,
    source: photo.source,
    title: photo.title,
    creatorName: photo.creatorName,
    attributionHtml: photo.attributionHtml,
    attribution: photo.attribution,
    community: photo.community,
  };
}

export async function getBestBeachPhotosAction(
  beachId: string,
  limit = DEFAULT_BEACH_PHOTOS_LIMIT,
): Promise<BestBeachPhotosResult> {
  try {
    const photos = await getSpotGalleryPhotos(beachId, limit);
    return { success: true, data: photos.map(toBestBeachPhoto) };
  } catch (error) {
    return {
      success: false,
      data: [],
      error: error instanceof Error ? error.message : "Failed to load photos",
    };
  }
}
