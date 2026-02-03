#!/usr/bin/env python3
"""Verification script for terrain factor integration."""

import pandas as pd
import numpy as np
from transformers_v2 import preprocess_v2, V2_FEATURE_COLUMNS, get_terrain_factor


def verify_feature_count():
    """Verify that feature count is correct."""
    print("Verifying feature count...")
    assert len(V2_FEATURE_COLUMNS) == 13, \
        f"Expected 13 features, got {len(V2_FEATURE_COLUMNS)}"
    print(f"✓ Feature count: {len(V2_FEATURE_COLUMNS)}")

    required_features = ['swell_access_factor', 'wind_exposure_factor']
    for feature in required_features:
        assert feature in V2_FEATURE_COLUMNS, \
            f"Missing required feature: {feature}"
    print(f"✓ Terrain features present: {required_features}")


def verify_feature_engineering():
    """Verify feature engineering works end-to-end."""
    print("\nVerifying feature engineering...")

    # Create realistic test data
    swell_factors = [0.6] * 72
    wind_factors = [0.4] * 72

    # Set specific values for testing
    swell_factors[36] = 0.95  # High swell access from South (180°)
    wind_factors[0] = 0.2     # Low wind exposure from North (0°)

    test_data = pd.DataFrame({
        'forecast_height_m': [1.8],
        'forecast_period_s': [12.0],
        'forecast_dir_deg': [180.0],  # South swell
        'wind_speed_ms': [6.0],
        'wind_dir_deg': [0.0],  # North wind
        'wind_missing': [0],
        'forecast_ts_utc': ['2024-02-01T14:00:00Z'],
        'swell_access_factors': [swell_factors],
        'wind_exposure_factors': [wind_factors],
    })

    result = preprocess_v2(test_data)

    # Verify output
    assert len(result.columns) == 13
    assert result.iloc[0]['swell_access_factor'] == 0.95
    assert result.iloc[0]['wind_exposure_factor'] == 0.2

    print("✓ Feature engineering works correctly")
    print(f"  - Input: South swell (180°), North wind (0°)")
    print(f"  - Output: swell_access_factor=0.95, wind_exposure_factor=0.2")


def verify_backward_compatibility():
    """Verify backward compatibility with missing terrain data."""
    print("\nVerifying backward compatibility...")

    # Test without terrain factors
    test_data = pd.DataFrame({
        'forecast_height_m': [1.5],
        'forecast_period_s': [10.0],
        'forecast_dir_deg': [270.0],
        'wind_speed_ms': [5.0],
        'wind_dir_deg': [90.0],
        'wind_missing': [0],
        'forecast_ts_utc': ['2024-02-01T12:00:00Z'],
    })

    result = preprocess_v2(test_data)

    assert len(result.columns) == 13
    assert result.iloc[0]['swell_access_factor'] == 0.5
    assert result.iloc[0]['wind_exposure_factor'] == 0.5

    print("✓ Backward compatibility maintained")
    print("  - Missing terrain data defaults to 0.5 (neutral)")


def verify_bin_mapping():
    """Verify direction-to-bin mapping is correct."""
    print("\nVerifying bin mapping...")

    factors = [i / 72.0 for i in range(72)]

    test_cases = [
        (0.0, 0, "North"),
        (90.0, 18, "East"),
        (180.0, 36, "South"),
        (270.0, 54, "West"),
        (45.0, 9, "NE"),
        (135.0, 27, "SE"),
        (225.0, 45, "SW"),
        (315.0, 63, "NW"),
    ]

    for direction, expected_bin, label in test_cases:
        result = get_terrain_factor(factors, direction)
        expected = factors[expected_bin]
        assert abs(result - expected) < 0.01, \
            f"{label} ({direction}°) mapping failed"

    print("✓ Direction-to-bin mapping correct")
    print(f"  - Verified {len(test_cases)} cardinal/intercardinal directions")


def verify_edge_cases():
    """Verify edge case handling."""
    print("\nVerifying edge cases...")

    # Test None
    assert get_terrain_factor(None, 90.0) == 0.5

    # Test empty list
    assert get_terrain_factor([], 90.0) == 0.5

    # Test wrong length
    assert get_terrain_factor([0.5] * 50, 90.0) == 0.5

    # Test wrapping
    factors = [i / 72.0 for i in range(72)]
    result_355 = get_terrain_factor(factors, 355.0)
    result_359 = get_terrain_factor(factors, 359.0)
    # 355° + 2.5 = 357.5, 357.5/5 = 71.5, int = 71
    assert result_355 == factors[71]
    # 359° + 2.5 = 361.5, 361.5 % 360 = 1.5, 1.5/5 = 0.3, int = 0
    assert result_359 == factors[0]

    print("✓ Edge cases handled correctly")
    print("  - None, empty, wrong length → 0.5")
    print("  - Direction wrapping works (355° → bin 71, 359° → bin 0)")


def print_summary():
    """Print summary of verification."""
    print("\n" + "="*60)
    print("TERRAIN FACTOR INTEGRATION VERIFICATION COMPLETE")
    print("="*60)
    print("\nSummary:")
    print("  ✓ Feature count: 13 (was 11)")
    print("  ✓ New features: swell_access_factor, wind_exposure_factor")
    print("  ✓ Feature engineering: Working")
    print("  ✓ Backward compatibility: Maintained")
    print("  ✓ Bin mapping: Correct")
    print("  ✓ Edge cases: Handled")
    print("\nThe terrain factor integration is ready for production.")
    print("\nNext steps:")
    print("  1. Run full test suite: python3 test_transformers_v2_terrain.py")
    print("  2. Verify TypeScript types: yarn typecheck")
    print("  3. Wait for training data with terrain factors")
    print("  4. Retrain model to learn terrain correlations")
    print("  5. Monitor improvement in prediction accuracy")
    print()


def main():
    """Run all verification checks."""
    print("TERRAIN FACTOR INTEGRATION VERIFICATION")
    print("=" * 60)

    try:
        verify_feature_count()
        verify_feature_engineering()
        verify_backward_compatibility()
        verify_bin_mapping()
        verify_edge_cases()
        print_summary()
        return 0
    except AssertionError as e:
        print(f"\n❌ Verification failed: {e}")
        return 1
    except Exception as e:
        print(f"\n❌ Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == '__main__':
    import sys
    sys.exit(main())
