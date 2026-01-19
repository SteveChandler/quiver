"""
Feature engineering for ensemble model with NOAA + Open-Meteo features.

This extends the base FeatureEngineer to handle ensemble-specific features
including Open-Meteo data and cross-source derived features.
"""
import numpy as np
import pandas as pd
from sklearn.base import BaseEstimator, TransformerMixin
from transformers import SineCosineTransformer


class EnsembleFeatureEngineer:
    """
    Feature engineering for the ensemble bias correction model.

    Handles:
    - NOAA features (wave height, period, direction, wind)
    - Open-Meteo features (wave height, period, direction, swell decomposition)
    - Cross-source derived features (delta, agreement metrics)
    - Temporal features (hour, month)
    - Cyclical encoding for directions
    """

    def __init__(self):
        # Direction transformers
        self.noaa_wave_dir_transformer = SineCosineTransformer('forecast_dir_deg', 360.0)
        self.noaa_wind_dir_transformer = SineCosineTransformer('wind_dir_deg', 360.0)
        self.om_wave_dir_transformer = SineCosineTransformer('wave_direction_om', 360.0)
        self.om_swell_dir_transformer = SineCosineTransformer('swell_direction_om', 360.0)

    def preprocess(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Apply all feature engineering transformations.

        Args:
            df: Raw DataFrame with NOAA and Open-Meteo features

        Returns:
            Transformed DataFrame ready for model training/inference
        """
        df_out = df.copy()

        # ====== Temporal Features ======
        if 'forecast_ts_utc' in df_out.columns:
            df_out['forecast_ts_utc'] = pd.to_datetime(df_out['forecast_ts_utc'])
            df_out['hour'] = df_out['forecast_ts_utc'].dt.hour
            df_out['month'] = df_out['forecast_ts_utc'].dt.month

            # Cyclical encoding for hour and month
            df_out['hour_sin'] = np.sin(2 * np.pi * df_out['hour'] / 24)
            df_out['hour_cos'] = np.cos(2 * np.pi * df_out['hour'] / 24)
            df_out['month_sin'] = np.sin(2 * np.pi * df_out['month'] / 12)
            df_out['month_cos'] = np.cos(2 * np.pi * df_out['month'] / 12)

        # ====== Physics-based Interactions ======
        # Period squared (bathymetry proxy)
        if 'forecast_period_s' in df_out.columns:
            df_out['noaa_period_sq'] = df_out['forecast_period_s'] ** 2

        if 'wave_period_om' in df_out.columns:
            df_out['om_period_sq'] = df_out['wave_period_om'] ** 2

        # Wave steepness proxy (height / period^2)
        if 'forecast_height_m' in df_out.columns and 'forecast_period_s' in df_out.columns:
            df_out['noaa_steepness'] = df_out['forecast_height_m'] / (df_out['forecast_period_s'] ** 2 + 0.1)

        if 'wave_height_om' in df_out.columns and 'wave_period_om' in df_out.columns:
            df_out['om_steepness'] = df_out['wave_height_om'] / (df_out['wave_period_om'] ** 2 + 0.1)

        # ====== Ensemble Features ======
        # Delta features (already computed in extraction, but ensure they exist)
        if 'forecast_height_m' in df_out.columns and 'wave_height_om' in df_out.columns:
            if 'delta_noaa_om' not in df_out.columns:
                df_out['delta_noaa_om'] = df_out['forecast_height_m'] - df_out['wave_height_om']
            if 'abs_delta_noaa_om' not in df_out.columns:
                df_out['abs_delta_noaa_om'] = df_out['delta_noaa_om'].abs()

        # Ratio features
        if 'forecast_height_m' in df_out.columns and 'wave_height_om' in df_out.columns:
            # Ratio of NOAA to Open-Meteo (capped to avoid extreme values)
            ratio = df_out['forecast_height_m'] / (df_out['wave_height_om'] + 0.01)
            df_out['height_ratio_noaa_om'] = ratio.clip(0.1, 10.0)

        # Model agreement indicator (1 if within 0.3m, 0 otherwise)
        if 'abs_delta_noaa_om' in df_out.columns:
            df_out['models_agree'] = (df_out['abs_delta_noaa_om'] < 0.3).astype(float)

        # Direction agreement (cosine similarity between NOAA and OM wave directions)
        if 'forecast_dir_deg' in df_out.columns and 'wave_direction_om' in df_out.columns:
            noaa_rad = np.deg2rad(df_out['forecast_dir_deg'])
            om_rad = np.deg2rad(df_out['wave_direction_om'])
            # Cosine of angle difference (1 = same direction, -1 = opposite)
            df_out['direction_agreement'] = np.cos(noaa_rad - om_rad)

        # ====== Swell Decomposition Features (Open-Meteo specific) ======
        if 'swell_height_om' in df_out.columns and 'wind_wave_height_om' in df_out.columns:
            # Swell dominance already computed, but ensure it exists
            if 'swell_dominance_om' not in df_out.columns:
                total = df_out['swell_height_om'] + df_out['wind_wave_height_om'] + 0.01
                df_out['swell_dominance_om'] = df_out['swell_height_om'] / total

            # Wind wave contribution
            df_out['wind_wave_ratio'] = 1 - df_out['swell_dominance_om']

        # ====== Cyclical Direction Encoding ======
        # NOAA wave direction
        if 'forecast_dir_deg' in df_out.columns:
            df_out = self.noaa_wave_dir_transformer.transform(df_out)

        # NOAA wind direction
        if 'wind_dir_deg' in df_out.columns:
            df_out = self.noaa_wind_dir_transformer.transform(df_out)

        # Open-Meteo wave direction
        if 'wave_direction_om' in df_out.columns:
            df_out = self.om_wave_dir_transformer.transform(df_out)

        # Open-Meteo swell direction
        if 'swell_direction_om' in df_out.columns:
            df_out = self.om_swell_dir_transformer.transform(df_out)

        return df_out

    def get_feature_columns(self) -> list[str]:
        """
        Get the list of feature columns expected by the model.

        Returns:
            List of feature column names
        """
        return [
            # NOAA features
            'forecast_height_m',
            'forecast_period_s',
            'noaa_period_sq',
            'noaa_steepness',
            'forecast_dir_deg_sin',
            'forecast_dir_deg_cos',
            'wind_speed_ms',
            'wind_dir_deg_sin',
            'wind_dir_deg_cos',

            # Open-Meteo features
            'wave_height_om',
            'wave_period_om',
            'om_period_sq',
            'om_steepness',
            'wave_direction_om_sin',
            'wave_direction_om_cos',
            'swell_height_om',
            'swell_period_om',
            'swell_direction_om_sin',
            'swell_direction_om_cos',
            'wind_wave_height_om',

            # Ensemble features
            'delta_noaa_om',
            'abs_delta_noaa_om',
            'height_ratio_noaa_om',
            'models_agree',
            'swell_dominance_om',
            'wind_wave_ratio',
            'direction_agreement',

            # Temporal features
            'hour_sin',
            'hour_cos',
            'month_sin',
            'month_cos',

            # Missing data indicators
            'wind_missing',
            'om_missing',
        ]

    def get_minimal_feature_columns(self) -> list[str]:
        """
        Get minimal feature set for when Open-Meteo is unavailable.

        These are the features that can be computed from NOAA data alone.
        """
        return [
            'forecast_height_m',
            'forecast_period_s',
            'noaa_period_sq',
            'noaa_steepness',
            'forecast_dir_deg_sin',
            'forecast_dir_deg_cos',
            'wind_speed_ms',
            'wind_dir_deg_sin',
            'wind_dir_deg_cos',
            'hour_sin',
            'hour_cos',
            'month_sin',
            'month_cos',
            'wind_missing',
        ]


class EnsembleModelInputValidator:
    """
    Validates and prepares input data for the ensemble model.
    """

    def __init__(self, feature_engineer: EnsembleFeatureEngineer):
        self.fe = feature_engineer
        self.feature_cols = feature_engineer.get_feature_columns()

    def validate_and_prepare(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Validate input data and prepare features for model inference.

        Args:
            df: Raw input DataFrame

        Returns:
            DataFrame with validated and transformed features
        """
        # Apply feature engineering
        df_processed = self.fe.preprocess(df)

        # Check which features are available
        available_features = [c for c in self.feature_cols if c in df_processed.columns]
        missing_features = [c for c in self.feature_cols if c not in df_processed.columns]

        if missing_features:
            print(f"Warning: Missing features will be filled: {missing_features}")

            # Fill missing features with defaults
            for col in missing_features:
                if 'om' in col.lower() or 'swell' in col.lower():
                    # Open-Meteo features default to NOAA equivalent or 0
                    if col == 'wave_height_om':
                        df_processed[col] = df_processed.get('forecast_height_m', 1.0)
                    elif col == 'wave_period_om':
                        df_processed[col] = df_processed.get('forecast_period_s', 10.0)
                    elif 'delta' in col:
                        df_processed[col] = 0.0
                    elif 'ratio' in col:
                        df_processed[col] = 1.0
                    elif 'dominance' in col:
                        df_processed[col] = 0.8
                    elif 'agree' in col:
                        df_processed[col] = 1.0
                    else:
                        df_processed[col] = 0.0
                else:
                    df_processed[col] = 0.0

        # Select and order features
        X = df_processed[self.feature_cols].copy()

        # Final NaN check
        if X.isna().any().any():
            print("Warning: NaN values detected, filling with 0")
            X = X.fillna(0)

        return X


# Example usage
if __name__ == "__main__":
    # Create sample data
    sample_data = pd.DataFrame({
        'forecast_ts_utc': ['2026-01-15 12:00:00'],
        'forecast_height_m': [1.5],
        'forecast_period_s': [10.0],
        'forecast_dir_deg': [270.0],
        'wind_speed_ms': [5.0],
        'wind_dir_deg': [180.0],
        'wave_height_om': [1.6],
        'wave_period_om': [11.0],
        'wave_direction_om': [265.0],
        'swell_height_om': [1.2],
        'swell_period_om': [12.0],
        'swell_direction_om': [260.0],
        'wind_wave_height_om': [0.4],
        'wind_missing': [0],
        'om_missing': [0],
    })

    fe = EnsembleFeatureEngineer()
    processed = fe.preprocess(sample_data)

    print("Processed features:")
    for col in processed.columns:
        print(f"  {col}: {processed[col].iloc[0]}")

    print(f"\nExpected feature count: {len(fe.get_feature_columns())}")
    print(f"Available features: {len([c for c in fe.get_feature_columns() if c in processed.columns])}")
