import type { GlanceSentence } from "./week-scout-glance";
import { BREAKER_WORDS, checkWrittenSentence } from "./week-scout-story-claims";

export interface GlanceWritten { fingerprint: string; text: string }
export interface StoryGlance { sentences: string[]; source: Array<"code" | "written"> }
export type GlanceWordingCheck = { ok: true }
  | { ok: false; reason: "feel_words" | "repeated_word" | "adjective_list" | "certainty" | "bigger" | "time_words" };

export const CERTAINTY_PHRASES: readonly string[] = ["too early to call", "already in the water", "still in the water",
  "looks likely", "early look", "on the radar", "on the way", "likely", "due"];

// Task 6 mirrors these in Python: a phrase is whole when no letter or digit touches either end.
const STEM_SUFFIXES = ["ing", "es", "ed", "ly", "y", "s"];
const MIN_WORD = 4;
const ADJECTIVE_LIST = /(?:[\p{L}-]+,\s+){2,}(?:(?:and|or)\s+)?[\p{L}-]+/u;
const BIGGER = wholePhrase("bigger");
const FEEL_ENTRIES = BREAKER_WORDS.map((forms) => forms.map(wholePhrase));
const CERTAINTY_BY_LENGTH = [...CERTAINTY_PHRASES].sort((a, b) => b.length - a.length);
/** Parts of the day, read in order: the claim check counts them as a set, so it cannot tell an arrival's from a peak's. */
export const GLANCE_TIME_WORDS: readonly string[] = ["early", "morning", "midday", "afternoon", "evening", "night", "tonight", "overnight"];
const TIME_WORD = new RegExp(`(?<![\\p{L}\\p{N}])(?:${GLANCE_TIME_WORDS.join("|")})(?![\\p{L}\\p{N}])`, "giu");

function wholePhrase(phrase: string): RegExp {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, "giu");
}

function matches(text: string, pattern: RegExp): boolean {
  pattern.lastIndex = 0;
  return pattern.test(text);
}

function stem(token: string): string {
  const suffix = STEM_SUFFIXES.find((end) => token.endsWith(end) && token.length - end.length >= MIN_WORD);
  return suffix ? token.slice(0, -suffix.length) : token;
}

function stemCounts(text: string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const token of text.toLowerCase().match(/\p{L}+/gu) ?? []) {
    if (token.length < MIN_WORD) continue;
    const key = stem(token);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

function repeatsAWord(text: string, codeText: string): boolean {
  const code = stemCounts(codeText);
  return [...stemCounts(text)].some(([key, count]) => count > Math.max(1, code.get(key) ?? 0));
}

// Longest first, blanking each match, so "likely" never re-reads the "likely" inside "looks likely".
function certaintyPhrases(text: string): Set<string> {
  const found = new Set<string>();
  let rest = text;
  for (const phrase of CERTAINTY_BY_LENGTH) {
    const pattern = wholePhrase(phrase);
    if (!matches(rest, pattern)) continue;
    found.add(phrase);
    rest = rest.replace(pattern, (match) => " ".repeat(match.length));
  }
  return found;
}

function timeWords(text: string): string[] {
  return (text.match(TIME_WORD) ?? []).map((word) => word.toLowerCase());
}

function sameSet(a: ReadonlySet<string>, b: ReadonlySet<string>): boolean {
  return a.size === b.size && [...a].every((item) => b.has(item));
}

/**
 * Style rules the claim checker leaves alone: one feel word, no echoed words or comma lists, the code's certainty,
 * no unearned "bigger", and the code's parts of the day in the code's order.
 */
export function checkGlanceWording(text: string, codeText: string): GlanceWordingCheck {
  const feelEntries = FEEL_ENTRIES.filter((forms) => forms.some((form) => matches(text, form))).length;
  if (feelEntries > 1) return { ok: false, reason: "feel_words" };
  if (repeatsAWord(text, codeText)) return { ok: false, reason: "repeated_word" };
  if (ADJECTIVE_LIST.test(text)) return { ok: false, reason: "adjective_list" };
  if (!sameSet(certaintyPhrases(text), certaintyPhrases(codeText))) return { ok: false, reason: "certainty" };
  if (matches(text, BIGGER) && !matches(codeText, BIGGER)) return { ok: false, reason: "bigger" };
  if (timeWords(text).join(" ") !== timeWords(codeText).join(" ")) return { ok: false, reason: "time_words" };
  return { ok: true };
}

/** Each code sentence, or its written rewording when the fingerprint still matches and both checks pass. */
export function bindGlance(sentences: readonly GlanceSentence[], written: readonly GlanceWritten[] | undefined,
  beachNames: readonly string[], region: string): StoryGlance | null {
  if (sentences.length === 0) return null;
  const byFingerprint = new Map<string, GlanceWritten>();
  for (const entry of written ?? []) {
    if (!byFingerprint.has(entry.fingerprint)) byFingerprint.set(entry.fingerprint, entry);
  }
  const glance: StoryGlance = { sentences: [], source: [] };
  for (const sentence of sentences) {
    const entry = byFingerprint.get(sentence.fingerprint);
    // The claim check runs first: it refuses a non-string text that the wording check would throw on.
    const usable = entry !== undefined
      && checkWrittenSentence(entry.text, { text: sentence.text, facts: sentence.facts ?? undefined }, beachNames, [region]).ok
      && checkGlanceWording(entry.text, sentence.text).ok;
    glance.sentences.push(usable ? entry.text : sentence.text);
    glance.source.push(usable ? "written" : "code");
  }
  return glance;
}
