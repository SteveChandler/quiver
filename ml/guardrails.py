# ml/guardrails.py
"""Shared guardrail pipeline for ML bias correction.

All three entrypoints (model.py predict, train_v3.py holdout eval, api.py
holdout eval) apply the same sequence of safety constraints. This module
provides a single implementation to prevent the three copies drifting apart.

Guardrail sequence
------------------
1. Large-swell taper  — linearly reduce correction above LARGE_SWELL_TAPER_START
2. Small-wave taper   — linearly reduce correction below SMALL_WAVE_TAPER_END
3. Percentage clip    — clip to ±(max_bias_pct * |forecast|), floor bias_floor_m
4. Absolute cap       — hard ceiling at ±1.5 m
5. Small-wave cap     — prevent more than doubling sub-0.5 m forecasts
6. Noise threshold    — zero out corrections smaller than 0.03 m
7. Physical bounds    — clamp corrected height to [0.01, 15.0] m

All inputs and outputs are numpy arrays.  Callers that work with pandas
Series should convert before calling and wrap the output back afterwards.
"""
from __future__ import annotations

import numpy as np

from config import (
    LARGE_SWELL_TAPER_START,
    LARGE_SWELL_TAPER_END,
    SMALL_WAVE_TAPER_START,
    SMALL_WAVE_TAPER_END,
)

# Defaults that match the v3 model specification.
# api.py may override these via request.config fields.
DEFAULT_MAX_BIAS_PCT: float = 0.75
DEFAULT_BIAS_FLOOR_M: float = 0.2


def apply_guardrails(
    physics_forecast: np.ndarray,
    predicted_bias: np.ndarray,
    *,
    max_bias_pct: float = DEFAULT_MAX_BIAS_PCT,
    bias_floor_m: float = DEFAULT_BIAS_FLOOR_M,
) -> tuple[np.ndarray, np.ndarray]:
    """Apply the full guardrail pipeline and return the corrected forecast.

    Parameters
    ----------
    physics_forecast:
        Raw physics-model wave heights (metres), shape (N,).
    predicted_bias:
        Raw ML-predicted bias values (metres), shape (N,).
    max_bias_pct:
        Maximum allowable bias as a fraction of |physics_forecast|.
        Defaults to 0.75 (v3 specification).
    bias_floor_m:
        Minimum max-bias regardless of forecast magnitude (metres).
        Prevents the percentage clip from being too tight on small waves.
        Defaults to 0.2 m (v3 specification).

    Returns
    -------
    corrected_forecast:
        Physics forecast plus guardrailed bias, clamped to physical bounds.
    clipped_bias:
        The final bias actually applied (after all guardrails).  Callers
        that need to report the mean bias (train_v3, api.py) can use this
        directly instead of recomputing it from corrected − raw.
    """
    physics_forecast = np.asarray(physics_forecast, dtype=float)
    clipped_bias = np.asarray(predicted_bias, dtype=float).copy()

    # 1. Large-swell taper: linearly reduce corrections for waves that are
    #    above the training distribution.  Below TAPER_START: 100%; above
    #    TAPER_END: 0%.  Between: linear interpolation.
    large_swell_scale = np.clip(
        (LARGE_SWELL_TAPER_END - physics_forecast)
        / (LARGE_SWELL_TAPER_END - LARGE_SWELL_TAPER_START),
        0.0,
        1.0,
    )
    clipped_bias = clipped_bias * large_swell_scale

    # 2. Small-wave taper: mirror of the large-swell taper.  Prevents
    #    overcorrection on calm days where the model's learned upward bias
    #    dominates the raw forecast.  Below TAPER_START: 0%; above
    #    TAPER_END: 100%.
    small_wave_scale = np.clip(
        (physics_forecast - SMALL_WAVE_TAPER_START)
        / (SMALL_WAVE_TAPER_END - SMALL_WAVE_TAPER_START),
        0.0,
        1.0,
    )
    clipped_bias = clipped_bias * small_wave_scale

    # 3. Percentage clip: limit bias to ±(max_bias_pct × |forecast|),
    #    with a minimum floor so very small forecasts still get some room.
    max_bias = np.maximum(np.abs(physics_forecast) * max_bias_pct, bias_floor_m)
    clipped_bias = np.clip(clipped_bias, -max_bias, max_bias)

    # 4. Absolute cap: hard ceiling regardless of forecast magnitude.
    clipped_bias = np.clip(clipped_bias, -1.5, 1.5)

    # 5. Small-wave proportional cap: don't more than double sub-0.5 m
    #    forecasts.  Applied after the percentage clip so we don't undo
    #    guardrail 3 for forecasts near the 0.5 m boundary.
    small_mask = np.abs(physics_forecast) < 0.5
    if small_mask.any():
        small_cap = np.abs(physics_forecast)
        clipped_bias = np.where(
            small_mask,
            np.clip(clipped_bias, -small_cap, small_cap),
            clipped_bias,
        )

    # 6. Noise threshold: zero out corrections that are too small to matter.
    clipped_bias = np.where(np.abs(clipped_bias) >= 0.03, clipped_bias, 0.0)

    # 7. Physical bounds: wave height must be positive and within a
    #    realistic upper limit.
    corrected_forecast = np.clip(physics_forecast + clipped_bias, 0.01, 15.0)

    return corrected_forecast, clipped_bias
