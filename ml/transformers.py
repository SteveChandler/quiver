import numpy as np
import pandas as pd
from sklearn.base import BaseEstimator, TransformerMixin

class SineCosineTransformer(BaseEstimator, TransformerMixin):
    """
    Transforms a cyclical feature (like degrees 0-360) into two features:
    sin_feature = sin(2 * pi * feature / period)
    cos_feature = cos(2 * pi * feature / period)
    """
    def __init__(self, column_name: str, period: float = 360.0):
        self.column_name = column_name
        self.period = period

    def fit(self, X, y=None):
        return self

    def transform(self, X):
        # Create a copy to avoid SettingWithCopy warnings
        X_out = X.copy()
        
        if self.column_name not in X_out.columns:
            # If column missing, maybe warn or skip? For now, we assume it exists.
            return X_out

        # Calculate radians
        radians = X_out[self.column_name] * (2 * np.pi / self.period)
        
        X_out[f"{self.column_name}_sin"] = np.sin(radians)
        X_out[f"{self.column_name}_cos"] = np.cos(radians)
        
        # Drop the original raw column to avoid tree split confusion? 
        # Usually better to keep raw for interpretability unless it hurts performance.
        # But user specifically asked for transformation to Avoid numerical distance issues.
        # We'll drop the original raw column to force the model to use sin/cos.
        X_out = X_out.drop(columns=[self.column_name])
        
        return X_out

class FeatureEngineer:
    """
    Orchestrates all feature transformations for the Quiver ML Bias Layer.
    """
    def __init__(self):
        self.direction_transformer = SineCosineTransformer(column_name='wave_direction', period=360.0)
        # We can add more for wind_direction, etc.
        self.wind_dir_transformer = SineCosineTransformer(column_name='wind_direction', period=360.0)

    def preprocess(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Applies all feature engineering steps to the input DataFrame.
        """
        df_out = df.copy()

        # 1. Temporal Features
        if 'timestamp' in df_out.columns:
            # Ensure datetime
            df_out['timestamp'] = pd.to_datetime(df_out['timestamp'])
            df_out['hour'] = df_out['timestamp'].dt.hour
            df_out['month'] = df_out['timestamp'].dt.month
            # Drop timestamp as it's not a direct feature for trees (unless we use it for simpler things)
            # We keep it for splitting but maybe not for training features?
            # For now, let's keep it in the df but we'll likely exclude it from X later.

        # 2. Physics-based Interactions
        # "Period is the primary driver of how bathymetry affects wave height" -> Tp, Tp^2
        if 'wave_period' in df_out.columns:
            df_out['wave_period_sq'] = df_out['wave_period'] ** 2
        
        # "Wind Speed * Fetch" - assuming we might get fetch in the future, 
        # but for now let's just do Wind generic interactions if wind_speed exists.
        # (User mentioned Speed, Speed*Fetch)
        
        # 3. Cyclical Transformations
        # Apply to Wave Direction
        df_out = self.direction_transformer.transform(df_out)
        
        # Apply to Wind Direction if exists
        if 'wind_direction' in df_out.columns:
            df_out = self.wind_dir_transformer.transform(df_out)

        return df_out
