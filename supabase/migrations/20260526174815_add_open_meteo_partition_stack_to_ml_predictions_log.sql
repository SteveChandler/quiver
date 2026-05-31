alter table public.ml_predictions_log
  add column if not exists wave_peak_period_om real check (
    wave_peak_period_om is null
    or (wave_peak_period_om >= 0 and wave_peak_period_om <= 30)
  );

alter table public.ml_predictions_log
  add column if not exists wind_wave_period_om real check (
    wind_wave_period_om is null
    or (wind_wave_period_om >= 0 and wind_wave_period_om <= 30)
  );

alter table public.ml_predictions_log
  add column if not exists wind_wave_direction_om real check (
    wind_wave_direction_om is null
    or (wind_wave_direction_om >= 0 and wind_wave_direction_om <= 360)
  );

alter table public.ml_predictions_log
  add column if not exists wind_wave_peak_period_om real check (
    wind_wave_peak_period_om is null
    or (wind_wave_peak_period_om >= 0 and wind_wave_peak_period_om <= 30)
  );

alter table public.ml_predictions_log
  add column if not exists swell_wave_peak_period_om real check (
    swell_wave_peak_period_om is null
    or (swell_wave_peak_period_om >= 0 and swell_wave_peak_period_om <= 30)
  );

alter table public.ml_predictions_log
  add column if not exists secondary_swell_height_om real check (
    secondary_swell_height_om is null
    or (secondary_swell_height_om >= 0 and secondary_swell_height_om <= 30)
  );

alter table public.ml_predictions_log
  add column if not exists secondary_swell_period_om real check (
    secondary_swell_period_om is null
    or (secondary_swell_period_om >= 0 and secondary_swell_period_om <= 30)
  );

alter table public.ml_predictions_log
  add column if not exists secondary_swell_direction_om real check (
    secondary_swell_direction_om is null
    or (secondary_swell_direction_om >= 0 and secondary_swell_direction_om <= 360)
  );

alter table public.ml_predictions_log
  add column if not exists tertiary_swell_height_om real check (
    tertiary_swell_height_om is null
    or (tertiary_swell_height_om >= 0 and tertiary_swell_height_om <= 30)
  );

alter table public.ml_predictions_log
  add column if not exists tertiary_swell_period_om real check (
    tertiary_swell_period_om is null
    or (tertiary_swell_period_om >= 0 and tertiary_swell_period_om <= 30)
  );

alter table public.ml_predictions_log
  add column if not exists tertiary_swell_direction_om real check (
    tertiary_swell_direction_om is null
    or (tertiary_swell_direction_om >= 0 and tertiary_swell_direction_om <= 360)
  );

alter table public.ml_predictions_log
  add column if not exists om_wind_wave_missing boolean;

alter table public.ml_predictions_log
  add column if not exists om_primary_swell_missing boolean;

alter table public.ml_predictions_log
  add column if not exists om_secondary_swell_missing boolean;

alter table public.ml_predictions_log
  add column if not exists om_tertiary_swell_missing boolean;

alter table public.ml_predictions_log
  add column if not exists om_partition_schema_version integer check (
    om_partition_schema_version is null
    or om_partition_schema_version >= 1
  );
