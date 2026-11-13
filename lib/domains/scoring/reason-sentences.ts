/**
 * Surf reason sentences.
 *
 * The base-conditions scorer emits facts (a code plus the numbers); this module
 * is the one place that turns a fact into the sentence a surfer reads. The API
 * text fields (`reasons`, `positives`, `takeaway`, `summary`, `message`) carry
 * these sentences, so installed app builds show them with no update.
 *
 * Inside the server the code travels beside the text as an aligned list
 * (`reasonCodes[i]` belongs to `reasons[i]`, null for text from another layer),
 * so no reader recovers a code from words.
 *
 * Steven's rule: a sentence describes the waves only. It never refers to the
 * surfer's level, range or usual size.
 */

import { formatWaveHeightRange } from '@/lib/formatters/surf-data';

type ScoringSizeReasonCode =
  | 'size_below_ideal'
  | 'size_good'
  | 'size_larger'
  | 'size_big';

export type ScoringReasonCode = ScoringSizeReasonCode | 'period_strong' | 'period_good';

/**
 * A caution leads its line on purpose (a safety or data warning placed in
 * `reasons`). It is not a scorer code: no reorder puts it behind a wave
 * sentence and no verdict rule removes it.
 */
export type CautionReasonCode = 'caution_big_surf' | 'caution_sources_disagree' | 'caution_tide';

/** The code beside one reason; null for other text. */
export type ReasonCode = ScoringReasonCode | CautionReasonCode | null;

function isCaution(code: ReasonCode | undefined): boolean {
  return code != null && code.startsWith('caution_');
}

export type ScoringReasonFact =
  | { readonly code: ScoringSizeReasonCode; readonly heightFt: number }
  | { readonly code: 'period_strong'; readonly periodS: number }
  | { readonly code: 'period_good' };

/** "3–4 ft": the band the app shows (same bracket and dash as the Daily Call `swellPhrase`). */
export function formatHeightBand(heightFt: number): string {
  return formatWaveHeightRange(heightFt).replace('-', '–').replace(/ft$/, ' ft');
}

export function formatReasonSentence(fact: ScoringReasonFact): string {
  switch (fact.code) {
    case 'size_below_ideal':
      return `On the small side at ${formatHeightBand(fact.heightFt)}.`;
    case 'size_good':
      return `Good size at ${formatHeightBand(fact.heightFt)}.`;
    case 'size_larger':
      return `Bigger surf at ${formatHeightBand(fact.heightFt)}.`;
    case 'size_big':
      return `Big surf at ${formatHeightBand(fact.heightFt)}.`;
    case 'period_strong':
      return `Long-period swell at ${Math.round(fact.periodS)} s, so the sets have real push.`;
    case 'period_good':
      return 'Solid swell period behind it.';
  }
}

// ---------------------------------------------------------------------------
// Aligned reason lists
// ---------------------------------------------------------------------------

export interface ReasonList {
  readonly reasons: string[];
  readonly reasonCodes: ReasonCode[];
}

/**
 * Pairs reasons with their codes. A missing or misaligned code list reads as
 * "no codes": every rule below then leaves the text alone.
 */
export function reasonList(
  reasons: readonly string[],
  reasonCodes?: readonly ReasonCode[] | null,
): ReasonList {
  const aligned = reasonCodes && reasonCodes.length === reasons.length;
  return {
    reasons: [...reasons],
    reasonCodes: aligned ? [...reasonCodes] : reasons.map(() => null),
  };
}

/** Text from another layer (personalization, board fit, distance) goes in front; uncoded unless codes are given. */
export function prependReasons(
  list: ReasonList,
  texts: readonly string[],
  codes?: readonly ReasonCode[],
): ReasonList {
  return {
    reasons: [...texts, ...list.reasons],
    reasonCodes: [...texts.map((_, index) => codes?.[index] ?? null), ...list.reasonCodes],
  };
}

export function insertReason(list: ReasonList, index: number, text: string): ReasonList {
  const reasons = [...list.reasons];
  const reasonCodes = [...list.reasonCodes];
  reasons.splice(index, 0, text);
  reasonCodes.splice(index, 0, null);
  return { reasons, reasonCodes };
}

export function withoutReason(list: ReasonList, text: string): ReasonList {
  return filterList(list, (reason) => reason !== text);
}

export function takeReasons(list: ReasonList, count: number): ReasonList {
  return { reasons: list.reasons.slice(0, count), reasonCodes: list.reasonCodes.slice(0, count) };
}

/**
 * Cuts the list to `count` but keeps every caution and the first wave sentence
 * (when one exists), so a cut that runs before `waveSentencesFirst` never drops
 * them. The rest fill the free places in list order; the kept items keep their order.
 */
export function takeReasonsKeepingLead(list: ReasonList, count: number): ReasonList {
  if (list.reasons.length <= count) return list;
  const keep = new Set<number>();
  list.reasonCodes.forEach((code, index) => {
    if (isCaution(code) && keep.size < count) keep.add(index);
  });
  const firstWave = list.reasonCodes.findIndex((code) => code != null && !isCaution(code));
  if (firstWave >= 0 && keep.size < count) keep.add(firstWave);
  for (let index = 0; index < list.reasons.length && keep.size < count; index += 1) keep.add(index);
  return filterList(list, (_, __, index) => keep.has(index));
}

/** First occurrence wins, with its code. */
export function dedupeReasons(list: ReasonList): ReasonList {
  const seen = new Set<string>();
  return filterList(list, (reason) => {
    if (seen.has(reason)) return false;
    seen.add(reason);
    return true;
  });
}

/** Cautions first, then the wave sentences, then other text; the order inside each group stays. */
function leadRank(code: ReasonCode | undefined): number {
  if (isCaution(code)) return 0;
  return code == null ? 2 : 1;
}

export function waveSentencesFirst(list: ReasonList): ReasonList {
  const order = list.reasons.map((_, index) => index);
  order.sort((a, b) => leadRank(list.reasonCodes[a]) - leadRank(list.reasonCodes[b]) || a - b);
  return {
    reasons: order.map((index) => list.reasons[index]),
    reasonCodes: order.map((index) => list.reasonCodes[index]),
  };
}

const CONTRADICTS_NEGATIVE_VERDICT: ReadonlySet<ReasonCode> = new Set<ReasonCode>([
  'size_good',
  'period_strong',
  'period_good',
]);

/**
 * True when the reason must not show beside a negative verdict (POOR, FLAT,
 * Skip, MEH, "no"): "Good size" under a skip reads as a contradiction, and the
 * verdict already explains the day.
 */
export function codeContradictsVerdict(code: ReasonCode | undefined, negativeVerdict: boolean): boolean {
  return negativeVerdict && code != null && CONTRADICTS_NEGATIVE_VERDICT.has(code);
}

/** Drops the reasons that contradict a negative verdict, order kept. */
export function reasonsForVerdict(list: ReasonList, negativeVerdict: boolean): ReasonList {
  return filterList(list, (_, code) => !codeContradictsVerdict(code, negativeVerdict));
}

/**
 * The list a discovery recommendation sends: wave sentences first, and no line
 * that contradicts a negative verdict, so installed builds read the same list.
 */
export function apiReasons(list: ReasonList, negativeVerdict: boolean): ReasonList {
  return reasonsForVerdict(waveSentencesFirst(list), negativeVerdict);
}

/** The one line a hero shows: the first reason of the API order (a caution, else a wave sentence). */
export function leadReasonLine(
  reasons: readonly string[] | null | undefined,
  reasonCodes: readonly ReasonCode[] | null | undefined,
  negativeVerdict: boolean,
): string | null {
  if (!reasons || reasons.length === 0) return null;
  return apiReasons(reasonList(reasons, reasonCodes), negativeVerdict).reasons[0] ?? null;
}

/**
 * The personal explanation reads the personal lines (personalization, board
 * fit, skill match): cautions first, then text with no code, then the wave
 * sentences, each group in list order. This undoes the wave-first API order
 * for that one field.
 */
export function personalLinesFirst(list: ReasonList): ReasonList {
  // A caution still leads: the app reads this field first, so a cut must never drop it.
  const rank = (code: ReasonCode | undefined): number => (isCaution(code) ? 0 : code == null ? 1 : 2);
  const order = list.reasons.map((_, index) => index);
  order.sort((a, b) => rank(list.reasonCodes[a]) - rank(list.reasonCodes[b]) || a - b);
  return {
    reasons: order.map((index) => list.reasons[index]),
    reasonCodes: order.map((index) => list.reasonCodes[index]),
  };
}

/** A positive-signal list never carries the "small side" sentence. */
export function positiveReasons(list: ReasonList): ReasonList {
  return filterList(list, (_, code) => code !== 'size_below_ideal');
}

/**
 * Whole sentences, one after the other. A part that already ends in "!" or "?"
 * keeps it; any other part ends with exactly one full stop.
 */
export function joinSentences(parts: readonly string[]): string {
  return parts
    .map((part) => part.trim().replace(/\.+$/, ''))
    .filter((part) => part !== '')
    .map((part) => (/[!?]$/.test(part) ? part : `${part}.`))
    .join(' ');
}

function filterList(
  list: ReasonList,
  keep: (reason: string, code: ReasonCode, index: number) => boolean,
): ReasonList {
  const reasons: string[] = [];
  const reasonCodes: ReasonCode[] = [];
  list.reasons.forEach((reason, index) => {
    const code = list.reasonCodes[index] ?? null;
    if (!keep(reason, code, index)) return;
    reasons.push(reason);
    reasonCodes.push(code);
  });
  return { reasons, reasonCodes };
}
