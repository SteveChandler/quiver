"""
Train the ensemble bias correction model using NOAA + Open-Meteo features.

This script trains an XGBoost model that learns from both NOAA and Open-Meteo
forecasts to predict wave height bias corrections.

Usage:
    python train_ensemble.py --data data/ensemble_training_data.csv --output models/bias_model_ensemble_v1.json
"""
import os
import argparse
from datetime import datetime

import pandas as pd
import numpy as np

from transformers_ensemble import EnsembleFeatureEngineer
from model import QuiverBiasModel
from config import MODEL_PATH, MODEL_VERSION


def load_ensemble_training_data(path: str = "data/ensemble_training_data.csv") -> pd.DataFrame:
    """Load ensemble training data from CSV."""
    if not os.path.exists(path):
        raise FileNotFoundError(
            f"Ensemble training data not found at {path}. "
            "Run extract_ensemble_training_data.py first."
        )

    df = pd.read_csv(path)
    df['forecast_ts_utc'] = pd.to_datetime(df['forecast_ts_utc'])

    # Ensure boolean columns are properly typed
    if 'om_available' in df.columns:
        df['om_available'] = df['om_available'].astype(bool)
    if 'om_missing' in df.columns:
        df['om_missing'] = df['om_missing'].astype(int)

    return df


def prepare_ensemble_features(df: pd.DataFrame) -> tuple[pd.DataFrame, pd.Series]:
    """
    Prepare ensemble features and target for training.

    Args:
        df: Raw training DataFrame

    Returns:
        (X, y) tuple where X is features DataFrame and y is target Series
    """
    # Apply ensemble feature engineering
    fe = EnsembleFeatureEngineer()
    df_processed = fe.preprocess(df)

    # Get feature columns
    feature_cols = fe.get_feature_columns()

    # Filter to available columns
    available_cols = [c for c in feature_cols if c in df_processed.columns]
    missing_cols = [c for c in feature_cols if c not in df_processed.columns]

    if missing_cols:
        print(f"  Warning: Missing feature columns (will fill with defaults): {missing_cols}")
        for col in missing_cols:
            df_processed[col] = 0.0

    X = df_processed[feature_cols].copy()

    # Target is the residual (observed - NOAA forecast)
    y = df['residual_m']

    return X, y


def analyze_feature_importance(model, feature_names: list, output_path: str = "models/ensemble_feature_importances.csv"):
    """
    Analyze and log feature importances.

    Args:
        model: Trained QuiverBiasModel
        feature_names: List of feature names
        output_path: Path to save importance CSV
    """
    if not hasattr(model.model, 'feature_importances_'):
        print("   Model does not support feature importances")
        return

    importance_df = pd.DataFrame({
        'feature': feature_names,
        'importance': model.model.feature_importances_
    }).sort_values('importance', ascending=False)

    print("\n   Feature Importances (Top 15):")
    print("   " + "-" * 50)
    for i, (_, row) in enumerate(importance_df.head(15).iterrows()):
        bar_len = int(row['importance'] * 40)
        bar = '█' * bar_len + '░' * (40 - bar_len)
        print(f"   {row['feature']:30s} {row['importance']:.4f} {bar}")

    # Categorize features
    noaa_features = [f for f in feature_names if 'noaa' in f.lower() or 'forecast' in f.lower() or 'wind' in f.lower()]
    om_features = [f for f in feature_names if 'om' in f.lower() or 'swell' in f.lower()]
    ensemble_features = [f for f in feature_names if 'delta' in f.lower() or 'ratio' in f.lower() or 'agree' in f.lower()]
    temporal_features = [f for f in feature_names if 'hour' in f.lower() or 'month' in f.lower()]

    noaa_importance = importance_df[importance_df['feature'].isin(noaa_features)]['importance'].sum()
    om_importance = importance_df[importance_df['feature'].isin(om_features)]['importance'].sum()
    ensemble_importance = importance_df[importance_df['feature'].isin(ensemble_features)]['importance'].sum()
    temporal_importance = importance_df[importance_df['feature'].isin(temporal_features)]['importance'].sum()

    print("\n   Feature Category Contributions:")
    print(f"   - NOAA features:     {noaa_importance:.1%}")
    print(f"   - Open-Meteo:        {om_importance:.1%}")
    print(f"   - Ensemble derived:  {ensemble_importance:.1%}")
    print(f"   - Temporal:          {temporal_importance:.1%}")

    # Save to CSV
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    importance_df.to_csv(output_path, index=False)
    print(f"\n   Saved feature importances to {output_path}")


def evaluate_on_holdout(
    model,
    X_holdout: pd.DataFrame,
    df_holdout: pd.DataFrame
) -> dict:
    """
    Evaluate model performance on holdout set.

    Args:
        model: Trained QuiverBiasModel
        X_holdout: Holdout features
        df_holdout: Full holdout DataFrame with observed values

    Returns:
        Dictionary with evaluation metrics
    """
    forecast = df_holdout['forecast_height_m']
    observed = df_holdout['observed_height_m']

    # Get model predictions
    corrected = model.predict(X_holdout, forecast)

    results = pd.DataFrame({
        'Forecast': forecast.values,
        'Corrected': corrected.values,
        'Observed': observed.values
    })
    results['Raw_Error'] = abs(results['Forecast'] - results['Observed'])
    results['Corrected_Error'] = abs(results['Corrected'] - results['Observed'])
    results['Improved'] = results['Corrected_Error'] < results['Raw_Error']

    # Calculate metrics
    improvement_rate = results['Improved'].mean() * 100
    avg_raw_error = results['Raw_Error'].mean()
    avg_corrected_error = results['Corrected_Error'].mean()
    error_reduction = (avg_raw_error - avg_corrected_error) / avg_raw_error * 100

    # Show sample predictions
    print("\n   Sample predictions (last 8):")
    print("   " + results.tail(8).to_string(index=False))

    return {
        'improvement_rate': improvement_rate,
        'avg_raw_error': avg_raw_error,
        'avg_corrected_error': avg_corrected_error,
        'error_reduction': error_reduction,
        'n_samples': len(results)
    }


def compare_with_baseline(
    df: pd.DataFrame,
    ensemble_model,
    X_ensemble: pd.DataFrame
) -> dict:
    """
    Compare ensemble model with NOAA-only baseline.

    Args:
        df: Full training DataFrame
        ensemble_model: Trained ensemble model
        X_ensemble: Ensemble features for holdout

    Returns:
        Comparison metrics
    """
    # Train a simple NOAA-only model for comparison
    from transformers import FeatureEngineer as BaseFeatureEngineer
    from model import QuiverBiasModel

    print("\n7. Training baseline (NOAA-only) model for comparison...")

    # Prepare NOAA-only features
    df_noaa = df.rename(columns={
        'forecast_ts_utc': 'timestamp',
        'forecast_height_m': 'wave_height_model',
        'forecast_period_s': 'wave_period',
        'forecast_dir_deg': 'wave_direction',
        'wind_speed_ms': 'wind_speed',
        'wind_dir_deg': 'wind_direction'
    })

    fe_base = BaseFeatureEngineer()
    X_base = fe_base.preprocess(df_noaa)

    # Drop ALL non-numeric and non-feature columns
    drop_cols = ['timestamp', 'wave_height_model', 'beach_id', 'observed_ts',
                 'observed_height_m', 'residual_m', 'forecast_height_m',
                 'wave_height_om', 'wave_period_om', 'wave_direction_om',
                 'swell_height_om', 'wind_wave_height_om', 'delta_noaa_om',
                 'abs_delta_noaa_om', 'om_available', 'om_missing',
                 'direction_agreement', 'swell_dominance_om', 'timestamp_om',
                 'swell_period_om', 'swell_direction_om', 'wind_wave_period_om',
                 'wind_wave_direction_om', 'swell_direction_om_sin', 'swell_direction_om_cos']
    X_base_clean = X_base.drop(columns=[c for c in drop_cols if c in X_base.columns], errors='ignore')

    # Ensure all columns are numeric
    X_base_clean = X_base_clean.select_dtypes(include=[np.number])

    y = df['residual_m']

    # Same holdout split
    holdout_size = max(5, int(len(X_base_clean) * 0.1))
    X_base_train = X_base_clean.iloc[:-holdout_size]
    X_base_holdout = X_base_clean.iloc[-holdout_size:]
    y_train = y.iloc[:-holdout_size]
    df_holdout = df.iloc[-holdout_size:]

    baseline_model = QuiverBiasModel()
    baseline_metrics = baseline_model.train(X_base_train, y_train, n_splits=5)

    # Evaluate baseline on holdout
    baseline_corrected = baseline_model.predict(X_base_holdout, df_holdout['forecast_height_m'])

    baseline_error = abs(baseline_corrected - df_holdout['observed_height_m']).mean()
    ensemble_corrected = ensemble_model.predict(X_ensemble, df_holdout['forecast_height_m'])
    ensemble_error = abs(ensemble_corrected - df_holdout['observed_height_m']).mean()

    improvement = (baseline_error - ensemble_error) / baseline_error * 100

    return {
        'baseline_cv_rmse': baseline_metrics['mean_cv_rmse'],
        'baseline_holdout_mae': baseline_error,
        'ensemble_holdout_mae': ensemble_error,
        'ensemble_improvement_over_baseline': improvement
    }


def main():
    parser = argparse.ArgumentParser(description="Train ensemble bias correction model")
    parser.add_argument(
        "--data", "-d",
        default="data/ensemble_training_data.csv",
        help="Path to ensemble training data CSV"
    )
    parser.add_argument(
        "--output", "-o",
        default="models/bias_model_ensemble_v1.json",
        help="Output path for trained model"
    )
    parser.add_argument(
        "--compare-baseline",
        action="store_true",
        help="Compare with NOAA-only baseline model"
    )
    args = parser.parse_args()

    print("=" * 70)
    print("Quiver Ensemble ML Bias Model Training")
    print(f"Started: {datetime.now().isoformat()}")
    print("=" * 70)

    # 1. Load data
    print("\n1. Loading ensemble training data...")
    df = load_ensemble_training_data(args.data)
    print(f"   Loaded {len(df)} samples")
    print(f"   Date range: {df['forecast_ts_utc'].min()} to {df['forecast_ts_utc'].max()}")

    om_coverage = (df.get('om_available', pd.Series([True] * len(df)))).mean() * 100
    print(f"   Open-Meteo coverage: {om_coverage:.1f}%")

    # 2. Prepare features
    print("\n2. Preparing ensemble features...")
    X, y = prepare_ensemble_features(df)
    print(f"   Features: {len(X.columns)}")
    print(f"   Target stats: mean={y.mean():.3f}m, std={y.std():.3f}m")

    # 3. Train/holdout split (time-series aware - no shuffle)
    print("\n3. Splitting data...")
    holdout_size = max(5, int(len(X) * 0.1))
    X_train, X_holdout = X.iloc[:-holdout_size], X.iloc[-holdout_size:]
    y_train, y_holdout = y.iloc[:-holdout_size], y.iloc[-holdout_size:]
    df_holdout = df.iloc[-holdout_size:]

    print(f"   Training samples: {len(X_train)}")
    print(f"   Holdout samples: {len(X_holdout)}")

    # 4. Train ensemble model
    print("\n4. Training ensemble model...")
    model = QuiverBiasModel()
    metrics = model.train(X_train, y_train, n_splits=5)

    print(f"\n   Cross-validation RMSE: {metrics['mean_cv_rmse']:.4f} ± {metrics['std_cv_rmse']:.4f} meters")

    # 5. Analyze feature importances
    print("\n5. Analyzing feature importances...")
    analyze_feature_importance(model, list(X.columns))

    # 6. Evaluate on holdout
    print("\n6. Evaluating on holdout set...")
    holdout_metrics = evaluate_on_holdout(model, X_holdout, df_holdout)

    print(f"\n   Holdout Metrics ({holdout_metrics['n_samples']} samples):")
    print(f"   - Improvement rate: {holdout_metrics['improvement_rate']:.1f}%")
    print(f"   - Avg raw error: {holdout_metrics['avg_raw_error']:.3f}m")
    print(f"   - Avg corrected error: {holdout_metrics['avg_corrected_error']:.3f}m")
    print(f"   - Error reduction: {holdout_metrics['error_reduction']:.1f}%")

    # 7. Compare with baseline (optional)
    if args.compare_baseline:
        comparison = compare_with_baseline(df, model, X_holdout)
        print(f"\n   Baseline Comparison:")
        print(f"   - Baseline (NOAA-only) CV RMSE: {comparison['baseline_cv_rmse']:.4f}m")
        print(f"   - Baseline holdout MAE: {comparison['baseline_holdout_mae']:.3f}m")
        print(f"   - Ensemble holdout MAE: {comparison['ensemble_holdout_mae']:.3f}m")
        print(f"   - Ensemble improvement: {comparison['ensemble_improvement_over_baseline']:.1f}%")

    # 8. Save model
    print("\n8. Saving model...")
    os.makedirs(os.path.dirname(args.output), exist_ok=True)
    model.save(args.output)

    # Summary
    print("\n" + "=" * 70)
    print("Training Complete!")
    print("=" * 70)
    print(f"   Model saved to: {args.output}")
    print(f"   CV RMSE: {metrics['mean_cv_rmse']:.4f}m")
    print(f"   Holdout improvement rate: {holdout_metrics['improvement_rate']:.1f}%")
    print(f"   Holdout error reduction: {holdout_metrics['error_reduction']:.1f}%")
    print(f"\n   Finished: {datetime.now().isoformat()}")


if __name__ == "__main__":
    main()
