/**
 * @jest-environment node
 *
 * Tests for getConditionCharacter() — the qualitative condition classifier.
 *
 * Tests are grouped by priority order (first match wins):
 * skip → flat → small → medium → large → fallback
 */

import { getConditionCharacter } from '@/lib/scoring/surf-conditions-scorer';
import type { BeachWithThresholds, ForecastForScoring, ConditionSubscores } from '@/lib/scoring/types';

// A beach with ideal SW swell, E offshore wind
const beach: BeachWithThresholds = {
  id: 'char-beach',
  name: 'Character Test Beach',
  wind_offshore_deg: 90,  // E wind = offshore
  wind_offshore_tol_deg: 45,
  preferred_tide_ft_min: 1.5,
  preferred_tide_ft_max: 5.0,
  max_wind_onshore_mph: 10,
  max_wind_any_mph: 25,
  swell_window_center_deg: 260,
  swell_window_halfwidth_deg: 30,
};

// Good conditions baseline
const baseSubscores: ConditionSubscores = {
  waveHeightFit: 20,
  periodEnergy: 18,
  windAlignment: 18,
  tideFit: 12,
};

const baseForecast: ForecastForScoring = {
  forecastTime: new Date('2026-01-14T08:00:00Z'),
  waveHeight: 1.5,
  wavePeriod: 12,
  windSpeed: 5,
  windDirection: 90,  // Offshore
  tideHeight: 3.0,
  tideStatus: 'rising',
  swellDirection: 260,
};

describe('getConditionCharacter', () => {
  describe('skip conditions', () => {
    it('classifies blown-out conditions (wind > 25mph) as skip', () => {
      const forecast = { ...baseForecast, windSpeed: 28 };
      const result = getConditionCharacter(forecast, beach, baseSubscores, 0);
      expect(result.category).toBe('skip');
      expect(result.label).toMatch(/blown out/i);
    });

    it('classifies strong onshore wind (> 10mph) as skip', () => {
      const forecast = { ...baseForecast, windSpeed: 12, windDirection: 270 }; // W = onshore
      const result = getConditionCharacter(forecast, beach, baseSubscores, 0);
      expect(result.category).toBe('skip');
      expect(result.label).toMatch(/onshore/i);
    });
  });

  describe('flat conditions', () => {
    it('classifies < 0.5ft as flat', () => {
      const forecast = { ...baseForecast, waveHeight: 0.3 };
      const result = getConditionCharacter(forecast, beach, baseSubscores, 5);
      expect(result.category).toBe('flat');
      expect(result.label.length).toBeGreaterThan(0);
    });

    it('classifies 0ft as flat', () => {
      const forecast = { ...baseForecast, waveHeight: 0 };
      const result = getConditionCharacter(forecast, beach, baseSubscores, 0);
      expect(result.category).toBe('flat');
    });
  });

  describe('small wave conditions (0.5-2ft)', () => {
    it('classifies 1.5ft + 14s + ideal direction as small-quality with "powerful" label', () => {
      const forecast = { ...baseForecast, waveHeight: 1.5, wavePeriod: 14, swellDirection: 260 };
      const result = getConditionCharacter(forecast, beach, baseSubscores, 45);
      expect(result.category).toBe('small-quality');
      expect(result.label).toMatch(/powerful/i);
    });

    it('classifies 1.5ft + 14s + 45° off ideal direction as small-quality with "push" label', () => {
      const forecast = { ...baseForecast, waveHeight: 1.5, wavePeriod: 14, swellDirection: 215 }; // ~45° off 260
      const result = getConditionCharacter(forecast, beach, baseSubscores, 42);
      expect(result.category).toBe('small-quality');
      expect(result.label).toMatch(/push/i);
    });

    it('classifies 1.5ft + light wind (<5mph) + good tide as small-clean with "clean" or "glassy" label', () => {
      const forecast = { ...baseForecast, waveHeight: 1.5, wavePeriod: 10, windSpeed: 3, swellDirection: 100 };
      const result = getConditionCharacter(forecast, beach, baseSubscores, 48);
      expect(result.category).toBe('small-clean');
      expect(result.label.toLowerCase()).toMatch(/clean|glassy/);
    });

    it('classifies 1.5ft + onshore 5-10mph as small-weak with "choppy" label', () => {
      const forecast = { ...baseForecast, waveHeight: 1.5, wavePeriod: 9, windSpeed: 7, windDirection: 270 };
      const result = getConditionCharacter(forecast, beach, baseSubscores, 35);
      expect(result.category).toBe('small-weak');
      expect(result.label).toMatch(/choppy/i);
    });

    it('classifies 1.5ft + period < 8s as small-weak with "Weak" label', () => {
      const forecast = { ...baseForecast, waveHeight: 1.5, wavePeriod: 6 };
      const result = getConditionCharacter(forecast, beach, baseSubscores, 30);
      expect(result.category).toBe('small-weak');
      expect(result.label).toMatch(/weak/i);
    });
  });

  describe('medium wave conditions (2-5ft)', () => {
    it('classifies 3ft + 12s + offshore + good tide as medium-clean with "Dialed" label', () => {
      const forecast = { ...baseForecast, waveHeight: 3.5, wavePeriod: 12, windSpeed: 5, windDirection: 90 };
      const medSubscores: ConditionSubscores = { waveHeightFit: 25, periodEnergy: 16, windAlignment: 18, tideFit: 13 };
      const result = getConditionCharacter(forecast, beach, medSubscores, 78);
      expect(result.category).toBe('medium-clean');
      expect(result.label).toMatch(/dialed/i);
    });

    it('classifies 3ft + mixed wind as medium-mixed', () => {
      const forecast = { ...baseForecast, waveHeight: 3.0, wavePeriod: 9, windSpeed: 10, windDirection: 200 };
      const medSubscores: ConditionSubscores = { waveHeightFit: 25, periodEnergy: 10, windAlignment: 10, tideFit: 10 };
      const result = getConditionCharacter(forecast, beach, medSubscores, 55);
      expect(result.category).toBe('medium-mixed');
    });
  });

  describe('large wave conditions (5ft+)', () => {
    it('classifies 6ft + offshore + 12s as large-clean with "Firing" label', () => {
      const forecast = { ...baseForecast, waveHeight: 6.0, wavePeriod: 12, windSpeed: 5, windDirection: 90 };
      const largeSubscores: ConditionSubscores = { waveHeightFit: 22, periodEnergy: 16, windAlignment: 18, tideFit: 12 };
      const result = getConditionCharacter(forecast, beach, largeSubscores, 82);
      expect(result.category).toBe('large-clean');
      expect(result.label).toMatch(/firing/i);
    });

    it('classifies 6ft + strong wind as large-rough', () => {
      const forecast = { ...baseForecast, waveHeight: 6.0, wavePeriod: 10, windSpeed: 18, windDirection: 200 };
      const largeSubscores: ConditionSubscores = { waveHeightFit: 20, periodEnergy: 12, windAlignment: 8, tideFit: 10 };
      const result = getConditionCharacter(forecast, beach, largeSubscores, 58);
      expect(result.category).toBe('large-rough');
    });
  });

  describe('fallback behavior', () => {
    it('always returns a valid category and non-empty label', () => {
      // Unusual conditions — should still produce valid output
      const forecast = { ...baseForecast, waveHeight: 2.5, wavePeriod: 8, windSpeed: 12, windDirection: 200 };
      const result = getConditionCharacter(forecast, beach, baseSubscores, 50);
      const validCategories = ['flat', 'small-weak', 'small-quality', 'small-clean', 'medium-clean', 'medium-mixed', 'large-clean', 'large-rough', 'skip'];
      expect(validCategories).toContain(result.category);
      expect(result.label.length).toBeGreaterThan(0);
    });
  });


});
