import { tideFitScorer } from '@/lib/domains/scoring';
import type { ScorerInput } from '@/lib/domains/scoring';
import { createInput, DEFAULT_PROFILE, DEFAULT_SNAPSHOT } from '../__fixtures__';

function tideInput(heightFt: number, options: { explicitRange?: boolean; heightKnown?: boolean } = {}): ScorerInput {
  return createInput(
    { tide: { ...DEFAULT_SNAPSHOT.tide, heightFt, heightKnown: options.heightKnown ?? true } },
    {
      tidePreferences: {
        ...DEFAULT_PROFILE.tidePreferences,
        minHeightFt: 2,
        maxHeightFt: 4,
        explicitRange: options.explicitRange ?? true,
      },
    },
  );
}

describe('tideFitScorer curated tide band', () => {
  it('emits no effect inside the band or within the quarter-foot tolerance', () => {
    expect(tideFitScorer.score(tideInput(3.7)).effects).toBeUndefined();
    expect(tideFitScorer.score(tideInput(4.2)).effects).toBeUndefined();
    expect(tideFitScorer.score(tideInput(1.8)).effects).toBeUndefined();
  });

  it('caps a tide just above the band below EPIC (Ponto 8 AM, 4.4 ft vs 2-4 ft)', () => {
    expect(tideFitScorer.score(tideInput(4.4)).effects).toEqual([
      { code: 'tide_outside_band', severity: 'material', verdictCeiling: 79, message: 'Tide a bit high' },
    ]);
  });

  it('drops to FAIR territory beyond a foot and further beyond two feet', () => {
    expect(tideFitScorer.score(tideInput(0.5)).effects).toEqual([
      { code: 'tide_outside_band', severity: 'material', verdictCeiling: 69, message: 'Tide a bit low' },
    ]);
    expect(tideFitScorer.score(tideInput(6.5)).effects).toEqual([
      { code: 'tide_outside_band', severity: 'material', verdictCeiling: 55, message: 'Tide is high' },
    ]);
  });

  it('never caps on a default band or a missing tide reading', () => {
    expect(tideFitScorer.score(tideInput(6.5, { explicitRange: false })).effects).toBeUndefined();
    expect(tideFitScorer.score(tideInput(0, { heightKnown: false })).effects).toBeUndefined();
  });
});

describe('tideFitScorer tide swing (TIDE_SWING_ENABLED)', () => {
  const originalFlag = process.env.TIDE_SWING_ENABLED;
  afterEach(() => {
    if (originalFlag === undefined) delete process.env.TIDE_SWING_ENABLED;
    else process.env.TIDE_SWING_ENABLED = originalFlag;
  });

  function swingInput(heightFt: number, rateFtPerHour: number | null, profile: { explicitRange?: boolean; breakType?: string } = {}): ScorerInput {
    return createInput(
      {
        timestamp: new Date('2026-10-27T18:00:00Z'),
        tide: { heightFt, status: rateFtPerHour !== null && rateFtPerHour < 0 ? 'falling' : 'rising', direction: rateFtPerHour !== null && rateFtPerHour < 0 ? 'falling' : 'rising', heightKnown: true, rateFtPerHour },
      },
      {
        breakType: profile.breakType ?? 'beach',
        tidePreferences: {
          ...DEFAULT_PROFILE.tidePreferences,
          minHeightFt: 2,
          maxHeightFt: 4,
          explicitRange: profile.explicitRange ?? true,
        },
      },
    );
  }

  it('flag off ignores the rate: the band tiers are unchanged', () => {
    delete process.env.TIDE_SWING_ENABLED;
    expect(tideFitScorer.score(swingInput(6.5, -2.5)).effects).toEqual([
      { code: 'tide_outside_band', severity: 'material', verdictCeiling: 55, message: 'Tide is high' },
    ]);
    expect(tideFitScorer.score(swingInput(5.5, -2)).effects).toEqual([
      { code: 'tide_outside_band', severity: 'material', verdictCeiling: 69, message: 'Tide a bit high' },
    ]);
  });

  it('flag on without a rate keeps the band tiers exactly', () => {
    process.env.TIDE_SWING_ENABLED = 'true';
    expect(tideFitScorer.score(swingInput(4.4, null)).effects).toEqual([
      { code: 'tide_outside_band', severity: 'material', verdictCeiling: 79, message: 'Tide a bit high' },
    ]);
    expect(tideFitScorer.score(swingInput(6.5, null)).effects).toEqual([
      { code: 'tide_outside_band', severity: 'material', verdictCeiling: 55, message: 'Tide is high' },
    ]);
  });

  it('softens one tier when the tide is back in range within the hour', () => {
    process.env.TIDE_SWING_ENABLED = 'true';
    // Point break: no fast-fall walling, so only the band effect shows.
    // 2.5 ft over at 2.5 ft/h: back in at 12 PM PDT, 55 -> 69.
    expect(tideFitScorer.score(swingInput(6.5, -2.5, { breakType: 'point' })).effects).toEqual([
      { code: 'tide_outside_band', severity: 'material', verdictCeiling: 69, message: 'Tide back in range by ~12 PM' },
    ]);
    // 1.5 ft over at 2 ft/h: back in by 11:45, shown as ~12 PM; 69 -> 79.
    expect(tideFitScorer.score(swingInput(5.5, -2, { breakType: 'point' })).effects).toEqual([
      { code: 'tide_outside_band', severity: 'material', verdictCeiling: 79, message: 'Tide back in range by ~12 PM' },
    ]);
    // Moving away from the band never softens.
    expect(tideFitScorer.score(swingInput(5.5, 2, { breakType: 'point' })).effects?.[0]?.verdictCeiling).toBe(69);
  });

  it('stacks fast-fall walling on a beach break with the softened band tier', () => {
    process.env.TIDE_SWING_ENABLED = 'true';
    expect(tideFitScorer.score(swingInput(5.5, -2)).effects).toEqual([
      { code: 'tide_outside_band', severity: 'material', verdictCeiling: 79, message: 'Tide back in range by ~12 PM' },
      { code: 'tide_swing', severity: 'material', verdictCeiling: 69, message: 'Dropping fast, expect it to wall up as it drains' },
    ]);
  });

  it('is the one emitter of tide_swing effects, alongside the band ceiling', () => {
    process.env.TIDE_SWING_ENABLED = 'true';
    const result = tideFitScorer.score(swingInput(4.6, 0.1));
    expect(result.effects).toEqual([
      { code: 'tide_outside_band', severity: 'material', verdictCeiling: 79, message: 'Tide a bit high' },
      { code: 'tide_swing', severity: 'material', verdictCeiling: 69, message: 'Lots of water at the top of the tide' },
    ]);
    expect(result.score).toBe(85);
  });

  it('adds only rate effects on an unbanded beach and keeps its flat 70', () => {
    process.env.TIDE_SWING_ENABLED = 'true';
    const unbanded = createInput(
      { waveHeight: 4, wavePeriod: 12, tide: { heightFt: 4, status: 'falling', direction: 'falling', heightKnown: true, rateFtPerHour: -1.2 } },
      { breakType: 'beach', tidePreferences: { ...DEFAULT_PROFILE.tidePreferences, minHeightFt: -2, maxHeightFt: 8, explicitRange: false } },
    );
    const result = tideFitScorer.score(unbanded);
    expect(result.score).toBe(70);
    expect(result.effects).toEqual([
      { code: 'tide_swing', severity: 'material', verdictCeiling: 69, message: 'Dropping fast, expect it to wall up as it drains' },
    ]);
  });
});
