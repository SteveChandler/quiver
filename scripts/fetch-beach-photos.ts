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
import pLimit from "p-limit";

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
for (let i = 2; i < process.argv.length; i++) {
  const arg = process.argv[i];
  if (arg.startsWith("--")) {
    const [key, value] = arg.slice(2).split("=");
    if (value !== undefined) {
      args.set(key, value);
    } else if (i + 1 < process.argv.length && !process.argv[i + 1].startsWith("--")) {
      args.set(key, process.argv[i + 1]);
      i++;
    } else {
      args.set(key, "true");
    }
  }
}

const LIMIT = Number(args.get("limit") ?? "6");
const ONLY = args.get("only");
const BEACH_ID = args.get("beachId");
const RADIUS_KM = Number(args.get("radiusKm") ?? "2");
const DRY_RUN = args.get("dryRun") === "true";
const VERBOSE = args.get("verbose") === "true";

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
      .select("id,name,lat,lon,city,state,country")
      .eq("id", BEACH_ID);
    if (error) throw error;
    return (data as Beach[]) ?? [];
  }
  let query = supabase
    .from("beaches")
    .select("id,name,lat,lon,city,state,country")
    .not("lat", "is", null)
    .not("lon", "is", null);
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

function normalizeQuery(beach: Beach): string {
  const place = beach.location ?? beach.region ?? "";
  const country = beach.country ?? "";

  // Build query parts
  const parts = [beach.name, "beach", place, country]
    .filter(Boolean)
    .map(part =>
      part
        .trim()
        .replace(/[^\w\s-]/g, " ") // Strip punctuation except hyphens
        .replace(/\s+/g, " ") // Collapse whitespace
        .trim()
    )
    .filter(part => part.length > 0);

  // Fallback: if name is very short, prioritize region + country
  if (beach.name.length <= 3 && beach.region && beach.country) {
    return `${beach.region} ${beach.country} beach`.replace(/\s+/g, " ").trim();
  }

  return parts.join(" ");
}

async function upsertPhoto(record: PhotoRecord) {
  const { error } = await supabase.from("beach_photos").upsert(record, {
    onConflict: "beach_id,source,source_id",
    ignoreDuplicates: false,
  });
  if (error) throw error;
}

async function fetchOpenverse(beach: Beach, limit = LIMIT): Promise<PhotoRecord[]> {
  const normalizedQuery = normalizeQuery(beach);
  const query = encodeURIComponent(normalizedQuery);
  const url = `${process.env.OPENVERSE_API_URL}?q=${query}&license_type=commercial&format=json&page_size=${limit}`;

  if (VERBOSE) {
    console.log(`[Openverse] Query for ${beach.name}: "${normalizedQuery}"`);
    console.log(`[Openverse] URL: ${url}`);
  }

  let retries = 3;
  let backoffMs = 1000;

  while (retries > 0) {
    const res = await fetch(url, {
      headers: {
        "Accept": "application/json",
        "User-Agent": "Quiver-BeachPhotos/1.0",
      },
    });

    if (res.status === 429) {
      console.warn(`Rate limited by Openverse for ${beach.name}, retrying in ${backoffMs}ms...`);
      await new Promise((resolve) => setTimeout(resolve, backoffMs));
      backoffMs *= 2;
      retries--;
      continue;
    }

    if (!res.ok) {
      const body = await res.text();
      console.error(`Openverse error ${res.status} for ${beach.name}:`, body);
      throw new Error(`Openverse error ${res.status}: ${body}`);
    }

    const json = (await res.json()) as { results?: OpenverseItem[] };
    const results: OpenverseItem[] = json.results ?? [];
    return results.map((item) => ({
      beach_id: beach.id,
      source: "openverse",
      source_id: item.id,
      image_url: item.url,
      // Strip ?format=json from thumbnail URLs - Openverse sometimes returns this suffix
      // which causes 400 errors when passed through Next.js Image Optimization
      thumb_url: item.thumbnail?.replace(/\?format=json$/i, '') ?? null,
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

  throw new Error(`Openverse rate limit exceeded for ${beach.name} after retries`);
}

async function fetchFlickr(beach: Beach, limit = LIMIT): Promise<PhotoRecord[]> {
  const bbox = bboxFromLatLng(beach.lat, beach.lon, RADIUS_KM);
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

  if (DRY_RUN) {
    console.log("\n[DRY RUN] Would process the following beaches:");
    for (const beach of beaches) {
      const place = beach.location ?? beach.region ?? "";
      const query = normalizeQuery(beach);
      console.log(`  - ${beach.name} (${place})`);
      console.log(`    Query: "${query}"`);
    }
    console.log("\nDry run complete. No API calls made.");
    return;
  }

  // Limit concurrency to 2 requests at a time to respect rate limits
  const limit = pLimit(2);

  const tasks = beaches.map((beach) =>
    limit(async () => {
      try {
        const place = beach.location ?? beach.region ?? "";
        console.log(`Processing ${beach.name} (${place})`);

        // Only fetch from Openverse for now (Flickr disabled)
        const openverseResult = await fetchOpenverse(beach, LIMIT).catch((err) => {
          console.error(`Openverse failed for ${beach.name}:`, err);
          return [];
        });

        const items: PhotoRecord[] = openverseResult;
        const seen = new Set<string>();

        for (const record of items) {
          if (seen.has(record.image_url)) continue;
          seen.add(record.image_url);
          await upsertPhoto(record);
        }

        console.log(`Saved ${seen.size} photos for ${beach.name}.`);

        // Add delay between beaches to respect rate limits
        await new Promise((resolve) => setTimeout(resolve, 800));
      } catch (err) {
        console.error(`Error on ${beach.name}:`, err);
      }
    })
  );

  await Promise.all(tasks);
  console.log("Done");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
