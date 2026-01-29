/**
 * Wave Height Test Utilities
 *
 * Shared test helpers for wave height transformer and formatter tests.
 * Centralizes mock creation to ensure consistency across test files.
 */

import { TERRAIN_BINS } from '@/types/terrain';
import type { BeachTerrainConfig } from '@/lib/utils/wave-height-transformer';

/**
 * Create a mock beach with uniform swell access for testing
 * @param accessValue Uniform access factor (0-1) for all directions
 * @returns Beach terrain configuration with terrain enabled
 */
export function createMockBeach(accessValue: number): BeachTerrainConfig {
  return {
    terrain_enabled: true,
    swell_access_factors: Array(TERRAIN_BINS).fill(accessValue),
  };
}

/**
 * Create a mock beach with terrain disabled for testing
 * @param accessValue Access factor (ignored when terrain disabled)
 * @returns Beach terrain configuration with terrain disabled
 */
export function createMockBeachDisabled(accessValue: number): BeachTerrainConfig {
  return {
    terrain_enabled: false,
    swell_access_factors: Array(TERRAIN_BINS).fill(accessValue),
  };
}

/**
 * Create a uniform swell access array
 * @param defaultValue Default access factor for all bins
 * @returns Array of 72 access factors
 */
export function createAccessArray(defaultValue: number): number[] {
  return Array(TERRAIN_BINS).fill(defaultValue);
}

/**
 * Create swell access array with specific bin set to a value
 * @param bin Bin index (0-71) to set
 * @param value Access factor for the specified bin
 * @param defaultValue Default access factor for other bins (default: 0.5)
 * @returns Array of 72 access factors with specified bin modified
 */
export function createAccessArrayWithBin(
  bin: number,
  value: number,
  defaultValue = 0.5
): number[] {
  const arr = Array(TERRAIN_BINS).fill(defaultValue);
  arr[bin] = value;
  return arr;
}

/**
 * Create a mock beach with specific bin access for testing direction factors
 * @param bin Bin index (0-71) to set
 * @param value Access factor for the specified bin
 * @param defaultValue Default access factor for other bins
 * @returns Beach terrain configuration
 */
export function createMockBeachWithBin(
  bin: number,
  value: number,
  defaultValue = 0.5
): BeachTerrainConfig {
  return {
    terrain_enabled: true,
    swell_access_factors: createAccessArrayWithBin(bin, value, defaultValue),
  };
}

/**
 * Standard test wave heights for consistent testing
 */
export const TEST_WAVE_HEIGHTS = {
  flat: 0.3,
  small: 1.5,
  medium: 3.0,
  large: 6.0,
  xlarge: 10.0,
} as const;

/**
 * Standard test periods for consistent testing
 */
export const TEST_PERIODS = {
  short: 6,
  reference: 10,
  medium: 12,
  long: 16,
  veryLong: 20,
} as const;

/**
 * Standard direction bins for testing
 * Maps cardinal directions to bin indices (5-degree bins)
 */
export const DIRECTION_BINS = {
  N: 0,    // 0 degrees
  NE: 9,   // 45 degrees
  E: 18,   // 90 degrees
  SE: 27,  // 135 degrees
  S: 36,   // 180 degrees
  SW: 45,  // 225 degrees
  W: 54,   // 270 degrees
  NW: 63,  // 315 degrees
} as const;

// Placeholder test to satisfy Jest's requirement
// This file contains test utilities, not tests themselves
describe('Wave Height Test Utilities', () => {
  it('exports utility functions for wave height tests', () => {
    expect(createMockBeach).toBeDefined();
    expect(createMockBeachDisabled).toBeDefined();
    expect(createAccessArray).toBeDefined();
    expect(createAccessArrayWithBin).toBeDefined();
    expect(createMockBeachWithBin).toBeDefined();
    expect(TEST_WAVE_HEIGHTS).toBeDefined();
    expect(TEST_PERIODS).toBeDefined();
    expect(DIRECTION_BINS).toBeDefined();
  });
});
