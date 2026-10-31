import { COMPASS, WEEKDAY } from "./week-scout-story-candidates";
import type { StoryCandidate } from "./week-scout-story-types";

// Every rule below is data: the PC worker mirrors these lists to check a sentence before it sends it.

/**
 * Closed content-word sets: a written sentence may use a word from one only when its candidate's text
 * uses it, so a rewrite can't swap a claim for its opposite. Each entry is one claim: its canonical
 * form first, then other forms that make the same claim ("stormy" is "storm", "the wind is up" is "windy").
 * The refusal reason is the set's name.
 */
export const CLOSED_WORD_SETS = {
  wind: [["offshore", "offshores"], ["onshore", "onshores"]],
  comparison: [["better"], ["worse"]],
  tide: [["low"], ["high"], ["rising"], ["falling"]],
  period: [["long-period"], ["mid-period"], ["short-period"], ["groundswell", "groundswells"], ["windswell", "windswells"],
    ["storm", "stormy", "storms"]],
  exposure: [["sheltered", "shelter", "shelters", "sheltering"], ["shadow", "shadowed", "shadows"], ["partly", "partially"],
    ["faces", "face", "facing", "faced"], ["head on"], ["straight on"], ["dead on"], ["at an angle", "angled"]],
  wind_strength: [["light"], ["glassy"], ["calm"], ["breezy"], ["windy", "wind is up", "wind's up"]],
} as const satisfies Record<string, ReadonlyArray<readonly string[]>>;
type ClosedWordClass = keyof typeof CLOSED_WORD_SETS;

/** Words a day leans on, kept exactly: a sentence keeps every one its candidate has and adds none ("peaked" is not "peaks"). */
export const TIME_QUALIFIERS = ["a week from", "next week", "earlier in the week", "later on", "peaked", "faded", "today", "tonight", "tomorrow"];
/** One claim each, read before bare weekdays: "a week from Saturday" is neither "Saturday" nor "a week from Thursday". */
export const WEEK_FROM_DAYS = ["a week from today", ...WEEKDAY.map((day) => `a week from ${day}`)];
/** Relative days and times of day: a sentence may use one only when its candidate does (plurals count). */
export const RELATIVE_TIME_WORDS = ["same day", "next day", "day after", "weekend", "overnight", "midweek", "morning", "midday",
  "afternoon", "evening", "night"];
/** Spelled-out numbers and units ("eight feet", "six-foot", "twenty-two seconds"). "One" stays prose ("the one to watch"). */
export const NUMBER_WORDS = ["two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen",
  "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen", "twenty", "thirty", "forty", "fifty", "sixty", "seventy",
  "eighty", "ninety", "hundred", "hundreds", "dozen", "dozens", "half", "feet", "foot", "ft", "seconds", "mph", "knots", "meter",
  "meters", "metre", "metres", "inch", "inches"];
/**
 * Size words no candidate uses: the card's data line owns size, so a sentence never names one. Relative
 * words ("biggest Thursday" for the peak) stay prose.
 */
export const SIZE_ADJECTIVES = ["knee-high", "waist-high", "chest-high", "shoulder-high", "head-high", "overhead", "double overhead",
  "big", "huge", "pumping", "flat"];
/** COMPASS's abbreviations, index for index; read only as whole uppercase tokens, so lowercase "ssw" stays prose. */
export const COMPASS_ABBREVIATIONS = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
/** Each a prefix of its WEEKDAY; read only Capitalised or ALL-CAPS, so "the sun" and "we sat" stay prose. */
export const WEEKDAY_ABBREVIATIONS = ["Sun", "Mon", "Tue", "Tues", "Wed", "Thu", "Thur", "Thurs", "Fri", "Sat"];

type WrittenSentenceRefusal =
  | "empty" | "too_long" | "digit" | "verdict_word" | "the_call" | "number" | "size" | "weekday" | "weekday_order"
  | "direction" | "beach" | "timing" | ClosedWordClass;
type WrittenSentenceCheck = { ok: true } | { ok: false; reason: WrittenSentenceRefusal };

/** The candidates' own limit (add() in week-scout-story-candidates). */
const MAX_LENGTH = 240;
// Exactly native's narrativeText() refusal: uppercase whole words only, so "no wind" is fine.
const VERDICT_WORD = /\b(?:YES|MAYBE|NO)\b/;
const THE_CALL = /\bthe\s+call\b/i;
const NUMERAL = /\p{N}/u;

/**
 * Whole phrases, longest first so "south-southwest" is one claim, not "south" and "southwest".
 * Case-insensitive; spaces and hyphens match each other ("head-on" is "head on"). Capture group 1 is
 * the phrase without `suffix`.
 */
function phrasePattern(phrases: readonly string[], suffix = ""): RegExp | null {
  const alternatives = [...new Set(phrases.map((phrase) => phrase.trim().toLowerCase()).filter(Boolean))]
    .sort((a, b) => b.length - a.length)
    .map((phrase) => phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/[\s-]+/g, "[\\s-]+").replace(/['’]/g, "['’]?"));
  if (alternatives.length === 0) return null;
  return new RegExp(`(?<![\\p{L}\\p{N}])(${alternatives.join("|")})${suffix}(?![\\p{L}\\p{N}])`, "giu");
}

/** Whole case-sensitive tokens, longest first. */
function tokenPattern(tokens: readonly string[]): RegExp {
  const alternatives = [...tokens].sort((a, b) => b.length - a.length);
  return new RegExp(`(?<![\\p{L}\\p{N}])(${alternatives.join("|")})(?![\\p{L}\\p{N}])`, "gu");
}

function canonical(phrase: string): string {
  return phrase.toLowerCase().replace(/[\s-]+/g, " ").replace(/['’]/g, "");
}

const WEEKDAYS = phrasePattern(WEEKDAY, "s?")!;
const WEEK_FROM = phrasePattern(WEEK_FROM_DAYS)!;
// "westerly" and "southern" claim a direction too.
const DIRECTIONS = phrasePattern(COMPASS, "(?:erly|ern|wards?)?")!;
const TIMING = phrasePattern(TIME_QUALIFIERS)!;
const RELATIVE_TIME = phrasePattern(RELATIVE_TIME_WORDS, "s?")!;
const NUMBERS = phrasePattern(NUMBER_WORDS)!;
const SIZES = phrasePattern(SIZE_ADJECTIVES)!;
const COMPASS_SHORT = tokenPattern(COMPASS_ABBREVIATIONS);
const WEEKDAY_SHORT = tokenPattern(WEEKDAY_ABBREVIATIONS.flatMap((short) => [short, short.toUpperCase()]));
const CLOSED = (Object.entries(CLOSED_WORD_SETS) as Array<[ClosedWordClass, ReadonlyArray<readonly string[]>]>).map(([name, entries]) => ({
  name,
  pattern: phrasePattern(entries.flat())!,
  claimOf: new Map(entries.flatMap((forms) => forms.map((form) => [canonical(form), canonical(forms[0])] as const))),
}));

function found(text: string, pattern: RegExp, claimOf?: ReadonlyMap<string, string>): Set<string> {
  return new Set([...text.matchAll(pattern)].map((match) => {
    const claim = canonical(match[1]);
    return claimOf?.get(claim) ?? claim;
  }));
}

/** Blanks every match with as many spaces, so later matches keep their positions in the text. */
function blank(text: string, pattern: RegExp | null): string {
  return pattern ? text.replace(pattern, (match) => " ".repeat(match.length)) : text;
}

interface Claims {
  beaches: Set<string>;
  /** Weekdays and "a week from <day>" units, each once, in the order they first appear. */
  days: string[];
  directions: Set<string>;
  timing: Set<string>;
  relative: Set<string>;
  closed: Record<ClosedWordClass, Set<string>>;
}

/**
 * A beach's or region's name lends nothing: "North Beach" names a beach and "North Shore" a region,
 * not a north swell. Region names are only blanked out; naming one is no beach claim.
 */
function claimsIn(text: string, beaches: RegExp | null, regions: RegExp | null, abbreviations: boolean): Claims {
  const named = blank(blank(text, beaches), regions);
  const days: Array<{ at: number; claim: string }> = [...named.matchAll(WEEK_FROM)]
    .map((match) => ({ at: match.index, claim: canonical(match[1]) }));
  const rest = blank(named, WEEK_FROM);
  days.push(...[...rest.matchAll(WEEKDAYS)].map((match) => ({ at: match.index, claim: canonical(match[1]) })));
  const directions = found(rest, DIRECTIONS);
  // A written sentence's "SSW" or "Fri" claims the full word; candidate text never abbreviates.
  if (abbreviations) {
    for (const match of rest.matchAll(COMPASS_SHORT)) directions.add(canonical(COMPASS[COMPASS_ABBREVIATIONS.indexOf(match[1])]));
    for (const match of rest.matchAll(WEEKDAY_SHORT)) {
      const short = match[1].toLowerCase();
      days.push({ at: match.index, claim: WEEKDAY.find((day) => day.toLowerCase().startsWith(short))!.toLowerCase() });
    }
  }
  return {
    beaches: beaches ? found(text, beaches) : new Set(),
    days: [...new Set(days.sort((a, b) => a.at - b.at).map((day) => day.claim))],
    directions,
    timing: found(rest, TIMING),
    relative: found(rest, RELATIVE_TIME),
    closed: Object.fromEntries(CLOSED.map(({ name, pattern, claimOf }) => [name, found(rest, pattern, claimOf)])) as Claims["closed"],
  };
}

function within(claims: Iterable<string>, allowed: ReadonlySet<string>): boolean {
  return [...claims].every((claim) => allowed.has(claim));
}

/** The sentence's days appear in the candidate's order: it may leave days out, never swap them. */
function inOrder(sentence: readonly string[], fact: readonly string[]): boolean {
  let next = 0;
  for (const day of sentence) {
    const at = fact.indexOf(day, next);
    if (at < 0) return false;
    next = at + 1;
  }
  return true;
}

/**
 * Whether a sentence written for a candidate claims nothing the candidate's own text doesn't: no numerals,
 * spelled-out numbers, size words, verdict words or "the call"; only weekdays and "a week from <day>"
 * units the candidate names, in its order; only its compass words and region beaches; exactly its time
 * qualifiers; and relative-time and closed-set words only where the candidate uses them. Uppercase
 * compass abbreviations and Capitalised or ALL-CAPS weekday abbreviations count as the full word.
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
  const named = blank(blank(text, beaches), regions);
  if (found(named, NUMBERS).size > 0) return refuse("number");
  if (found(named, SIZES).size > 0) return refuse("size");
  const sentence = claimsIn(text, beaches, regions, true);
  const source = claimsIn(fact.text, beaches, regions, false);
  if (!within(sentence.days, new Set(source.days))) return refuse("weekday");
  if (!inOrder(sentence.days, source.days)) return refuse("weekday_order");
  if (!within(sentence.directions, source.directions)) return refuse("direction");
  if (!within(sentence.beaches, source.beaches)) return refuse("beach");
  if (!within(sentence.timing, source.timing) || !within(source.timing, sentence.timing)) return refuse("timing");
  if (!within(sentence.relative, source.relative)) return refuse("timing");
  for (const { name } of CLOSED) {
    if (!within(sentence.closed[name], source.closed[name])) return refuse(name);
  }
  return { ok: true };
}
