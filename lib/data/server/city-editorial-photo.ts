import { createSupabaseServerClient } from "@/lib/supabase/server";
import { withApprovedPhotos } from "@/lib/supabase/query-builders";

export interface CityEditorialPhoto {
  src: string;
  beachId: string;
  title: string | null;
  creator: string | null;
  creatorUrl: string | null;
  licenseCode: string | null;
  licenseUrl: string | null;
}

export interface CityEditorialPhotoRow {
  beach_id: string;
  image_url: string;
  title: string | null;
  creator_name: string | null;
  creator_url: string | null;
  license_code: string | null;
  license_url: string | null;
  source: string;
}

/** Sources we cannot show as a real photo: Places ToS forbids reuse, and generated images are not photos. */
const EXCLUDED_SOURCES = new Set(["google_places", "ai_generated"]);

function licenseTier(code: string | null): number {
  const normalized = (code ?? "").toLowerCase();
  if (/cc0|public.?domain|\bpdm\b/.test(normalized)) return 0;
  if (/nc|nd/.test(normalized)) return 9;
  if (/by-sa/.test(normalized)) return 2;
  if (/\bby\b/.test(normalized)) return 1;
  return 8;
}

/** PNG "photos" are usually screenshots or scans and weigh several times a JPEG. */
function formatTier(url: string): number {
  return /\.png(\?|$)/i.test(url) ? 1 : 0;
}

/**
 * Pick one photo to stand for a city: the cleanest licence first, a real photo
 * format next, then the page's own beach ranking. Pure so it can be tested
 * without a database.
 */
export function pickCityEditorialPhoto(
  rows: CityEditorialPhotoRow[],
  rankedBeachIds: string[],
): CityEditorialPhoto | null {
  const rank = new Map(rankedBeachIds.map((id, index) => [id, index]));
  const candidates = rows
    .filter((row) => row.image_url && !EXCLUDED_SOURCES.has(row.source))
    .filter((row) => licenseTier(row.license_code) < 8)
    .sort(
      (a, b) =>
        licenseTier(a.license_code) - licenseTier(b.license_code)
        || formatTier(a.image_url) - formatTier(b.image_url)
        || (rank.get(a.beach_id) ?? Infinity) - (rank.get(b.beach_id) ?? Infinity),
    );

  const best = candidates[0];
  if (!best) return null;
  return {
    src: best.image_url,
    beachId: best.beach_id,
    title: best.title,
    creator: best.creator_name,
    creatorUrl: best.creator_url,
    licenseCode: best.license_code,
    licenseUrl: best.license_url,
  };
}

export async function getCityEditorialPhoto(
  rankedBeachIds: string[],
): Promise<CityEditorialPhoto | null> {
  if (rankedBeachIds.length === 0) return null;

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await withApprovedPhotos(
      supabase
        .from("beach_photos")
        .select("beach_id, image_url, title, creator_name, creator_url, license_code, license_url, source"),
    ).in("beach_id", rankedBeachIds);

    if (error || !data) return null;
    return pickCityEditorialPhoto(data as CityEditorialPhotoRow[], rankedBeachIds);
  } catch {
    // A missing photo must never take the page down.
    return null;
  }
}
