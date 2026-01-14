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

    # 3. Train model
    print("\n3. Training model...")
    model = QuiverBiasModel()
    metrics = model.train(X, y, n_splits=5)

    print(f"\n   CV RMSE: {metrics['mean_cv_rmse']:.4f} +/- {metrics['std_cv_rmse']:.4f} meters")

    # 4. Save model
    print("\n4. Saving model...")
    os.makedirs(os.path.dirname(MODEL_PATH), exist_ok=True)
    model.save(MODEL_PATH)

    # 5. Inference demo
    print("\n5. Inference demo on last 5 samples...")
    sample_X = X.iloc[-5:]
    sample_forecast = df['forecast_height_m'].iloc[-5:]
    sample_observed = df['observed_height_m'].iloc[-5:]

    corrected = model.predict(sample_X, sample_forecast)

    results = pd.DataFrame({
        'Forecast': sample_forecast.values,
        'Corrected': corrected.values,
        'Observed': sample_observed.values
    })
    results['Raw_Error'] = abs(results['Forecast'] - results['Observed'])
    results['Corrected_Error'] = abs(results['Corrected'] - results['Observed'])
    results['Improved'] = results['Corrected_Error'] < results['Raw_Error']

    print(results.to_string(index=False))

    improvement_rate = results['Improved'].mean() * 100
    print(f"\n   Improvement rate: {improvement_rate:.1f}%")

    print("\n" + "=" * 60)
    print(f"Training complete! Model saved to {MODEL_PATH}")
    print("=" * 60)


if __name__ == "__main__":
    main()
