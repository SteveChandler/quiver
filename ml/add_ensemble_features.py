"""
Add Open-Meteo ensemble features to augmented training data.

This script enriches the ERA5-augmented training data with Open-Meteo
forecasts, enabling training of a combined model that uses both:
- More training data (from ERA5 augmentation)
- Ensemble features (from Open-Meteo at prediction time)

Usage:
    python add_ensemble_features.py --input data/augmented_training_data.csv \
                                    --output data/augmented_ensemble_data.csv
"""
import os
import argparse
import asyncio
from datetime import datetime, timedelta, timezone
from typing import Optional
import logging

import pandas as pd
import numpy as np
from tqdm import tqdm
from supabase import create_client

from config import SUPABASE_URL, SUPABASE_SERVICE_KEY
from open_meteo_service import OpenMeteoService

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Rate limiting for batch requests
MAX_CONCURRENT_REQUESTS = 5
BATCH_SIZE = 100


async def fetch_open_meteo_for_samples(
    samples_df: pd.DataFrame,
    beaches_df: pd.DataFrame,
    max_concurrent: int = MAX_CONCURRENT_REQUESTS
) -> pd.DataFrame:
    """
    Fetch Open-Meteo data for all samples in the training data.

    Uses caching by (beach_id, date) to minimize API calls since
    Open-Meteo returns hourly data for entire days.

    Args:
        samples_df: Training data with beach_id, forecast_ts_utc
        beaches_df: Beach data with id, latitude, longitude
        max_concurrent: Maximum concurrent API requests

    Returns:
        DataFrame with Open-Meteo features added
    """
    service = OpenMeteoService()
    semaphore = asyncio.Semaphore(max_concurrent)

    # Create lookup for beach coordinates
    beach_coords = beaches_df.set_index('id')[['latitude', 'longitude']].to_dict('index')

    # Cache: (beach_id, date_str) -> {hour: om_data}
    om_cache = {}

    async def fetch_with_cache(beach_id: str, timestamp: datetime) -> Optional[dict]:
        """Fetch Open-Meteo data, using cache for same beach+date."""
        if beach_id not in beach_coords:
            return None

        coords = beach_coords[beach_id]
        date_str = timestamp.strftime('%Y-%m-%d')
        cache_key = (beach_id, date_str)

        # Check cache first
        if cache_key in om_cache:
            hour = timestamp.hour
            if hour in om_cache[cache_key]:
                return om_cache[cache_key][hour]
            return None

        # Fetch from API
        async with semaphore:
            try:
                result = await service.fetch_forecast(
                    lat=coords['latitude'],
                    lon=coords['longitude'],
                    target_time=timestamp,
                    include_history=True
                )

                if result:
                    # Cache the result
                    if cache_key not in om_cache:
                        om_cache[cache_key] = {}
                    om_cache[cache_key][timestamp.hour] = result

                return result

            except Exception as e:
                logger.warning(f"Failed to fetch Open-Meteo for {beach_id} at {timestamp}: {e}")
                return None

    # Process in batches
    results = []
    total_samples = len(samples_df)

    logger.info(f"Fetching Open-Meteo data for {total_samples} samples...")

    for batch_start in tqdm(range(0, total_samples, BATCH_SIZE), desc="Processing batches"):
        batch_end = min(batch_start + BATCH_SIZE, total_samples)
        batch = samples_df.iloc[batch_start:batch_end]

        # Create tasks for this batch
        tasks = []
        for _, row in batch.iterrows():
            beach_id = row['beach_id']
            ts = pd.to_datetime(row['forecast_ts_utc'])
            if pd.isna(ts):
                tasks.append(asyncio.coroutine(lambda: None)())
            else:
                tasks.append(fetch_with_cache(beach_id, ts))

        # Execute batch
        batch_results = await asyncio.gather(*tasks)
        results.extend(batch_results)

        # Small delay between batches
        await asyncio.sleep(0.1)

    logger.info(f"Fetched {sum(1 for r in results if r is not None)} Open-Meteo records")
    logger.info(f"Cache efficiency: {len(om_cache)} unique (beach, date) combinations")

    # Add Open-Meteo columns to dataframe
    om_columns = [
        'wave_height_om', 'wave_period_om', 'wave_direction_om',
        'swell_height_om', 'swell_period_om', 'swell_direction_om',
        'wind_wave_height_om', 'wind_wave_period_om', 'wind_wave_direction_om'
    ]

    for col in om_columns:
        samples_df[col] = [r.get(col) if r else None for r in results]

    return samples_df


def compute_ensemble_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Compute derived ensemble features from NOAA and Open-Meteo data.

    These features capture the agreement/disagreement between forecasts,
    which helps the model learn when NOAA might be over/under-predicting.
    """
    df = df.copy()

    # Height difference between forecasts
    df['height_diff_om_noaa'] = df['wave_height_om'] - df['forecast_height_m']

    # Period difference
    if 'wave_period_om' in df.columns:
        df['period_diff_om_noaa'] = df['wave_period_om'] - df['forecast_period_s']

    # Direction agreement (cosine similarity)
    if 'wave_direction_om' in df.columns and 'forecast_dir_deg' in df.columns:
        noaa_rad = np.deg2rad(df['forecast_dir_deg'])
        om_rad = np.deg2rad(df['wave_direction_om'])
        df['direction_agreement'] = np.cos(noaa_rad - om_rad)

    # Swell ratio (if available)
    if 'swell_height_om' in df.columns and 'wave_height_om' in df.columns:
        df['swell_ratio_om'] = df['swell_height_om'] / df['wave_height_om'].replace(0, np.nan)
        df['swell_ratio_om'] = df['swell_ratio_om'].fillna(0).clip(0, 1)

    # Wind wave ratio (if available)
    if 'wind_wave_height_om' in df.columns and 'wave_height_om' in df.columns:
        df['wind_wave_ratio_om'] = df['wind_wave_height_om'] / df['wave_height_om'].replace(0, np.nan)
        df['wind_wave_ratio_om'] = df['wind_wave_ratio_om'].fillna(0).clip(0, 1)

    return df


async def add_ensemble_features(
    input_path: str,
    output_path: str
) -> pd.DataFrame:
    """
    Main pipeline to add ensemble features to augmented training data.

    Args:
        input_path: Path to augmented training data CSV
        output_path: Path to save enriched training data

    Returns:
        DataFrame with ensemble features added
    """
    print("=" * 70)
    print("Adding Open-Meteo Ensemble Features")
    print(f"Started: {datetime.now().isoformat()}")
    print("=" * 70)

    # Load augmented training data
    print("\n1. Loading augmented training data...")
    df = pd.read_csv(input_path)
    print(f"   Loaded {len(df)} samples")

    # Connect to Supabase to get beach coordinates
    print("\n2. Fetching beach coordinates...")
    supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    # Get unique beach IDs from training data
    beach_ids = df['beach_id'].unique().tolist()
    print(f"   Need coordinates for {len(beach_ids)} beaches")

    # Fetch beach coordinates
    all_beaches = []
    page_size = 1000
    offset = 0

    while True:
        result = supabase.from_('beaches').select(
            'id, lat, lon'
        ).in_('id', beach_ids).range(offset, offset + page_size - 1).execute()

        if not result.data:
            break
        all_beaches.extend(result.data)
        if len(result.data) < page_size:
            break
        offset += page_size

    beaches_df = pd.DataFrame(all_beaches)
    beaches_df = beaches_df.rename(columns={'lat': 'latitude', 'lon': 'longitude'})
    print(f"   Retrieved coordinates for {len(beaches_df)} beaches")

    # Fetch Open-Meteo data
    print("\n3. Fetching Open-Meteo ensemble features...")
    df = await fetch_open_meteo_for_samples(df, beaches_df)

    # Compute derived features
    print("\n4. Computing derived ensemble features...")
    df = compute_ensemble_features(df)

    # Fill missing Open-Meteo values with NOAA values (fallback)
    print("\n5. Applying fallback for missing Open-Meteo data...")
    om_fill_count = 0

    if 'wave_height_om' in df.columns:
        missing_om = df['wave_height_om'].isna()
        om_fill_count = missing_om.sum()
        df.loc[missing_om, 'wave_height_om'] = df.loc[missing_om, 'forecast_height_m']
        df.loc[missing_om, 'wave_period_om'] = df.loc[missing_om, 'forecast_period_s']
        df.loc[missing_om, 'wave_direction_om'] = df.loc[missing_om, 'forecast_dir_deg']

        # Fill derived features for fallback cases
        df.loc[missing_om, 'height_diff_om_noaa'] = 0
        df.loc[missing_om, 'direction_agreement'] = 1.0  # Perfect agreement when using same source

    print(f"   Filled {om_fill_count} samples with NOAA fallback ({om_fill_count/len(df)*100:.1f}%)")

    # Save enriched data
    print("\n6. Saving enriched training data...")
    os.makedirs(os.path.dirname(output_path) if os.path.dirname(output_path) else '.', exist_ok=True)
    df.to_csv(output_path, index=False)
    print(f"   Saved to {output_path}")

    # Summary
    print("\n" + "=" * 70)
    print("Ensemble Feature Enrichment Complete!")
    print("=" * 70)
    print(f"   Total samples: {len(df)}")
    print(f"   Open-Meteo coverage: {(1 - om_fill_count/len(df))*100:.1f}%")
    print(f"   Features added: wave_height_om, wave_period_om, wave_direction_om")
    print(f"                   swell_height_om, swell_period_om, swell_direction_om")
    print(f"                   wind_wave_height_om, height_diff_om_noaa")
    print(f"                   direction_agreement, swell_ratio_om, wind_wave_ratio_om")

    return df


def main():
    parser = argparse.ArgumentParser(description="Add Open-Meteo ensemble features to training data")
    parser.add_argument(
        "--input", "-i",
        required=True,
        help="Input augmented training data CSV"
    )
    parser.add_argument(
        "--output", "-o",
        required=True,
        help="Output path for enriched training data"
    )
    args = parser.parse_args()

    asyncio.run(add_ensemble_features(
        input_path=args.input,
        output_path=args.output
    ))


if __name__ == "__main__":
    main()
