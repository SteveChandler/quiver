/**
 * Tests for setup-risk scorer.
 */

import {
  detectSetupRisk,
  LOW_TIDE_HEAVY_SWELL_WARNING,
  setupRiskScorer,
} from '@/lib/domains/scoring';
import { createInput } from '../__fixtures__';

describe('setupRiskScorer', () => {
  it('flags large beach-break surf on a dropping low tide as severe setup risk', () => {
    const input = createInput(
      {
        waveHeight: 7,
        wavePeriod: 10,
        tide: { heightFt: -0.4, status: 'falling', direction: 'falling' },
      },
      {
        breakType: 'beach',
        tidePreferences: {
          minHeightFt: 2,
          maxHeightFt: 6,
          preferredDirection: 'either',
          directionSensitivity: 'medium',
        },
      }
    );

    expect(detectSetupRisk(input)).toEqual({
      severity: 'severe',
      warning: LOW_TIDE_HEAVY_SWELL_WARNING,
    });

    const result = setupRiskScorer.score(input);
    expect(result.skip).toBe(true);
    expect(result.skipReason).toBe(LOW_TIDE_HEAVY_SWELL_WARNING);
    expect(result.warnings).toContain(LOW_TIDE_HEAVY_SWELL_WARNING);
  });

  it('does not flag normal mid-tide surf', () => {
    const input = createInput(
      {
        waveHeight: 7,
        wavePeriod: 10,
        tide: { heightFt: 3, status: 'falling', direction: 'falling' },
      },
      {
        breakType: 'beach',
        tidePreferences: {
          minHeightFt: 2,
          maxHeightFt: 6,
          preferredDirection: 'either',
          directionSensitivity: 'medium',
        },
      }
    );

    const result = setupRiskScorer.score(input);
    expect(detectSetupRisk(input)).toBeNull();
    expect(result.skip).toBe(false);
    expect(result.warnings).toEqual([]);
  });

  it('does not flag smaller surf on a dropping low tide', () => {
    const input = createInput(
      {
        waveHeight: 4,
        wavePeriod: 10,
        tide: { heightFt: -0.4, status: 'falling', direction: 'falling' },
      },
      {
        breakType: 'beach',
        tidePreferences: {
          minHeightFt: 2,
          maxHeightFt: 6,
          preferredDirection: 'either',
          directionSensitivity: 'medium',
        },
      }
    );

    const result = setupRiskScorer.score(input);
    expect(detectSetupRisk(input)).toBeNull();
    expect(result.skip).toBe(false);
  });

  it('does not flag non-beach breaks', () => {
    const input = createInput(
      {
        waveHeight: 7,
        wavePeriod: 10,
        tide: { heightFt: -0.4, status: 'falling', direction: 'falling' },
      },
      {
        breakType: 'reef',
        tidePreferences: {
          minHeightFt: 2,
          maxHeightFt: 6,
          preferredDirection: 'either',
          directionSensitivity: 'medium',
        },
      }
    );

    const result = setupRiskScorer.score(input);
    expect(detectSetupRisk(input)).toBeNull();
    expect(result.skip).toBe(false);
  });

  it('does not throw when break type is missing', () => {
    const input = createInput(
      {
        waveHeight: 7,
        wavePeriod: 10,
        tide: { heightFt: -0.4, status: 'falling', direction: 'falling' },
      },
      {
        breakType: null as any,
        tidePreferences: {
          minHeightFt: 2,
          maxHeightFt: 6,
          preferredDirection: 'either',
          directionSensitivity: 'medium',
        },
      }
    );

    expect(() => setupRiskScorer.score(input)).not.toThrow();
    expect(detectSetupRisk(input)).toBeNull();
  });
});
