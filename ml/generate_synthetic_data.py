"""Generate synthetic training data for testing the ML pipeline."""
import numpy as np
import pandas as pd
from datetime import datetime, timedelta
import os


def generate_synthetic_training_data(
    n_samples: int = 2000,
    output_path: str = "data/training_data.csv"
) -> pd.DataFrame:
    """
    Generate synthetic forecast-observation pairs for testing.

    The synthetic data mimics real patterns:
    - Forecasts tend to underestimate wave heights (positive bias)
    - Bias varies with wave height and conditions
    - Realistic range of values for San Diego beaches
    """
    np.random.seed(42)

    # Generate beach IDs (fake UUIDs)
    beach_ids = [f"beach-{i:04d}" for i in range(25)]

    # Generate timestamps over last 30 days
    end_time = datetime.now()
    start_time = end_time - timedelta(days=30)
    timestamps = pd.date_range(start=start_time, end=end_time, periods=n_samples)

    data = []
    for i in range(n_samples):
        beach_id = np.random.choice(beach_ids)
        forecast_ts = timestamps[i]

        # Generate "true" wave height (what will be observed)
        # Realistic range: 0.3m to 3m for San Diego
        true_height = np.random.exponential(0.8) + 0.3
        true_height = min(true_height, 4.0)  # Cap at 4m

        # Generate forecast with systematic bias
        # Forecasts tend to underestimate by 10-20%, with noise
        bias_factor = np.random.uniform(0.8, 0.95)
        noise = np.random.normal(0, 0.1)
        forecast_height = true_height * bias_factor + noise
        forecast_height = max(forecast_height, 0.15)  # Min forecast

        # Other features
        wave_period = np.random.uniform(8, 16)
        wave_dir = np.random.uniform(200, 320)  # Typical SW-NW swell
        wind_speed = np.random.exponential(3)  # m/s
        wind_dir = np.random.uniform(180, 360)

        # Observation is the "true" value with small measurement noise
        observed_height = true_height + np.random.normal(0, 0.05)
        observed_height = max(observed_height, 0.1)

        # Residual = observed - forecast
        residual = observed_height - forecast_height

        data.append({
            'beach_id': beach_id,
            'forecast_ts_utc': forecast_ts,
            'observed_ts': forecast_ts + timedelta(minutes=np.random.randint(-30, 30)),
            'forecast_height_m': round(forecast_height, 2),
            'observed_height_m': round(observed_height, 2),
            'residual_m': round(residual, 2),
            'forecast_period_s': round(wave_period, 1),
            'forecast_dir_deg': round(wave_dir, 0),
            'wind_speed_ms': round(wind_speed, 1),
            'wind_dir_deg': round(wind_dir, 0),
        })

    df = pd.DataFrame(data)

    # Save to file
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    df.to_csv(output_path, index=False)

    print(f"Generated {len(df)} synthetic training samples")
    print(f"Saved to {output_path}")

    return df


if __name__ == "__main__":
    df = generate_synthetic_training_data()

    print(f"\nDataset summary:")
    print(f"  Rows: {len(df)}")
    print(f"  Date range: {df['forecast_ts_utc'].min()} to {df['forecast_ts_utc'].max()}")
    print(f"  Mean forecast: {df['forecast_height_m'].mean():.3f}m")
    print(f"  Mean observed: {df['observed_height_m'].mean():.3f}m")
    print(f"  Mean residual: {df['residual_m'].mean():.3f}m (positive = forecast underestimates)")
    print(f"  Std residual: {df['residual_m'].std():.3f}m")
