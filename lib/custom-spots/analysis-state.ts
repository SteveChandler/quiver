export type CustomSpotAnalysisState =
  | 'analyzing_location'
  | 'modeled_from_location'
  | 'independently_reviewed'
  | 'customized_by_you'
  | 'using_nearby_beach_defaults'
  | 'analysis_unavailable';

export const CUSTOM_SPOT_ANALYSIS_LABELS: Record<CustomSpotAnalysisState, string> = {
  analyzing_location: 'Analyzing location',
  modeled_from_location: 'Modeled from location',
  independently_reviewed: 'Independently reviewed',
  customized_by_you: 'Customized by you',
  using_nearby_beach_defaults: 'Using nearby beach defaults',
  analysis_unavailable: 'Analysis unavailable',
};

export function getCustomSpotAnalysisState(input: {
  terrainStatus?: string | null;
  provenanceState?: string | null;
  isOwner: boolean;
}): CustomSpotAnalysisState {
  if (!input.isOwner) {
    if (input.terrainStatus === 'queued' || input.terrainStatus === 'processing') {
      return 'analyzing_location';
    }
    if (input.terrainStatus === 'ok') return 'modeled_from_location';
    if (input.terrainStatus === 'failed') return 'analysis_unavailable';
    return 'using_nearby_beach_defaults';
  }
  if (input.provenanceState === 'user_corrected') {
    return 'customized_by_you';
  }
  if (input.provenanceState === 'independently_reviewed') return 'independently_reviewed';
  if (input.terrainStatus === 'queued' || input.terrainStatus === 'processing') {
    return 'analyzing_location';
  }
  if (input.terrainStatus === 'ok' && input.provenanceState === 'modeled') {
    return 'modeled_from_location';
  }
  if (input.terrainStatus === 'failed' || input.provenanceState === 'failed') {
    return 'analysis_unavailable';
  }
  return 'using_nearby_beach_defaults';
}
