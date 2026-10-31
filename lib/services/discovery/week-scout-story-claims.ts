import { COMPASS, WEEKDAY } from "./week-scout-story-candidates";
import type { StoryCandidate } from "./week-scout-story-types";

type WrittenSentenceRefusal =
  | "empty" | "too_long" | "digit" | "verdict_word" | "the_call" | "number" | "weekday" | "direction" | "beach" | "timing";
type WrittenSentenceCheck = { ok: true } | { ok: false; reason: WrittenSentenceRefusal };

/** The candidates' own limit (add() in week-scout-story-candidates). */
const MAX_LENGTH = 240;
/** Words a day leans on: "a week from Thursday" is not "Thursday", "peaked" is not "peaks". */
const TIME_QUALIFIERS = ["a week from", "next week", "earlier in the week", "later on", "peaked", "faded", "today", "tonight", "tomorrow"];
// Exactly native's narrativeText() refusal: uppercase whole words only, so "no wind" is fine.
const VERDICT_WORD = /\b(?:YES|MAYBE|NO)\b/;
const THE_CALL = /\bthe\s+call\b/i;
const NUMERAL = /\p{N}/u;
/** Spelled-out sizes: "eight feet", "six-foot", "twenty-two seconds". "One" stays prose ("the one to watch"). */
const SIZE_WORDS = ["two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen",
  "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen", "twenty", "feet", "foot", "ft", "seconds", "mph", "knots"];
/** COMPASS's abbreviations, index for index; read only as whole uppercase tokens. */
const COMPASS_ABBREVIATIONS = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
/** Each a prefix of its WEEKDAY; read only Capitalised or ALL-CAPS, so "the sun" and "we sat" stay prose. */
const WEEKDAY_ABBREVIATIONS = ["Sun", "Mon", "Tue", "Tues", "Wed", "Thu", "Thur", "Thurs", "Fri", "Sat"];

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

/** Whole case-sensitive tokens, longest first. */
function tokenPattern(tokens: readonly string[]): RegExp {
  const alternatives = [...tokens].sort((a, b) => b.length - a.length);
  return new RegExp(`(?<![\\p{L}\\p{N}])(${alternatives.join("|")})(?![\\p{L}\\p{N}])`, "gu");
}

const WEEKDAYS = phrasePattern(WEEKDAY, "s?")!;
// "westerly" and "southern" claim a direction too.
const DIRECTIONS = phrasePattern(COMPASS, "(?:erly|ern|wards?)?")!;
const TIMING = phrasePattern(TIME_QUALIFIERS)!;
const SIZES = phrasePattern(SIZE_WORDS)!;
const COMPASS_SHORT = tokenPattern(COMPASS_ABBREVIATIONS);
const WEEKDAY_SHORT = tokenPattern(WEEKDAY_ABBREVIATIONS.flatMap((short) => [short, short.toUpperCase()]));

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
  sizes: Set<string>;
}

/**
 * A beach's or region's name lends nothing: "North Beach" names a beach and "North Shore" a region,
 * not a north swell. Region names are only blanked out; naming one is no beach claim.
 */
function claimsIn(text: string, beaches: RegExp | null, regions: RegExp | null, abbreviations: boolean): Claims {
  const withoutBeaches = beaches ? text.replace(beaches, " ") : text;
  const rest = regions ? withoutBeaches.replace(regions, " ") : withoutBeaches;
  const weekdays = found(rest, WEEKDAYS);
  const directions = found(rest, DIRECTIONS);
  // A written sentence's "SSW" or "Fri" claims the full word; candidate text never abbreviates.
  if (abbreviations) {
    for (const match of rest.matchAll(COMPASS_SHORT)) directions.add(COMPASS[COMPASS_ABBREVIATIONS.indexOf(match[1])]);
    for (const match of rest.matchAll(WEEKDAY_SHORT)) {
      const short = match[1].toLowerCase();
      weekdays.add(WEEKDAY.find((day) => day.toLowerCase().startsWith(short))!.toLowerCase());
    }
  }
  return {
    beaches: beaches ? found(text, beaches) : new Set(),
    weekdays,
    directions,
    timing: found(rest, TIMING),
    sizes: found(rest, SIZES),
  };
}

function within(claims: Set<string>, allowed: Set<string>): boolean {
  return [...claims].every((claim) => allowed.has(claim));
}

/**
 * Whether a sentence written for a candidate claims nothing the candidate's own text doesn't: every
 * weekday, compass word and region beach it names appears in `fact.text`, it keeps every time
 * qualifier the fact has and adds none, and it carries no numerals, spelled-out sizes, verdict words or
 * "the call". Uppercase compass abbreviations and Capitalised or ALL-CAPS weekday abbreviations in the
 * sentence count as the full word.
 * `regionNames` are the names a fact may carry for its region (the cover's "reaches North Shore").
 */
export function checkWrittenSentence(text: string, fact: StoryCandidate, beachNames: readonly string[],
  regionNames: readonly string[] = []): WrittenSentenceCheck {
  const refuse = (reason: WrittenSentenceRefusal): WrittenSentenceCheck => ({ ok: false, reason });
  if (typeof text !== "string" || text.trim().length === 0) return refuse("empty");
  if (text.length > MAX_LENGTH) return refuse("too_long");
  if (NUMERAL.test(text)) return refuse("digit");
  if (VERDICT_WORD.test(text)) return refuse("verdict_word");
  if (THE_CALL.test(text)) return refuse("the_call");
  const beaches = phrasePattern(beachNames);
  const regions = phrasePattern(regionNames);
  const sentence = claimsIn(text, beaches, regions, true);
  const source = claimsIn(fact.text, beaches, regions, false);
  if (sentence.sizes.size > 0) return refuse("number");
  if (!within(sentence.weekdays, source.weekdays)) return refuse("weekday");
  if (!within(sentence.directions, source.directions)) return refuse("direction");
  if (!within(sentence.beaches, source.beaches)) return refuse("beach");
  if (!within(sentence.timing, source.timing) || !within(source.timing, sentence.timing)) return refuse("timing");
  return { ok: true };
}
