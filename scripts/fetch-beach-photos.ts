// TypeScript CLI to ingest beach photos from Openverse + Flickr into Supabase
// Usage examples:
//   yarn photos:fetch --limit=5 --only=sd
//   yarn photos:fetch --beachId=123e4567-... --limit=8

/*
ENV REQUIRED
----------
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
FLICKR_API_KEY=
OPENVERSE_API_URL=https://api.openverse.org/v1/images/
*/

import "dotenv/config";
import fetch from "node-fetch";
import { createClient } from "@supabase/supabase-js";

type Beach = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  location?: string | null;
  region?: string | null;
  country?: string | null;
};

type PhotoRecord = {
  beach_id: string;
  source: "openverse" | "flickr";
  source_id: string;
  image_url: string;
  thumb_url?: string | null;
  title?: string | null;
  creator_name?: string | null;
  creator_url?: string | null;
  license_code?: string | null;
  license_url?: string | null;
  attribution_html?: string | null;
  fetched_at: string;
};

type OpenverseItem = {
  id: string;
  url: string;
  thumbnail: string;
  title: string | null;
  creator: string | null;
  creator_url: string | null;
  license: string;
  license_version?: string;
  license_url?: string;
  provider?: string;
  source?: string;
};

type FlickrSearchResp = {
  photos: {
    page: number;
    pages: number;
    perpage: number;
    total: string;
    photo: Array<{
      id: string;
      owner: string;
      secret: string;
      server: string;
      farm: number;
      title: string;
      ispublic: number;
      license: string;
      ownername?: string;
      url_o?: string;
      height_o?: number;
      width_o?: number;
    }>;
  };
  stat: string;
};

const args = new Map<string, string>();
process.argv.slice(2).forEach((arg) => {
  const [key, value] = arg.startsWith("--") ? arg.slice(2).split("=") : [arg, "true"];
  args.set(key, value ?? "true");
});

const LIMIT = Number(args.get("limit") ?? "6");
const ONLY = args.get("only");
const BEACH_ID = args.get("beachId");
const RADIUS_KM = Number(args.get("radiusKm") ?? "2");

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

function bboxFromLatLng(lat: number, lng: number, km: number) {
  const R = 6371;
  const dLat = (km / R) * (180 / Math.PI);
  const dLng = (km / (R * Math.cos((Math.PI * lat) / 180))) * (180 / Math.PI);
  return {
    min_lat: lat - dLat,
    max_lat: lat + dLat,
    min_lng: lng - dLng,
    max_lng: lng + dLng,
  };
}

function flickrStaticUrl(
  photo: { server: string; id: string; secret: string },
  size: "z" | "b" | "o" | "c" | "m" = "b",
) {
  // https://www.flickr.com/services/api/misc.urls.html
  return `https://live.staticflickr.com/${photo.server}/${photo.id}_${photo.secret}_${size}.jpg`;
}

const FLICKR_LICENSE_MAP: Record<string, { code: string; url: string }> = {
  "4": { code: "CC-BY 2.0", url: "https://creativecommons.org/licenses/by/2.0/" },
  "5": { code: "CC-BY-SA 2.0", url: "https://creativecommons.org/licenses/by-sa/2.0/" },
  "6": { code: "CC-BY-ND 2.0", url: "https://creativecommons.org/licenses/by-nd/2.0/" },
  "9": { code: "CC0 1.0", url: "https://creativecommons.org/publicdomain/zero/1.0/" },
  "10": { code: "CC-BY 4.0", url: "https://creativecommons.org/licenses/by/4.0/" },
  "11": { code: "CC-BY-SA 4.0", url: "https://creativecommons.org/licenses/by-sa/4.0/" },
};

function buildAttributionHtml({
  source,
  creator_name,
  creator_url,
  license_code,
  license_url,
  title,
}: {
  source: string;
  creator_name?: string | null;
  creator_url?: string | null;
  license_code?: string | null;
  license_url?: string | null;
  title?: string | null;
}) {
  const by = creator_name
    ? creator_url
      ? `<a href="${creator_url}" rel="noopener nofollow">${creator_name}</a>`
      : creator_name
    : "Unknown";
  const licenseText =
    license_code && license_url ? `<a href="${license_url}" rel="noopener nofollow">${license_code}</a>` : "";
  const label = title ? `"${title}"` : "Image";
  return `${label} by ${by}${licenseText ? " · " + licenseText : ""} via ${source}`;
}

async function getBeaches(): Promise<Beach[]> {
  if (BEACH_ID) {
    const { data, error } = await supabase
      .from("beaches")
      .select("id,name,latitude,longitude,location,region,country")
      .eq("id", BEACH_ID);
    if (error) throw error;
    return (data as Beach[]) ?? [];
  }
  let query = supabase
    .from("beaches")
    .select("id,name,latitude,longitude,location,region,country")
    .not("latitude", "is", null)
    .not("longitude", "is", null);
  if (ONLY) {
    query = query.or(
      [
        `name.ilike.%${ONLY}%`,
        `location.ilike.%${ONLY}%`,
        `region.ilike.%${ONLY}%`,
        `country.ilike.%${ONLY}%`,
      ].join(","),
    );
  }
  const { data, error } = await query.limit(3000);
  if (error) throw error;
  return (data as Beach[]) ?? [];
}

async function upsertPhoto(record: PhotoRecord) {
  const { error } = await supabase.from("beach_photos").upsert(record, {
    onConflict: "beach_id,source,source_id",
    ignoreDuplicates: false,
  });
  if (error) throw error;
}

async function fetchOpenverse(beach: Beach, limit = LIMIT): Promise<PhotoRecord[]> {
  const place = beach.location ?? beach.region ?? "";
  const query = encodeURIComponent(`${beach.name} beach ${place} ${beach.country ?? ""}`.trim());
  const url = `${process.env.OPENVERSE_API_URL}?q=${query}&license_type=commercial&format=json&page_size=${limit}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Openverse error ${res.status}`);
  const json = (await res.json()) as { results?: OpenverseItem[] };
  const results: OpenverseItem[] = json.results ?? [];
  return results.map((item) => ({
    beach_id: beach.id,
    source: "openverse",
    source_id: item.id,
    image_url: item.url,
    thumb_url: item.thumbnail,
    title: item.title ?? null,
    creator_name: item.creator ?? null,
    creator_url: item.creator_url ?? null,
    license_code: item.license_version ? `${item.license.toUpperCase()} ${item.license_version}` : item.license.toUpperCase(),
    license_url: item.license_url ?? null,
    attribution_html: buildAttributionHtml({
      source: "Openverse",
      creator_name: item.creator,
      creator_url: item.creator_url ?? undefined,
      license_code: item.license ? item.license.toUpperCase() : undefined,
      license_url: item.license_url ?? undefined,
      title: item.title ?? undefined,
    }),
    fetched_at: new Date().toISOString(),
  }));
}

async function fetchFlickr(beach: Beach, limit = LIMIT): Promise<PhotoRecord[]> {
  const bbox = bboxFromLatLng(beach.latitude, beach.longitude, RADIUS_KM);
  const params = new URLSearchParams({
    method: "flickr.photos.search",
    api_key: process.env.FLICKR_API_KEY!,
    format: "json",
    nojsoncallback: "1",
    bbox: `${bbox.min_lng},${bbox.min_lat},${bbox.max_lng},${bbox.max_lat}`,
    content_type: "1",
    media: "photos",
    extras: "license,owner_name,url_o",
    per_page: String(limit),
    sort: "interestingness-desc",
    license: "4,5,6,9,10,11",
    safe_search: "1",
  });
  const url = `https://api.flickr.com/services/rest/?${params.toString()}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Flickr error ${res.status}`);
  const json: FlickrSearchResp = await res.json();
  return json.photos.photo.map((photo) => {
    const licenseInfo = FLICKR_LICENSE_MAP[photo.license] || { code: "Unknown", url: "" };
    const image_url = photo.url_o || flickrStaticUrl(photo, "b");
    const thumb_url = flickrStaticUrl(photo, "z");
    return {
      beach_id: beach.id,
      source: "flickr",
      source_id: photo.id,
      image_url,
      thumb_url,
      title: photo.title || null,
      creator_name: photo.ownername || photo.owner || null,
      creator_url: `https://www.flickr.com/people/${photo.owner}`,
      license_code: licenseInfo.code,
      license_url: licenseInfo.url,
      attribution_html: buildAttributionHtml({
        source: "Flickr",
        creator_name: photo.ownername || photo.owner,
        creator_url: `https://www.flickr.com/people/${photo.owner}`,
        license_code: licenseInfo.code,
        license_url: licenseInfo.url,
        title: photo.title,
      }),
      fetched_at: new Date().toISOString(),
    };
  });
}

async function main() {
  const beaches = await getBeaches();
  console.log("Beaches to fetch:", beaches.length);
  for (const beach of beaches) {
    try {
      const place = beach.location ?? beach.region ?? "";
      console.log(`Processing ${beach.name} (${place})`);
      const [openverseResult, flickrResult] = await Promise.allSettled([
        fetchOpenverse(beach, LIMIT),
        fetchFlickr(beach, LIMIT),
      ]);
      const items: PhotoRecord[] = [];
      if (openverseResult.status === "fulfilled") {
        items.push(...openverseResult.value);
      } else {
        console.error(`Openverse failed for ${beach.name}:`, openverseResult.reason);
      }
      if (flickrResult.status === "fulfilled") {
        items.push(...flickrResult.value);
      } else {
        console.error(`Flickr failed for ${beach.name}:`, flickrResult.reason);
      }
      const seen = new Set<string>();
      for (const record of items) {
        if (seen.has(record.image_url)) continue;
        seen.add(record.image_url);
        await upsertPhoto(record);
      }
      console.log(`Saved ${seen.size} photos.`);
      await new Promise((resolve) => setTimeout(resolve, 800));
    } catch (err) {
      console.error(`Error on ${beach.name}:`, err);
    }
  }
  console.log("Done");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
