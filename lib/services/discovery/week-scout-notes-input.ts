import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";
import { driveRadiusMiles } from "@/lib/profile/drive-range";
import { parseSessionTime } from "@/lib/scoring/session-time-preference";
import { generateWeekScoutForecast, type CanonicalWeekScoutResponse } from "./week-scout";
import { buildDriveRangeCandidatePool } from "./weekend-scout-candidate-pool";
import {
  getWeekScoutLocation,
  INTERACTIVE_LOCATION_MAX_AGE_MS,
  resolveWeekScoutScopeAnchor,
} from "./week-scout-scope";
import { briefingInputHash, canonicalJson, sha256Hex } from "./swell-briefing-hash";
import {
  BRIEFING_REGIONS,
  BriefingInputError,
  addDays,
  localDate,
  zonedWallClockToUtc,
} from "./swell-briefing-input";
import { loadLatestBriefingInput, saveBriefingInput } from "./swell-briefing-store";
import {
  MAX_BRIEFING_COPY_FACTS,
  WEEK_SCOUT_NOTES_KIND,
  type WeekScoutDayGate,
  type WeekScoutNoteBucket,
  type WeekScoutNoteCopyFact,
  type WeekScoutNoteGate,
  type WeekScoutNotesInputSnapshot,
  type WeekScoutSwellGate,
} from "./swell-briefing-types";

type Client = SupabaseClient<Database>;
type WeekScoutDayResponse = CanonicalWeekScoutResponse["days"][number];

/** Bumped when the candidates or their gates change shape, invalidating deduplication. */
const WEEK_SCOUT_NOTES_INPUT_VERSION = "notes-1";

/** Matches the 10-day Week Scout the app requests. */
const NOTES_DAY_COUNT = 10;
/** The headline speaks for the week proper; days 8-10 are an early look. */
const HEADLINE_DAY_COUNT = 7;

/**
 * Copy carries no numbers. Heights, periods and times move between forecast
 * runs and the app already prints them from live data; a sentence that
 * repeated one would go stale without its gate noticing.
 */
const DIGIT = /\d/;

const WHEN: Record<WeekScoutNoteBucket, string> = {
  morning: "in the morning",
  midday: "around midday",
  evening: "in the evening",
};

const WEEKDAY = new Intl.DateTimeFormat("en-US", { weekday: "long", timeZone: "UTC" });

function weekday(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  return WEEKDAY.format(new Date(Date.UTC(year, month - 1, day)));
}

function dayGate(day: WeekScoutDayResponse): WeekScoutDayGate | null {
  const best = day.bestDayWindow;
  // A held window carries no verdict, so there is no call for a note to describe.
  if (!best || best.verdict === null) return null;
  return { localDate: day.localDate, beachId: best.beachId, verdict: best.verdict, bucket: best.bucket };
}

function gateOf(days: WeekScoutDayGate[], swells: WeekScoutSwellGate[] = []): WeekScoutNoteGate {
  return { days, swells };
}

/** A beach name is only used when it is itself number-free ("15th Street" is not). */
function nameFor(names: ReadonlyMap<string, string>, beachId: string): string | null {
  const name = names.get(beachId)?.trim();
  return name && !DIGIT.test(name) ? name : null;
}

function dayFacts(day: WeekScoutDayResponse, gate: WeekScoutDayGate, name: string | null): WeekScoutNoteCopyFact[] {
  const slot = `day:${day.localDate}`;
  const when = WHEN[gate.bucket];
  const texts: string[] = [];
  if (gate.verdict === "worth_it") {
    if (name) texts.push(`${name} ${when} looks worth it.`);
    texts.push(`Worth it ${when}.`);
  } else if (gate.verdict === "maybe") {
    if (name) texts.push(`${name} ${when} is a maybe.`);
    texts.push("A maybe. Check it before you commit.");
  } else {
    texts.push("Not one to plan around.");
  }
  // Days past the first week are ranked but carry no session pick; say so.
  const hedged = day.earlyLook ? texts.map((text) => `Early look. ${text}`) : texts;
  return hedged.map((text, index) => ({ id: `day-${day.localDate}-${index}`, slot, text, gate: gateOf([gate]) }));
}

const SWELL_TEXTS: Record<WeekScoutSwellGate["confidence"], string[]> = {
  locked: ["Locked in. Plan around it.", "The forecast has settled on this one."],
  likely: ["Likely, and still firming up.", "Looking likely. Worth watching."],
  on_the_radar: ["On the radar. Too early to plan around.", "Early days for this one."],
};

/**
 * Every candidate the model may choose between, each with the gate it rests
 * on. Serving withholds a note whose gate no longer matches the live response,
 * so a candidate only claims what its gate pins down: a day note names the
 * day's pick (beach, verdict, part of day), a swell note its confidence, and a
 * headline the days or swell it is about.
 */
export function buildWeekScoutNoteFacts(
  forecast: Pick<CanonicalWeekScoutResponse, "days" | "swells">,
  beachNames: ReadonlyMap<string, string>,
): WeekScoutNoteCopyFact[] {
  const headlines: WeekScoutNoteCopyFact[] = [];
  const notes: WeekScoutNoteCopyFact[] = [];

  const picks: Array<{ day: WeekScoutDayResponse; gate: WeekScoutDayGate }> = [];
  for (const day of forecast.days.slice(0, NOTES_DAY_COUNT)) {
    const gate = dayGate(day);
    if (!gate) continue;
    picks.push({ day, gate });
    notes.push(...dayFacts(day, gate, nameFor(beachNames, gate.beachId)));
  }

  (forecast.swells ?? []).forEach((swell, index) => {
    const gate: WeekScoutSwellGate = { eventKey: swell.eventKey, confidence: swell.confidence };
    for (const [variant, text] of (SWELL_TEXTS[swell.confidence] ?? []).entries()) {
      notes.push({ id: `swell-${index}-${variant}`, slot: `swell:${swell.eventKey}`, text, gate: gateOf([], [gate]) });
    }
  });

  const week = picks.filter(({ day }) => !day.earlyLook).slice(0, HEADLINE_DAY_COUNT);
  const worth = week.filter(({ gate }) => gate.verdict === "worth_it");
  const maybe = week.filter(({ gate }) => gate.verdict === "maybe");
  if (worth.length > 0) {
    const [first] = worth;
    headlines.push({
      id: "headline-worth",
      slot: "headline",
      text: `${weekday(first.day.localDate)} looks worth it.`,
      gate: gateOf([first.gate]),
    });
    const name = nameFor(beachNames, first.gate.beachId);
    if (name) {
      headlines.push({
        id: "headline-worth-beach",
        slot: "headline",
        text: `${weekday(first.day.localDate)} at ${name} looks like the call.`,
        gate: gateOf([first.gate]),
      });
    }
  }
  if (worth.length > 1) {
    const [first, second] = worth;
    headlines.push({
      id: "headline-worth-two",
      slot: "headline",
      text: `${weekday(first.day.localDate)} and ${weekday(second.day.localDate)} both look worth it.`,
      gate: gateOf([first.gate, second.gate]),
    });
  }
  if (worth.length === 0 && maybe.length > 0) {
    headlines.push({
      id: "headline-maybe",
      slot: "headline",
      text: `Maybe on ${weekday(maybe[0].day.localDate)}. Check before you go.`,
      gate: gateOf([maybe[0].gate]),
    });
  }
  const locked = (forecast.swells ?? []).find((swell) => swell.confidence === "locked");
  if (locked) {
    headlines.push({
      id: "headline-swell-locked",
      slot: "headline",
      text: "A swell is locked in.",
      gate: gateOf([], [{ eventKey: locked.eventKey, confidence: locked.confidence }]),
    });
  }

  const facts = [...headlines, ...notes].slice(0, MAX_BRIEFING_COPY_FACTS);
  for (const fact of facts) {
    // A digit here is a bug in the templates above, not bad data; refuse to issue it.
    if (DIGIT.test(fact.text)) throw new BriefingInputError("note_candidate_has_number", 500);
  }
  return facts;
}

/** Candidates and gates are the whole content of an input; nothing time-varying goes in. */
function notesRevision(editionDate: string, copyFacts: WeekScoutNoteCopyFact[]): string {
  return sha256Hex(canonicalJson({ editionDate, copyFacts, version: WEEK_SCOUT_NOTES_INPUT_VERSION }));
}

interface PilotProfile {
  home_beach_id: string | null;
  max_drive_minutes: number | null;
  preferred_session_time: string | null;
  experience_level: string | null;
}

/**
 * The Week Scout the app would show the pilot, built the way the route builds a
 * complete-radius scout: the same profile, the same anchor (a fresh phone fix,
 * else the home break), the same drive-range pool and the same ranking. Gates
 * are checked against the live route's answer, so a scout built any other way
 * would only produce notes that never survive serving.
 */
async function pilotWeekScout(
  client: Client,
  userId: string,
  timezone: string,
  editionDate: string,
): Promise<{ forecast: CanonicalWeekScoutResponse; beachNames: Map<string, string> }> {
  const { data: profileRow, error: profileError } = await client
    .from("profiles")
    .select("home_beach_id, max_drive_minutes, preferred_session_time, experience_level")
    .eq("id", userId)
    .maybeSingle();
  if (profileError) throw new BriefingInputError("profile_read_failed");
  const profile = (profileRow ?? null) as PilotProfile | null;

  const { data: snapshot } = await client
    .from("user_location_snapshots")
    .select("lat, lon, captured_at")
    .eq("user_id", userId)
    .maybeSingle();
  const location = getWeekScoutLocation(snapshot ?? null, Date.now(), INTERACTIVE_LOCATION_MAX_AGE_MS);

  const homeBeachId = profile?.home_beach_id ?? null;
  const resolved = await resolveWeekScoutScopeAnchor(client, null, location, homeBeachId);
  if (!resolved) throw new BriefingInputError("pilot_has_no_anchor", 409);

  const pool = await buildDriveRangeCandidatePool(userId, {
    anchor: resolved.anchor,
    homeBeachId,
    maxDriveMinutes: profile?.max_drive_minutes ?? null,
    experienceLevel: profile?.experience_level ?? null,
  });
  if (pool.candidates.length === 0) throw new BriefingInputError("pilot_pool_empty", 409);

  const sessionTime = parseSessionTime(profile?.preferred_session_time);
  const forecast = await generateWeekScoutForecast(userId, {
    candidateBeachIds: pool.candidates.map((candidate) => candidate.beach.id),
    localTimezone: timezone,
    startLocalDate: editionDate,
    dayCount: NOTES_DAY_COUNT,
    userLocation: resolved.anchor,
    driveRadiusMiles: driveRadiusMiles(profile?.max_drive_minutes),
    requirePerRowFreshness: true,
    includeSwells: true,
    ...(sessionTime ? { sessionTime } : {}),
  });
  const beachNames = new Map(pool.candidates.map((candidate) => [candidate.beach.id, candidate.beach.name]));
  return { forecast, beachNames };
}

/**
 * Issues the v2 input: number-free Week Scout note candidates for the pilot,
 * each carrying its gate. Saved before it is returned, like the Outlook input,
 * so an upload can only be checked against a snapshot this server issued; and
 * reissued unchanged when the candidates have not moved, so the worker's
 * deduplication holds across a refetch.
 */
export async function buildWeekScoutNotesInput(args: {
  client: Client;
  userId: string;
  regionSlug: string;
  now: Date;
}): Promise<WeekScoutNotesInputSnapshot> {
  const region = BRIEFING_REGIONS[args.regionSlug];
  if (!region) throw new BriefingInputError("unknown_region", 400);

  const { client, userId, now } = args;
  const editionDate = localDate(now, region.timezone);
  const { forecast, beachNames } = await pilotWeekScout(client, userId, region.timezone, editionDate);

  const copyFacts = buildWeekScoutNoteFacts(forecast, beachNames);
  if (copyFacts.length === 0) throw new BriefingInputError("no_note_candidates", 409);

  const revision = notesRevision(editionDate, copyFacts);
  const existing = await loadLatestBriefingInput(client, userId, region.slug, editionDate, 2);
  if (existing?.schemaVersion === 2 && existing.provenance?.sourceHashes?.[0] === revision) return existing;

  const snapshot: WeekScoutNotesInputSnapshot = {
    schemaVersion: 2,
    userId,
    region: region.slug,
    editionDate,
    // The notes rest on this ranking, so its time is the source time. It is
    // also never older than an Outlook edition already saved for the day,
    // which the publish function's no-older-source rule would otherwise refuse.
    sourcePublishedAt: new Date(Date.parse(forecast.generatedAt) || now.getTime()).toISOString(),
    validUntil: zonedWallClockToUtc(addDays(editionDate, 1), "23:59:59.000", region.timezone),
    briefing: {
      schemaVersion: 2,
      kind: WEEK_SCOUT_NOTES_KIND,
      editionDate,
      generatedAt: now.toISOString(),
      notes: [],
    },
    copyFacts,
    provenance: {
      sourceIds: [`week_scout:${region.slug}:${editionDate}`],
      sourceHashes: [revision],
      generationInputVersion: WEEK_SCOUT_NOTES_INPUT_VERSION,
    },
    inputHash: "",
  };
  snapshot.inputHash = briefingInputHash(snapshot as unknown as Record<string, unknown>);

  await saveBriefingInput(client, snapshot);
  return snapshot;
}
