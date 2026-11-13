/**
 * Surf reason sentences.
 *
 * The base-conditions scorer emits facts (a code plus the numbers); this module
 * is the one place that turns a fact into the sentence a surfer reads. The API
 * text fields (`reasons`, `positives`, `takeaway`, `summary`, `message`) carry
 * these sentences, so installed app builds show them with no update.
 *
 * Steven's rule: a sentence describes the waves only. It never refers to the
 * surfer's level, range or usual size.
 */

import { formatWaveHeightRange } from '@/lib/formatters/surf-data';

export type ScoringSizeReasonCode =
  | 'size_below_ideal'
  | 'size_good'
  | 'size_larger'
  | 'size_big';

export type ScoringReasonCode = ScoringSizeReasonCode | 'period_strong' | 'period_good';

export type ScoringReasonFact =
  | { readonly code: ScoringSizeReasonCode; readonly heightFt: number }
  | { readonly code: 'period_strong'; readonly periodS: number }
  | { readonly code: 'period_good' };

/** "3–4 ft": the band the app shows (same bracket and dash as the Daily Call `swellPhrase`). */
function heightBand(heightFt: number): string {
  return formatWaveHeightRange(heightFt).replace('-', '–').replace(/ft$/, ' ft');
}

export function formatReasonSentence(fact: ScoringReasonFact): string {
  switch (fact.code) {
    case 'size_below_ideal':
      return `On the small side at ${heightBand(fact.heightFt)}.`;
    case 'size_good':
      return `Good size at ${heightBand(fact.heightFt)}.`;
    case 'size_larger':
      return `Bigger surf at ${heightBand(fact.heightFt)}.`;
    case 'size_big':
      return `Big surf at ${heightBand(fact.heightFt)}.`;
    case 'period_strong':
      return `Long-period swell at ${Math.round(fact.periodS)} s, so the sets have real push.`;
    case 'period_good':
      return 'Solid swell period behind it.';
  }
}

/**
 * The fact a shown reason came from, or null for text from another scorer or
 * layer. `reasons` stays a string list for the API, so the code travels beside
 * it as `reasonFacts`; equality with this module's own output links the two.
 */
export function reasonFactFor(
  reason: string,
  facts: readonly ScoringReasonFact[] | null | undefined,
): ScoringReasonFact | null {
  if (!facts || facts.length === 0) return null;
  return facts.find((fact) => formatReasonSentence(fact) === reason) ?? null;
}

const CONTRADICTS_NEGATIVE_VERDICT: ReadonlySet<ScoringReasonCode> = new Set([
  'size_good',
  'period_strong',
  'period_good',
]);

/**
 * True when the reason must not show beside a negative verdict (POOR, FLAT,
 * Skip, MEH, "no"): "Good size" under a skip reads as a contradiction, and the
 * verdict already explains the day.
 */
export function reasonContradictsVerdict(
  reason: string,
  facts: readonly ScoringReasonFact[] | null | undefined,
  negativeVerdict: boolean,
): boolean {
  if (!negativeVerdict) return false;
  const fact = reasonFactFor(reason, facts);
  return fact !== null && CONTRADICTS_NEGATIVE_VERDICT.has(fact.code);
}

/** Reasons that may show beside the verdict, order kept. */
export function reasonsForVerdict(
  reasons: readonly string[],
  facts: readonly ScoringReasonFact[] | null | undefined,
  negativeVerdict: boolean,
): string[] {
  return reasons.filter((reason) => !reasonContradictsVerdict(reason, facts, negativeVerdict));
}

function withoutFinalStop(text: string): string {
  return text.trim().replace(/\.+$/, '');
}

export function asSentence(text: string): string {
  const body = withoutFinalStop(text);
  return body ? `${body}.` : '';
}

/**
 * Two reasons as prose. Two scorer sentences read as one ("Good size at 3–4 ft,
 * with solid swell period behind it."). Other text can start with a place
 * name, so it is not lower-cased into a clause; it stays its own sentence.
 */
export function joinReasonSentences(
  reasons: readonly string[],
  facts: readonly ScoringReasonFact[] | null | undefined,
): string {
  const [first, second] = reasons.filter((reason) => withoutFinalStop(reason) !== '');
  if (!first) return '';
  if (!second) return asSentence(first);
  if (reasonFactFor(first, facts) && reasonFactFor(second, facts)) {
    const clause = withoutFinalStop(second);
    return `${withoutFinalStop(first)}, with ${clause.charAt(0).toLowerCase()}${clause.slice(1)}.`;
  }
  return `${asSentence(first)} ${asSentence(second)}`;
}
