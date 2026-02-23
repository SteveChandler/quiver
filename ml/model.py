import xgboost as xgb
import pandas as pd
import numpy as np
from sklearn.model_selection import TimeSeriesSplit
from sklearn.metrics import mean_squared_error
import joblib
import os
import logging
from typing import Dict, Any, Optional, Tuple

from config import LARGE_SWELL_TAPER_START, LARGE_SWELL_TAPER_END

logger = logging.getLogger(__name__)

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
            'n_jobs': -1,
            'enable_categorical': True,
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
        logger.info(f"Starting TimeSeries Cross-Validation with {n_splits} splits...")
        
        for fold, (train_index, val_index) in enumerate(tscv.split(X)):
            X_train, X_val = X.iloc[train_index], X.iloc[val_index]
            y_train, y_val = y.iloc[train_index], y.iloc[val_index]
            
            # Simple XGBRegressor
            reg = xgb.XGBRegressor(**self.params)
            reg.fit(X_train, y_train, eval_set=[(X_val, y_val)], verbose=False)
            
            preds = reg.predict(X_val)
            rmse = np.sqrt(mean_squared_error(y_val, preds))
            fold_scores.append(rmse)
            logger.info(f"Fold {fold+1} RMSE: {rmse:.4f} meters")
            
        # Refit on ALL data for the final production model
        logger.info("Training final model on full dataset...")
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

        # Auto-select features to match what this model was trained on.
        # This allows the same predict() call to work with both old (13-feature)
        # and new (14-feature with beach_id_cat) models.
        try:
            model_features = self.model.get_booster().feature_names
            if model_features and list(X.columns) != model_features:
                available = set(X.columns)
                expected = set(model_features)
                missing = expected - available
                if missing:
                    logger.warning(f"Missing features for model prediction: {missing}")
                X = X[[f for f in model_features if f in available]]
        except Exception:
            pass  # Use X as-is if feature name detection fails

        # Predict the residual (bias)
        predicted_bias = pd.Series(self.model.predict(X), index=physics_forecast.index)

        # --- v2.1 Guardrails ---

        # 0. Large swell scaling: taper corrections for waves outside training distribution
        # The model was trained primarily on small waves during a flat spell, making it
        # less reliable for large swells. We apply a linear taper:
        #   - Below TAPER_START (1.5m default): 100% of predicted correction applied
        #   - Between TAPER_START and TAPER_END: linear interpolation
        #   - Above TAPER_END (2.5m default): 0% correction (use raw physics forecast)
        # Thresholds are configurable via LARGE_SWELL_TAPER_START/END env vars.
        scale_factor = np.clip(
            (LARGE_SWELL_TAPER_END - physics_forecast) / (LARGE_SWELL_TAPER_END - LARGE_SWELL_TAPER_START),
            0.0,  # No correction for very large swells
            1.0   # Full correction for small swells
        )
        predicted_bias = predicted_bias * scale_factor

        # 1. Clip bias to +/- 75% of raw forecast (min 0.2m floor for small waves)
        max_bias = np.maximum(physics_forecast.abs() * 0.75, 0.2)
        predicted_bias = predicted_bias.clip(lower=-max_bias, upper=max_bias)

        # Small-wave safety: don't more than double sub-0.5m forecasts
        small_mask = physics_forecast.abs() < 0.5
        if small_mask.any():
            small_cap = physics_forecast.abs()
            predicted_bias = predicted_bias.where(
                ~small_mask,
                predicted_bias.clip(lower=-small_cap, upper=small_cap)
            )

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
        logger.info(f"Model saved to {filepath}")

    def load(self, filepath: str):
        """Loads the model from a JSON file or HTTP URL."""
        import tempfile
        import urllib.request

        self.model = xgb.XGBRegressor(enable_categorical=True)

        # Handle HTTP/HTTPS URLs by downloading to temp file first
        if filepath.startswith('http://') or filepath.startswith('https://'):
            logger.info(f"Downloading model from URL: {filepath}")
            with tempfile.NamedTemporaryFile(suffix='.json', delete=False) as tmp:
                tmp_path = tmp.name
            try:
                urllib.request.urlretrieve(filepath, tmp_path)
                self.model.load_model(tmp_path)
                logger.info(f"Model loaded from URL via temp file")
            finally:
                # Clean up temp file
                if os.path.exists(tmp_path):
                    os.remove(tmp_path)
        else:
            self.model.load_model(filepath)
            logger.info(f"Model loaded from {filepath}")
