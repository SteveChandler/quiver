# ml/tests/test_model_guardrails.py
"""Tests for ML model guardrails, especially large swell scaling."""
import pytest
import numpy as np
import pandas as pd
from unittest.mock import MagicMock, patch


class TestLargeSwellScaling:
    """Test the v2.1 large swell scaling guardrail."""

    @pytest.fixture
    def mock_model(self):
        """Create a model with mocked XGBoost that returns constant bias."""
        from model import QuiverBiasModel

        model = QuiverBiasModel()
        # Mock the internal XGBoost model to return a constant bias of 0.5m
        mock_xgb = MagicMock()
        mock_xgb.predict = MagicMock(return_value=np.array([0.5]))
        model.model = mock_xgb
        return model

    def test_small_waves_full_correction(self, mock_model):
        """Waves <1.5m should get 100% of predicted correction."""
        X = pd.DataFrame({"dummy_feature": [1.0]})
        physics_forecast = pd.Series([1.0])  # 1m wave

        # Mock returns 0.5m bias, should apply 100%
        mock_model.model.predict.return_value = np.array([0.5])
        result = mock_model.predict(X, physics_forecast)

        # With 0.5m bias applied fully: 1.0 + 0.5 = 1.5m
        assert result.iloc[0] == pytest.approx(1.5, rel=0.01)

    def test_medium_waves_partial_correction(self, mock_model):
        """Waves at 2.0m (midpoint) should get ~50% of predicted correction."""
        X = pd.DataFrame({"dummy_feature": [1.0]})
        physics_forecast = pd.Series([2.0])  # 2m wave (midpoint of taper)

        # Mock returns 0.5m bias
        mock_model.model.predict.return_value = np.array([0.5])
        result = mock_model.predict(X, physics_forecast)

        # At 2.0m: scale_factor = (2.5 - 2.0) / (2.5 - 1.5) = 0.5 / 1.0 = 0.5
        # Scaled bias = 0.5 * 0.5 = 0.25m
        # Result = 2.0 + 0.25 = 2.25m
        assert result.iloc[0] == pytest.approx(2.25, rel=0.01)

    def test_large_waves_no_correction(self, mock_model):
        """Waves >2.5m should get 0% correction (use raw forecast)."""
        X = pd.DataFrame({"dummy_feature": [1.0]})
        physics_forecast = pd.Series([3.0])  # 3m wave

        # Mock returns 0.5m bias, but should be scaled to 0
        mock_model.model.predict.return_value = np.array([0.5])
        result = mock_model.predict(X, physics_forecast)

        # At 3.0m: scale_factor = max(0, (2.5 - 3.0) / 1.0) = 0
        # Scaled bias = 0.5 * 0 = 0m
        # Result = 3.0 + 0 = 3.0m
        assert result.iloc[0] == pytest.approx(3.0, rel=0.01)

    def test_taper_boundary_start(self, mock_model):
        """Waves at exactly 1.5m (taper start) should get 100% correction."""
        X = pd.DataFrame({"dummy_feature": [1.0]})
        physics_forecast = pd.Series([1.5])

        mock_model.model.predict.return_value = np.array([0.3])
        result = mock_model.predict(X, physics_forecast)

        # At 1.5m: scale_factor = (2.5 - 1.5) / 1.0 = 1.0
        # Result = 1.5 + 0.3 = 1.8m
        assert result.iloc[0] == pytest.approx(1.8, rel=0.01)

    def test_taper_boundary_end(self, mock_model):
        """Waves at exactly 2.5m (taper end) should get 0% correction."""
        X = pd.DataFrame({"dummy_feature": [1.0]})
        physics_forecast = pd.Series([2.5])

        mock_model.model.predict.return_value = np.array([0.5])
        result = mock_model.predict(X, physics_forecast)

        # At 2.5m: scale_factor = (2.5 - 2.5) / 1.0 = 0
        # Result = 2.5 + 0 = 2.5m
        assert result.iloc[0] == pytest.approx(2.5, rel=0.01)

    def test_negative_bias_also_scaled(self, mock_model):
        """Negative corrections should also be scaled for large waves."""
        X = pd.DataFrame({"dummy_feature": [1.0]})
        physics_forecast = pd.Series([3.0])  # Large wave

        # Model predicts negative bias (forecast too high)
        mock_model.model.predict.return_value = np.array([-0.5])
        result = mock_model.predict(X, physics_forecast)

        # At 3.0m: scale_factor = 0, so bias becomes 0
        # Result = 3.0 + 0 = 3.0m (raw forecast preserved)
        assert result.iloc[0] == pytest.approx(3.0, rel=0.01)

    def test_batch_mixed_wave_heights(self, mock_model):
        """Test batch prediction with mixed wave heights."""
        X = pd.DataFrame({"dummy_feature": [1.0, 1.0, 1.0, 1.0]})
        physics_forecast = pd.Series([1.0, 1.5, 2.0, 3.0])

        # All get same raw bias prediction
        mock_model.model.predict.return_value = np.array([0.4, 0.4, 0.4, 0.4])
        result = mock_model.predict(X, physics_forecast)

        # 1.0m: 100% -> 1.0 + 0.4 = 1.4m
        assert result.iloc[0] == pytest.approx(1.4, rel=0.01)
        # 1.5m: 100% -> 1.5 + 0.4 = 1.9m
        assert result.iloc[1] == pytest.approx(1.9, rel=0.01)
        # 2.0m: 50% -> 2.0 + 0.2 = 2.2m
        assert result.iloc[2] == pytest.approx(2.2, rel=0.01)
        # 3.0m: 0% -> 3.0 + 0 = 3.0m
        assert result.iloc[3] == pytest.approx(3.0, rel=0.01)


class TestExistingGuardrails:
    """Ensure existing guardrails still function correctly."""

    @pytest.fixture
    def mock_model(self):
        """Create a model with mocked XGBoost."""
        from model import QuiverBiasModel

        model = QuiverBiasModel()
        mock_xgb = MagicMock()
        model.model = mock_xgb
        return model

    def test_bias_clipped_to_50_percent(self, mock_model):
        """Bias should be clipped to +/- 50% of forecast (min 0.3m)."""
        X = pd.DataFrame({"dummy_feature": [1.0]})
        physics_forecast = pd.Series([1.0])  # Small wave, full correction applies

        # Model predicts huge bias that would exceed 50%
        mock_model.model.predict.return_value = np.array([2.0])
        result = mock_model.predict(X, physics_forecast)

        # Max bias for 1.0m wave = max(1.0 * 0.5, 0.3) = 0.5m
        # Result = 1.0 + 0.5 = 1.5m
        assert result.iloc[0] == pytest.approx(1.5, rel=0.01)

    def test_absolute_bias_cap(self, mock_model):
        """Bias should be capped at +/- 1.5m absolute."""
        X = pd.DataFrame({"dummy_feature": [1.0]})
        physics_forecast = pd.Series([1.0])

        # Model predicts huge bias
        mock_model.model.predict.return_value = np.array([5.0])
        result = mock_model.predict(X, physics_forecast)

        # First clipped to 50% of 1.0m = 0.5m, which is less than 1.5m cap
        # Result = 1.0 + 0.5 = 1.5m
        assert result.iloc[0] == pytest.approx(1.5, rel=0.01)

    def test_small_corrections_ignored(self, mock_model):
        """Corrections smaller than 0.03m should be ignored."""
        X = pd.DataFrame({"dummy_feature": [1.0]})
        physics_forecast = pd.Series([1.0])

        # Model predicts tiny bias
        mock_model.model.predict.return_value = np.array([0.02])
        result = mock_model.predict(X, physics_forecast)

        # 0.02m < 0.03m threshold, so correction is zeroed
        # Result = 1.0 + 0 = 1.0m
        assert result.iloc[0] == pytest.approx(1.0, rel=0.01)

    def test_physical_bounds(self, mock_model):
        """Final result should be clamped to [0.01, 15.0]m."""
        X = pd.DataFrame({"dummy_feature": [1.0]})
        physics_forecast = pd.Series([0.1])

        # Model predicts large negative bias
        mock_model.model.predict.return_value = np.array([-0.5])
        result = mock_model.predict(X, physics_forecast)

        # 0.1 - 0.5 = -0.4, but clamped to 0.01
        # Actually bias is clipped to max(0.1 * 0.5, 0.3) = 0.3m
        # So -0.5 -> -0.3, result = 0.1 - 0.3 = -0.2 -> clamped to 0.01
        assert result.iloc[0] >= 0.01


class TestGuardrailInteractions:
    """Test interactions between multiple guardrails."""

    @pytest.fixture
    def mock_model(self):
        """Create a model with mocked XGBoost."""
        from model import QuiverBiasModel

        model = QuiverBiasModel()
        mock_xgb = MagicMock()
        model.model = mock_xgb
        return model

    def test_scaling_then_clipping_interaction(self, mock_model):
        """Test that scaling happens before clipping.

        For a 2.0m wave with 0.6m raw bias:
        1. Scaling: 0.6 * 0.5 = 0.3m (50% at midpoint)
        2. Clipping: max(2.0 * 0.5, 0.3) = 1.0m cap, 0.3m passes through
        Result: 2.0 + 0.3 = 2.3m
        """
        X = pd.DataFrame({"dummy_feature": [1.0]})
        physics_forecast = pd.Series([2.0])  # Midpoint of taper

        # Raw bias of 0.6m
        mock_model.model.predict.return_value = np.array([0.6])
        result = mock_model.predict(X, physics_forecast)

        # Scaling first: 0.6 * 0.5 = 0.3m
        # Clipping: 0.3m < 1.0m cap, passes through
        # Result: 2.0 + 0.3 = 2.3m
        assert result.iloc[0] == pytest.approx(2.3, rel=0.01)

    def test_large_bias_scaled_then_clipped(self, mock_model):
        """Test large bias that would exceed clip after scaling.

        For a 1.8m wave with 1.5m raw bias:
        1. Scaling: scale_factor = (2.5 - 1.8) / 1.0 = 0.7
           Scaled bias = 1.5 * 0.7 = 1.05m
        2. Clipping: max(1.8 * 0.5, 0.3) = 0.9m cap
           Clipped bias = 0.9m
        Result: 1.8 + 0.9 = 2.7m
        """
        X = pd.DataFrame({"dummy_feature": [1.0]})
        physics_forecast = pd.Series([1.8])

        mock_model.model.predict.return_value = np.array([1.5])
        result = mock_model.predict(X, physics_forecast)

        # Scaling: 1.5 * 0.7 = 1.05m
        # Clipping: min(1.05, 0.9) = 0.9m
        # Result: 1.8 + 0.9 = 2.7m
        assert result.iloc[0] == pytest.approx(2.7, rel=0.01)

    def test_scaling_reduces_bias_below_noise_threshold(self, mock_model):
        """Test that scaled bias below 0.03m is zeroed.

        For a 2.4m wave with 0.1m raw bias:
        1. Scaling: scale_factor = (2.5 - 2.4) / 1.0 = 0.1
           Scaled bias = 0.1 * 0.1 = 0.01m
        2. Noise threshold: 0.01m < 0.03m, zeroed
        Result: 2.4 + 0 = 2.4m
        """
        X = pd.DataFrame({"dummy_feature": [1.0]})
        physics_forecast = pd.Series([2.4])

        mock_model.model.predict.return_value = np.array([0.1])
        result = mock_model.predict(X, physics_forecast)

        # Scaling: 0.1 * 0.1 = 0.01m
        # Below 0.03m threshold, zeroed
        # Result: 2.4m (unchanged)
        assert result.iloc[0] == pytest.approx(2.4, rel=0.01)
