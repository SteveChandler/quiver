/**
 * Tests for Spot Profile Domain
 *
 * Tests the SpotProfile factory and angular calculation utilities.
 */

import {
  createSpotProfile,
  isDirectionInWindow,
  calculateWindowAlignment,
  SPOT_PROFILE_DEFAULTS,
} from '@/lib/domains/spot-profile';
import { angleDifference } from '@/lib/domains/shared';
import type { Beach } from '@/types/database';

// Mock beach factory for testing.
// `skill_level` is widened to allow null because downstream code defends
// against null at runtime even though the generated Beach.Row type pins
// it to `string` (the DB has a NOT NULL DEFAULT).
type MockBeachOverrides = Partial<Omit<Beach, "skill_level">> & {
  skill_level?: string | null;
};

function createMockBeach(overrides: MockBeachOverrides = {}): Beach {
  return {
    id: 'test-beach-id',
    name: 'Test Beach',
    slug: 'test-beach',
    lat: 32.8,
    lon: -117.25,
    city: 'San Diego',
    state: 'CA',
    country: 'USA',
    region: null,
    is_private: false,
    created_at: new Date().toISOString(),
    deleted_at: null,
    description: null,
    break_type: 'beach',
    skill_level: 'intermediate',
    hazards: null,
    warnings: null,
    features: null,
    access_tips: null,
    local_etiquette: null,
    parking_tips: null,
    wave_tips: null,
    crowd_tips: null,
    crowd_level: null,
    real_takeaways: null,
    best_months: null,
    best_conditions_prose: null,
    swell_window_min_deg: 250,
    swell_window_max_deg: 290,
    swell_window_center_deg: 270,
    swell_window_halfwidth_deg: 20,
    aspect_deg: null,
    wind_offshore_deg: 90,
    wind_offshore_tol_deg: 45,
    wind_cross_shore_ok_kt: 15,
    wind_onshore_bad_kt: 10,
    preferred_tide_ft_min: 2,
    preferred_tide_ft_max: 5,
    preferred_tide_direction: 'rising',
    cdip_station: null,
    preference_model: null,
    average_rating: null,
    review_count: null,
    owner_id: null,
    geog: null,
    timezone: '',
    ...overrides,
  } as Beach;
}

describe('Spot Profile Domain', () => {
  describe('createSpotProfile timezone', () => {
    it('uses the stored timezone before coordinate inference', () => {
      const profile = createSpotProfile(
        createMockBeach({
          lat: 23.3,
          lon: -110.2,
          timezone: 'America/Mazatlan',
        })
      );

      expect(profile.timezone).toBe('America/Mazatlan');
    });

    it('retains coordinate inference for legacy rows without a timezone', () => {
      const profile = createSpotProfile(
        createMockBeach({ timezone: '', lon: -110.2 })
      );

      expect(profile.timezone).toBe('America/Denver');
    });
  });

  describe('angleDifference', () => {
    it('should return 0 for identical angles', () => {
      expect(angleDifference(90, 90)).toBe(0);
      expect(angleDifference(0, 0)).toBe(0);
      expect(angleDifference(360, 360)).toBe(0);
    });

    it('should calculate simple differences correctly', () => {
      expect(angleDifference(90, 100)).toBe(10);
      expect(angleDifference(100, 90)).toBe(10);
      expect(angleDifference(0, 45)).toBe(45);
      expect(angleDifference(180, 270)).toBe(90);
    });

    it('should handle wrap-around at 360°', () => {
      expect(angleDifference(350, 10)).toBe(20);
      expect(angleDifference(10, 350)).toBe(20);
      expect(angleDifference(0, 359)).toBe(1);
      expect(angleDifference(1, 359)).toBe(2);
    });

    it('should never return more than 180', () => {
      expect(angleDifference(0, 180)).toBe(180);
      expect(angleDifference(0, 181)).toBe(179);
      expect(angleDifference(0, 270)).toBe(90);
      expect(angleDifference(90, 270)).toBe(180);
    });

    it('should handle 360 as equivalent to 0', () => {
      expect(angleDifference(0, 360)).toBe(0);
      expect(angleDifference(360, 0)).toBe(0);
      expect(angleDifference(360, 10)).toBe(10);
    });

    it('should handle angles > 360', () => {
      expect(angleDifference(370, 10)).toBe(0); // 370 = 10
      expect(angleDifference(720, 0)).toBe(0); // 720 = 0
    });

    it('should handle negative angles', () => {
      expect(angleDifference(-10, 10)).toBe(20); // -10 = 350
      expect(angleDifference(-90, 90)).toBe(180);
    });
  });

  describe('isDirectionInWindow', () => {
    const westWindow = {
      minDeg: 250,
      maxDeg: 290,
      centerDeg: 270,
      halfWidthDeg: 20,
    };

    it('should return true for directions at window center', () => {
      expect(isDirectionInWindow(270, westWindow)).toBe(true);
    });

    it('should return true for directions within window', () => {
      expect(isDirectionInWindow(260, westWindow)).toBe(true);
      expect(isDirectionInWindow(280, westWindow)).toBe(true);
      expect(isDirectionInWindow(250, westWindow)).toBe(true);
      expect(isDirectionInWindow(290, westWindow)).toBe(true);
    });

    it('should return false for directions outside window', () => {
      expect(isDirectionInWindow(240, westWindow)).toBe(false);
      expect(isDirectionInWindow(300, westWindow)).toBe(false);
      expect(isDirectionInWindow(180, westWindow)).toBe(false);
      expect(isDirectionInWindow(0, westWindow)).toBe(false);
    });

    it('should handle wrap-around windows (crossing 0°)', () => {
      const northWindow = {
        minDeg: 350,
        maxDeg: 10,
        centerDeg: 0,
        halfWidthDeg: 10,
      };

      expect(isDirectionInWindow(0, northWindow)).toBe(true);
      expect(isDirectionInWindow(355, northWindow)).toBe(true);
      expect(isDirectionInWindow(5, northWindow)).toBe(true);
      expect(isDirectionInWindow(350, northWindow)).toBe(true);
      expect(isDirectionInWindow(10, northWindow)).toBe(true);
      expect(isDirectionInWindow(180, northWindow)).toBe(false);
      expect(isDirectionInWindow(90, northWindow)).toBe(false);
    });
  });

  describe('calculateWindowAlignment', () => {
    const westWindow = {
      minDeg: 250,
      maxDeg: 290,
      centerDeg: 270,
      halfWidthDeg: 20,
    };

    it('should return 100 for perfect center alignment', () => {
      expect(calculateWindowAlignment(270, westWindow)).toBe(100);
    });

    it('should return high scores (70-100) for directions in window', () => {
      const score = calculateWindowAlignment(260, westWindow);
      expect(score).toBeGreaterThanOrEqual(70);
      expect(score).toBeLessThanOrEqual(100);
    });

    it('should return 70 at window edges', () => {
      // At edge (20° from center), centeredness = 0
      const edgeScore = calculateWindowAlignment(250, westWindow);
      expect(edgeScore).toBe(70);
    });

    it('should decrease score rapidly outside window', () => {
      const justOutside = calculateWindowAlignment(240, westWindow); // 10° outside
      const farOutside = calculateWindowAlignment(180, westWindow); // 70° outside

      expect(justOutside).toBeLessThan(70);
      expect(justOutside).toBeGreaterThan(farOutside);
      expect(farOutside).toBeLessThanOrEqual(0);
    });

    it('should return 0 for completely opposite directions', () => {
      const opposite = calculateWindowAlignment(90, westWindow); // 180° from center
      expect(opposite).toBe(0);
    });
  });

  describe('createSpotProfile', () => {
    it('should create a complete SpotProfile from a Beach', () => {
      const beach = createMockBeach();
      const profile = createSpotProfile(beach);

      expect(profile.id).toBe('test-beach-id');
      expect(profile.name).toBe('Test Beach');
      expect(profile.breakType).toBe('beach');
      expect(profile.skillLevel).toBe('intermediate');
    });

    it('should map swell window correctly', () => {
      const beach = createMockBeach({
        swell_window_min_deg: 250,
        swell_window_max_deg: 290,
      });
      const profile = createSpotProfile(beach);

      expect(profile.swellWindow.minDeg).toBe(250);
      expect(profile.swellWindow.maxDeg).toBe(290);
      expect(profile.swellWindow.centerDeg).toBe(270);
      expect(profile.swellWindow.halfWidthDeg).toBe(20);
    });

    it('should use defaults when swell window is null', () => {
      const beach = createMockBeach({
        swell_window_min_deg: null,
        swell_window_max_deg: null,
      });
      const profile = createSpotProfile(beach);

      expect(profile.swellWindow).toEqual(SPOT_PROFILE_DEFAULTS.swellWindow);
    });

    it('should map wind thresholds correctly', () => {
      const beach = createMockBeach({
        wind_offshore_deg: 90,
        wind_offshore_tol_deg: 45,
        wind_onshore_bad_kt: 10,
      });
      const profile = createSpotProfile(beach);

      expect(profile.windThresholds.offshoreDeg).toBe(90);
      expect(profile.windThresholds.offshoreToleranceDeg).toBe(45);
      // 10 knots * 1.15078 ≈ 11.5 mph
      expect(profile.windThresholds.maxOnshoreMph).toBeCloseTo(11.5, 0);
    });

    it('should use defaults when wind thresholds are null', () => {
      const beach = createMockBeach({
        wind_offshore_deg: null,
        wind_offshore_tol_deg: null,
        wind_onshore_bad_kt: null,
      });
      const profile = createSpotProfile(beach);

      expect(profile.windThresholds.offshoreDeg).toBe(
        SPOT_PROFILE_DEFAULTS.windThresholds.offshoreDeg
      );
      expect(profile.windThresholds.maxOnshoreMph).toBe(
        SPOT_PROFILE_DEFAULTS.windThresholds.maxOnshoreMph
      );
    });

    it('should map tide preferences correctly', () => {
      const beach = createMockBeach({
        preferred_tide_ft_min: 2,
        preferred_tide_ft_max: 5,
        preferred_tide_direction: 'rising',
      });
      const profile = createSpotProfile(beach);

      expect(profile.tidePreferences.minHeightFt).toBe(2);
      expect(profile.tidePreferences.maxHeightFt).toBe(5);
      expect(profile.tidePreferences.preferredDirection).toBe('rising');
    });

    it('should handle "any" tide direction as "either"', () => {
      const beach = createMockBeach({
        preferred_tide_direction: 'any',
      });
      const profile = createSpotProfile(beach);

      expect(profile.tidePreferences.preferredDirection).toBe('either');
    });

    it('should use defaults when tide preferences are null', () => {
      const beach = createMockBeach({
        preferred_tide_ft_min: null,
        preferred_tide_ft_max: null,
        preferred_tide_direction: null,
      });
      const profile = createSpotProfile(beach);

      expect(profile.tidePreferences.minHeightFt).toBe(
        SPOT_PROFILE_DEFAULTS.tidePreferences.minHeightFt
      );
      expect(profile.tidePreferences.preferredDirection).toBe('either');
    });

    it('should parse skill levels correctly', () => {
      const cases = [
        { input: 'beginner', expected: 'beginner' },
        { input: 'intermediate', expected: 'intermediate' },
        { input: 'advanced', expected: 'advanced' },
        { input: 'expert', expected: 'expert' },
        { input: 'ADVANCED', expected: 'advanced' },
        { input: '  intermediate  ', expected: 'intermediate' },
        { input: 'unknown', expected: null },
        { input: null, expected: null },
      ];

      for (const { input, expected } of cases) {
        const beach = createMockBeach({ skill_level: input });
        const profile = createSpotProfile(beach);
        expect(profile.skillLevel).toBe(expected);
      }
    });

    it('should estimate timezone from coordinates', () => {
      // West Coast
      const westCoast = createMockBeach({ lat: 34.0, lon: -118.0 });
      expect(createSpotProfile(westCoast).timezone).toBe('America/Los_Angeles');

      // East Coast
      const eastCoast = createMockBeach({ lat: 26.0, lon: -80.0 });
      expect(createSpotProfile(eastCoast).timezone).toBe('America/New_York');

      // Hawaii
      const hawaii = createMockBeach({ lat: 21.3, lon: -157.8 });
      expect(createSpotProfile(hawaii).timezone).toBe('Pacific/Honolulu');
    });

    it('should handle zero coordinates gracefully', () => {
      const beach = createMockBeach({ lat: 0, lon: 0 });
      const profile = createSpotProfile(beach);

      expect(profile.coordinates.lat).toBe(0);
      expect(profile.coordinates.lon).toBe(0);
      expect(profile.timezone).toBe('America/Los_Angeles'); // Default
    });
  });

  describe('Edge Cases', () => {
    it('should handle swell window spanning 180° correctly', () => {
      const beach = createMockBeach({
        swell_window_min_deg: 180,
        swell_window_max_deg: 360,
      });
      const profile = createSpotProfile(beach);

      expect(profile.swellWindow.halfWidthDeg).toBe(90);
      expect(profile.swellWindow.centerDeg).toBe(270);
    });

    it('should handle full 360° swell window', () => {
      const beach = createMockBeach({
        swell_window_min_deg: 0,
        swell_window_max_deg: 360,
      });
      const profile = createSpotProfile(beach);

      expect(profile.swellWindow.halfWidthDeg).toBe(180);
    });

    it('should handle narrow swell window', () => {
      const beach = createMockBeach({
        swell_window_min_deg: 269,
        swell_window_max_deg: 271,
      });
      const profile = createSpotProfile(beach);

      expect(profile.swellWindow.halfWidthDeg).toBe(1);
      expect(profile.swellWindow.centerDeg).toBe(270);
    });
  });
});
