"""Extract v2 training data from ml_predictions_log (pre-matched pairs)."""
import os
import sys

import pandas as pd
from supabase import create_client
from config import SUPABASE_URL, SUPABASE_SERVICE_KEY


def extract_training_data_v2(output_path: str = "data/training_data_v2.csv") -> pd.DataFrame:
    """
    Extract training data directly from ml_predictions_log.

    Unlike v1 which matched enhanced_forecasts text with marine_forecasts observations,
    ml_predictions_log already contains pre-parsed numeric forecast-observation pairs.

    Returns:
        DataFrame with numeric features and residual target
    """
    print("Connecting to Supabase...")
    supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    print("Fetching matched pairs from ml_predictions_log...")
    all_rows = []
    page_size = 1000
    offset = 0

    while True:
        result = supabase.from_('ml_predictions_log').select(
            'beach_id, predicted_at, raw_forecast_m, wave_period_s, '
            'wave_direction_deg, wind_speed_ms, wind_direction_deg, observed_m'
        ).not_.is_('observed_m', 'null').gt(
            'raw_forecast_m', 0
        ).gte(
            'observed_m', 0
        ).order(
            'predicted_at', desc=False
        ).range(offset, offset + page_size - 1).execute()

        if not result.data:
            break
        all_rows.extend(result.data)
        if len(all_rows) % 10000 < page_size:
            print(f"  Fetched {len(all_rows)} rows...")
        if len(result.data) < page_size:
            break
        offset += page_size

    if not all_rows:
        print("ERROR: No matched pairs found in ml_predictions_log")
        sys.exit(1)

    df = pd.DataFrame(all_rows)
    print(f"  Total matched pairs: {len(df)}")

    # Calculate residual
    df['residual_m'] = df['observed_m'] - df['raw_forecast_m']

    # Validate data quality
    print("\nValidating data quality...")

    # Check 1: Minimum sample count
    if len(df) < 5000:
        print(f"FAIL: Only {len(df)} samples (need >= 5000)")
        sys.exit(1)
    print(f"  [PASS] Sample count: {len(df)} >= 5000")

    # Check 2: Residual diversity (std > 0.2 means diverse conditions)
    residual_std = df['residual_m'].std()
    if residual_std < 0.2:
        print(f"FAIL: Residual std = {residual_std:.3f} (need > 0.2 for diverse conditions)")
        sys.exit(1)
    print(f"  [PASS] Residual std: {residual_std:.3f} > 0.2")

    # Check 3: Balanced residuals (20-80% positive)
    pct_positive = (df['residual_m'] > 0).mean() * 100
    if pct_positive < 20 or pct_positive > 80:
        print(f"FAIL: {pct_positive:.1f}% positive residuals (need 20-80%)")
        sys.exit(1)
    print(f"  [PASS] Positive residuals: {pct_positive:.1f}% (within 20-80%)")

    # Handle missing wind data
    df['wind_missing'] = df['wind_speed_ms'].isna().astype(int)
    df['wind_speed_ms'] = df['wind_speed_ms'].fillna(0)
    df['wind_direction_deg'] = df['wind_direction_deg'].fillna(0)

    # Fill missing period/direction with sensible defaults
    df['wave_period_s'] = df['wave_period_s'].fillna(10)
    df['wave_direction_deg'] = df['wave_direction_deg'].fillna(270)

    # Rename for consistency with training pipeline
    df_final = df.rename(columns={
        'predicted_at': 'forecast_ts_utc',
        'raw_forecast_m': 'forecast_height_m',
        'observed_m': 'observed_height_m',
        'wave_period_s': 'forecast_period_s',
        'wave_direction_deg': 'forecast_dir_deg',
        'wind_direction_deg': 'wind_dir_deg',
    })

    # Select final columns
    final_cols = [
        'beach_id', 'forecast_ts_utc',
        'forecast_height_m', 'observed_height_m', 'residual_m',
        'forecast_period_s', 'forecast_dir_deg',
        'wind_speed_ms', 'wind_dir_deg', 'wind_missing'
    ]
    df_final = df_final[final_cols]

    # Save to file
    os.makedirs(os.path.dirname(output_path) if os.path.dirname(output_path) else '.', exist_ok=True)
    df_final.to_csv(output_path, index=False)
    print(f"\nSaved {len(df_final)} training samples to {output_path}")

    return df_final


if __name__ == "__main__":
    df = extract_training_data_v2()
    print(f"\nDataset summary:")
    print(f"  Rows: {len(df)}")
    print(f"  Date range: {df['forecast_ts_utc'].min()} to {df['forecast_ts_utc'].max()}")
    print(f"  Beaches: {df['beach_id'].nunique()}")
    print(f"  Mean residual: {df['residual_m'].mean():.3f}m")
    print(f"  Std residual: {df['residual_m'].std():.3f}m")
    print(f"  Pct positive residuals: {(df['residual_m'] > 0).mean()*100:.1f}%")

    # Bucket analysis
    print(f"\n  Residual by forecast bucket:")
    df['bucket'] = pd.cut(df['forecast_height_m'], bins=[0, 0.5, 1.5, float('inf')],
                          labels=['<0.5m', '0.5-1.5m', '>1.5m'])
    bucket_stats = df.groupby('bucket', observed=True)['residual_m'].agg(['mean', 'std', 'count'])
    for bucket, row in bucket_stats.iterrows():
        print(f"    {bucket}: mean={row['mean']:+.3f}m, std={row['std']:.3f}m, n={int(row['count'])}")
