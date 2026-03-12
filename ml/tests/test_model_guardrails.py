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
        """Waves at 2.75m (midpoint of 1.5-4.0 taper) should get ~50% of predicted correction."""
        X = pd.DataFrame({"dummy_feature": [1.0]})
        physics_forecast = pd.Series([2.75])  # Midpoint of 1.5-4.0 taper

        # Mock returns 0.5m bias
        mock_model.model.predict.return_value = np.array([0.5])
        result = mock_model.predict(X, physics_forecast)

        # At 2.75m: scale_factor = (4.0 - 2.75) / (4.0 - 1.5) = 1.25 / 2.5 = 0.5
        # Scaled bias = 0.5 * 0.5 = 0.25m
        # Result = 2.75 + 0.25 = 3.0m
        assert result.iloc[0] == pytest.approx(3.0, rel=0.01)

    def test_large_waves_no_correction(self, mock_model):
        """Waves >4.0m should get 0% correction (use raw forecast)."""
        X = pd.DataFrame({"dummy_feature": [1.0]})
        physics_forecast = pd.Series([5.0])  # 5m wave, above taper end

        # Mock returns 0.5m bias, but should be scaled to 0
        mock_model.model.predict.return_value = np.array([0.5])
        result = mock_model.predict(X, physics_forecast)

        # At 5.0m: scale_factor = max(0, (4.0 - 5.0) / 2.5) = 0
        # Scaled bias = 0.5 * 0 = 0m
        # Result = 5.0 + 0 = 5.0m
        assert result.iloc[0] == pytest.approx(5.0, rel=0.01)

    def test_taper_boundary_start(self, mock_model):
        """Waves at exactly 1.5m (taper start) should get 100% correction."""
        X = pd.DataFrame({"dummy_feature": [1.0]})
        physics_forecast = pd.Series([1.5])

        mock_model.model.predict.return_value = np.array([0.3])
        result = mock_model.predict(X, physics_forecast)

        # At 1.5m: scale_factor = (4.0 - 1.5) / 2.5 = 1.0
        # Result = 1.5 + 0.3 = 1.8m
        assert result.iloc[0] == pytest.approx(1.8, rel=0.01)

    def test_taper_boundary_end(self, mock_model):
        """Waves at exactly 4.0m (taper end) should get 0% correction."""
        X = pd.DataFrame({"dummy_feature": [1.0]})
        physics_forecast = pd.Series([4.0])

        mock_model.model.predict.return_value = np.array([0.5])
        result = mock_model.predict(X, physics_forecast)

        # At 4.0m: scale_factor = (4.0 - 4.0) / 2.5 = 0
        # Result = 4.0 + 0 = 4.0m
        assert result.iloc[0] == pytest.approx(4.0, rel=0.01)

    def test_negative_bias_also_scaled(self, mock_model):
        """Negative corrections should also be scaled for large waves."""
        X = pd.DataFrame({"dummy_feature": [1.0]})
        physics_forecast = pd.Series([5.0])  # Large wave, above taper end

        # Model predicts negative bias (forecast too high)
        mock_model.model.predict.return_value = np.array([-0.5])
        result = mock_model.predict(X, physics_forecast)

        # At 5.0m: scale_factor = 0, so bias becomes 0
        # Result = 5.0 + 0 = 5.0m (raw forecast preserved)
        assert result.iloc[0] == pytest.approx(5.0, rel=0.01)

    def test_batch_mixed_wave_heights(self, mock_model):
        """Test batch prediction with mixed wave heights across taper range (1.5-4.0m)."""
        X = pd.DataFrame({"dummy_feature": [1.0, 1.0, 1.0, 1.0]})
        physics_forecast = pd.Series([1.0, 1.5, 2.75, 5.0])

        # All get same raw bias prediction
        mock_model.model.predict.return_value = np.array([0.4, 0.4, 0.4, 0.4])
        result = mock_model.predict(X, physics_forecast)

        # 1.0m: below taper start, 100% -> 1.0 + 0.4 = 1.4m
        assert result.iloc[0] == pytest.approx(1.4, rel=0.01)
        # 1.5m: at taper start, 100% -> 1.5 + 0.4 = 1.9m
        assert result.iloc[1] == pytest.approx(1.9, rel=0.01)
        # 2.75m: midpoint, scale=(4.0-2.75)/2.5=0.5 -> 2.75 + 0.4*0.5 = 2.95m
        assert result.iloc[2] == pytest.approx(2.95, rel=0.01)
        # 5.0m: above taper end, 0% -> 5.0 + 0 = 5.0m
        assert result.iloc[3] == pytest.approx(5.0, rel=0.01)


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

    def test_bias_clipped_to_75_percent(self, mock_model):
        """Bias should be clipped to +/- 75% of forecast (min 0.2m floor)."""
        X = pd.DataFrame({"dummy_feature": [1.0]})
        physics_forecast = pd.Series([1.0])  # Small wave, full correction applies

        # Model predicts huge bias that would exceed 75%
        mock_model.model.predict.return_value = np.array([2.0])
        result = mock_model.predict(X, physics_forecast)

        # Max bias for 1.0m wave = max(1.0 * 0.75, 0.2) = 0.75m
        # Result = 1.0 + 0.75 = 1.75m
        assert result.iloc[0] == pytest.approx(1.75, rel=0.01)

    def test_absolute_bias_cap(self, mock_model):
        """Bias should be capped at +/- 1.5m absolute."""
        X = pd.DataFrame({"dummy_feature": [1.0]})
        physics_forecast = pd.Series([1.0])

        # Model predicts huge bias
        mock_model.model.predict.return_value = np.array([5.0])
        result = mock_model.predict(X, physics_forecast)

        # First clipped to 75% of 1.0m = 0.75m, which is less than 1.5m cap
        # Result = 1.0 + 0.75 = 1.75m
        assert result.iloc[0] == pytest.approx(1.75, rel=0.01)

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

        # Bias clipped to max(0.1 * 0.75, 0.2) = 0.2m -> -0.2
        # Small-wave cap (0.1 < 0.5m): clipped to [-0.1, 0.1] -> -0.1
        # Result = 0.1 - 0.1 = 0.0 -> clamped to 0.01
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
        1. Scaling: scale_factor = (4.0 - 2.0) / 2.5 = 0.8
           Scaled bias = 0.6 * 0.8 = 0.48m
        2. Clipping: max(2.0 * 0.75, 0.2) = 1.5m cap, 0.48m passes through
        Result: 2.0 + 0.48 = 2.48m
        """
        X = pd.DataFrame({"dummy_feature": [1.0]})
        physics_forecast = pd.Series([2.0])

        # Raw bias of 0.6m
        mock_model.model.predict.return_value = np.array([0.6])
        result = mock_model.predict(X, physics_forecast)

        # Scaling first: 0.6 * 0.8 = 0.48m
        # Clipping: 0.48m < 1.5m cap, passes through
        # Result: 2.0 + 0.48 = 2.48m
        assert result.iloc[0] == pytest.approx(2.48, rel=0.01)

    def test_large_bias_scaled_then_clipped(self, mock_model):
        """Test large bias that gets scaled and then clipped.

        For a 1.8m wave with 1.5m raw bias:
        1. Scaling: scale_factor = (4.0 - 1.8) / 2.5 = 0.88
           Scaled bias = 1.5 * 0.88 = 1.32m
        2. Clipping: max(1.8 * 0.75, 0.2) = 1.35m cap, 1.32m passes
        3. Absolute cap: 1.32m < 1.5m, passes
        Result: 1.8 + 1.32 = 3.12m
        """
        X = pd.DataFrame({"dummy_feature": [1.0]})
        physics_forecast = pd.Series([1.8])

        mock_model.model.predict.return_value = np.array([1.5])
        result = mock_model.predict(X, physics_forecast)

        # Scaling: 1.5 * 0.88 = 1.32m
        # Clipping: 1.32m < 1.35m cap, passes through
        # Result: 1.8 + 1.32 = 3.12m
        assert result.iloc[0] == pytest.approx(3.12, rel=0.01)

    def test_scaling_reduces_bias_below_noise_threshold(self, mock_model):
        """Test that scaled bias below 0.03m is zeroed.

        For a 3.9m wave with 0.1m raw bias:
        1. Scaling: scale_factor = (4.0 - 3.9) / 2.5 = 0.04
           Scaled bias = 0.1 * 0.04 = 0.004m
        2. Noise threshold: 0.004m < 0.03m, zeroed
        Result: 3.9 + 0 = 3.9m
        """
        X = pd.DataFrame({"dummy_feature": [1.0]})
        physics_forecast = pd.Series([3.9])

        mock_model.model.predict.return_value = np.array([0.1])
        result = mock_model.predict(X, physics_forecast)

        # Scaling: 0.1 * 0.04 = 0.004m
        # Below 0.03m threshold, zeroed
        # Result: 3.9m (unchanged)
        assert result.iloc[0] == pytest.approx(3.9, rel=0.01)


class TestSmallWaveTaper:
    """Test the v3.2 small-wave taper guardrail that reduces corrections for small forecasts."""

    @pytest.fixture
    def mock_model(self):
        """Create a model with mocked XGBoost that returns constant bias."""
        from model import QuiverBiasModel

        model = QuiverBiasModel()
        mock_xgb = MagicMock()
        model.model = mock_xgb
        return model

    def test_small_wave_taper_midpoint(self, mock_model):
        """0.55m forecast (midpoint of 0.3-0.8 taper) gets ~50% correction.

        scale = (0.55 - 0.3) / (0.8 - 0.3) = 0.25 / 0.5 = 0.5
        bias = 0.4 * 0.5 = 0.2m -> result = 0.55 + 0.2 = 0.75m
        """
        X = pd.DataFrame({"dummy_feature": [1.0]})
        physics_forecast = pd.Series([0.55])

        mock_model.model.predict.return_value = np.array([0.4])
        result = mock_model.predict(X, physics_forecast)

        # 0.55m is above 0.5m so small-wave proportional cap doesn't apply
        # small_wave_scale = 0.5, bias = 0.4 * 0.5 = 0.2m
        # 75% clip: max(0.55*0.75, 0.2) = 0.4125m, 0.2 passes
        assert result.iloc[0] == pytest.approx(0.75, abs=0.02)

    def test_small_wave_taper_below_start(self, mock_model):
        """0.2m forecast (below 0.3m start) gets 0% correction.

        scale = max(0, (0.2 - 0.3) / 0.5) = 0
        bias = 0.4 * 0 = 0m -> result = 0.2m (raw forecast)
        """
        X = pd.DataFrame({"dummy_feature": [1.0]})
        physics_forecast = pd.Series([0.2])

        mock_model.model.predict.return_value = np.array([0.4])
        result = mock_model.predict(X, physics_forecast)

        assert result.iloc[0] == pytest.approx(0.2, abs=0.01)

    def test_small_wave_taper_above_end(self, mock_model):
        """1.0m forecast (above 0.8m end) gets 100% correction — no taper effect.

        scale = min(1, (1.0 - 0.3) / 0.5) = 1.0
        bias = 0.4 * 1.0 = 0.4m -> result = 1.0 + 0.4 = 1.4m
        """
        X = pd.DataFrame({"dummy_feature": [1.0]})
        physics_forecast = pd.Series([1.0])

        mock_model.model.predict.return_value = np.array([0.4])
        result = mock_model.predict(X, physics_forecast)

        assert result.iloc[0] == pytest.approx(1.4, rel=0.01)

    def test_small_wave_taper_boundary_start(self, mock_model):
        """0.3m forecast (exactly at taper start) gets 0% correction.

        scale = (0.3 - 0.3) / 0.5 = 0
        """
        X = pd.DataFrame({"dummy_feature": [1.0]})
        physics_forecast = pd.Series([0.3])

        mock_model.model.predict.return_value = np.array([0.4])
        result = mock_model.predict(X, physics_forecast)

        assert result.iloc[0] == pytest.approx(0.3, abs=0.01)

    def test_small_wave_taper_boundary_end(self, mock_model):
        """0.8m forecast (exactly at taper end) gets 100% correction.

        scale = (0.8 - 0.3) / 0.5 = 1.0
        bias = 0.4 * 1.0 = 0.4m -> result = 0.8 + 0.4 = 1.2m
        """
        X = pd.DataFrame({"dummy_feature": [1.0]})
        physics_forecast = pd.Series([0.8])

        mock_model.model.predict.return_value = np.array([0.4])
        result = mock_model.predict(X, physics_forecast)

        assert result.iloc[0] == pytest.approx(1.2, rel=0.01)

    def test_combined_tapers_batch(self, mock_model):
        """Mixed wave heights with both small-wave and large-swell tapers applied."""
        X = pd.DataFrame({"dummy_feature": [1.0, 1.0, 1.0, 1.0, 1.0]})
        physics_forecast = pd.Series([0.2, 0.55, 1.0, 2.75, 5.0])

        mock_model.model.predict.return_value = np.array([0.4, 0.4, 0.4, 0.4, 0.4])
        result = mock_model.predict(X, physics_forecast)

        # 0.2m: below small taper start -> 0% correction -> 0.2m
        assert result.iloc[0] == pytest.approx(0.2, abs=0.01)
        # 0.55m: small taper scale=0.5 -> bias=0.2m -> 0.75m
        assert result.iloc[1] == pytest.approx(0.75, abs=0.02)
        # 1.0m: above small taper, below large taper -> 100% -> 1.0+0.4=1.4m
        assert result.iloc[2] == pytest.approx(1.4, rel=0.01)
        # 2.75m: large taper scale=0.5 -> bias=0.2m -> 2.75+0.2=2.95m
        assert result.iloc[3] == pytest.approx(2.95, rel=0.01)
        # 5.0m: above large taper -> 0% correction -> 5.0m
        assert result.iloc[4] == pytest.approx(5.0, rel=0.01)


class TestSmallWaveProportionalCap:
    """Test the small-wave safety cap that prevents more than doubling sub-0.5m forecasts."""

    @pytest.fixture
    def mock_model(self):
        """Create a model with mocked XGBoost."""
        from model import QuiverBiasModel

        model = QuiverBiasModel()
        mock_xgb = MagicMock()
        model.model = mock_xgb
        return model

    def test_small_wave_cap_limits_positive_bias(self, mock_model):
        """A 0.45m forecast with 0.5m raw bias gets tapered then capped.

        Small-wave taper: scale = (0.45 - 0.3) / 0.5 = 0.3
        Tapered bias = 0.5 * 0.3 = 0.15m
        75% clip: max(0.45 * 0.75, 0.2) = 0.3375m -> 0.15 passes
        Small-wave cap (0.45 < 0.5m): clips to [-0.45, 0.45] -> 0.15 passes
        Result = 0.45 + 0.15 = 0.6m
        """
        X = pd.DataFrame({"dummy_feature": [1.0]})
        physics_forecast = pd.Series([0.45])

        mock_model.model.predict.return_value = np.array([0.5])
        result = mock_model.predict(X, physics_forecast)

        assert result.iloc[0] == pytest.approx(0.6, abs=0.02)

    def test_small_wave_cap_limits_negative_bias(self, mock_model):
        """A 0.45m forecast with -0.5m raw bias gets tapered then capped.

        Small-wave taper: scale = (0.45 - 0.3) / 0.5 = 0.3
        Tapered bias = -0.5 * 0.3 = -0.15m
        75% clip: max(0.45 * 0.75, 0.2) = 0.3375m -> -0.15 passes
        Small-wave cap (0.45 < 0.5m): clips to [-0.45, 0.45] -> -0.15 passes
        Result = 0.45 - 0.15 = 0.3m
        """
        X = pd.DataFrame({"dummy_feature": [1.0]})
        physics_forecast = pd.Series([0.45])

        mock_model.model.predict.return_value = np.array([-0.5])
        result = mock_model.predict(X, physics_forecast)

        assert result.iloc[0] == pytest.approx(0.3, abs=0.02)

    def test_small_wave_cap_not_applied_above_threshold(self, mock_model):
        """A 0.6m forecast is above the small-wave proportional cap threshold (0.5m)
        but still within the small-wave taper zone (0.3-0.8m).

        Small-wave taper: scale = (0.6 - 0.3) / 0.5 = 0.6
        Tapered bias = 0.5 * 0.6 = 0.3m
        75% clip: max(0.6 * 0.75, 0.2) = 0.45m -> 0.3 passes
        No small-wave cap (0.6 >= 0.5m)
        Result = 0.6 + 0.3 = 0.9m
        """
        X = pd.DataFrame({"dummy_feature": [1.0]})
        physics_forecast = pd.Series([0.6])

        mock_model.model.predict.return_value = np.array([0.5])
        result = mock_model.predict(X, physics_forecast)

        assert result.iloc[0] == pytest.approx(0.9, abs=0.02)

    def test_small_wave_cap_with_very_small_forecast(self, mock_model):
        """A 0.1m forecast (below taper start) gets 0% correction.

        Small-wave taper: scale = max(0, (0.1 - 0.3) / 0.5) = 0
        Tapered bias = 0.3 * 0 = 0m
        Result = 0.1m (raw forecast preserved)
        """
        X = pd.DataFrame({"dummy_feature": [1.0]})
        physics_forecast = pd.Series([0.1])

        mock_model.model.predict.return_value = np.array([0.3])
        result = mock_model.predict(X, physics_forecast)

        assert result.iloc[0] == pytest.approx(0.1, abs=0.01)
