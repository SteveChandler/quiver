# ml/train.py
"""Train the bias correction model on real data."""
import pandas as pd
import numpy as np
import os
from transformers import FeatureEngineer
from model import QuiverBiasModel
from config import MODEL_PATH, MODEL_VERSION

def load_training_data(path: str = "data/training_data.csv") -> pd.DataFrame:
    """Load training data from CSV."""
    if not os.path.exists(path):
        raise FileNotFoundError(
            f"Training data not found at {path}. "
            "Run extract_training_data.py first."
        )

    df = pd.read_csv(path)
    df['forecast_ts_utc'] = pd.to_datetime(df['forecast_ts_utc'])
    return df


def prepare_features(df: pd.DataFrame) -> tuple[pd.DataFrame, pd.Series]:
    """
    Prepare features and target for training.

    Returns:
        (X, y) tuple where X is features DataFrame and y is target Series
    """
    # Rename columns to match FeatureEngineer expectations
    df_renamed = df.rename(columns={
        'forecast_ts_utc': 'timestamp',
        'forecast_height_m': 'wave_height_model',
        'forecast_period_s': 'wave_period',
        'forecast_dir_deg': 'wave_direction',
        'wind_speed_ms': 'wind_speed',
        'wind_dir_deg': 'wind_direction'
        # wind_missing stays as-is
    })

    # Apply feature engineering
    fe = FeatureEngineer()
    X = fe.preprocess(df_renamed)

    # Drop non-feature columns
    drop_cols = ['timestamp', 'wave_height_model', 'beach_id', 'observed_ts',
                 'observed_height_m', 'residual_m', 'forecast_height_m']
    X_clean = X.drop(columns=[c for c in drop_cols if c in X.columns])

    # Target is the residual
    y = df['residual_m']

    return X_clean, y


def log_feature_importances(model, feature_names: list, output_path: str = "models/feature_importances.csv"):
    """Log feature importances to console and CSV file."""
    if not hasattr(model.model, 'feature_importances_'):
        print("   Model does not have feature importances")
        return

    importance_df = pd.DataFrame({
        'feature': feature_names,
        'importance': model.model.feature_importances_
    }).sort_values('importance', ascending=False)

    print("\n   Feature Importances:")
    for _, row in importance_df.iterrows():
        bar = '█' * int(row['importance'] * 50)
        print(f"   {row['feature']:25s} {row['importance']:.4f} {bar}")

    # Save to CSV
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    importance_df.to_csv(output_path, index=False)
    print(f"\n   Saved feature importances to {output_path}")


def main():
    print("=" * 60)
    print("Quiver ML Bias Model Training")
    print("=" * 60)

    # 1. Load data
    print("\n1. Loading training data...")
    df = load_training_data()
    print(f"   Loaded {len(df)} samples")
    print(f"   Date range: {df['forecast_ts_utc'].min()} to {df['forecast_ts_utc'].max()}")

    # 2. Prepare features
    print("\n2. Preparing features...")
    X, y = prepare_features(df)
    print(f"   Features: {list(X.columns)}")
    print(f"   Target stats: mean={y.mean():.3f}m, std={y.std():.3f}m")

    # 3. Split into train and holdout (no shuffle to respect time series)
    # Use last 10% as true holdout for unbiased evaluation
    holdout_size = max(5, int(len(X) * 0.1))
    X_train, X_holdout = X.iloc[:-holdout_size], X.iloc[-holdout_size:]
    y_train, y_holdout = y.iloc[:-holdout_size], y.iloc[-holdout_size:]
    df_holdout = df.iloc[-holdout_size:]
    print(f"   Training samples: {len(X_train)}, Holdout samples: {len(X_holdout)}")

    # 4. Train model on training set only
    print("\n3. Training model...")
    model = QuiverBiasModel()
    metrics = model.train(X_train, y_train, n_splits=5)

    print(f"\n   CV RMSE: {metrics['mean_cv_rmse']:.4f} +/- {metrics['std_cv_rmse']:.4f} meters")

    # 5. Log feature importances
    print("\n4. Analyzing feature importances...")
    log_feature_importances(model, list(X.columns))

    # 6. Save model
    print("\n5. Saving model...")
    os.makedirs(os.path.dirname(MODEL_PATH), exist_ok=True)
    model.save(MODEL_PATH)

    # 7. Evaluate on TRUE holdout set (never seen during training)
    print("\n6. Holdout set evaluation (unbiased)...")
    sample_forecast = df_holdout['forecast_height_m']
    sample_observed = df_holdout['observed_height_m']

    corrected = model.predict(X_holdout, sample_forecast)

    results = pd.DataFrame({
        'Forecast': sample_forecast.values,
        'Corrected': corrected.values,
        'Observed': sample_observed.values
    })
    results['Raw_Error'] = abs(results['Forecast'] - results['Observed'])
    results['Corrected_Error'] = abs(results['Corrected'] - results['Observed'])
    results['Improved'] = results['Corrected_Error'] < results['Raw_Error']

    # Show last 5 samples as demo
    print(results.tail(5).to_string(index=False))

    improvement_rate = results['Improved'].mean() * 100
    avg_raw_error = results['Raw_Error'].mean()
    avg_corrected_error = results['Corrected_Error'].mean()
    print(f"\n   Holdout set metrics ({len(results)} samples):")
    print(f"   - Improvement rate: {improvement_rate:.1f}%")
    print(f"   - Avg raw error: {avg_raw_error:.3f}m")
    print(f"   - Avg corrected error: {avg_corrected_error:.3f}m")
    print(f"   - Error reduction: {(avg_raw_error - avg_corrected_error) / avg_raw_error * 100:.1f}%")

    print("\n" + "=" * 60)
    print(f"Training complete! Model saved to {MODEL_PATH}")
    print("=" * 60)


if __name__ == "__main__":
    main()
