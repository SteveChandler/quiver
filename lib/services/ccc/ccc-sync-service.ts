/**
 * CCC Coastal Commission Sync Service
 *
 * Fetches public access location data from the California Coastal Commission
 * API, normalizes amenity flags, upserts into the `ccc_access_locations` table,
 * and matches locations to nearby beaches using Haversine distance.
 *
 * Data pipeline:
 *   CCC API -> normalize -> ccc_access_locations -> beach_amenity_sources -> mv_beach_amenities
 *
 * @module ccc/ccc-sync-service
 */

import { haversineDistance } from "@/lib/utils/geo-utils";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CCC_API_URL = "https://api.coastal.ca.gov/access/v1/locations";

/** Supabase upsert batch size limit */
const UPSERT_BATCH_SIZE = 100;

/** Default radius in meters for proximity matching */
const DEFAULT_MATCH_RADIUS_M = 1500;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Raw record from the CCC API (ALL CAPS, inconsistent casing) */
interface RawCCCRecord {
  ID: number;
  NameMobileWeb: string;
  LATITUDE: number;
  LONGITUDE: number;
  COUNTY?: string;
  PARKING?: string;
  FEE?: string;
  RESTROOMS?: string;
  DSABLDACSS?: string;
  DOG_FRIENDLY?: string;
  EZ4STROLLERS?: string;
  CAMPGROUND?: string;
  BOATING?: string;
  FISHING?: string;
  PCNC_AREA?: string;
  VOLLEYBALL?: string;
  BIKE_PATH?: string;
  TIDEPOOL?: string;
  SNDY_BEACH?: string;
  RKY_SHORE?: string;
  BLFTP_TRLS?: string;
  WLDLFE_VWG?: string;
  VISTOR_CTR?: string;
  [key: string]: unknown;
}

/** Normalized CCC location ready for DB upsert */
export interface NormalizedCCCLocation {
  ccc_id: number;
  name: string;
  lat: number;
  lon: number;
  county: string | null;
  has_parking: boolean;
  has_fee: boolean;
  has_restrooms: boolean;
  has_ada_access: boolean;
  has_dog_friendly: boolean;
  has_stroller_friendly: boolean;
  has_campground: boolean;
  has_boating: boolean;
  has_fishing: boolean;
  has_picnic_area: boolean;
  has_volleyball: boolean;
  has_bike_path: boolean;
  has_tidepools: boolean;
  has_sandy_beach: boolean;
  has_rocky_shore: boolean;
  has_bluff_trail: boolean;
  has_wildlife_viewing: boolean;
  has_visitor_center: boolean;
  raw_data: Record<string, unknown>;
  synced_at: string;
}

/** Result returned from the fetch phase */
export interface FetchResult {
  locations: NormalizedCCCLocation[];
  totalRaw: number;
  skipped: number;
  notModified: boolean;
  errors: string[];
}

/** Result returned from the upsert phase */
export interface UpsertResult {
  upserted: number;
  batches: number;
  errors: string[];
}

/** Result returned from the match phase */
export interface MatchResult {
  beachesEvaluated: number;
  matchesFound: number;
  matchesUpserted: number;
  viewRefreshed: boolean;
  errors: string[];
}

// ---------------------------------------------------------------------------
// Module-level ETag cache (persists for the duration of a single cron run)
// ---------------------------------------------------------------------------

let cachedETag: string | null = null;

// ---------------------------------------------------------------------------
// Boolean normalization
// ---------------------------------------------------------------------------

/**
 * Normalize a CCC amenity string to a boolean.
 *
 * The CCC API uses inconsistent string representations for boolean flags:
 * "Yes", "No", "None", "", with dirty variants like trailing/leading spaces,
 * lowercase, truncated "N", uncertain "?" or "Yes?".
 *
 * Rule: trim -> lowercase -> starts with "yes" = true, everything else = false.
 */
function normalizeBool(value: unknown): boolean {
  if (typeof value !== "string") return false;
  const cleaned = value.trim().toLowerCase();
  return cleaned.startsWith("yes");
}

// ---------------------------------------------------------------------------
// Record normalization
// ---------------------------------------------------------------------------

/**
 * Normalize a single raw CCC API record into a typed object matching the
 * `ccc_access_locations` table schema.
 *
 * Records missing an ID, name, or valid coordinates are skipped (returns null).
 */
function normalizeCCCLocation(
  raw: RawCCCRecord
): NormalizedCCCLocation | null {
  // Validate required fields
  if (
    raw.ID == null ||
    !raw.NameMobileWeb ||
    raw.LATITUDE == null ||
    raw.LONGITUDE == null
  ) {
    return null;
  }

  const lat = Number(raw.LATITUDE);
  const lon = Number(raw.LONGITUDE);

  // Basic coordinate sanity check (California bounding box with margin)
  if (
    Number.isNaN(lat) ||
    Number.isNaN(lon) ||
    lat < 30 ||
    lat > 43 ||
    lon < -130 ||
    lon > -114
  ) {
    return null;
  }

  return {
    ccc_id: Number(raw.ID),
    name: String(raw.NameMobileWeb).trim(),
    lat,
    lon,
    county: raw.COUNTY ? String(raw.COUNTY).trim() : null,
    has_parking: normalizeBool(raw.PARKING),
    has_fee: normalizeBool(raw.FEE),
    has_restrooms: normalizeBool(raw.RESTROOMS),
    has_ada_access: normalizeBool(raw.DSABLDACSS),
    has_dog_friendly: normalizeBool(raw.DOG_FRIENDLY),
    has_stroller_friendly: normalizeBool(raw.EZ4STROLLERS),
    has_campground: normalizeBool(raw.CAMPGROUND),
    has_boating: normalizeBool(raw.BOATING),
    has_fishing: normalizeBool(raw.FISHING),
    has_picnic_area: normalizeBool(raw.PCNC_AREA),
    has_volleyball: normalizeBool(raw.VOLLEYBALL),
    has_bike_path: normalizeBool(raw.BIKE_PATH),
    has_tidepools: normalizeBool(raw.TIDEPOOL),
    has_sandy_beach: normalizeBool(raw.SNDY_BEACH),
    has_rocky_shore: normalizeBool(raw.RKY_SHORE),
    has_bluff_trail: normalizeBool(raw.BLFTP_TRLS),
    has_wildlife_viewing: normalizeBool(raw.WLDLFE_VWG),
    has_visitor_center: normalizeBool(raw.VISTOR_CTR),
    raw_data: raw as unknown as Record<string, unknown>,
    synced_at: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fetch all CCC public access locations from the Coastal Commission API.
 *
 * Uses ETag/If-None-Match conditional fetching to avoid re-processing
 * unchanged data. The ETag is cached in module scope for the lifetime of
 * the serverless function invocation.
 */
export async function fetchCCCLocations(): Promise<FetchResult> {
  const result: FetchResult = {
    locations: [],
    totalRaw: 0,
    skipped: 0,
    notModified: false,
    errors: [],
  };

  try {
    const headers: Record<string, string> = {
      Accept: "application/json",
    };

    if (cachedETag) {
      headers["If-None-Match"] = cachedETag;
    }

    const response = await fetch(CCC_API_URL, {
      headers,
      signal: AbortSignal.timeout(30_000),
    });

    // Not modified -- data unchanged since last fetch
    if (response.status === 304) {
      result.notModified = true;
      console.log("[CCC] 304 Not Modified -- skipping parse");
      return result;
    }

    if (!response.ok) {
      result.errors.push(
        `CCC API returned ${response.status}: ${response.statusText}`
      );
      return result;
    }

    // Cache the new ETag for future requests within this invocation
    const newETag = response.headers.get("etag");
    if (newETag) {
      cachedETag = newETag;
    }

    const rawRecords: RawCCCRecord[] = await response.json();
    result.totalRaw = rawRecords.length;

    for (const raw of rawRecords) {
      const normalized = normalizeCCCLocation(raw);
      if (normalized) {
        result.locations.push(normalized);
      } else {
        result.skipped++;
      }
    }

    console.log(
      `[CCC] Fetched ${result.totalRaw} raw records, normalized ${result.locations.length}, skipped ${result.skipped}`
    );
  } catch (error) {
    result.errors.push(
      error instanceof Error
        ? `Fetch failed: ${error.message}`
        : "Unknown fetch error"
    );
  }

  return result;
}

/**
 * Batch upsert normalized CCC locations into the `ccc_access_locations` table.
 *
 * Upserts on `ccc_id` conflict, updating all fields on match. Processes in
 * chunks of 100 to stay within Supabase request size limits.
 */
export async function upsertCCCLocations(
  supabase: ReturnType<typeof import("@/lib/supabase/server").createSupabaseServiceRoleClient>,
  locations: NormalizedCCCLocation[]
): Promise<UpsertResult> {
  const result: UpsertResult = {
    upserted: 0,
    batches: 0,
    errors: [],
  };

  if (locations.length === 0) return result;

  for (let i = 0; i < locations.length; i += UPSERT_BATCH_SIZE) {
    const batch = locations.slice(i, i + UPSERT_BATCH_SIZE);

    const { error } = await supabase
      .from("ccc_access_locations")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .upsert(batch as any, {
        onConflict: "ccc_id",
        ignoreDuplicates: false,
      });

    result.batches++;

    if (error) {
      result.errors.push(
        `Batch ${result.batches} (rows ${i}-${i + batch.length - 1}): ${error.message}`
      );
    } else {
      result.upserted += batch.length;
    }
  }

  console.log(
    `[CCC] Upserted ${result.upserted}/${locations.length} locations in ${result.batches} batches`
  );

  return result;
}

/**
 * Match CCC access locations to nearby California beaches using Haversine distance.
 *
 * For each CA beach, finds all CCC locations within `radiusM` meters and
 * upserts the pairs into `beach_amenity_sources`. Then refreshes the
 * `mv_beach_amenities` materialized view.
 *
 * Follows the same pattern as the IOOS sync station-to-beach matching:
 * fetch all beaches + all CCC locations, compute distances in JS.
 */
export async function matchCCCToBeaches(
  supabase: ReturnType<typeof import("@/lib/supabase/server").createSupabaseServiceRoleClient>,
  radiusM: number = DEFAULT_MATCH_RADIUS_M
): Promise<MatchResult> {
  const result: MatchResult = {
    beachesEvaluated: 0,
    matchesFound: 0,
    matchesUpserted: 0,
    viewRefreshed: false,
    errors: [],
  };

  const radiusKm = radiusM / 1000;

  try {
    // Fetch all California beaches with coordinates
    const { data: beaches, error: beachError } = await supabase
      .from("beaches")
      .select("id, name, lat, lon")
      .eq("state", "CA")
      .not("lat", "is", null)
      .not("lon", "is", null);

    if (beachError) {
      result.errors.push(`Failed to fetch beaches: ${beachError.message}`);
      return result;
    }

    if (!beaches || beaches.length === 0) {
      result.errors.push("No California beaches found with coordinates");
      return result;
    }

    // Fetch all CCC access locations with their UUIDs and coordinates
    const { data: cccLocations, error: cccError } = await supabase
      .from("ccc_access_locations")
      .select("id, lat, lon");

    if (cccError) {
      result.errors.push(
        `Failed to fetch CCC locations: ${cccError.message}`
      );
      return result;
    }

    if (!cccLocations || cccLocations.length === 0) {
      result.errors.push(
        "No CCC locations found -- run the import phase first"
      );
      return result;
    }

    console.log(
      `[CCC] Matching ${beaches.length} CA beaches against ${cccLocations.length} CCC locations (radius=${radiusM}m)`
    );

    result.beachesEvaluated = beaches.length;

    // Build match pairs
    const matchPairs: Array<{
      beach_id: string;
      ccc_location_id: string;
      distance_m: number;
    }> = [];

    for (const beach of beaches) {
      for (const ccc of cccLocations) {
        const distanceKm = haversineDistance(
          beach.lat,
          beach.lon,
          ccc.lat,
          ccc.lon
        );

        if (distanceKm <= radiusKm) {
          matchPairs.push({
            beach_id: beach.id,
            ccc_location_id: ccc.id,
            distance_m: Math.round(distanceKm * 1000),
          });
        }
      }
    }

    result.matchesFound = matchPairs.length;

    console.log(
      `[CCC] Found ${matchPairs.length} beach-to-CCC matches`
    );

    // Clear existing matches and insert fresh set
    // This avoids stale links from locations that moved out of range
    if (matchPairs.length > 0) {
      // Delete all existing matches (full rebuild each sync)
      const { error: deleteError } = await supabase
        .from("beach_amenity_sources")
        .delete()
        .gte("created_at", "1970-01-01T00:00:00Z"); // match all rows

      if (deleteError) {
        result.errors.push(
          `Failed to clear old matches: ${deleteError.message}`
        );
        // Continue anyway -- upsert will handle conflicts
      }

      // Insert in batches
      for (let i = 0; i < matchPairs.length; i += UPSERT_BATCH_SIZE) {
        const batch = matchPairs.slice(i, i + UPSERT_BATCH_SIZE);

        const { error: insertError } = await supabase
          .from("beach_amenity_sources")
          .upsert(batch, {
            onConflict: "beach_id,ccc_location_id",
            ignoreDuplicates: false,
          });

        if (insertError) {
          result.errors.push(
            `Match batch insert error (rows ${i}-${i + batch.length - 1}): ${insertError.message}`
          );
        } else {
          result.matchesUpserted += batch.length;
        }
      }
    }

    console.log(
      `[CCC] Upserted ${result.matchesUpserted}/${matchPairs.length} match records`
    );

    // Refresh the materialized view
    const { error: refreshError } = await supabase.rpc(
      "refresh_mv_beach_amenities"
    );

    if (refreshError) {
      result.errors.push(
        `Failed to refresh mv_beach_amenities: ${refreshError.message}`
      );
    } else {
      result.viewRefreshed = true;
      console.log("[CCC] Refreshed mv_beach_amenities materialized view");
    }
  } catch (error) {
    result.errors.push(
      error instanceof Error
        ? error.message
        : "Unknown error during beach matching"
    );
  }

  return result;
}
