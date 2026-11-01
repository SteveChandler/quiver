import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
export { isWeekScoutStoryEnabled } from "@/lib/flags/week-scout-story";
import type { CanonicalWeekScoutResponse } from "./week-scout";
import { parseWindSpeedToKt } from "@/lib/alerts/forecast-parsers";
import { loadRegionForecastEvents, type RegionBuild } from "@/lib/alerts/swell-events/regional";
import { addSwellHeadlines, directionIndex, directionSector, periodBand, periodClass, sizePhrase, storyEventKey,
  windTimingPhrase, type RegionalSwellEvent } from "./week-scout-story-candidates";
import { faceRangeFt, sizeWordsFor, type CandidateFacts } from "./week-scout-story-facts";
import { checkWrittenSentence } from "./week-scout-story-claims";
import { buildRegionGateContext, regionGateHolds, type RegionGateContext } from "./week-scout-story-region-gate";
import { buildStoryInput, storyEventsFromRegion, StoryInputError, STORY_SAMPLE_VERSION } from "./week-scout-story-source";
import { activeStoryRegions, loadStoryInput, loadLatestStoryEdition, loadLatestStoryInput } from "./week-scout-story-store";
import { assertStoryArtifactMatchesInput } from "./week-scout-story-validate";
import type { StoryCandidate, StoryGate, StoryInput, StoryWire, StoryWrittenSentence } from "./week-scout-story-types";

type Client = SupabaseClient<Database>;
type Live = CanonicalWeekScoutResponse;
type SwellGate = Extract<StoryGate, { kind: "swell" }>;
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

function completeQuietDay(date: string, live: Live): boolean {
  const day = live.days.find((item) => item.localDate === date);
  const coverage = live.coverage?.days.find((item) => item.localDate === date);
  return Boolean(day && !day.bestDayWindow && coverage && coverage.eligible > 0
    && coverage.missing === 0 && coverage.buckets.every((bucket) => bucket.held === 0 && bucket.missing === 0));
}

/** The region build as the story binds against it: the gate context and the week's first event, which the cover names. */
interface StoryRegion {
  context: RegionGateContext;
  first: RegionalSwellEvent | null;
}

/** No region build: every swell, exposure and beach claim fails, and the story falls back. */
const CLOSED_REGION: StoryRegion = { context: { events: [], exposure: () => null, facing: () => null, wind: () => null, eventFacts: () => null, beachDayFacts: () => null, dayFacts: () => null }, first: null };

export function storyRegion(build: RegionBuild, editionDate: string): StoryRegion {
  return { context: buildRegionGateContext(build, editionDate), first: storyEventsFromRegion(build, editionDate).week[0] ?? null };
}

/** The card's own lines (week-scout-story-candidates buildEventCandidates); the Week Scout story never serves them. */
function isCardSlot(slot: string): boolean {
  return slot.startsWith("event:");
}

/** A selected sentence is served only when the region build or the live response still proves its gate. */
function gateHolds(gate: StoryGate, regional: StoryRegion, live: Live): boolean {
  return regionGateHolds(gate, regional.context) ?? storyGateHolds(gate, live);
}

function liveFacts(fact: StoryCandidate, regional: StoryRegion, live: Live): CandidateFacts | undefined {
  const gate = fact.gate;
  if (gate.kind === "swell") return regional.context.eventFacts(gate.regionalEventKey) ?? undefined;
  if (gate.kind === "beach") return regional.context.beachDayFacts(gate.regionalEventKey, gate.beachId, gate.localDate) ?? undefined;
  if (gate.kind !== "day_surf") return undefined;
  const pick = live.days.find((day) => day.localDate === gate.localDate)?.bestDayWindow;
  const faceFt = pick?.safe && pick.beachId === gate.beachId ? faceRangeFt([pick.forecast.waveHeight]) : null;
  if (!faceFt) return undefined;
  return { ...fact.facts, faceFt, sizes: sizeWordsFor(faceFt), breaker: fact.facts?.breaker ?? null };
}

function pickDayLine(date: string, regional: StoryRegion, live: Live, input: StoryInput, candidates: StoryCandidate[]): StoryCandidate | null {
  const pick = live.days.find((day) => day.localDate === date)?.bestDayWindow;
  if (!pick?.safe) return null;
  const beachName = input.beachNames[pick.beachId];
  const eventFacts = regional.context.dayFacts(pick.beachId, date);
  if (!beachName || /\d/.test(beachName) || !eventFacts) return null;
  const faceFt = faceRangeFt([pick.forecast.waveHeight]);
  if (!faceFt) return null;
  const sizes = sizeWordsFor(faceFt);
  const facts: CandidateFacts = { faceFt, sizes, windHours: eventFacts.windHours, breaker: eventFacts.breaker };
  const size = sizePhrase(faceFt, sizes);
  if (!size) return null;
  const feel = size ? facts.breaker?.feel ?? (facts.breaker?.character === "crumbly" ? "crumbly" : null) : null;
  const wind = windTimingPhrase(facts.windHours ?? []);
  const surf = [size, feel].filter(Boolean).join(" and ");
  const weekday = new Intl.DateTimeFormat("en-US", { weekday: "long", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`));
  const text = `On ${weekday}, ${beachName} runs${surf ? ` ${surf}` : ""}${wind ? `, ${wind}` : ""}.`;
  const gate: StoryGate = { kind: "day_surf", localDate: date, beachId: pick.beachId, faceFt };
  const fact: StoryCandidate = {
    id: `pick-${date}-${pick.beachId}`, slot: `day:${date}`, rank: 75, text, facts, gate,
  };
  return checkWrittenSentence(text, { ...fact, facts }, Object.values(input.beachNames), [input.region]).ok ? fact : null;
}

function candidateHolds(fact: StoryCandidate, regional: StoryRegion, live: Live, input: StoryInput): boolean {
  return gateHolds(fact.gate, regional, live)
    && checkWrittenSentence(fact.text, { ...fact, facts: liveFacts(fact, regional, live) },
      Object.values(input.beachNames ?? {}), [input.region]).ok;
}

/** A swell sentence may sit under the cover only if it names the region's first event: its key, days and direction. */
function describesFirstSwell(gate: SwellGate, first: RegionalSwellEvent | null): boolean {
  if (!first) return false;
  return gate.regionalEventKey === storyEventKey(first)
    && gate.arrivalLocalDate === localDate(first.arrivalAt, first.timezone)
    && gate.peakLocalDate === localDate(first.peakAt, first.timezone)
    && (gate.directionIndex === undefined || gate.directionIndex === directionIndex(first.directionDeg));
}

/**
 * Cover and lead composed from the region's first event itself, for when the input (an edition or a
 * cached input) dated or binned it differently. Every gate field comes from that event, so the sentence
 * can only claim it and holds against the same build.
 */
function firstEventHeadlines(first: RegionalSwellEvent, live: Live, context: RegionGateContext): StoryInput["copyFacts"] {
  const week = live.days.slice(0, 7).map((day) => day.localDate);
  if (week.length === 0) return [];
  const key = storyEventKey(first);
  const index = directionIndex(first.directionDeg);
  const arrivalDate = localDate(first.arrivalAt, first.timezone);
  const peakDate = localDate(first.peakAt, first.timezone);
  const gate: StoryGate = {
    kind: "swell", regionalEventKey: key, directionSector: directionSector(first.directionDeg), directionIndex: index,
    periodBand: periodBand(first.periodS), periodClass: periodClass(first.periodS),
    arrivalLocalDate: arrivalDate, peakLocalDate: peakDate, fadeLocalDate: null,
    confidence: first.confidence, minimumBeaches: first.minimumBeaches,
  };
  const facts: StoryInput["copyFacts"] = [];
  addSwellHeadlines(facts, { key, kind: first.kind, directionIndex: index, periodS: first.periodS, arrivalDate, peakDate },
    null, week[0], week[week.length - 1], gate, "first-", context.eventFacts(key));
  return facts.map((fact) => ({ ...fact, rank: Number.MAX_SAFE_INTEGER }));
}

/** The gates the live Week Scout response proves; swell, exposure and beach claims are the region build's. */
export function storyGateHolds(gate: StoryGate, live: Live): boolean {
  switch (gate.kind) {
    // The chart's swells come from a detector without storms or the region's beaches; they never prove these.
    case "swell":
    case "exposure":
    case "beach":
      return false;
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
    case "day_surf": {
      const pick = live.days.find((day) => day.localDate === gate.localDate)?.bestDayWindow;
      if (!pick?.safe || pick.beachId !== gate.beachId) return false;
      const range = faceRangeFt([pick.forecast.waveHeight]);
      return range !== null && range.min >= gate.faceFt.min && range.max <= gate.faceFt.max;
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
  /** The edition's own sentences for some selections; each is served only if it claims nothing its candidate doesn't. */
  written?: readonly StoryWrittenSentence[];
  live: Live;
  requireCover?: boolean;
  pickDayFallback?: boolean;
  /** Without one, every swell, exposure and beach claim fails. */
  regional?: StoryRegion;
}): StoryWire {
  const { region, input, live } = args;
  const regional = args.regional ?? CLOSED_REGION;
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
  const agreesWithCover = (fact: StoryInput["copyFacts"][number]): boolean =>
    fact.gate.kind !== "swell" || describesFirstSwell(fact.gate, regional.first);
  const selected = input.copyFacts.filter((fact) => args.selections?.includes(fact.id));
  if (selected.length !== args.selections.length) return empty("unavailable");
  // An edition may select card lines too; they stay out of the story and never count against it.
  const chosen = selected.filter((fact) => !isCardSlot(fact.slot) && !fact.slot.startsWith("day:")
    && candidateHolds(fact, regional, live, input) && agreesWithCover(fact));
  const daySlots = new Set(selected.filter((fact) => fact.slot.startsWith("day:")).map((fact) => fact.slot));
  if (args.pickDayFallback) input.copyFacts.filter((fact) => fact.slot.startsWith("day:")).forEach((fact) => daySlots.add(fact.slot));
  for (const slot of daySlots) {
    const candidates = input.copyFacts.filter((fact) => fact.slot === slot).sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0));
    const selectedFact = selected.find((fact) => fact.slot === slot);
    if (selectedFact && candidateHolds(selectedFact, regional, live, input)) {
      chosen.push(selectedFact);
      continue;
    }
    const surfaced = candidates.filter((fact) => fact.gate.kind === "day_surf")
      .find((fact) => candidateHolds(fact, regional, live, input));
    if (surfaced) {
      chosen.push(surfaced);
      continue;
    }
    const date = slot.slice("day:".length);
    const pickLine = pickDayLine(date, regional, live, input, candidates);
    if (pickLine) {
      chosen.push(pickLine);
      continue;
    }
    const fallback = candidates.filter((fact) => fact.gate.kind === "change" || fact.gate.kind === "tide"
      || fact.gate.kind === "wind")
      .find((fact) => candidateHolds(fact, regional, live, input));
    if (fallback) chosen.push(fallback);
  }
  // Per slot: a written sentence that fails its check shows the candidate's own text; the others keep theirs.
  const beachNames = input.beachNames ? Object.values(input.beachNames) : null;
  const served = (fact: StoryInput["copyFacts"][number]): string => {
    const entry = args.written?.find((item) => item.basedOn === fact.id && item.slot === fact.slot);
    if (!entry || !beachNames) return fact.text;
    return checkWrittenSentence(entry.text, { ...fact, facts: liveFacts(fact, regional, live) }, beachNames, [input.region]).ok ? entry.text : fact.text;
  };
  const text = (slot: string): string | null => {
    const fact = chosen.find((item) => item.slot === slot);
    return fact ? served(fact) : null;
  };
  if (!text("cover") && args.requireCover !== false) return empty("unavailable");
  const dayBodies = new Set<string>();
  const chapters = chosen.filter((fact) => fact.slot.startsWith("swell:") || fact.slot.startsWith("day:")
    || fact.slot.startsWith("quiet:")).filter((fact) => {
    if (!fact.slot.startsWith("day:")) return true;
    const body = served(fact).replace(/^(?:On )?(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)(?:'s|:|,)?\s*/, "").trim();
    if (dayBodies.has(body)) return false;
    dayBodies.add(body);
    return true;
  });
  return {
    schemaVersion: 3, region, availability: "ready", cover: { text: text("cover"), swells },
    lead: text("story:lead"), turn: text("story:turn"),
    chapters: chapters.map((fact) => ({ slot: fact.slot, text: served(fact) })),
    days,
  };
}

export function bindFallbackStory(region: string, fullInput: StoryInput, live: Live, regional: StoryRegion): StoryWire {
  // Card lines can't fill a story slot or make an otherwise empty story ready.
  const regionalInput = { ...fullInput, copyFacts: fullInput.copyFacts.filter((fact) => !isCardSlot(fact.slot)) };
  const slots = new Set<string>();
  const matchesFirstSwell = (gate: SwellGate): boolean => describesFirstSwell(gate, regional.first);
  // Ranked last, so a passing regional sentence keeps its slot and these fill only what it leaves empty.
  const headlines = regional.first ? firstEventHeadlines(regional.first, live, regional.context) : [];
  const input = headlines.length > 0
    ? { ...regionalInput, copyFacts: [...regionalInput.copyFacts, ...headlines] } : regionalInput;
  const matchedEvents = new Set(regionalInput.copyFacts.flatMap((fact) => fact.gate.kind === "swell"
    && matchesFirstSwell(fact.gate) && candidateHolds(fact, regional, live, input)
    ? [fact.gate.regionalEventKey] : []));
  const selections = [...input.copyFacts].sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0))
    .filter((fact) => {
      if (fact.slot.startsWith("day:")) return false;
      if (slots.has(fact.slot) || !candidateHolds(fact, regional, live, input)) return false;
      if (fact.gate.kind === "swell" && !matchesFirstSwell(fact.gate)) return false;
      if (fact.slot.startsWith("swell:") && fact.gate.kind === "exposure"
        && !matchedEvents.has(fact.gate.regionalEventKey)) return false;
      slots.add(fact.slot);
      return true;
    }).map((fact) => fact.id);
  const hasDayCandidates = input.copyFacts.some((fact) => fact.slot.startsWith("day:"));
  if (selections.length === 0 && !hasDayCandidates) {
    return bindStory({ region, availability: "unavailable", input: null, selections: null, live });
  }
  return bindStory({ region, availability: "ready", input, selections, live, requireCover: false, regional, pickDayFallback: true });
}

type StoryLoadArgs = { client: Client; homeBeachId: string | null; startLocalDate: string; now: Date };
export type StoryBinder = (live: Live) => Promise<StoryWire>;

/**
 * Loads everything the story needs except the live forecast, so it can run
 * alongside the ranking; the returned binder applies the live gates.
 */
export async function prepareStory(args: StoryLoadArgs): Promise<StoryBinder> {
  const { client, homeBeachId, startLocalDate, now } = args;
  const unbound = (region: string | null, availability: StoryWire["availability"]): StoryBinder =>
    async (live) => bindStory({ region, availability, input: null, selections: null, live });
  if (!homeBeachId) return unbound(null, "outside_region");
  const { data: beach, error } = await client.from("beaches").select("region").eq("id", homeBeachId).maybeSingle();
  if (error) throw error;
  const region = beach?.region ?? null;
  if (!region) return unbound(null, "outside_region");
  const active = await activeStoryRegions(client);
  const activeRegion = active.find((entry) => entry.region === region);
  if (!activeRegion) return unbound(region, "outside_region");
  const editionDate = localDate(now.toISOString(), activeRegion.timezone);
  // Cached per region and day, so this costs no forecast read on a warm cache. Never rejects: without
  // the build, swell, exposure and beach claims fail closed and the story falls back.
  const regionRead = loadRegionForecastEvents({ client, region, now, timezone: activeRegion.timezone })
    .then((build) => storyRegion(build, editionDate))
    .catch((error: unknown) => {
      console.warn("[week-scout-story] region gate read failed", { region, error: String(error) });
      return CLOSED_REGION;
    });
  const [edition, cached] = await Promise.all([
    loadLatestStoryEdition(client, region),
    loadLatestStoryInput(client, region, editionDate),
  ]);
  let publishedInput: StoryInput | null = null;
  if (edition?.schemaVersion === 3 && edition.editionDate === editionDate && editionDate === startLocalDate
    && Date.parse(edition.validUntil) >= now.getTime() && Date.parse(edition.sourcePublishedAt) <= now.getTime()) {
    const loaded = await loadStoryInput(client, edition.inputHash);
    publishedInput = loaded?.provenance.generationInputVersion === STORY_SAMPLE_VERSION ? loaded : null;
  }
  const usable = cached?.provenance.generationInputVersion === STORY_SAMPLE_VERSION
    && Date.parse(cached.briefing.generatedAt) > now.getTime() - 60 * 60_000
    && Date.parse(cached.sourcePublishedAt) <= now.getTime()
    && Date.parse(cached.validUntil) >= now.getTime();
  // Without a servable edition the live build is certain, so start it now; with
  // one, build only if the edition fails its live gates.
  const fallback = usable ? Promise.resolve(cached) : publishedInput ? null : regionalFallback(client, region, editionDate, now);
  fallback?.catch(() => undefined);
  return async (live) => {
    const regional = await regionRead;
    if (edition && publishedInput) {
      try {
        assertStoryArtifactMatchesInput(edition, publishedInput, now);
        const published = bindStory({ region, availability: "ready", input: publishedInput,
          selections: edition.briefing.selections, written: edition.briefing.written, live, regional });
        if (published.availability === "ready") return published;
      } catch { /* A failed edition falls through to live candidates. */ }
    }
    const input = await (fallback ?? regionalFallback(client, region, editionDate, now));
    if (!input) return bindStory({ region, availability: "unavailable", input: null, selections: null, live });
    if (input.editionDate !== startLocalDate) {
      return bindStory({ region, availability: "unavailable", input: null, selections: null, live });
    }
    return bindFallbackStory(region, input, live, regional);
  };
}

export async function loadAndBindStory(args: StoryLoadArgs & { live: Live }): Promise<StoryWire> {
  return (await prepareStory(args))(args.live);
}
