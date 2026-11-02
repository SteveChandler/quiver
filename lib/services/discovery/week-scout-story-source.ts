import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { parseSwellDirectionToDegrees, parseWaveHeightMidpointFt } from "@/lib/alerts/forecast-parsers";
import { exposureFactor, exposureLabel, swellWindowForBeach, type SwellEventForecastRow } from "@/lib/alerts/swell-events";
import { loadRegionForecastEvents } from "@/lib/alerts/swell-events/regional";
import { CLOSING_OUT_FACE_FT, ratingWindow } from "@/lib/alerts/swell-events/regional-rating";
import { resolveWavePunchiness } from "@/lib/domains/spot-profile/wave-punchiness";
import { angleDifference } from "@/lib/domains/shared/angle-utils";
import { nativeScoreInputsFromForecast, scoreNativeConditionInputs } from "@/lib/scoring/native-condition-score";
import type { EnhancedForecastEntity } from "@/types/forecast";
import { briefingInputHash, canonicalJson, sha256Hex } from "./swell-briefing-hash";
import { addDays, localDate, zonedWallClockToUtc } from "./swell-briefing-input";
import { buildEventCandidates, buildStoryCandidates, MAX_FACTS, storyEventKey, storyEventsFromRegion, type RegionalDaySignal } from "./week-scout-story-candidates";
import { beachDayFactsFromBuild, beachFeel, breakerCharacter, eventFactsFromBuild, faceRangeFt, median, sizeWordsFor, windHoursFor } from "./week-scout-story-facts";
import { buildRegionGateContext } from "./week-scout-story-region-gate";
import { loadLatestStoryInput, saveStoryInput, activeStoryRegions } from "./week-scout-story-store";
import type { StoryInput } from "./week-scout-story-types";
import { recordStage, timeStage } from "@/lib/observability/request-timing";

type Client = SupabaseClient<Database>;
type Row = { id: string; beach_id: string; forecast_at: string; wave_height: string | null; wave_period: string | null; wind_speed: string | null; tide_height: string | null; swell_direction_om: number | null; swell_period_om: number | null; wind_direction: string | null; tide_status: string | null; om_fetched_at: string | null; updated_at: string | null } & SwellEventForecastRow;
type BeachRow = Pick<Database["public"]["Tables"]["beaches"]["Row"],
  "id" | "name" | "lat" | "lon" | "aspect_deg" | "swell_window_center_deg" | "swell_window_halfwidth_deg" | "wind_offshore_deg" | "wind_offshore_tol_deg"
  | "wave_punchiness_ai" | "wave_punchiness_ai_confidence" | "persona" | "break_type" | "skill_level">;
export const STORY_SAMPLE_VERSION = "regional-swell-events-8";
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

// Lives with the candidates so the region gate can read it without importing this module back.
export { storyEventsFromRegion };

export async function buildStoryInput(args: { client: Client; region: string; now: Date; persist?: boolean }): Promise<StoryInput> {
  const { client, region, now } = args;
  const regions = await activeStoryRegions(client);
  const active = regions.find((item) => item.region === region);
  if (!active || !validTimezone(active.timezone)) throw new StoryInputError("unknown_region", 400);
  const editionDate = localDate(now, active.timezone);
  const allBeaches: BeachRow[] = [];
  for (;;) {
    const { data, error } = await client.from("beaches")
      .select("id, name, lat, lon, aspect_deg, swell_window_center_deg, swell_window_halfwidth_deg, wind_offshore_deg, wind_offshore_tol_deg, wave_punchiness_ai, wave_punchiness_ai_confidence, persona, break_type, skill_level").eq("region", region).is("deleted_at", null)
      .order("id", { ascending: true }).range(allBeaches.length, allBeaches.length + PAGE_SIZE - 1);
    if (error) throw new StoryInputError("story_beaches_read_failed");
    if (!data?.length) break;
    allBeaches.push(...data as unknown as BeachRow[]);
  }
  allBeaches.sort((a, b) => a.lat - b.lat || a.lon - b.lon || a.id.localeCompare(b.id));
  const count = Math.min(8, allBeaches.length);
  const beaches = Array.from({ length: count }, (_, index) =>
    allBeaches[Math.round(index * (allBeaches.length - 1) / Math.max(1, count - 1))]);
  const beachIds = beaches.map((beach) => beach.id);
  const allBeachIds = allBeaches.map((beach) => beach.id);
  if (beachIds.length === 0) throw new StoryInputError("region_has_no_beaches", 409);

  const from = zonedWallClockToUtc(editionDate, "00:00:00.000", active.timezone);
  const to = zonedWallClockToUtc(addDays(editionDate, 7), "00:00:00.000", active.timezone);
  // Forecast rows and the region build are independent reads; chunks run together.
  const readChunk = async (chunk: string[]): Promise<Row[]> => {
    const rows: Row[] = [];
    let offset = 0;
    for (;;) {
      const { data, error } = await client.from("enhanced_forecasts")
        .select("id, beach_id, forecast_at, wave_height, wave_period, wind_speed, tide_height, swell_direction_om, swell_period_om, swell_1_height, swell_1_period, swell_1_direction, swell_2_height, swell_2_period, swell_2_direction, data_source, wind_direction, tide_status, om_fetched_at, updated_at")
        .in("beach_id", chunk).gte("forecast_at", from).lt("forecast_at", to)
        .order("forecast_at", { ascending: true }).order("beach_id", { ascending: true })
        .range(offset, offset + PAGE_SIZE - 1);
      if (error) throw new StoryInputError("story_forecast_read_failed");
      if (!data?.length) break;
      rows.push(...data);
      offset += data.length;
    }
    return rows;
  };
  const chunks = Array.from({ length: Math.ceil(allBeachIds.length / 100) }, (_, index) =>
    allBeachIds.slice(index * 100, index * 100 + 100));
  const rowsRead = timeStage("story-rows", async () => (await Promise.all(chunks.map(readChunk))).flat());
  const regionRead = timeStage("story-region", () => loadRegionForecastEvents({ client, region, now, timezone: active.timezone }));
  // Settle every read before throwing so no rejection is left unhandled.
  const [rowsResult, regionResult] = await Promise.allSettled([rowsRead, regionRead]);
  if (rowsResult.status === "rejected") throw rowsResult.reason;
  const rows: Row[] = rowsResult.value;
  const computeStartedAt = performance.now();
  const sourceTimes = rows.map((row) => Date.parse(row.om_fetched_at ?? row.updated_at ?? ""))
    .filter((ms) => Number.isFinite(ms) && ms <= now.getTime());
  const latestSource = sourceTimes.length ? Math.max(...sourceTimes) : Number.NaN;
  if (!Number.isFinite(latestSource) || now.getTime() - latestSource > SOURCE_MAX_AGE_MS) {
    throw new StoryInputError("story_source_stale", 409);
  }
  if (regionResult.status === "rejected") {
    console.warn("[week-scout-story] region build failed", { region, error: String(regionResult.reason) });
    throw new StoryInputError("story_region_read_failed");
  }
  const build = regionResult.value;
  const { week: events, all: allEvents } = storyEventsFromRegion(build, editionDate);
  const dayRows = Map.groupBy(rows, (row) => localDate(new Date(row.forecast_at), active.timezone));
  const hourFormatter = new Intl.DateTimeFormat("en-GB", { timeZone: active.timezone, hour: "2-digit", hourCycle: "h23" });
  const signals: RegionalDaySignal[] = Array.from({ length: 7 }, (_, index) => {
    const date = addDays(editionDate, index);
    const samples = (dayRows.get(date) ?? []).filter((row) => beachIds.includes(row.beach_id));
    const regionalSamples = dayRows.get(date) ?? [];
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
    // Each event peaking today gets every beach's exposure to its own direction.
    const peaking = events.filter((item) => localDate(new Date(item.peakAt), item.timezone) === date);
    const qualityScores = new Map(peaking.length === 0 ? [] : allBeaches.map((beach) => {
      const beachScores = regionalSamples.filter((row) => row.beach_id === beach.id)
        .map((row) => scoreNativeConditionInputs(nativeScoreInputsFromForecast(row as EnhancedForecastEntity), "intermediate"));
      return [beach.id, beachScores.length ? Math.max(...beachScores) : null];
    }));
    const exposedBeaches = Object.fromEntries(peaking.map((event) => [storyEventKey(event), allBeaches.flatMap((beach) => {
      const factor = exposureFactor(event.directionDeg, swellWindowForBeach(beach));
      return factor === null ? [] : [{ beachId: beach.id, beachName: beach.name, exposure: exposureLabel(factor),
        qualityScore: qualityScores.get(beach.id) ?? null }];
    })]));
    const bucketOf = (at: string): "morning" | "midday" | "evening" | null => {
      const hour = Number(hourFormatter.format(new Date(at)));
      if (hour < 6 || hour >= 19) return null;
      return hour < 12 ? "morning" : hour < 16 ? "midday" : "evening";
    };
    const daylight = regionalSamples.filter((row) => bucketOf(row.forecast_at) !== null);
    const daylightByBeach = new Map<string, Row[]>();
    for (const row of daylight) {
      const beachRows = daylightByBeach.get(row.beach_id) ?? [];
      beachRows.push(row);
      daylightByBeach.set(row.beach_id, beachRows);
    }
    const dayStart = Date.parse(zonedWallClockToUtc(date, "00:00:00.000", active.timezone));
    const dayEnd = Date.parse(zonedWallClockToUtc(addDays(date, 1), "00:00:00.000", active.timezone));
    const coveringEvents = allEvents.filter((event) => {
      const { startMs, endMs } = ratingWindow(event);
      return startMs < dayEnd && endMs > dayStart;
    });
    const coveringEvent = coveringEvents[0];
    const dayPeriods = daylight.map((row) => row.swell_period_om)
      .filter((period): period is number => period !== null && Number.isFinite(period)).sort((a, b) => a - b);
    const medianPeriod = dayPeriods.length === 0 ? null : median(dayPeriods);
    const surfBeaches = allBeaches.flatMap((beach) => {
      const beachRows = daylightByBeach.get(beach.id) ?? [];
      if (beachRows.length === 0) return [];
      const breakerEvent = coveringEvents.map((event) => ({ event,
        facts: beachDayFactsFromBuild(build, event, beach.id, date) }))
        .filter((item) => item.facts !== null)
        .sort((a, b) => (b.facts?.faceFt?.max ?? -1) - (a.facts?.faceFt?.max ?? -1))[0]?.event;
      const character = breakerCharacter(breakerEvent?.kind ?? "swell", breakerEvent?.periodS ?? medianPeriod);
      const score = Math.max(...beachRows.map((row) => scoreNativeConditionInputs(nativeScoreInputsFromForecast(row as EnhancedForecastEntity), "intermediate")));
      const faceFt = faceRangeFt(beachRows.map((row) => row.wave_height));
      const punchiness = resolveWavePunchiness({ override: null, ai: beach.wave_punchiness_ai,
        aiConfidence: beach.wave_punchiness_ai_confidence, persona: beach.persona, break_type: beach.break_type, skill_level: beach.skill_level });
      const swellDirection = coveringEvent?.directionDeg ?? meanDirection(beachRows.flatMap((row) => row.swell_direction_om === null ? [] : [row.swell_direction_om]));
      const factor = swellDirection === null ? null : exposureFactor(swellDirection, swellWindowForBeach(beach));
      return [{ beachId: beach.id, beachName: beach.name, score, facts: { faceFt, sizes: sizeWordsFor(faceFt),
        windHours: windHoursFor(beachRows, beach, active.timezone), breaker: { character, feel: beachFeel(character, punchiness),
          closingOut: factor !== null && exposureLabel(factor) === "open" && faceFt !== null && faceFt.max >= CLOSING_OUT_FACE_FT } } }];
    }).sort((a, b) => b.score - a.score || a.beachName.localeCompare(b.beachName) || a.beachId.localeCompare(b.beachId))
      .slice(0, 4).map(({ score: _score, ...beach }) => beach);
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
      surfBeaches,
      ...(morning && afternoon ? { wind: { bucket: afternoon.bucket, fromBucket: "morning" as const,
        fromWindClass: morning.windClass, windClass: afternoon.windClass, selectorConfirmed: true,
        turnConfirmed: true, beachId: morning.row.beach_id,
        fromDirection: morning.row.wind_direction ?? undefined, toDirection: afternoon.row.wind_direction ?? undefined } } : {}),
      ...(tideRow ? { tide: { bucket: bucketOf(tideRow.forecast_at)!, tidePhase: tideRow.tide_status!.toLowerCase(),
        windowOrder: "opens" as const, selectorConfirmed: true, orderingConfirmed: true, beachId: tideRow.beach_id } } : {}),
    };
  });
  if (signals.some((day) => !day.complete)) throw new StoryInputError("story_coverage_sparse", 409);
  const storyFacts = buildStoryCandidates(signals, region, events, (event) => eventFactsFromBuild(build, event));
  if (storyFacts.length === 0) throw new StoryInputError("story_no_candidates", 409);
  // The card's lines ride after the story's own: every forecast event the card shows, not only the week's.
  // Past the cap the latest events lose their lines; the card writes those from the build itself.
  const copyFacts = [...storyFacts, ...buildEventCandidates(build, allEvents, buildRegionGateContext(build, editionDate), now)]
    .slice(0, MAX_FACTS);
  const sourceHash = sha256Hex(canonicalJson({ sampleVersion: STORY_SAMPLE_VERSION, beachIds, rows, events: allEvents,
    candidateFacts: copyFacts.map(({ id, facts }) => ({ id, facts })) }));
  recordStage("story-compute", performance.now() - computeStartedAt);
  const existing = await loadLatestStoryInput(client, region, editionDate);
  if (existing?.provenance?.sourceHashes?.[0] === sourceHash) return existing;
  const input: StoryInput = {
    schemaVersion: 3, region, editionDate,
    sourcePublishedAt: new Date(latestSource).toISOString(),
    validUntil: zonedWallClockToUtc(addDays(editionDate, 1), "23:59:59.000", active.timezone),
    briefing: { schemaVersion: 3, editionDate, generatedAt: now.toISOString(), selections: [] },
    copyFacts,
    beachNames: Object.fromEntries(allBeaches.map((beach) => [beach.id, beach.name])),
    provenance: { sourceIds: rows.map((row) => row.id), sourceHashes: [sourceHash],
      generationInputVersion: STORY_SAMPLE_VERSION, representativeBeachIds: beachIds,
      coverageDates: signals.map((day) => day.localDate),
      coverage: signals.map((day) => ({ localDate: day.localDate, sampleBeaches: day.sampleBeaches,
        rows: dayRows.get(day.localDate)?.length ?? 0 })) },
    inputHash: "",
  };
  input.inputHash = briefingInputHash(input as unknown as Record<string, unknown>);
  if (args.persist !== false) await saveStoryInput(client, input);
  return input;
}
