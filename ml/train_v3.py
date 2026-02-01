"""Train v3 bias correction model with recency weighting and relaxed constraints."""
import argparse
import os
import sys
from datetime import datetime

import numpy as np
import pandas as pd
import xgboost as xgb
from sklearn.model_selection import TimeSeriesSplit
from sklearn.metrics import mean_squared_error, mean_absolute_error

from transformers_v2 import preprocess_v2, V2_FEATURE_COLUMNS


def load_data(path: str) -> pd.DataFrame:
    """Load training data CSV."""
    if not os.path.exists(path):
        raise FileNotFoundError(
            f"Training data not found at {path}. "
            "Run extract_training_data_v2.py first."
        )
    df = pd.read_csv(path)
    df['forecast_ts_utc'] = pd.to_datetime(df['forecast_ts_utc'])
    return df


def compute_sample_weights(df: pd.DataFrame) -> np.ndarray:
    """
    Compute recency-based sample weights.

    Last 14 days get 2x weight to prioritize recent conditions
    while maintaining historical stability.
    """
    max_date = df['forecast_ts_utc'].max()
    days_ago = (max_date - df['forecast_ts_utc']).dt.days
    # Weight recent data (last 14 days) higher to adapt to current conditions
    return np.where(days_ago <= 14, 2.0, 1.0)


def bucket_label(height_m: float) -> str:
    """Assign forecast height to a bucket."""
    if height_m < 0.5:
        return '<0.5m'
    elif height_m <= 1.5:
        return '0.5-1.5m'
    else:
        return '>1.5m'


def evaluate_buckets(df: pd.DataFrame, corrected: np.ndarray) -> dict:
    """
    Evaluate improvement rate per forecast bucket.

    Returns dict with bucket results and pass/fail status.
    """
    df_eval = df.copy()
    df_eval['corrected_m'] = corrected
    df_eval['raw_error'] = abs(df_eval['forecast_height_m'] - df_eval['observed_height_m'])
    df_eval['corrected_error'] = abs(df_eval['corrected_m'] - df_eval['observed_height_m'])
    df_eval['improved'] = df_eval['corrected_error'] < df_eval['raw_error']
    df_eval['bucket'] = df_eval['forecast_height_m'].apply(bucket_label)

    results = {}
    all_pass = True

    for bucket in ['<0.5m', '0.5-1.5m', '>1.5m']:
        bucket_df = df_eval[df_eval['bucket'] == bucket]
        if len(bucket_df) == 0:
            results[bucket] = {'n': 0, 'status': 'SKIP (no data)'}
            continue

        improvement_rate = bucket_df['improved'].mean() * 100
        raw_mae = bucket_df['raw_error'].mean()
        corrected_mae = bucket_df['corrected_error'].mean()
        degradation = corrected_mae - raw_mae

        passed = improvement_rate >= 40 and degradation <= 0.05
        if not passed:
            all_pass = False

        results[bucket] = {
            'n': len(bucket_df),
            'improvement_rate': improvement_rate,
            'raw_mae': raw_mae,
            'corrected_mae': corrected_mae,
            'degradation': degradation,
            'status': 'PASS' if passed else 'FAIL'
        }

    # Overall
    overall_improvement = df_eval['improved'].mean() * 100
    results['overall'] = {
        'n': len(df_eval),
        'improvement_rate': overall_improvement,
        'raw_mae': df_eval['raw_error'].mean(),
        'corrected_mae': df_eval['corrected_error'].mean(),
    }

    results['all_pass'] = all_pass and overall_improvement > 50
    return results


def main():
    parser = argparse.ArgumentParser(description='Train v3 bias correction model')
    parser.add_argument('--data', default='data/training_data_v2.csv',
                        help='Path to training data CSV')
    parser.add_argument('--output', default=None,
                        help='Path to save trained model (default: models/bias_model_v3.YYYYMMDD.json)')
    parser.add_argument('--holdout-days', type=int, default=2,
                        help='Number of days to hold out for temporal validation')
    args = parser.parse_args()

    # Generate version-stamped output filename
    if args.output is None:
        today = datetime.now().strftime('%Y%m%d')
        args.output = f'models/bias_model_v3.{today}.json'

    print("=" * 60)
    print("Quiver ML v3 Bias Model Training")
    print("=" * 60)
    print("\nv3 Changes:")
    print("  - Removed monotone constraint (learn freely)")
    print("  - Added recency weighting (last 14 days = 2x)")
    print("  - Relaxed guardrails (75% max, 0.5m floor)")
    print("  - Using max available training data (up to 365 days)")

    # 1. Load data
    print("\n1. Loading training data...")
    df = load_data(args.data)
    print(f"   Loaded {len(df)} samples")
    print(f"   Date range: {df['forecast_ts_utc'].min()} to {df['forecast_ts_utc'].max()}")
    print(f"   Beaches: {df['beach_id'].nunique()}")

    # Calculate recency weights
    weights = compute_sample_weights(df)
    recent_pct = (weights > 1.0).sum() / len(weights) * 100
    print(f"   Recency weights: {recent_pct:.1f}% samples (last 14 days) at 2x weight")

    # 2. Temporal holdout split (last N days)
    print(f"\n2. Splitting data (last {args.holdout_days} days as holdout)...")
    max_ts = df['forecast_ts_utc'].max()
    holdout_cutoff = max_ts - pd.Timedelta(days=args.holdout_days)

    df_train = df[df['forecast_ts_utc'] <= holdout_cutoff].copy()
    df_holdout = df[df['forecast_ts_utc'] > holdout_cutoff].copy()

    # Compute weights for train/holdout splits
    weights_train = compute_sample_weights(df_train)
    weights_holdout = compute_sample_weights(df_holdout)

    print(f"   Training: {len(df_train)} samples (up to {holdout_cutoff})")
    print(f"   Holdout:  {len(df_holdout)} samples ({args.holdout_days} days)")

    if len(df_holdout) < 100:
        print("   WARNING: Very small holdout set, results may be unreliable")

    # 3. Feature engineering
    print("\n3. Engineering features...")
    X_train = preprocess_v2(df_train)
    X_holdout = preprocess_v2(df_holdout)
    y_train = df_train['residual_m']
    y_holdout = df_holdout['residual_m']
    print(f"   Features ({len(V2_FEATURE_COLUMNS)}): {V2_FEATURE_COLUMNS}")

    # 4. Cross-validation on training set
    print("\n4. Cross-validation (5-fold TimeSeries)...")

    # v3: NO monotone constraints - let model learn freely from diverse data
    params = {
        'objective': 'reg:squarederror',
        'n_estimators': 200,
        'learning_rate': 0.05,
        'max_depth': 4,
        'subsample': 0.7,
        'colsample_bytree': 0.8,
        'reg_alpha': 0.1,
        'min_child_weight': 10,
        'n_jobs': -1,
    }

    tscv = TimeSeriesSplit(n_splits=5)
    fold_rmses = []

    for fold, (train_idx, val_idx) in enumerate(tscv.split(X_train)):
        X_tr, X_val = X_train.iloc[train_idx], X_train.iloc[val_idx]
        y_tr, y_val = y_train.iloc[train_idx], y_train.iloc[val_idx]
        w_tr = weights_train[train_idx]

        reg = xgb.XGBRegressor(**params)
        reg.fit(X_tr, y_tr, sample_weight=w_tr, eval_set=[(X_val, y_val)], verbose=False)

        preds = reg.predict(X_val)
        rmse = np.sqrt(mean_squared_error(y_val, preds))
        fold_rmses.append(rmse)
        print(f"   Fold {fold+1} RMSE: {rmse:.4f}m")

    print(f"   Mean CV RMSE: {np.mean(fold_rmses):.4f} +/- {np.std(fold_rmses):.4f}m")

    # 5. Train final model on full training set
    print("\n5. Training final model on full training set...")
    model = xgb.XGBRegressor(**params)
    model.fit(X_train, y_train, sample_weight=weights_train, verbose=False)

    # 6. Feature importances
    print("\n6. Feature importances:")
    importances = pd.DataFrame({
        'feature': V2_FEATURE_COLUMNS,
        'importance': model.feature_importances_
    }).sort_values('importance', ascending=False)

    for _, row in importances.iterrows():
        bar = '█' * int(row['importance'] * 50)
        print(f"   {row['feature']:25s} {row['importance']:.4f} {bar}")

    os.makedirs(os.path.dirname(args.output) if os.path.dirname(args.output) else '.', exist_ok=True)
    importances.to_csv(args.output.replace('.json', '_importances.csv'), index=False)

    # 7. Holdout evaluation with v3 guardrails
    print("\n7. Holdout evaluation...")

    predicted_bias = model.predict(X_holdout)
    raw_forecast = df_holdout['forecast_height_m'].values

    # v3 guardrails: 75% max (was 50%), 0.5m floor (was 0.3m)
    max_bias = np.maximum(np.abs(raw_forecast) * 0.75, 0.5)
    clipped_bias = np.clip(predicted_bias, -max_bias, max_bias)
    clipped_bias = np.clip(clipped_bias, -1.5, 1.5)
    # No-correction zone
    clipped_bias[np.abs(clipped_bias) < 0.03] = 0.0
    corrected = raw_forecast + clipped_bias
    corrected = np.clip(corrected, 0.01, 15.0)

    # Bucket evaluation
    bucket_results = evaluate_buckets(df_holdout, corrected)

    print(f"\n   {'Bucket':<12} {'N':>6} {'Improv%':>8} {'Raw MAE':>8} {'Corr MAE':>9} {'Status':>6}")
    print(f"   {'-'*55}")
    for bucket in ['<0.5m', '0.5-1.5m', '>1.5m']:
        r = bucket_results[bucket]
        if r['n'] == 0:
            print(f"   {bucket:<12} {r['n']:>6} {'N/A':>8} {'N/A':>8} {'N/A':>9} {r['status']:>6}")
        else:
            print(f"   {bucket:<12} {r['n']:>6} {r['improvement_rate']:>7.1f}% "
                  f"{r['raw_mae']:>7.3f}m {r['corrected_mae']:>8.3f}m {r['status']:>6}")

    overall = bucket_results['overall']
    print(f"   {'OVERALL':<12} {overall['n']:>6} {overall['improvement_rate']:>7.1f}% "
          f"{overall['raw_mae']:>7.3f}m {overall['corrected_mae']:>8.3f}m")

    # Mean bias check
    mean_bias = clipped_bias.mean()
    print(f"\n   Mean bias applied: {mean_bias:+.3f}m")
    print(f"   Bias balanced: {'YES' if abs(mean_bias) < 0.4 else 'NO (too one-directional)'}")

    # 8. Go/No-Go decision (unchanged from v2)
    print("\n8. Go/No-Go Criteria:")
    go = True

    if overall['improvement_rate'] <= 50:
        print(f"   [FAIL] Overall improvement {overall['improvement_rate']:.1f}% <= 50%")
        go = False
    else:
        print(f"   [PASS] Overall improvement {overall['improvement_rate']:.1f}% > 50%")

    if not bucket_results['all_pass']:
        print(f"   [FAIL] Not all buckets pass (improvement >= 40%, degradation <= 0.05m)")
        go = False
    else:
        print(f"   [PASS] All buckets pass")

    if abs(mean_bias) >= 0.4:
        print(f"   [FAIL] Mean bias {mean_bias:+.3f}m is too one-directional (|bias| >= 0.4)")
        go = False
    else:
        print(f"   [PASS] Mean bias {mean_bias:+.3f}m is balanced (|bias| < 0.4)")

    if not go:
        print("\n   *** NO-GO: Model does NOT meet deployment criteria ***")
        print("   Model will still be saved for analysis but should NOT be deployed.")
    else:
        print("\n   *** GO: Model meets all deployment criteria ***")

    # 9. Save model regardless (for analysis), but exit non-zero if no-go
    print(f"\n9. Saving model to {args.output}...")
    model.save_model(args.output)
    print(f"   Model saved.")

    print("\n" + "=" * 60)
    if go:
        print("Training PASSED. Model ready for deployment.")
    else:
        print("Training FAILED go/no-go. Review results before deploying.")
    print("=" * 60)

    sys.exit(0 if go else 1)


if __name__ == "__main__":
    main()
