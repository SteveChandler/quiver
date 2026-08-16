/**
 * Water Quality Sync Service -- CEDEN (California) + PacIOOS ERDDAP (Hawaii)
 *
 * Data pipeline:
 *   CEDEN API    -> wq_monitoring_stations -> beach linkage  (CA)
 *   PacIOOS ERDDAP -> wq_monitoring_stations -> beach linkage  (HI)
 *   wq_samples   -> beach_water_quality (evaluated via EPA criteria)
 *
 * Three phases:
 *   1. syncWQStations  -- Monthly station discovery and beach matching
 *   2. syncWQSamples   -- Bi-weekly sample data fetch (last 90 days)
 *   3. evaluateWaterQuality -- Apply EPA criteria to compute per-beach status
 *
 * @module water-quality/water-quality-sync-service
 */

import { haversineDistance } from "@/lib/utils/geo-utils";
import {
  EPA_BEACH_CRITERIA,
  WQ_STATUS,
  CEDEN_CONFIG,
  PACIOOS_CONFIG,
  type WQStatus,
} from "@/lib/constants/water-quality";
import type { SupabaseServiceClient } from "@/types/supabase";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const UPSERT_BATCH_SIZE = 100;
const LOG_PREFIX = "[WQ]";

/** Maximum radius (km) for proxy station matching on UNKNOWN beaches */
const PROXY_STATION_RADIUS_KM = 2;

/** Batch size for Supabase .in() queries (limit ~1000) */
const IN_BATCH_SIZE = 500;

/** Safety limit for CSV stream parsing (50 MB) */
const MAX_RESPONSE_BYTES = 50 * 1024 * 1024;

/** Maximum rows fetched per CEDEN sample query */
const CEDEN_SAMPLE_QUERY_LIMIT = 32_000;

/** Supabase's default response cap; use explicit pages for station reads. */
const MONITORING_STATION_PAGE_SIZE = 1_000;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Parsed monitoring station record */
interface ParsedStation {
  station_id: string;
  station_name: string;
  organization_id: string;
  organization_name: string;
  latitude: number;
  longitude: number;
  county: string | null;
  state_code: string;
  state_name: string;
}

/** Row to upsert into wq_monitoring_stations (column names match DB schema) */
interface StationUpsertRow {
  station_id: string;
  name: string;
  org_id: string;
  org_name: string;
  lat: number;
  lon: number;
  county: string | null;
  state: string;
  nearest_beach_id: string | null;
  distance_to_beach_m: number | null;
  synced_at: string;
}

/** Row to upsert into wq_samples (column names match DB schema) */
interface SampleUpsertRow {
  station_id: string;  // UUID FK to wq_monitoring_stations.id
  sample_date: string;
  characteristic: string;
  value: number | null;
  unit: string | null;
  detection_condition: string | null;
}

/** Beach water quality evaluation row (column names match DB schema) */
interface WaterQualityUpsertRow {
  beach_id: string;
  status: WQStatus;
  previous_status: WQStatus | null;
  latest_enterococcus: number | null;
  latest_fecal_coliform: number | null;
  latest_sample_date: string | null;
  total_samples_30d: number;
  exceedance_count_30d: number;
  monitoring_station_id: string | null;
  status_reason: string | null;
  status_changed_at: string | null;
  updated_at: string;
}

interface MonitoringStationRow {
  id: string;
  station_id: string;
  nearest_beach_id: string | null;
  lat?: number | null;
  lon?: number | null;
  name?: string | null;
}

interface MonitoringStationPageResult {
  stations: MonitoringStationRow[];
  error: string | null;
}

// ---------------------------------------------------------------------------
// Result types (returned to the cron route)
// ---------------------------------------------------------------------------

export interface StationSyncResult {
  statesFetched: number;
  stationsParsed: number;
  stationsMatched: number;
  stationsUpserted: number;
  errors: string[];
  duration_ms: number;
}

export interface SampleSyncResult {
  statesFetched: number;
  samplesParsed: number;
  samplesMatched: number;
  samplesUpserted: number;
  futureSamplesRejected: number;
  errors: string[];
  duration_ms: number;
}

export interface EvaluationResult {
  beachesEvaluated: number;
  statusCounts: Record<WQStatus, number>;
  statusChanges: number;
  errors: string[];
  duration_ms: number;
}

function utcDateString(date: Date = new Date()): string {
  return date.toISOString().split("T")[0];
}

function subtractUtcDays(dateISO: string, days: number): string {
  const date = new Date(`${dateISO}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() - days);
  return utcDateString(date);
}

function normalizeSampleDate(value: unknown): string | null {
  if (typeof value !== "string") return null;

  const date = value.split("T")[0]?.trim();
  return date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;
}

async function fetchAllMonitoringStations(
  supabase: SupabaseServiceClient,
  select: string,
  linkedOnly: boolean
): Promise<MonitoringStationPageResult> {
  const stations: MonitoringStationRow[] = [];

  for (let offset = 0; ; offset += MONITORING_STATION_PAGE_SIZE) {
    const baseQuery = supabase
      .from("wq_monitoring_stations")
      .select(select);
    const filteredQuery = linkedOnly
      ? baseQuery.not("nearest_beach_id", "is", null)
      : baseQuery;
    const { data, error } = await filteredQuery
      .order("id", { ascending: true })
      .range(offset, offset + MONITORING_STATION_PAGE_SIZE - 1);

    if (error) {
      return { stations, error: error.message };
    }

    const page = (data ?? []) as unknown as MonitoringStationRow[];
    stations.push(...page);

    if (page.length < MONITORING_STATION_PAGE_SIZE) {
      return { stations, error: null };
    }
  }
}

// ---------------------------------------------------------------------------
// CSV parsing utilities
// ---------------------------------------------------------------------------

/**
 * Parse a single CSV line, handling quoted fields with embedded commas.
 * Does NOT support escaped quotes inside quoted fields.
 */
function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      fields.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  fields.push(current.trim());
  return fields;
}

/**
 * Stream-parse a CSV response, calling `onRow` for each data row.
 * Processes line by line to avoid loading the entire response into memory.
 *
 * Returns the count of rows parsed and any parse errors.
 */
async function streamParseCSV(
  response: Response,
  onRow: (fields: string[], headers: string[]) => void
): Promise<{ rowCount: number; errors: string[] }> {
  const errors: string[] = [];
  let rowCount = 0;
  let headers: string[] = [];

  const body = response.body;
  if (!body) {
    errors.push("Response body is null");
    return { rowCount, errors };
  }

  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      totalBytes += value.byteLength;

      // Guard against unexpectedly large responses
      if (totalBytes > MAX_RESPONSE_BYTES) {
        errors.push(
          `Response exceeded ${MAX_RESPONSE_BYTES / 1024 / 1024}MB limit (${Math.round(totalBytes / 1024 / 1024)}MB). Truncating.`
        );
        break;
      }

      buffer += decoder.decode(value, { stream: true });

      // Process complete lines
      const lines = buffer.split("\n");
      // Keep the last partial line in the buffer
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        if (headers.length === 0) {
          headers = parseCSVLine(trimmed);
          continue;
        }

        try {
          const fields = parseCSVLine(trimmed);
          onRow(fields, headers);
          rowCount++;
        } catch (err) {
          // Skip malformed rows silently
          if (errors.length < 10) {
            errors.push(
              `Row parse error at row ${rowCount + 1}: ${err instanceof Error ? err.message : "unknown"}`
            );
          }
        }
      }
    }

    // Process any remaining data in the buffer
    if (buffer.trim()) {
      if (headers.length > 0) {
        try {
          const fields = parseCSVLine(buffer.trim());
          onRow(fields, headers);
          rowCount++;
        } catch {
          // Skip final malformed line
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  return { rowCount, errors };
}

/**
 * Get the value of a named column from a CSV row.
 */
function getField(
  fields: string[],
  headers: string[],
  columnName: string
): string {
  const idx = headers.indexOf(columnName);
  if (idx === -1 || idx >= fields.length) return "";
  return fields[idx];
}

// ---------------------------------------------------------------------------
// Source-specific station fetchers
// ---------------------------------------------------------------------------

/**
 * Fetch monitoring stations from CEDEN (California Environmental Data Exchange Network).
 * Uses the CKAN datastore_search_sql endpoint on data.ca.gov.
 */
async function fetchCEDENStations(): Promise<{ stations: ParsedStation[]; errors: string[] }> {
  const errors: string[] = [];
  const stations: ParsedStation[] = [];

  try {
    const sql = `
      SELECT DISTINCT "StationCode", "StationName", "TargetLatitude", "TargetLongitude"
      FROM "${CEDEN_CONFIG.resourceId}"
      WHERE "Analyte" IN (${CEDEN_CONFIG.characteristics.map(c => `'${c}'`).join(", ")})
        AND "MatrixName" = 'samplewater'
        AND "TargetLatitude" IS NOT NULL
      LIMIT ${CEDEN_CONFIG.queryLimit}
    `;

    const url = new URL(`${CEDEN_CONFIG.baseUrl}/datastore_search_sql`);
    url.searchParams.set("sql", sql);

    const response = await fetch(url.toString(), {
      signal: AbortSignal.timeout(CEDEN_CONFIG.requestTimeoutMs),
    });

    if (!response.ok) {
      errors.push(`CEDEN station fetch failed: HTTP ${response.status}`);
      return { stations, errors };
    }

    const json = await response.json();
    const records = json?.result?.records ?? [];

    const seen = new Set<string>();
    for (const rec of records) {
      const code = rec.StationCode;
      const lat = parseFloat(rec.TargetLatitude);
      const lon = parseFloat(rec.TargetLongitude);

      if (!code || isNaN(lat) || isNaN(lon) || seen.has(code)) continue;
      seen.add(code);

      stations.push({
        station_id: `CEDEN-${code}`,
        station_name: rec.StationName || code,
        organization_id: "CEDEN",
        organization_name: "California Environmental Data Exchange Network",
        latitude: lat,
        longitude: lon,
        county: null,
        state_code: "CA",
        state_name: "California",
      });
    }

    console.log(`${LOG_PREFIX} CEDEN: ${records.length} records -> ${stations.length} unique stations`);
  } catch (error) {
    errors.push(`CEDEN station fetch error: ${error instanceof Error ? error.message : "unknown"}`);
  }

  return { stations, errors };
}

/**
 * Fetch monitoring stations from PacIOOS ERDDAP (Hawaii DOH Clean Water Branch).
 * Returns CSV with a units row on line 2 that is naturally skipped by the isNaN guard.
 */
async function fetchPacIOOSStations(): Promise<{ stations: ParsedStation[]; errors: string[] }> {
  const errors: string[] = [];
  const stations: ParsedStation[] = [];

  try {
    const url = `${PACIOOS_CONFIG.baseUrl}.csv?location_id,location_name,latitude,longitude&distinct()`;

    const response = await fetch(url, {
      signal: AbortSignal.timeout(PACIOOS_CONFIG.requestTimeoutMs),
    });

    if (!response.ok) {
      errors.push(`PacIOOS station fetch failed: HTTP ${response.status}`);
      return { stations, errors };
    }

    const { errors: parseErrors } = await streamParseCSV(response, (fields, headers) => {
      const locationId = getField(fields, headers, "location_id");
      const lat = parseFloat(getField(fields, headers, "latitude"));
      const lon = parseFloat(getField(fields, headers, "longitude"));

      // ERDDAP units row (line 2) will have non-numeric lat/lon -- naturally skipped
      if (!locationId || isNaN(lat) || isNaN(lon)) return;

      stations.push({
        station_id: `PACIOOS-${locationId}`,
        station_name: getField(fields, headers, "location_name") || locationId,
        organization_id: "PACIOOS",
        organization_name: "Hawaii DOH Clean Water Branch via PacIOOS",
        latitude: lat,
        longitude: lon,
        county: null,
        state_code: "HI",
        state_name: "Hawaii",
      });
    });

    if (parseErrors.length > 0) {
      errors.push(...parseErrors.map(e => `PacIOOS station parse: ${e}`));
    }

    // Deduplicate by station_id
    const seen = new Set<string>();
    const unique: ParsedStation[] = [];
    for (const s of stations) {
      if (!seen.has(s.station_id)) {
        seen.add(s.station_id);
        unique.push(s);
      }
    }

    console.log(`${LOG_PREFIX} PacIOOS: ${unique.length} unique stations`);
    return { stations: unique, errors };
  } catch (error) {
    errors.push(`PacIOOS station fetch error: ${error instanceof Error ? error.message : "unknown"}`);
  }

  return { stations, errors };
}

// ---------------------------------------------------------------------------
// Phase 1: Station sync
// ---------------------------------------------------------------------------

/**
 * Discover monitoring stations from CEDEN (CA) and PacIOOS (HI), then match
 * each station to the nearest beach within the configured radius.
 *
 * 1. Fetch all beaches with coordinates
 * 2. Fetch CEDEN + PacIOOS stations in parallel
 * 3. Match each station to nearest beach via haversine (within 5km)
 * 4. Upsert into wq_monitoring_stations
 */
export async function syncWQStations(
  supabase: SupabaseServiceClient
): Promise<StationSyncResult> {
  const startTime = Date.now();
  const result: StationSyncResult = {
    statesFetched: 0,
    stationsParsed: 0,
    stationsMatched: 0,
    stationsUpserted: 0,
    errors: [],
    duration_ms: 0,
  };

  try {
    // Fetch all beaches with coordinates for matching
    const { data: beaches, error: beachError } = await supabase
      .from("beaches")
      .select("id, name, lat, lon, state")
      .not("lat", "is", null)
      .not("lon", "is", null);

    if (beachError) {
      result.errors.push(`Failed to fetch beaches: ${beachError.message}`);
      result.duration_ms = Date.now() - startTime;
      return result;
    }

    if (!beaches || beaches.length === 0) {
      result.errors.push("No beaches found with coordinates");
      result.duration_ms = Date.now() - startTime;
      return result;
    }

    console.log(
      `${LOG_PREFIX} Loaded ${beaches.length} beaches for station matching`
    );

    // Fetch stations from both sources in parallel
    const [cedenResult, pacioosResult] = await Promise.allSettled([
      fetchCEDENStations(),
      fetchPacIOOSStations(),
    ]);

    const allParsedStations: ParsedStation[] = [];

    if (cedenResult.status === "fulfilled") {
      allParsedStations.push(...cedenResult.value.stations);
      result.errors.push(...cedenResult.value.errors);
      if (cedenResult.value.stations.length > 0) result.statesFetched++;
    } else {
      result.errors.push(`CEDEN fetch rejected: ${cedenResult.reason}`);
    }

    if (pacioosResult.status === "fulfilled") {
      allParsedStations.push(...pacioosResult.value.stations);
      result.errors.push(...pacioosResult.value.errors);
      if (pacioosResult.value.stations.length > 0) result.statesFetched++;
    } else {
      result.errors.push(`PacIOOS fetch rejected: ${pacioosResult.reason}`);
    }

    result.stationsParsed = allParsedStations.length;

    // Match stations to nearest beach (filter by state for faster matching)
    const allStations: StationUpsertRow[] = [];

    for (const station of allParsedStations) {
      // Use the correct match radius per source: PacIOOS for HI, CEDEN for CA
      const radiusM = station.state_code === "HI"
        ? PACIOOS_CONFIG.matchRadiusM
        : CEDEN_CONFIG.matchRadiusM;
      const radiusKm = radiusM / 1000;

      const stateBeaches = beaches.filter((b) => b.state === station.state_code);
      let nearestBeachId: string | null = null;
      let nearestDistanceM: number | null = null;

      for (const beach of stateBeaches) {
        if (beach.lat == null || beach.lon == null) continue;
        const distKm = haversineDistance(
          station.latitude,
          station.longitude,
          beach.lat,
          beach.lon
        );
        const distM = Math.round(distKm * 1000);

        if (
          distKm <= radiusKm &&
          (nearestDistanceM === null || distM < nearestDistanceM)
        ) {
          nearestBeachId = beach.id;
          nearestDistanceM = distM;
        }
      }

      if (nearestBeachId) result.stationsMatched++;

      allStations.push({
        station_id: station.station_id,
        name: station.station_name,
        org_id: station.organization_id,
        org_name: station.organization_name,
        lat: station.latitude,
        lon: station.longitude,
        county: station.county,
        state: station.state_code,
        nearest_beach_id: nearestBeachId,
        distance_to_beach_m: nearestDistanceM,
        synced_at: new Date().toISOString(),
      });
    }

    // Upsert all stations in batches
    if (allStations.length > 0) {
      console.log(
        `${LOG_PREFIX} Upserting ${allStations.length} stations (${result.stationsMatched} matched to beaches)...`
      );

      for (let i = 0; i < allStations.length; i += UPSERT_BATCH_SIZE) {
        const batch = allStations.slice(i, i + UPSERT_BATCH_SIZE);

        const { error: upsertError } = await supabase
          .from("wq_monitoring_stations")
          .upsert(batch, {
            onConflict: "station_id",
            ignoreDuplicates: false,
          });

        if (upsertError) {
          result.errors.push(
            `Station upsert batch ${Math.floor(i / UPSERT_BATCH_SIZE) + 1}: ${upsertError.message}`
          );
        } else {
          result.stationsUpserted += batch.length;
        }
      }

      console.log(
        `${LOG_PREFIX} Upserted ${result.stationsUpserted}/${allStations.length} stations`
      );
    }
  } catch (error) {
    result.errors.push(
      error instanceof Error
        ? `Station sync error: ${error.message}`
        : "Unknown station sync error"
    );
  }

  result.duration_ms = Date.now() - startTime;
  return result;
}

// ---------------------------------------------------------------------------
// Source-specific sample fetchers
// ---------------------------------------------------------------------------

/**
 * Fetch bacteria sample results from CEDEN for stations we track.
 */
async function fetchCEDENSamples(
  stationLookup: Map<string, { uuid: string; beachId: string | null }>,
  startDateISO: string,
  todayISO: string
): Promise<{
  samples: SampleUpsertRow[];
  count: number;
  futureSamplesRejected: number;
  errors: string[];
}> {
  const errors: string[] = [];
  const samples: SampleUpsertRow[] = [];
  let totalRecords = 0;
  let futureSamplesRejected = 0;

  try {
    // Format date as YYYY-MM-DD for CEDEN SQL query
    const startDate = startDateISO.split("T")[0];

    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
      throw new Error(`Invalid date format for CEDEN query: ${startDate}`);
    }

    // startDate is derived from a trusted Date object, never user input.
    const sql = `
      SELECT "StationCode", "SampleDate", "Analyte", "Result", "Unit"
      FROM "${CEDEN_CONFIG.resourceId}"
      WHERE "Analyte" IN (${CEDEN_CONFIG.characteristics.map(c => `'${c}'`).join(", ")})
        AND "MatrixName" = 'samplewater'
        AND "SampleDate" >= '${startDate}'
      ORDER BY "SampleDate" DESC
      LIMIT ${CEDEN_SAMPLE_QUERY_LIMIT}
    `;

    const url = new URL(`${CEDEN_CONFIG.baseUrl}/datastore_search_sql`);
    url.searchParams.set("sql", sql);

    const response = await fetch(url.toString(), {
      signal: AbortSignal.timeout(CEDEN_CONFIG.requestTimeoutMs),
    });

    if (!response.ok) {
      errors.push(`CEDEN sample fetch failed: HTTP ${response.status}`);
      return { samples, count: 0, futureSamplesRejected, errors };
    }

    const json = await response.json();
    const records = json?.result?.records ?? [];
    totalRecords = records.length;

    for (const rec of records) {
      const sampleDate = normalizeSampleDate(rec.SampleDate);
      if (!sampleDate) continue;

      if (sampleDate > todayISO) {
        futureSamplesRejected++;
        continue;
      }

      const stationKey = `CEDEN-${rec.StationCode}`;
      const match = stationLookup.get(stationKey);
      if (!match) continue;

      // Parse result value; null if non-numeric or missing
      let value: number | null = null;
      if (rec.Result != null && rec.Result !== "") {
        const parsed = parseFloat(rec.Result);
        if (!isNaN(parsed) && parsed >= 0) {
          value = parsed;
        }
      }

      // Normalize CEDEN analyte name to match our evaluation logic
      const characteristic = rec.Analyte === "Coliform, Fecal"
        ? "Fecal Coliform"
        : rec.Analyte;

      samples.push({
        station_id: match.uuid,
        sample_date: sampleDate,
        characteristic,
        value,
        unit: rec.Unit || "CFU/100mL",
        detection_condition: null,
      });
    }

    console.log(
      `${LOG_PREFIX} CEDEN: ${totalRecords} records -> ${samples.length} matched samples (${futureSamplesRejected} future rows rejected)`
    );
  } catch (error) {
    errors.push(`CEDEN sample fetch error: ${error instanceof Error ? error.message : "unknown"}`);
  }

  return { samples, count: totalRecords, futureSamplesRejected, errors };
}

/**
 * Fetch bacteria sample results from PacIOOS ERDDAP for stations we track.
 * ERDDAP CSV format: line 1 = column names, line 2 = units (skipped by isNaN guard), line 3+ = data.
 */
async function fetchPacIOOSSamples(
  stationLookup: Map<string, { uuid: string; beachId: string | null }>,
  startDateISO: string,
  todayISO: string
): Promise<{
  samples: SampleUpsertRow[];
  count: number;
  futureSamplesRejected: number;
  errors: string[];
}> {
  const errors: string[] = [];
  const samples: SampleUpsertRow[] = [];
  let rowCount = 0;
  let futureSamplesRejected = 0;

  try {
    const url = `${PACIOOS_CONFIG.baseUrl}.csv?time,location_id,location_name,enterococcus&time>=${startDateISO}&time<=${todayISO}T23:59:59Z`;

    const response = await fetch(url, {
      signal: AbortSignal.timeout(PACIOOS_CONFIG.requestTimeoutMs),
    });

    if (!response.ok) {
      // ERDDAP returns 404 when no matching data exists (e.g. stale dataset)
      if (response.status === 404) {
        console.log(`${LOG_PREFIX} PacIOOS: no sample data in requested time range (HTTP 404)`);
        return { samples, count: 0, futureSamplesRejected, errors };
      }
      errors.push(`PacIOOS sample fetch failed: HTTP ${response.status}`);
      return { samples, count: 0, futureSamplesRejected, errors };
    }

    const { rowCount: parsed, errors: parseErrors } = await streamParseCSV(response, (fields, headers) => {
      const locationId = getField(fields, headers, "location_id");
      const timeStr = getField(fields, headers, "time");
      const enteroStr = getField(fields, headers, "enterococcus");

      const stationKey = `PACIOOS-${locationId}`;
      const match = stationLookup.get(stationKey);
      if (!match) return;

      // ERDDAP returns ISO format like "2026-02-20T00:00:00Z"
      let sampleDate: string | null = null;
      if (typeof timeStr === "string" && timeStr) {
        const d = new Date(timeStr);
        if (!isNaN(d.getTime())) {
          sampleDate = utcDateString(d);
        }
      }
      if (!sampleDate) return;

      if (sampleDate > todayISO) {
        futureSamplesRejected++;
        return;
      }

      let value: number | null = null;
      if (enteroStr && enteroStr !== "" && enteroStr !== "NaN") {
        const parsedVal = parseFloat(enteroStr);
        if (!isNaN(parsedVal)) value = parsedVal;
      }

      samples.push({
        station_id: match.uuid,
        sample_date: sampleDate,
        characteristic: "Enterococcus",
        value,
        unit: "CFU/100mL",
        detection_condition: null,
      });
    });

    rowCount = parsed;
    if (parseErrors.length > 0) {
      errors.push(...parseErrors.map(e => `PacIOOS sample parse: ${e}`));
    }

    console.log(
      `${LOG_PREFIX} PacIOOS: ${rowCount} rows -> ${samples.length} matched samples (${futureSamplesRejected} future rows rejected)`
    );
  } catch (error) {
    errors.push(`PacIOOS sample fetch error: ${error instanceof Error ? error.message : "unknown"}`);
  }

  return { samples, count: rowCount, futureSamplesRejected, errors };
}

// ---------------------------------------------------------------------------
// Phase 2: Sample sync
// ---------------------------------------------------------------------------

/**
 * Fetch recent bacteria sample data from CEDEN (CA) and PacIOOS (HI)
 * for all monitored stations.
 *
 * Fetches the last 90 days of Enterococcus and Fecal Coliform results,
 * matching them to our station records by station_id prefix.
 */
export async function syncWQSamples(
  supabase: SupabaseServiceClient
): Promise<SampleSyncResult> {
  const startTime = Date.now();
  const result: SampleSyncResult = {
    statesFetched: 0,
    samplesParsed: 0,
    samplesMatched: 0,
    samplesUpserted: 0,
    futureSamplesRejected: 0,
    errors: [],
    duration_ms: 0,
  };

  try {
    // Load every station page; Supabase caps an unpaged response at 1,000 rows.
    const { stations, error: stationError } = await fetchAllMonitoringStations(
      supabase,
      "id, station_id, nearest_beach_id",
      false
    );

    if (stationError) {
      result.errors.push(`Failed to fetch stations: ${stationError}`);
      result.duration_ms = Date.now() - startTime;
      return result;
    }

    if (!stations || stations.length === 0) {
      result.errors.push(
        "No monitoring stations found -- run stations phase first"
      );
      result.duration_ms = Date.now() - startTime;
      return result;
    }

    // Build lookup map: source station_id -> our UUID
    const stationLookup = new Map<string, { uuid: string; beachId: string | null }>();
    for (const s of stations) {
      stationLookup.set(s.station_id, {
        uuid: s.id,
        beachId: s.nearest_beach_id,
      });
    }

    console.log(
      `${LOG_PREFIX} Loaded ${stations.length} stations for sample matching`
    );

    // 90-day lookback window to account for reporting lag
    const startDate = new Date();
    startDate.setUTCDate(startDate.getUTCDate() - 90);
    const startDateISO = startDate.toISOString();
    const todayISO = utcDateString();

    // Fetch from both sources in parallel
    const [cedenResult, pacioosResult] = await Promise.allSettled([
      fetchCEDENSamples(stationLookup, startDateISO, todayISO),
      fetchPacIOOSSamples(stationLookup, startDateISO, todayISO),
    ]);

    const allSamples: SampleUpsertRow[] = [];

    if (cedenResult.status === "fulfilled") {
      allSamples.push(...cedenResult.value.samples);
      result.samplesParsed += cedenResult.value.count;
      result.futureSamplesRejected += cedenResult.value.futureSamplesRejected;
      result.errors.push(...cedenResult.value.errors);
      if (cedenResult.value.samples.length > 0) result.statesFetched++;
    } else {
      result.errors.push(`CEDEN sample fetch rejected: ${cedenResult.reason}`);
    }

    if (pacioosResult.status === "fulfilled") {
      allSamples.push(...pacioosResult.value.samples);
      result.samplesParsed += pacioosResult.value.count;
      result.futureSamplesRejected += pacioosResult.value.futureSamplesRejected;
      result.errors.push(...pacioosResult.value.errors);
      if (pacioosResult.value.samples.length > 0) result.statesFetched++;
    } else {
      result.errors.push(`PacIOOS sample fetch rejected: ${pacioosResult.reason}`);
    }

    result.samplesMatched = allSamples.length;

    // Deduplicate: CEDEN can have multiple results per station+date+analyte.
    // Keep the highest value (worst case) for each unique key.
    const deduped = new Map<string, SampleUpsertRow>();
    for (const s of allSamples) {
      const key = `${s.station_id}|${s.sample_date}|${s.characteristic}`;
      const existing = deduped.get(key);
      if (!existing || (s.value !== null && (existing.value === null || s.value > existing.value))) {
        deduped.set(key, s);
      }
    }
    const dedupedSamples = Array.from(deduped.values());

    // Upsert all samples in batches
    if (dedupedSamples.length > 0) {
      console.log(
        `${LOG_PREFIX} Upserting ${dedupedSamples.length} samples (${allSamples.length - dedupedSamples.length} duplicates removed)...`
      );

      for (let i = 0; i < dedupedSamples.length; i += UPSERT_BATCH_SIZE) {
        const batch = dedupedSamples.slice(i, i + UPSERT_BATCH_SIZE);

        const { error: upsertError } = await supabase
          .from("wq_samples")
          .upsert(batch, {
            onConflict: "station_id,sample_date,characteristic",
            ignoreDuplicates: false,
          });

        if (upsertError) {
          result.errors.push(
            `Sample upsert batch ${Math.floor(i / UPSERT_BATCH_SIZE) + 1}: ${upsertError.message}`
          );
        } else {
          result.samplesUpserted += batch.length;
        }
      }

      console.log(
        `${LOG_PREFIX} Upserted ${result.samplesUpserted}/${dedupedSamples.length} samples`
      );
    }
  } catch (error) {
    result.errors.push(
      error instanceof Error
        ? `Sample sync error: ${error.message}`
        : "Unknown sample sync error"
    );
  }

  result.duration_ms = Date.now() - startTime;
  return result;
}

// ---------------------------------------------------------------------------
// Phase 3: Water quality evaluation
// ---------------------------------------------------------------------------

/**
 * Evaluate water quality status for each beach that has linked monitoring data.
 *
 * Applies EPA recreational water quality criteria:
 * - Statistical Threshold Value (STV): single-sample maximum
 * - Geometric mean: 30-day rolling average
 *
 * Status levels:
 * - closure: any sample > 2x STV, or geometric mean > threshold + 50%
 * - advisory: any sample > STV, or geometric mean > threshold
 * - good: all samples below thresholds
 * - unknown: no samples in the last 30 days
 */
export async function evaluateWaterQuality(
  supabase: SupabaseServiceClient
): Promise<EvaluationResult> {
  const startTime = Date.now();
  const result: EvaluationResult = {
    beachesEvaluated: 0,
    statusCounts: {
      [WQ_STATUS.GOOD]: 0,
      [WQ_STATUS.ADVISORY]: 0,
      [WQ_STATUS.CLOSURE]: 0,
      [WQ_STATUS.UNKNOWN]: 0,
    },
    statusChanges: 0,
    errors: [],
    duration_ms: 0,
  };

  try {
    // Get every station page that has a linked beach.
    const { stations: linkedStations, error: stationError } =
      await fetchAllMonitoringStations(
        supabase,
        "id, station_id, nearest_beach_id, lat, lon, name",
        true
      );

    if (stationError) {
      result.errors.push(
        `Failed to fetch linked stations: ${stationError}`
      );
      result.duration_ms = Date.now() - startTime;
      return result;
    }

    if (!linkedStations || linkedStations.length === 0) {
      result.errors.push(
        "No stations linked to beaches -- run stations phase first"
      );
      result.duration_ms = Date.now() - startTime;
      return result;
    }

    // Group stations by beach
    const beachStations = new Map<string, string[]>();
    for (const station of linkedStations) {
      const beachId = station.nearest_beach_id as string;
      const existing = beachStations.get(beachId) || [];
      existing.push(station.id);
      beachStations.set(beachId, existing);
    }

    console.log(
      `${LOG_PREFIX} Evaluating water quality for ${beachStations.size} beaches with ${linkedStations.length} linked stations`
    );

    // Future rows must not move the evaluation window beyond real time.
    const endDateISO = utcDateString();
    const cutoffISO = subtractUtcDays(endDateISO, 30);

    console.log(
      `${LOG_PREFIX} Evaluation window: ${cutoffISO} to ${endDateISO} (anchored to UTC today)`
    );

    // Fetch existing statuses to detect changes (batched to stay within .in() limit)
    const beachIds = Array.from(beachStations.keys());
    const previousStatus = new Map<string, WQStatus>();
    for (let i = 0; i < beachIds.length; i += IN_BATCH_SIZE) {
      const batch = beachIds.slice(i, i + IN_BATCH_SIZE);
      const { data: existingStatuses } = await supabase
        .from("beach_water_quality")
        .select("beach_id, status")
        .in("beach_id", batch);

      if (existingStatuses) {
        for (const row of existingStatuses) {
          previousStatus.set(row.beach_id, row.status as WQStatus);
        }
      }
    }

    const evaluations: WaterQualityUpsertRow[] = [];

    // Fetch ALL samples for all linked stations, batching to stay within
    // Supabase .in() limit of ~1000 values per query.
    const allStationUuids = linkedStations.map((s) => s.id);
    const allSamples: Array<{
      station_id: string;
      characteristic: string;
      value: number | null;
      detection_condition: string | null;
      sample_date: string;
    }> = [];

    for (let i = 0; i < allStationUuids.length; i += IN_BATCH_SIZE) {
      const batch = allStationUuids.slice(i, i + IN_BATCH_SIZE);
      const { data: batchSamples, error: batchError } = await supabase
        .from("wq_samples")
        .select("station_id, characteristic, value, detection_condition, sample_date")
        .in("station_id", batch)
        .gte("sample_date", cutoffISO)
        .lte("sample_date", endDateISO)
        .order("sample_date", { ascending: false });

      if (batchError) {
        result.errors.push(`Failed to fetch evaluation samples (batch ${Math.floor(i / IN_BATCH_SIZE) + 1}): ${batchError.message}`);
        result.duration_ms = Date.now() - startTime;
        return result;
      }

      if (batchSamples) {
        allSamples.push(...batchSamples);
      }
    }

    // Build station_id -> beach_id lookup from linkedStations
    const stationToBeach = new Map<string, string>();
    for (const station of linkedStations) {
      stationToBeach.set(station.id, station.nearest_beach_id as string);
    }

    // Group samples by beach_id AND by station UUID (for proxy fallback)
    const samplesByBeach = new Map<string, SampleRow[]>();
    const samplesByStation = new Map<string, SampleRow[]>();
    for (const sample of allSamples) {
      const row: SampleRow = {
        characteristic: sample.characteristic,
        value: sample.value,
        detection_condition: sample.detection_condition,
        sample_date: sample.sample_date,
      };

      const beachId = stationToBeach.get(sample.station_id);
      if (beachId) {
        const existing = samplesByBeach.get(beachId) ?? [];
        existing.push(row);
        samplesByBeach.set(beachId, existing);
      }

      const stationSamples = samplesByStation.get(sample.station_id) ?? [];
      stationSamples.push(row);
      samplesByStation.set(sample.station_id, stationSamples);
    }

    // Evaluate each beach using the pre-fetched grouped samples
    for (const [beachId] of beachStations) {
      try {
        const samples = samplesByBeach.get(beachId) ?? [];

        result.beachesEvaluated++;

        const evaluation = buildEvaluation(beachId, samples, previousStatus);
        evaluations.push(evaluation);
        result.statusCounts[evaluation.status]++;

        if (previousStatus.get(beachId) !== evaluation.status) {
          result.statusChanges++;
        }
      } catch (error) {
        result.errors.push(
          `Beach ${beachId} evaluation error: ${error instanceof Error ? error.message : "unknown"}`
        );
      }
    }

    // ------------------------------------------------------------------
    // Second pass: resolve UNKNOWN beaches via nearest proxy station
    // ------------------------------------------------------------------
    const evalIndex = new Map<string, number>();
    const unknownBeachIds: string[] = [];
    for (let i = 0; i < evaluations.length; i++) {
      evalIndex.set(evaluations[i].beach_id, i);
      if (evaluations[i].status === WQ_STATUS.UNKNOWN) {
        unknownBeachIds.push(evaluations[i].beach_id);
      }
    }

    if (unknownBeachIds.length > 0) {
      const { data: unknownBeaches, error: unknownBeachError } = await supabase
        .from("beaches")
        .select("id, lat, lon")
        .in("id", unknownBeachIds);

      if (unknownBeachError) {
        result.errors.push(
          `Failed to fetch UNKNOWN beach coordinates: ${unknownBeachError.message}`
        );
      } else if (unknownBeaches && unknownBeaches.length > 0) {
        const stationsWithSamples = linkedStations.filter(
          (s) => (samplesByStation.get(s.id)?.length ?? 0) > 0
        );

        let proxyCount = 0;

        for (const beach of unknownBeaches) {
          if (beach.lat == null || beach.lon == null) continue;

          let nearestStationId: string | null = null;
          let nearestStationName: string | null = null;
          let nearestDistKm = Infinity;

          for (const station of stationsWithSamples) {
            if (station.lat == null || station.lon == null) continue;
            const distKm = haversineDistance(
              beach.lat,
              beach.lon,
              station.lat,
              station.lon
            );
            if (distKm <= PROXY_STATION_RADIUS_KM && distKm < nearestDistKm) {
              nearestDistKm = distKm;
              nearestStationId = station.id;
              nearestStationName = station.name ?? station.station_id;
            }
          }

          if (nearestStationId) {
            const proxySamples = samplesByStation.get(nearestStationId) ?? [];
            const proxyEval = buildEvaluation(
              beach.id,
              proxySamples,
              previousStatus,
              nearestStationId
            );

            const distM = Math.round(nearestDistKm * 1000);
            const proxyNote = `Based on nearby station ${nearestStationName} (${distM}m away)`;
            proxyEval.status_reason = proxyEval.status_reason
              ? `${proxyNote}. ${proxyEval.status_reason}`
              : proxyNote;

            const idx = evalIndex.get(beach.id);
            if (idx !== undefined) {
              result.statusCounts[WQ_STATUS.UNKNOWN]--;
              result.statusCounts[proxyEval.status]++;

              const prevSt = previousStatus.get(beach.id);
              const oldWasChange = prevSt !== undefined && prevSt !== WQ_STATUS.UNKNOWN;
              const newIsChange = prevSt !== undefined && prevSt !== proxyEval.status;
              if (oldWasChange && !newIsChange) result.statusChanges--;
              if (!oldWasChange && newIsChange) result.statusChanges++;

              evaluations[idx] = proxyEval;
              proxyCount++;
            }
          }
        }

        if (proxyCount > 0) {
          console.log(
            `${LOG_PREFIX} Proxy station fallback: resolved ${proxyCount} of ${unknownBeachIds.length} UNKNOWN beaches`
          );
        }
      }
    }

    // Upsert evaluations
    if (evaluations.length > 0) {
      console.log(
        `${LOG_PREFIX} Upserting ${evaluations.length} beach water quality evaluations...`
      );

      for (let i = 0; i < evaluations.length; i += UPSERT_BATCH_SIZE) {
        const batch = evaluations.slice(i, i + UPSERT_BATCH_SIZE);

        const { error: upsertError } = await supabase
          .from("beach_water_quality")
          .upsert(batch, {
            onConflict: "beach_id",
            ignoreDuplicates: false,
          });

        if (upsertError) {
          result.errors.push(
            `Evaluation upsert batch ${Math.floor(i / UPSERT_BATCH_SIZE) + 1}: ${upsertError.message}`
          );
        }
      }
    }

    console.log(
      `${LOG_PREFIX} Evaluation complete: ${JSON.stringify(result.statusCounts)}, ${result.statusChanges} status changes`
    );
  } catch (error) {
    result.errors.push(
      error instanceof Error
        ? `Evaluation error: ${error.message}`
        : "Unknown evaluation error"
    );
  }

  result.duration_ms = Date.now() - startTime;
  return result;
}

// ---------------------------------------------------------------------------
// Evaluation helpers
// ---------------------------------------------------------------------------

interface SampleRow {
  characteristic: string;
  value: number | null;
  detection_condition: string | null;
  sample_date: string;
}

/**
 * Build a water quality evaluation for a single beach from its sample data.
 */
function buildEvaluation(
  beachId: string,
  samples: SampleRow[],
  previousStatus: Map<string, WQStatus>,
  monitoringStationId?: string | null
): WaterQualityUpsertRow {
  const now = new Date().toISOString();

  const prevStatus = previousStatus.get(beachId) ?? null;

  if (samples.length === 0) {
    return {
      beach_id: beachId,
      status: WQ_STATUS.UNKNOWN,
      previous_status: prevStatus,
      latest_enterococcus: null,
      latest_fecal_coliform: null,
      latest_sample_date: null,
      total_samples_30d: 0,
      exceedance_count_30d: 0,
      monitoring_station_id: monitoringStationId ?? null,
      status_reason: null,
      status_changed_at: prevStatus && prevStatus !== WQ_STATUS.UNKNOWN ? now : null,
      updated_at: now,
    };
  }

  // Separate by characteristic (only count samples with numeric values)
  const enteroSamples = samples.filter(
    (s) =>
      s.characteristic === "Enterococcus" &&
      s.value !== null &&
      s.value > 0
  );
  const fecalSamples = samples.filter(
    (s) =>
      s.characteristic === "Fecal Coliform" &&
      s.value !== null &&
      s.value > 0
  );

  // Latest values (samples are ordered by date desc)
  const latestEntero = enteroSamples.length > 0 ? enteroSamples[0].value : null;
  const latestFecal = fecalSamples.length > 0 ? fecalSamples[0].value : null;

  // Geometric means
  const enteroGeoMean = computeGeometricMean(
    enteroSamples.map((s) => s.value as number)
  );
  const fecalGeoMean = computeGeometricMean(
    fecalSamples.map((s) => s.value as number)
  );

  // Count exceedances (STV violations)
  let exceedanceCount = 0;
  for (const s of enteroSamples) {
    if ((s.value as number) > EPA_BEACH_CRITERIA.enterococcus.stv) {
      exceedanceCount++;
    }
  }
  for (const s of fecalSamples) {
    if ((s.value as number) > EPA_BEACH_CRITERIA.fecalColiform.stv) {
      exceedanceCount++;
    }
  }

  // Determine status using EPA criteria
  const status = determineStatus(
    latestEntero,
    latestFecal,
    enteroGeoMean,
    fecalGeoMean,
    enteroSamples,
    fecalSamples
  );

  // Find the most recent sample date
  const latestSampleDate = samples[0]?.sample_date || null;

  // Build status reason
  const reasons: string[] = [];
  if (latestEntero !== null && latestEntero > EPA_BEACH_CRITERIA.enterococcus.stv) {
    reasons.push(`Enterococcus ${Math.round(latestEntero)} CFU/100mL exceeds STV of ${EPA_BEACH_CRITERIA.enterococcus.stv}`);
  }
  if (latestFecal !== null && latestFecal > EPA_BEACH_CRITERIA.fecalColiform.stv) {
    reasons.push(`Fecal Coliform ${Math.round(latestFecal)} CFU/100mL exceeds STV of ${EPA_BEACH_CRITERIA.fecalColiform.stv}`);
  }
  if (enteroGeoMean !== null && enteroGeoMean > EPA_BEACH_CRITERIA.enterococcus.geometricMean) {
    reasons.push(`Enterococcus 30-day geometric mean ${Math.round(enteroGeoMean)} exceeds ${EPA_BEACH_CRITERIA.enterococcus.geometricMean}`);
  }
  if (fecalGeoMean !== null && fecalGeoMean > EPA_BEACH_CRITERIA.fecalColiform.geometricMean) {
    reasons.push(`Fecal Coliform 30-day geometric mean ${Math.round(fecalGeoMean)} exceeds ${EPA_BEACH_CRITERIA.fecalColiform.geometricMean}`);
  }

  const statusChanged = prevStatus !== null && prevStatus !== status;

  return {
    beach_id: beachId,
    status,
    previous_status: prevStatus,
    latest_enterococcus: latestEntero,
    latest_fecal_coliform: latestFecal,
    latest_sample_date: latestSampleDate,
    total_samples_30d: samples.length,
    exceedance_count_30d: exceedanceCount,
    monitoring_station_id: monitoringStationId ?? null,
    status_reason: reasons.length > 0 ? reasons.join('; ') : null,
    status_changed_at: statusChanged ? now : null,
    updated_at: now,
  };
}

/**
 * Compute the geometric mean of an array of positive numbers.
 * Returns null for empty arrays or when no positive values are present.
 *
 * Uses log-transform to avoid floating-point overflow:
 *   GM = exp(mean(ln(values)))
 *
 * Zero and negative values are filtered out defensively: log(0) is -Infinity
 * and would produce a meaningless result.
 */
function computeGeometricMean(values: number[]): number | null {
  const positive = values.filter(v => v > 0);
  if (positive.length === 0) return null;

  const sumLn = positive.reduce((acc, v) => acc + Math.log(v), 0);
  const mean = Math.exp(sumLn / positive.length);

  return Math.round(mean * 100) / 100; // Round to 2 decimal places
}

/**
 * Determine beach water quality status based on EPA criteria.
 *
 * Priority: closure > advisory > good
 *
 * Closure triggers:
 *   - Any single sample > 2x STV
 *   - Geometric mean > threshold + 50%
 *
 * Advisory triggers:
 *   - Any single sample > STV
 *   - Geometric mean > threshold
 */
function determineStatus(
  latestEntero: number | null,
  latestFecal: number | null,
  enteroGeoMean: number | null,
  fecalGeoMean: number | null,
  enteroSamples: SampleRow[],
  fecalSamples: SampleRow[]
): WQStatus {
  // Check for closure-level violations first
  // Any single sample exceeding 2x STV
  for (const s of enteroSamples) {
    if ((s.value as number) > EPA_BEACH_CRITERIA.enterococcus.stv * 2) {
      return WQ_STATUS.CLOSURE;
    }
  }
  for (const s of fecalSamples) {
    if ((s.value as number) > EPA_BEACH_CRITERIA.fecalColiform.stv * 2) {
      return WQ_STATUS.CLOSURE;
    }
  }

  // Geometric mean exceeding threshold + 50%
  if (
    enteroGeoMean !== null &&
    enteroGeoMean > EPA_BEACH_CRITERIA.enterococcus.geometricMean * 1.5
  ) {
    return WQ_STATUS.CLOSURE;
  }
  if (
    fecalGeoMean !== null &&
    fecalGeoMean > EPA_BEACH_CRITERIA.fecalColiform.geometricMean * 1.5
  ) {
    return WQ_STATUS.CLOSURE;
  }

  // Check for advisory-level violations
  // Any single sample exceeding STV
  for (const s of enteroSamples) {
    if ((s.value as number) > EPA_BEACH_CRITERIA.enterococcus.stv) {
      return WQ_STATUS.ADVISORY;
    }
  }
  for (const s of fecalSamples) {
    if ((s.value as number) > EPA_BEACH_CRITERIA.fecalColiform.stv) {
      return WQ_STATUS.ADVISORY;
    }
  }

  // Geometric mean exceeding threshold
  if (
    enteroGeoMean !== null &&
    enteroGeoMean > EPA_BEACH_CRITERIA.enterococcus.geometricMean
  ) {
    return WQ_STATUS.ADVISORY;
  }
  if (
    fecalGeoMean !== null &&
    fecalGeoMean > EPA_BEACH_CRITERIA.fecalColiform.geometricMean
  ) {
    return WQ_STATUS.ADVISORY;
  }

  return WQ_STATUS.GOOD;
}
