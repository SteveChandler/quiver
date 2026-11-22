-- Recreate in a quiet window because the original build blocks writes.
CREATE INDEX IF NOT EXISTS idx_mpl_v5_shadow_comparator
  ON public.ml_predictions_log (predicted_at DESC, beach_id)
  WHERE
    observed_m IS NOT NULL
    AND wave_height_om IS NOT NULL
    AND v5_shadow_height_m IS NOT NULL
    AND offset_corrected_display_height_m IS NOT NULL;
