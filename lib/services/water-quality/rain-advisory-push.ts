import "server-only";

import { isRainAdvisoryPushEnabled } from "@/lib/flags/rain-advisory-push";
import { enqueueNotification } from "@/lib/notifications/enqueue";
import { COUNTY_FEED_COVERAGE_BOUNDS } from "@/lib/services/county-beach-advisories/types";
import type { WaterQualityHoldClient } from "@/lib/recommendations/major-event-hold/water-quality";
import type { SupabaseServiceClient } from "@/types/supabase";
import { insideCountyFeed } from "./county-coverage";
import { currentWaterQuality, unsampledWaterQualityRow } from "./current-status";
import { RAIN_ADVISORY_EVENTS_TABLE, rainAdvisoryEventSchema, type RainAdvisoryEvent } from "./rain-advisory-events";
import { RAIN_CLUSTERS, rainClusterFor } from "./rainfall-runoff";

const DAY_MS = 24 * 60 * 60 * 1000;
const BACKFILL_MS = 2 * 60 * 60 * 1000;
const CHUNK_SIZE = 100;

interface ReadResult { data: unknown; error: { code?: string; message?: string } | null }
interface ReadQuery extends PromiseLike<ReadResult> {
  select(columns: string): ReadQuery;
  eq(column: string, value: string): ReadQuery;
  gte(column: string, value: string | number): ReadQuery;
  lte(column: string, value: number): ReadQuery;
  in(column: string, values: readonly string[]): ReadQuery;
}
interface ReadClient { from(table: string): ReadQuery }

interface Beach { id: string; slug: string | null; name: string | null; lat: number; lon: number }
interface Profile { id: string; home_beach_id: string | null; notif_water_quality: boolean; is_mock: boolean }
interface QualityRow { beach_id: string; status: string }
interface Count { candidates: number; enqueued: number; duplicates: number; skipped: number }
export type RainAdvisoryPushResult =
  | { status: "disabled" }
  | { status: "table_missing" }
  | { status: "ok"; started: Count; ended: Count; errors: string[] };

function chunks<T>(values: readonly T[]): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < values.length; i += CHUNK_SIZE) result.push(values.slice(i, i + CHUNK_SIZE));
  return result;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message
    : typeof error === "object" && error !== null && "message" in error ? String(error.message)
      : String(error);
}

async function rows(query: ReadQuery): Promise<unknown[]> {
  const { data, error } = await query;
  if (error) throw error;
  if (!Array.isArray(data)) throw new Error("Invalid database response");
  return data;
}

async function eventRows(client: ReadClient, status: "active" | "ended", cutoff: string): Promise<RainAdvisoryEvent[]> {
  const timestamp = status === "active" ? "started_at" : "ended_at";
  return (await rows(client.from(RAIN_ADVISORY_EVENTS_TABLE).select("*").eq("status", status).gte(timestamp, cutoff)))
    .map((raw) => rainAdvisoryEventSchema.parse(raw));
}

async function regionBeaches(client: ReadClient, event: RainAdvisoryEvent): Promise<Beach[]> {
  const bounds = event.region === "san_diego" ? COUNTY_FEED_COVERAGE_BOUNDS : null;
  const cluster = bounds ? null : RAIN_CLUSTERS.find((item) => item.id === event.region);
  if (!bounds && !cluster) return [];
  const minLat = bounds?.minLat ?? cluster!.lat - 0.5;
  const maxLat = bounds?.maxLat ?? cluster!.lat + 0.5;
  const minLon = bounds?.minLon ?? cluster!.lon - 0.5;
  const maxLon = bounds?.maxLon ?? cluster!.lon + 0.5;
  const beachRows = await rows(client.from("beaches").select("id, slug, name, lat, lon")
    .gte("lat", minLat).lte("lat", maxLat).gte("lon", minLon).lte("lon", maxLon));
  return beachRows.filter((raw): raw is Beach => {
    if (!raw || typeof raw !== "object") return false;
    const beach = raw as Partial<Beach>;
    if (typeof beach.id !== "string" || typeof beach.lat !== "number" || typeof beach.lon !== "number") return false;
    return bounds ? insideCountyFeed({ lat: beach.lat, lon: beach.lon })
      : rainClusterFor(beach.lat, beach.lon)?.id === event.region;
  });
}

async function recipients(client: ReadClient, beaches: readonly Beach[]): Promise<Profile[]> {
  const profiles: Profile[] = [];
  for (const ids of chunks(beaches.map((beach) => beach.id))) {
    const found = await rows(client.from("profiles")
      .select("id, home_beach_id, notif_water_quality, is_mock").in("home_beach_id", ids));
    profiles.push(...found.filter((raw): raw is Profile => {
      if (!raw || typeof raw !== "object") return false;
      const profile = raw as Partial<Profile>;
      return typeof profile.id === "string" && typeof profile.home_beach_id === "string"
        && profile.notif_water_quality === true && profile.is_mock === false;
    }));
  }
  return profiles;
}

/** Users already enqueued for this event phase (the dedupe key exists). */
async function enqueuedRecipients(
  client: ReadClient, eventId: string, phase: "start" | "end", profiles: readonly Profile[],
): Promise<Set<string>> {
  const users = new Set<string>();
  for (const group of chunks(profiles)) {
    const keys = group.map((profile) => `rain_advisory:${eventId}:${phase}:${profile.id}`);
    // Lead with recipient_user_id so the (recipient_user_id, type, dedupe_key) index serves the lookup.
    const found = await rows(client.from("notification_events").select("recipient_user_id, dedupe_key")
      .in("recipient_user_id", group.map((profile) => profile.id))
      .eq("type", "water_quality").in("dedupe_key", keys));
    const expected = new Set(keys);
    for (const raw of found) {
      if (!raw || typeof raw !== "object") continue;
      const row = raw as { recipient_user_id?: unknown; dedupe_key?: unknown };
      if (typeof row.recipient_user_id === "string" && typeof row.dedupe_key === "string"
        && expected.has(row.dedupe_key)
        && row.dedupe_key === `rain_advisory:${eventId}:${phase}:${row.recipient_user_id}`) {
        users.add(row.recipient_user_id);
      }
    }
  }
  return users;
}

async function safeEndBeachIds(
  client: ReadClient, supabase: SupabaseServiceClient, event: RainAdvisoryEvent,
  beaches: readonly Beach[], now: Date,
): Promise<Set<string>> {
  const ids = beaches.map((beach) => beach.id);
  const qualityRows: QualityRow[] = [];
  const held = new Set<string>();
  for (const group of chunks(ids)) {
    qualityRows.push(...(await rows(client.from("beach_water_quality").select("beach_id, status, total_samples_30d")
      .in("beach_id", group))) as QualityRow[]);
    for (const raw of await rows(client.from("water_quality_held_beaches").select("beach_id").in("beach_id", group))) {
      if (raw && typeof raw === "object" && "beach_id" in raw && typeof raw.beach_id === "string") held.add(raw.beach_id);
    }
  }
  const byId = new Map(qualityRows.map((row) => [row.beach_id, row]));
  const projected = await currentWaterQuality(ids.map((id) => byId.get(id) ?? unsampledWaterQualityRow(id)),
    supabase as unknown as WaterQualityHoldClient, now);
  // Owner-held rows come back untouched, and an expired general advisory marks
  // rows county_general_expired; any other row without County status means the
  // County projection did not apply, so no San Diego beach can be called clear.
  if (event.region === "san_diego" && projected.some((row) => !held.has(row.beach_id)
    && !row.county_advisory_status && !row.county_general_expired)) {
    throw new Error("County water-quality status unavailable");
  }
  const safe = new Set<string>();
  for (const row of projected) {
    if (held.has(row.beach_id) || row.status === "advisory" || row.status === "closure"
      || row.county_advisory_status === "advisory" || row.county_advisory_status === "closure"
      || row.county_advisory_status === "unavailable") continue;
    safe.add(row.beach_id);
  }
  return safe;
}

function backfilled(event: RainAdvisoryEvent): boolean {
  return Date.parse(event.created_at) - Date.parse(event.started_at) > BACKFILL_MS;
}

export async function processRainAdvisoryPushes(
  supabase: SupabaseServiceClient,
  now: Date = new Date(),
): Promise<RainAdvisoryPushResult> {
  if (!isRainAdvisoryPushEnabled()) return { status: "disabled" };
  const result: Extract<RainAdvisoryPushResult, { status: "ok" }> = {
    status: "ok",
    started: { candidates: 0, enqueued: 0, duplicates: 0, skipped: 0 },
    ended: { candidates: 0, enqueued: 0, duplicates: 0, skipped: 0 },
    errors: [],
  };
  const client = supabase as unknown as ReadClient;
  try {
    const cutoff = new Date(now.getTime() - DAY_MS).toISOString();
    const starts = await eventRows(client, "active", cutoff);
    const ends = await eventRows(client, "ended", cutoff);
    for (const [phase, events, count] of [["start", starts, result.started], ["end", ends, result.ended]] as const) {
      for (const event of events) {
        count.candidates++;
        if (backfilled(event)) { count.skipped++; continue; }
        try {
          const beaches = await regionBeaches(client, event);
          if (beaches.length === 0) continue;
          // The crons tick every 30 min for 24 h; skip users this phase already reached
          // instead of re-inserting into the dedupe index each tick.
          const eligible = await recipients(client, beaches);
          const done = await enqueuedRecipients(client, event.id, phase, eligible);
          const profiles = eligible.filter((profile) => !done.has(profile.id));
          if (profiles.length === 0) continue;
          const beachById = new Map(beaches.map((beach) => [beach.id, beach]));
          const startRecipients = phase === "end" ? await enqueuedRecipients(client, event.id, "start", profiles) : null;
          const safeBeaches = phase === "end" && startRecipients!.size > 0
            ? await safeEndBeachIds(client, supabase, event, beaches, now) : null;
          for (const profile of profiles) {
            const beach = beachById.get(profile.home_beach_id!);
            // The payload schema requires a slug for the deep link.
            if (!beach || !beach.slug || (startRecipients && !startRecipients.has(profile.id))
              || (safeBeaches && !safeBeaches.has(beach.id))) { count.skipped++; continue; }
            const response = await enqueueNotification({
              type: "water_quality", recipientUserId: profile.id, entityType: "beach", entityId: beach.id,
              payload: {
                beach_id: beach.id, beach_name: beach.name || "Your home beach", beach_slug: beach.slug,
                status: phase === "start" ? "advisory" : "good",
                previous_status: phase === "start" ? null : "advisory",
                status_changed_at: phase === "start" ? event.started_at : event.ended_at!,
                rain_advisory: {
                  event_id: event.id, phase, source: event.source, region: event.region,
                  started_at: event.started_at, last_rain_at: event.last_rain_at,
                  expires_at: event.expires_at,
                  ...(phase === "end" ? { end_reason: event.end_reason } : {}),
                },
              },
              dedupeKey: `rain_advisory:${event.id}:${phase}:${profile.id}`,
            }, supabase);
            if (response.enqueued) count.enqueued++;
            else if (response.reason === "duplicate") count.duplicates++;
            else result.errors.push(`${event.id}:${phase}:${profile.id}: ${response.reason}`);
          }
        } catch (error) {
          result.errors.push(`${event.id}:${phase}: ${errorMessage(error)}`);
        }
      }
    }
  } catch (error) {
    if (error && typeof error === "object" && "code" in error
      && (error.code === "42P01" || error.code === "PGRST205")) return { status: "table_missing" };
    result.errors.push(errorMessage(error));
  }
  return result;
}
