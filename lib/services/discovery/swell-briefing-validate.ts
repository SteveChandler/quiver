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

/** Clock skew tolerated between the worker's machine and this server. */
const GENERATION_CLOCK_SKEW_MS = 5 * 60 * 1000;

/**
 * Slots the worker always writes, whether or not candidates were offered.
 * Mirrors `merge_copy` in the worker: the headline is required and the today
 * call is set to the chosen candidate or cleared.
 */
const ALWAYS_WRITABLE_SLOTS: ReadonlySet<string> = new Set(["headline", "todayCall"]);

/**
 * Reads the copy in every slot a model could fill. Which slots it actually may
 * fill is decided against the issued candidates in `assertArtifactMatchesInput`.
 *
 * Week copy is the day's `caveat`, not its `label`: the label is the short
 * code-owned caption under the bar ("Building"), and the worker writes week
 * copy to `caveat`.
 */
function copyBySlot(briefing: SwellBriefing): Map<string, string | null> {
  const slots = new Map<string, string | null>();
  slots.set("headline", briefing.headline);
  slots.set("todayCall", briefing.today.call);
  for (const day of briefing.next48 ?? []) slots.set(`next48:${day.date}`, day.note);
  for (const day of briefing.week ?? []) slots.set(`week:${day.date}`, day.caveat);
  return slots;
}

/**
 * Rebuilds the issued briefing with the artifact's copy and generation time
 * substituted in. Everything else comes from the issued input.
 */
function withCopy(
  base: SwellBriefing,
  chosen: Map<string, string | null>,
  generatedAt: string,
): SwellBriefing {
  const pick = (slot: string, fallback: string | null): string | null =>
    chosen.has(slot) ? (chosen.get(slot) as string | null) : fallback;
  return {
    ...base,
    generatedAt,
    // A null headline is refused before this runs, so `pick` returns text here.
    headline: pick("headline", base.headline) as string,
    today: { ...base.today, call: pick("todayCall", base.today.call) },
    next48: (base.next48 ?? []).map((day) => ({ ...day, note: pick(`next48:${day.date}`, day.note) })),
    week: (base.week ?? []).map((day) => ({ ...day, caveat: pick(`week:${day.date}`, day.caveat) })),
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
 * ISO 8601 with a time and an explicit zone: `Z` or `+HH:MM`. `Date.parse` alone
 * also accepts RFC 2822 and zone-less forms, and a zone-less string is read in
 * the server's own timezone - so the bound check and the time a reader is shown
 * could disagree. Python's `isoformat()` on an aware datetime always matches.
 */
const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,9})?(Z|[+-]\d{2}:\d{2})$/;

/**
 * Timestamp failures share one status so the worker, which logs only the HTTP
 * status and never the body, can tell a clock or stamping problem apart from a
 * tampered artifact (400) or a policy refusal (403).
 */
const TIMESTAMP_STATUS = 422;

function serverInstant(value: string): number {
  const parsed = Date.parse(value);
  // These come from the input this server issued. If one is unreadable the
  // bounds below cannot be enforced, so refuse rather than quietly skip them.
  if (!Number.isFinite(parsed)) throw new BriefingValidationError("input_timestamps_invalid", 500);
  return parsed;
}

/**
 * The generation time is the worker's, because it is the moment the edition
 * was actually written - the footer reads "Updated" from it. It is bounded so
 * it cannot be used to misrepresent the edition: not before the input it was
 * built from was issued, not in the future, and not after that input expired.
 *
 * The lower bound is the input's first issue time, and that is deliberately not
 * tightened to "near now". The worker retries a cached artifact without
 * regenerating it, so an edition written at 05:30 whose upload failed is
 * legitimately sent at 09:00 when the machine wakes. Nothing about freshness
 * rests on this value either: serving computes freshness from `dataAt`, which
 * stays the server's, so a backdated "Updated" cannot make old data look new.
 */
function assertGeneratedAt(
  value: unknown,
  input: SwellBriefingInputSnapshot,
  now: Date,
): string {
  if (typeof value !== "string" || !ISO_INSTANT.test(value)) {
    throw new BriefingValidationError("generated_at_invalid", TIMESTAMP_STATUS);
  }
  const generated = Date.parse(value);
  if (!Number.isFinite(generated)) {
    throw new BriefingValidationError("generated_at_invalid", TIMESTAMP_STATUS);
  }

  if (generated < serverInstant(input.briefing.generatedAt) - GENERATION_CLOCK_SKEW_MS) {
    throw new BriefingValidationError("generated_before_input", TIMESTAMP_STATUS);
  }
  if (generated > now.getTime() + GENERATION_CLOCK_SKEW_MS) {
    throw new BriefingValidationError("generated_in_future", TIMESTAMP_STATUS);
  }
  if (generated > serverInstant(input.validUntil)) {
    throw new BriefingValidationError("generated_after_expiry", TIMESTAMP_STATUS);
  }
  return value;
}

/**
 * The uploaded briefing is attacker-shaped until proven otherwise: reading
 * `today.exposures` off a string or null throws a TypeError, which would leave
 * the route as a 500 when it is really a bad request.
 */
function assertBriefingShape(value: unknown): asserts value is SwellBriefing {
  const briefing = value as Partial<SwellBriefing> | null;
  if (briefing === null || typeof briefing !== "object" || Array.isArray(briefing)) {
    throw new BriefingValidationError("briefing_malformed");
  }
  const today = briefing.today as Partial<SwellBriefing["today"]> | undefined;
  if (today === null || typeof today !== "object" || Array.isArray(today)) {
    throw new BriefingValidationError("briefing_malformed");
  }
  for (const [key, list] of [
    ["today.exposures", today?.exposures],
    ["next48", briefing.next48],
    ["week", briefing.week],
    ["advisories", briefing.advisories],
  ] as const) {
    if (list !== undefined && !Array.isArray(list)) {
      throw new BriefingValidationError(`briefing_malformed:${key}`);
    }
  }
}

/**
 * Confirms an uploaded artifact is the issued input with nothing but permitted
 * copy and the generation time changed.
 *
 * The check is positional rather than field-by-field: take the saved briefing,
 * substitute the artifact's copy and generation time, and require the result to
 * be byte-identical to what was uploaded. Any edit anywhere else - a surf
 * height, a date, a beach id, `dataAt`, an added advisory - changes the
 * canonical form and is rejected, without this code enumerating every field.
 *
 * Copy follows the worker's own rule. The headline and today call are always
 * the model's. A `next48`/`week` slot is the model's only when the server
 * offered candidates for it; otherwise it is backend copy and must come back
 * exactly as issued, neither rewritten nor cleared.
 */
export function assertArtifactMatchesInput(
  artifact: SwellBriefingArtifact,
  input: SwellBriefingInputSnapshot,
  now: Date = new Date(),
): void {
  assertBriefingShape(artifact.briefing);
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
  if (input.provenance?.fixture === true) throw new BriefingValidationError("fixture_not_publishable", 403);

  const generatedAt = assertGeneratedAt(artifact.briefing.generatedAt, input, now);

  const facts = input.copyFacts ?? [];
  const chosen = copyBySlot(artifact.briefing);
  const issued = copyBySlot(input.briefing);

  for (const [slot, value] of chosen) {
    // The model may not invent a slot that the issued edition does not have.
    if (!issued.has(slot)) throw new BriefingValidationError("unknown_copy_slot");
    // Unchanged copy is always fine.
    if (value === issued.get(slot)) continue;

    const offered = allowedTexts(facts, slot);
    if (!ALWAYS_WRITABLE_SLOTS.has(slot) && offered.size === 0) {
      // Backend copy for a slot with no candidates is not the model's to touch.
      throw new BriefingValidationError("copy_slot_not_writable");
    }
    if (value === null) {
      // The model chose nothing for a slot it may fill, so it is cleared - but
      // an edition always has a headline.
      if (slot === "headline") throw new BriefingValidationError("headline_missing");
      continue;
    }
    if (typeof value !== "string") throw new BriefingValidationError("copy_not_text");
    if (value.length > MAX_BRIEFING_COPY_LENGTH) throw new BriefingValidationError("copy_too_long");
    // Changed copy must be one of the candidates offered for that slot, exactly.
    if (!offered.has(value)) throw new BriefingValidationError("copy_not_offered");
  }

  const expected = withCopy(input.briefing, chosen, generatedAt);
  if (canonicalJson(expected) !== canonicalJson(artifact.briefing)) {
    throw new BriefingValidationError("briefing_values_altered");
  }

  assertBeachIdsAreUuids(artifact.briefing);
}
