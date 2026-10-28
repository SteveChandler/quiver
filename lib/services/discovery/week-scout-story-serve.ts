import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
export { isWeekScoutStoryEnabled } from "@/lib/flags/week-scout-story";
import type { CanonicalWeekScoutResponse } from "./week-scout";
import { directionSector, periodBand } from "./week-scout-story-candidates";
import { activeStoryRegions, loadStoryInput, loadLatestStoryEdition } from "./week-scout-story-store";
import { assertStoryArtifactMatchesInput } from "./week-scout-story-validate";
import type { StoryGate, StoryInput, StoryWire } from "./week-scout-story-types";

type Client = SupabaseClient<Database>;
type Live = CanonicalWeekScoutResponse;
const CONFIDENCE = ["on_the_radar", "likely", "locked"];

function localDate(at: string, timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" })
    .format(new Date(at));
}

function matchedSwell(gate: Extract<StoryGate, { kind: "swell" }>, live: Live): NonNullable<Live["swells"]>[number] | null {
  return (live.swells ?? []).find((swell) => directionSector(swell.directionDeg) === gate.directionSector
    && periodBand(swell.periodS) === gate.periodBand
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

/** A selected sentence is served only when the live response still proves its gate. */
export function storyGateHolds(gate: StoryGate, live: Live): boolean {
  switch (gate.kind) {
    case "swell": return matchedSwell(gate, live) !== null;
    case "exposure": return (live.swells ?? []).some((swell) =>
      `${directionSector(swell.directionDeg)}-${periodBand(swell.periodS)}-${swell.peakLocalDate}` === gate.regionalEventKey
      && directionSector(swell.directionDeg) === gate.directionSector
      && swell.beaches.filter((beach) => beach.exposureLabel === gate.exposure).length >= gate.minimumBeaches);
    case "origin": return false; // No verified track lineage exists in today's swells[] contract.
    case "wind": return false; // Live windows lack a verified orientation class.
    case "tide": {
      const window = live.days.find((day) => day.localDate === gate.localDate)?.bestDayWindow;
      return Boolean(window && window.safe && window.verdict !== null && window.bucket === gate.bucket
        && window.forecast.freshnessAt === gate.forecastRevision && window.forecast.tidePhase === gate.tidePhase);
    }
    case "change": return false; // Comparable regional quality series is not in the live response yet.
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
  const chosen = input.copyFacts.filter((fact) => args.selections?.includes(fact.id));
  if (chosen.length !== args.selections.length || chosen.some((fact) => !storyGateHolds(fact.gate, live))) {
    return empty("unavailable");
  }
  const text = (slot: string): string | null => chosen.find((fact) => fact.slot === slot)?.text ?? null;
  if (!text("cover")) return empty("unavailable");
  return {
    schemaVersion: 3, region, availability: "ready", cover: { text: text("cover"), swells },
    lead: text("story:lead"), turn: text("story:turn"),
    chapters: chosen.filter((fact) => fact.slot.startsWith("swell:") || fact.slot.startsWith("day:")
      || fact.slot.startsWith("quiet:")).map((fact) => ({ slot: fact.slot, text: fact.text })),
    days,
  };
}

export async function loadAndBindStory(args: { client: Client; homeBeachId: string | null; live: Live; startLocalDate: string; now: Date }): Promise<StoryWire> {
  const { client, homeBeachId, live, startLocalDate, now } = args;
  if (!homeBeachId) return bindStory({ region: null, availability: "outside_region", input: null, selections: null, live });
  const { data: beach, error } = await client.from("beaches").select("region").eq("id", homeBeachId).maybeSingle();
  if (error) throw error;
  const region = beach?.region ?? null;
  if (!region) return bindStory({ region: null, availability: "outside_region", input: null, selections: null, live });
  const active = await activeStoryRegions(client);
  if (!active.some((entry) => entry.region === region)) {
    return bindStory({ region, availability: "outside_region", input: null, selections: null, live });
  }
  const edition = await loadLatestStoryEdition(client, region);
  if (!edition) return bindStory({ region, availability: "pending", input: null, selections: null, live });
  if (edition.schemaVersion !== 3 || edition.editionDate !== startLocalDate
    || Date.parse(edition.validUntil) < now.getTime() || Date.parse(edition.sourcePublishedAt) > now.getTime()) {
    return bindStory({ region, availability: "unavailable", input: null, selections: null, live });
  }
  const input = await loadStoryInput(client, edition.inputHash);
  if (!input) return bindStory({ region, availability: "unavailable", input: null, selections: null, live });
  try { assertStoryArtifactMatchesInput(edition, input, now); } catch {
    return bindStory({ region, availability: "unavailable", input: null, selections: null, live });
  }
  return bindStory({ region, availability: "ready", input, selections: edition.briefing.selections, live });
}
