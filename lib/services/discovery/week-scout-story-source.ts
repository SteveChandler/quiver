import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { parseSwellDirectionToDegrees, parseWaveHeightMidpointFt } from "@/lib/alerts/forecast-parsers";
import { exposureFactor, exposureLabel, swellWindowForBeach } from "@/lib/alerts/swell-events";
import { angleDifference } from "@/lib/domains/shared/angle-utils";
import { briefingInputHash, canonicalJson, sha256Hex } from "./swell-briefing-hash";
import { addDays, localDate, zonedWallClockToUtc } from "./swell-briefing-input";
import { buildStoryCandidates, type RegionalDaySignal } from "./week-scout-story-candidates";
import { loadLatestStoryInput, saveStoryInput, activeStoryRegions } from "./week-scout-story-store";
import type { StoryInput } from "./week-scout-story-types";

type Client = SupabaseClient<Database>;
type Row = { id: string; beach_id: string; forecast_at: string; wave_height: string | null; swell_direction_om: number | null; swell_period_om: number | null; wind_direction: string | null; tide_status: string | null; om_fetched_at: string | null; updated_at: string | null };
type BeachRow = { id: string; name: string; lat: number; lon: number; aspect_deg: number | null; swell_window_center_deg: number | null; swell_window_halfwidth_deg: number | null; wind_offshore_deg: number | null };
const SAMPLE_VERSION = "representative-latitude-spread-2";
const SOURCE_MAX_AGE_MS = 36 * 60 * 60 * 1000;
const PAGE_SIZE = 500;

export class StoryInputError extends Error {
  constructor(code: string, readonly status = 503) { super(code); this.name = "StoryInputError"; }
}

function validTimezone(value: string): boolean {
  try { new Intl.DateTimeFormat("en-US", { timeZone: value }); return true; } catch { return false; }
}

function meanDirection(values: number[]): number | null {
  if (!values.length) return null;
  const x = values.reduce((sum, deg) => sum + Math.cos(deg * Math.PI / 180), 0);
  const y = values.reduce((sum, deg) => sum + Math.sin(deg * Math.PI / 180), 0);
  if (Math.hypot(x, y) < values.length * 0.25) return null;
  return ((Math.atan2(y, x) * 180 / Math.PI) + 360) % 360;
}

export async function buildStoryInput(args: { client: Client; region: string; now: Date; persist?: boolean }): Promise<StoryInput> {
  const { client, region, now } = args;
  const regions = await activeStoryRegions(client);
  const active = regions.find((item) => item.region === region);
  if (!active || !validTimezone(active.timezone)) throw new StoryInputError("unknown_region", 400);
  const editionDate = localDate(now, active.timezone);
  const allBeaches: BeachRow[] = [];
  for (;;) {
    const { data, error } = await client.from("beaches")
      .select("id, name, lat, lon, aspect_deg, swell_window_center_deg, swell_window_halfwidth_deg, wind_offshore_deg").eq("region", region).is("deleted_at", null)
      .order("id", { ascending: true }).range(allBeaches.length, allBeaches.length + PAGE_SIZE - 1);
    if (error) throw new StoryInputError("story_beaches_read_failed");
    if (!data?.length) break;
    allBeaches.push(...data);
  }
  allBeaches.sort((a, b) => a.lat - b.lat || a.lon - b.lon || a.id.localeCompare(b.id));
  const count = Math.min(8, allBeaches.length);
  const beaches = Array.from({ length: count }, (_, index) =>
    allBeaches[Math.round(index * (allBeaches.length - 1) / Math.max(1, count - 1))]);
  const beachIds = beaches.map((beach) => beach.id);
  if (beachIds.length === 0) throw new StoryInputError("region_has_no_beaches", 409);

  const from = zonedWallClockToUtc(editionDate, "00:00:00.000", active.timezone);
  const to = zonedWallClockToUtc(addDays(editionDate, 7), "00:00:00.000", active.timezone);
  const rows: Row[] = [];
  for (;;) {
    const { data, error } = await client.from("enhanced_forecasts")
      .select("id, beach_id, forecast_at, wave_height, swell_direction_om, swell_period_om, wind_direction, tide_status, om_fetched_at, updated_at")
      .in("beach_id", beachIds).gte("forecast_at", from).lt("forecast_at", to)
      .order("forecast_at", { ascending: true }).order("beach_id", { ascending: true })
      .range(rows.length, rows.length + PAGE_SIZE - 1);
    if (error) throw new StoryInputError("story_forecast_read_failed");
    if (!data?.length) break;
    rows.push(...data);
  }
  const sourceTimes = rows.map((row) => Date.parse(row.om_fetched_at ?? row.updated_at ?? ""))
    .filter((ms) => Number.isFinite(ms) && ms <= now.getTime());
  const latestSource = sourceTimes.length ? Math.max(...sourceTimes) : Number.NaN;
  if (!Number.isFinite(latestSource) || now.getTime() - latestSource > SOURCE_MAX_AGE_MS) {
    throw new StoryInputError("story_source_stale", 409);
  }
  const dayRows = Map.groupBy(rows, (row) => localDate(new Date(row.forecast_at), active.timezone));
  const hourFormatter = new Intl.DateTimeFormat("en-GB", { timeZone: active.timezone, hour: "2-digit", hourCycle: "h23" });
  const signals: RegionalDaySignal[] = Array.from({ length: 7 }, (_, index) => {
    const date = addDays(editionDate, index);
    const samples = dayRows.get(date) ?? [];
    const measured = samples.filter((row) => parseWaveHeightMidpointFt(row.wave_height) !== null
      && Number.isFinite(Date.parse(row.om_fetched_at ?? row.updated_at ?? ""))
      && Date.parse(row.om_fetched_at ?? row.updated_at ?? "") <= now.getTime()
      && now.getTime() - Date.parse(row.om_fetched_at ?? row.updated_at ?? "") <= SOURCE_MAX_AGE_MS);
    const perBeach = new Set(measured.map((row) => row.beach_id));
    const heights = measured.map((row) => parseWaveHeightMidpointFt(row.wave_height)!).filter(Number.isFinite);
    const directions = measured.map((row) => row.swell_direction_om).filter((value): value is number => value !== null && Number.isFinite(value));
    const periods = measured.map((row) => row.swell_period_om).filter((value): value is number => value !== null && Number.isFinite(value)).sort((a, b) => a - b);
    const source = samples.map((row) => Date.parse(row.om_fetched_at ?? row.updated_at ?? "")).filter(Number.isFinite);
    const direction = meanDirection(directions);
    const exposed = direction === null ? 0 : beaches.filter((beach) =>
      beach.aspect_deg !== null && Math.abs(((beach.aspect_deg - direction + 540) % 360) - 180) <= 45).length;
    const exposedBeaches = direction === null ? [] : beaches.flatMap((beach) => {
      const factor = exposureFactor(direction, swellWindowForBeach(beach));
      return factor === null ? [] : [{ beachId: beach.id, beachName: beach.name, exposure: exposureLabel(factor) }];
    });
    const bucketOf = (at: string): "morning" | "midday" | "evening" | null => {
      const hour = Number(hourFormatter.format(new Date(at)));
      if (hour < 6 || hour >= 19) return null;
      return hour < 12 ? "morning" : hour < 16 ? "midday" : "evening";
    };
    const windRows = samples.flatMap((row) => {
      const beach = beaches.find((item) => item.id === row.beach_id);
      const degrees = parseSwellDirectionToDegrees(row.wind_direction);
      if (!beach || beach.wind_offshore_deg === null || degrees === null) return [];
      const bucket = bucketOf(row.forecast_at);
      if (!bucket) return [];
      const difference = angleDifference(degrees, beach.wind_offshore_deg);
      if (difference > 45 && difference < 135) return [];
      return [{ row, bucket, windClass: difference <= 45 ? "offshore" as const : "onshore" as const }];
    });
    const morning = windRows.find((item) => item.bucket === "morning");
    const afternoon = morning && windRows.find((item) => item.row.beach_id === morning.row.beach_id
      && item.bucket !== "morning" && item.windClass !== morning.windClass);
    const tideRow = samples.find((row) => row.tide_status && bucketOf(row.forecast_at)
      && /^(rising|falling)$/i.test(row.tide_status));
    return {
      localDate: date,
      complete: perBeach.size === beachIds.length && measured.length >= beachIds.length * 2,
      sampleBeaches: perBeach.size,
      meanHeightFt: heights.length ? heights.reduce((a, b) => a + b, 0) / heights.length : null,
      directionDeg: direction,
      periodS: periods.length ? periods[Math.floor(periods.length / 2)] : null,
      sourceSeries: `enhanced_forecasts:${region}`,
      forecastRevision: source.length ? new Date(Math.max(...source)).toISOString() : "",
      ...(exposed >= 3 ? { exposure: { kind: "open" as const, sampleBeaches: exposed } } : {}),
      exposedBeaches,
      ...(morning && afternoon ? { wind: { bucket: afternoon.bucket, fromBucket: "morning" as const,
        fromWindClass: morning.windClass, windClass: afternoon.windClass, selectorConfirmed: true,
        turnConfirmed: true, beachId: morning.row.beach_id,
        fromDirection: morning.row.wind_direction ?? undefined, toDirection: afternoon.row.wind_direction ?? undefined } } : {}),
      ...(tideRow ? { tide: { bucket: bucketOf(tideRow.forecast_at)!, tidePhase: tideRow.tide_status!.toLowerCase(),
        windowOrder: "opens" as const, selectorConfirmed: true, orderingConfirmed: true, beachId: tideRow.beach_id } } : {}),
    };
  });
  if (signals.some((day) => !day.complete)) throw new StoryInputError("story_coverage_sparse", 409);
  const copyFacts = buildStoryCandidates(signals, region);
  if (copyFacts.length === 0) throw new StoryInputError("story_no_candidates", 409);
  const sourceHash = sha256Hex(canonicalJson({ sampleVersion: SAMPLE_VERSION, beachIds, rows }));
  const existing = await loadLatestStoryInput(client, region, editionDate);
  if (existing?.provenance?.sourceHashes?.[0] === sourceHash) return existing;
  const input: StoryInput = {
    schemaVersion: 3, region, editionDate,
    sourcePublishedAt: new Date(latestSource).toISOString(),
    validUntil: zonedWallClockToUtc(addDays(editionDate, 1), "23:59:59.000", active.timezone),
    briefing: { schemaVersion: 3, editionDate, generatedAt: now.toISOString(), selections: [] },
    copyFacts,
    provenance: { sourceIds: rows.map((row) => row.id), sourceHashes: [sourceHash],
      generationInputVersion: SAMPLE_VERSION, representativeBeachIds: beachIds,
      coverageDates: signals.map((day) => day.localDate),
      coverage: signals.map((day) => ({ localDate: day.localDate, sampleBeaches: day.sampleBeaches,
        rows: dayRows.get(day.localDate)?.length ?? 0 })) },
    inputHash: "",
  };
  input.inputHash = briefingInputHash(input as unknown as Record<string, unknown>);
  if (args.persist !== false) await saveStoryInput(client, input);
  return input;
}
