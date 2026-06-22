/**
 * Identifies which upstream feed produced the raw height input for the
 * face-height transformer. Calibrated shoaling buckets are valid only when
 * this is `cdip_sig`.
 */
export const WAVE_HEIGHT_SOURCE_TAGS = [
  "cdip_sig",
  "model_swell",
  "cdip_swell",
  "model_hs",
  "ndbc_buoy",
  "nowcast_anchor",
] as const;

export type WaveHeightSourceTag = (typeof WAVE_HEIGHT_SOURCE_TAGS)[number];

export const WAVE_HEIGHT_SOURCE_TAG_SET: ReadonlySet<WaveHeightSourceTag> =
  new Set(WAVE_HEIGHT_SOURCE_TAGS);
