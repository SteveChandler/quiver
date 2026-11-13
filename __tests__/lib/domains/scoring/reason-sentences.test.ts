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
  formatBigSurfCaution,
  formatBoardFit,
  formatLightWind,
  formatMellowBreak,
  formatSmallSide,
  formatSmallSurf,
  formatTideNow,
  formatWindChop,
  isLeadCode,
  isWaveCode,
  SMALL_ONSHORE_SLOP,
  type BigSurfCaution,
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
    const list = prependReasons(coded, ['One of your go-to spots']);
    expect(waveSentencesFirst(list).reasons).toEqual([
      'Good size at 3–4 ft.',
      'Solid swell period behind it.',
      'One of your go-to spots',
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
    const list = prependReasons(coded, ['One of your go-to spots']);
    expect(apiReasons(list, false).reasons[0]).toBe('Good size at 3–4 ft.');
    expect(apiReasons(list, true)).toEqual({
      reasons: ['One of your go-to spots', 'Good tide'],
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
  const headsUp = 'Heads up: PB Point is pumping at 3–4 ft.';
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
    expect(message).toBe(`Maybe - ${headsUp} Good size at 3–4 ft.`);
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

describe('big-surf caution family (Steven, Nov 12 2026)', () => {
  const cases: ReadonlyArray<[string, BigSurfCaution, string]> = [
    ['row 9, a little over', { kind: 'over', heightFt: 4.6 }, 'Heads up: bigger surf today at 4–5 ft.'],
    ['row 8, well over', { kind: 'well_over', heightFt: 6.2 }, 'Heads up: much bigger surf today at 6–7 ft.'],
    ['row 7, far over', { kind: 'far_over', heightFt: 8.4 }, 'Heads up: a big jump in size today at 8–9 ft. Watch it from the beach first.'],
    ['row 6, advanced break', { kind: 'advanced_break', level: 'advanced', heightFt: 5.5 }, 'Heads up: an advanced break, with more size today at 5–6 ft.'],
    ['row 6, expert break', { kind: 'advanced_break', level: 'Expert', heightFt: 7.2 }, 'Heads up: an expert break, with more size today at 7–8 ft.'],
    ['row 6, article "a"', { kind: 'advanced_break', level: 'big-wave', heightFt: 5.5 }, 'Heads up: a big-wave break, with more size today at 5–6 ft.'],
    ['row 3, pumping', { kind: 'pumping', beachName: 'Blacks', heightFt: 6.4 }, 'Heads up: Blacks is pumping at 6–7 ft.'],
    ['override at a 12 ft low end', { kind: 'over', heightFt: 12.1 }, 'Heads up: big, powerful surf at 12–13 ft.'],
    ['override, far over', { kind: 'far_over', heightFt: 13.2 }, 'Heads up: big, powerful surf at 13–14 ft.'],
    ['override, advanced break', { kind: 'advanced_break', level: 'advanced', heightFt: 14 }, 'Heads up: big, powerful surf at 13–14 ft.'],
    ['override, pumping', { kind: 'pumping', beachName: 'Mavericks', heightFt: 20 }, 'Heads up: big, powerful surf at 19–20 ft.'],
    ['no override below a 12 ft low end', { kind: 'well_over', heightFt: 12 }, 'Heads up: much bigger surf today at 11–12 ft.'],
  ];

  it.each(cases)('%s', (_label, caution, text) => {
    expect(formatBigSurfCaution(caution)).toBe(text);
  });

  it('never names the surfer or uses an absolute danger word', () => {
    for (const [, caution] of cases) {
      expect(formatBigSurfCaution(caution)).not.toMatch(/your|skill|level|range|Dangerous|heavy/i);
    }
  });
});

describe('other level-free lines', () => {
  it.each([
    ['row 2', formatMellowBreak('advanced', 'Blacks', 2.2), "Blacks is an advanced break, but it's mellow today at 2–3 ft."],
    ['row 2, "a"', formatMellowBreak('beginner-intermediate', 'Shores', 2.2), "Shores is a beginner-intermediate break, but it's mellow today at 2–3 ft."],
    ['row 5', formatMellowBreak('advanced'), 'Advanced break, mellow today.'],
    ['row 10', formatSmallSurf(1.4), 'Small surf at 1–2 ft.'],
    ['row 10, no height', formatSmallSurf(Number.NaN), 'Small surf.'],
    ['row 11', formatSmallSide(2.4), 'On the small side at 2–3 ft.'],
    ['row 13', SMALL_ONSHORE_SLOP, 'Small, short-period onshore slop.'],
    ['row 14', formatWindChop('Choppy', 'onshore', 18.9), 'Choppy onshore wind at 18 mph chops it up.'],
    ['row 16', formatLightWind('NE'), 'Light NE wind.'],
    ['row 17', formatTideNow('rising'), 'Rising tide.'],
    ['row 20, big', formatBoardFit('big', 'longboard', 5.5), 'Big for a longboard at 5–6 ft.'],
    ['row 20, small', formatBoardFit('small', 'shortboard', 1.5), 'Small for a shortboard at 1–2 ft.'],
    ['row 20, good', formatBoardFit('good', 'longboard', 2.5), 'Good longboard size at 2–3 ft.'],
  ])('%s', (_label, text, expected) => {
    expect(text).toBe(expected);
  });
});

describe('context codes neither lead nor count as wave sentences', () => {
  it('keeps a caution first, then waves, then context lines', () => {
    const list = reasonList(
      ['Advanced break, mellow today.', 'Good size at 3–4 ft.', 'Heads up: Blacks is pumping at 6–7 ft.', 'Light NE wind.'],
      ['break_mellow', 'size_good', 'caution_big_surf', 'wind_light'],
    );
    expect(waveSentencesFirst(list).reasons).toEqual([
      'Heads up: Blacks is pumping at 6–7 ft.',
      'Good size at 3–4 ft.',
      'Advanced break, mellow today.',
      'Light NE wind.',
    ]);
    expect(isLeadCode('break_mellow')).toBe(false);
    expect(isLeadCode('caution_size_over')).toBe(true);
    expect(isWaveCode('cap_small_surf')).toBe(false);
  });
});
