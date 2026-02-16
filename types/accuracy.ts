export interface YesterdayAccuracy {
  beach_id: string;
  forecast_date: string;
  avg_predicted_m: number;
  avg_observed_m: number;
  mae_m: number;
  relative_error_pct: number;
  observation_count: number;
  should_display: boolean;
}
