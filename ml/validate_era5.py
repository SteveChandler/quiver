"""
Validate ERA5 accuracy against real buoy observations.

This script validates ERA5-Ocean reanalysis data against actual CDIP/NDBC
buoy measurements to determine if ERA5 is accurate enough to use as
pseudo-ground-truth for training data augmentation.

IMPORTANT: Run this before using ERA5 data for training augmentation.

Usage:
    python validate_era5.py --sample-size 20 --lookback-days 90

Validation thresholds:
- MAE < 0.4m (acceptable)
- Correlation > 0.75 (acceptable)
"""
import argparse
import asyncio
from datetime import datetime, timedelta

import pandas as pd
import numpy as np
from tqdm import tqdm
from supabase import create_client

from config import SUPABASE_URL, SUPABASE_SERVICE_KEY
from era5_service import ERA5Service, ERA5_DELAY_DAYS


async def validate_era5_accuracy(
    sample_size: int = 20,
    lookback_days: int = 90,
    output_path: str = "data/era5_validation_report.csv"
):
    """
    Validate ERA5 accuracy against real buoy observations.

    Args:
        sample_size: Number of beaches to validate
        lookback_days: Days of historical data to compare
        output_path: Path to save validation report
    """
    print("=" * 70)
    print("ERA5 Validation Against Buoy Observations")
    print(f"Started: {datetime.now().isoformat()}")
    print("=" * 70)

    # Connect to Supabase
    print("\n1. Connecting to Supabase...")
    supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    # Get beaches with buoy observations
    print("\n2. Finding beaches with buoy observations...")
    try:
        result = supabase.from_('observable_beaches').select('beach_id').execute()
        observable_ids = {row['beach_id'] for row in result.data}
        print(f"   Found {len(observable_ids)} observable beaches")
    except Exception as e:
        print(f"   Error fetching observable beaches: {e}")
        print("   Falling back to marine_forecasts query...")

        result = supabase.from_('marine_forecasts').select(
            'beach_id'
        ).eq('is_observed', True).in_('source', ['cdip', 'ndbc']).execute()

        observable_ids = {row['beach_id'] for row in result.data}
        print(f"   Found {len(observable_ids)} beaches with observations")

    # Get beach coordinates
    print("\n3. Fetching beach coordinates...")
    beaches_result = supabase.from_('beaches').select(
        'id, name, latitude, longitude'
    ).in_('id', list(observable_ids)).execute()

    beaches_df = pd.DataFrame(beaches_result.data)
    print(f"   Retrieved {len(beaches_df)} beach coordinates")

    # Sample beaches for validation
    actual_sample = min(sample_size, len(beaches_df))
    sample_beaches = beaches_df.sample(n=actual_sample, random_state=42)
    print(f"\n4. Validating {actual_sample} sampled beaches...")

    # Date range for validation
    end_date = datetime.utcnow() - timedelta(days=ERA5_DELAY_DAYS + 1)
    start_date = end_date - timedelta(days=lookback_days)
    print(f"   Date range: {start_date.date()} to {end_date.date()}")

    # Validate each beach
    era5_service = ERA5Service()
    validation_results = []

    for _, beach in tqdm(sample_beaches.iterrows(), total=len(sample_beaches), desc="   Validating"):
        beach_id = beach['id']
        beach_name = beach['name']
        lat, lon = beach['latitude'], beach['longitude']

        # Fetch buoy observations
        obs_result = supabase.from_('marine_forecasts').select(
            'ts, wave_height_m, wave_period_s, wave_direction_deg, source'
        ).eq('beach_id', beach_id).eq('is_observed', True).gte(
            'ts', start_date.isoformat()
        ).lte('ts', end_date.isoformat()).not_.is_('wave_height_m', 'null').execute()

        if not obs_result.data:
            validation_results.append({
                'beach_id': beach_id,
                'beach_name': beach_name,
                'lat': lat,
                'lon': lon,
                'status': 'no_observations',
                'n_pairs': 0
            })
            continue

        obs_df = pd.DataFrame(obs_result.data)
        obs_df['timestamp'] = pd.to_datetime(obs_df['ts'], utc=True).dt.tz_localize(None)

        # Fetch ERA5 data
        era5_df = await era5_service.fetch_historical_data(lat, lon, start_date, end_date)

        if era5_df.empty:
            validation_results.append({
                'beach_id': beach_id,
                'beach_name': beach_name,
                'lat': lat,
                'lon': lon,
                'status': 'no_era5_data',
                'n_pairs': 0
            })
            continue

        # Match observations with ERA5
        matched_pairs = []
        tolerance = timedelta(hours=1)

        for _, obs in obs_df.iterrows():
            obs_time = obs['timestamp']

            time_diffs = abs(era5_df['timestamp'] - obs_time)
            min_idx = time_diffs.idxmin()
            min_diff = time_diffs[min_idx]

            if min_diff <= tolerance:
                era5_row = era5_df.loc[min_idx]
                matched_pairs.append({
                    'buoy_height': obs['wave_height_m'],
                    'era5_height': era5_row['wave_height_era5'],
                    'buoy_period': obs['wave_period_s'],
                    'era5_period': era5_row.get('wave_period_era5'),
                    'source': obs['source']
                })

        if not matched_pairs:
            validation_results.append({
                'beach_id': beach_id,
                'beach_name': beach_name,
                'lat': lat,
                'lon': lon,
                'status': 'no_matches',
                'n_pairs': 0
            })
            continue

        pairs_df = pd.DataFrame(matched_pairs)

        # Calculate metrics
        pairs_df['error'] = pairs_df['buoy_height'] - pairs_df['era5_height']
        pairs_df['abs_error'] = pairs_df['error'].abs()

        mae = pairs_df['abs_error'].mean()
        rmse = (pairs_df['error'] ** 2).mean() ** 0.5
        bias = pairs_df['error'].mean()
        correlation = pairs_df['buoy_height'].corr(pairs_df['era5_height'])

        # Determine if valid
        is_valid = mae < 0.4 and correlation > 0.75

        validation_results.append({
            'beach_id': beach_id,
            'beach_name': beach_name,
            'lat': lat,
            'lon': lon,
            'status': 'valid' if is_valid else 'failed',
            'n_pairs': len(pairs_df),
            'mae_m': round(mae, 3),
            'rmse_m': round(rmse, 3),
            'bias_m': round(bias, 3),
            'correlation': round(correlation, 3),
            'buoy_source': pairs_df['source'].mode().iloc[0] if len(pairs_df) > 0 else None
        })

    # Create results DataFrame
    results_df = pd.DataFrame(validation_results)

    # Summary statistics
    print("\n" + "=" * 70)
    print("Validation Results")
    print("=" * 70)

    valid_count = len(results_df[results_df['status'] == 'valid'])
    failed_count = len(results_df[results_df['status'] == 'failed'])
    no_data_count = len(results_df[results_df['status'].isin(['no_observations', 'no_era5_data', 'no_matches'])])

    print(f"\n   Total beaches validated: {len(results_df)}")
    print(f"   - VALID (ERA5 accurate): {valid_count} ({valid_count/len(results_df)*100:.1f}%)")
    print(f"   - FAILED (ERA5 not accurate): {failed_count} ({failed_count/len(results_df)*100:.1f}%)")
    print(f"   - NO DATA: {no_data_count}")

    # Detailed results for validated beaches
    validated = results_df[results_df['status'].isin(['valid', 'failed'])]
    if len(validated) > 0:
        print(f"\n   Aggregate metrics (across {len(validated)} beaches):")
        print(f"   - Mean MAE: {validated['mae_m'].mean():.3f}m")
        print(f"   - Mean correlation: {validated['correlation'].mean():.3f}")
        print(f"   - Mean bias: {validated['bias_m'].mean():.3f}m")

        print(f"\n   Per-beach results:")
        for _, row in validated.iterrows():
            status_icon = "✓" if row['status'] == 'valid' else "✗"
            print(f"   {status_icon} {row['beach_name'][:30]:30s} MAE={row['mae_m']:.3f}m r={row['correlation']:.3f} n={row['n_pairs']}")

    # Save report
    if output_path:
        import os
        os.makedirs(os.path.dirname(output_path) if os.path.dirname(output_path) else '.', exist_ok=True)
        results_df.to_csv(output_path, index=False)
        print(f"\n   Validation report saved to: {output_path}")

    # Recommendation
    print("\n" + "=" * 70)
    print("Recommendation")
    print("=" * 70)

    if valid_count / len(results_df) > 0.7:
        print("\n   ✓ ERA5 is RECOMMENDED for training augmentation")
        print("   - Majority of beaches show acceptable accuracy")
        print("   - Use sample_weight=0.6 for validated beaches")
        print("   - Use sample_weight=0.3 for unvalidated beaches")
    elif valid_count / len(results_df) > 0.4:
        print("\n   ⚠ ERA5 may be used WITH CAUTION")
        print("   - Mixed accuracy across beaches")
        print("   - Only use for beaches that passed validation")
        print("   - Consider lower sample weights")
    else:
        print("\n   ✗ ERA5 is NOT RECOMMENDED for this region")
        print("   - Poor accuracy compared to buoy observations")
        print("   - Stick to buoy-only training data")

    return results_df


def main():
    parser = argparse.ArgumentParser(description="Validate ERA5 accuracy against buoy data")
    parser.add_argument(
        "--sample-size", "-n",
        type=int,
        default=20,
        help="Number of beaches to validate (default: 20)"
    )
    parser.add_argument(
        "--lookback-days", "-d",
        type=int,
        default=90,
        help="Days of historical data to compare (default: 90)"
    )
    parser.add_argument(
        "--output", "-o",
        default="data/era5_validation_report.csv",
        help="Output path for validation report"
    )
    args = parser.parse_args()

    asyncio.run(validate_era5_accuracy(
        sample_size=args.sample_size,
        lookback_days=args.lookback_days,
        output_path=args.output
    ))


if __name__ == "__main__":
    main()
