import {
  apiReasons,
  codeContradictsVerdict,
  dedupeReasons,
  formatHeightBand,
  formatReasonSentence,
  insertReason,
  joinSentences,
  positiveReasons,
  prependReasons,
  reasonList,
  reasonsForVerdict,
  takeReasons,
  waveSentencesFirst,
  withoutReason,
  type ScoringReasonFact,
} from '@/lib/domains/scoring/reason-sentences';

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
