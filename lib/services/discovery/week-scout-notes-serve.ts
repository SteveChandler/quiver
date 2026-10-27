import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";
import {
  getSwellBriefingPilotUserId,
  getSwellBriefingRegion,
  isSwellBriefingEnabled,
} from "@/lib/flags/swell-briefing";
import type { CanonicalWeekScoutResponse } from "./week-scout";
import { loadLatestBriefingEdition } from "./swell-briefing-store";
import {
  WEEK_SCOUT_NOTE_CONFIDENCE,
  WEEK_SCOUT_NOTES_KIND,
  type WeekScoutNoteGate,
  type WeekScoutNotesBriefing,
  type WeekScoutWireNote,
  type WeekScoutWireNotes,
} from "./swell-briefing-types";

type Client = SupabaseClient<Database>;
type LiveWeekScout = Pick<CanonicalWeekScoutResponse, "days" | "swells">;

/** Notes ride only on the briefing pilot's Week Scout. */
export function isWeekScoutNotesUser(userId: string): boolean {
  return isSwellBriefingEnabled() && userId === getSwellBriefingPilotUserId();
}

/**
 * The newest saved notes edition for the pilot, or null.
 *
 * Null for every failure and for an edition past `valid_until`. Notes are
 * additive: a Week Scout without them is exactly the one the app had before, so
 * a storage fault degrades the screen rather than failing the request.
 */
export async function loadWeekScoutNotesEdition(args: {
  client: Client;
  userId: string;
  now: Date;
}): Promise<WeekScoutNotesBriefing | null> {
  if (!isWeekScoutNotesUser(args.userId)) return null;
  try {
    const artifact = await loadLatestBriefingEdition(args.client, args.userId, getSwellBriefingRegion(), {
      kind: WEEK_SCOUT_NOTES_KIND,
    });
    if (artifact === null || artifact.schemaVersion !== 2) return null;
    const validUntil = Date.parse(artifact.validUntil);
    if (!Number.isFinite(validUntil) || validUntil < args.now.getTime()) return null;
    return artifact.briefing;
  } catch {
    return null;
  }
}

function confidenceRank(value: unknown): number {
  return WEEK_SCOUT_NOTE_CONFIDENCE.indexOf(value as (typeof WEEK_SCOUT_NOTE_CONFIDENCE)[number]);
}

/**
 * Whether the live scout still says what the note was written against.
 *
 * A day gate holds while that day's live pick is the same beach, verdict and
 * part of day. A swell gate holds while the swell is still listed and its
 * confidence has not dropped. A note with nothing to check, or a gate this code
 * cannot read, is withheld: nothing would confirm it is still true.
 */
export function gateHolds(gate: WeekScoutNoteGate | null | undefined, live: LiveWeekScout): boolean {
  const days = Array.isArray(gate?.days) ? gate.days : null;
  const swells = Array.isArray(gate?.swells) ? gate.swells : null;
  if (days === null || swells === null || days.length + swells.length === 0) return false;

  for (const expected of days) {
    const best = live.days.find((day) => day.localDate === expected?.localDate)?.bestDayWindow;
    if (
      !best
      || best.beachId !== expected.beachId
      || best.verdict !== expected.verdict
      || best.bucket !== expected.bucket
    ) {
      return false;
    }
  }
  for (const expected of swells) {
    const swell = (live.swells ?? []).find((candidate) => candidate.eventKey === expected?.eventKey);
    const floor = confidenceRank(expected?.confidence);
    if (!swell || floor < 0 || confidenceRank(swell.confidence) < floor) return false;
  }
  return true;
}

/**
 * The notes a reader is shown: those whose gates hold, as slot and text only.
 *
 * Age plays no part, and nothing about it is sent. The edition's validity
 * window is enforced when it is loaded; within it, a note is current exactly
 * when its gate still matches the live data.
 */
export function liveWeekScoutNotes(
  edition: WeekScoutNotesBriefing,
  live: LiveWeekScout,
): WeekScoutWireNotes | null {
  let headline: string | undefined;
  const notes: WeekScoutWireNote[] = [];
  for (const note of Array.isArray(edition.notes) ? edition.notes : []) {
    if (typeof note?.slot !== "string" || typeof note.text !== "string" || note.text.length === 0) continue;
    if (!gateHolds(note.gate, live)) continue;
    if (note.slot === "headline") {
      headline = note.text;
    } else if (note.slot.startsWith("day:") || note.slot.startsWith("swell:")) {
      notes.push({ slot: note.slot, text: note.text });
    }
  }
  if (headline === undefined && notes.length === 0) return null;
  return { ...(headline !== undefined ? { headline } : {}), ...(notes.length > 0 ? { notes } : {}) };
}
