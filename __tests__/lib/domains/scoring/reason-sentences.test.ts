import {
  apiReasons,
  codeContradictsVerdict,
  dedupeReasons,
  formatHeightBand,
  formatReasonSentence,
  insertReason,
  joinSentences,
  leadReasonLine,
  personalLinesFirst,
  positiveReasons,
  prependReasons,
  reasonList,
  reasonsForVerdict,
  takeReasons,
  takeReasonsKeepingLead,
  waveSentencesFirst,
  withoutReason,
  type ScoringReasonFact,
} from '@/lib/domains/scoring/reason-sentences';
import { buildDiscoveryMessage } from '@/lib/services/discovery/response-formatter';

describe('formatReasonSentence', () => {
  // Approved copy (Steven, mock v2): the waves only, never the surfer's level or range.
  const cases: ReadonlyArray<[ScoringReasonFact, string]> = [
    [{ code: 'size_below_ideal', heightFt: 2.1 }, 'On the small side at 2–3 ft.'],
    [{ code: 'size_good', heightFt: 3.9 }, 'Good size at 3–4 ft.'],
    [{ code: 'size_larger', heightFt: 6.2 }, 'Bigger surf at 6–7 ft.'],
    [{ code: 'size_big', heightFt: 9.0 }, 'Big surf at 8–9 ft.'],
    [{ code: 'period_strong', periodS: 14.4 }, 'Long-period swell at 14 s, so the sets have real push.'],
    [{ code: 'period_good' }, 'Solid swell period behind it.'],
  ];

  it.each(cases)('%j reads "%s"', (fact, sentence) => {
    expect(formatReasonSentence(fact)).toBe(sentence);
  });

  it('never puts a decimal height in a size sentence', () => {
    for (const heightFt of [1.04, 2.55, 3.49, 7.81]) {
      expect(formatReasonSentence({ code: 'size_good', heightFt })).not.toMatch(/\d\.\d/);
    }
  });

  it('rounds the period to a whole second', () => {
    expect(formatReasonSentence({ code: 'period_strong', periodS: 15.6 })).toContain('at 16 s,');
  });

  it('formats a band for a card and Flat for no surf', () => {
    expect(formatHeightBand(3.3)).toBe('3–4 ft');
    expect(formatHeightBand(0)).toBe('Flat');
  });
});

describe('aligned reason lists', () => {
  const coded = reasonList(
    ['Good size at 3–4 ft.', 'Solid swell period behind it.', 'Good tide'],
    ['size_good', 'period_good', null],
  );

  it('treats a missing or misaligned code list as no codes', () => {
    expect(reasonList(['a', 'b']).reasonCodes).toEqual([null, null]);
    expect(reasonList(['a', 'b'], ['size_good']).reasonCodes).toEqual([null, null]);
  });

  it('keeps each code beside its text through prepend, insert, remove, dedupe and take', () => {
    let list = prependReasons(coded, ['Matches your go-to spot']);
    list = insertReason(list, 1, 'Best window of the day');
    list = withoutReason(list, 'Good tide');
    list = dedupeReasons(prependReasons(list, ['Best window of the day']));
    list = takeReasons(list, 4);
    expect(list).toEqual({
      reasons: ['Best window of the day', 'Matches your go-to spot', 'Good size at 3–4 ft.', 'Solid swell period behind it.'],
      reasonCodes: [null, null, 'size_good', 'period_good'],
    });
  });

  it('moves the wave sentences in front, order kept inside each group', () => {
    const list = prependReasons(coded, ['Conditions at Tamarack match your experience level today']);
    expect(waveSentencesFirst(list).reasons).toEqual([
      'Good size at 3–4 ft.',
      'Solid swell period behind it.',
      'Conditions at Tamarack match your experience level today',
      'Good tide',
    ]);
  });

  it('drops size_good and period lines beside a negative verdict only, by code', () => {
    expect(reasonsForVerdict(coded, true)).toEqual({ reasons: ['Good tide'], reasonCodes: [null] });
    expect(reasonsForVerdict(coded, false)).toEqual(coded);
    // Text that reads like a scorer sentence but carries no code is left alone.
    expect(reasonsForVerdict(reasonList(['Good size at 3–4 ft.']), true).reasons).toEqual(['Good size at 3–4 ft.']);
  });

  it('keeps small, larger and big size lines beside a negative verdict', () => {
    for (const code of ['size_below_ideal', 'size_larger', 'size_big'] as const) {
      expect(codeContradictsVerdict(code, true)).toBe(false);
    }
    expect(codeContradictsVerdict('period_strong', true)).toBe(true);
    expect(codeContradictsVerdict(null, true)).toBe(false);
  });

  it('sends discovery reasons wave-first and without a contradicting line', () => {
    const list = prependReasons(coded, ['Conditions at Tamarack match your experience level today']);
    expect(apiReasons(list, false).reasons[0]).toBe('Good size at 3–4 ft.');
    expect(apiReasons(list, true)).toEqual({
      reasons: ['Conditions at Tamarack match your experience level today', 'Good tide'],
      reasonCodes: [null, null],
    });
  });

  it('never lists the small-side sentence as a positive signal', () => {
    const list = reasonList(['On the small side at 2–3 ft.', 'Good tide'], ['size_below_ideal', null]);
    expect(positiveReasons(list).reasons).toEqual(['Good tide']);
  });
});

describe('joinSentences', () => {
  it('shows the approved sentences one after the other, with no clause join', () => {
    expect(joinSentences(['Good size at 3–4 ft.', 'Solid swell period behind it.']))
      .toBe('Good size at 3–4 ft. Solid swell period behind it.');
  });

  it('ends each part with one full stop and never gives ".."', () => {
    expect(joinSentences(['Good tide', 'Solid swell period behind it.', 'Board fit: longboard.']))
      .toBe('Good tide. Solid swell period behind it. Board fit: longboard.');
    expect(joinSentences([' ', ''])).toBe('');
  });
});

describe('cautions keep the lead', () => {
  const headsUp = 'Heads up: PB Point is pumping today — 3.5ft waves are above your usual range';
  const withCaution = prependReasons(
    reasonList(
      ['Good size at 3–4 ft.', 'Solid swell period behind it.', 'Good tide'],
      ['size_good', 'period_good', null],
    ),
    [headsUp],
    ['caution_big_surf'],
  );

  it('keeps a caution ahead of the wave sentences', () => {
    expect(waveSentencesFirst(withCaution).reasons.slice(0, 2)).toEqual([headsUp, 'Good size at 3–4 ft.']);
  });

  it('never removes a caution beside a negative verdict', () => {
    expect(apiReasons(withCaution, true).reasons).toEqual([headsUp, 'Good tide']);
    expect(codeContradictsVerdict('caution_big_surf', true)).toBe(false);
  });

  it('keeps the caution in the top two reasons of the message', () => {
    const message = buildDiscoveryMessage(55, apiReasons(withCaution, false).reasons, []);
    expect(message).toBe(`Maybe - ${headsUp}. Good size at 3–4 ft.`);
  });

  it('shows the caution first in the hero line', () => {
    expect(leadReasonLine(withCaution.reasons, withCaution.reasonCodes, false)).toBe(headsUp);
    expect(leadReasonLine(withCaution.reasons, withCaution.reasonCodes, true)).toBe(headsUp);
    expect(leadReasonLine([], [], false)).toBeNull();
  });

  it('keeps the tide and data cautions ahead of the wave sentences too', () => {
    const list = reasonList(
      ['Good size at 3–4 ft.', 'Tide back in range by ~1 PM', 'Wave forecasts disagree; check conditions before choosing this window.'],
      ['size_good', 'caution_tide', 'caution_sources_disagree'],
    );
    expect(waveSentencesFirst(list).reasons[2]).toBe('Good size at 3–4 ft.');
  });
});

describe('takeReasonsKeepingLead', () => {
  it('keeps every caution and the first wave sentence when it cuts', () => {
    const list = reasonList(
      ['P1', 'P2', 'P3', 'P4', 'P5', 'Good size at 3–4 ft.', 'Solid swell period behind it.', 'Tide back in range by ~1 PM'],
      [null, null, null, null, null, 'size_good', 'period_good', 'caution_tide'],
    );
    expect(takeReasonsKeepingLead(list, 5)).toEqual({
      reasons: ['P1', 'P2', 'P3', 'Good size at 3–4 ft.', 'Tide back in range by ~1 PM'],
      reasonCodes: [null, null, null, 'size_good', 'caution_tide'],
    });
  });

  it('leaves a short list alone and fills in list order when there is no wave sentence', () => {
    const short = reasonList(['a', 'b'], [null, 'size_good']);
    expect(takeReasonsKeepingLead(short, 5)).toBe(short);
    expect(takeReasonsKeepingLead(reasonList(['a', 'b', 'c']), 2).reasons).toEqual(['a', 'b']);
  });
});

describe('personalLinesFirst', () => {
  it('puts uncoded personal lines ahead of the coded ones, order kept', () => {
    const list = reasonList(['Good size at 3–4 ft.', 'Matches your break', 'Board fit: longboard'], ['size_good', null, null]);
    expect(personalLinesFirst(list).reasons).toEqual(['Matches your break', 'Board fit: longboard', 'Good size at 3–4 ft.']);
  });
});

describe('joinSentences punctuation', () => {
  it('keeps a final "!" or "?" and adds no full stop after it', () => {
    expect(joinSentences(['Firing!', 'Worth a look?', 'Good tide'])).toBe('Firing! Worth a look? Good tide.');
  });
});
