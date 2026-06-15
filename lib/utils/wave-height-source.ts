/**
 * Identifies which upstream feed produced the raw height input for the
 * face-height transformer. Calibrated shoaling buckets are valid only when
 * this is `cdip_sig`.
 */
export type WaveHeightSourceTag =
  | 'cdip_sig'
  | 'model_swell'
  | 'cdip_swell'
  | 'model_hs'
  | 'ndbc_buoy'
  | 'nowcast_anchor';
