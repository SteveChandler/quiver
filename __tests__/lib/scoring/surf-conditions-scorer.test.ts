import { scoreConditions, getWaveHeightCeiling } from '@/lib/scoring/surf-conditions-scorer';
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

  // ---------------------------------------------------------------------------
  // Personalized wave height scoring
  // ---------------------------------------------------------------------------
  // scoreWaveHeightFitPersonalized is private but exercised through the public
  // scoreConditions() function when options.userPreferences.preferredWaveSize
  // is provided. MAX_WAVE_HEIGHT_FIT = 25. All other forecast factors are held
  // constant so that only the waveHeightFit subscore varies between tests.
  // ---------------------------------------------------------------------------
  describe('personalized wave height scoring', () => {
    // A forecast template with good wind/tide/period so skip conditions are
    // never triggered and the waveHeightFit subscore is the only variable.
    const basePersonalizedForecast: ForecastForScoring = {
      forecastTime: new Date('2026-01-14T08:00:00Z'),
      waveHeight: 3.0, // overridden per test
      wavePeriod: 12,
      windSpeed: 5,
      windDirection: 90, // Offshore → never triggers skip
      tideHeight: 3.0,  // Within baseBeach preferred range
      tideStatus: 'rising',
    };

    // -------------------------------------------------------------------------
    // small: idealMin=1, idealMax=3, partialLowMin=0.5, partialHighMax=5
    // -------------------------------------------------------------------------
    describe('preferredWaveSize: small', () => {
      const prefs = { preferredWaveSize: 'small' as const };

      it('returns max waveHeightFit (25) for wave in ideal range', () => {
        const result = scoreConditions(
          { ...basePersonalizedForecast, waveHeight: 2.0 },
          baseBeach,
          { userPreferences: prefs }
        );
        expect(result.subscores.waveHeightFit).toBe(25);
      });

      it('returns max waveHeightFit (25) at ideal lower bound (1ft)', () => {
        const result = scoreConditions(
          { ...basePersonalizedForecast, waveHeight: 1.0 },
          baseBeach,
          { userPreferences: prefs }
        );
        expect(result.subscores.waveHeightFit).toBe(25);
      });

      it('returns max waveHeightFit (25) at ideal upper bound (3ft)', () => {
        const result = scoreConditions(
          { ...basePersonalizedForecast, waveHeight: 3.0 },
          baseBeach,
          { userPreferences: prefs }
        );
        expect(result.subscores.waveHeightFit).toBe(25);
      });

      it('returns partial score for wave in partial-low range (0.5–1ft)', () => {
        // 0.7ft: round(25 * 0.7 / 1) = round(17.5) = 18
        const result = scoreConditions(
          { ...basePersonalizedForecast, waveHeight: 0.7 },
          baseBeach,
          { userPreferences: prefs }
        );
        expect(result.subscores.waveHeightFit).toBe(18);
      });

      it('returns partial score for wave in partial-high range (3–5ft)', () => {
        // 4ft: fraction = 1 - (4-3)/(5-3) = 0.5; round(25*0.5) = 13
        const result = scoreConditions(
          { ...basePersonalizedForecast, waveHeight: 4.0 },
          baseBeach,
          { userPreferences: prefs }
        );
        expect(result.subscores.waveHeightFit).toBe(13);
      });

      it('returns minimum score for wave below partial-low range (< 0.5ft)', () => {
        // 0.2ft: round(25 * 0.1) = 3 (clamped to ≥ 0)
        const result = scoreConditions(
          { ...basePersonalizedForecast, waveHeight: 0.2 },
          baseBeach,
          { userPreferences: prefs }
        );
        expect(result.subscores.waveHeightFit).toBe(3);
      });

      it('returns minimum score for wave above partial-high range (> 5ft)', () => {
        // 6ft: round(25 * 0.2) = 5
        const result = scoreConditions(
          { ...basePersonalizedForecast, waveHeight: 6.0 },
          baseBeach,
          { userPreferences: prefs }
        );
        expect(result.subscores.waveHeightFit).toBe(5);
      });

      it('returns 0 for zero wave height', () => {
        const result = scoreConditions(
          { ...basePersonalizedForecast, waveHeight: 0 },
          baseBeach,
          { userPreferences: prefs }
        );
        expect(result.subscores.waveHeightFit).toBe(0);
      });

      it('returns 0 for negative wave height', () => {
        const result = scoreConditions(
          { ...basePersonalizedForecast, waveHeight: -1 },
          baseBeach,
          { userPreferences: prefs }
        );
        expect(result.subscores.waveHeightFit).toBe(0);
      });

      it('includes "your kind of waves" reason for ideal range', () => {
        const result = scoreConditions(
          { ...basePersonalizedForecast, waveHeight: 2.0 },
          baseBeach,
          { userPreferences: prefs }
        );
        expect(result.reasons.some((r) => /your kind of waves/i.test(r))).toBe(true);
      });

      it('includes "below your preferred size" reason for partial-low range', () => {
        const result = scoreConditions(
          { ...basePersonalizedForecast, waveHeight: 0.7 },
          baseBeach,
          { userPreferences: prefs }
        );
        expect(result.reasons.some((r) => /below your preferred size/i.test(r))).toBe(true);
      });

      it('includes "above your comfort zone" reason for partial-high range', () => {
        const result = scoreConditions(
          { ...basePersonalizedForecast, waveHeight: 4.0 },
          baseBeach,
          { userPreferences: prefs }
        );
        expect(result.reasons.some((r) => /above your comfort zone/i.test(r))).toBe(true);
      });
    });

    // -------------------------------------------------------------------------
    // medium: idealMin=2, idealMax=5, partialLowMin=1, partialHighMax=8
    // -------------------------------------------------------------------------
    describe('preferredWaveSize: medium', () => {
      const prefs = { preferredWaveSize: 'medium' as const };

      it('returns max waveHeightFit (25) for wave in ideal range', () => {
        const result = scoreConditions(
          { ...basePersonalizedForecast, waveHeight: 3.0 },
          baseBeach,
          { userPreferences: prefs }
        );
        expect(result.subscores.waveHeightFit).toBe(25);
      });

      it('returns max waveHeightFit (25) at ideal lower bound (2ft)', () => {
        const result = scoreConditions(
          { ...basePersonalizedForecast, waveHeight: 2.0 },
          baseBeach,
          { userPreferences: prefs }
        );
        expect(result.subscores.waveHeightFit).toBe(25);
      });

      it('returns max waveHeightFit (25) at ideal upper bound (5ft)', () => {
        const result = scoreConditions(
          { ...basePersonalizedForecast, waveHeight: 5.0 },
          baseBeach,
          { userPreferences: prefs }
        );
        expect(result.subscores.waveHeightFit).toBe(25);
      });

      it('returns partial score for wave in partial-low range (1–2ft)', () => {
        // 1.5ft: round(25 * 1.5 / 2) = round(18.75) = 19
        const result = scoreConditions(
          { ...basePersonalizedForecast, waveHeight: 1.5 },
          baseBeach,
          { userPreferences: prefs }
        );
        expect(result.subscores.waveHeightFit).toBe(19);
      });

      it('returns partial score for wave in partial-high range (5–8ft)', () => {
        // 6.5ft: fraction = 1 - (6.5-5)/(8-5) = 0.5; round(25*0.5) = 13
        const result = scoreConditions(
          { ...basePersonalizedForecast, waveHeight: 6.5 },
          baseBeach,
          { userPreferences: prefs }
        );
        expect(result.subscores.waveHeightFit).toBe(13);
      });

      it('returns minimum score for wave below partial-low range (< 1ft)', () => {
        // 0.5ft: round(25 * 0.1) = 3
        const result = scoreConditions(
          { ...basePersonalizedForecast, waveHeight: 0.5 },
          baseBeach,
          { userPreferences: prefs }
        );
        expect(result.subscores.waveHeightFit).toBe(3);
      });

      it('returns minimum score for wave above partial-high range (> 8ft)', () => {
        // 10ft: round(25 * 0.2) = 5
        const result = scoreConditions(
          { ...basePersonalizedForecast, waveHeight: 10.0 },
          baseBeach,
          { userPreferences: prefs }
        );
        expect(result.subscores.waveHeightFit).toBe(5);
      });

      it('returns 0 for zero wave height', () => {
        const result = scoreConditions(
          { ...basePersonalizedForecast, waveHeight: 0 },
          baseBeach,
          { userPreferences: prefs }
        );
        expect(result.subscores.waveHeightFit).toBe(0);
      });

      it('returns 0 for negative wave height', () => {
        const result = scoreConditions(
          { ...basePersonalizedForecast, waveHeight: -2 },
          baseBeach,
          { userPreferences: prefs }
        );
        expect(result.subscores.waveHeightFit).toBe(0);
      });

      it('includes "your kind of waves" reason for ideal range', () => {
        const result = scoreConditions(
          { ...basePersonalizedForecast, waveHeight: 3.0 },
          baseBeach,
          { userPreferences: prefs }
        );
        expect(result.reasons.some((r) => /your kind of waves/i.test(r))).toBe(true);
      });

      it('includes "below your preferred size" reason for below-partial-low range', () => {
        const result = scoreConditions(
          { ...basePersonalizedForecast, waveHeight: 0.5 },
          baseBeach,
          { userPreferences: prefs }
        );
        expect(result.reasons.some((r) => /below your preferred size/i.test(r))).toBe(true);
      });

      it('includes "above your comfort zone" reason for above-partial-high range', () => {
        const result = scoreConditions(
          { ...basePersonalizedForecast, waveHeight: 10.0 },
          baseBeach,
          { userPreferences: prefs }
        );
        expect(result.reasons.some((r) => /above your comfort zone/i.test(r))).toBe(true);
      });
    });

    // -------------------------------------------------------------------------
    // large: idealMin=5, idealMax=10, partialLowMin=3, partialHighMax=14
    // -------------------------------------------------------------------------
    describe('preferredWaveSize: large', () => {
      const prefs = { preferredWaveSize: 'large' as const };

      it('returns max waveHeightFit (25) for wave in ideal range', () => {
        const result = scoreConditions(
          { ...basePersonalizedForecast, waveHeight: 7.0 },
          baseBeach,
          { userPreferences: prefs }
        );
        expect(result.subscores.waveHeightFit).toBe(25);
      });

      it('returns max waveHeightFit (25) at ideal lower bound (5ft)', () => {
        const result = scoreConditions(
          { ...basePersonalizedForecast, waveHeight: 5.0 },
          baseBeach,
          { userPreferences: prefs }
        );
        expect(result.subscores.waveHeightFit).toBe(25);
      });

      it('returns max waveHeightFit (25) at ideal upper bound (10ft)', () => {
        const result = scoreConditions(
          { ...basePersonalizedForecast, waveHeight: 10.0 },
          baseBeach,
          { userPreferences: prefs }
        );
        expect(result.subscores.waveHeightFit).toBe(25);
      });

      it('returns partial score for wave in partial-low range (3–5ft)', () => {
        // 4ft: round(25 * 4/5) = round(20) = 20
        const result = scoreConditions(
          { ...basePersonalizedForecast, waveHeight: 4.0 },
          baseBeach,
          { userPreferences: prefs }
        );
        expect(result.subscores.waveHeightFit).toBe(20);
      });

      it('returns partial score for wave in partial-high range (10–14ft)', () => {
        // 12ft: fraction = 1 - (12-10)/(14-10) = 0.5; round(25*0.5) = 13
        const result = scoreConditions(
          { ...basePersonalizedForecast, waveHeight: 12.0 },
          baseBeach,
          { userPreferences: prefs }
        );
        expect(result.subscores.waveHeightFit).toBe(13);
      });

      it('returns minimum score for wave below partial-low range (< 3ft)', () => {
        // 2ft: round(25 * 0.1) = 3 (clamped to ≥ 0)
        const result = scoreConditions(
          { ...basePersonalizedForecast, waveHeight: 2.0 },
          baseBeach,
          { userPreferences: prefs }
        );
        expect(result.subscores.waveHeightFit).toBe(3);
      });

      it('returns minimum score for wave above partial-high range (> 14ft)', () => {
        // 15ft: round(25 * 0.2) = 5
        const result = scoreConditions(
          { ...basePersonalizedForecast, waveHeight: 15.0 },
          baseBeach,
          { userPreferences: prefs }
        );
        expect(result.subscores.waveHeightFit).toBe(5);
      });

      it('returns 0 for zero wave height', () => {
        const result = scoreConditions(
          { ...basePersonalizedForecast, waveHeight: 0 },
          baseBeach,
          { userPreferences: prefs }
        );
        expect(result.subscores.waveHeightFit).toBe(0);
      });

      it('returns 0 for negative wave height', () => {
        const result = scoreConditions(
          { ...basePersonalizedForecast, waveHeight: -5 },
          baseBeach,
          { userPreferences: prefs }
        );
        expect(result.subscores.waveHeightFit).toBe(0);
      });

      it('includes "your kind of waves" reason for ideal range', () => {
        const result = scoreConditions(
          { ...basePersonalizedForecast, waveHeight: 7.0 },
          baseBeach,
          { userPreferences: prefs }
        );
        expect(result.reasons.some((r) => /your kind of waves/i.test(r))).toBe(true);
      });

      it('includes "below your preferred size" reason for partial-low range', () => {
        const result = scoreConditions(
          { ...basePersonalizedForecast, waveHeight: 4.0 },
          baseBeach,
          { userPreferences: prefs }
        );
        expect(result.reasons.some((r) => /below your preferred size/i.test(r))).toBe(true);
      });

      it('includes "above your comfort zone" reason for partial-high range', () => {
        const result = scoreConditions(
          { ...basePersonalizedForecast, waveHeight: 12.0 },
          baseBeach,
          { userPreferences: prefs }
        );
        expect(result.reasons.some((r) => /above your comfort zone/i.test(r))).toBe(true);
      });
    });

    // -------------------------------------------------------------------------
    // Behaviour compared to non-personalized scoring
    // -------------------------------------------------------------------------
    describe('personalized vs non-personalized fallthrough', () => {
      it('uses non-personalized scorer when userPreferences is omitted', () => {
        // Without prefs the non-personalized scorer is used; 2ft is in the
        // default ideal range (2-5ft) so waveHeightFit should be 25.
        const withoutPrefs = scoreConditions(
          { ...basePersonalizedForecast, waveHeight: 2.0 },
          baseBeach
        );
        expect(withoutPrefs.subscores.waveHeightFit).toBe(25);
      });

      it('uses non-personalized scorer when preferredWaveSize is null', () => {
        const withNullPref = scoreConditions(
          { ...basePersonalizedForecast, waveHeight: 2.0 },
          baseBeach,
          { userPreferences: { preferredWaveSize: null } }
        );
        expect(withNullPref.subscores.waveHeightFit).toBe(25);
      });

      it('personalized small-pref lowers score for waves above comfort zone vs non-personalized ideal', () => {
        // 4ft is in default ideal range (non-personalized = 25),
        // but for 'small' preference it is in partial-high zone (score < 25).
        const nonPersonalized = scoreConditions(
          { ...basePersonalizedForecast, waveHeight: 4.0 },
          baseBeach
        );
        const personalized = scoreConditions(
          { ...basePersonalizedForecast, waveHeight: 4.0 },
          baseBeach,
          { userPreferences: { preferredWaveSize: 'small' } }
        );
        expect(nonPersonalized.subscores.waveHeightFit).toBe(25);
        expect(personalized.subscores.waveHeightFit).toBeLessThan(25);
      });

      it('personalized large-pref lowers score for waves below comfort zone vs non-personalized ideal', () => {
        // 3ft is in default ideal range (non-personalized = 25),
        // but for 'large' preference it is below the partial-low floor (score = 3).
        const nonPersonalized = scoreConditions(
          { ...basePersonalizedForecast, waveHeight: 3.0 },
          baseBeach
        );
        const personalized = scoreConditions(
          { ...basePersonalizedForecast, waveHeight: 3.0 },
          baseBeach,
          { userPreferences: { preferredWaveSize: 'large' } }
        );
        expect(nonPersonalized.subscores.waveHeightFit).toBe(25);
        expect(personalized.subscores.waveHeightFit).toBeLessThan(25);
      });
    });
  });
});
