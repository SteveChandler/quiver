import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
export { isWeekScoutStoryEnabled } from "@/lib/flags/week-scout-story";
import type { CanonicalWeekScoutResponse } from "./week-scout";
import { parseWindSpeedToKt } from "@/lib/alerts/forecast-parsers";
import { directionIndex, directionSector, periodBand } from "./week-scout-story-candidates";
import { buildStoryInput, StoryInputError, STORY_SAMPLE_VERSION } from "./week-scout-story-source";
import { activeStoryRegions, loadStoryInput, loadLatestStoryEdition, loadLatestStoryInput } from "./week-scout-story-store";
import { assertStoryArtifactMatchesInput } from "./week-scout-story-validate";
import type { StoryGate, StoryInput, StoryWire } from "./week-scout-story-types";

type Client = SupabaseClient<Database>;
type Live = CanonicalWeekScoutResponse;
const CONFIDENCE = ["on_the_radar", "likely", "locked"];
const FALLBACK_TTL_MS = 5 * 60_000;
const fallbackInputs = new Map<string, { input: Promise<StoryInput | null>; expiresAt: number }>();

function regionalFallback(client: Client, region: string, editionDate: string, now: Date): Promise<StoryInput | null> {
  const key = `${region}:${editionDate}`;
  const cached = fallbackInputs.get(key);
  if (cached && cached.expiresAt > now.getTime()) return cached.input;
  const input = buildStoryInput({ client, region, now, persist: false }).catch((error: unknown) => {
    // Deterministic outcomes (4xx: stale source, sparse coverage, no candidates)
    // are cached; a transient read failure (5xx) is retried on the next request.
    if (error instanceof StoryInputError && error.status < 500) return null;
    fallbackInputs.delete(key);
    throw error;
  });
  if (fallbackInputs.size >= 64) fallbackInputs.delete(fallbackInputs.keys().next().value!);
  fallbackInputs.set(key, { input, expiresAt: now.getTime() + FALLBACK_TTL_MS });
  return input;
}

function localDate(at: string, timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" })
    .format(new Date(at));
}

function matchedSwell(gate: Extract<StoryGate, { kind: "swell" }>, live: Live): NonNullable<Live["swells"]>[number] | null {
  return (live.swells ?? []).find((swell) => directionSector(swell.directionDeg) === gate.directionSector
    && (gate.directionIndex === undefined || directionIndex(swell.directionDeg) === gate.directionIndex)
    && periodBand(swell.periodS) === gate.periodBand
    && (gate.periodClass === undefined || (swell.periodS >= 13 ? "long" : swell.periodS >= 10 ? "mid" : "short") === gate.periodClass)
    && `${directionSector(swell.directionDeg)}-${periodBand(swell.periodS)}-${swell.peakLocalDate}` === gate.regionalEventKey
    && swell.peakLocalDate === gate.peakLocalDate
    && localDate(swell.arrivalAt, swell.timezone) === gate.arrivalLocalDate
    && (gate.fadeLocalDate === null || (swell.fadeAt !== null && localDate(swell.fadeAt, swell.timezone) === gate.fadeLocalDate))
    && CONFIDENCE.indexOf(swell.confidence) >= CONFIDENCE.indexOf(gate.confidence)
    && swell.beaches.length >= gate.minimumBeaches) ?? null;
}

function completeQuietDay(date: string, live: Live): boolean {
  const day = live.days.find((item) => item.localDate === date);
  const coverage = live.coverage?.days.find((item) => item.localDate === date);
  return Boolean(day && !day.bestDayWindow && coverage && coverage.eligible > 0
    && coverage.missing === 0 && coverage.buckets.every((bucket) => bucket.held === 0 && bucket.missing === 0));
}

function firstCoverSwell(live: Live): NonNullable<Live["swells"]>[number] | null {
  const dates = new Set(live.days.slice(0, 7).map((day) => day.localDate));
  return (live.swells ?? []).find((swell) => dates.has(swell.peakLocalDate)
    || dates.has(localDate(swell.arrivalAt, swell.timezone))) ?? null;
}

/** A selected sentence is served only when the live response still proves its gate. */
export function storyGateHolds(gate: StoryGate, live: Live): boolean {
  switch (gate.kind) {
    case "swell": return matchedSwell(gate, live) !== null;
    case "exposure": return (live.swells ?? []).some((swell) =>
      `${directionSector(swell.directionDeg)}-${periodBand(swell.periodS)}-${swell.peakLocalDate}` === gate.regionalEventKey
      && directionSector(swell.directionDeg) === gate.directionSector
      && swell.beaches.filter((beach) => beach.exposureLabel === gate.exposure).length >= gate.minimumBeaches
      && (!gate.beaches || gate.beaches.every((claim) => swell.beaches.some((beach) =>
        beach.beachId === claim.beachId && beach.exposureLabel === claim.exposure))));
    case "origin": return false; // No verified track lineage exists in today's swells[] contract.
    case "wind": {
      if (!gate.beachId || !gate.fromBucket || !gate.fromDirection || !gate.toDirection) return false;
      const day = live.days.find((item) => item.localDate === gate.localDate);
      if (!day?.bestDayWindow?.safe || day.bestDayWindow.beachId !== gate.beachId) return false;
      const windows = day.windows;
      return windows.some((window) => window.beachId === gate.beachId && window.bucket === gate.fromBucket
        && window.safe && window.forecast.windDirection === gate.fromDirection)
        && windows.some((window) => window.beachId === gate.beachId && window.bucket === gate.bucket
          && window.forecast.windDirection === gate.toDirection);
    }
    case "wind_pattern": return gate.days.length >= 3 && gate.days.every((wind) => {
      if (!wind.beachId || !wind.fromBucket || !wind.fromDirection || !wind.toDirection) return false;
      const windows = live.days.find((day) => day.localDate === wind.localDate)?.windows ?? [];
      return windows.some((window) => window.beachId === wind.beachId && window.bucket === wind.fromBucket
        && window.safe && window.forecast.windDirection === wind.fromDirection)
        && windows.some((window) => window.beachId === wind.beachId && window.bucket === wind.bucket
          && window.forecast.windDirection === wind.toDirection);
    });
    case "tide": {
      const day = live.days.find((item) => item.localDate === gate.localDate);
      if (!day?.bestDayWindow?.safe || (gate.beachId && day.bestDayWindow.beachId !== gate.beachId)) return false;
      const window = day.windows.find((item) =>
        item.bucket === gate.bucket && (!gate.beachId || item.beachId === gate.beachId));
      return Boolean(window && window.safe && window.verdict !== null && window.bucket === gate.bucket
        && window.forecast.tidePhase?.toLowerCase() === gate.tidePhase.toLowerCase());
    }
    case "change": {
      const previous = live.days.find((day) => day.localDate === gate.fromDate)?.bestDayWindow;
      const current = live.days.find((day) => day.localDate === gate.toDate)?.bestDayWindow;
      if (!previous?.safe || !current?.safe || previous.conditionScore === null || current.conditionScore === null) return false;
      const delta = current.conditionScore - previous.conditionScore;
      return gate.direction === "better" ? delta >= gate.minimumScoreChange : delta <= -gate.minimumScoreChange;
    }
    case "day": {
      const window = live.days.find((day) => day.localDate === gate.localDate)?.bestDayWindow;
      if (!window?.safe || !window.rideable || window.verdict === "skip" || window.bucket !== gate.bucket) return false;
      if (gate.reason === "light_wind") {
        const windKt = parseWindSpeedToKt(window.forecast.windSpeed);
        return windKt !== null && windKt <= 8;
      }
      return gate.reason === "rising_tide" ? window.forecast.tidePhase?.toLowerCase() === "rising" : true;
    }
    case "quiet": return !(live.swells ?? []).some((swell) => gate.completeDates.includes(swell.peakLocalDate)
      || gate.completeDates.includes(localDate(swell.arrivalAt, swell.timezone))) && gate.completeDates.length > 0
      && gate.completeDates.every((date) => completeQuietDay(date, live));
  }
}

export function bindStory(args: {
  region: string | null;
  availability: StoryWire["availability"];
  input: StoryInput | null;
  selections: string[] | null;
  live: Live;
  requireCover?: boolean;
}): StoryWire {
  const { region, input, live } = args;
  const weekDates = new Set(live.days.slice(0, 7).map((day) => day.localDate));
  const swells = (live.swells ?? []).filter((swell) => weekDates.has(swell.peakLocalDate)
    || weekDates.has(localDate(swell.arrivalAt, swell.timezone))).map((swell) => ({
    eventKey: swell.eventKey, directionDeg: swell.directionDeg, directionLabel: swell.directionLabel,
    periodS: swell.periodS, arrivalAt: swell.arrivalAt, peakAt: swell.peakAt,
  }));
  const days = live.days.slice(0, 7).map((day) => {
    const pick = day.bestDayWindow;
    return { localDate: day.localDate, pick: pick ? {
      windowId: pick.id, beachId: pick.beachId, bucket: pick.bucket, verdict: pick.verdict,
      ...(pick.personalVerdict ? { personalVerdict: pick.personalVerdict } : {}),
      ...(pick.personalLabel ? { personalLabel: pick.personalLabel } : {}),
      conditionScore: pick.conditionScore, displayWindowStart: pick.displayWindowStart,
      displayWindowEnd: pick.displayWindowEnd, waveHeight: pick.forecast.waveHeight,
    } : null };
  });
  const empty = (availability: StoryWire["availability"]): StoryWire => ({
    schemaVersion: 3, region, availability, cover: { text: null, swells }, lead: null, turn: null,
    chapters: [], days,
  });
  if (!input || !args.selections || args.availability !== "ready") return empty(args.availability);
  const firstSwell = firstCoverSwell(live);
  const agreesWithCover = (fact: StoryInput["copyFacts"][number]): boolean => {
    if (fact.gate.kind !== "swell") return true;
    if (!firstSwell) return false;
    const gate = fact.gate;
    return gate.arrivalLocalDate === localDate(firstSwell.arrivalAt, firstSwell.timezone)
      && gate.peakLocalDate === firstSwell.peakLocalDate;
  };
  const selected = input.copyFacts.filter((fact) => args.selections?.includes(fact.id));
  if (selected.length !== args.selections.length) return empty("unavailable");
  const chosen = selected.filter((fact) => storyGateHolds(fact.gate, live) && agreesWithCover(fact));
  const text = (slot: string): string | null => chosen.find((fact) => fact.slot === slot)?.text ?? null;
  if (!text("cover") && args.requireCover !== false) return empty("unavailable");
  const dayBodies = new Set<string>();
  const chapters = chosen.filter((fact) => fact.slot.startsWith("swell:") || fact.slot.startsWith("day:")
    || fact.slot.startsWith("quiet:")).filter((fact) => {
    if (!fact.slot.startsWith("day:")) return true;
    const body = fact.text.replace(/^(?:On )?(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)(?:'s|:|,)?\s*/, "").trim();
    if (dayBodies.has(body)) return false;
    dayBodies.add(body);
    return true;
  });
  return {
    schemaVersion: 3, region, availability: "ready", cover: { text: text("cover"), swells },
    lead: text("story:lead"), turn: text("story:turn"),
    chapters: chapters.map((fact) => ({ slot: fact.slot, text: fact.text })),
    days,
  };
}

export function bindFallbackStory(region: string, input: StoryInput, live: Live): StoryWire {
  const slots = new Set<string>();
  const firstSwell = firstCoverSwell(live);
  const matchesFirstSwell = (gate: Extract<StoryGate, { kind: "swell" }>): boolean => Boolean(firstSwell
    && gate.arrivalLocalDate === localDate(firstSwell.arrivalAt, firstSwell.timezone)
    && gate.peakLocalDate === firstSwell.peakLocalDate);
  const matchedEvents = new Set(input.copyFacts.flatMap((fact) => fact.gate.kind === "swell"
    && matchesFirstSwell(fact.gate) && storyGateHolds(fact.gate, live)
    ? [fact.gate.regionalEventKey] : []));
  const selections = [...input.copyFacts].sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0))
    .filter((fact) => {
      if (slots.has(fact.slot) || !storyGateHolds(fact.gate, live)) return false;
      if (fact.gate.kind === "swell" && !matchesFirstSwell(fact.gate)) return false;
      if (fact.slot.startsWith("swell:") && fact.gate.kind === "exposure"
        && !matchedEvents.has(fact.gate.regionalEventKey)) return false;
      slots.add(fact.slot);
      return true;
    }).map((fact) => fact.id);
  if (selections.length === 0) {
    return bindStory({ region, availability: "unavailable", input: null, selections: null, live });
  }
  return bindStory({ region, availability: "ready", input, selections, live, requireCover: false });
}

export async function loadAndBindStory(args: { client: Client; homeBeachId: string | null; live: Live; startLocalDate: string; now: Date }): Promise<StoryWire> {
  const { client, homeBeachId, live, startLocalDate, now } = args;
  if (!homeBeachId) return bindStory({ region: null, availability: "outside_region", input: null, selections: null, live });
  const { data: beach, error } = await client.from("beaches").select("region").eq("id", homeBeachId).maybeSingle();
  if (error) throw error;
  const region = beach?.region ?? null;
  if (!region) return bindStory({ region: null, availability: "outside_region", input: null, selections: null, live });
  const active = await activeStoryRegions(client);
  const activeRegion = active.find((entry) => entry.region === region);
  if (!activeRegion) {
    return bindStory({ region, availability: "outside_region", input: null, selections: null, live });
  }
  const editionDate = localDate(now.toISOString(), activeRegion.timezone);
  const edition = await loadLatestStoryEdition(client, region);
  if (edition?.schemaVersion === 3 && edition.editionDate === editionDate && editionDate === startLocalDate
    && Date.parse(edition.validUntil) >= now.getTime() && Date.parse(edition.sourcePublishedAt) <= now.getTime()) {
    const publishedInput = await loadStoryInput(client, edition.inputHash);
    if (publishedInput?.provenance.generationInputVersion === STORY_SAMPLE_VERSION) {
      try {
        assertStoryArtifactMatchesInput(edition, publishedInput, now);
        const published = bindStory({ region, availability: "ready", input: publishedInput,
          selections: edition.briefing.selections, live });
        if (published.availability === "ready") return published;
      } catch { /* A failed edition falls through to live candidates. */ }
    }
  }
  const cached = await loadLatestStoryInput(client, region, editionDate);
  const usable = cached?.provenance.generationInputVersion === STORY_SAMPLE_VERSION
    && Date.parse(cached.briefing.generatedAt) > now.getTime() - 60 * 60_000
    && Date.parse(cached.sourcePublishedAt) <= now.getTime()
    && Date.parse(cached.validUntil) >= now.getTime();
  const input = usable ? cached : await regionalFallback(client, region, editionDate, now);
  if (!input) return bindStory({ region, availability: "unavailable", input: null, selections: null, live });
  if (input.editionDate !== startLocalDate) {
    return bindStory({ region, availability: "unavailable", input: null, selections: null, live });
  }
  return bindFallbackStory(region, input, live);
}
