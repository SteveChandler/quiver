import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { RegionBeach } from "@/lib/alerts/swell-events/regional";
import { currentWaterQuality, unsampledWaterQualityRow } from "@/lib/services/water-quality/current-status";
import { withRainfallNotice } from "@/lib/services/water-quality/rainfall-runoff-read";
import { glanceWhen, MAX_GLANCE_SENTENCES } from "./week-scout-glance";
import type { StoryGlance } from "./week-scout-glance-wording";

type Client = SupabaseClient<Database>;
type Beach = Pick<RegionBeach, "id" | "name" | "lat" | "lon">;

/** What the beach cards show for each region beach, reduced to what the glance sentence says. */
export interface RegionWaterNotice {
  rain: { county: boolean; endsAt: string | null } | null;
  closedBeaches: string[];
}

const RUNOFF = "runoff raises bacteria near storm drains, creeks and river mouths";
const CACHE_TTL_MS = 5 * 60_000;
const READ_CHUNK = 100;
const cache = new Map<string, { notice: Promise<RegionWaterNotice>; expiresAt: number }>();

/** The cards' projection: sampled rows, then County status, then the rain notice where the County is silent. */
async function readRegionWaterNotice(client: Client, beaches: readonly Beach[], now: Date): Promise<RegionWaterNotice> {
  const chunks: string[][] = [];
  for (let offset = 0; offset < beaches.length; offset += READ_CHUNK) {
    chunks.push(beaches.slice(offset, offset + READ_CHUNK).map((beach) => beach.id));
  }
  const sampled = (await Promise.all(chunks.map(async (ids) => {
    const { data, error } = await client.from("beach_water_quality").select("beach_id, status, latest_sample_date").in("beach_id", ids);
    if (error) throw error;
    return data ?? [];
  }))).flat();
  const sampledIds = new Set(sampled.map((row) => row.beach_id));
  const rows = [...sampled, ...beaches.filter((beach) => !sampledIds.has(beach.id)).map((beach) => unsampledWaterQualityRow(beach.id))];
  const projected = await withRainfallNotice(
    await currentWaterQuality(rows, client as never, now), beaches, client as never, now);
  const names = new Map(beaches.map((beach) => [beach.id, beach.name]));
  let raining = false;
  // "County" only when the County speaks for every rain beach: Orange County's south edge is in its feed, the rest is not.
  let county = true;
  let endsAt: string | null = null;
  const closedBeaches: string[] = [];
  for (const row of projected) {
    // Only a County closure: a sampled closure can be weeks old, and the approved copy names County closures.
    if (row.county_advisory_status === "closure") {
      const name = names.get(row.beach_id);
      if (name) closedBeaches.push(name);
      continue;
    }
    const general = row.county_advisory_kind === "general";
    if (!general && !row.rain_runoff) continue;
    const end = general ? row.county_rain_advisory?.expires_at : row.rain_runoff?.expires_at;
    // An event past its end that the cron has not closed yet is over: it must not read as "72 hours after the rain".
    if (end && !(Date.parse(end) > now.getTime())) continue;
    raining = true;
    county &&= general;
    if (end && (endsAt === null || Date.parse(end) > Date.parse(endsAt))) endsAt = end;
  }
  const rain = raining ? { county, endsAt } : null;
  return { rain, closedBeaches: [...new Set(closedBeaches)].sort() };
}

/** Cached per region for a few minutes; a failed read is retried on the next request. */
export function loadRegionWaterNotice(client: Client, region: string, beaches: readonly Beach[], now: Date): Promise<RegionWaterNotice> {
  const cached = cache.get(region);
  if (cached && cached.expiresAt > now.getTime()) return cached.notice;
  const entry = { notice: readRegionWaterNotice(client, beaches, now), expiresAt: now.getTime() + CACHE_TTL_MS };
  entry.notice = entry.notice.then((notice) => {
    // Never serve an advisory past its own end from the cache.
    const endsAt = notice.rain?.endsAt ? Date.parse(notice.rain.endsAt) : NaN;
    if (endsAt < entry.expiresAt) entry.expiresAt = endsAt;
    return notice;
  }, (error: unknown) => {
    if (cache.get(region) === entry) cache.delete(region);
    throw error;
  });
  if (cache.size >= 64) cache.delete(cache.keys().next().value!);
  cache.set(region, entry);
  return entry.notice;
}

/** Test seam: the cache outlives a test's clock. */
export function clearRegionWaterNoticeCache(): void {
  cache.clear();
}

/** "early Tuesday" for the small hours, else the glance's own day and part of the day. */
function untilWhen(at: string, today: string, timezone: string): string {
  const when = glanceWhen(at, today, timezone);
  const early = /^early (.+) morning$/.exec(when);
  return early && early[1] !== "this" ? `early ${early[1]}` : when;
}

function closedPhrase(names: readonly string[]): string | null {
  if (names.length === 0) return null;
  if (names.length === 1) return `${names[0]} is closed`;
  if (names.length === 2) return `${names[0]} and ${names[1]} are closed`;
  return `${names.length} beaches are closed`;
}

/** The one water sentence, or null when nothing is active. It never says the water is clean. */
export function waterSentence(notice: RegionWaterNotice, today: string, timezone: string): string | null {
  const closed = closedPhrase(notice.closedBeaches);
  if (!notice.rain) return closed ? `${closed} for water quality.` : null;
  const label = notice.rain.county ? "County rain advisory" : "Rain advisory";
  const until = notice.rain.endsAt
    ? `until ${untilWhen(notice.rain.endsAt, today, timezone)} if it stays dry`
    : "until 72 hours after the rain stops";
  return `${label} ${until}: ${RUNOFF}${closed ? `, and ${closed}` : ""}.`;
}

/** Last in the paragraph; at the cap it takes the place of the last sentence (the long-range one). */
export function withWaterSentence(glance: StoryGlance | null, sentence: string | null): StoryGlance | null {
  if (!sentence) return glance;
  const sentences = [...(glance?.sentences ?? [])];
  const source = [...(glance?.source ?? [])];
  if (sentences.length >= MAX_GLANCE_SENTENCES) {
    sentences.length = MAX_GLANCE_SENTENCES - 1;
    source.length = MAX_GLANCE_SENTENCES - 1;
  }
  return { sentences: [...sentences, sentence], source: [...source, "code"] };
}
