"""Extract training data from Supabase."""
import pandas as pd
from supabase import create_client
from config import SUPABASE_URL, SUPABASE_SERVICE_KEY, MAX_TIME_DIFF_SECONDS
from parsing import parse_wave_height, parse_wind_speed

TRAINING_QUERY = """
WITH forecasts AS (
  SELECT
    ef.beach_id,
    (ef.forecast_date + ef.forecast_time) AT TIME ZONE COALESCE(b.timezone, 'America/Los_Angeles') AS forecast_ts_utc,
    ef.wave_height,
    ef.wave_period,
    ef.wave_direction,
    ef.wind_speed,
    ef.wind_direction
  FROM enhanced_forecasts ef
  JOIN beaches b ON ef.beach_id = b.id
  WHERE ef.data_source = 'NOAA_NWS'
),
observations AS (
  SELECT
    beach_id,
    ts AS observed_ts,
    wave_height_m,
    wave_period_s,
    wave_direction_deg
  FROM marine_forecasts
  WHERE is_observed = true
    AND source IN ('cdip', 'ndbc')
    AND wave_height_m IS NOT NULL
)
SELECT
  f.beach_id,
  f.forecast_ts_utc,
  f.wave_height AS forecast_height_text,
  f.wave_period AS forecast_period_text,
  f.wave_direction AS forecast_dir_text,
  f.wind_speed AS wind_speed_text,
  f.wind_direction AS wind_dir_text,
  o.wave_height_m AS observed_height_m,
  o.wave_period_s AS observed_period_s,
  o.wave_direction_deg AS observed_dir_deg,
  o.observed_ts
FROM forecasts f
JOIN observations o
  ON f.beach_id = o.beach_id
  AND ABS(EXTRACT(EPOCH FROM (f.forecast_ts_utc - o.observed_ts))) < {max_time_diff}
ORDER BY f.forecast_ts_utc
""".format(max_time_diff=MAX_TIME_DIFF_SECONDS)


def extract_training_data(output_path: str = "data/training_data.csv") -> pd.DataFrame:
    """
    Extract forecast-observation pairs from Supabase.

    Returns:
        DataFrame with parsed numeric features and target (residual)
    """
    print("Connecting to Supabase...")
    supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    print("Executing training data query...")
    result = supabase.rpc('exec_sql', {'query': TRAINING_QUERY}).execute()

    if not result.data:
        # Fallback: execute raw SQL
        print("Using direct query fallback...")
        result = supabase.from_('enhanced_forecasts').select('*').limit(1).execute()
        raise NotImplementedError("Direct SQL execution not available. Export data manually.")

    df = pd.DataFrame(result.data)
    print(f"Retrieved {len(df)} raw rows")

    # Parse text fields to numeric
    df['forecast_height_m'] = df['forecast_height_text'].apply(parse_wave_height)
    df['forecast_period_s'] = pd.to_numeric(df['forecast_period_text'], errors='coerce')
    df['forecast_dir_deg'] = pd.to_numeric(df['forecast_dir_text'], errors='coerce')
    df['wind_speed_ms'] = df['wind_speed_text'].apply(parse_wind_speed)
    df['wind_dir_deg'] = pd.to_numeric(df['wind_dir_text'], errors='coerce')

    # Calculate target: residual (observed - forecast)
    df['residual_m'] = df['observed_height_m'] - df['forecast_height_m']

    # Drop rows with missing critical values
    required_cols = ['forecast_height_m', 'observed_height_m', 'residual_m']
    df_clean = df.dropna(subset=required_cols)

    # Fill missing optional values (match inference behavior)
    df_clean['wind_speed_ms'] = df_clean['wind_speed_ms'].fillna(0)
    df_clean['wind_dir_deg'] = df_clean['wind_dir_deg'].fillna(270)
    df_clean['forecast_period_s'] = df_clean['forecast_period_s'].fillna(10)
    df_clean['forecast_dir_deg'] = df_clean['forecast_dir_deg'].fillna(270)

    print(f"Clean dataset: {len(df_clean)} rows ({len(df_clean)/len(df)*100:.1f}% retained)")

    # Select final columns
    final_cols = [
        'beach_id', 'forecast_ts_utc', 'observed_ts',
        'forecast_height_m', 'observed_height_m', 'residual_m',
        'forecast_period_s', 'forecast_dir_deg',
        'wind_speed_ms', 'wind_dir_deg'
    ]
    df_final = df_clean[final_cols]

    # Save to file
    import os
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    df_final.to_csv(output_path, index=False)
    print(f"Saved training data to {output_path}")

    return df_final


if __name__ == "__main__":
    df = extract_training_data()
    print(f"\nDataset summary:")
    print(f"  Rows: {len(df)}")
    print(f"  Date range: {df['forecast_ts_utc'].min()} to {df['forecast_ts_utc'].max()}")
    print(f"  Mean residual: {df['residual_m'].mean():.3f}m")
    print(f"  Std residual: {df['residual_m'].std():.3f}m")
