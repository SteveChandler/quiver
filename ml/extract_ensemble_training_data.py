"""
Extract ensemble training data combining NOAA and Open-Meteo forecasts.

This script extends the base training data extraction to include Open-Meteo
marine forecasts as additional features, enabling the model to learn from
multiple forecast sources.

Usage:
    python extract_ensemble_training_data.py --output data/ensemble_training_data.csv
"""
import os
import argparse
import asyncio
from datetime import datetime
from typing import Optional

import pandas as pd
from tqdm import tqdm
from supabase import create_client

from config import SUPABASE_URL, SUPABASE_SERVICE_KEY, MAX_TIME_DIFF_SECONDS
from parsing import parse_wave_height, parse_wind_speed
from open_meteo_service import OpenMeteoService, fetch_open_meteo_batch


def fetch_beach_coordinates(supabase) -> pd.DataFrame:
    """
    Fetch beach coordinates from Supabase.

    Returns:
        DataFrame with beach_id, name, latitude, longitude
    """
    print("Fetching beach coordinates...")
    all_beaches = []
    page_size = 1000
    offset = 0

    while True:
        result = supabase.from_('beaches').select(
            'id, name, lat, lon'
        ).not_.is_('lat', 'null').not_.is_('lon', 'null').range(
            offset, offset + page_size - 1
        ).execute()

        if not result.data:
            break
        all_beaches.extend(result.data)
        if len(result.data) < page_size:
            break
        offset += page_size

    df = pd.DataFrame(all_beaches)
    # Rename to standard names for consistency
    df = df.rename(columns={'lat': 'latitude', 'lon': 'longitude'})
    print(f"  Retrieved {len(df)} beaches with coordinates")
    return df


def fetch_noaa_forecasts(supabase) -> pd.DataFrame:
    """Fetch NOAA forecasts from enhanced_forecasts table."""
    print("Fetching NOAA forecasts...")
    all_forecasts = []
    page_size = 1000
    offset = 0

    while True:
        result = supabase.from_('enhanced_forecasts').select(
            'beach_id, forecast_date, forecast_time, wave_height, wave_period, '
            'wave_direction, wind_speed, wind_direction'
        ).eq('data_source', 'NOAA_NWS').range(offset, offset + page_size - 1).execute()

        if not result.data:
            break
        all_forecasts.extend(result.data)
        print(f"  Fetched {len(all_forecasts)} forecasts...")
        if len(result.data) < page_size:
            break
        offset += page_size

    df = pd.DataFrame(all_forecasts)
    print(f"  Retrieved {len(df)} total NOAA forecasts")
    return df


def fetch_observations(supabase) -> pd.DataFrame:
    """Fetch buoy observations from marine_forecasts table."""
    print("Fetching buoy observations...")
    all_obs = []
    page_size = 1000
    offset = 0

    while True:
        result = supabase.from_('marine_forecasts').select(
            'beach_id, ts, wave_height_m, wave_period_s, wave_direction_deg'
        ).eq('is_observed', True).in_('source', ['cdip', 'ndbc']).not_.is_(
            'wave_height_m', 'null'
        ).range(offset, offset + page_size - 1).execute()

        if not result.data:
            break
        all_obs.extend(result.data)
        print(f"  Fetched {len(all_obs)} observations...")
        if len(result.data) < page_size:
            break
        offset += page_size

    df = pd.DataFrame(all_obs)
    print(f"  Retrieved {len(df)} total observations")
    return df


def match_forecasts_with_observations(
    forecasts_df: pd.DataFrame,
    obs_df: pd.DataFrame
) -> pd.DataFrame:
    """
    Match NOAA forecasts with closest buoy observations.

    Returns:
        DataFrame with matched forecast-observation pairs
    """
    print("Matching forecasts with observations...")

    # Convert timestamps
    forecasts_df['forecast_ts'] = pd.to_datetime(
        forecasts_df['forecast_date'] + ' ' + forecasts_df['forecast_time'].fillna('00:00:00'),
        errors='coerce', utc=True
    ).dt.tz_localize(None)

    obs_df['observed_ts'] = pd.to_datetime(
        obs_df['ts'], errors='coerce', utc=True
    ).dt.tz_localize(None)

    matched_rows = []
    for _, forecast in tqdm(forecasts_df.iterrows(), total=len(forecasts_df), desc="Matching"):
        beach_id = forecast['beach_id']
        forecast_ts = forecast['forecast_ts']

        if pd.isna(forecast_ts):
            continue

        # Find observations for this beach
        beach_obs = obs_df[obs_df['beach_id'] == beach_id]
        if len(beach_obs) == 0:
            continue

        # Find closest observation within time window
        time_diff = abs((beach_obs['observed_ts'] - forecast_ts).dt.total_seconds())
        valid_obs = beach_obs[time_diff < MAX_TIME_DIFF_SECONDS]

        if len(valid_obs) == 0:
            continue

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

    print(f"  Matched {len(matched_rows)} forecast-observation pairs")
    return pd.DataFrame(matched_rows)


async def enrich_with_open_meteo(
    matched_df: pd.DataFrame,
    beaches_df: pd.DataFrame,
    batch_size: int = 50
) -> pd.DataFrame:
    """
    Enrich matched pairs with Open-Meteo forecast data.

    This adds Open-Meteo wave forecasts as additional features for ensemble modeling.

    Args:
        matched_df: DataFrame with NOAA forecast-observation pairs
        beaches_df: DataFrame with beach coordinates
        batch_size: Number of concurrent Open-Meteo requests

    Returns:
        DataFrame with added Open-Meteo features
    """
    print("Enriching with Open-Meteo forecasts...")

    # Create beach coordinate lookup
    beach_coords = beaches_df.set_index('id')[['latitude', 'longitude']].to_dict('index')

    service = OpenMeteoService()
    enriched_rows = []
    failed_count = 0

    # Process in batches
    for i in tqdm(range(0, len(matched_df), batch_size), desc="Open-Meteo"):
        batch = matched_df.iloc[i:i + batch_size]

        # Build location list for batch
        locations = []
        for _, row in batch.iterrows():
            beach_id = row['beach_id']
            if beach_id not in beach_coords:
                locations.append(None)
                continue

            coords = beach_coords[beach_id]
            locations.append((
                coords['latitude'],
                coords['longitude'],
                row['forecast_ts_utc']
            ))

        # Fetch Open-Meteo data concurrently
        async def null_coro():
            return None

        tasks = []
        for loc in locations:
            if loc is None:
                tasks.append(null_coro())
            else:
                lat, lon, ts = loc
                tasks.append(service.fetch_forecast(lat, lon, ts))

        results = await asyncio.gather(*tasks, return_exceptions=True)

        # Combine with original data
        for (_, row), om_data in zip(batch.iterrows(), results):
            enriched_row = row.to_dict()

            if isinstance(om_data, Exception) or om_data is None:
                failed_count += 1
                # Fill with NaN for missing Open-Meteo data
                enriched_row.update({
                    'wave_height_om': None,
                    'wave_period_om': None,
                    'wave_direction_om': None,
                    'swell_height_om': None,
                    'swell_period_om': None,
                    'wind_wave_height_om': None,
                    'delta_noaa_om': None,
                    'abs_delta_noaa_om': None,
                    'om_available': False
                })
            else:
                enriched_row.update(om_data)
                enriched_row['om_available'] = True

            enriched_rows.append(enriched_row)

    print(f"  Enriched {len(enriched_rows)} rows ({failed_count} Open-Meteo failures)")
    return pd.DataFrame(enriched_rows)


def compute_ensemble_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Compute derived ensemble features from NOAA and Open-Meteo data.

    Args:
        df: DataFrame with both NOAA and Open-Meteo features

    Returns:
        DataFrame with additional computed features
    """
    print("Computing ensemble features...")

    df = df.copy()

    # Parse NOAA text fields to numeric
    df['forecast_height_m'] = df['forecast_height_text'].apply(parse_wave_height)
    df['forecast_period_s'] = pd.to_numeric(df['forecast_period_text'], errors='coerce')
    df['forecast_dir_deg'] = pd.to_numeric(df['forecast_dir_text'], errors='coerce')
    df['wind_speed_ms'] = df['wind_speed_text'].apply(parse_wind_speed)
    df['wind_dir_deg'] = pd.to_numeric(df['wind_dir_text'], errors='coerce')

    # Compute delta features (NOAA - Open-Meteo)
    df['delta_noaa_om'] = df['forecast_height_m'] - df['wave_height_om']
    df['abs_delta_noaa_om'] = df['delta_noaa_om'].abs()

    # Compute period delta
    df['delta_period_noaa_om'] = df['forecast_period_s'] - df['wave_period_om']

    # Swell dominance ratio (from Open-Meteo decomposition)
    swell_total = df['swell_height_om'].fillna(0) + df['wind_wave_height_om'].fillna(0) + 0.01
    df['swell_dominance_om'] = df['swell_height_om'].fillna(0) / swell_total

    # Direction agreement (cosine similarity)
    noaa_dir_rad = df['forecast_dir_deg'].fillna(270) * (3.14159 / 180)
    om_dir_rad = df['wave_direction_om'].fillna(270) * (3.14159 / 180)
    df['direction_agreement'] = (
        noaa_dir_rad.apply(lambda x: __import__('math').cos(x)) *
        om_dir_rad.apply(lambda x: __import__('math').cos(x)) +
        noaa_dir_rad.apply(lambda x: __import__('math').sin(x)) *
        om_dir_rad.apply(lambda x: __import__('math').sin(x))
    )

    # Compute target: residual (observed - NOAA forecast)
    df['residual_m'] = df['observed_height_m'] - df['forecast_height_m']

    # Track missing data
    df['wind_missing'] = df['wind_speed_ms'].isna().astype(int)
    df['om_missing'] = (~df['om_available']).astype(int)

    print(f"  Computed {len(df)} rows with ensemble features")
    return df


def clean_and_export(df: pd.DataFrame, output_path: str) -> pd.DataFrame:
    """
    Clean data and export to CSV.

    Args:
        df: DataFrame with all features
        output_path: Path to save CSV

    Returns:
        Cleaned DataFrame
    """
    print("Cleaning and exporting...")

    # Drop rows with missing critical values
    required_cols = ['forecast_height_m', 'observed_height_m', 'residual_m']
    df_clean = df.dropna(subset=required_cols).copy()

    print(f"  Retained {len(df_clean)} rows after dropping missing critical values")

    # Fill missing optional values
    df_clean['wind_speed_ms'] = df_clean['wind_speed_ms'].fillna(0)
    df_clean['wind_dir_deg'] = df_clean['wind_dir_deg'].fillna(0)
    df_clean['forecast_period_s'] = df_clean['forecast_period_s'].fillna(10)
    df_clean['forecast_dir_deg'] = df_clean['forecast_dir_deg'].fillna(270)

    # Fill missing Open-Meteo values with NOAA values (graceful degradation)
    df_clean['wave_height_om'] = df_clean['wave_height_om'].fillna(df_clean['forecast_height_m'])
    df_clean['wave_period_om'] = df_clean['wave_period_om'].fillna(df_clean['forecast_period_s'])
    df_clean['wave_direction_om'] = df_clean['wave_direction_om'].fillna(df_clean['forecast_dir_deg'])
    df_clean['swell_height_om'] = df_clean['swell_height_om'].fillna(df_clean['forecast_height_m'] * 0.8)
    df_clean['wind_wave_height_om'] = df_clean['wind_wave_height_om'].fillna(df_clean['forecast_height_m'] * 0.2)

    # Recompute derived features after fill
    df_clean['delta_noaa_om'] = df_clean['delta_noaa_om'].fillna(0)
    df_clean['abs_delta_noaa_om'] = df_clean['abs_delta_noaa_om'].fillna(0)
    df_clean['swell_dominance_om'] = df_clean['swell_dominance_om'].fillna(0.8)
    df_clean['direction_agreement'] = df_clean['direction_agreement'].fillna(1.0)

    # Select final columns for training
    final_cols = [
        # Identifiers
        'beach_id', 'forecast_ts_utc', 'observed_ts',

        # NOAA features
        'forecast_height_m', 'forecast_period_s', 'forecast_dir_deg',
        'wind_speed_ms', 'wind_dir_deg',

        # Open-Meteo features
        'wave_height_om', 'wave_period_om', 'wave_direction_om',
        'swell_height_om', 'swell_period_om', 'wind_wave_height_om',

        # Ensemble features
        'delta_noaa_om', 'abs_delta_noaa_om', 'delta_period_noaa_om',
        'swell_dominance_om', 'direction_agreement',

        # Target
        'observed_height_m', 'residual_m',

        # Metadata
        'wind_missing', 'om_missing', 'om_available'
    ]

    # Filter to existing columns
    existing_cols = [c for c in final_cols if c in df_clean.columns]
    df_final = df_clean[existing_cols]

    # Save to file
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    df_final.to_csv(output_path, index=False)
    print(f"  Saved ensemble training data to {output_path}")

    return df_final


async def extract_ensemble_training_data(output_path: str = "data/ensemble_training_data.csv") -> pd.DataFrame:
    """
    Main extraction pipeline for ensemble training data.

    Args:
        output_path: Path to save the output CSV

    Returns:
        DataFrame with ensemble training data
    """
    print("=" * 60)
    print("Ensemble Training Data Extraction")
    print("=" * 60)

    # Connect to Supabase
    print("\n1. Connecting to Supabase...")
    supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    # Fetch data
    print("\n2. Fetching data from Supabase...")
    beaches_df = fetch_beach_coordinates(supabase)
    forecasts_df = fetch_noaa_forecasts(supabase)
    obs_df = fetch_observations(supabase)

    if len(forecasts_df) == 0 or len(obs_df) == 0:
        print("ERROR: No forecast or observation data found")
        return pd.DataFrame()

    # Match forecasts with observations
    print("\n3. Matching forecasts with observations...")
    matched_df = match_forecasts_with_observations(forecasts_df, obs_df)

    if len(matched_df) == 0:
        print("ERROR: No forecast-observation pairs matched")
        return pd.DataFrame()

    # Enrich with Open-Meteo data
    print("\n4. Enriching with Open-Meteo forecasts...")
    enriched_df = await enrich_with_open_meteo(matched_df, beaches_df)

    # Compute ensemble features
    print("\n5. Computing ensemble features...")
    features_df = compute_ensemble_features(enriched_df)

    # Clean and export
    print("\n6. Cleaning and exporting...")
    final_df = clean_and_export(features_df, output_path)

    # Summary
    print("\n" + "=" * 60)
    print("Extraction Complete!")
    print("=" * 60)
    print(f"  Total samples: {len(final_df)}")
    print(f"  Date range: {final_df['forecast_ts_utc'].min()} to {final_df['forecast_ts_utc'].max()}")
    print(f"  Open-Meteo coverage: {(~final_df['om_missing'].astype(bool)).mean() * 100:.1f}%")
    print(f"  Mean residual: {final_df['residual_m'].mean():.3f}m")
    print(f"  Std residual: {final_df['residual_m'].std():.3f}m")
    print(f"  Mean NOAA-OM delta: {final_df['delta_noaa_om'].mean():.3f}m")

    return final_df


def main():
    parser = argparse.ArgumentParser(description="Extract ensemble training data")
    parser.add_argument(
        "--output", "-o",
        default="data/ensemble_training_data.csv",
        help="Output path for training data CSV"
    )
    args = parser.parse_args()

    asyncio.run(extract_ensemble_training_data(args.output))


if __name__ == "__main__":
    main()
