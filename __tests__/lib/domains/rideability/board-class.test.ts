import {
  BOARD_CLASSES,
  mapBoardTypeToBoardClass,
  normalizeBoardClass,
  parseBoardClass,
  type BoardClass,
} from '@/lib/domains/rideability';

describe('rideability board class domain', () => {
  it('exposes the full canonical board class contract', () => {
    const expected: readonly BoardClass[] = [
      'foamie',
      'longboard',
      'mid-length',
      'funboard',
      'fish',
      'shortboard',
      'step-up',
      'gun',
      'sup',
      'foil',
      'bodyboard',
    ];

    expect(BOARD_CLASSES).toEqual(expected);
    expect(BOARD_CLASSES).toContain('mid-length');
    expect(BOARD_CLASSES).toContain('step-up');
    expect(BOARD_CLASSES).toContain('gun');
    expect(BOARD_CLASSES).toContain('foil');
  });

  it('normalizes canonical classes across case, whitespace, hyphens, and underscores', () => {
    expect(normalizeBoardClass(' MID LENGTH ')).toBe('mid-length');
    expect(normalizeBoardClass('mid_length')).toBe('mid-length');
    expect(normalizeBoardClass('Step Up')).toBe('step-up');
    expect(normalizeBoardClass('STEP_UP')).toBe('step-up');
    expect(normalizeBoardClass('long-board')).toBe('longboard');
  });

  it('maps supported aliases to canonical board classes', () => {
    expect(normalizeBoardClass('softboard')).toBe('foamie');
    expect(normalizeBoardClass('soft board')).toBe('foamie');
    expect(normalizeBoardClass('soft-top')).toBe('foamie');
    expect(normalizeBoardClass('thruster')).toBe('shortboard');
    expect(normalizeBoardClass('twin-pin')).toBe('fish');
    expect(normalizeBoardClass('standuppaddle')).toBe('sup');
    expect(normalizeBoardClass('standuppaddleboard')).toBe('sup');
    expect(normalizeBoardClass('stand up paddle board')).toBe('sup');
    expect(normalizeBoardClass('unknown')).toBeNull();
  });

  it('keeps parser and fallback compatibility APIs aligned with the canonical normalizer', () => {
    expect(parseBoardClass('foil')).toBe('foil');
    expect(parseBoardClass('gun')).toBe('gun');
    expect(parseBoardClass('step-up')).toBe('step-up');
    expect(mapBoardTypeToBoardClass('custom shape')).toBe('foamie');
  });
});
