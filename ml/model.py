import xgboost as xgb
import pandas as pd
import numpy as np
from sklearn.model_selection import TimeSeriesSplit
from sklearn.metrics import mean_squared_error
import joblib
import os
from typing import Dict, Any, Optional, Tuple

class QuiverBiasModel:
    """
    ML Bias Layer for Quiver Wave Forecasting.
    Predicts the residual error (Observed - Model) to correct physics-based forecasts.
    """
    def __init__(self, params: Optional[Dict[str, Any]] = None):
        self.model = None
        # Default XGBoost parameters for regression
        self.params = params or {
            'objective': 'reg:squarederror',
            'n_estimators': 100,
            'learning_rate': 0.1,
            'max_depth': 5,
            'subsample': 0.8,
            'colsample_bytree': 0.8,
            'n_jobs': -1
        }
        
    def train(self, X: pd.DataFrame, y: pd.Series, n_splits: int = 5) -> Dict[str, float]:
        """
        Trains the XGBoost model using TimeSeriesSplit cross-validation.
        
        Args:
            X: Feature DataFrame (result of FeatureEngineer.preprocess)
            y: Target Series (Observed - Generated) - The Residual
            n_splits: Number of time-series splits for validation
            
        Returns:
            Dictionary of metrics (RMSE)
        """
        tscv = TimeSeriesSplit(n_splits=n_splits)
        
        fold_scores = []
        
        # We only really need to train the final model on all data, 
        # but CV helps us estimate performance and prevent overfitting during dev.
        print(f"Starting TimeSeries Cross-Validation with {n_splits} splits...")
        
        for fold, (train_index, val_index) in enumerate(tscv.split(X)):
            X_train, X_val = X.iloc[train_index], X.iloc[val_index]
            y_train, y_val = y.iloc[train_index], y.iloc[val_index]
            
            # Simple XGBRegressor
            reg = xgb.XGBRegressor(**self.params)
            reg.fit(X_train, y_train, eval_set=[(X_val, y_val)], verbose=False)
            
            preds = reg.predict(X_val)
            rmse = np.sqrt(mean_squared_error(y_val, preds))
            fold_scores.append(rmse)
            print(f"Fold {fold+1} RMSE: {rmse:.4f} meters")
            
        # Refit on ALL data for the final production model
        print("Training final model on full dataset...")
        self.model = xgb.XGBRegressor(**self.params)
        self.model.fit(X, y, verbose=False)
        
        return {
            "mean_cv_rmse": float(np.mean(fold_scores)),
            "std_cv_rmse": float(np.std(fold_scores))
        }

    def predict(self, X: pd.DataFrame, physics_forecast: pd.Series) -> pd.Series:
        """
        Predicts the corrected wave height.

        Args:
            X: Features for the forecast time points
            physics_forecast: The raw physics model output (Hs model)

        Returns:
            Corrected Forecast (Hs model + Predicted Bias)
        """
        if self.model is None:
            raise ValueError("Model has not been trained yet.")

        # Predict the residual (bias)
        predicted_bias = pd.Series(self.model.predict(X), index=physics_forecast.index)

        # --- v2 Guardrails ---
        # 1. Clip bias to +/- 50% of raw forecast (min 0.3m floor for small waves)
        max_bias = np.maximum(physics_forecast.abs() * 0.5, 0.3)
        predicted_bias = predicted_bias.clip(lower=-max_bias, upper=max_bias)

        # 2. Absolute bias cap at +/- 1.5m
        predicted_bias = predicted_bias.clip(lower=-1.5, upper=1.5)

        # 3. No-correction zone: skip corrections smaller than 0.03m
        predicted_bias = predicted_bias.where(predicted_bias.abs() >= 0.03, 0.0)

        # Apply correction: Final = Model + Bias
        corrected_forecast = physics_forecast + predicted_bias

        # 4. Physical bounds: wave height in [0.01, 15.0]m
        corrected_forecast = corrected_forecast.clip(lower=0.01, upper=15.0)

        return corrected_forecast

    def save(self, filepath: str):
        """Saves the model to a JSON file (lightweight, portable)."""
        if self.model is None:
            raise ValueError("No model to save.")
        
        # Ensure directory exists
        dir_name = os.path.dirname(filepath)
        if dir_name:
            os.makedirs(dir_name, exist_ok=True)
        self.model.save_model(filepath)
        print(f"Model saved to {filepath}")

    def load(self, filepath: str):
        """Loads the model from a JSON file."""
        self.model = xgb.XGBRegressor()
        self.model.load_model(filepath)
        print(f"Model loaded from {filepath}")
