import {
  formatReasonSentence,
  joinReasonSentences,
  reasonContradictsVerdict,
  reasonFactFor,
  reasonsForVerdict,
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
});

describe('reason codes beside a verdict', () => {
  const facts: ScoringReasonFact[] = [
    { code: 'size_good', heightFt: 3.9 },
    { code: 'period_good' },
  ];

  it('finds the fact behind a scorer sentence and none for other text', () => {
    expect(reasonFactFor('Good size at 3–4 ft.', facts)?.code).toBe('size_good');
    expect(reasonFactFor('Good tide', facts)).toBeNull();
    expect(reasonFactFor('Good size at 3–4 ft.', undefined)).toBeNull();
  });

  it('drops size_good and period lines beside a negative verdict only', () => {
    const reasons = ['Good size at 3–4 ft.', 'Solid swell period behind it.', 'Good tide'];
    expect(reasonsForVerdict(reasons, facts, true)).toEqual(['Good tide']);
    expect(reasonsForVerdict(reasons, facts, false)).toEqual(reasons);
  });

  it('keeps small, larger and big size lines beside a negative verdict', () => {
    const sizeFacts: ScoringReasonFact[] = [
      { code: 'size_below_ideal', heightFt: 2.1 },
      { code: 'size_larger', heightFt: 6.2 },
      { code: 'size_big', heightFt: 9 },
    ];
    for (const fact of sizeFacts) {
      expect(reasonContradictsVerdict(formatReasonSentence(fact), sizeFacts, true)).toBe(false);
    }
    expect(reasonContradictsVerdict('Long-period swell at 14 s, so the sets have real push.', [{ code: 'period_strong', periodS: 14 }], true)).toBe(true);
  });
});

describe('joinReasonSentences', () => {
  it('joins two scorer sentences into one', () => {
    expect(joinReasonSentences(['Good size at 3–4 ft.', 'Solid swell period behind it.'], [
      { code: 'size_good', heightFt: 3.9 },
      { code: 'period_good' },
    ])).toBe('Good size at 3–4 ft, with solid swell period behind it.');
  });

  it('joins size and a strong period', () => {
    expect(joinReasonSentences(
      ['Bigger surf at 6–7 ft.', 'Long-period swell at 14 s, so the sets have real push.'],
      [{ code: 'size_larger', heightFt: 6.2 }, { code: 'period_strong', periodS: 14 }],
    )).toBe('Bigger surf at 6–7 ft, with long-period swell at 14 s, so the sets have real push.');
  });

  it('keeps other text as its own sentence, case kept', () => {
    expect(joinReasonSentences(
      ['Good size at 3–4 ft.', 'Malibu Third Point is a classic wave'],
      [{ code: 'size_good', heightFt: 3.9 }],
    )).toBe('Good size at 3–4 ft. Malibu Third Point is a classic wave.');
  });

  it('ends one reason with one full stop', () => {
    expect(joinReasonSentences(['Good tide'], [])).toBe('Good tide.');
    expect(joinReasonSentences(['Solid swell period behind it.'], [{ code: 'period_good' }])).toBe('Solid swell period behind it.');
    expect(joinReasonSentences([], [])).toBe('');
  });
});
