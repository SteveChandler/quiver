import {
  CUSTOM_SPOT_ANALYSIS_LABELS,
  getCustomSpotAnalysisState,
} from '@/lib/custom-spots/analysis-state';

describe('custom spot analysis state', () => {
  it.each([
    [{ terrainStatus: 'queued', provenanceState: 'unset', isOwner: true }, 'Analyzing location'],
    [{ terrainStatus: 'ok', provenanceState: 'modeled', isOwner: true }, 'Modeled from location'],
    [{ terrainStatus: 'ok', provenanceState: 'independently_reviewed', isOwner: true }, 'Independently reviewed'],
    [{ terrainStatus: 'ok', provenanceState: 'user_corrected', isOwner: true }, 'Customized by you'],
    [{ terrainStatus: null, provenanceState: 'unset', isOwner: true }, 'Using nearby beach defaults'],
    [{ terrainStatus: 'failed', provenanceState: 'failed', isOwner: true }, 'Analysis unavailable'],
  ])('maps persisted state to a compact label', (input, expected) => {
    const state = getCustomSpotAnalysisState(input);
    expect(CUSTOM_SPOT_ANALYSIS_LABELS[state]).toBe(expected);
  });

  it('does not expose another owner\'s correction provenance', () => {
    expect(CUSTOM_SPOT_ANALYSIS_LABELS[getCustomSpotAnalysisState({
      terrainStatus: 'ok', provenanceState: 'user_corrected', isOwner: false,
    })]).toBe('Modeled from location');
  });
});
