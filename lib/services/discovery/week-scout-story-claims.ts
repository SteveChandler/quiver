import { COMPASS, WEEKDAY } from "./week-scout-story-candidates";
import { LIGHT_WIND_MPH, type CandidateFacts, type FaceRange, type SizeWord } from "./week-scout-story-facts";
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
  wind: [["offshore", "offshores"], ["onshore", "onshores", "sea breeze", "sea breezes"]],
  comparison: [["better"], ["worse"]],
  tide: [["low"], ["high"], ["rising"], ["falling"]],
  period: [["long-period"], ["mid-period"], ["short-period"], ["groundswell", "groundswells"], ["windswell", "windswells"],
    ["storm", "stormy", "storms"]],
  exposure: [["sheltered", "shelter", "shelters", "sheltering"], ["shadow", "shadowed", "shadows"], ["partly", "partially"],
    ["faces", "face", "facing", "faced", "catches", "catching", "exposed", "wide open"], ["head on"], ["straight on"],
    ["dead on"], ["at an angle", "angled"]],
  wind_strength: [["light"], ["glassy"], ["calm"], ["breezy"],
    ["windy", "wind is up", "wind's up", "wind up", "wind still up", "wind is still up", "wind picks up", "wind comes up"],
    ["blown out"], ["gusty"], ["lighter"], ["calmer"], ["clean", "cleans", "cleaned", "cleaning", "cleaner"], ["choppy"], ["bumpy"],
    ["messy"]],
} as const satisfies Record<string, ReadonlyArray<readonly string[]>>;
type ClosedWordClass = keyof typeof CLOSED_WORD_SETS;

/**
 * Wind-strength claims a candidate's own claim licenses by rule, read on the candidate's side only: light wind
 * is clean, glassy and calm; a windy window is choppy, bumpy, messy and gusty; a breezy one is bumpy. "Blown out"
 * stays the rating's own reason: a written beach line never serves on a blown-out rating, so it never says so. Keys and values are canonical (first) forms of CLOSED_WORD_SETS.wind_strength entries.
 */
export const WIND_STRENGTH_IMPLIES: Readonly<Record<string, readonly string[]>> = {
  light: ["clean", "glassy", "calm"],
  windy: ["choppy", "bumpy", "messy", "gusty"],
  breezy: ["bumpy"],
};

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
export const TIME_QUALIFIERS = ["a week from", "next week", "earlier in the week", "earlier", "later on", "peaked", "faded", "arrived",
  "reached", "pushed in", "showed up", "rolled in", "eased", "built", "came and went", "today", "tonight", "tomorrow"];
/** One claim each, read before bare weekdays: "a week from Saturday" is neither "Saturday" nor "a week from Thursday". */
export const WEEK_FROM_DAYS = ["a week from today", ...WEEKDAY.map((day) => `a week from ${day}`)];
/** One claim each, read with WEEK_FROM_DAYS: "next Friday" is neither "Friday" nor anything a candidate names. */
export const NEXT_WEEKDAYS = WEEKDAY.map((day) => `next ${day}`);
/**
 * Time qualifiers that stand where a weekday would ("peaks next week"), so a phase verb binds to them like a day.
 * The card writes bare "earlier" for a day more than six days back ("peaked earlier").
 */
export const DAY_PHRASES = ["next week", "earlier in the week", "earlier", "later on", "today", "tonight", "tomorrow"];
/**
 * The verbs that name a swell's phase, each with the forms that make the same claim. A phase verb binds every
 * day after it in its clause until the next day: "arrives Thursday, peaks Friday" pairs arrives with Thursday,
 * "arrives and peaks Thursday" pairs both with Thursday. With no day after it in its clause, it binds the day
 * before it ("Thursday peaks"). A written sentence's pairs must all be its candidate's.
 * "reaches" is the cover's arrival ("reaches San Diego Wednesday") and "most" the cover's peak ("with the most
 * swell Thursday"). These forms only bind days: a sentence may use any of them. "starts" is no arrival: the
 * lead's "Thursday starts the west swell's run toward a Friday peak" would pair it with Friday. Nor is "fills in":
 * the wind lines' "the onshore fills in" names wind, so "The onshore fills in Friday" binds no arrival.
 */
export const PHASE_VERBS = {
  arrives: ["arrives", "arrive", "arriving", "arrived", "reaches", "reach", "reaching", "reached", "pushes in", "push in", "pushing in",
    "pushed in", "shows up", "show up", "showing up", "showed up", "rolls in", "roll in", "rolling in", "rolled in"],
  peaks: ["peaks", "peak", "peaking", "peaked", "most"],
  fades: ["fades", "fade", "fading", "faded"],
  "comes and goes": ["comes and goes", "come and go", "coming and going", "came and went"],
  builds: ["builds", "build", "building", "built"],
  eases: ["eases", "ease", "easing", "eased"],
} as const satisfies Record<string, readonly string[]>;
/** Words that list days together ("Thursday and Friday"), so a phase verb reaches every listed day. */
export const LIST_JOINERS = ["and", "or", "&"];
/**
 * Relative days and times of day: a sentence may use one only when its candidate does (plurals count). Each
 * entry is one claim, canonical form first: "noon" is the wind lines' "midday".
 */
export const RELATIVE_TIME_WORDS = [["same day"], ["next day"], ["day after"], ["following day"], ["weekend"], ["overnight"], ["midweek"],
  ["dawn"], ["sunrise"], ["morning"], ["midday", "noon"], ["afternoon"], ["evening"], ["sunset"], ["dusk"], ["night"], ["midnight"]];
/** Spelled-out numbers and units ("eight feet", "six-foot", "twenty-two seconds"). "One" stays prose ("the one to watch"). */
export const NUMBER_WORDS = ["two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen",
  "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen", "twenty", "thirty", "forty", "fifty", "sixty", "seventy",
  "eighty", "ninety", "hundred", "hundreds", "dozen", "dozens", "half", "feet", "foot", "ft", "seconds", "mph", "knots", "meter",
  "meters", "metre", "metres", "inch", "inches", "mile", "miles"];
/** Hype stays banned even when a candidate has size facts. */
export const SIZE_ADJECTIVES = ["big", "huge", "massive", "solid", "pumping", "firing", "epic", "triple overhead", "triple-overhead"];
export { SIZE_BUCKETS } from "./week-scout-story-facts";
export const BODY_SIZES = ["knee", "waist", "chest", "shoulder", "head"] as const;
export const OVERHEAD_SIZES = [["double overhead", "double-overhead"], ["overhead"]] as const;
export const SMALL_SIZES = { small: 3, tiny: 2, flat: 1 } as const;
export const STANDOUT_WORDS = ["standouts", "best spots", "best breaks", "best reefs", "swell magnets"];
export const FOOT_UNITS = ["ft", "foot", "feet"];
export const WIND_TIMING = {
  kinds: {
    offshore: ["offshore", "offshores", "offshore wind", "offshore winds"],
    onshore: ["onshore", "onshores", "onshore wind", "onshore winds", "sea breeze", "sea breezes"],
    light: ["light wind", "light winds", "glassy", "calm"],
  },
  spans: {
    early: [0, 9, ["early", "at dawn", "first thing"]],
    morning: [0, 12, ["all morning", "in the morning", "mornings"], ["all morning"]],
    afternoon: [12, 24, ["in the afternoon", "afternoons", "all afternoon"], ["all afternoon"]],
    "after lunch": [13, 24, ["after lunch"]],
    "all day": [0, 24, ["all day"], ["all day"]],
  },
  clock: { firstHour: 7, lastHour: 12, untilHour: 13, suffixes: ["AM", "am", "a.m."], pmSuffixes: ["PM", "pm", "p.m.", "P.M."], noon: "noon" },
  cover: { daylightFrom: 6, daylightTo: 18, edgeHours: 2 },
  lightPrefix: "light",
  lightBelowMph: LIGHT_WIND_MPH,
} as const;
export const BREAKER_WORDS = [["pitching", "pitches", "throwing", "throws"], ["hollow"], ["punchy"], ["crumbly", "crumbling", "crumbles", "spilling"],
  ["soft", "mushy"], ["peaky"], ["lined up", "lined-up", "lines up", "lining up"],
  ["closing out", "closes out", "close out", "closeouts", "closeout", "close-out", "close outs", "close-outs"]];
/**
 * Verdicts a written sentence never names, read only as whole UPPERCASE words: native's narrativeText()
 * refusals (YES, MAYBE, NO) and the card's beach labels (scoreLabel's EPIC, GOOD, FAIR, RIDEABLE, MEH, and an
 * early look's LIKELY and EARLY LOOK). The band shows each user's own label, so prose never repeats one.
 */
export const VERDICT_WORDS = ["YES", "MAYBE", "NO", "EPIC", "GOOD", "FAIR", "RIDEABLE", "MEH", "LIKELY", "EARLY LOOK"];
/** COMPASS's abbreviations, index for index; read only as whole uppercase tokens, so lowercase "ssw" stays prose. */
export const COMPASS_ABBREVIATIONS = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
/** Each a prefix of its WEEKDAY; read only Capitalised or ALL-CAPS, so "the sun" and "we sat" stay prose. */
export const WEEKDAY_ABBREVIATIONS = ["Sun", "Mon", "Tue", "Tues", "Wed", "Thu", "Thur", "Thurs", "Fri", "Sat"];

type WrittenSentenceRefusal =
  | "empty" | "too_long" | "digit" | "verdict_word" | "the_call" | "number" | "size" | "weekday" | "weekday_order"
  | "direction" | "beach" | "timing" | "wind_timing" | "breaker" | ClosedWordClass;
type WrittenSentenceCheck = { ok: true } | { ok: false; reason: WrittenSentenceRefusal };

/** The candidates' own limit (add() in week-scout-story-candidates). */
const MAX_LENGTH = 240;
// Uppercase whole words only, so "no wind" and "good" stay prose: native's narrativeText() refusal plus every card label.
const VERDICT_WORD = new RegExp(`(?<![\\p{L}0-9])(?:${[...VERDICT_WORDS].sort((a, b) => b.length - a.length)
  .map((word) => word.replace(/\s+/g, "\\s+")).join("|")})(?![\\p{L}0-9])`, "u");
const THE_CALL = /\bthe\s+call\b/i;
const NUMERAL = /[0-9]/;
/** Punctuation that ends a clause: a phase verb never binds a day across one. */
const CLAUSE_BREAK = /[,;:.!?()…\u2013\u2014]|\s-\s/gu;

/**
 * Whole phrases, longest first so "south-southwest" is one claim, not "south" and "southwest".
 * Case-insensitive; spaces and hyphens match each other ("head-on" is "head on"). Capture group 1 is
 * the phrase without `suffix`.
 */
function phrasePattern(phrases: readonly string[], suffix = ""): RegExp | null {
  // Every call compiles the same region's beach and region names: keep the most recent few. Cached patterns are
  // global, so read them only with matchAll and replace; .test() or .exec() would leave lastIndex for the next call.
  const key = JSON.stringify([suffix, phrases]);
  if (PATTERNS.has(key)) return PATTERNS.get(key)!;
  const pattern = compilePhrases(phrases, suffix);
  if (PATTERNS.size >= MAX_CACHED_PATTERNS) PATTERNS.delete(PATTERNS.keys().next().value!);
  PATTERNS.set(key, pattern);
  return pattern;
}

/** Compiled phrase patterns by suffix and phrases, oldest first. */
const PATTERNS = new Map<string, RegExp | null>();
const MAX_CACHED_PATTERNS = 64;

function phraseAlternatives(phrases: readonly string[]): string {
  return [...new Set(phrases.map((phrase) => phrase.trim().toLowerCase()).filter(Boolean))]
    .sort((a, b) => b.length - a.length)
    .map((phrase) => phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/[\s-]+/g, "[\\s-]+").replace(/['’]/g, "['’]?"))
    .join("|");
}

function compilePhrases(phrases: readonly string[], suffix: string): RegExp | null {
  const alternatives = phraseAlternatives(phrases);
  if (alternatives.length === 0) return null;
  return new RegExp(`(?<![\\p{L}0-9])(${alternatives})${suffix}(?![\\p{L}0-9])`, "giu");
}

/** Whole case-sensitive tokens, longest first. */
function tokenPattern(tokens: readonly string[]): RegExp {
  const alternatives = [...tokens].sort((a, b) => b.length - a.length);
  return new RegExp(`(?<![\\p{L}0-9])(${alternatives.join("|")})(?![\\p{L}0-9])`, "gu");
}

function canonical(phrase: string): string {
  return phrase.toLowerCase().replace(/[\s-]+/g, " ").replace(/['’]/g, "");
}

/** A phrase set read as claims: each form maps to its entry's canonical form. */
function claimSet(entries: ReadonlyArray<readonly string[]>, suffix = ""): { pattern: RegExp; claimOf: Map<string, string> } {
  return {
    pattern: phrasePattern(entries.flat(), suffix)!,
    claimOf: new Map(entries.flatMap((forms) => forms.map((form) => [canonical(form), canonical(forms[0])] as const))),
  };
}

const WEEKDAYS = phrasePattern(WEEKDAY, "s?")!;
const DAY_UNITS = phrasePattern([...WEEK_FROM_DAYS, ...NEXT_WEEKDAYS])!;
/** "next Fri" is "next friday", as "next Friday" is. */
const NEXT_BEFORE = /(?<![\p{L}0-9])next[\s-]+$/iu;
// "westerly" and "southern" claim a direction too.
const DIRECTIONS = phrasePattern(COMPASS, "(?:erly|ern|wards?)?")!;
const TIMING = phrasePattern(TIME_QUALIFIERS)!;
const DAY_PHRASE = phrasePattern(DAY_PHRASES)!;
const RELATIVE_TIME = claimSet(RELATIVE_TIME_WORDS, "s?");
const NUMBERS = phrasePattern(NUMBER_WORDS)!;
const SIZES = phrasePattern(SIZE_ADJECTIVES)!;
const COMPASS_SHORT = tokenPattern(COMPASS_ABBREVIATIONS);
const WEEKDAY_SHORT = tokenPattern(WEEKDAY_ABBREVIATIONS.flatMap((short) => [short, short.toUpperCase()]));
const CLOSED = (Object.entries(CLOSED_WORD_SETS) as Array<[ClosedWordClass, ReadonlyArray<readonly string[]>]>)
  .map(([name, entries]) => ({ name, ...claimSet(entries) }));
const STRENGTH = CLOSED.find((set) => set.name === "wind_strength")!;
const DEGREE = claimSet(DEGREE_WORDS);
const PHASES = claimSet(Object.entries(PHASE_VERBS).map(([phase, forms]) => [phase, ...forms]));
const FOOT_RANGE = new RegExp(`(?<![\\p{L}0-9])([0-9]{1,2})(?:\\s*(?:-|–|—|to)\\s*([0-9]{1,2}))?[\\s-]*(?:${phraseAlternatives(FOOT_UNITS)})(?![\\p{L}0-9])`, "giu");
const STANDOUT = phrasePattern(STANDOUT_WORDS)!;
const AT_STANDOUTS = phrasePattern(STANDOUT_WORDS.flatMap((phrase) => [`at ${phrase}`, `at the ${phrase}`]))!;
const BIGGER = phrasePattern(["bigger"])!;
const SMALL = phrasePattern(Object.keys(SMALL_SIZES))!;
const BODY_CLAIMS = new Map<string, readonly SizeWord[]>();
const BODY_ENDPOINTS = [...BODY_SIZES, ...OVERHEAD_SIZES.map(([word]) => word)] as const;
for (const low of BODY_SIZES) {
  BODY_CLAIMS.set(`${low} high`, [low]);
  BODY_CLAIMS.set(`${low} height`, [low]);
  for (const high of BODY_ENDPOINTS) {
    const sizes: SizeWord[] = [low, high];
    BODY_CLAIMS.set(`${low} to ${high}`, sizes);
    BODY_CLAIMS.set(`${low} to ${high} high`, sizes);
  }
  for (const high of BODY_SIZES) BODY_CLAIMS.set(`${low} and ${high} high`, [low, high]);
}
for (const forms of OVERHEAD_SIZES) {
  for (const form of forms) BODY_CLAIMS.set(canonical(form), [forms[0]]);
}
const BODY_SIZE = phrasePattern([...BODY_CLAIMS.keys()])!;
const BREAKERS = claimSet(BREAKER_WORDS);
type WindKind = keyof typeof WIND_TIMING.kinds;
const WIND_KINDS = new Map<string, WindKind>(Object.entries(WIND_TIMING.kinds)
  .flatMap(([kind, forms]) => forms.map((form) => [canonical(form), kind as WindKind] as const)));
const WIND_SPANS = new Map<string, readonly [number, number, boolean]>(Object.values(WIND_TIMING.spans)
  .flatMap(([from, to, forms, allForms]) => forms.map((form) => [canonical(form),
    [from, to, (allForms as readonly string[] | undefined)?.includes(form) ?? false]] as const)));
const CLOCK_HOURS = Array.from({ length: WIND_TIMING.clock.lastHour - WIND_TIMING.clock.firstHour + 1 },
  (_, index) => String(WIND_TIMING.clock.firstHour + index));
const TIMED_WIND = new RegExp(`(?<![\\p{L}0-9])(?:(${phraseAlternatives([WIND_TIMING.lightPrefix])})[\\s-]+)?`
  + `(${phraseAlternatives([...WIND_KINDS.keys()])})[\\s-]+(?:(${phraseAlternatives([...WIND_SPANS.keys()])})`
  + `|by[\\s-]+(?:(${phraseAlternatives(CLOCK_HOURS)})(?:\\s*(${phraseAlternatives(WIND_TIMING.clock.suffixes)}))?`
  + `(?:\\s*(${phraseAlternatives(WIND_TIMING.clock.pmSuffixes)}))?|(${phraseAlternatives([WIND_TIMING.clock.noon])})))(?![\\p{L}0-9])`, "giu");

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

function blankSizes(text: string): string {
  return [BODY_SIZE, SMALL, BIGGER, SIZES].reduce((rest, pattern) => blank(rest, pattern), text);
}

function blankFactClaims(text: string): string {
  return blank(blankSizes(blank(blank(text, FOOT_RANGE), TIMED_WIND)), BREAKERS.pattern);
}

function standoutClause(text: string, at: number, pattern: RegExp): boolean {
  let from = 0;
  let to = text.length;
  for (const match of text.matchAll(CLAUSE_BREAK)) {
    if (match.index < at) from = match.index + match[0].length;
    else { to = match.index; break; }
  }
  return found(text.slice(from, to), pattern).size > 0;
}

function rangeWithin(low: number, high: number, range: FaceRange | null | undefined): boolean {
  return !!range && low <= high && low >= range.min && high <= range.max;
}

function footRangesHold(text: string, facts: CandidateFacts | undefined): boolean {
  // Range punctuation belongs to the range, not to the surrounding clause.
  const clauses = blank(blank(text, FOOT_RANGE), TIMED_WIND);
  return [...text.matchAll(FOOT_RANGE)].every((match) => {
    const low = Number(match[1]);
    const high = Number(match[2] ?? match[1]);
    return rangeWithin(low, high, facts?.faceFt)
      || (standoutClause(clauses, match.index, AT_STANDOUTS) && rangeWithin(low, high, facts?.standoutFt));
  });
}

function windTimingHolds(text: string, facts: CandidateFacts | undefined): boolean {
  return [...text.matchAll(TIMED_WIND)].every((match) => {
    const kind = WIND_KINDS.get(canonical(match[2]))!;
    if (match[6]) return false;
    const [from, to, all] = match[3] ? WIND_SPANS.get(canonical(match[3]))!
      : [match[7] ? WIND_TIMING.clock.lastHour : Number(match[4]), WIND_TIMING.clock.untilHour, false];
    const hours = facts?.windHours?.filter((row) => row.hour >= from && row.hour < to) ?? [];
    const coversSpan = !all || (hours.some((row) => row.hour <= Math.max(from, WIND_TIMING.cover.daylightFrom) + WIND_TIMING.cover.edgeHours)
      && hours.some((row) => row.hour >= Math.min(to, WIND_TIMING.cover.daylightTo) - WIND_TIMING.cover.edgeHours));
    return hours.length > 0 && coversSpan && hours.every((row) =>
      (kind === "light" || row.relation === kind)
      && (!(match[1] || kind === "light") || (row.mph != null && row.mph < WIND_TIMING.lightBelowMph)));
  });
}

function sizeWordsHold(text: string, facts: CandidateFacts | undefined): boolean {
  const clauseText = blank(blank(text, FOOT_RANGE), TIMED_WIND);
  for (const match of text.matchAll(BODY_SIZE)) {
    const sizes = BODY_CLAIMS.get(canonical(match[1]))!;
    const standout = standoutClause(clauseText, match.index, AT_STANDOUTS);
    if (!sizes.every((size) => facts?.sizes?.includes(size) || (standout && facts?.standoutSizes?.includes(size)))) return false;
  }
  for (const word of found(text, SMALL)) {
    if (!facts?.faceFt || !(facts.faceFt.max <= SMALL_SIZES[word as keyof typeof SMALL_SIZES])) return false;
  }
  for (const match of located(text, BIGGER)) {
    if (standoutClause(clauseText, match.at, STANDOUT) && !facts?.standoutFt) return false;
  }
  return found(text, SIZES).size === 0;
}

function breakerWordsHold(text: string, facts: CandidateFacts | undefined): boolean {
  const breaker = facts?.breaker;
  const passes: Record<string, boolean> = {
    pitching: breaker?.character === "pitching",
    hollow: breaker?.character === "pitching" && breaker?.feel === "punchy",
    punchy: breaker?.feel === "punchy",
    crumbly: breaker?.character === "crumbly",
    soft: breaker?.feel === "soft" || (breaker?.feel === null && breaker?.character === "crumbly"),
    peaky: breaker?.character === "crumbly",
    "lined up": breaker?.character === "pitching",
    "closing out": breaker?.closingOut === true,
  };
  return [...found(text, BREAKERS.pattern, BREAKERS.claimOf)].every((claim) => passes[claim]);
}

/**
 * (phase, day) pairs. A day pairs with every phase verb between it and its clause's previous day (or the
 * clause's start); with none there, it takes the previous day's verbs, so "peaks Friday and Saturday" pairs
 * peaks with both. A phase verb with no day after it in its clause pairs with the clause's last day before it
 * and every day listed with that one ("Thursday and Friday both peak"). Days are listed when only commas and
 * LIST_JOINERS stand between them; across a comma, the side the verb doesn't reach must be a clause of only days
 * and joiners, so "peaks Friday, Saturday" lists Saturday with Friday and "arrives Thursday, peaks Friday" doesn't.
 */
function phasePairs(text: string, days: readonly Located[], verbs: readonly Located[]): Set<string> {
  const breaks = [...text.matchAll(CLAUSE_BREAK)].map((match) => ({ at: match.index, end: match.index + match[0].length }));
  const clause = (at: number): number => breaks.filter((item) => item.at < at).length;
  const sorted = [...days].sort((a, b) => a.at - b.at);
  const withoutDays = sorted.reduce((blanked, day) => blanked.slice(0, day.at) + " ".repeat(day.end - day.at) + blanked.slice(day.end), text);
  const joinersOnly = (piece: string): boolean => piece.split(/[\s,]+/).filter(Boolean)
    .every((word) => LIST_JOINERS.includes(word.toLowerCase()));
  const bare = (index: number): boolean =>
    joinersOnly(withoutDays.slice(index === 0 ? 0 : breaks[index - 1].end, breaks[index]?.at ?? text.length));
  /** Day `index` is listed with the day before it; across a comma, day `bareSide`'s clause holds only days and joiners. */
  const listed = (index: number, bareSide: number): boolean => joinersOnly(text.slice(sorted[index - 1].end, sorted[index].at))
    && (clause(sorted[index - 1].at) === clause(sorted[index].at) || bare(clause(sorted[bareSide].at)));
  const pairs = new Set<string>();
  let previousVerbs: string[] = [];
  sorted.forEach((day, index) => {
    const previous = index > 0 && (clause(sorted[index - 1].at) === clause(day.at) || listed(index, index)) ? sorted[index - 1] : null;
    const from = previous?.end ?? -1;
    const before = verbs.filter((verb) => clause(verb.at) === clause(day.at) && verb.at >= from && verb.at < day.at)
      .map((verb) => verb.claim);
    const own = before.length > 0 || !previous ? before : previousVerbs;
    for (const verb of own) pairs.add(`${verb}|${day.claim}`);
    previousVerbs = own;
  });
  for (const verb of verbs) {
    const verbClause = clause(verb.at);
    if (sorted.some((day) => clause(day.at) === verbClause && day.at > verb.at)) continue;
    let index = -1;
    sorted.forEach((day, at) => {
      if (clause(day.at) === verbClause && day.at < verb.at) index = at;
    });
    if (index < 0) continue;
    pairs.add(`${verb.claim}|${sorted[index].claim}`);
    while (index > 0 && listed(index, index - 1)) {
      index -= 1;
      pairs.add(`${verb.claim}|${sorted[index].claim}`);
    }
  }
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
  /** Each set's claims in the order they first appear. */
  closed: Record<ClosedWordClass, Set<string>>;
  degree: Set<string>;
}

/**
 * A beach's or region's name lends nothing: "North Beach" names a beach and "North Shore" a region,
 * not a north swell. Region names are only blanked out; naming one is no beach claim.
 */
function claimsIn(text: string, beaches: RegExp | null, regions: RegExp | null, abbreviations: boolean): Claims {
  const named = blankFactClaims(blank(blank(text, beaches), regions));
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
  // Wind strength reads first and is blanked for the other sets, so a wind phrase never counts toward another set.
  const unwound = blank(rest, STRENGTH.pattern);
  return {
    beaches: beaches ? [...found(text, beaches)] : [],
    days: [...new Set(days.sort((a, b) => a.at - b.at).map((day) => day.claim))],
    phases: phasePairs(named, [...days, ...located(rest, DAY_PHRASE)], located(rest, PHASES.pattern, PHASES.claimOf)),
    directions,
    timing: found(rest, TIMING),
    relative: found(rest, RELATIVE_TIME.pattern, RELATIVE_TIME.claimOf),
    closed: Object.fromEntries(CLOSED.map(({ name, pattern, claimOf }) =>
      [name, found(name === "wind_strength" ? rest : unwound, pattern, claimOf)])) as Claims["closed"],
    degree: found(unwound, DEGREE.pattern, DEGREE.claimOf),
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
 * Sizes, foot ranges, timed wind and breaker words must hold against the candidate's facts. Other claims
 * stay within its text: no stray numerals, spelled-out numbers or verdict words; only weekdays, "a week from <day>" and
 * "next <weekday>" units the candidate names, in its order, each after the same phase verbs; only its compass words, and
 * its region beaches in its order; exactly its time qualifiers and degree words; and relative-time and
 * closed-set words only where the candidate uses them, wind words in its order. Any other word is free prose. Uppercase compass
 * abbreviations and Capitalised or ALL-CAPS weekday abbreviations count as the full word. `regionNames`
 * are the names a fact may carry for its region (the cover's "reaches North Shore").
 */
export function checkWrittenSentence(text: string, fact: StoryCandidate, beachNames: readonly string[],
  regionNames: readonly string[] = []): WrittenSentenceCheck {
  const refuse = (reason: WrittenSentenceRefusal): WrittenSentenceCheck => ({ ok: false, reason });
  if (typeof text !== "string" || text.trim().length === 0) return refuse("empty");
  if (text.length > MAX_LENGTH) return refuse("too_long");
  if (VERDICT_WORD.test(text)) return refuse("verdict_word");
  if (THE_CALL.test(text)) return refuse("the_call");
  const beaches = phrasePattern(beachNames);
  const regions = phrasePattern(regionNames);
  let named = blank(blank(text, beaches), regions);
  if ([...named.matchAll(FOOT_RANGE)].some((match) => match[1].length > 1 && match[1].startsWith("0")
    || (match[2] !== undefined && match[2].length > 1 && match[2].startsWith("0")))) return refuse("digit");
  if (!footRangesHold(named, fact.facts)) return refuse("size");
  named = blank(named, FOOT_RANGE);
  if (!windTimingHolds(named, fact.facts)) return refuse("wind_timing");
  named = blank(named, TIMED_WIND);
  if (NUMERAL.test(named)) return refuse("digit");
  if (found(named, NUMBERS).size > 0) return refuse("number");
  if (!sizeWordsHold(named, fact.facts)) return refuse("size");
  named = blankSizes(named);
  if (!breakerWordsHold(named, fact.facts)) return refuse("breaker");
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
  const licensed = { ...source.closed, wind_strength: new Set([...source.closed.wind_strength]
    .flatMap((claim) => [claim, ...(WIND_STRENGTH_IMPLIES[claim] ?? [])])) };
  for (const { name } of CLOSED) {
    if (!within(sentence.closed[name], licensed[name])) return refuse(name);
  }
  // Wind words keep the candidate's order, as beaches do: "starts offshore, then turns onshore" never reads the other way.
  if (!inOrder([...sentence.closed.wind], [...source.closed.wind])) return refuse("wind");
  if (!same(sentence.degree, source.degree)) return refuse("exposure");
  return { ok: true };
}
