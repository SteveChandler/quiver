#!/usr/bin/env python3
"""Tests for terrain factor integration in transformers_v2.py"""

import pandas as pd
import numpy as np
import sys
from transformers_v2 import preprocess_v2, get_terrain_factor, V2_FEATURE_COLUMNS


def test_get_terrain_factor_basic():
    """Test basic terrain factor extraction."""
    # Create a 72-element array with known values
    factors = [0.1 + (i * 0.01) for i in range(72)]

    # Test North (0°) - should map to bin 0
    assert abs(get_terrain_factor(factors, 0.0) - 0.1) < 0.01

    # Test East (90°) - should map to bin 18 (90 / 5 = 18)
    assert abs(get_terrain_factor(factors, 90.0) - factors[18]) < 0.01

    # Test South (180°) - should map to bin 36
    assert abs(get_terrain_factor(factors, 180.0) - factors[36]) < 0.01

    # Test West (270°) - should map to bin 54
    assert abs(get_terrain_factor(factors, 270.0) - factors[54]) < 0.01

    print("✓ test_get_terrain_factor_basic passed")


def test_get_terrain_factor_edge_cases():
    """Test terrain factor edge cases."""
    # Test None array
    assert get_terrain_factor(None, 90.0) == 0.5

    # Test empty list
    assert get_terrain_factor([], 90.0) == 0.5

    # Test wrong length array
    assert get_terrain_factor([0.5] * 50, 90.0) == 0.5

    # Test wrapping (355° should be close to 0°)
    factors = [i / 72.0 for i in range(72)]
    # 355° -> bin 71 (355 + 2.5 = 357.5, 357.5 / 5 = 71.5, int = 71)
    assert abs(get_terrain_factor(factors, 355.0) - factors[71]) < 0.01

    print("✓ test_get_terrain_factor_edge_cases passed")


def test_preprocess_v2_with_terrain_factors():
    """Test v2 preprocessing with terrain factors."""
    # Create sample data with terrain factors
    swell_factors = [0.8] * 72  # High swell access everywhere
    wind_factors = [0.3] * 72   # Low wind exposure everywhere

    # Override specific bins for testing
    swell_factors[36] = 0.9  # High access from 180° (South)
    wind_factors[18] = 0.7   # Higher exposure from 90° (East)

    df = pd.DataFrame({
        'forecast_height_m': [1.5, 2.0],
        'forecast_period_s': [10.0, 12.0],
        'forecast_dir_deg': [180.0, 90.0],  # South and East
        'wind_speed_ms': [5.0, 8.0],
        'wind_dir_deg': [90.0, 270.0],  # East and West
        'wind_missing': [0, 0],
        'forecast_ts_utc': ['2024-01-01T12:00:00Z', '2024-01-01T13:00:00Z'],
        'swell_access_factors': [swell_factors, swell_factors],
        'wind_exposure_factors': [wind_factors, wind_factors],
    })

    result = preprocess_v2(df)

    # Check that we have all 13 features
    assert len(result.columns) == 13, f"Expected 13 features, got {len(result.columns)}"
    assert list(result.columns) == V2_FEATURE_COLUMNS

    # Check terrain factors are extracted correctly
    # First row: wave from 180° should get swell_factors[36] = 0.9
    assert abs(result.iloc[0]['swell_access_factor'] - 0.9) < 0.01

    # First row: wind from 90° should get wind_factors[18] = 0.7
    assert abs(result.iloc[0]['wind_exposure_factor'] - 0.7) < 0.01

    # Second row: wave from 90° should get swell_factors[18] = 0.8
    assert abs(result.iloc[1]['swell_access_factor'] - 0.8) < 0.01

    # Second row: wind from 270° should get wind_factors[54] = 0.3
    assert abs(result.iloc[1]['wind_exposure_factor'] - 0.3) < 0.01

    print("✓ test_preprocess_v2_with_terrain_factors passed")


def test_preprocess_v2_without_terrain_factors():
    """Test v2 preprocessing without terrain factors (backward compatibility)."""
    df = pd.DataFrame({
        'forecast_height_m': [1.5],
        'forecast_period_s': [10.0],
        'forecast_dir_deg': [180.0],
        'wind_speed_ms': [5.0],
        'wind_dir_deg': [90.0],
        'wind_missing': [0],
        'forecast_ts_utc': ['2024-01-01T12:00:00Z'],
        # No terrain factors
    })

    result = preprocess_v2(df)

    # Should still produce all 13 features
    assert len(result.columns) == 13

    # Default values should be 0.5
    assert result.iloc[0]['swell_access_factor'] == 0.5
    assert result.iloc[0]['wind_exposure_factor'] == 0.5

    print("✓ test_preprocess_v2_without_terrain_factors passed")


def test_preprocess_v2_partial_terrain_factors():
    """Test v2 preprocessing with only one terrain factor provided."""
    swell_factors = [0.6] * 72

    df = pd.DataFrame({
        'forecast_height_m': [1.5],
        'forecast_period_s': [10.0],
        'forecast_dir_deg': [180.0],
        'wind_speed_ms': [5.0],
        'wind_dir_deg': [90.0],
        'wind_missing': [0],
        'forecast_ts_utc': ['2024-01-01T12:00:00Z'],
        'swell_access_factors': [swell_factors],
        # No wind_exposure_factors
    })

    result = preprocess_v2(df)

    # Swell factor should be extracted
    assert abs(result.iloc[0]['swell_access_factor'] - 0.6) < 0.01

    # Wind factor should default to 0.5
    assert result.iloc[0]['wind_exposure_factor'] == 0.5

    print("✓ test_preprocess_v2_partial_terrain_factors passed")


def test_terrain_factor_bin_mapping():
    """Test that direction-to-bin mapping is correct."""
    # Create factors where each bin equals its index / 72
    factors = [i / 72.0 for i in range(72)]

    test_cases = [
        (0.0, 0),      # North -> bin 0
        (5.0, 1),      # 5° -> bin 1
        (90.0, 18),    # East -> bin 18
        (180.0, 36),   # South -> bin 36
        (270.0, 54),   # West -> bin 54
        (355.0, 71),   # Near North -> bin 71
        (2.5, 1),      # Edge case: 2.5° -> bin 1 (2.5 + 2.5 = 5.0, 5.0/5 = 1)
        (357.5, 0),    # Edge case: 357.5° -> bin 0 (357.5 + 2.5 = 360, 360%360=0, 0/5=0)
    ]

    for direction, expected_bin in test_cases:
        result = get_terrain_factor(factors, direction)
        expected = factors[expected_bin]
        assert abs(result - expected) < 0.01, \
            f"Direction {direction}° should map to bin {expected_bin} (value {expected}), got {result}"

    print("✓ test_terrain_factor_bin_mapping passed")


def test_feature_count_unchanged():
    """Verify that V2_FEATURE_COLUMNS has exactly 13 features."""
    assert len(V2_FEATURE_COLUMNS) == 13, \
        f"Expected 13 features in V2_FEATURE_COLUMNS, got {len(V2_FEATURE_COLUMNS)}"

    # Check that terrain factors are included
    assert 'swell_access_factor' in V2_FEATURE_COLUMNS
    assert 'wind_exposure_factor' in V2_FEATURE_COLUMNS

    print("✓ test_feature_count_unchanged passed")


def run_all_tests():
    """Run all tests."""
    print("\nRunning terrain factor integration tests...\n")

    try:
        test_get_terrain_factor_basic()
        test_get_terrain_factor_edge_cases()
        test_preprocess_v2_with_terrain_factors()
        test_preprocess_v2_without_terrain_factors()
        test_preprocess_v2_partial_terrain_factors()
        test_terrain_factor_bin_mapping()
        test_feature_count_unchanged()

        print("\n✅ All tests passed!\n")
        return 0
    except AssertionError as e:
        print(f"\n❌ Test failed: {e}\n")
        return 1
    except Exception as e:
        print(f"\n❌ Unexpected error: {e}\n")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == '__main__':
    sys.exit(run_all_tests())
