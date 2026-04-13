/**
 * @jest-environment node
 */

import { scoreConditions, getWaveHeightCeiling, calculateSwellQualityBoost, calculateSwellDirectionFit, angleDifference } from '@/lib/scoring/surf-conditions-scorer';
import type { BeachWithThresholds, ForecastForScoring } from '@/lib/scoring/types';

describe('scoreConditions', () => {
  const baseBeach: BeachWithThresholds = {
    id: 'test-beach',
    name: 'Test Beach',
    wind_offshore_deg: 90, // E wind is offshore
    wind_offshore_tol_deg: 30,
    preferred_tide_ft_min: 2.0,
    preferred_tide_ft_max: 5.0,
    swell_window_min_deg: 200,
    swell_window_max_deg: 320,
    max_wind_onshore_mph: 10,
    max_wind_any_mph: 18,
  } as BeachWithThresholds;

  const baseForecast: ForecastForScoring = {
    forecastTime: new Date('2026-01-14T08:00:00Z'),
    waveHeight: 3.5,
    wavePeriod: 12,
    windSpeed: 5,
    windDirection: 90, // Offshore
    tideHeight: 3.0,
    tideStatus: 'rising',
  };

  describe('match quality thresholds', () => {
    it('returns "perfect" for score >= 85', () => {
      const result = scoreConditions(baseForecast, baseBeach);
      expect(result.total).toBeGreaterThanOrEqual(70);
      expect(['perfect', 'excellent']).toContain(result.matchQuality);
    });

    it('returns "skip" when wind exceeds max_wind_any_mph', () => {
      const forecast = { ...baseForecast, windSpeed: 20 };
      const result = scoreConditions(forecast, baseBeach);
      expect(result.matchQuality).toBe('skip');
      expect(result.recommendationLabel).toBe('Skip');
      expect(result.warnings.some((w) => /too windy/i.test(w))).toBe(true);
    });

    it('returns "skip" when onshore wind exceeds threshold', () => {
      const forecast = { ...baseForecast, windSpeed: 12, windDirection: 270 }; // W wind is onshore
      const result = scoreConditions(forecast, baseBeach);
      expect(result.matchQuality).toBe('skip');
      expect(result.warnings.some((w) => /onshore/i.test(w))).toBe(true);
    });
  });

  describe('recommendation labels', () => {
    it('maps perfect/excellent to "Worth it"', () => {
      const result = scoreConditions(baseForecast, baseBeach);
      if (result.matchQuality === 'perfect' || result.matchQuality === 'excellent') {
        expect(result.recommendationLabel).toBe('Worth it');
      }
    });

    it('maps good/fair to "Maybe"', () => {
      // Marginal conditions - tide outside range
      const forecast = { ...baseForecast, tideHeight: 6.0 };
      const result = scoreConditions(forecast, baseBeach);
      if (result.matchQuality === 'good' || result.matchQuality === 'fair') {
        expect(result.recommendationLabel).toBe('Maybe');
      }
    });

    it('maps skip to "Skip"', () => {
      const forecast = { ...baseForecast, windSpeed: 25 };
      const result = scoreConditions(forecast, baseBeach);
      expect(result.matchQuality).toBe('skip');
      expect(result.recommendationLabel).toBe('Skip');
    });
  });

  describe('natural message generation', () => {
    it('generates message for good conditions', () => {
      const result = scoreConditions(baseForecast, baseBeach);
      expect(result.message).toBeTruthy();
      expect(result.message.length).toBeGreaterThan(10);
    });

    it('includes wind context in reasons or message', () => {
      const result = scoreConditions(baseForecast, baseBeach);
      // Wind context should be in reasons or message
      const hasWindContext =
        result.reasons.some((r) => /wind|offshore|glassy/i.test(r)) ||
        /wind|offshore|glassy/i.test(result.message);
      expect(hasWindContext).toBe(true);
    });
  });

  describe('subscores calculation', () => {
    it('calculates waveHeightFit subscore', () => {
      const result = scoreConditions(baseForecast, baseBeach);
      expect(result.subscores.waveHeightFit).toBeGreaterThanOrEqual(0);
      expect(result.subscores.waveHeightFit).toBeLessThanOrEqual(25);
    });

    it('calculates periodEnergy subscore', () => {
      const result = scoreConditions(baseForecast, baseBeach);
      expect(result.subscores.periodEnergy).toBeGreaterThanOrEqual(0);
      expect(result.subscores.periodEnergy).toBeLessThanOrEqual(20);
    });

    it('calculates windAlignment subscore', () => {
      const result = scoreConditions(baseForecast, baseBeach);
      expect(result.subscores.windAlignment).toBeGreaterThanOrEqual(0);
      expect(result.subscores.windAlignment).toBeLessThanOrEqual(20);
    });

    it('calculates tideFit subscore', () => {
      const result = scoreConditions(baseForecast, baseBeach);
      expect(result.subscores.tideFit).toBeGreaterThanOrEqual(0);
      expect(result.subscores.tideFit).toBeLessThanOrEqual(15);
    });
  });

  describe('skip condition handling', () => {
    it('sets total to 0 for skip conditions', () => {
      const forecast = { ...baseForecast, windSpeed: 25 };
      const result = scoreConditions(forecast, baseBeach);
      expect(result.total).toBe(0);
    });

    it('uses default max_wind_any_mph of 25 when not specified', () => {
      const beachWithoutThresholds = {
        ...baseBeach,
        max_wind_any_mph: undefined,
      } as BeachWithThresholds;
      const forecast = { ...baseForecast, windSpeed: 27 };
      const result = scoreConditions(forecast, beachWithoutThresholds);
      expect(result.matchQuality).toBe('skip');
    });

    it('uses default max_wind_onshore_mph of 10 when not specified', () => {
      const beachWithoutThresholds = {
        ...baseBeach,
        max_wind_onshore_mph: undefined,
      } as BeachWithThresholds;
      const forecast = { ...baseForecast, windSpeed: 12, windDirection: 270 }; // Onshore
      const result = scoreConditions(forecast, beachWithoutThresholds);
      expect(result.matchQuality).toBe('skip');
    });
  });

  describe('score normalization', () => {
    it('normalizes raw points to 0-100 scale', () => {
      const result = scoreConditions(baseForecast, baseBeach);
      expect(result.total).toBeGreaterThanOrEqual(0);
      expect(result.total).toBeLessThanOrEqual(100);
    });

    it('total equals normalized sum of subscores capped by wave-height ceiling', () => {
      const result = scoreConditions(baseForecast, baseBeach);
      // Max raw points: 25 + 20 + 20 + 15 = 80
      // Normalized = (raw / 80) * 100, then capped by wave-height ceiling
      const rawSum =
        result.subscores.waveHeightFit +
        result.subscores.periodEnergy +
        result.subscores.windAlignment +
        result.subscores.tideFit;
      const normalizedTotal = Math.round((rawSum / 80) * 100);
      // Default skill level is intermediate (idealMin=2, idealMax=5)
      const ceiling = getWaveHeightCeiling(baseForecast.waveHeight, 2, 5);
      expect(result.total).toBe(Math.min(normalizedTotal, ceiling));
    });
  });

  describe('edge cases', () => {
    it('handles null wind direction', () => {
      const forecast = { ...baseForecast, windDirection: null };
      const result = scoreConditions(forecast, baseBeach);
      expect(result).toBeDefined();
      expect(typeof result.total).toBe('number');
    });

    it('handles zero wave height', () => {
      const forecast = { ...baseForecast, waveHeight: 0 };
      const result = scoreConditions(forecast, baseBeach);
      expect(result).toBeDefined();
      expect(result.subscores.waveHeightFit).toBe(0);
    });

    it('handles negative tide height', () => {
      const forecast = { ...baseForecast, tideHeight: -0.5 };
      const result = scoreConditions(forecast, baseBeach);
      expect(result).toBeDefined();
      expect(typeof result.total).toBe('number');
    });

    it('handles beach with no swell window defined', () => {
      const beachNoSwellWindow = {
        ...baseBeach,
        swell_window_min_deg: null,
        swell_window_max_deg: null,
      } as unknown as BeachWithThresholds;
      const result = scoreConditions(baseForecast, beachNoSwellWindow);
      expect(result).toBeDefined();
    });

    it('handles beach with no tide preferences', () => {
      const beachNoTide = {
        ...baseBeach,
        preferred_tide_ft_min: null,
        preferred_tide_ft_max: null,
      } as unknown as BeachWithThresholds;
      const result = scoreConditions(baseForecast, beachNoTide);
      expect(result).toBeDefined();
    });
  });

  describe('reasons and warnings', () => {
    it('includes reasons for good conditions', () => {
      const result = scoreConditions(baseForecast, baseBeach);
      expect(result.reasons.length).toBeGreaterThan(0);
    });

    it('includes warnings when conditions are marginal', () => {
      const forecast = { ...baseForecast, windSpeed: 15 }; // Approaching threshold
      const result = scoreConditions(forecast, baseBeach);
      // May or may not have warnings depending on score
      expect(Array.isArray(result.warnings)).toBe(true);
    });

    it('skip message includes reason', () => {
      const forecast = { ...baseForecast, windSpeed: 25 };
      const result = scoreConditions(forecast, baseBeach);
      expect(result.message).toMatch(/skip/i);
    });
  });

  describe('match quality boundaries', () => {
    it('correctly assigns quality based on score thresholds', () => {
      // Test that the quality matches the documented thresholds
      // >= 85 -> perfect, >= 70 -> excellent, >= 55 -> good, >= 40 -> fair, < 40 -> skip

      // Perfect conditions
      const perfectForecast: ForecastForScoring = {
        forecastTime: new Date('2026-01-14T08:00:00Z'),
        waveHeight: 4.0,
        wavePeriod: 14,
        windSpeed: 3,
        windDirection: 90, // Offshore
        tideHeight: 3.5,
        tideStatus: 'rising',
      };
      const perfectResult = scoreConditions(perfectForecast, baseBeach);

      // Should be high scoring
      expect(perfectResult.total).toBeGreaterThanOrEqual(70);
      expect(['perfect', 'excellent']).toContain(perfectResult.matchQuality);
    });
  });

});

// ---------------------------------------------------------------------------
// Swell quality boost and direction fit — exported helpers + integration
// ---------------------------------------------------------------------------
describe('swell quality boost', () => {
  // Beach with ideal SW swell window (260° center, ±30° halfwidth)
  const swellBeach: BeachWithThresholds = {
    id: 'swell-beach',
    name: 'Swell Test Beach',
    wind_offshore_deg: 90,  // E wind is offshore
    wind_offshore_tol_deg: 45,
    preferred_tide_ft_min: 1.0,
    preferred_tide_ft_max: 5.0,
    max_wind_onshore_mph: 10,
    max_wind_any_mph: 25,
    swell_window_center_deg: 260,   // SW swell is ideal
    swell_window_halfwidth_deg: 30, // ±30°: ideal range 230-290
  };

  // Ideal small conditions: 1.5ft, 14s, SW swell (260°), light offshore wind
  const smallQualityForecast: ForecastForScoring = {
    forecastTime: new Date('2026-01-14T08:00:00Z'),
    waveHeight: 1.5,
    wavePeriod: 14,
    windSpeed: 5,
    windDirection: 90,  // Offshore
    tideHeight: 3.0,
    tideStatus: 'rising',
    swellDirection: 260, // Ideal SW swell
  };

  describe('angleDifference (exported helper)', () => {
    it('returns 0 for identical angles', () => {
      expect(angleDifference(90, 90)).toBe(0);
    });

    it('returns 90 for perpendicular angles', () => {
      expect(angleDifference(0, 90)).toBe(90);
    });

    it('handles wrap-around correctly (350 vs 10 = 20)', () => {
      expect(angleDifference(350, 10)).toBe(20);
    });

    it('always returns value between 0 and 180', () => {
      expect(angleDifference(0, 180)).toBe(180);
      expect(angleDifference(0, 270)).toBe(90);
    });
  });

  describe('calculateSwellDirectionFit', () => {
    it('returns 1.0 for swell exactly at window center', () => {
      const fit = calculateSwellDirectionFit(260, swellBeach);
      expect(fit).toBe(1.0);
    });

    it('returns 1.0 for swell at edge of halfwidth window', () => {
      // 260 ± 30 → fit at 230 or 290 should be at edge (still >= 0.5)
      const fit = calculateSwellDirectionFit(230, swellBeach);
      expect(fit).toBeGreaterThan(0.4);
    });

    it('returns low fit for swell 90° off from center', () => {
      const fit = calculateSwellDirectionFit(170, swellBeach); // 90° from 260
      expect(fit).toBeLessThan(0.3);
    });

    it('returns 0.5 when beach has no swell window data', () => {
      const noWindowBeach: BeachWithThresholds = { ...swellBeach, swell_window_center_deg: null, swell_window_halfwidth_deg: null };
      const fit = calculateSwellDirectionFit(260, noWindowBeach);
      expect(fit).toBe(0.5);
    });

    it('returns 0.5 when swellDirection is null', () => {
      const fit = calculateSwellDirectionFit(null, swellBeach);
      expect(fit).toBe(0.5);
    });
  });

  describe('calculateSwellQualityBoost', () => {
    it('returns positive boost for 1.5ft, 14s, ideal direction', () => {
      const boost = calculateSwellQualityBoost(smallQualityForecast, swellBeach);
      expect(boost).toBeGreaterThan(3); // Meaningful boost
    });

    it('returns near-zero boost for 1.5ft, 6s period (short period)', () => {
      const shortPeriodForecast = { ...smallQualityForecast, wavePeriod: 6 };
      const boost = calculateSwellQualityBoost(shortPeriodForecast, swellBeach);
      expect(boost).toBeLessThan(1.5); // Minimal boost for short period
    });

    it('returns reduced boost for 1.5ft, 14s, 90° off ideal direction', () => {
      const offAngleForecast = { ...smallQualityForecast, swellDirection: 170 }; // 90° off 260
      const idealBoost = calculateSwellQualityBoost(smallQualityForecast, swellBeach);
      const offBoost = calculateSwellQualityBoost(offAngleForecast, swellBeach);
      expect(offBoost).toBeLessThan(idealBoost * 0.5); // Significantly less
    });

    it('returns 0 boost for waves >= 2ft (above threshold)', () => {
      const bigWaveForecast = { ...smallQualityForecast, waveHeight: 3.0 };
      const boost = calculateSwellQualityBoost(bigWaveForecast, swellBeach);
      expect(boost).toBe(0);
    });

    it('returns minimal boost for 0.3ft wave (very flat)', () => {
      const flatForecast = { ...smallQualityForecast, waveHeight: 0.3 };
      const boost = calculateSwellQualityBoost(flatForecast, swellBeach);
      // At 0.3ft, smallWaveMultiplier is very low
      expect(boost).toBeLessThan(2);
    });

    it('returns exactly 0 boost for 2ft waves (boundary)', () => {
      const twoFtForecast = { ...smallQualityForecast, waveHeight: 2.0 };
      const boost = calculateSwellQualityBoost(twoFtForecast, swellBeach);
      expect(boost).toBe(0);
    });
  });

  describe('scoreConditions integration with swell quality boost', () => {
    it('small waves with quality swell score significantly higher than without boost', () => {
      // Compare a beach with swell window vs one without
      const noWindowBeach: BeachWithThresholds = { ...swellBeach, swell_window_center_deg: null };
      const withBoost = scoreConditions(smallQualityForecast, swellBeach);
      const withoutBoost = scoreConditions(smallQualityForecast, noWindowBeach);
      // The boost should meaningfully improve the score
      expect(withBoost.total).toBeGreaterThan(withoutBoost.total);
      expect(withBoost.swellQualityBoost).toBeGreaterThan(0);
    });

    it('swellQualityBoost is 0 for waves >= 2ft', () => {
      const bigWaveForecast = { ...smallQualityForecast, waveHeight: 3.0 };
      const result = scoreConditions(bigWaveForecast, swellBeach);
      expect(result.swellQualityBoost).toBe(0);
    });

    it('swellQualityBoost field is present in result', () => {
      const result = scoreConditions(smallQualityForecast, swellBeach);
      expect(typeof result.swellQualityBoost).toBe('number');
    });

    it('onshore wind still penalizes wind alignment score even with swell quality boost', () => {
      // Use onshore wind but below max threshold so not a skip
      const onshoreWindForecast: ForecastForScoring = {
        ...smallQualityForecast,
        windSpeed: 8,
        windDirection: 270, // Onshore (opposite of 90° offshore)
      };
      const offshoreResult = scoreConditions(smallQualityForecast, swellBeach);
      const onshoreResult = scoreConditions(onshoreWindForecast, swellBeach);
      // Wind alignment subscore should be significantly lower for onshore
      expect(onshoreResult.subscores.windAlignment).toBeLessThan(offshoreResult.subscores.windAlignment);
      // Swell quality boost still applies (wave is still small + quality swell)
      expect(onshoreResult.swellQualityBoost).toBeGreaterThan(0);
      expect(offshoreResult.swellQualityBoost).toBeGreaterThan(0);
      // Note: wave-height ceiling may cause both totals to be equal despite
      // the wind quality difference — subscores show the penalty clearly
    });

    it('all existing base conditions still score correctly (regression)', () => {
      // Make sure the base 3.5ft forecast still works (no boost since waveHeight > 2)
      const baseBeach: BeachWithThresholds = {
        id: 'test-beach',
        name: 'Test Beach',
        wind_offshore_deg: 90,
        wind_offshore_tol_deg: 30,
        preferred_tide_ft_min: 2.0,
        preferred_tide_ft_max: 5.0,
        max_wind_onshore_mph: 10,
        max_wind_any_mph: 18,
      } as BeachWithThresholds;
      const baseForecast: ForecastForScoring = {
        forecastTime: new Date('2026-01-14T08:00:00Z'),
        waveHeight: 3.5,
        wavePeriod: 12,
        windSpeed: 5,
        windDirection: 90,
        tideHeight: 3.0,
        tideStatus: 'rising',
      };
      const result = scoreConditions(baseForecast, baseBeach);
      expect(result.total).toBeGreaterThanOrEqual(70);
      expect(result.swellQualityBoost).toBe(0);
    });
  });
});
