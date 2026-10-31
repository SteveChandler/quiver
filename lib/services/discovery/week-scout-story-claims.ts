import { COMPASS, WEEKDAY } from "./week-scout-story-candidates";
import type { StoryCandidate } from "./week-scout-story-types";

type WrittenSentenceRefusal =
  | "empty" | "too_long" | "digit" | "verdict_word" | "the_call" | "weekday" | "direction" | "beach" | "timing";
type WrittenSentenceCheck = { ok: true } | { ok: false; reason: WrittenSentenceRefusal };

/** The candidates' own limit (add() in week-scout-story-candidates). */
const MAX_LENGTH = 240;
/** Words a day leans on: "a week from Thursday" is not "Thursday", "peaked" is not "peaks". */
const TIME_QUALIFIERS = ["a week from", "next week", "earlier in the week", "later on", "peaked", "faded", "today", "tonight", "tomorrow"];
// Exactly native's narrativeText() refusal: uppercase whole words only, so "no wind" is fine.
const VERDICT_WORD = /\b(?:YES|MAYBE|NO)\b/;
const THE_CALL = /\bthe\s+call\b/i;
const NUMERAL = /\p{N}/u;

/**
 * Whole phrases, longest first so "south-southwest" is one claim, not "south" and "southwest".
 * Case- and spacing-insensitive; capture group 1 is the phrase without `suffix`.
 */
function phrasePattern(phrases: readonly string[], suffix = ""): RegExp | null {
  const alternatives = [...new Set(phrases.map((phrase) => phrase.trim().toLowerCase()).filter(Boolean))]
    .sort((a, b) => b.length - a.length)
    .map((phrase) => phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+").replace(/['’]/g, "['’]?"));
  if (alternatives.length === 0) return null;
  return new RegExp(`(?<![\\p{L}\\p{N}])(${alternatives.join("|")})${suffix}(?![\\p{L}\\p{N}])`, "giu");
}

const WEEKDAYS = phrasePattern(WEEKDAY, "s?")!;
// "westerly" and "southern" claim a direction too.
const DIRECTIONS = phrasePattern(COMPASS, "(?:erly|ern|wards?)?")!;
const TIMING = phrasePattern(TIME_QUALIFIERS)!;

function canonical(phrase: string): string {
  return phrase.toLowerCase().replace(/\s+/g, " ").replace(/['’]/g, "");
}

function found(text: string, pattern: RegExp): Set<string> {
  return new Set([...text.matchAll(pattern)].map((match) => canonical(match[1])));
}

interface Claims {
  beaches: Set<string>;
  weekdays: Set<string>;
  directions: Set<string>;
  timing: Set<string>;
}

/** A beach's name lends nothing: "North Beach" names a beach, not a north swell. */
function claimsIn(text: string, beaches: RegExp | null): Claims {
  const rest = beaches ? text.replace(beaches, " ") : text;
  return {
    beaches: beaches ? found(text, beaches) : new Set(),
    weekdays: found(rest, WEEKDAYS),
    directions: found(rest, DIRECTIONS),
    timing: found(rest, TIMING),
  };
}

function within(claims: Set<string>, allowed: Set<string>): boolean {
  return [...claims].every((claim) => allowed.has(claim));
}

/**
 * Whether a sentence written for a candidate claims nothing the candidate's own text doesn't: every
 * weekday, compass word and region beach it names appears in `fact.text`, it keeps every time
 * qualifier the fact has and adds none, and it carries no numerals, verdict words or "the call".
 */
export function checkWrittenSentence(text: string, fact: StoryCandidate, beachNames: readonly string[]): WrittenSentenceCheck {
  const refuse = (reason: WrittenSentenceRefusal): WrittenSentenceCheck => ({ ok: false, reason });
  if (typeof text !== "string" || text.trim().length === 0) return refuse("empty");
  if (text.length > MAX_LENGTH) return refuse("too_long");
  if (NUMERAL.test(text)) return refuse("digit");
  if (VERDICT_WORD.test(text)) return refuse("verdict_word");
  if (THE_CALL.test(text)) return refuse("the_call");
  const beaches = phrasePattern(beachNames);
  const sentence = claimsIn(text, beaches);
  const source = claimsIn(fact.text, beaches);
  if (!within(sentence.weekdays, source.weekdays)) return refuse("weekday");
  if (!within(sentence.directions, source.directions)) return refuse("direction");
  if (!within(sentence.beaches, source.beaches)) return refuse("beach");
  if (!within(sentence.timing, source.timing) || !within(source.timing, sentence.timing)) return refuse("timing");
  return { ok: true };
}
