"""Extract training data from Supabase."""
import os

import pandas as pd
from supabase import create_client
from config import SUPABASE_URL, SUPABASE_SERVICE_KEY, MAX_TIME_DIFF_SECONDS
from parsing import parse_wave_height, parse_wind_speed


def extract_training_data(output_path: str = "data/training_data.csv") -> pd.DataFrame:
    """
    Extract forecast-observation pairs from Supabase.

    Returns:
        DataFrame with parsed numeric features and target (residual)
    """
    print("Connecting to Supabase...")
    supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    # Fetch forecasts from enhanced_forecasts
    print("Fetching NOAA forecasts...")
    forecasts_result = supabase.from_('enhanced_forecasts').select(
        'beach_id, forecast_date, forecast_time, wave_height, wave_period, wave_direction, wind_speed, wind_direction'
    ).eq('data_source', 'NOAA_NWS').execute()

    forecasts_df = pd.DataFrame(forecasts_result.data)
    print(f"  Retrieved {len(forecasts_df)} forecasts")

    if len(forecasts_df) == 0:
        print("No forecasts found")
        return pd.DataFrame()

    # Fetch observations from marine_forecasts
    print("Fetching observations...")
    obs_result = supabase.from_('marine_forecasts').select(
        'beach_id, ts, wave_height_m, wave_period_s, wave_direction_deg'
    ).eq('is_observed', True).in_('source', ['cdip', 'ndbc']).not_.is_('wave_height_m', 'null').execute()

    obs_df = pd.DataFrame(obs_result.data)
    print(f"  Retrieved {len(obs_df)} observations")

    if len(obs_df) == 0:
        print("No observations found")
        return pd.DataFrame()

    # Convert forecast date+time to datetime
    forecasts_df['forecast_ts'] = pd.to_datetime(
        forecasts_df['forecast_date'] + ' ' + forecasts_df['forecast_time'].fillna('00:00:00'),
        errors='coerce'
    )

    # Convert observation timestamp
    obs_df['observed_ts'] = pd.to_datetime(obs_df['ts'], errors='coerce')

    # Join forecasts with observations on beach_id and time proximity
    print("Matching forecasts with observations...")

    matched_rows = []
    for _, forecast in forecasts_df.iterrows():
        beach_id = forecast['beach_id']
        forecast_ts = forecast['forecast_ts']

        if pd.isna(forecast_ts):
            continue

        # Find observations for this beach within time window
        beach_obs = obs_df[obs_df['beach_id'] == beach_id]
        if len(beach_obs) == 0:
            continue

        # Calculate time difference in seconds
        time_diff = abs((beach_obs['observed_ts'] - forecast_ts).dt.total_seconds())

        # Find closest observation within MAX_TIME_DIFF_SECONDS (2 hours)
        valid_obs = beach_obs[time_diff < MAX_TIME_DIFF_SECONDS]
        if len(valid_obs) == 0:
            continue

        # Take the closest one
        closest_idx = time_diff[time_diff < MAX_TIME_DIFF_SECONDS].idxmin()
        obs = obs_df.loc[closest_idx]

        matched_rows.append({
            'beach_id': beach_id,
            'forecast_ts_utc': forecast_ts,
            'forecast_height_text': forecast['wave_height'],
            'forecast_period_text': forecast['wave_period'],
            'forecast_dir_text': forecast['wave_direction'],
            'wind_speed_text': forecast['wind_speed'],
            'wind_dir_text': forecast['wind_direction'],
            'observed_height_m': obs['wave_height_m'],
            'observed_period_s': obs['wave_period_s'],
            'observed_dir_deg': obs['wave_direction_deg'],
            'observed_ts': obs['observed_ts']
        })

    if not matched_rows:
        print("No forecast-observation pairs found within time window")
        return pd.DataFrame()

    df = pd.DataFrame(matched_rows)
    print(f"Matched {len(df)} forecast-observation pairs")

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
    df_clean = df.dropna(subset=required_cols).copy()

    if len(df) > 0:
        print(f"Clean dataset: {len(df_clean)} rows ({len(df_clean)/len(df)*100:.1f}% retained)")
    else:
        print("Warning: No data retrieved from query")
        return pd.DataFrame()

    # Track missing wind data before filling (allows model to learn different behavior)
    df_clean['wind_missing'] = df_clean['wind_speed_ms'].isna().astype(int)

    # Fill missing optional values (match inference behavior)
    df_clean['wind_speed_ms'] = df_clean['wind_speed_ms'].fillna(0)
    df_clean['wind_dir_deg'] = df_clean['wind_dir_deg'].fillna(0)  # Use 0, not 270
    df_clean['forecast_period_s'] = df_clean['forecast_period_s'].fillna(10)
    df_clean['forecast_dir_deg'] = df_clean['forecast_dir_deg'].fillna(270)

    # Select final columns
    final_cols = [
        'beach_id', 'forecast_ts_utc', 'observed_ts',
        'forecast_height_m', 'observed_height_m', 'residual_m',
        'forecast_period_s', 'forecast_dir_deg',
        'wind_speed_ms', 'wind_dir_deg', 'wind_missing'
    ]
    df_final = df_clean[final_cols]

    # Save to file
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    df_final.to_csv(output_path, index=False)
    print(f"Saved training data to {output_path}")

    return df_final


if __name__ == "__main__":
    df = extract_training_data()
    if len(df) > 0:
        print(f"\nDataset summary:")
        print(f"  Rows: {len(df)}")
        print(f"  Date range: {df['forecast_ts_utc'].min()} to {df['forecast_ts_utc'].max()}")
        print(f"  Mean residual: {df['residual_m'].mean():.3f}m")
        print(f"  Std residual: {df['residual_m'].std():.3f}m")
    else:
        print("\nNo training data extracted")
