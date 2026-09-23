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
