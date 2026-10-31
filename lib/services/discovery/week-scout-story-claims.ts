import { COMPASS, WEEKDAY } from "./week-scout-story-candidates";
import type { StoryCandidate } from "./week-scout-story-types";

// Every rule below is data: the PC worker mirrors these lists to check a sentence before it sends it.

/**
 * Closed content-word sets: a written sentence may use a word from one only when its candidate's text
 * uses it, so a rewrite can't swap a claim for its opposite. Each entry is one claim: its canonical
 * form first, then other forms that make the same claim ("stormy" is "storm", "the wind is up" is "windy",
 * "catches" and "wide open" are "faces"). A comparative no candidate writes is its own claim ("lighter" is not
 * "light"); "cleaner" is "clean" because the wind lines write both. The refusal reason is the set's name.
 */
export const CLOSED_WORD_SETS = {
  wind: [["offshore", "offshores"], ["onshore", "onshores"]],
  comparison: [["better"], ["worse"]],
  tide: [["low"], ["high"], ["rising"], ["falling"]],
  period: [["long-period"], ["mid-period"], ["short-period"], ["groundswell", "groundswells"], ["windswell", "windswells"],
    ["storm", "stormy", "storms"]],
  exposure: [["sheltered", "shelter", "shelters", "sheltering"], ["shadow", "shadowed", "shadows"], ["partly", "partially"],
    ["faces", "face", "facing", "faced", "catches", "catching", "picks up", "exposed", "wide open"], ["head on"], ["straight on"],
    ["dead on"], ["at an angle", "angled"]],
  wind_strength: [["light"], ["glassy"], ["calm"], ["breezy"],
    ["windy", "wind is up", "wind's up", "wind up", "wind still up", "wind is still up", "wind picks up", "wind comes up"],
    ["blown out"], ["gusty"], ["lighter"], ["calmer"], ["clean", "cleans", "cleaned", "cleaning", "cleaner"], ["choppy"], ["bumpy"],
    ["messy"]],
} as const satisfies Record<string, ReadonlyArray<readonly string[]>>;
type ClosedWordClass = keyof typeof CLOSED_WORD_SETS;

/**
 * How squarely a beach takes a swell, kept exactly: a sentence keeps every one its candidate has and adds
 * none, so "Partly sheltered" never reads "Sheltered" and "dead on" never drops. Each entry is one claim,
 * canonical form first. All are exposure words, so the refusal reason is "exposure".
 */
export const DEGREE_WORDS = [["partly", "partially"], ["dead on"], ["at an angle", "angled"], ["head on"], ["straight on"]];

/**
 * Words a day leans on, kept exactly: a sentence keeps every one its candidate has and adds none ("peaked"
 * is not "peaks"). A phase verb's past form is a time claim too, so every past form in PHASE_VERBS is here.
 */
export const TIME_QUALIFIERS = ["a week from", "next week", "earlier in the week", "later on", "peaked", "faded", "arrived", "reached",
  "pushed in", "filled in", "showed up", "rolled in", "eased", "built", "came and went", "today", "tonight", "tomorrow"];
/** One claim each, read before bare weekdays: "a week from Saturday" is neither "Saturday" nor "a week from Thursday". */
export const WEEK_FROM_DAYS = ["a week from today", ...WEEKDAY.map((day) => `a week from ${day}`)];
/** One claim each, read with WEEK_FROM_DAYS: "next Friday" is neither "Friday" nor anything a candidate names. */
export const NEXT_WEEKDAYS = WEEKDAY.map((day) => `next ${day}`);
/** Time qualifiers that stand where a weekday would ("peaks next week"), so a phase verb binds to them like a day. */
export const DAY_PHRASES = ["next week", "earlier in the week", "later on", "today", "tonight", "tomorrow"];
/**
 * The verbs that name a swell's phase, each with the forms that make the same claim. A phase verb binds every
 * day after it in its clause until the next day: "arrives Thursday, peaks Friday" pairs arrives with Thursday,
 * "arrives and peaks Thursday" pairs both with Thursday. A written sentence's pairs must all be its candidate's.
 * "reaches" is the cover's arrival ("reaches San Diego Wednesday") and "most" the cover's peak ("with the most
 * swell Thursday"). These forms only bind days: a sentence may use any of them. "starts" is no arrival: the
 * lead's "Thursday starts the west swell's run toward a Friday peak" would pair it with Friday.
 */
export const PHASE_VERBS = {
  arrives: ["arrives", "arrive", "arriving", "arrived", "reaches", "reach", "reaching", "reached", "pushes in", "push in", "pushing in",
    "pushed in", "fills in", "fill in", "filling in", "filled in", "shows up", "show up", "showing up", "showed up", "rolls in", "roll in",
    "rolling in", "rolled in"],
  peaks: ["peaks", "peak", "peaking", "peaked", "most"],
  fades: ["fades", "fade", "fading", "faded"],
  "comes and goes": ["comes and goes", "come and go", "coming and going", "came and went"],
  builds: ["builds", "build", "building", "built"],
  eases: ["eases", "ease", "easing", "eased"],
} as const satisfies Record<string, readonly string[]>;
/** Relative days and times of day: a sentence may use one only when its candidate does (plurals count). */
export const RELATIVE_TIME_WORDS = ["same day", "next day", "day after", "following day", "weekend", "overnight", "midweek", "dawn",
  "sunrise", "morning", "midday", "noon", "afternoon", "evening", "sunset", "dusk", "night", "midnight"];
/** Spelled-out numbers and units ("eight feet", "six-foot", "twenty-two seconds"). "One" stays prose ("the one to watch"). */
export const NUMBER_WORDS = ["two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen",
  "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen", "twenty", "thirty", "forty", "fifty", "sixty", "seventy",
  "eighty", "ninety", "hundred", "hundreds", "dozen", "dozens", "half", "feet", "foot", "ft", "seconds", "mph", "knots", "meter",
  "meters", "metre", "metres", "inch", "inches", "mile", "miles"];
/**
 * Size words no candidate uses: the card's data line owns size, so a sentence never names one. Relative
 * words ("biggest Thursday" for the peak) stay prose.
 */
export const SIZE_ADJECTIVES = ["knee-high", "waist-high", "chest-high", "shoulder-high", "head-high", "overhead", "double overhead",
  "small", "tiny", "big", "huge", "massive", "solid", "pumping", "firing", "epic", "flat"];
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
/** Punctuation that ends a clause: a phase verb never binds a day across one. */
const CLAUSE_BREAK = /[,;:.!?()…\u2013\u2014]|\s-\s/gu;

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

/** A phrase set read as claims: each form maps to its entry's canonical form. */
function claimSet(entries: ReadonlyArray<readonly string[]>): { pattern: RegExp; claimOf: Map<string, string> } {
  return {
    pattern: phrasePattern(entries.flat())!,
    claimOf: new Map(entries.flatMap((forms) => forms.map((form) => [canonical(form), canonical(forms[0])] as const))),
  };
}

const WEEKDAYS = phrasePattern(WEEKDAY, "s?")!;
const DAY_UNITS = phrasePattern([...WEEK_FROM_DAYS, ...NEXT_WEEKDAYS])!;
/** "next Fri" is "next friday", as "next Friday" is. */
const NEXT_BEFORE = /(?<![\p{L}\p{N}])next[\s-]+$/iu;
// "westerly" and "southern" claim a direction too.
const DIRECTIONS = phrasePattern(COMPASS, "(?:erly|ern|wards?)?")!;
const TIMING = phrasePattern(TIME_QUALIFIERS)!;
const DAY_PHRASE = phrasePattern(DAY_PHRASES)!;
const RELATIVE_TIME = phrasePattern(RELATIVE_TIME_WORDS, "s?")!;
const NUMBERS = phrasePattern(NUMBER_WORDS)!;
const SIZES = phrasePattern(SIZE_ADJECTIVES)!;
const COMPASS_SHORT = tokenPattern(COMPASS_ABBREVIATIONS);
const WEEKDAY_SHORT = tokenPattern(WEEKDAY_ABBREVIATIONS.flatMap((short) => [short, short.toUpperCase()]));
const CLOSED = (Object.entries(CLOSED_WORD_SETS) as Array<[ClosedWordClass, ReadonlyArray<readonly string[]>]>)
  .map(([name, entries]) => ({ name, ...claimSet(entries) }));
const DEGREE = claimSet(DEGREE_WORDS);
const PHASES = claimSet(Object.entries(PHASE_VERBS).map(([phase, forms]) => [phase, ...forms]));

function found(text: string, pattern: RegExp, claimOf?: ReadonlyMap<string, string>): Set<string> {
  return new Set(located(text, pattern, claimOf).map((match) => match.claim));
}

interface Located {
  at: number;
  end: number;
  claim: string;
}

function located(text: string, pattern: RegExp, claimOf?: ReadonlyMap<string, string>): Located[] {
  return [...text.matchAll(pattern)].map((match) => {
    const claim = canonical(match[1]);
    return { at: match.index, end: match.index + match[0].length, claim: claimOf?.get(claim) ?? claim };
  });
}

/** Blanks every match with as many spaces, so later matches keep their positions in the text. */
function blank(text: string, pattern: RegExp | null): string {
  return pattern ? text.replace(pattern, (match) => " ".repeat(match.length)) : text;
}

/**
 * (phase, day) pairs: each day pairs with every phase verb between it and the clause's previous day (or the
 * clause's start). A day with no phase verb before it in its clause pairs with none.
 */
function phasePairs(text: string, days: readonly Located[], verbs: readonly Located[]): Set<string> {
  const breaks = [...text.matchAll(CLAUSE_BREAK)].map((match) => match.index);
  const sorted = [...days].sort((a, b) => a.at - b.at);
  const pairs = new Set<string>();
  sorted.forEach((day, index) => {
    const clauseStart = Math.max(-1, ...breaks.filter((at) => at < day.at));
    const from = Math.max(clauseStart, index > 0 ? sorted[index - 1].end : -1);
    for (const verb of verbs) {
      if (verb.at >= from && verb.at < day.at) pairs.add(`${verb.claim}|${day.claim}`);
    }
  });
  return pairs;
}

interface Claims {
  /** Region beaches, each once, in the order they first appear. */
  beaches: string[];
  /** Weekdays and "a week from <day>" and "next <weekday>" units, each once, in the order they first appear. */
  days: string[];
  phases: Set<string>;
  directions: Set<string>;
  timing: Set<string>;
  relative: Set<string>;
  closed: Record<ClosedWordClass, Set<string>>;
  degree: Set<string>;
}

/**
 * A beach's or region's name lends nothing: "North Beach" names a beach and "North Shore" a region,
 * not a north swell. Region names are only blanked out; naming one is no beach claim.
 */
function claimsIn(text: string, beaches: RegExp | null, regions: RegExp | null, abbreviations: boolean): Claims {
  const named = blank(blank(text, beaches), regions);
  const days = located(named, DAY_UNITS);
  const rest = blank(named, DAY_UNITS);
  days.push(...located(rest, WEEKDAYS));
  const directions = found(rest, DIRECTIONS);
  // A written sentence's "SSW" or "Fri" claims the full word; candidate text never abbreviates.
  if (abbreviations) {
    for (const match of rest.matchAll(COMPASS_SHORT)) directions.add(canonical(COMPASS[COMPASS_ABBREVIATIONS.indexOf(match[1])]));
    for (const match of rest.matchAll(WEEKDAY_SHORT)) {
      const short = match[1].toLowerCase();
      const day = WEEKDAY.find((name) => name.toLowerCase().startsWith(short))!.toLowerCase();
      days.push({ at: match.index, end: match.index + match[0].length,
        claim: NEXT_BEFORE.test(rest.slice(0, match.index)) ? `next ${day}` : day });
    }
  }
  return {
    beaches: beaches ? [...found(text, beaches)] : [],
    days: [...new Set(days.sort((a, b) => a.at - b.at).map((day) => day.claim))],
    phases: phasePairs(named, [...days, ...located(rest, DAY_PHRASE)], located(rest, PHASES.pattern, PHASES.claimOf)),
    directions,
    timing: found(rest, TIMING),
    relative: found(rest, RELATIVE_TIME),
    closed: Object.fromEntries(CLOSED.map(({ name, pattern, claimOf }) => [name, found(rest, pattern, claimOf)])) as Claims["closed"],
    degree: found(rest, DEGREE.pattern, DEGREE.claimOf),
  };
}

function within(claims: Iterable<string>, allowed: ReadonlySet<string>): boolean {
  return [...claims].every((claim) => allowed.has(claim));
}

function same(a: ReadonlySet<string>, b: ReadonlySet<string>): boolean {
  return within(a, b) && within(b, a);
}

/** The sentence's items appear in the candidate's order: it may leave some out, never swap them. */
function inOrder(sentence: readonly string[], fact: readonly string[]): boolean {
  let next = 0;
  for (const item of sentence) {
    const at = fact.indexOf(item, next);
    if (at < 0) return false;
    next = at + 1;
  }
  return true;
}

/**
 * Whether a sentence written for a candidate claims nothing the candidate's own text doesn't: no numerals,
 * spelled-out numbers, size words, verdict words or "the call"; only weekdays, "a week from <day>" and
 * "next <weekday>" units the candidate names, in its order, each after the same phase verbs; only its compass words, and
 * its region beaches in its order; exactly its time qualifiers and degree words; and relative-time and
 * closed-set words only where the candidate uses them. Any other word is free prose. Uppercase compass
 * abbreviations and Capitalised or ALL-CAPS weekday abbreviations count as the full word. `regionNames`
 * are the names a fact may carry for its region (the cover's "reaches North Shore").
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
  if (!within(sentence.beaches, new Set(source.beaches)) || !inOrder(sentence.beaches, source.beaches)) return refuse("beach");
  if (!same(sentence.timing, source.timing)) return refuse("timing");
  if (!within(sentence.relative, source.relative)) return refuse("timing");
  // After timing, so a time word the fact lacks ("peaks today") reads as timing, not as a moved day.
  if (!within(sentence.phases, source.phases)) return refuse("weekday_order");
  for (const { name } of CLOSED) {
    if (!within(sentence.closed[name], source.closed[name])) return refuse(name);
  }
  if (!same(sentence.degree, source.degree)) return refuse("exposure");
  return { ok: true };
}
