import { canonicalJson } from "./swell-briefing-hash";
import {
  MAX_BRIEFING_COPY_LENGTH,
  type BriefingCopyFact,
  type SwellBriefing,
  type SwellBriefingArtifact,
  type SwellBriefingInputSnapshot,
} from "./swell-briefing-types";

export class BriefingValidationError extends Error {
  readonly status: number;

  constructor(code: string, status = 400) {
    super(code);
    this.name = "BriefingValidationError";
    this.status = status;
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Every beach the edition names, in one list. The native app opens Beach Detail
 * from these, so a non-UUID id produces a blank hero and a "Failed to load
 * beach" screen rather than a visible error at publish time.
 */
function beachIds(briefing: SwellBriefing): string[] {
  const ids: string[] = [];
  if (briefing.photo) ids.push(briefing.photo.beachId);
  for (const exposure of briefing.today.exposures ?? []) {
    if (exposure.beach) ids.push(exposure.beach.id);
  }
  for (const day of briefing.week ?? []) {
    if (day.beach) ids.push(day.beach.id);
  }
  for (const advisory of briefing.advisories ?? []) {
    if (advisory.beach) ids.push(advisory.beach.id);
  }
  return ids;
}

export function assertBeachIdsAreUuids(briefing: SwellBriefing): void {
  for (const id of beachIds(briefing)) {
    if (!UUID.test(id)) throw new BriefingValidationError("beach_id_not_uuid");
  }
}

/**
 * Reads the copy the artifact chose for each slot the model is allowed to fill.
 * Everything not listed here is code-owned and must survive generation
 * untouched.
 */
function copyBySlot(briefing: SwellBriefing): Map<string, string | null> {
  const slots = new Map<string, string | null>();
  slots.set("headline", briefing.headline);
  slots.set("todayCall", briefing.today.call);
  for (const day of briefing.next48 ?? []) slots.set(`next48:${day.date}`, day.note);
  for (const day of briefing.week ?? []) slots.set(`week:${day.date}`, day.label);
  return slots;
}

/** Rebuilds the issued briefing with the artifact's chosen copy substituted in. */
function withCopy(base: SwellBriefing, chosen: Map<string, string | null>): SwellBriefing {
  return {
    ...base,
    headline: chosen.get("headline") ?? base.headline,
    today: { ...base.today, call: chosen.has("todayCall") ? chosen.get("todayCall")! : base.today.call },
    next48: (base.next48 ?? []).map((day) => {
      const slot = `next48:${day.date}`;
      return chosen.has(slot) ? { ...day, note: chosen.get(slot)! } : day;
    }),
    week: (base.week ?? []).map((day) => {
      const slot = `week:${day.date}`;
      const value = chosen.get(slot);
      return chosen.has(slot) && typeof value === "string" ? { ...day, label: value } : day;
    }),
  };
}

function allowedTexts(facts: BriefingCopyFact[], slot: string): Set<string> {
  const texts = new Set<string>();
  for (const fact of facts) {
    if (fact.slot === slot) texts.add(fact.text);
  }
  return texts;
}

/**
 * Confirms an uploaded artifact is the issued input with nothing but permitted
 * copy changed.
 *
 * The check is positional rather than field-by-field: take the saved briefing,
 * substitute the artifact's copy for the slots the model may fill, and require
 * the result to be byte-identical to what was uploaded. Any edit anywhere else
 * — a surf height, a date, a beach id, an added advisory — changes the canonical
 * form and is rejected, without this code needing to enumerate every field.
 */
export function assertArtifactMatchesInput(
  artifact: SwellBriefingArtifact,
  input: SwellBriefingInputSnapshot,
): void {
  if (artifact.userId !== input.userId) throw new BriefingValidationError("user_mismatch", 403);
  if (artifact.region !== input.region) throw new BriefingValidationError("region_mismatch");
  if (artifact.editionDate !== input.editionDate) throw new BriefingValidationError("edition_date_mismatch");
  if (artifact.inputHash !== input.inputHash) throw new BriefingValidationError("input_hash_mismatch");

  // The dates behind the edition are the server's, not the worker's. Re-running
  // the model must never make an old source look fresh.
  if (artifact.sourcePublishedAt !== input.sourcePublishedAt) {
    throw new BriefingValidationError("source_published_at_mismatch");
  }
  if (artifact.validUntil !== input.validUntil) throw new BriefingValidationError("valid_until_mismatch");

  // A snapshot built from a development fixture is never publishable.
  if (input.provenance?.fixture === true) throw new BriefingValidationError("fixture_not_publishable", 422);

  const chosen = copyBySlot(artifact.briefing);
  const issued = copyBySlot(input.briefing);

  for (const [slot, value] of chosen) {
    // The model may not invent a slot that the issued edition does not have.
    if (!issued.has(slot)) throw new BriefingValidationError("unknown_copy_slot");
    if (value === null) continue;
    if (typeof value !== "string") throw new BriefingValidationError("copy_not_text");
    if (value.length > MAX_BRIEFING_COPY_LENGTH) throw new BriefingValidationError("copy_too_long");

    // Unchanged copy is always fine; changed copy must be one of the candidates
    // the server supplied, copied exactly.
    if (value === issued.get(slot)) continue;
    if (!allowedTexts(input.copyFacts ?? [], slot).has(value)) {
      throw new BriefingValidationError("copy_not_offered");
    }
  }

  const expected = withCopy(input.briefing, chosen);
  if (canonicalJson(expected) !== canonicalJson(artifact.briefing)) {
    throw new BriefingValidationError("briefing_values_altered");
  }

  assertBeachIdsAreUuids(artifact.briefing);
}
