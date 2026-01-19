"""
Train the bias correction model on augmented data with sample weights.

This script trains an XGBoost model using the augmented training dataset
that combines real buoy observations with ERA5 pseudo-observations.

Key features:
- Uses sample weights to prioritize real buoy data over ERA5 data
- Tracks performance separately for buoy vs ERA5 samples
- Compares with baseline (buoy-only) model

Usage:
    python train_augmented.py --data data/augmented_training_data.csv --output models/bias_model_augmented_v1.json
"""
import os
import argparse
from datetime import datetime

import pandas as pd
import numpy as np
from sklearn.model_selection import TimeSeriesSplit

from transformers import FeatureEngineer
from model import QuiverBiasModel
from config import MODEL_PATH, MODEL_VERSION


def load_augmented_training_data(path: str = "data/augmented_training_data.csv") -> pd.DataFrame:
    """Load augmented training data from CSV."""
    if not os.path.exists(path):
        raise FileNotFoundError(
            f"Augmented training data not found at {path}. "
            "Run augment_training_data.py first."
        )

    df = pd.read_csv(path)
    df['forecast_ts_utc'] = pd.to_datetime(df['forecast_ts_utc'])
    df['observed_ts'] = pd.to_datetime(df['observed_ts'])

    return df


def prepare_features(df: pd.DataFrame) -> tuple[pd.DataFrame, pd.Series, np.ndarray]:
    """
    Prepare features, target, and sample weights for training.

    Args:
        df: Augmented training DataFrame

    Returns:
        (X, y, sample_weights) tuple
    """
    # Rename columns to match FeatureEngineer expectations
    df_renamed = df.rename(columns={
        'forecast_ts_utc': 'timestamp',
        'forecast_height_m': 'wave_height_model',
        'forecast_period_s': 'wave_period',
        'forecast_dir_deg': 'wave_direction',
        'wind_speed_ms': 'wind_speed',
        'wind_dir_deg': 'wind_direction'
    })

    # Apply feature engineering
    fe = FeatureEngineer()
    X = fe.preprocess(df_renamed)

    # Check for ensemble features (from Open-Meteo)
    ensemble_features = [
        'wave_height_om', 'wave_period_om', 'wave_direction_om',
        'swell_height_om', 'swell_period_om', 'swell_direction_om',
        'wind_wave_height_om', 'height_diff_om_noaa',
        'direction_agreement', 'swell_ratio_om', 'wind_wave_ratio_om'
    ]

    # Add ensemble features if present
    has_ensemble = any(col in df.columns for col in ensemble_features)
    if has_ensemble:
        print("   Found ensemble features from Open-Meteo")
        for col in ensemble_features:
            if col in df.columns:
                X[col] = df[col].values

    # Drop non-feature columns
    drop_cols = ['timestamp', 'wave_height_model', 'beach_id', 'observed_ts',
                 'observed_height_m', 'residual_m', 'forecast_height_m',
                 'observation_source', 'data_quality', 'sample_weight',
                 'forecast_height_text', 'forecast_period_text', 'forecast_dir_text',
                 'wind_speed_text', 'wind_dir_text', 'observed_period_s', 'observed_dir_deg',
                 'wind_wave_period_om', 'wind_wave_direction_om', 'period_diff_om_noaa']
    X_clean = X.drop(columns=[c for c in drop_cols if c in X.columns], errors='ignore')

    # Target is the residual
    y = df['residual_m']

    # Sample weights
    sample_weights = df['sample_weight'].values

    return X_clean, y, sample_weights


def train_with_weights(
    X_train: pd.DataFrame,
    y_train: pd.Series,
    sample_weights: np.ndarray,
    n_splits: int = 5
) -> tuple:
    """
    Train XGBoost model with sample weights.

    Args:
        X_train: Training features
        y_train: Training target
        sample_weights: Sample weights for training
        n_splits: Number of CV splits

    Returns:
        (model, cv_metrics) tuple
    """
    from xgboost import XGBRegressor
    from sklearn.metrics import mean_squared_error

    # XGBoost parameters (same as base model)
    params = {
        'objective': 'reg:squarederror',
        'n_estimators': 100,
        'learning_rate': 0.1,
        'max_depth': 5,
        'subsample': 0.8,
        'colsample_bytree': 0.8,
        'n_jobs': -1,
        'random_state': 42
    }

    # Time series cross-validation
    tscv = TimeSeriesSplit(n_splits=n_splits)
    cv_scores = []

    print(f"   Running {n_splits}-fold time series cross-validation...")

    for fold, (train_idx, val_idx) in enumerate(tscv.split(X_train)):
        X_fold_train = X_train.iloc[train_idx]
        y_fold_train = y_train.iloc[train_idx]
        w_fold_train = sample_weights[train_idx]

        X_fold_val = X_train.iloc[val_idx]
        y_fold_val = y_train.iloc[val_idx]

        # Train with sample weights
        model = XGBRegressor(**params)
        model.fit(X_fold_train, y_fold_train, sample_weight=w_fold_train)

        # Evaluate
        y_pred = model.predict(X_fold_val)
        rmse = np.sqrt(mean_squared_error(y_fold_val, y_pred))
        cv_scores.append(rmse)

        print(f"   Fold {fold + 1}: RMSE = {rmse:.4f}m")

    # Train final model on all data
    final_model = XGBRegressor(**params)
    final_model.fit(X_train, y_train, sample_weight=sample_weights)

    cv_metrics = {
        'mean_cv_rmse': np.mean(cv_scores),
        'std_cv_rmse': np.std(cv_scores)
    }

    return final_model, cv_metrics


def evaluate_by_data_quality(
    model,
    X_holdout: pd.DataFrame,
    df_holdout: pd.DataFrame
) -> dict:
    """
    Evaluate model performance separately for buoy and ERA5 data.

    Args:
        model: Trained XGBoost model
        X_holdout: Holdout features
        df_holdout: Full holdout DataFrame

    Returns:
        Dict with per-quality metrics
    """
    results = {}

    for quality in df_holdout['data_quality'].unique():
        mask = df_holdout['data_quality'] == quality
        if mask.sum() == 0:
            continue

        X_quality = X_holdout[mask]
        df_quality = df_holdout[mask]

        forecast = df_quality['forecast_height_m'].values
        observed = df_quality['observed_height_m'].values

        # Predict bias and correct
        bias_pred = model.predict(X_quality)
        corrected = forecast + bias_pred

        # Ensure positive values
        corrected = np.maximum(corrected, 0.01)

        raw_error = np.abs(forecast - observed)
        corrected_error = np.abs(corrected - observed)
        improved = corrected_error < raw_error

        results[quality] = {
            'n_samples': len(df_quality),
            'avg_raw_error_m': raw_error.mean(),
            'avg_corrected_error_m': corrected_error.mean(),
            'improvement_rate': improved.mean() * 100,
            'error_reduction': (raw_error.mean() - corrected_error.mean()) / raw_error.mean() * 100
        }

    return results


def log_feature_importances(model, feature_names: list, output_path: str):
    """Log feature importances to console and file."""
    if not hasattr(model, 'feature_importances_'):
        return

    importance_df = pd.DataFrame({
        'feature': feature_names,
        'importance': model.feature_importances_
    }).sort_values('importance', ascending=False)

    print("\n   Feature Importances (Top 10):")
    for _, row in importance_df.head(10).iterrows():
        bar = '█' * int(row['importance'] * 40)
        print(f"   {row['feature']:25s} {row['importance']:.4f} {bar}")

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    importance_df.to_csv(output_path, index=False)


def compare_with_baseline(
    df: pd.DataFrame,
    X: pd.DataFrame,
    y: pd.Series,
    holdout_size: int
) -> dict:
    """
    Compare augmented model with buoy-only baseline.

    Returns comparison metrics.
    """
    print("\n7. Training baseline (buoy-only) model for comparison...")

    # Filter to buoy-only data
    buoy_mask = df['data_quality'] == 'buoy'
    df_buoy = df[buoy_mask].copy()
    X_buoy = X[buoy_mask].copy()
    y_buoy = y[buoy_mask].copy()

    if len(df_buoy) < 100:
        print("   Not enough buoy data for baseline comparison")
        return {}

    # Split buoy data
    buoy_holdout_size = max(5, int(len(X_buoy) * 0.1))
    X_buoy_train = X_buoy.iloc[:-buoy_holdout_size]
    y_buoy_train = y_buoy.iloc[:-buoy_holdout_size]
    X_buoy_holdout = X_buoy.iloc[-buoy_holdout_size:]
    df_buoy_holdout = df_buoy.iloc[-buoy_holdout_size:]

    # Train baseline model (no weights needed, all buoy)
    baseline_model = QuiverBiasModel()
    baseline_metrics = baseline_model.train(X_buoy_train, y_buoy_train, n_splits=5)

    # Evaluate baseline on buoy holdout
    forecast = df_buoy_holdout['forecast_height_m'].values
    observed = df_buoy_holdout['observed_height_m'].values

    bias_pred = baseline_model.model.predict(X_buoy_holdout)
    corrected = forecast + bias_pred
    corrected = np.maximum(corrected, 0.01)

    baseline_error = np.abs(corrected - observed).mean()

    return {
        'baseline_cv_rmse': baseline_metrics['mean_cv_rmse'],
        'baseline_n_samples': len(X_buoy_train),
        'baseline_holdout_mae': baseline_error
    }


def main():
    parser = argparse.ArgumentParser(description="Train augmented bias correction model")
    parser.add_argument(
        "--data", "-d",
        default="data/augmented_training_data.csv",
        help="Path to augmented training data CSV"
    )
    parser.add_argument(
        "--output", "-o",
        default="models/bias_model_augmented_v1.json",
        help="Output path for trained model"
    )
    parser.add_argument(
        "--compare-baseline",
        action="store_true",
        help="Compare with buoy-only baseline model"
    )
    args = parser.parse_args()

    print("=" * 70)
    print("Quiver ML Augmented Bias Model Training")
    print(f"Started: {datetime.now().isoformat()}")
    print("=" * 70)

    # 1. Load data
    print("\n1. Loading augmented training data...")
    df = load_augmented_training_data(args.data)
    print(f"   Loaded {len(df)} samples")
    print(f"   Date range: {df['forecast_ts_utc'].min()} to {df['forecast_ts_utc'].max()}")

    # Data quality breakdown
    quality_counts = df['data_quality'].value_counts()
    print(f"\n   Data quality breakdown:")
    for quality, count in quality_counts.items():
        pct = count / len(df) * 100
        print(f"   - {quality}: {count} ({pct:.1f}%)")

    # 2. Prepare features
    print("\n2. Preparing features...")
    X, y, sample_weights = prepare_features(df)
    print(f"   Features: {list(X.columns)}")
    print(f"   Target stats: mean={y.mean():.3f}m, std={y.std():.3f}m")
    print(f"   Weight range: {sample_weights.min():.2f} - {sample_weights.max():.2f}")

    # 3. Train/holdout split
    print("\n3. Splitting data...")
    holdout_size = max(5, int(len(X) * 0.1))
    X_train, X_holdout = X.iloc[:-holdout_size], X.iloc[-holdout_size:]
    y_train, y_holdout = y.iloc[:-holdout_size], y.iloc[-holdout_size:]
    w_train = sample_weights[:-holdout_size]
    df_holdout = df.iloc[-holdout_size:]

    print(f"   Training samples: {len(X_train)}")
    print(f"   Holdout samples: {len(X_holdout)}")

    # 4. Train model with weights
    print("\n4. Training model with sample weights...")
    model, cv_metrics = train_with_weights(X_train, y_train, w_train, n_splits=5)

    print(f"\n   Cross-validation RMSE: {cv_metrics['mean_cv_rmse']:.4f} ± {cv_metrics['std_cv_rmse']:.4f} meters")

    # 5. Analyze feature importances
    print("\n5. Analyzing feature importances...")
    log_feature_importances(model, list(X.columns), "models/augmented_feature_importances.csv")

    # 6. Evaluate by data quality
    print("\n6. Evaluating on holdout set by data quality...")
    quality_metrics = evaluate_by_data_quality(model, X_holdout, df_holdout)

    for quality, metrics in quality_metrics.items():
        print(f"\n   {quality.upper()} ({metrics['n_samples']} samples):")
        print(f"   - Avg raw error: {metrics['avg_raw_error_m']:.3f}m")
        print(f"   - Avg corrected error: {metrics['avg_corrected_error_m']:.3f}m")
        print(f"   - Improvement rate: {metrics['improvement_rate']:.1f}%")
        print(f"   - Error reduction: {metrics['error_reduction']:.1f}%")

    # 7. Compare with baseline (optional)
    if args.compare_baseline:
        baseline_metrics = compare_with_baseline(df, X, y, holdout_size)
        if baseline_metrics:
            print(f"\n   Baseline Comparison:")
            print(f"   - Baseline (buoy-only) samples: {baseline_metrics['baseline_n_samples']}")
            print(f"   - Baseline CV RMSE: {baseline_metrics['baseline_cv_rmse']:.4f}m")
            print(f"   - Baseline holdout MAE: {baseline_metrics['baseline_holdout_mae']:.3f}m")

    # 8. Save model
    print("\n8. Saving model...")

    # Wrap in QuiverBiasModel for compatibility
    wrapper = QuiverBiasModel()
    wrapper.model = model
    wrapper.is_fitted = True

    os.makedirs(os.path.dirname(args.output), exist_ok=True)
    wrapper.save(args.output)

    # Summary
    print("\n" + "=" * 70)
    print("Training Complete!")
    print("=" * 70)
    print(f"   Model saved to: {args.output}")
    print(f"   CV RMSE: {cv_metrics['mean_cv_rmse']:.4f}m")
    print(f"   Training samples: {len(X_train)} (augmented)")

    if 'buoy' in quality_metrics:
        print(f"   Buoy holdout improvement: {quality_metrics['buoy']['improvement_rate']:.1f}%")

    print(f"\n   Finished: {datetime.now().isoformat()}")


if __name__ == "__main__":
    main()
