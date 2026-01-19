"""
Augment training data with ERA5-Ocean reanalysis pseudo-observations.

This script creates an augmented training dataset by combining:
1. Real forecast-observation pairs (from CDIP/NDBC buoys) - high confidence
2. Forecast-ERA5 pairs (pseudo-observations) - medium confidence

The augmented dataset significantly increases training data volume and
extends coverage to beaches without nearby buoys.

Usage:
    python augment_training_data.py --output data/augmented_training_data.csv

Features:
- Validates ERA5 accuracy against real buoys before use
- Applies sample weights (buoy data weighted higher than ERA5)
- Supports beaches without buoy coverage
- Handles temporal coverage expansion
"""
import os
import argparse
import asyncio
from datetime import datetime, timedelta, timezone
from typing import Optional

import pandas as pd
import numpy as np
from tqdm import tqdm
from supabase import create_client

from config import SUPABASE_URL, SUPABASE_SERVICE_KEY, MAX_TIME_DIFF_SECONDS
from parsing import parse_wave_height, parse_wind_speed
from era5_service import ERA5Service, ERA5Validator, fetch_era5_for_beaches, ERA5_DELAY_DAYS


# Sample weight configuration
WEIGHT_BUOY_OBSERVATION = 1.0      # Real buoy observations (highest quality)
WEIGHT_ERA5_VALIDATED = 0.6        # ERA5 for beaches with validated accuracy
WEIGHT_ERA5_UNVALIDATED = 0.3      # ERA5 for beaches without validation data

# Minimum ERA5 accuracy thresholds
MIN_ERA5_CORRELATION = 0.75
MAX_ERA5_MAE = 0.4  # meters


def fetch_beaches_with_coordinates(supabase) -> pd.DataFrame:
    """Fetch all beaches with coordinates."""
    print("Fetching beaches...")
    all_beaches = []
    page_size = 1000
    offset = 0

    while True:
        # Note: Beach table uses 'lat'/'lon' column names
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
    # Rename to standard names for downstream use
    df = df.rename(columns={'lat': 'latitude', 'lon': 'longitude'})
    print(f"  Retrieved {len(df)} beaches with coordinates")
    return df


def fetch_observable_beaches(supabase) -> set:
    """Fetch list of beach IDs that have buoy observations."""
    print("Fetching observable beaches...")
    try:
        result = supabase.from_('observable_beaches').select('beach_id').execute()
        beach_ids = {row['beach_id'] for row in result.data}
        print(f"  Found {len(beach_ids)} beaches with buoy coverage")
        return beach_ids
    except Exception as e:
        print(f"  Warning: Could not fetch observable_beaches: {e}")
        return set()


def fetch_real_training_pairs(supabase) -> pd.DataFrame:
    """
    Fetch real forecast-observation pairs from existing training data.

    These are the high-quality pairs from actual buoy measurements.
    """
    print("Fetching real forecast-observation pairs...")

    # Fetch forecasts
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
        if len(result.data) < page_size:
            break
        offset += page_size

    forecasts_df = pd.DataFrame(all_forecasts)
    print(f"  Fetched {len(forecasts_df)} NOAA forecasts")

    # Fetch observations
    all_obs = []
    offset = 0

    while True:
        result = supabase.from_('marine_forecasts').select(
            'beach_id, ts, wave_height_m, wave_period_s, wave_direction_deg, source'
        ).eq('is_observed', True).in_('source', ['cdip', 'ndbc']).not_.is_(
            'wave_height_m', 'null'
        ).range(offset, offset + page_size - 1).execute()

        if not result.data:
            break
        all_obs.extend(result.data)
        if len(result.data) < page_size:
            break
        offset += page_size

    obs_df = pd.DataFrame(all_obs)
    print(f"  Fetched {len(obs_df)} buoy observations")

    if len(forecasts_df) == 0 or len(obs_df) == 0:
        return pd.DataFrame()

    # Match forecasts with observations
    print("  Matching forecasts with observations...")
    forecasts_df['forecast_ts'] = pd.to_datetime(
        forecasts_df['forecast_date'] + ' ' + forecasts_df['forecast_time'].fillna('00:00:00'),
        errors='coerce', utc=True
    ).dt.tz_localize(None)

    obs_df['observed_ts'] = pd.to_datetime(obs_df['ts'], errors='coerce', utc=True).dt.tz_localize(None)

    matched_rows = []
    for _, forecast in tqdm(forecasts_df.iterrows(), total=len(forecasts_df), desc="  Matching"):
        beach_id = forecast['beach_id']
        forecast_ts = forecast['forecast_ts']

        if pd.isna(forecast_ts):
            continue

        beach_obs = obs_df[obs_df['beach_id'] == beach_id]
        if len(beach_obs) == 0:
            continue

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
            'observed_ts': obs['observed_ts'],
            'observation_source': obs['source'],
            'data_quality': 'buoy',
            'sample_weight': WEIGHT_BUOY_OBSERVATION
        })

    print(f"  Matched {len(matched_rows)} real forecast-observation pairs")
    return pd.DataFrame(matched_rows)


async def validate_era5_for_beaches(
    beaches_df: pd.DataFrame,
    observable_beach_ids: set,
    supabase
) -> dict[str, dict]:
    """
    Validate ERA5 accuracy against real buoy data for observable beaches.

    Returns a dict mapping beach_id to validation results.
    """
    print("Validating ERA5 accuracy against buoy data...")

    era5_service = ERA5Service()
    validator = ERA5Validator(era5_service)
    validation_results = {}

    # Only validate beaches with buoy coverage
    observable_beaches = beaches_df[beaches_df['id'].isin(observable_beach_ids)]

    # Sample a subset for validation (to save API calls)
    sample_size = min(20, len(observable_beaches))
    sample_beaches = observable_beaches.sample(n=sample_size, random_state=42)

    for _, beach in tqdm(sample_beaches.iterrows(), total=len(sample_beaches), desc="  Validating"):
        beach_id = beach['id']
        lat, lon = beach['latitude'], beach['longitude']

        # Fetch real observations for this beach
        end_date = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=ERA5_DELAY_DAYS + 1)
        start_date = end_date - timedelta(days=90)

        obs_result = supabase.from_('marine_forecasts').select(
            'ts, wave_height_m'
        ).eq('beach_id', beach_id).eq('is_observed', True).gte(
            'ts', start_date.isoformat()
        ).lte('ts', end_date.isoformat()).not_.is_('wave_height_m', 'null').execute()

        if not obs_result.data:
            validation_results[beach_id] = {"valid": False, "error": "No observations"}
            continue

        obs_df = pd.DataFrame(obs_result.data)
        obs_df['timestamp'] = pd.to_datetime(obs_df['ts'], utc=True).dt.tz_localize(None)

        result = await validator.validate_against_buoy(obs_df, lat, lon)
        validation_results[beach_id] = result

        if result['valid']:
            print(f"    {beach['name']}: MAE={result['mae_m']:.3f}m, r={result['correlation']:.3f} ✓")
        else:
            print(f"    {beach['name']}: {result.get('error', 'Not valid')} ✗")

    # Summary
    valid_count = sum(1 for r in validation_results.values() if r.get('valid', False))
    print(f"\n  ERA5 validation: {valid_count}/{len(validation_results)} beaches passed")

    return validation_results


async def create_era5_pairs(
    beaches_df: pd.DataFrame,
    observable_beach_ids: set,
    validation_results: dict[str, dict],
    forecasts_df: pd.DataFrame,
    lookback_days: int = 365
) -> pd.DataFrame:
    """
    Create forecast-ERA5 pseudo-observation pairs.

    Args:
        beaches_df: All beaches
        observable_beach_ids: Beaches with buoy coverage (higher weight)
        validation_results: ERA5 validation results
        forecasts_df: Existing NOAA forecasts
        lookback_days: How far back to fetch ERA5 data

    Returns:
        DataFrame with forecast-ERA5 pairs
    """
    print(f"Creating ERA5 pseudo-observation pairs (lookback: {lookback_days} days)...")

    # Date range for ERA5
    end_date = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=ERA5_DELAY_DAYS + 1)
    start_date = end_date - timedelta(days=lookback_days)

    # Parse forecast timestamps
    if 'forecast_ts' not in forecasts_df.columns:
        forecasts_df['forecast_ts'] = pd.to_datetime(
            forecasts_df['forecast_date'] + ' ' + forecasts_df['forecast_time'].fillna('00:00:00'),
            errors='coerce', utc=True
        ).dt.tz_localize(None)

    # Fetch ERA5 data for all beaches
    print("  Fetching ERA5 data for all beaches...")
    beach_list = beaches_df[['id', 'latitude', 'longitude']].to_dict('records')
    era5_data = await fetch_era5_for_beaches(beach_list, start_date, end_date, max_concurrent=5)

    # Create pairs
    print("  Matching forecasts with ERA5 data...")
    era5_pairs = []

    for beach_id, era5_df in tqdm(era5_data.items(), desc="  Processing"):
        if era5_df.empty:
            continue

        # Get forecasts for this beach
        beach_forecasts = forecasts_df[forecasts_df['beach_id'] == beach_id]
        if beach_forecasts.empty:
            continue

        # Determine sample weight
        is_observable = beach_id in observable_beach_ids
        is_validated = beach_id in validation_results and validation_results[beach_id].get('valid', False)

        if is_validated:
            weight = WEIGHT_ERA5_VALIDATED
        elif is_observable:
            weight = WEIGHT_ERA5_VALIDATED  # Has buoy, just not in validation sample
        else:
            weight = WEIGHT_ERA5_UNVALIDATED

        # Match each ERA5 timestamp with closest forecast
        for _, era5_row in era5_df.iterrows():
            era5_ts = era5_row['timestamp']

            # Find closest forecast within time window
            time_diffs = abs((beach_forecasts['forecast_ts'] - era5_ts).dt.total_seconds())
            valid_forecasts = beach_forecasts[time_diffs < MAX_TIME_DIFF_SECONDS]

            if valid_forecasts.empty:
                continue

            closest_idx = time_diffs[time_diffs < MAX_TIME_DIFF_SECONDS].idxmin()
            forecast = forecasts_df.loc[closest_idx]

            era5_pairs.append({
                'beach_id': beach_id,
                'forecast_ts_utc': forecast['forecast_ts'],
                'forecast_height_text': forecast['wave_height'],
                'forecast_period_text': forecast['wave_period'],
                'forecast_dir_text': forecast['wave_direction'],
                'wind_speed_text': forecast['wind_speed'],
                'wind_dir_text': forecast['wind_direction'],
                'observed_height_m': era5_row['wave_height_era5'],
                'observed_period_s': era5_row.get('wave_period_era5'),
                'observed_dir_deg': era5_row.get('wave_direction_era5'),
                'observed_ts': era5_ts,
                'observation_source': 'era5',
                'data_quality': 'era5_validated' if is_validated else 'era5',
                'sample_weight': weight
            })

    print(f"  Created {len(era5_pairs)} ERA5 pseudo-observation pairs")
    return pd.DataFrame(era5_pairs)


def combine_and_process(
    real_pairs_df: pd.DataFrame,
    era5_pairs_df: pd.DataFrame,
    output_path: str
) -> pd.DataFrame:
    """
    Combine real and ERA5 pairs, compute features, and export.

    Args:
        real_pairs_df: Real buoy observation pairs
        era5_pairs_df: ERA5 pseudo-observation pairs
        output_path: Path to save output CSV

    Returns:
        Combined and processed DataFrame
    """
    print("Combining and processing training data...")

    # Combine datasets
    combined = pd.concat([real_pairs_df, era5_pairs_df], ignore_index=True)
    print(f"  Combined: {len(real_pairs_df)} real + {len(era5_pairs_df)} ERA5 = {len(combined)} total")

    # Parse text fields to numeric
    combined['forecast_height_m'] = combined['forecast_height_text'].apply(parse_wave_height)
    combined['forecast_period_s'] = pd.to_numeric(combined['forecast_period_text'], errors='coerce')
    combined['forecast_dir_deg'] = pd.to_numeric(combined['forecast_dir_text'], errors='coerce')
    combined['wind_speed_ms'] = combined['wind_speed_text'].apply(parse_wind_speed)
    combined['wind_dir_deg'] = pd.to_numeric(combined['wind_dir_text'], errors='coerce')

    # Compute target: residual (observed - forecast)
    combined['residual_m'] = combined['observed_height_m'] - combined['forecast_height_m']

    # Drop rows with missing critical values
    required_cols = ['forecast_height_m', 'observed_height_m', 'residual_m']
    combined_clean = combined.dropna(subset=required_cols).copy()

    print(f"  Retained {len(combined_clean)} rows after dropping missing values")

    # Fill missing optional values
    combined_clean['wind_speed_ms'] = combined_clean['wind_speed_ms'].fillna(0)
    combined_clean['wind_dir_deg'] = combined_clean['wind_dir_deg'].fillna(0)
    combined_clean['forecast_period_s'] = combined_clean['forecast_period_s'].fillna(10)
    combined_clean['forecast_dir_deg'] = combined_clean['forecast_dir_deg'].fillna(270)
    combined_clean['wind_missing'] = combined_clean['wind_speed_ms'].isna().astype(int)

    # Select final columns
    final_cols = [
        'beach_id', 'forecast_ts_utc', 'observed_ts',
        'forecast_height_m', 'forecast_period_s', 'forecast_dir_deg',
        'wind_speed_ms', 'wind_dir_deg', 'wind_missing',
        'observed_height_m', 'residual_m',
        'observation_source', 'data_quality', 'sample_weight'
    ]

    final_df = combined_clean[final_cols]

    # Sort by timestamp
    final_df = final_df.sort_values('forecast_ts_utc').reset_index(drop=True)

    # Save to file
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    final_df.to_csv(output_path, index=False)
    print(f"  Saved augmented training data to {output_path}")

    return final_df


async def augment_training_data(
    output_path: str = "data/augmented_training_data.csv",
    lookback_days: int = 365,
    skip_validation: bool = False
) -> pd.DataFrame:
    """
    Main augmentation pipeline.

    Args:
        output_path: Path to save augmented training data
        lookback_days: How far back to fetch ERA5 data
        skip_validation: Skip ERA5 validation (use with caution)

    Returns:
        Augmented training DataFrame
    """
    print("=" * 70)
    print("Training Data Augmentation with ERA5")
    print(f"Started: {datetime.now().isoformat()}")
    print("=" * 70)

    # Connect to Supabase
    print("\n1. Connecting to Supabase...")
    supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    # Fetch beaches
    print("\n2. Fetching beach data...")
    beaches_df = fetch_beaches_with_coordinates(supabase)
    observable_beaches = fetch_observable_beaches(supabase)

    # Fetch real training pairs
    print("\n3. Fetching real forecast-observation pairs...")
    real_pairs_df = fetch_real_training_pairs(supabase)

    if real_pairs_df.empty:
        print("ERROR: No real training pairs found")
        return pd.DataFrame()

    # Validate ERA5 accuracy
    print("\n4. Validating ERA5 accuracy...")
    if skip_validation:
        print("  Skipping validation (--skip-validation flag)")
        validation_results = {}
    else:
        validation_results = await validate_era5_for_beaches(
            beaches_df, observable_beaches, supabase
        )

    # Fetch forecasts for ERA5 matching
    print("\n5. Fetching NOAA forecasts for ERA5 matching...")
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
        if len(result.data) < page_size:
            break
        offset += page_size

    forecasts_df = pd.DataFrame(all_forecasts)
    print(f"  Fetched {len(forecasts_df)} forecasts")

    # Create ERA5 pairs
    print("\n6. Creating ERA5 pseudo-observation pairs...")
    era5_pairs_df = await create_era5_pairs(
        beaches_df,
        observable_beaches,
        validation_results,
        forecasts_df,
        lookback_days
    )

    # Combine and process
    print("\n7. Combining and processing...")
    final_df = combine_and_process(real_pairs_df, era5_pairs_df, output_path)

    # Summary
    print("\n" + "=" * 70)
    print("Augmentation Complete!")
    print("=" * 70)

    buoy_count = len(final_df[final_df['data_quality'] == 'buoy'])
    era5_count = len(final_df[final_df['data_quality'] != 'buoy'])

    print(f"  Total samples: {len(final_df)}")
    print(f"  - Real buoy pairs: {buoy_count} ({buoy_count/len(final_df)*100:.1f}%)")
    print(f"  - ERA5 pseudo-pairs: {era5_count} ({era5_count/len(final_df)*100:.1f}%)")
    print(f"  Date range: {final_df['forecast_ts_utc'].min()} to {final_df['forecast_ts_utc'].max()}")
    print(f"  Mean residual: {final_df['residual_m'].mean():.3f}m")
    print(f"  Std residual: {final_df['residual_m'].std():.3f}m")

    # Weight distribution
    print(f"\n  Sample weight distribution:")
    print(final_df.groupby('data_quality')['sample_weight'].agg(['count', 'mean']).to_string())

    return final_df


def main():
    parser = argparse.ArgumentParser(description="Augment training data with ERA5")
    parser.add_argument(
        "--output", "-o",
        default="data/augmented_training_data.csv",
        help="Output path for augmented training data CSV"
    )
    parser.add_argument(
        "--lookback-days", "-d",
        type=int,
        default=365,
        help="Days of historical ERA5 data to fetch (default: 365)"
    )
    parser.add_argument(
        "--skip-validation",
        action="store_true",
        help="Skip ERA5 validation against buoy data"
    )
    args = parser.parse_args()

    asyncio.run(augment_training_data(
        output_path=args.output,
        lookback_days=args.lookback_days,
        skip_validation=args.skip_validation
    ))


if __name__ == "__main__":
    main()
