"""Feature engineering for v2 bias correction model."""
import numpy as np
import pandas as pd


# Full list of features used by v2 model (11 features)
V2_FEATURE_COLUMNS = [
    'forecast_height_m',
    'wave_period_sq',
    'wave_steepness',
    'wave_direction_sin',
    'wave_direction_cos',
    'wind_speed_ms',
    'wind_direction_sin',
    'wind_direction_cos',
    'hour',
    'month',
    'wind_missing',
]


def preprocess_v2(df: pd.DataFrame) -> pd.DataFrame:
    """
    Apply v2 feature engineering pipeline.

    Input columns expected:
        - forecast_height_m: Raw NOAA forecast height in meters
        - forecast_period_s: Wave period in seconds
        - forecast_dir_deg: Wave direction in degrees (0-360)
        - wind_speed_ms: Wind speed in m/s (0 if missing)
        - wind_dir_deg: Wind direction in degrees (0-360)
        - wind_missing: 1 if wind data was missing, 0 otherwise
        - forecast_ts_utc: Timestamp (for temporal features)

    Returns:
        DataFrame with exactly V2_FEATURE_COLUMNS
    """
    out = pd.DataFrame(index=df.index)

    # 1. Primary feature: raw forecast height
    out['forecast_height_m'] = df['forecast_height_m'].astype(float)

    # 2. Period squared (bathymetry proxy)
    period = df['forecast_period_s'].astype(float).fillna(10.0)
    out['wave_period_sq'] = period ** 2

    # 3. Wave steepness (new physics feature for v2)
    # steepness = height / (period^2 + epsilon) — avoids division by near-zero
    out['wave_steepness'] = out['forecast_height_m'] / (out['wave_period_sq'] + 0.1)

    # 4. Wave direction sin/cos encoding
    wave_dir_rad = df['forecast_dir_deg'].astype(float).fillna(270.0) * (2 * np.pi / 360.0)
    out['wave_direction_sin'] = np.sin(wave_dir_rad)
    out['wave_direction_cos'] = np.cos(wave_dir_rad)

    # 5. Wind speed
    out['wind_speed_ms'] = df['wind_speed_ms'].astype(float).fillna(0.0)

    # 6. Wind direction sin/cos encoding
    wind_dir_rad = df['wind_dir_deg'].astype(float).fillna(0.0) * (2 * np.pi / 360.0)
    out['wind_direction_sin'] = np.sin(wind_dir_rad)
    out['wind_direction_cos'] = np.cos(wind_dir_rad)

    # 7. Temporal features
    if 'forecast_ts_utc' in df.columns:
        ts = pd.to_datetime(df['forecast_ts_utc'], errors='coerce')
        out['hour'] = ts.dt.hour.fillna(12).astype(int)
        out['month'] = ts.dt.month.fillna(6).astype(int)
    else:
        out['hour'] = 12
        out['month'] = 6

    # 8. Wind missing indicator
    out['wind_missing'] = df['wind_missing'].astype(int) if 'wind_missing' in df.columns else 0

    return out[V2_FEATURE_COLUMNS]
